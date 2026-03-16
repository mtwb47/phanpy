/**
 * Platform adapter registry and factory
 */

import { PLATFORM_BLUESKY, PLATFORM_MASTODON } from './types.js';

// Lazy-loaded adapters
let MastodonAdapter = null;
let BlueskyAdapter = null;

/**
 * Get adapter class for a platform
 * @param {import('./types.js').PlatformType} platform
 * @returns {Promise<typeof import('./mastodon/adapter.js').MastodonAdapter | typeof import('./bluesky/adapter.js').BlueskyAdapter>}
 */
export async function getAdapterClass(platform) {
  switch (platform) {
    case PLATFORM_MASTODON:
      if (!MastodonAdapter) {
        const mod = await import('./mastodon/adapter.js');
        MastodonAdapter = mod.MastodonAdapter;
      }
      return MastodonAdapter;

    case PLATFORM_BLUESKY:
      if (!BlueskyAdapter) {
        const mod = await import('./bluesky/adapter.js');
        BlueskyAdapter = mod.BlueskyAdapter;
      }
      return BlueskyAdapter;

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Create an adapter instance for an account
 * @param {Object} account - Account object from store
 * @returns {Promise<import('./types.js').PlatformAdapter>}
 */
export async function createAdapter(account) {
  const platform = account.platform || PLATFORM_MASTODON;
  const AdapterClass = await getAdapterClass(platform);
  return new AdapterClass(account);
}

/**
 * Create an adapter instance directly with credentials
 * @param {import('./types.js').PlatformType} platform
 * @param {Object} credentials - Platform-specific credentials
 * @returns {Promise<import('./types.js').PlatformAdapter>}
 */
export async function createAdapterWithCredentials(platform, credentials) {
  const AdapterClass = await getAdapterClass(platform);
  return AdapterClass.fromCredentials(credentials);
}

/**
 * Detect platform from instance URL or handle
 * @param {string} identifier - Instance URL or user handle
 * @returns {import('./types.js').PlatformType}
 */
export function detectPlatform(identifier) {
  if (!identifier) return PLATFORM_MASTODON;

  const lower = identifier.toLowerCase();

  // Bluesky handles end with .bsky.social or similar
  if (
    lower.endsWith('.bsky.social') ||
    lower.endsWith('.bsky.app') ||
    lower.includes('bsky.social') ||
    lower.includes('bsky.app') ||
    lower.includes('bsky.network')
  ) {
    return PLATFORM_BLUESKY;
  }

  // AT Protocol DIDs
  if (lower.startsWith('did:plc:') || lower.startsWith('did:web:')) {
    return PLATFORM_BLUESKY;
  }

  // AT URIs
  if (lower.startsWith('at://')) {
    return PLATFORM_BLUESKY;
  }

  // Default to Mastodon
  return PLATFORM_MASTODON;
}

/**
 * Check if an ID is an AT Protocol URI
 * @param {string} id
 * @returns {boolean}
 */
export function isAtUri(id) {
  return typeof id === 'string' && id.startsWith('at://');
}

/**
 * Check if an ID is a DID
 * @param {string} id
 * @returns {boolean}
 */
export function isDid(id) {
  return (
    typeof id === 'string' &&
    (id.startsWith('did:plc:') || id.startsWith('did:web:'))
  );
}

/**
 * Parse an AT URI into its components
 * @param {string} uri - AT URI (at://did/collection/rkey)
 * @returns {{did: string, collection: string, rkey: string}|null}
 */
export function parseAtUri(uri) {
  if (!isAtUri(uri)) return null;

  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  return {
    did: match[1],
    collection: match[2],
    rkey: match[3],
  };
}

export { PLATFORM_BLUESKY, PLATFORM_MASTODON, PLATFORMS } from './types.js';
