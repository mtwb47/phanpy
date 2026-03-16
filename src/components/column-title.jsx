import './column-title.css';

import blueskyLogo from '../assets/bluesky-logo.svg';
import mastodonLogo from '../assets/mastodon-logo.svg';
import { PLATFORM_BLUESKY, PLATFORM_MASTODON } from '../utils/platforms/types.js';
import { getAccountPlatform } from '../utils/store-utils';

const PLATFORM_LOGOS = {
  [PLATFORM_BLUESKY]: blueskyLogo,
  [PLATFORM_MASTODON]: mastodonLogo,
};

const PLATFORM_NAMES = {
  [PLATFORM_BLUESKY]: 'Bluesky',
  [PLATFORM_MASTODON]: 'Mastodon',
};

/**
 * Column title with optional platform icon
 * @param {Object} props
 * @param {string} props.title - The column title
 * @param {Object} props.account - Optional account to show platform icon for
 */
function ColumnTitle({ title, account }) {
  if (!account) {
    return <h1>{title}</h1>;
  }

  const platform = getAccountPlatform(account);
  const logo = PLATFORM_LOGOS[platform];
  const platformName = PLATFORM_NAMES[platform];

  return (
    <h1>
      {logo && (
        <img
          src={logo}
          alt={platformName}
          class="platform-logo"
        />
      )}{' '}
      {title}
    </h1>
  );
}

export default ColumnTitle;
