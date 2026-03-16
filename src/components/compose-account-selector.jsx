import './compose-account-selector.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo } from 'preact/hooks';

import blueskyLogo from '../assets/bluesky-logo.svg';
import mastodonLogo from '../assets/mastodon-logo.svg';
import { PLATFORM_BLUESKY, PLATFORM_MASTODON } from '../utils/platforms/types.js';
import { getAccounts, getAccountPlatform } from '../utils/store-utils';

const PLATFORM_LOGOS = {
  [PLATFORM_BLUESKY]: blueskyLogo,
  [PLATFORM_MASTODON]: mastodonLogo,
};

const PLATFORM_NAMES = {
  [PLATFORM_BLUESKY]: 'Bluesky',
  [PLATFORM_MASTODON]: 'Mastodon',
};

/**
 * Get a unique key for an account
 * @param {Object} account
 * @returns {string}
 */
export function getAccountKey(account) {
  if (account.did) {
    return account.did;
  }
  return `${account.info.id}@${account.instanceURL}`;
}

/**
 * ComposeAccountSelector - Select which account(s) to post from
 * @param {Object} props
 * @param {string[]} props.selectedKeys - Array of selected account keys
 * @param {function} props.onChange - Callback when selection changes
 * @param {boolean} props.multiSelect - Allow multiple account selection
 * @param {boolean} props.disabled - Disable selection
 * @param {string} props.replyToPlatform - Platform of the post being replied to (restricts selection)
 */
function ComposeAccountSelector({
  selectedKeys,
  onChange,
  multiSelect = false,
  disabled = false,
  replyToPlatform = null,
}) {
  const { t } = useLingui();

  const accounts = useMemo(() => {
    return getAccounts().map((account) => ({
      ...account,
      key: getAccountKey(account),
      platform: getAccountPlatform(account),
    }));
  }, []);

  // If only one account, show a simpler view
  const isSingleAccount = accounts.length === 1;

  // Calculate constraints for selected accounts
  const constraints = useMemo(() => {
    const selectedAccounts = accounts.filter((a) =>
      selectedKeys.includes(a.key),
    );
    const hasBluesky = selectedAccounts.some(
      (a) => a.platform === PLATFORM_BLUESKY,
    );
    const hasMastodon = selectedAccounts.some(
      (a) => a.platform === PLATFORM_MASTODON,
    );

    return {
      hasBluesky,
      hasMastodon,
      maxCharacters: hasBluesky ? 300 : 500,
      supportsPoll: !hasBluesky,
      supportsContentWarning: !hasBluesky,
      supportsScheduled: !hasBluesky,
      supportsCustomEmoji: !hasBluesky,
    };
  }, [selectedKeys, accounts]);

  const handleToggle = (accountKey) => {
    if (disabled) return;

    const account = accounts.find((a) => a.key === accountKey);
    if (!account) return;

    // Check if this account's platform is restricted due to reply context
    if (replyToPlatform && account.platform !== replyToPlatform) {
      return;
    }

    if (multiSelect) {
      if (selectedKeys.includes(accountKey)) {
        // Don't allow deselecting if it's the last selected
        if (selectedKeys.length > 1) {
          onChange(selectedKeys.filter((k) => k !== accountKey));
        }
      } else {
        onChange([...selectedKeys, accountKey]);
      }
    } else {
      onChange([accountKey]);
    }
  };

  return (
    <div
      className={`compose-account-selector ${isSingleAccount ? 'single-account' : ''}`}
    >
      {accounts.map((account) => {
        const isSelected = selectedKeys.includes(account.key);
        const isDisabled =
          disabled ||
          (replyToPlatform && account.platform !== replyToPlatform);
        const platformLogo = PLATFORM_LOGOS[account.platform];
        const platformName = PLATFORM_NAMES[account.platform];

        return (
          <label
            key={account.key}
            className={`account-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
            title={
              isDisabled && replyToPlatform
                ? t`Replies must be on the same platform`
                : `${account.info.username} (${platformName})`
            }
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggle(account.key)}
              disabled={isDisabled}
            />
            <img
              src={account.info.avatarStatic || account.info.avatar}
              alt=""
              className="account-avatar"
            />
            <span className="account-info">
              <span className="account-name">
                {account.info.displayName || account.info.username}
              </span>
              <span className="account-handle">
                @{account.info.username}
                {account.platform === PLATFORM_MASTODON &&
                  `@${account.instanceURL.replace(/^https?:\/\//, '')}`}
              </span>
            </span>
            {platformLogo && (
              <img
                src={platformLogo}
                alt={platformName}
                className="platform-logo"
              />
            )}
          </label>
        );
      })}

      {/* Show constraints warning when Bluesky is selected */}
      {constraints.hasBluesky && constraints.hasMastodon && (
        <div className="constraints-warning">
          <div className="constraint-item">
            <Trans>Character limit: {constraints.maxCharacters}</Trans>
          </div>
          <div className="constraint-item">
            <Trans>Polls, content warnings, and scheduled posts disabled</Trans>
          </div>
        </div>
      )}
    </div>
  );
}

export default ComposeAccountSelector;
export { PLATFORM_LOGOS, PLATFORM_NAMES };
