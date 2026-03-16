import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import ColumnTitle from '../components/column-title';
import Timeline from '../components/timeline';
import { api, getAdapter, getBlueskyAccount, isBlueskyAccount } from '../utils/api';
import { filteredItems } from '../utils/filters';
import states, { getStatus, saveStatus } from '../utils/states';
import supports from '../utils/supports';
import {
  assignFollowedTags,
  clearFollowedTagsState,
  dedupeBoosts,
} from '../utils/timeline-utils';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Following({ title, path, id, columnAccount, ...props }) {
  const { t } = useLingui();
  useTitle(
    title ||
      t({
        id: 'following.title',
        message: 'Following',
      }),
    path || '/following',
  );

  // Use columnAccount if provided, otherwise check current account
  const targetAccount = columnAccount || null;
  const isBluesky = targetAccount
    ? isBlueskyAccount(targetAccount)
    : isBlueskyAccount();
  console.log('Following page - isBluesky:', isBluesky, 'columnAccount:', !!columnAccount);

  // Only get Mastodon API client if not Bluesky
  // For column mode with specific account, use that account's API
  const { masto, streaming, instance, client } = isBluesky
    ? { masto: null, streaming: null, instance: targetAccount?.instanceURL || 'bsky.social', client: null }
    : api(targetAccount ? { account: targetAccount } : undefined);
  const [streamingClient, setStreamingClient] = useState(streaming);
  const adapterRef = useRef();
  const cursorRef = useRef();

  const snapStates = useSnapshot(states);
  const homeIterable = useRef();
  const homeIterator = useRef();
  const latestItem = useRef();

  // Initialize adapter for Bluesky (or specific column account)
  useEffect(() => {
    if (isBluesky) {
      getAdapter(targetAccount ? { account: targetAccount } : undefined).then((adapter) => {
        adapterRef.current = adapter;
      });
    }
  }, [isBluesky, targetAccount]);

  // Streaming only happens after instance is initialized (Mastodon only)
  useEffect(() => {
    if (!isBluesky && !streaming && client?.onStreamingReady) {
      client.onStreamingReady((streamingClient) => {
        setStreamingClient(streamingClient);
      });
    }
  }, [client, isBluesky]);
  __BENCHMARK.end('time-to-following');

  console.debug('RENDER Following', title, id);
  const supportsPixelfed = supports('@pixelfed/home-include-reblogs');

  async function fetchHome(firstLoad) {
    console.log('fetchHome called, isBluesky:', isBluesky, 'firstLoad:', firstLoad);
    // Bluesky timeline fetch
    if (isBluesky) {
      console.log('Entering Bluesky fetch path');
      __BENCHMARK.start('fetch-home-first');
      const adapter = adapterRef.current || (await getAdapter(targetAccount ? { account: targetAccount } : undefined));
      console.log('Got adapter:', adapter);
      adapterRef.current = adapter;

      const cursor = firstLoad ? undefined : cursorRef.current;
      console.log('Fetching Bluesky timeline with cursor:', cursor);
      const results = await adapter.getHomeTimeline({ limit: LIMIT, cursor });
      console.log('Bluesky timeline results:', results);

      cursorRef.current = results.nextCursor;
      let value = results.statuses;

      if (value?.length) {
        if (firstLoad) {
          latestItem.current = value[0].id;
        }
        value.forEach((item) => {
          saveStatus(item, instance);
        });
        value = dedupeBoosts(value, instance);
        value.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      }

      __BENCHMARK.end('fetch-home-first');
      return {
        done: !results.nextCursor,
        value,
      };
    }

    // Mastodon timeline fetch
    if (firstLoad || !homeIterator.current) {
      __BENCHMARK.start('fetch-home-first');
      homeIterable.current = masto.v1.timelines.home.list({ limit: LIMIT });
      homeIterator.current = homeIterable.current.values();
    }
    if (supportsPixelfed && homeIterable.current?.params) {
      if (typeof homeIterable.current.params === 'string') {
        homeIterable.current.params += '&include_reblogs=true';
      } else {
        homeIterable.current.params.include_reblogs = true;
      }
    }
    const results = await homeIterator.current.next();
    let { value } = results;
    if (value?.length) {
      let latestItemChanged = false;
      if (firstLoad) {
        if (value[0].id !== latestItem.current) {
          latestItemChanged = true;
        }
        latestItem.current = value[0].id;
        console.log('First load', latestItem.current);
      }

      // value = filteredItems(value, 'home');
      value.forEach((item) => {
        saveStatus(item, instance);
      });
      value = dedupeBoosts(value, instance);
      if (firstLoad && latestItemChanged) clearFollowedTagsState();
      setTimeout(() => {
        assignFollowedTags(value, instance);
      }, 100);

      // ENFORCE sort by datetime (Latest first)
      value.sort((a, b) => {
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
    }
    __BENCHMARK.end('fetch-home-first');
    return {
      ...results,
      value,
    };
  }

  async function checkForUpdates() {
    try {
      // Bluesky: simple poll for new posts
      if (isBluesky) {
        const adapter = adapterRef.current || (await getAdapter(targetAccount ? { account: targetAccount } : undefined));
        const results = await adapter.getHomeTimeline({ limit: 5 });
        const value = results.statuses;
        if (value?.length && value[0].id !== latestItem.current) {
          latestItem.current = value[0].id;
          return true;
        }
        return false;
      }

      // Mastodon
      const opts = {
        limit: 5,
        since_id: latestItem.current,
      };
      if (supports('@pixelfed/home-include-reblogs')) {
        opts.include_reblogs = true;
      }
      const results = await masto.v1.timelines.home.list(opts).values().next();
      let { value } = results;
      console.log('checkForUpdates', latestItem.current, value);
      const valueContainsLatestItem = value[0]?.id === latestItem.current; // since_id might not be supported
      if (value?.length && !valueContainsLatestItem) {
        latestItem.current = value[0].id;
        value = dedupeBoosts(value, instance);
        value = filteredItems(value, 'home');
        if (value.some((item) => !item.reblog)) {
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // Streaming updates (Mastodon only - Bluesky doesn't support WebSocket streaming)
  useEffect(() => {
    if (isBluesky) return; // No streaming for Bluesky

    let sub;
    (async () => {
      if (streamingClient) {
        sub = streamingClient.user.subscribe();
        console.log('🎏 Streaming user', sub);
        for await (const entry of sub) {
          if (!sub) break;
          if (entry.event === 'status.update') {
            const status = entry.payload;
            console.log(`🔄 Status ${status.id} updated`);
            saveStatus(status, instance);
          } else if (entry.event === 'delete') {
            const statusID = entry.payload;
            console.log(`❌ Status ${statusID} deleted`);
            // delete states.statuses[statusID];
            const s = getStatus(statusID, instance);
            if (s) s._deleted = true;
          }
        }
        console.log('💥 Streaming user loop STOPPED');
      }
    })();
    return () => {
      sub?.unsubscribe?.();
      sub = null;
    };
  }, [streamingClient, isBluesky]);

  const timelineTitle = title || t({ id: 'following.title', message: 'Following' });

  return (
    <Timeline
      title={timelineTitle}
      titleComponent={
        columnAccount ? (
          <ColumnTitle title={timelineTitle} account={columnAccount} />
        ) : undefined
      }
      id={id || 'following'}
      emptyText={t`Nothing to see here.`}
      errorText={t`Unable to load posts.`}
      instance={instance}
      fetchItems={fetchHome}
      checkForUpdates={checkForUpdates}
      useItemID
      boostsCarousel={snapStates.settings.boostsCarousel}
      {...props}
      // allowFilters
      filterContext="home"
      showFollowedTags
      showReplyParent
    />
  );
}

export default Following;
