export function extractTokenAndCallback(url: string) {
  const parsed = new URL(url);
  return {
    token: parsed.searchParams.get('token'),
    callbackURL: parsed.searchParams.get('callbackURL'),
  };
}
