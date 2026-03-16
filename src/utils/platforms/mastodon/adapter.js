/**
 * Mastodon Platform Adapter
 *
 * Wraps the existing masto.js client to conform to the unified PlatformAdapter interface.
 * This is mostly a thin wrapper since Phanpy was originally built for Mastodon.
 */

import { createRestAPIClient, createStreamingAPIClient } from 'masto';

import { PLATFORM_MASTODON } from '../types.js';
import {
  normalizeAccount,
  normalizeMediaAttachment,
  normalizeNotification,
  normalizeRelationship,
  normalizeStatus,
} from './normalizers.js';

/**
 * @implements {import('../types.js').PlatformAdapter}
 */
export class MastodonAdapter {
  platform = PLATFORM_MASTODON;

  capabilities = {
    polls: true,
    edit: true,
    contentWarning: true,
    customEmoji: true,
    lists: true,
    quotePosts: false, // Extension only, not native
    customFeeds: false,
    streaming: true,
    bookmarks: true,
    scheduledPosts: true,
    maxCharacters: 500,
    maxMediaAttachments: 4,
  };

  /**
   * @param {Object} account - Account object from store
   */
  constructor(account) {
    this.account = account;
    this.instance = account.instanceURL;
    this.accessToken = account.accessToken;

    this.masto = createRestAPIClient({
      url: `https://${this.instance}`,
      accessToken: this.accessToken,
      timeout: 2 * 60_000,
      mediaTimeout: 10 * 60_000,
    });

    this.streaming = null;
  }

  /**
   * Create adapter from credentials directly
   * @param {Object} credentials
   * @returns {MastodonAdapter}
   */
  static fromCredentials({ instance, accessToken }) {
    return new MastodonAdapter({
      instanceURL: instance,
      accessToken,
    });
  }

  /**
   * Initialize streaming client
   * @param {string} streamingUrl
   */
  initStreaming(streamingUrl) {
    if (this.streaming) return;

    this.streaming = createStreamingAPIClient({
      streamingApiUrl: streamingUrl,
      accessToken: this.accessToken,
      implementation: WebSocket,
    });
  }

  // ========================================
  // Timeline Methods
  // ========================================

  /**
   * Get home timeline
   * @param {Object} options
   * @returns {Promise<{statuses: import('../types.js').PhanpyStatus[], nextCursor: string|null}>}
   */
  async getHomeTimeline({ limit = 20, maxId, minId, sinceId } = {}) {
    const params = { limit };
    if (maxId) params.max_id = maxId;
    if (minId) params.min_id = minId;
    if (sinceId) params.since_id = sinceId;

    const statuses = await this.masto.v1.timelines.home.list(params);

    return {
      statuses: statuses.map((s) => normalizeStatus(s, this.instance)),
      nextCursor: statuses.length > 0 ? statuses[statuses.length - 1].id : null,
    };
  }

  /**
   * Get public timeline
   * @param {Object} options
   */
  async getPublicTimeline({ limit = 20, maxId, local = false } = {}) {
    const params = { limit, local };
    if (maxId) params.max_id = maxId;

    const statuses = await this.masto.v1.timelines.public.list(params);

    return {
      statuses: statuses.map((s) => normalizeStatus(s, this.instance)),
      nextCursor: statuses.length > 0 ? statuses[statuses.length - 1].id : null,
    };
  }

  /**
   * Get account timeline
   * @param {string} accountId
   * @param {Object} options
   */
  async getAccountTimeline(
    accountId,
    { limit = 20, maxId, excludeReplies = false, excludeReblogs = false } = {},
  ) {
    const params = {
      limit,
      exclude_replies: excludeReplies,
      exclude_reblogs: excludeReblogs,
    };
    if (maxId) params.max_id = maxId;

    const statuses = await this.masto.v1.accounts
      .$select(accountId)
      .statuses.list(params);

    return {
      statuses: statuses.map((s) => normalizeStatus(s, this.instance)),
      nextCursor: statuses.length > 0 ? statuses[statuses.length - 1].id : null,
    };
  }

  /**
   * Get a single status
   * @param {string} statusId
   */
  async getStatus(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).fetch();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Get status context (ancestors and descendants)
   * @param {string} statusId
   */
  async getStatusContext(statusId) {
    const context = await this.masto.v1.statuses.$select(statusId).context.fetch();

    return {
      ancestors: context.ancestors.map((s) =>
        normalizeStatus(s, this.instance),
      ),
      descendants: context.descendants.map((s) =>
        normalizeStatus(s, this.instance),
      ),
    };
  }

  // ========================================
  // Account Methods
  // ========================================

  /**
   * Verify credentials
   */
  async verifyCredentials() {
    const account = await this.masto.v1.accounts.verifyCredentials();
    return normalizeAccount(account);
  }

  /**
   * Get an account
   * @param {string} accountId
   */
  async getAccount(accountId) {
    const account = await this.masto.v1.accounts.$select(accountId).fetch();
    return normalizeAccount(account);
  }

  /**
   * Get relationship with an account
   * @param {string} accountId
   */
  async getRelationship(accountId) {
    const relationships = await this.masto.v1.accounts.relationships.fetch({
      id: [accountId],
    });
    return normalizeRelationship(relationships[0]);
  }

  /**
   * Follow an account
   * @param {string} accountId
   */
  async follow(accountId) {
    const relationship = await this.masto.v1.accounts
      .$select(accountId)
      .follow();
    return normalizeRelationship(relationship);
  }

  /**
   * Unfollow an account
   * @param {string} accountId
   */
  async unfollow(accountId) {
    const relationship = await this.masto.v1.accounts
      .$select(accountId)
      .unfollow();
    return normalizeRelationship(relationship);
  }

  // ========================================
  // Interaction Methods
  // ========================================

  /**
   * Like a status
   * @param {string} statusId
   */
  async favourite(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).favourite();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Unlike a status
   * @param {string} statusId
   */
  async unfavourite(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).unfavourite();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Boost a status
   * @param {string} statusId
   */
  async reblog(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).reblog();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Unboost a status
   * @param {string} statusId
   */
  async unreblog(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).unreblog();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Bookmark a status
   * @param {string} statusId
   */
  async bookmark(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).bookmark();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Unbookmark a status
   * @param {string} statusId
   */
  async unbookmark(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).unbookmark();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Mute a conversation
   * @param {string} statusId
   */
  async mute(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).mute();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Unmute a conversation
   * @param {string} statusId
   */
  async unmute(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).unmute();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Pin a status
   * @param {string} statusId
   */
  async pin(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).pin();
    return normalizeStatus(status, this.instance);
  }

  /**
   * Unpin a status
   * @param {string} statusId
   */
  async unpin(statusId) {
    const status = await this.masto.v1.statuses.$select(statusId).unpin();
    return normalizeStatus(status, this.instance);
  }

  // ========================================
  // Compose Methods
  // ========================================

  /**
   * Create a new status
   * @param {Object} params
   */
  async createStatus({
    text,
    replyToId,
    visibility = 'public',
    sensitive = false,
    spoilerText,
    language,
    mediaIds,
    poll,
    scheduledAt,
    quoteId,
    idempotencyKey,
  }) {
    const params = {
      status: text,
      visibility,
      sensitive,
    };

    if (replyToId) params.in_reply_to_id = replyToId;
    if (spoilerText) params.spoiler_text = spoilerText;
    if (language) params.language = language;
    if (mediaIds?.length) params.media_ids = mediaIds;
    if (scheduledAt) params.scheduled_at = scheduledAt;
    if (quoteId) params.quote_id = quoteId;

    if (poll) {
      params.poll = {
        options: poll.options,
        expires_in: poll.expiresIn,
        multiple: poll.multiple || false,
        hide_totals: poll.hideTotals || false,
      };
    }

    const options = {};
    if (idempotencyKey) {
      options.requestInit = {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      };
    }

    const status = await this.masto.v1.statuses.create(params, options);
    return normalizeStatus(status, this.instance);
  }

  /**
   * Edit a status
   * @param {string} statusId
   * @param {Object} params
   */
  async editStatus(statusId, params) {
    const updateParams = {
      status: params.text,
    };

    if (params.spoilerText !== undefined)
      updateParams.spoiler_text = params.spoilerText;
    if (params.sensitive !== undefined)
      updateParams.sensitive = params.sensitive;
    if (params.language) updateParams.language = params.language;
    if (params.mediaIds?.length) updateParams.media_ids = params.mediaIds;

    const status = await this.masto.v1.statuses
      .$select(statusId)
      .update(updateParams);
    return normalizeStatus(status, this.instance);
  }

  /**
   * Delete a status
   * @param {string} statusId
   */
  async deleteStatus(statusId) {
    await this.masto.v1.statuses.$select(statusId).remove();
  }

  /**
   * Upload media
   * @param {File} file
   * @param {Object} options
   */
  async uploadMedia(file, { description, focus } = {}) {
    const params = { file };
    if (description) params.description = description;
    if (focus) params.focus = focus;

    const attachment = await this.masto.v2.media.create(params);
    return normalizeMediaAttachment(attachment);
  }

  /**
   * Update media metadata
   * @param {string} mediaId
   * @param {Object} params
   */
  async updateMedia(mediaId, { description, focus } = {}) {
    const params = {};
    if (description !== undefined) params.description = description;
    if (focus) params.focus = focus;

    const attachment = await this.masto.v1.media.$select(mediaId).update(params);
    return normalizeMediaAttachment(attachment);
  }

  // ========================================
  // Notification Methods
  // ========================================

  /**
   * Get notifications
   * @param {Object} options
   */
  async getNotifications({
    limit = 40,
    maxId,
    minId,
    sinceId,
    types,
    excludeTypes,
  } = {}) {
    const params = { limit };
    if (maxId) params.max_id = maxId;
    if (minId) params.min_id = minId;
    if (sinceId) params.since_id = sinceId;
    if (types) params.types = types;
    if (excludeTypes) params.exclude_types = excludeTypes;

    const notifications = await this.masto.v1.notifications.list(params);

    return {
      notifications: notifications.map((n) =>
        normalizeNotification(n, this.instance),
      ),
      nextCursor:
        notifications.length > 0
          ? notifications[notifications.length - 1].id
          : null,
    };
  }

  /**
   * Clear all notifications
   */
  async clearNotifications() {
    await this.masto.v1.notifications.clear();
  }

  /**
   * Dismiss a single notification
   * @param {string} notificationId
   */
  async dismissNotification(notificationId) {
    await this.masto.v1.notifications.$select(notificationId).dismiss();
  }

  // ========================================
  // Search Methods
  // ========================================

  /**
   * Search for accounts, statuses, and hashtags
   * @param {string} query
   * @param {Object} options
   */
  async search(
    query,
    { type, limit = 20, resolve = true, following = false } = {},
  ) {
    const params = {
      q: query,
      limit,
      resolve,
      following,
    };
    if (type) params.type = type;

    const results = await this.masto.v2.search.fetch(params);

    return {
      accounts: results.accounts.map(normalizeAccount),
      statuses: results.statuses.map((s) =>
        normalizeStatus(s, this.instance),
      ),
      hashtags: results.hashtags || [],
    };
  }

  // ========================================
  // List Methods
  // ========================================

  /**
   * Get all lists
   */
  async getLists() {
    return await this.masto.v1.lists.list();
  }

  /**
   * Get list timeline
   * @param {string} listId
   * @param {Object} options
   */
  async getListTimeline(listId, { limit = 20, maxId } = {}) {
    const params = { limit };
    if (maxId) params.max_id = maxId;

    const statuses = await this.masto.v1.timelines.list
      .$select(listId)
      .list(params);

    return {
      statuses: statuses.map((s) => normalizeStatus(s, this.instance)),
      nextCursor: statuses.length > 0 ? statuses[statuses.length - 1].id : null,
    };
  }

  // ========================================
  // Hashtag Methods
  // ========================================

  /**
   * Get hashtag timeline
   * @param {string} hashtag
   * @param {Object} options
   */
  async getHashtagTimeline(hashtag, { limit = 20, maxId, local = false } = {}) {
    const params = { limit, local };
    if (maxId) params.max_id = maxId;

    const statuses = await this.masto.v1.timelines.tag
      .$select(hashtag)
      .list(params);

    return {
      statuses: statuses.map((s) => normalizeStatus(s, this.instance)),
      nextCursor: statuses.length > 0 ? statuses[statuses.length - 1].id : null,
    };
  }
}
