/**
 * Public configuration helper (D-P2-05)
 * Never invents unconfigured support mailboxes or placeholder legal entities.
 */
export function getConfiguredSupportEmail(): string | null {
  const candidate = (
    process.env.SUPPORT_EMAIL ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    ''
  ).trim();
  if (!candidate || !candidate.includes('@')) return null;
  return candidate;
}
