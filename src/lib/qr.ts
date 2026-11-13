/** Parses lumo://qr-login?id=… (the payload svc-identity puts in the QR code). */
export function parseQrPayload(data: string): string | null {
  const m = /^lumo:\/\/qr-login\?(?:.*&)?id=([A-Za-z0-9_-]{8,128})(?:&|$)/.exec(data.trim());
  return m?.[1] ?? null;
}
