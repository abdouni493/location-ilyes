/**
 * Thème clair / sombre de l'application ET du site public.
 *
 * Le basculement pose (ou retire) la classe `.dark` sur <html>. Toutes les
 * variables de couleur sont redéfinies sous `.dark` dans src/index.css, donc
 * un seul toggle suffit à basculer l'ensemble des écrans — y compris les
 * composants historiques qui utilisent `bg-white` / `text-slate-900`.
 */

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'mhd-auto-theme';

/**
 * Thème enregistré, sinon CLAIR.
 *
 * Le mode clair est le défaut de l'application : la préférence système n'est
 * volontairement PAS consultée. Le mode sombre ne s'applique que si
 * l'utilisateur l'a explicitement activé via le bouton de la navbar.
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'dark' ? 'dark' : 'light';
}

/** Applique le thème au document (sans l'enregistrer). */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
}

/** Applique ET enregistre le thème. */
export function setTheme(mode: ThemeMode): void {
  applyTheme(mode);
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* stockage indisponible (navigation privée) — le thème reste en session */
  }
}

/** Initialise le thème au démarrage. Retourne le mode appliqué. */
export function initTheme(): ThemeMode {
  const mode = getStoredTheme();
  applyTheme(mode);
  return mode;
}
