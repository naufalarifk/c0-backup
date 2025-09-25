export async function loggedFetch(input: string | URL | Request, init?: RequestInit | undefined) {
  const response = await fetch(input, init);

  const clonedResponse = response.clone();
  console.debug(init?.method ?? 'GET', clonedResponse.url);
  console.debug(init?.body ?? '');
  console.debug('HTTP ', response.status);
  console.debug(await clonedResponse.text());

  return response;
}
