let logs: Array<string> = [];

export function takeFetchLogs() {
  const takenLogs = logs;
  logs = [];
  return takenLogs;
}

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
  let log = '';
  log += `> ${init?.method ?? 'GET'} ${pathname}\n`;
  log += `> ${init?.body ?? ''}\n`;
  log += `< HTTP ${response.status}\n`;
  log += `< ${await clonedResponse.text()}\n`;
  logs.push(log);

  return response;
}
