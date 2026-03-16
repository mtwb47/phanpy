import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'preact/hooks';

import Loader from './loader';

import { loginWithAppPassword } from '../utils/platforms/bluesky/auth';
import { saveAccount, setCurrentAccountID } from '../utils/store-utils';

function BlueskyLogin({ onSuccess, onError }) {
  const { t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!identifier || !password) {
      setErrorMessage(t`Please enter your handle and app password`);
      return;
    }

    setUIState('loading');
    setErrorMessage('');

    try {
      const account = await loginWithAppPassword({
        identifier,
        password,
      });

      // Save account
      saveAccount(account);
      setCurrentAccountID(account.info.id);

      setUIState('success');

      if (onSuccess) {
        onSuccess(account);
      } else {
        // Redirect to home
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Bluesky login error:', error);
      setErrorMessage(error.message || t`Failed to log in`);
      setUIState('error');

      if (onError) {
        onError(error);
      }
    }
  };

  const cleanIdentifier = identifier
    .replace(/^@/, '')
    .trim()
    .toLowerCase();

  const identifierLooksValid =
    cleanIdentifier.includes('.') || cleanIdentifier.startsWith('did:');

  return (
    <form onSubmit={handleSubmit} class="bluesky-login-form">
      <label>
        <p>
          <Trans>Handle</Trans>
        </p>
        <input
          type="text"
          class="large"
          value={identifier}
          onInput={(e) => setIdentifier(e.target.value)}
          placeholder={t`user.bsky.social`}
          disabled={uiState === 'loading'}
          autocorrect="off"
          autocapitalize="off"
          autocomplete="username"
          spellCheck={false}
          enterKeyHint="next"
          dir="auto"
        />
      </label>

      <label>
        <p>
          <Trans>App Password</Trans>
        </p>
        <input
          type="password"
          class="large"
          value={password}
          onInput={(e) => setPassword(e.target.value)}
          placeholder={t`xxxx-xxxx-xxxx-xxxx`}
          disabled={uiState === 'loading'}
          autocomplete="current-password"
          enterKeyHint="go"
        />
        <small class="help-text">
          <Trans>
            Create an App Password in your{' '}
            <a
              href="https://bsky.app/settings/app-passwords"
              target="_blank"
              rel="noopener noreferrer"
            >
              Bluesky settings
            </a>
          </Trans>
        </small>
      </label>

      {errorMessage && <p class="error">{errorMessage}</p>}

      <div>
        <button
          type="submit"
          disabled={
            uiState === 'loading' || !identifier || !password || !identifierLooksValid
          }
        >
          {uiState === 'loading' ? (
            <Trans>Logging in...</Trans>
          ) : (
            <Trans>Log in to Bluesky</Trans>
          )}
        </button>
      </div>

      <Loader hidden={uiState !== 'loading'} />
    </form>
  );
}

export default BlueskyLogin;
