export function extractVerificationUrl(text: string): string | null {
  const match = text.match(
    /https?:\/\/[^\s]+\/api\/auth\/verify-email\?token=[\w-._~:/?#[\]@!$&'()*+,;=%]+/,
  );
  return match ? match[0] : null;
}
