import { env, stdout } from 'node:process';

import { createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/plugins/two-factor';
import { loggedFetch } from 'test/setup/fetch.js';
import { CookieJar, MemoryCookieStore } from 'tough-cookie';

type BetterAuthClient = ReturnType<
  typeof createAuthClient<{
    plugins: [ReturnType<typeof twoFactorClient>];
  }>
>;

export function setupBetterAuthClient(backendUrl: string): {
  authClient: BetterAuthClient;
  cookieJar: CookieJar;
} {
  const cookieJar = new CookieJar(new MemoryCookieStore(), {
    prefixSecurity: 'silent',
    rejectPublicSuffixes: false,
  });
  const authClient = createAuthClient({
    baseURL: backendUrl,
    fetchOptions: {
      async customFetchImpl(input: string | URL | globalThis.Request, init?: RequestInit) {
        const headers = new Headers(init?.headers);
        const cookie = await new Promise<string | undefined>((resolve, reject) => {
          cookieJar.getCookieString(input?.toString(), function (error, cookies) {
            if (error) return reject(error);
            resolve(cookies || undefined);
          });
        });
        if (cookie) {
          headers.set('Cookie', cookie);
        }
        const response = await loggedFetch(input, {
          ...init,
          headers,
          credentials: 'include',
        });
        const clonedResponse = response.clone();
        clonedResponse.headers.getSetCookie()?.forEach(cookie => {
          cookieJar.setCookieSync(cookie, response.url, {
            ignoreError: true,
          });
        });
        return response;
      },
    },
    plugins: [twoFactorClient()],
  });
  return {
    authClient,
    cookieJar,
  };
}
