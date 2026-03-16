/**
 * Platform-specific feature detection
 *
 * Use this to check what features are available on the current platform
 * before rendering UI elements that depend on those features.
 */

import { getAccountPlatform, getCurrentAcc } from './store-utils.js';
import { PLATFORM_BLUESKY, PLATFORM_MASTODON } from './platforms/types.js';

/**
 * Feature support by platform
 */
const PLATFORM_FEATURES = {
  [PLATFORM_MASTODON]: {
    polls: true,
    edit: true,
    contentWarning: true,
    customEmoji: true,
    lists: true,
    quotePosts: false, // Extension only
    customFeeds: false,
    streaming: true,
    bookmarks: true,
    scheduledPosts: true,
    directMessages: true,
    pin: true,
    mute: true,
    block: true,
    report: true,
    translate: true,
    filters: true,
    followRequests: true,
    announcements: true,
    trends: true,
    suggestions: true,
    maxCharacters: 500,
    maxMediaAttachments: 4,
    maxPollOptions: 4,
    maxPollCharactersPerOption: 50,
  },
  [PLATFORM_BLUESKY]: {
    polls: false,
    edit: false,
    contentWarning: false, // Uses labels instead
    customEmoji: false,
    lists: true,
    quotePosts: true,
    customFeeds: true,
    streaming: false,
    bookmarks: false,
    scheduledPosts: false,
    directMessages: false, // Different system
    pin: false,
    mute: true,
    block: true,
    report: true,
    translate: false,
    filters: false, // Uses moderation lists
    followRequests: false,
    announcements: false,
    trends: false,
    suggestions: true,
    maxCharacters: 300,
    maxMediaAttachments: 4,
    maxPollOptions: 0,
    maxPollCharactersPerOption: 0,
  },
};

/**
 * Get all features for a platform
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {Object}
 */
export function getPlatformFeatures(platform) {
  const p = platform || getAccountPlatform(getCurrentAcc());
  return PLATFORM_FEATURES[p] || PLATFORM_FEATURES[PLATFORM_MASTODON];
}

/**
 * Check if a specific feature is supported
 * @param {string} feature - Feature name
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supports(feature, platform) {
  const features = getPlatformFeatures(platform);
  return !!features[feature];
}

/**
 * Get maximum character limit for posts
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {number}
 */
export function getMaxCharacters(platform) {
  const features = getPlatformFeatures(platform);
  return features.maxCharacters || 500;
}

/**
 * Get maximum media attachments per post
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {number}
 */
export function getMaxMediaAttachments(platform) {
  const features = getPlatformFeatures(platform);
  return features.maxMediaAttachments || 4;
}

/**
 * Check if current platform supports polls
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsPollsFeature(platform) {
  return supports('polls', platform);
}

/**
 * Check if current platform supports post editing
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsEdit(platform) {
  return supports('edit', platform);
}

/**
 * Check if current platform supports content warnings
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsContentWarning(platform) {
  return supports('contentWarning', platform);
}

/**
 * Check if current platform supports bookmarks
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsBookmarks(platform) {
  return supports('bookmarks', platform);
}

/**
 * Check if current platform supports native quote posts
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsQuotePosts(platform) {
  return supports('quotePosts', platform);
}

/**
 * Check if current platform supports real-time streaming
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsStreaming(platform) {
  return supports('streaming', platform);
}

/**
 * Check if current platform supports custom feeds
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsCustomFeeds(platform) {
  return supports('customFeeds', platform);
}

/**
 * Check if current platform supports scheduled posts
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsScheduledPosts(platform) {
  return supports('scheduledPosts', platform);
}

/**
 * Check if current platform supports pinning posts
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {boolean}
 */
export function supportsPin(platform) {
  return supports('pin', platform);
}

/**
 * Check if a status supports a specific action based on its platform
 * @param {Object} status - Status object
 * @param {string} action - Action name
 * @returns {boolean}
 */
export function statusSupports(status, action) {
  const platform = status?._platform || PLATFORM_MASTODON;
  return supports(action, platform);
}

/**
 * Get platform-specific UI labels
 * @param {import('./platforms/types.js').PlatformType} [platform]
 * @returns {Object}
 */
export function getPlatformLabels(platform) {
  const p = platform || getAccountPlatform(getCurrentAcc());

  if (p === PLATFORM_BLUESKY) {
    return {
      boost: 'Repost',
      boosted: 'Reposted',
      boosts: 'Reposts',
      favourite: 'Like',
      favourited: 'Liked',
      favourites: 'Likes',
      toot: 'Post',
      toots: 'Posts',
      instance: 'PDS',
    };
  }

  return {
    boost: 'Boost',
    boosted: 'Boosted',
    boosts: 'Boosts',
    favourite: 'Favourite',
    favourited: 'Favourited',
    favourites: 'Favourites',
    toot: 'Toot',
    toots: 'Toots',
    instance: 'Instance',
  };
}
