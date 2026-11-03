import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { ThemeMode, getStoredTheme, setTheme } from '../utils/themeService';
import { Language } from '../types';

interface ThemeToggleProps {
  lang?: Language;
  /** `nav` : bouton compact de la navbar admin · `site` : version site public. */
  variant?: 'nav' | 'site';
  className?: string;
}

/**
 * Bascule clair / sombre. Présente dans la navbar de l'application ET dans
 * celle du site public : le mode est mémorisé dans le localStorage, donc
 * partagé entre les deux.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ lang = 'fr', variant = 'nav', className = '' }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    setMode(getStoredTheme());
  }, []);

  const toggle = () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    setTheme(next);
  };

  const label =
    mode === 'dark'
      ? (lang === 'fr' ? 'Mode clair' : 'الوضع الفاتح')
      : (lang === 'fr' ? 'Mode sombre' : 'الوضع الداكن');

  const base =
    variant === 'site'
      ? 'relative flex items-center justify-center w-10 h-10 rounded-full border border-vel-border bg-vel-surface text-vel-slate hover:text-vel-cta hover:border-vel-cta transition-colors cursor-pointer'
      : 'relative flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-saas-border hover:border-saas-primary-via transition-all text-[10px] font-bold uppercase tracking-widest text-saas-text-main shadow-sm cursor-pointer';

  return (
    <button onClick={toggle} className={`${base} ${className}`} title={label} aria-label={label}>
      <span className="relative w-4 h-4 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'dark' ? (
            <motion.span
              key="sun"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Sun size={16} className="text-amber-500" />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Moon size={16} className="text-saas-secondary-start" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {variant === 'nav' && <span className="hidden md:inline">{label}</span>}
    </button>
  );
};
