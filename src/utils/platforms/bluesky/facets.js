/**
 * Bluesky Facets <-> HTML conversion
 *
 * Bluesky uses "facets" - byte-offset rich text annotations.
 * This module converts between facets and HTML.
 */

/**
 * Convert Bluesky post text with facets to HTML
 * @param {string} text - Plain text content
 * @param {Array} facets - Array of facet objects
 * @returns {string} HTML string
 */
export function facetsToHtml(text, facets) {
  if (!text) return '';
  if (!facets || facets.length === 0) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  // Convert text to UTF-8 bytes for proper offset handling
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(text);

  // Sort facets by byte start position
  const sortedFacets = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  );

  // Build HTML by processing text segments
  let html = '';
  let lastByteEnd = 0;

  for (const facet of sortedFacets) {
    const { byteStart, byteEnd } = facet.index;

    // Add text before this facet
    if (byteStart > lastByteEnd) {
      const beforeText = decoder.decode(bytes.slice(lastByteEnd, byteStart));
      html += escapeHtml(beforeText);
    }

    // Get the faceted text
    const facetText = decoder.decode(bytes.slice(byteStart, byteEnd));

    // Process facet features
    for (const feature of facet.features) {
      if (feature.$type === 'app.bsky.richtext.facet#mention') {
        // Mention
        const did = feature.did;
        html += `<a href="https://bsky.app/profile/${did}" class="mention" data-did="${escapeHtml(did)}">@${escapeHtml(facetText.replace(/^@/, ''))}</a>`;
      } else if (feature.$type === 'app.bsky.richtext.facet#link') {
        // Link
        const uri = feature.uri;
        html += `<a href="${escapeHtml(uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(facetText)}</a>`;
      } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
        // Hashtag
        const tag = feature.tag;
        html += `<a href="https://bsky.app/hashtag/${encodeURIComponent(tag)}" class="hashtag">#${escapeHtml(tag)}</a>`;
      } else {
        // Unknown facet type, just output text
        html += escapeHtml(facetText);
      }
    }

    lastByteEnd = byteEnd;
  }

  // Add remaining text after last facet
  if (lastByteEnd < bytes.length) {
    const afterText = decoder.decode(bytes.slice(lastByteEnd));
    html += escapeHtml(afterText);
  }

  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * Convert HTML to plain text with facets
 * @param {string} html - HTML content
 * @returns {{text: string, facets: Array}} Text and facets
 */
export function htmlToFacets(html) {
  if (!html) return { text: '', facets: [] };

  const facets = [];
  const encoder = new TextEncoder();

  // Create a temporary DOM element
  const div = document.createElement('div');
  div.innerHTML = html;

  let text = '';
  let byteOffset = 0;

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
      byteOffset += encoder.encode(node.textContent).length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      if (tagName === 'br') {
        text += '\n';
        byteOffset += 1;
      } else if (tagName === 'p') {
        // Add paragraph break
        if (text.length > 0 && !text.endsWith('\n\n')) {
          if (!text.endsWith('\n')) {
            text += '\n';
            byteOffset += 1;
          }
          text += '\n';
          byteOffset += 1;
        }
        for (const child of node.childNodes) {
          processNode(child);
        }
        if (!text.endsWith('\n')) {
          text += '\n';
          byteOffset += 1;
        }
      } else if (tagName === 'a') {
        const href = node.getAttribute('href');
        const linkText = node.textContent;
        const byteStart = byteOffset;

        text += linkText;
        byteOffset += encoder.encode(linkText).length;

        const byteEnd = byteOffset;

        // Determine facet type based on link attributes or content
        if (node.classList.contains('mention') || linkText.startsWith('@')) {
          // Mention
          const did = node.getAttribute('data-did');
          if (did) {
            facets.push({
              index: { byteStart, byteEnd },
              features: [
                {
                  $type: 'app.bsky.richtext.facet#mention',
                  did,
                },
              ],
            });
          }
        } else if (
          node.classList.contains('hashtag') ||
          linkText.startsWith('#')
        ) {
          // Hashtag
          const tag = linkText.replace(/^#/, '');
          facets.push({
            index: { byteStart, byteEnd },
            features: [
              {
                $type: 'app.bsky.richtext.facet#tag',
                tag,
              },
            ],
          });
        } else if (href) {
          // Regular link
          facets.push({
            index: { byteStart, byteEnd },
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: href,
              },
            ],
          });
        }
      } else {
        // Process children
        for (const child of node.childNodes) {
          processNode(child);
        }
      }
    }
  }

  for (const child of div.childNodes) {
    processNode(child);
  }

  // Trim trailing newlines
  text = text.replace(/\n+$/, '');

  return { text, facets };
}

/**
 * Escape HTML special characters
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extract mentions from text
 * @param {string} text
 * @returns {Array<{text: string, start: number, end: number}>}
 */
export function extractMentions(text) {
  const mentions = [];
  const regex = /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Extract hashtags from text
 * @param {string} text
 * @returns {Array<{text: string, tag: string, start: number, end: number}>}
 */
export function extractHashtags(text) {
  const hashtags = [];
  // Match hashtags (# followed by word characters, allowing unicode)
  const regex = /#[\p{L}\p{N}_]+/gu;

  let match;
  while ((match = regex.exec(text)) !== null) {
    hashtags.push({
      text: match[0],
      tag: match[0].slice(1), // Remove #
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return hashtags;
}

/**
 * Extract links from text
 * @param {string} text
 * @returns {Array<{text: string, uri: string, start: number, end: number}>}
 */
export function extractLinks(text) {
  const links = [];
  // Simple URL regex
  const regex = /https?:\/\/[^\s<>)"']+/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    let url = match[0];
    // Remove trailing punctuation that's likely not part of the URL
    url = url.replace(/[.,;:!?)\]]+$/, '');

    links.push({
      text: url,
      uri: url,
      start: match.index,
      end: match.index + url.length,
    });
  }

  return links;
}
