/**
 * Bluesky Platform Adapter
 */

import { BskyAgent, RichText } from '@atproto/api';

import { updateBlueskySession } from '../../store-utils.js';
import { PLATFORM_BLUESKY } from '../types.js';
import { createBlueskyAgent } from './auth.js';
import {
  normalizeAccount,
  normalizeNotification,
  normalizeRelationship,
  normalizeStatus,
} from './normalizers.js';

/**
 * @implements {import('../types.js').PlatformAdapter}
 */
export class BlueskyAdapter {
  platform = PLATFORM_BLUESKY;

  capabilities = {
    polls: false,
    edit: false,
    contentWarning: false, // Uses labels instead
    customEmoji: false,
    lists: true,
    quotePosts: true,
    customFeeds: true,
    streaming: false, // No WebSocket streaming
    bookmarks: false,
    scheduledPosts: false,
    maxCharacters: 300,
    maxMediaAttachments: 4,
  };

  #agentPromise = null;

  /**
   * @param {Object} account - Account object from store
   */
  constructor(account) {
    this.account = account;
    this.did = account.did;
    this.pds = account.pds || 'https://bsky.social';
  }

  /**
   * Get or create the agent (lazy initialization)
   * @returns {Promise<BskyAgent>}
   */
  async getAgent() {
    if (!this.#agentPromise) {
      this.#agentPromise = createBlueskyAgent(this.account).then((agent) => {
        // Set up session refresh handler
        agent.sessionManager?.on?.('session:update', (session) => {
          console.log('Bluesky session refreshed');
          updateBlueskySession(this.did, {
            accessJwt: session.accessJwt,
            refreshJwt: session.refreshJwt,
          });
        });
        return agent;
      });
    }
    return this.#agentPromise;
  }

  /**
   * Create adapter from credentials directly
   * @param {Object} credentials
   * @returns {BlueskyAdapter}
   */
  static fromCredentials({ did, accessToken, refreshJwt, pds }) {
    return new BlueskyAdapter({
      did,
      accessToken,
      refreshJwt,
      pds,
    });
  }

  // ========================================
  // Timeline Methods
  // ========================================

  /**
   * Get home timeline
   * @param {Object} options
   */
  async getHomeTimeline({ limit = 50, cursor } = {}) {
    const response = await (await this.getAgent()).getTimeline({
      limit,
      cursor,
    });

    const statuses = response.data.feed.map((item) => normalizeStatus(item));

    return {
      statuses,
      nextCursor: response.data.cursor || null,
    };
  }

  /**
   * Get "What's Hot" / discover timeline
   * @param {Object} options
   */
  async getPublicTimeline({ limit = 50, cursor } = {}) {
    // Use the "What's Hot" feed as public timeline equivalent
    const response = await (await this.getAgent()).app.bsky.feed.getFeed({
      feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
      limit,
      cursor,
    });

    const statuses = response.data.feed.map((item) => normalizeStatus(item));

    return {
      statuses,
      nextCursor: response.data.cursor || null,
    };
  }

  /**
   * Get custom feed
   * @param {string} feedUri - AT URI of the feed generator
   * @param {Object} options
   */
  async getCustomFeed(feedUri, { limit = 50, cursor } = {}) {
    const response = await (await this.getAgent()).app.bsky.feed.getFeed({
      feed: feedUri,
      limit,
      cursor,
    });

    const statuses = response.data.feed.map((item) => normalizeStatus(item));

    return {
      statuses,
      nextCursor: response.data.cursor || null,
    };
  }

  /**
   * Get account timeline
   * @param {string} actorId - Handle or DID
   * @param {Object} options
   */
  async getAccountTimeline(
    actorId,
    { limit = 50, cursor, includeReplies = false } = {},
  ) {
    const response = await (await this.getAgent()).getAuthorFeed({
      actor: actorId,
      limit,
      cursor,
      filter: includeReplies ? undefined : 'posts_no_replies',
    });

    const statuses = response.data.feed.map((item) => normalizeStatus(item));

    return {
      statuses,
      nextCursor: response.data.cursor || null,
    };
  }

  /**
   * Get a single post
   * @param {string} uri - AT URI
   */
  async getStatus(uri) {
    // Parse AT URI to get author and rkey
    const parts = uri.split('/');
    const author = parts[2];
    const rkey = parts[4];

    const response = await (await this.getAgent()).getPostThread({
      uri,
      depth: 0,
      parentHeight: 0,
    });

    if (response.data.thread.$type === 'app.bsky.feed.defs#blockedPost') {
      throw new Error('Post is blocked');
    }
    if (response.data.thread.$type === 'app.bsky.feed.defs#notFoundPost') {
      throw new Error('Post not found');
    }

    return normalizeStatus(response.data.thread.post);
  }

  /**
   * Get post context (thread)
   * @param {string} uri - AT URI
   */
  async getStatusContext(uri) {
    const response = await (await this.getAgent()).getPostThread({
      uri,
      depth: 100,
      parentHeight: 100,
    });

    const thread = response.data.thread;

    // Collect ancestors (parents)
    const ancestors = [];
    let parent = thread.parent;
    while (parent) {
      if (parent.$type === 'app.bsky.feed.defs#threadViewPost') {
        ancestors.unshift(normalizeStatus(parent.post));
        parent = parent.parent;
      } else {
        break;
      }
    }

    // Collect descendants (replies)
    const descendants = [];
    function collectReplies(node) {
      if (!node.replies) return;
      for (const reply of node.replies) {
        if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
          descendants.push(normalizeStatus(reply.post));
          collectReplies(reply);
        }
      }
    }
    collectReplies(thread);

    return { ancestors, descendants };
  }

  // ========================================
  // Account Methods
  // ========================================

  /**
   * Verify credentials (get current user profile)
   */
  async verifyCredentials() {
    const response = await (await this.getAgent()).getProfile({ actor: this.did });
    return normalizeAccount(response.data);
  }

  /**
   * Get an account profile
   * @param {string} actorId - Handle or DID
   */
  async getAccount(actorId) {
    const response = await (await this.getAgent()).getProfile({ actor: actorId });
    return normalizeAccount(response.data);
  }

  /**
   * Get relationship with an account
   * @param {string} actorId - Handle or DID
   */
  async getRelationship(actorId) {
    const response = await (await this.getAgent()).getProfile({ actor: actorId });
    return normalizeRelationship(response.data.viewer, response.data.did);
  }

  /**
   * Follow an account
   * @param {string} did - DID to follow
   */
  async follow(did) {
    await (await this.getAgent()).follow(did);
    // Re-fetch relationship
    return this.getRelationship(did);
  }

  /**
   * Unfollow an account
   * @param {string} did - DID to unfollow
   */
  async unfollow(did) {
    // Get the follow record URI first
    const response = await (await this.getAgent()).getProfile({ actor: did });
    const followUri = response.data.viewer?.following;

    if (followUri) {
      await (await this.getAgent()).deleteFollow(followUri);
    }

    return this.getRelationship(did);
  }

  // ========================================
  // Interaction Methods
  // ========================================

  /**
   * Like a post
   * @param {string} uri - AT URI
   * @param {string} cid - Content ID
   */
  async favourite(uri, cid) {
    await (await this.getAgent()).like(uri, cid);
    // Return updated status
    return this.getStatus(uri);
  }

  /**
   * Unlike a post
   * @param {string} uri - AT URI
   */
  async unfavourite(uri) {
    // Get the like record URI
    const status = await this.getStatus(uri);
    const likeUri = status._viewer?.like;

    if (likeUri) {
      await (await this.getAgent()).deleteLike(likeUri);
    }

    return this.getStatus(uri);
  }

  /**
   * Repost
   * @param {string} uri - AT URI
   * @param {string} cid - Content ID
   */
  async reblog(uri, cid) {
    await (await this.getAgent()).repost(uri, cid);
    return this.getStatus(uri);
  }

  /**
   * Unrepost
   * @param {string} uri - AT URI
   */
  async unreblog(uri) {
    const status = await this.getStatus(uri);
    const repostUri = status._viewer?.repost;

    if (repostUri) {
      await (await this.getAgent()).deleteRepost(repostUri);
    }

    return this.getStatus(uri);
  }

  /**
   * Bookmark - not supported
   */
  async bookmark(uri) {
    throw new Error('Bookmarks are not supported on Bluesky');
  }

  /**
   * Unbookmark - not supported
   */
  async unbookmark(uri) {
    throw new Error('Bookmarks are not supported on Bluesky');
  }

  /**
   * Mute thread
   * @param {string} uri - AT URI
   */
  async mute(uri) {
    await (await this.getAgent()).muteThread(uri);
    return this.getStatus(uri);
  }

  /**
   * Unmute thread
   * @param {string} uri - AT URI
   */
  async unmute(uri) {
    await (await this.getAgent()).unmuteThread(uri);
    return this.getStatus(uri);
  }

  // ========================================
  // Compose Methods
  // ========================================

  /**
   * Create a new post
   * @param {Object} params
   */
  async createPost({
    text,
    replyToUri,
    replyToCid,
    replyToRootUri,
    replyToRootCid,
    quoteUri,
    quoteCid,
    images,
    video,
    langs,
  }) {
    // Build rich text with facets
    const rt = new RichText({ text });
    await rt.detectFacets(this.agent);

    const postRecord = {
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };

    // Add language
    if (langs && langs.length > 0) {
      postRecord.langs = langs;
    }

    // Add reply info
    if (replyToUri && replyToCid) {
      postRecord.reply = {
        root: {
          uri: replyToRootUri || replyToUri,
          cid: replyToRootCid || replyToCid,
        },
        parent: {
          uri: replyToUri,
          cid: replyToCid,
        },
      };
    }

    // Add quote embed
    if (quoteUri && quoteCid) {
      postRecord.embed = {
        $type: 'app.bsky.embed.record',
        record: {
          uri: quoteUri,
          cid: quoteCid,
        },
      };
    }

    // Add images
    if (images && images.length > 0) {
      const imageEmbeds = await Promise.all(
        images.map(async (img) => ({
          alt: img.alt || '',
          image: img.blob, // Already uploaded blob
          aspectRatio: img.aspectRatio,
        })),
      );

      if (postRecord.embed) {
        // Quote with images
        postRecord.embed = {
          $type: 'app.bsky.embed.recordWithMedia',
          record: postRecord.embed,
          media: {
            $type: 'app.bsky.embed.images',
            images: imageEmbeds,
          },
        };
      } else {
        postRecord.embed = {
          $type: 'app.bsky.embed.images',
          images: imageEmbeds,
        };
      }
    }

    // Add video
    if (video) {
      const videoEmbed = {
        $type: 'app.bsky.embed.video',
        video: video.blob,
        alt: video.alt || '',
      };

      if (postRecord.embed) {
        postRecord.embed = {
          $type: 'app.bsky.embed.recordWithMedia',
          record: postRecord.embed,
          media: videoEmbed,
        };
      } else {
        postRecord.embed = videoEmbed;
      }
    }

    const response = await (await this.getAgent()).post(postRecord);

    // Fetch and return the created post
    return this.getStatus(response.uri);
  }

  /**
   * Delete a post
   * @param {string} uri - AT URI
   */
  async deleteStatus(uri) {
    await (await this.getAgent()).deletePost(uri);
  }

  /**
   * Upload media (image)
   * @param {File|Blob} file
   * @param {Object} options
   */
  async uploadMedia(file, { description } = {}) {
    // Get image dimensions
    let width, height;
    if (file.type.startsWith('image/')) {
      const dimensions = await getImageDimensions(file);
      width = dimensions.width;
      height = dimensions.height;
    }

    const response = await (await this.getAgent()).uploadBlob(file, {
      encoding: file.type,
    });

    return {
      id: response.data.blob.ref.toString(),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      url: null, // Not available until posted
      previewUrl: null,
      remoteUrl: null,
      description: description || '',
      blurhash: null,
      meta: {
        original: { width, height },
      },
      // Bluesky-specific
      _blob: response.data.blob,
      _aspectRatio: width && height ? { width, height } : undefined,
    };
  }

  // ========================================
  // Notification Methods
  // ========================================

  /**
   * Get notifications
   * @param {Object} options
   */
  async getNotifications({ limit = 50, cursor } = {}) {
    const response = await (await this.getAgent()).listNotifications({
      limit,
      cursor,
    });

    // Fetch related posts for notifications that reference them
    const notifications = await Promise.all(
      response.data.notifications.map(async (notif) => {
        const normalized = normalizeNotification(notif);

        // Fetch the related post if it exists
        if (notif.reasonSubject && normalized.type !== 'follow') {
          try {
            normalized.status = await this.getStatus(notif.reasonSubject);
          } catch (e) {
            // Post may be deleted
          }
        }

        return normalized;
      }),
    );

    return {
      notifications,
      nextCursor: response.data.cursor || null,
    };
  }

  /**
   * Mark notifications as seen
   */
  async clearNotifications() {
    await (await this.getAgent()).updateSeenNotifications();
  }

  // ========================================
  // Search Methods
  // ========================================

  /**
   * Search
   * @param {string} query
   * @param {Object} options
   */
  async search(query, { type, limit = 25, cursor } = {}) {
    const results = {
      accounts: [],
      statuses: [],
      hashtags: [],
    };

    if (!type || type === 'accounts') {
      try {
        const actorsResponse = await (await this.getAgent()).searchActors({
          q: query,
          limit,
          cursor,
        });
        results.accounts = actorsResponse.data.actors.map(normalizeAccount);
      } catch (e) {
        console.error('Actor search failed:', e);
      }
    }

    if (!type || type === 'statuses') {
      try {
        const postsResponse = await (await this.getAgent()).app.bsky.feed.searchPosts({
          q: query,
          limit,
          cursor,
        });
        results.statuses = postsResponse.data.posts.map((post) =>
          normalizeStatus({ post }),
        );
      } catch (e) {
        console.error('Post search failed:', e);
      }
    }

    return results;
  }

  // ========================================
  // Feed Methods (Bluesky-specific)
  // ========================================

  /**
   * Get user's saved feeds
   */
  async getSavedFeeds() {
    const response = await (await this.getAgent()).app.bsky.actor.getPreferences();
    const savedFeeds = response.data.preferences.find(
      (p) => p.$type === 'app.bsky.actor.defs#savedFeedsPrefV2',
    );
    return savedFeeds?.items || [];
  }

  /**
   * Get feed generator info
   * @param {string} feedUri
   */
  async getFeedGenerator(feedUri) {
    const response = await (await this.getAgent()).app.bsky.feed.getFeedGenerator({
      feed: feedUri,
    });
    return response.data;
  }
}

/**
 * Get image dimensions from a file
 * @param {File|Blob} file
 * @returns {Promise<{width: number, height: number}>}
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}
