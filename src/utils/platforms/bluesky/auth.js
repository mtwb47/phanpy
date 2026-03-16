/**
 * Bluesky Authentication
 *
 * Uses app password authentication for simplicity.
 * OAuth support can be added later.
 */

import { BskyAgent } from '@atproto/api';

import { PLATFORM_BLUESKY } from '../types.js';

const DEFAULT_SERVICE = 'https://bsky.social';

/**
 * Resolve handle to DID and PDS
 * @param {string} handle - User handle (e.g., "user.bsky.social")
 * @returns {Promise<{did: string, pds: string}>}
 */
export async function resolveHandle(handle) {
  // Clean up handle
  handle = handle.replace(/^@/, '').trim();

  // If it looks like a DID, return it directly
  if (handle.startsWith('did:')) {
    return { did: handle, pds: DEFAULT_SERVICE };
  }

  // Try to resolve via bsky.social first
  const agent = new BskyAgent({ service: DEFAULT_SERVICE });

  try {
    const response = await agent.resolveHandle({ handle });
    return {
      did: response.data.did,
      pds: DEFAULT_SERVICE, // For now, assume bsky.social
    };
  } catch (error) {
    // Try DNS resolution as fallback
    try {
      const dnsResult = await fetch(
        `https://dns.google/resolve?name=_atproto.${handle}&type=TXT`,
      );
      const data = await dnsResult.json();
      if (data.Answer) {
        for (const answer of data.Answer) {
          const match = answer.data.match(/did=([^\s"]+)/);
          if (match) {
            return { did: match[1], pds: DEFAULT_SERVICE };
          }
        }
      }
    } catch (e) {
      // DNS resolution failed
    }

    throw new Error(`Could not resolve handle: ${handle}`);
  }
}

/**
 * Login with app password
 * @param {Object} params
 * @param {string} params.identifier - Handle or DID
 * @param {string} params.password - App password
 * @param {string} [params.service] - PDS URL
 * @returns {Promise<Object>} Account data for storage
 */
export async function loginWithAppPassword({
  identifier,
  password,
  service = DEFAULT_SERVICE,
}) {
  const agent = new BskyAgent({ service });

  try {
    const response = await agent.login({
      identifier: identifier.replace(/^@/, '').trim(),
      password,
    });

    const { did, handle, email, accessJwt, refreshJwt } = response.data;

    // Get profile info
    const profile = await agent.getProfile({ actor: did });

    return {
      info: {
        id: did,
        username: handle,
        acct: `@${handle}`,
        displayName: profile.data.displayName || handle,
        avatar: profile.data.avatar || '',
        avatar_static: profile.data.avatar || '',
        note: profile.data.description || '',
        followersCount: profile.data.followersCount || 0,
        followingCount: profile.data.followsCount || 0,
        statusesCount: profile.data.postsCount || 0,
      },
      instanceURL: new URL(service).hostname,
      accessToken: accessJwt,
      refreshJwt,
      did,
      pds: service,
      platform: PLATFORM_BLUESKY,
      createdAt: Date.now(),
    };
  } catch (error) {
    console.error('Bluesky login error:', error);

    // Provide helpful error messages
    if (error.status === 401) {
      throw new Error('Invalid identifier or password. Make sure you are using an App Password, not your main password.');
    }
    if (error.status === 400) {
      throw new Error('Invalid request. Please check your handle format.');
    }
    if (error.message?.includes('RateLimited')) {
      throw new Error('Too many login attempts. Please wait a moment and try again.');
    }

    throw new Error(error.message || 'Failed to login to Bluesky');
  }
}

/**
 * Refresh session tokens
 * @param {Object} params
 * @param {string} params.refreshJwt - Refresh token
 * @param {string} [params.service] - PDS URL
 * @returns {Promise<{accessJwt: string, refreshJwt: string}>}
 */
export async function refreshSession({ refreshJwt, service = DEFAULT_SERVICE }) {
  const agent = new BskyAgent({ service });

  try {
    // Resume session with refresh token
    await agent.resumeSession({
      refreshJwt,
      accessJwt: '', // Will be refreshed
      handle: '',
      did: '',
      active: true,
    });

    // Get new tokens from agent
    const session = agent.session;
    if (!session) {
      throw new Error('Failed to refresh session');
    }

    return {
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
    };
  } catch (error) {
    console.error('Session refresh error:', error);
    throw new Error('Session expired. Please log in again.');
  }
}

/**
 * Create a new BskyAgent with stored credentials
 * @param {Object} account - Account from store
 * @returns {BskyAgent}
 */
export function createBlueskyAgent(account) {
  const agent = new BskyAgent({
    service: account.pds || DEFAULT_SERVICE,
  });

  // Set up session
  if (account.accessToken && account.refreshJwt && account.did) {
    agent.session = {
      accessJwt: account.accessToken,
      refreshJwt: account.refreshJwt,
      handle: account.info?.username || '',
      did: account.did,
      active: true,
    };
  }

  return agent;
}

/**
 * Validate that credentials are still valid
 * @param {Object} account - Account from store
 * @returns {Promise<boolean>}
 */
export async function validateSession(account) {
  try {
    const agent = createBlueskyAgent(account);
    await agent.getProfile({ actor: account.did });
    return true;
  } catch (error) {
    if (error.status === 401) {
      return false;
    }
    // Network error or other issue, assume valid
    return true;
  }
}
