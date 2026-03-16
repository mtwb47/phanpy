import { useLingui } from '@lingui/react/macro';
import { useRef } from 'preact/hooks';

import ColumnTitle from '../components/column-title';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Bookmarks({ columnAccount }) {
  const { t } = useLingui();
  useTitle(t`Bookmarks`, '/b');
  // Use columnAccount if provided for column-specific API calls
  const { masto, instance } = api(columnAccount ? { account: columnAccount } : undefined);
  const bookmarksIterator = useRef();
  async function fetchBookmarks(firstLoad) {
    if (firstLoad || !bookmarksIterator.current) {
      bookmarksIterator.current = masto.v1.bookmarks
        .list({ limit: LIMIT })
        .values();
    }
    return await bookmarksIterator.current.next();
  }

  const title = t`Bookmarks`;

  return (
    <Timeline
      title={title}
      titleComponent={
        columnAccount ? (
          <ColumnTitle title={title} account={columnAccount} />
        ) : undefined
      }
      id="bookmarks"
      emptyText={t`No bookmarks yet. Go bookmark something!`}
      errorText={t`Unable to load bookmarks.`}
      instance={instance}
      fetchItems={fetchBookmarks}
    />
  );
}

export default Bookmarks;
