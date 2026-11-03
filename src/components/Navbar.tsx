import React from 'react';
import { Globe, Menu, Search, Monitor } from 'lucide-react';
import { Language, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { ThemeToggle } from './ThemeToggle';
import { CompanyBadge } from './CompanyBadge';

interface NavbarProps {
  user: User;
  lang: Language;
  setLang: (lang: Language) => void;
  toggleSidebar: () => void;
  onWebsiteToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, lang, setLang, toggleSidebar, onWebsiteToggle }) => {
  const t = TRANSLATIONS[lang];

  return (
    <header className="h-16 sm:h-20 bg-white/80 backdrop-blur-md border-b border-saas-border px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sticky top-0 z-40">
      <div className="flex items-center gap-3 lg:gap-6 min-w-0 flex-1">
        <button
          onClick={toggleSidebar}
          className="p-2.5 rounded-xl hover:bg-saas-bg text-saas-text-muted transition-colors border border-saas-border shadow-sm lg:hidden shrink-0"
        >
          <Menu size={20} />
        </button>

        {/* Masquée sous md : la barre de recherche pousserait tout le reste
            hors de l'écran sur un téléphone. */}
        <div className="hidden md:flex items-center gap-3 bg-saas-bg px-4 py-2 rounded-xl border border-saas-border w-64 lg:w-80 group focus-within:border-saas-primary-via focus-within:ring-2 focus-within:ring-saas-primary-via/10 transition-all">
          <Search size={16} className="text-saas-text-muted group-focus-within:text-saas-primary-via" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="bg-transparent border-none outline-none text-sm w-full text-saas-text-main placeholder:text-saas-text-muted font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 shrink-0">
        {/* Agence connectée — affichage seul, aucune bascule possible */}
        <CompanyBadge lang={lang} />

        <button
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
          className="flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-white border border-saas-border hover:border-saas-primary-via transition-all text-[10px] font-bold uppercase tracking-widest text-saas-text-main shadow-sm cursor-pointer"
        >
          <Globe size={16} className="text-saas-primary-via" />
          <span className="hidden sm:inline">{t.changeLang}</span>
        </button>

        {/* Bascule clair / sombre — partagée avec le site public */}
        <ThemeToggle lang={lang} variant="nav" />

        <button
          onClick={onWebsiteToggle}
          className="flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-white border border-saas-border hover:border-saas-secondary-start hover:text-saas-secondary-start transition-all text-[10px] font-bold uppercase tracking-widest text-saas-text-main shadow-sm cursor-pointer"
          title={lang === 'fr' ? 'Aperçu du site web' : 'عرض الموقع'}
        >
          <Monitor size={16} className="text-saas-secondary-start" />
          <span className="hidden md:inline">{{fr: 'Aperçu', ar: 'عرض'}[lang]}</span>
        </button>

        <div className="hidden sm:block h-8 w-[1px] bg-saas-border" />

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-saas-text-main uppercase tracking-tighter">{user.name}</p>
            <p className="text-[9px] text-saas-primary-via font-bold uppercase tracking-widest">{user.role}</p>
          </div>
          <div className="relative shrink-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-saas-border p-0.5 object-cover shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-saas-border p-0.5 bg-saas-primary-via flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
          </div>
        </div>
      </div>
    </header>
  );
};
