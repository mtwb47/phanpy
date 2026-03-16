/**
 * Unified type definitions for platform adapters
 * These types represent the normalized data model used internally by Phanpy
 */

/**
 * @typedef {'mastodon' | 'bluesky'} PlatformType
 */

/**
 * @typedef {Object} PhanpyAccount
 * @property {string} id - Unique identifier (Mastodon: numeric, Bluesky: DID)
 * @property {string} username - Local username without domain
 * @property {string} acct - Full account identifier (@user@domain or @handle.bsky.social)
 * @property {string} displayName - Display name
 * @property {string} avatar - Avatar URL
 * @property {string} avatarStatic - Static avatar URL (for animated avatars)
 * @property {string} header - Header/banner image URL
 * @property {string} headerStatic - Static header URL
 * @property {string} note - Bio/description (HTML for Mastodon, plain text for Bluesky)
 * @property {string} url - Profile URL
 * @property {number} followersCount - Number of followers
 * @property {number} followingCount - Number of accounts following
 * @property {number} statusesCount - Number of posts
 * @property {string} createdAt - ISO 8601 timestamp
 * @property {boolean} locked - Whether account requires follow approval
 * @property {boolean} bot - Whether account is a bot
 * @property {Array<{name: string, value: string}>} fields - Profile fields
 * @property {Array<{shortcode: string, url: string}>} emojis - Custom emojis (Mastodon only)
 * @property {PlatformType} _platform - Source platform
 * @property {Object} _original - Original platform-specific data
 */

/**
 * @typedef {Object} PhanpyStatus
 * @property {string} id - Unique identifier (Mastodon: numeric, Bluesky: AT URI)
 * @property {string} uri - Canonical URI
 * @property {string} url - Web URL for viewing
 * @property {PhanpyAccount} account - Author account
 * @property {string} content - Post content (HTML)
 * @property {string} contentText - Plain text content
 * @property {string} createdAt - ISO 8601 timestamp
 * @property {string|null} editedAt - ISO 8601 timestamp of last edit (null if never edited)
 * @property {string|null} inReplyToId - ID of parent post if reply
 * @property {string|null} inReplyToAccountId - Account ID of parent post author
 * @property {boolean} sensitive - Whether content is sensitive
 * @property {string} spoilerText - Content warning text
 * @property {string} visibility - Visibility level ('public', 'unlisted', 'private', 'direct')
 * @property {string} language - BCP-47 language code
 * @property {number} repliesCount - Number of replies
 * @property {number} reblogsCount - Number of boosts/reposts
 * @property {number} favouritesCount - Number of likes
 * @property {boolean} favourited - Whether current user liked
 * @property {boolean} reblogged - Whether current user boosted
 * @property {boolean} bookmarked - Whether current user bookmarked
 * @property {boolean} muted - Whether current user muted conversation
 * @property {boolean} pinned - Whether post is pinned to profile
 * @property {Array<PhanpyMediaAttachment>} mediaAttachments - Media attachments
 * @property {PhanpyPoll|null} poll - Poll data if present
 * @property {PhanpyStatus|null} reblog - Boosted/reposted status
 * @property {PhanpyStatus|null} quote - Quoted status (native quotes)
 * @property {Object|null} card - Link preview card
 * @property {Array<{name: string, url: string}>} tags - Hashtags
 * @property {Array<{id: string, username: string, acct: string, url: string}>} mentions - Mentioned accounts
 * @property {Array<{shortcode: string, url: string}>} emojis - Custom emojis
 * @property {PlatformType} _platform - Source platform
 * @property {Object} _original - Original platform-specific data
 * @property {string} [_cid] - Bluesky CID (needed for interactions)
 */

/**
 * @typedef {Object} PhanpyMediaAttachment
 * @property {string} id - Unique identifier
 * @property {string} type - Media type ('image', 'video', 'audio', 'gifv', 'unknown')
 * @property {string} url - Full-size media URL
 * @property {string} previewUrl - Thumbnail/preview URL
 * @property {string|null} remoteUrl - Original remote URL if proxied
 * @property {string} description - Alt text
 * @property {string} blurhash - Blurhash placeholder
 * @property {Object} meta - Dimensions and other metadata
 */

/**
 * @typedef {Object} PhanpyPoll
 * @property {string} id - Unique identifier
 * @property {string} expiresAt - ISO 8601 expiration timestamp
 * @property {boolean} expired - Whether poll has ended
 * @property {boolean} multiple - Whether multiple choices allowed
 * @property {number} votesCount - Total votes
 * @property {number} votersCount - Total unique voters
 * @property {boolean} voted - Whether current user voted
 * @property {Array<number>} ownVotes - Indices of current user's choices
 * @property {Array<{title: string, votesCount: number}>} options - Poll options
 */

/**
 * @typedef {Object} PhanpyNotification
 * @property {string} id - Unique identifier
 * @property {string} type - Notification type ('favourite', 'reblog', 'follow', 'mention', 'poll', 'follow_request', 'quote')
 * @property {string} createdAt - ISO 8601 timestamp
 * @property {PhanpyAccount} account - Account that triggered notification
 * @property {PhanpyStatus|null} status - Related status if applicable
 * @property {PlatformType} _platform - Source platform
 * @property {Object} _original - Original platform-specific data
 */

/**
 * @typedef {Object} PhanpyRelationship
 * @property {string} id - Account ID
 * @property {boolean} following - Whether current user follows
 * @property {boolean} followedBy - Whether they follow current user
 * @property {boolean} blocking - Whether current user blocks
 * @property {boolean} blockedBy - Whether they block current user
 * @property {boolean} muting - Whether current user mutes
 * @property {boolean} mutingNotifications - Whether muting notifications
 * @property {boolean} requested - Whether follow request pending
 * @property {boolean} domainBlocking - Whether domain is blocked
 * @property {boolean} endorsed - Whether endorsed/featured
 * @property {string} note - Private note about account
 */

/**
 * @typedef {Object} PlatformCapabilities
 * @property {boolean} polls - Whether polls are supported
 * @property {boolean} edit - Whether post editing is supported
 * @property {boolean} contentWarning - Whether content warnings are supported
 * @property {boolean} customEmoji - Whether custom emoji are supported
 * @property {boolean} lists - Whether lists are supported
 * @property {boolean} quotePosts - Whether native quote posts are supported
 * @property {boolean} customFeeds - Whether custom feeds are supported (Bluesky)
 * @property {boolean} streaming - Whether real-time streaming is supported
 * @property {boolean} bookmarks - Whether bookmarks are supported
 * @property {boolean} scheduledPosts - Whether scheduled posts are supported
 * @property {number} maxCharacters - Maximum post character limit
 * @property {number} maxMediaAttachments - Maximum media per post
 */

/**
 * @typedef {Object} PlatformAdapter
 * @property {PlatformType} platform - Platform identifier
 * @property {PlatformCapabilities} capabilities - Platform feature support
 *
 * Timeline methods:
 * @property {function(Object): Promise<{statuses: PhanpyStatus[], nextCursor: string|null}>} getHomeTimeline
 * @property {function(string, Object): Promise<{statuses: PhanpyStatus[], nextCursor: string|null}>} getAccountTimeline
 * @property {function(string, Object): Promise<PhanpyStatus>} getStatus
 * @property {function(string, Object): Promise<{ancestors: PhanpyStatus[], descendants: PhanpyStatus[]}>} getStatusContext
 *
 * Account methods:
 * @property {function(): Promise<PhanpyAccount>} verifyCredentials
 * @property {function(string): Promise<PhanpyAccount>} getAccount
 * @property {function(string): Promise<PhanpyRelationship>} getRelationship
 * @property {function(string): Promise<PhanpyRelationship>} follow
 * @property {function(string): Promise<PhanpyRelationship>} unfollow
 *
 * Interaction methods:
 * @property {function(string, string?): Promise<PhanpyStatus>} favourite - Like a post (id, cid for Bluesky)
 * @property {function(string, string?): Promise<PhanpyStatus>} unfavourite
 * @property {function(string, string?): Promise<PhanpyStatus>} reblog - Boost/repost
 * @property {function(string, string?): Promise<PhanpyStatus>} unreblog
 * @property {function(string): Promise<PhanpyStatus>} bookmark
 * @property {function(string): Promise<PhanpyStatus>} unbookmark
 *
 * Compose methods:
 * @property {function(Object): Promise<PhanpyStatus>} createStatus
 * @property {function(string): Promise<void>} deleteStatus
 * @property {function(File): Promise<PhanpyMediaAttachment>} uploadMedia
 *
 * Notification methods:
 * @property {function(Object): Promise<{notifications: PhanpyNotification[], nextCursor: string|null}>} getNotifications
 * @property {function(): Promise<void>} clearNotifications
 *
 * Search methods:
 * @property {function(string, Object): Promise<{accounts: PhanpyAccount[], statuses: PhanpyStatus[]}>} search
 */

export const PLATFORM_MASTODON = 'mastodon';
export const PLATFORM_BLUESKY = 'bluesky';

export const PLATFORMS = [PLATFORM_MASTODON, PLATFORM_BLUESKY];
