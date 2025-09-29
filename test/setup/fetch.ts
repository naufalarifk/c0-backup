export async function loggedFetch(input: string | URL | Request, init?: RequestInit | undefined) {
  const response = await fetch(input, init);

  const url =
    input instanceof Request
      ? new URL(input.url)
      : input instanceof URL
        ? input
        : input.startsWith('http')
          ? new URL(input)
          : new URL(input, 'http://localhost');
  const pathname = `${url.pathname}${url.search}`;

  const clonedResponse = response.clone();
  console.debug('>', init?.method ?? 'GET', pathname);
  console.debug('>', init?.body ?? '');
  console.debug('<', 'HTTP', response.status);
  console.debug('<', await clonedResponse.text());

  return response;
}
