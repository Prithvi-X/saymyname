export function isCorsOriginAllowed(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!origin) {
    // Non-browser curl/mobile/server requests have no browser Origin header
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const normalizedOrigin = parsed.origin;
  const host = parsed.hostname.toLowerCase();
  const isProd = env.NODE_ENV === 'production';

  const configuredWebUrl = (env.WEB_APP_URL || '').trim();
  if (configuredWebUrl) {
    try {
      if (new URL(configuredWebUrl).origin === normalizedOrigin) {
        return true;
      }
    } catch {
      // Ignore invalid configured URL
    }
  }

  const extraAllowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extraAllowed.includes(normalizedOrigin)) {
    return true;
  }

  if (host === 'saymyname.in' || host === 'www.saymyname.in' || host.endsWith('.saymyname.in')) {
    return isProd ? parsed.protocol === 'https:' : true;
  }

  if (isProd) {
    if (env.ALLOW_VERCEL_PREVIEW_ORIGINS === 'true' && host.endsWith('.vercel.app')) {
      return parsed.protocol === 'https:';
    }
    return false;
  }

  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
    return true;
  }

  return false;
}

export function isSwaggerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') {
    return env.ENABLE_SWAGGER_DOCS === 'true';
  }
  return env.ENABLE_SWAGGER_DOCS !== 'false';
}
