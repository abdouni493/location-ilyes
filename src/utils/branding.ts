export const DEFAULT_APP_NAME = 'Altech Location';

/** Sets the browser tab title and favicon from the agency name and logo. */
export function applyBranding(name?: string | null, logo?: string | null): void {
  const cleanName = (name || '').trim();
  document.title = cleanName || DEFAULT_APP_NAME;
  document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']").forEach(l => l.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = logo ? logo : 'data:,';
  document.head.appendChild(link);
}
