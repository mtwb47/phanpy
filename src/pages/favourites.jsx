import { Trans, useLingui } from '@lingui/react/macro';
import { useRef } from 'preact/hooks';

import ColumnTitle from '../components/column-title';
import Icon from '../components/icon';
import Timeline from '../components/timeline';
import { api, isBlueskyAccount } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Favourites({ columnAccount }) {
  const { t } = useLingui();
  useTitle(t`Likes`, '/favourites');

  // Detect if this is a Bluesky account
  const targetAccount = columnAccount || null;
  const isBluesky = targetAccount
    ? isBlueskyAccount(targetAccount)
    : isBlueskyAccount();

  // Bluesky doesn't have a "get my likes" API endpoint
  if (isBluesky) {
    const title = t`Likes`;
    return (
      <div class="deck-container">
        <div class="timeline-deck deck">
          <header>
            <div class="header-grid">
              <div class="header-side" />
              {columnAccount ? (
                <ColumnTitle title={title} account={columnAccount} />
              ) : (
                <h1>{title}</h1>
              )}
              <div class="header-side" />
            </div>
          </header>
          <div class="ui-state">
            <Icon icon="heart" size="xxl" />
            <p>
              <Trans>Viewing your liked posts is not supported on Bluesky.</Trans>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Use columnAccount if provided for column-specific API calls
  const { masto, instance } = api(columnAccount ? { account: columnAccount } : undefined);
  const favouritesIterator = useRef();
  async function fetchFavourites(firstLoad) {
    if (firstLoad || !favouritesIterator.current) {
      favouritesIterator.current = masto.v1.favourites
        .list({ limit: LIMIT })
        .values();
    }
    return await favouritesIterator.current.next();
  }

  const title = t`Likes`;

  return (
    <Timeline
      title={title}
      titleComponent={
        columnAccount ? (
          <ColumnTitle title={title} account={columnAccount} />
        ) : undefined
      }
      id="favourites"
      emptyText={t`No likes yet. Go like something!`}
      errorText={t`Unable to load likes.`}
      instance={instance}
      fetchItems={fetchFavourites}
    />
  );
}

export default Favourites;
