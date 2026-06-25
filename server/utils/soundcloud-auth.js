import {
  acquireRefreshLock,
  readRefreshToken,
  readStaleAccessToken,
  readTokenCache,
  readValidAccessToken,
  releaseRefreshLock,
  waitForValidAccessToken,
  writeTokenCache,
} from './soundcloud-token-store.js';

const TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';

let refreshPromise = null;

function getCredentials() {
  return {
    clientId: process.env.SOUNDCLOUD_CLIENT_ID,
    clientSecret: process.env.SOUNDCLOUD_CLIENT_SECRET,
  };
}

async function requestToken(body, clientId, clientSecret) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json; charset=utf-8',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (response.status === 429) {
    const staleToken = await readStaleAccessToken();
    if (staleToken) {
      const cache = await readTokenCache();
      return {
        access_token: staleToken,
        expires_in: Math.max(60, Math.floor(((cache?.expiresAt ?? Date.now()) - Date.now()) / 1000)),
        refresh_token: cache?.refreshToken,
      };
    }
    throw new Error('SoundCloud authentication rate limit reached. Please try again in a few minutes.');
  }

  if (!response.ok) {
    throw new Error('SoundCloud authentication failed. Check your client ID and secret.');
  }

  return response.json();
}

async function persistOAuthResponse(data) {
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  const refreshToken = data.refresh_token ?? (await readRefreshToken());

  await writeTokenCache({
    token: data.access_token,
    refreshToken,
    expiresAt,
  });

  return data.access_token;
}

async function refreshOAuthToken() {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) {
    throw new Error('SoundCloud credentials missing.');
  }

  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      });
      const data = await requestToken(params.toString(), clientId, clientSecret);
      return persistOAuthResponse(data);
    } catch {
      // fall through to client credentials
    }
  }

  const data = await requestToken('grant_type=client_credentials', clientId, clientSecret);
  return persistOAuthResponse(data);
}

async function refreshWithDistributedLock() {
  const acquired = await acquireRefreshLock();

  if (!acquired) {
    const waited = await waitForValidAccessToken();
    if (waited) return waited;
  }

  try {
    const cached = await readValidAccessToken();
    if (cached) return cached;

    return await refreshOAuthToken();
  } finally {
    if (acquired) {
      await releaseRefreshLock();
    }
  }
}

export async function getSoundCloudAccessToken() {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) return null;

  const cached = await readValidAccessToken();
  if (cached) return cached;

  if (!refreshPromise) {
    refreshPromise = refreshWithDistributedLock().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function requestSoundCloudTokenDirect() {
  const cached = await readValidAccessToken();
  if (cached) {
    return {
      access_token: cached,
      expires_in: 3600,
      refresh_token: await readRefreshToken(),
    };
  }

  const token = await refreshOAuthToken();
  return {
    access_token: token,
    expires_in: 3600,
    refresh_token: await readRefreshToken(),
  };
}
