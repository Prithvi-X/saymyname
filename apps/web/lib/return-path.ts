/**
 * Shared Safe Internal Return Path Helpers (Edge Middleware, Server Components & Client Forms)
 * Rejects protocol-relative URLs, backslashes, external origins, control characters,
 * and self-redirect loops across auth entry routes.
 */
const AUTH_ENTRY_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password'];

export function isSafeInternalReturnPath(raw: string | null | undefined): raw is string {
  if (!raw || typeof raw !== 'string') return false;
  if (raw !== raw.trim()) return false;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return false;
  if (/[\u0000-\u001F\u007F]/.test(raw)) return false;

  const pathOnly = raw.split('?')[0].split('#')[0].toLowerCase();
  if (
    AUTH_ENTRY_PREFIXES.some(
      (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  try {
    const parsed = new URL(raw, 'https://saymyname.invalid');
    return parsed.origin === 'https://saymyname.invalid';
  } catch {
    return false;
  }
}

export function resolveSafeReturnUrl(
  raw: string | null | undefined,
  fallback = '/discover',
): string {
  return isSafeInternalReturnPath(raw) ? raw : fallback;
}

export function appendSafeReturnUrl(
  basePath: string,
  rawReturnUrl: string | null | undefined,
): string {
  if (!isSafeInternalReturnPath(rawReturnUrl)) {
    return basePath;
  }
  const sep = basePath.includes('?') ? '&' : '?';
  return `${basePath}${sep}returnUrl=${encodeURIComponent(rawReturnUrl)}`;
}
