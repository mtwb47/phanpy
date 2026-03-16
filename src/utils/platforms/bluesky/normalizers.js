/**
 * Bluesky to Phanpy unified format normalizers
 */

import { PLATFORM_BLUESKY } from '../types.js';
import { facetsToHtml } from './facets.js';

/**
 * Normalize a Bluesky profile to PhanpyAccount
 * @param {Object} profile - Bluesky profile object
 * @returns {import('../types.js').PhanpyAccount}
 */
export function normalizeAccount(profile) {
  if (!profile) return null;

  // Already normalized?
  if (profile._platform === PLATFORM_BLUESKY) {
    return profile;
  }

  const did = profile.did;
  const handle = profile.handle;

  return {
    id: did,
    username: handle,
    acct: `@${handle}`,
    displayName: profile.displayName || handle,
    avatar: profile.avatar || '',
    avatarStatic: profile.avatar || '',
    header: profile.banner || '',
    headerStatic: profile.banner || '',
    note: profile.description || '',
    url: `https://bsky.app/profile/${handle}`,
    followersCount: profile.followersCount || 0,
    followingCount: profile.followsCount || 0,
    statusesCount: profile.postsCount || 0,
    createdAt: profile.createdAt || profile.indexedAt || new Date().toISOString(),
    locked: false, // Bluesky doesn't have locked accounts
    bot: false,
    fields: [], // Bluesky doesn't have profile fields yet
    emojis: [], // Bluesky doesn't have custom emoji

    // Platform metadata
    _platform: PLATFORM_BLUESKY,
    _original: profile,
    _did: did,
    _handle: handle,

    // Bluesky-specific
    viewer: profile.viewer,
    labels: profile.labels,
  };
}

/**
 * Normalize a Bluesky post to PhanpyStatus
 * @param {Object} post - Bluesky feed view post or post view
 * @param {Object} [opts] - Options
 * @returns {import('../types.js').PhanpyStatus}
 */
export function normalizeStatus(post, opts = {}) {
  if (!post) return null;

  // Already normalized?
  if (post._platform === PLATFORM_BLUESKY) {
    return post;
  }

  // Handle feed view post (has .post property) vs direct post view
  const actualPost = post.post || post;
  const record = actualPost.record || {};
  const author = actualPost.author;
  const uri = actualPost.uri;
  const cid = actualPost.cid;

  // Parse AT URI for rkey
  const uriParts = uri?.split('/') || [];
  const rkey = uriParts[uriParts.length - 1];

  // Convert text + facets to HTML
  const text = record.text || '';
  const facets = record.facets || [];
  const content = facetsToHtml(text, facets);

  // Handle reply info
  let inReplyToId = null;
  let inReplyToAccountId = null;
  if (record.reply?.parent) {
    inReplyToId = record.reply.parent.uri;
    // Extract DID from AT URI
    const parentUri = record.reply.parent.uri;
    if (parentUri?.startsWith('at://')) {
      const parts = parentUri.split('/');
      inReplyToAccountId = parts[2]; // did:plc:xxx
    }
  }

  // Handle embed (images, video, external, quote)
  const embed = actualPost.embed || {};
  const mediaAttachments = [];
  let quote = null;
  let card = null;

  if (embed.$type === 'app.bsky.embed.images#view') {
    for (const image of embed.images || []) {
      mediaAttachments.push(normalizeImage(image));
    }
  } else if (embed.$type === 'app.bsky.embed.video#view') {
    mediaAttachments.push(normalizeVideo(embed));
  } else if (embed.$type === 'app.bsky.embed.external#view') {
    card = normalizeExternalEmbed(embed.external);
  } else if (embed.$type === 'app.bsky.embed.record#view') {
    // Quote post
    if (embed.record?.$type === 'app.bsky.embed.record#viewRecord') {
      quote = normalizeQuotedPost(embed.record);
    }
  } else if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    // Quote with media
    if (embed.record?.record?.$type === 'app.bsky.embed.record#viewRecord') {
      quote = normalizeQuotedPost(embed.record.record);
    }
    if (embed.media?.$type === 'app.bsky.embed.images#view') {
      for (const image of embed.media.images || []) {
        mediaAttachments.push(normalizeImage(image));
      }
    } else if (embed.media?.$type === 'app.bsky.embed.video#view') {
      mediaAttachments.push(normalizeVideo(embed.media));
    } else if (embed.media?.$type === 'app.bsky.embed.external#view') {
      card = normalizeExternalEmbed(embed.media.external);
    }
  }

  // Handle repost (reason in feed view)
  let reblog = null;
  if (post.reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
    // This is a repost - the current post becomes the reblog
    // We need to create a wrapper status for the repost
    const repostAuthor = post.reason.by;
    const repostIndexedAt = post.reason.indexedAt;

    // Create the inner status (the original post being reposted)
    const innerStatus = {
      id: uri,
      uri,
      url: `https://bsky.app/profile/${author.handle}/post/${rkey}`,
      account: normalizeAccount(author),
      content,
      contentText: text,
      createdAt: record.createdAt || actualPost.indexedAt,
      editedAt: null, // Bluesky doesn't support editing
      inReplyToId,
      inReplyToAccountId,
      sensitive: false,
      spoilerText: '', // Bluesky uses labels instead
      visibility: 'public',
      language: record.langs?.[0] || null,
      repliesCount: actualPost.replyCount || 0,
      reblogsCount: actualPost.repostCount || 0,
      favouritesCount: actualPost.likeCount || 0,
      favourited: !!actualPost.viewer?.like,
      reblogged: !!actualPost.viewer?.repost,
      bookmarked: false, // Bluesky doesn't have bookmarks
      muted: !!actualPost.viewer?.threadMuted,
      pinned: false,
      mediaAttachments,
      poll: null, // Bluesky doesn't have polls
      card,
      reblog: null,
      quote,
      tags: extractTags(text),
      mentions: extractMentionsFromFacets(facets),
      emojis: [],
      _platform: PLATFORM_BLUESKY,
      _original: actualPost,
      _cid: cid,
      _uri: uri,
      _labels: actualPost.labels,
    };

    // Return the repost wrapper
    return {
      id: `repost:${repostAuthor.did}:${uri}`,
      uri: `repost:${uri}`,
      url: `https://bsky.app/profile/${repostAuthor.handle}`,
      account: normalizeAccount(repostAuthor),
      content: '',
      contentText: '',
      createdAt: repostIndexedAt,
      editedAt: null,
      inReplyToId: null,
      inReplyToAccountId: null,
      sensitive: false,
      spoilerText: '',
      visibility: 'public',
      language: null,
      repliesCount: 0,
      reblogsCount: 0,
      favouritesCount: 0,
      favourited: false,
      reblogged: false,
      bookmarked: false,
      muted: false,
      pinned: false,
      mediaAttachments: [],
      poll: null,
      card: null,
      reblog: innerStatus,
      quote: null,
      tags: [],
      mentions: [],
      emojis: [],
      _platform: PLATFORM_BLUESKY,
      _original: post,
      _isRepost: true,
    };
  }

  return {
    id: uri,
    uri,
    url: `https://bsky.app/profile/${author.handle}/post/${rkey}`,
    account: normalizeAccount(author),
    content,
    contentText: text,
    createdAt: record.createdAt || actualPost.indexedAt,
    editedAt: null, // Bluesky doesn't support editing
    inReplyToId,
    inReplyToAccountId,
    sensitive: false,
    spoilerText: '', // Bluesky uses labels instead
    visibility: 'public',
    language: record.langs?.[0] || null,
    repliesCount: actualPost.replyCount || 0,
    reblogsCount: actualPost.repostCount || 0,
    favouritesCount: actualPost.likeCount || 0,
    favourited: !!actualPost.viewer?.like,
    reblogged: !!actualPost.viewer?.repost,
    bookmarked: false,
    muted: !!actualPost.viewer?.threadMuted,
    pinned: false,
    mediaAttachments,
    poll: null,
    card,
    reblog: null,
    quote,
    tags: extractTags(text),
    mentions: extractMentionsFromFacets(facets),
    emojis: [],

    // Platform metadata
    _platform: PLATFORM_BLUESKY,
    _original: post,
    _cid: cid,
    _uri: uri,
    _labels: actualPost.labels,
    _viewer: actualPost.viewer,
  };
}

/**
 * Normalize an image embed
 * @param {Object} image
 * @returns {import('../types.js').PhanpyMediaAttachment}
 */
function normalizeImage(image) {
  console.log('DEBUG normalizeImage input:', JSON.stringify(image, null, 2));
  const result = {
    id: image.fullsize || image.thumb,
    type: 'image',
    url: image.fullsize,
    previewUrl: image.thumb,
    remoteUrl: null,
    description: image.alt || '',
    blurhash: null,
    meta: {
      original: {
        width: image.aspectRatio?.width,
        height: image.aspectRatio?.height,
      },
    },
  };
  console.log('DEBUG normalizeImage output:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Normalize a video embed
 * @param {Object} video
 * @returns {import('../types.js').PhanpyMediaAttachment}
 */
function normalizeVideo(video) {
  return {
    id: video.cid || video.playlist,
    type: 'video',
    url: video.playlist, // HLS playlist URL
    previewUrl: video.thumbnail,
    remoteUrl: null,
    description: video.alt || '',
    blurhash: null,
    meta: {
      original: {
        width: video.aspectRatio?.width,
        height: video.aspectRatio?.height,
      },
    },
  };
}

/**
 * Normalize an external embed (link card)
 * @param {Object} external
 * @returns {Object}
 */
function normalizeExternalEmbed(external) {
  if (!external) return null;

  return {
    url: external.uri,
    title: external.title || '',
    description: external.description || '',
    image: external.thumb || null,
    type: 'link',
    authorName: '',
    authorUrl: '',
    providerName: new URL(external.uri).hostname,
    providerUrl: external.uri,
    html: '',
    width: null,
    height: null,
  };
}

/**
 * Normalize a quoted post
 * @param {Object} record
 * @returns {import('../types.js').PhanpyStatus}
 */
function normalizeQuotedPost(record) {
  if (!record) return null;

  const uri = record.uri;
  const author = record.author;
  const value = record.value || {};

  const uriParts = uri?.split('/') || [];
  const rkey = uriParts[uriParts.length - 1];

  const text = value.text || '';
  const facets = value.facets || [];
  const content = facetsToHtml(text, facets);

  // Handle embeds in quoted post
  const embed = record.embeds?.[0];
  const mediaAttachments = [];
  let card = null;

  if (embed?.$type === 'app.bsky.embed.images#view') {
    for (const image of embed.images || []) {
      mediaAttachments.push(normalizeImage(image));
    }
  } else if (embed?.$type === 'app.bsky.embed.external#view') {
    card = normalizeExternalEmbed(embed.external);
  }

  return {
    id: uri,
    uri,
    url: `https://bsky.app/profile/${author.handle}/post/${rkey}`,
    account: normalizeAccount(author),
    content,
    contentText: text,
    createdAt: value.createdAt || record.indexedAt,
    editedAt: null,
    inReplyToId: null,
    inReplyToAccountId: null,
    sensitive: false,
    spoilerText: '',
    visibility: 'public',
    language: value.langs?.[0] || null,
    repliesCount: record.replyCount || 0,
    reblogsCount: record.repostCount || 0,
    favouritesCount: record.likeCount || 0,
    favourited: false,
    reblogged: false,
    bookmarked: false,
    muted: false,
    pinned: false,
    mediaAttachments,
    poll: null,
    card,
    reblog: null,
    quote: null,
    tags: extractTags(text),
    mentions: extractMentionsFromFacets(facets),
    emojis: [],
    _platform: PLATFORM_BLUESKY,
    _original: record,
    _cid: record.cid,
    _uri: uri,
  };
}

/**
 * Normalize a notification
 * @param {Object} notification - Bluesky notification
 * @returns {import('../types.js').PhanpyNotification}
 */
export function normalizeNotification(notification) {
  if (!notification) return null;

  // Already normalized?
  if (notification._platform === PLATFORM_BLUESKY) {
    return notification;
  }

  // Map Bluesky notification types to Mastodon types
  const typeMap = {
    like: 'favourite',
    repost: 'reblog',
    follow: 'follow',
    reply: 'mention',
    quote: 'mention', // Treat quotes as mentions for now
    mention: 'mention',
  };

  const type = typeMap[notification.reason] || notification.reason;

  return {
    id: notification.uri || `${notification.reason}:${notification.cid}`,
    type,
    createdAt: notification.indexedAt,
    account: normalizeAccount(notification.author),
    status: notification.reasonSubject
      ? { id: notification.reasonSubject, _platform: PLATFORM_BLUESKY }
      : null,

    // Platform metadata
    _platform: PLATFORM_BLUESKY,
    _original: notification,
    _reason: notification.reason,
  };
}

/**
 * Normalize a relationship
 * @param {Object} viewer - Bluesky viewer state
 * @param {string} did - Target account DID
 * @returns {import('../types.js').PhanpyRelationship}
 */
export function normalizeRelationship(viewer, did) {
  if (!viewer) {
    return {
      id: did,
      following: false,
      followedBy: false,
      blocking: false,
      blockedBy: false,
      muting: false,
      mutingNotifications: false,
      requested: false,
      domainBlocking: false,
      endorsed: false,
      note: '',
    };
  }

  return {
    id: did,
    following: !!viewer.following,
    followedBy: !!viewer.followedBy,
    blocking: !!viewer.blocking,
    blockedBy: !!viewer.blockedBy,
    muting: !!viewer.muted,
    mutingNotifications: !!viewer.mutedByList,
    requested: false, // Bluesky doesn't have follow requests
    domainBlocking: false,
    endorsed: false,
    note: '',
  };
}

/**
 * Extract hashtags from text
 * @param {string} text
 * @returns {Array<{name: string, url: string}>}
 */
function extractTags(text) {
  if (!text) return [];

  const tags = [];
  const regex = /#([\p{L}\p{N}_]+)/gu;

  let match;
  while ((match = regex.exec(text)) !== null) {
    tags.push({
      name: match[1],
      url: `https://bsky.app/hashtag/${encodeURIComponent(match[1])}`,
    });
  }

  return tags;
}

/**
 * Extract mentions from facets
 * @param {Array} facets
 * @returns {Array<{id: string, username: string, acct: string, url: string}>}
 */
function extractMentionsFromFacets(facets) {
  if (!facets) return [];

  const mentions = [];

  for (const facet of facets) {
    for (const feature of facet.features || []) {
      if (feature.$type === 'app.bsky.richtext.facet#mention') {
        mentions.push({
          id: feature.did,
          username: feature.did, // We don't have handle here
          acct: feature.did,
          url: `https://bsky.app/profile/${feature.did}`,
        });
      }
    }
  }

  return mentions;
}
