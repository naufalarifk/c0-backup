import { createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/plugins/two-factor';
import { CookieJar, MemoryCookieStore } from 'tough-cookie';

export function setupBetterAuthClient(backendUrl: string) {
  const cookieJar = new CookieJar(new MemoryCookieStore(), {
    prefixSecurity: 'silent',
    rejectPublicSuffixes: false,
  });
  const authClient = createAuthClient({
    baseURL: backendUrl,
    fetchOptions: {
      async customFetchImpl(
        input: string | URL | globalThis.Request,
        init?: RequestInit,
      ): Promise<Response> {
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
        const response = await fetch(input, {
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
        clonedResponse.text().then(function (bodyText) {
          // console.debug('[BetterAuthClientFetch]:', init?.method, response.url, {
          //   status: response.status,
          //   // resHeaders: Array.from(response.headers.entries()).reduce(
          //   //   (acc, [key, value]) => {
          //   //     acc[key] = value;
          //   //     return acc;
          //   //   },
          //   //   {} as Record<string, string>,
          //   // ),
          //   reqBody: init?.body,
          //   resBody: bodyText,
          // });
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
