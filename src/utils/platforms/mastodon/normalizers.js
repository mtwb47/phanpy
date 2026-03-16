/**
 * Mastodon to Phanpy unified format normalizers
 *
 * Since Phanpy was originally built for Mastodon, these normalizers
 * are mostly passthrough with platform metadata additions.
 */

import { PLATFORM_MASTODON } from '../types.js';

/**
 * Normalize a Mastodon account to PhanpyAccount
 * @param {Object} account - Mastodon account object
 * @returns {import('../types.js').PhanpyAccount}
 */
export function normalizeAccount(account) {
  if (!account) return null;

  // Already normalized?
  if (account._platform === PLATFORM_MASTODON) {
    return account;
  }

  return {
    // Core fields - passthrough
    id: account.id,
    username: account.username,
    acct: account.acct,
    displayName: account.display_name || account.displayName || '',
    avatar: account.avatar,
    avatarStatic: account.avatar_static || account.avatarStatic,
    header: account.header,
    headerStatic: account.header_static || account.headerStatic,
    note: account.note || '',
    url: account.url,
    followersCount:
      account.followers_count ?? account.followersCount ?? 0,
    followingCount:
      account.following_count ?? account.followingCount ?? 0,
    statusesCount: account.statuses_count ?? account.statusesCount ?? 0,
    createdAt: account.created_at || account.createdAt,
    locked: account.locked || false,
    bot: account.bot || false,
    fields: account.fields || [],
    emojis: account.emojis || [],

    // Platform metadata
    _platform: PLATFORM_MASTODON,
    _original: account,

    // Preserve any additional Mastodon-specific fields
    discoverable: account.discoverable,
    group: account.group,
    suspended: account.suspended,
    limited: account.limited,
    moved: account.moved ? normalizeAccount(account.moved) : null,
    noindex: account.noindex,
    source: account.source,
    roles: account.roles,
    role: account.role,
  };
}

/**
 * Normalize a Mastodon status to PhanpyStatus
 * @param {Object} status - Mastodon status object
 * @param {string} [instance] - Instance URL for reference
 * @returns {import('../types.js').PhanpyStatus}
 */
export function normalizeStatus(status, instance) {
  if (!status) return null;

  // Already normalized?
  if (status._platform === PLATFORM_MASTODON) {
    return status;
  }

  const normalized = {
    // Core fields
    id: status.id,
    uri: status.uri,
    url: status.url,
    account: normalizeAccount(status.account),
    content: status.content || '',
    contentText: stripHtml(status.content || ''),
    createdAt: status.created_at || status.createdAt,
    editedAt: status.edited_at || status.editedAt || null,
    inReplyToId: status.in_reply_to_id || status.inReplyToId || null,
    inReplyToAccountId:
      status.in_reply_to_account_id || status.inReplyToAccountId || null,
    sensitive: status.sensitive || false,
    spoilerText: status.spoiler_text || status.spoilerText || '',
    visibility: status.visibility || 'public',
    language: status.language || null,

    // Counts
    repliesCount: status.replies_count ?? status.repliesCount ?? 0,
    reblogsCount: status.reblogs_count ?? status.reblogsCount ?? 0,
    favouritesCount:
      status.favourites_count ?? status.favouritesCount ?? 0,

    // Current user state
    favourited: status.favourited || false,
    reblogged: status.reblogged || false,
    bookmarked: status.bookmarked || false,
    muted: status.muted || false,
    pinned: status.pinned || false,

    // Attachments and embeds
    mediaAttachments: (
      status.media_attachments ||
      status.mediaAttachments ||
      []
    ).map(normalizeMediaAttachment),
    poll: status.poll ? normalizePoll(status.poll) : null,
    card: status.card || null,

    // Related content
    reblog: status.reblog ? normalizeStatus(status.reblog, instance) : null,
    quote: status.quote ? normalizeStatus(status.quote, instance) : null,

    // Tags and mentions
    tags: status.tags || [],
    mentions: status.mentions || [],
    emojis: status.emojis || [],

    // Platform metadata
    _platform: PLATFORM_MASTODON,
    _original: status,
    _instance: instance,

    // Mastodon-specific fields
    application: status.application,
    filtered: status.filtered,
    text: status.text, // Source text for editing
  };

  return normalized;
}

/**
 * Normalize a media attachment
 * @param {Object} attachment
 * @returns {import('../types.js').PhanpyMediaAttachment}
 */
export function normalizeMediaAttachment(attachment) {
  if (!attachment) return null;

  return {
    id: attachment.id,
    type: attachment.type || 'unknown',
    url: attachment.url,
    previewUrl: attachment.preview_url || attachment.previewUrl,
    remoteUrl: attachment.remote_url || attachment.remoteUrl || null,
    description: attachment.description || '',
    blurhash: attachment.blurhash || null,
    meta: attachment.meta || {},
  };
}

/**
 * Normalize a poll
 * @param {Object} poll
 * @returns {import('../types.js').PhanpyPoll}
 */
export function normalizePoll(poll) {
  if (!poll) return null;

  return {
    id: poll.id,
    expiresAt: poll.expires_at || poll.expiresAt,
    expired: poll.expired || false,
    multiple: poll.multiple || false,
    votesCount: poll.votes_count ?? poll.votesCount ?? 0,
    votersCount: poll.voters_count ?? poll.votersCount ?? null,
    voted: poll.voted || false,
    ownVotes: poll.own_votes || poll.ownVotes || [],
    options: poll.options || [],
    emojis: poll.emojis || [],
  };
}

/**
 * Normalize a notification
 * @param {Object} notification
 * @param {string} [instance]
 * @returns {import('../types.js').PhanpyNotification}
 */
export function normalizeNotification(notification, instance) {
  if (!notification) return null;

  // Already normalized?
  if (notification._platform === PLATFORM_MASTODON) {
    return notification;
  }

  return {
    id: notification.id,
    type: notification.type,
    createdAt: notification.created_at || notification.createdAt,
    account: normalizeAccount(notification.account),
    status: notification.status
      ? normalizeStatus(notification.status, instance)
      : null,
    report: notification.report || null,

    // Platform metadata
    _platform: PLATFORM_MASTODON,
    _original: notification,
  };
}

/**
 * Normalize a relationship
 * @param {Object} relationship
 * @returns {import('../types.js').PhanpyRelationship}
 */
export function normalizeRelationship(relationship) {
  if (!relationship) return null;

  return {
    id: relationship.id,
    following: relationship.following || false,
    followedBy: relationship.followed_by || relationship.followedBy || false,
    blocking: relationship.blocking || false,
    blockedBy: relationship.blocked_by || relationship.blockedBy || false,
    muting: relationship.muting || false,
    mutingNotifications:
      relationship.muting_notifications ||
      relationship.mutingNotifications ||
      false,
    requested: relationship.requested || false,
    domainBlocking:
      relationship.domain_blocking || relationship.domainBlocking || false,
    endorsed: relationship.endorsed || false,
    note: relationship.note || '',
    showingReblogs:
      relationship.showing_reblogs ?? relationship.showingReblogs ?? true,
    notifying: relationship.notifying || false,
  };
}

/**
 * Strip HTML tags from content
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  if (!html) return '';
  // Simple HTML strip - replace tags with spaces, decode entities
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}
