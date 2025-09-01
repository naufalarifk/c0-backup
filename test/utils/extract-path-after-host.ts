export function extractPathAfterHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch (error) {
    console.error('Failed to parse URL:', error);
    return null;
  }
}
