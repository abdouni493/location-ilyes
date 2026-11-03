import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  CurrencyCode, CarCurrencies, ALL_CURRENCIES, CURRENCIES,
  convertFromDzd, formatCurrency, getCarRate, isCurrencyEnabled,
} from '../../utils/currency';
import { Car } from '../../types';

/**
 * Devise d'affichage du site public.
 *
 * `ALL` = mode par défaut : chaque carte montre tous les tarifs activés sur la
 * voiture. Sélectionner une devise filtre l'affichage sur celle-ci et la
 * propage au wizard de réservation (récapitulatif, total, code promo).
 */
export type DisplayCurrency = CurrencyCode | 'ALL';

interface CurrencyValue {
  /** Devise choisie dans la navbar / en haut des offres. */
  display: DisplayCurrency;
  setDisplay: (c: DisplayCurrency) => void;
  /** Devise effective pour les calculs (DZD quand `display` vaut 'ALL'). */
  active: CurrencyCode;
  /** Devises réellement proposées par au moins une voiture du catalogue. */
  available: CurrencyCode[];
  /** Taux de cette voiture pour la devise active (1 en DZD, 0 si non activée). */
  rateFor: (car?: Car | null) => number;
  /** Convertit un montant DZD dans la devise active de cette voiture. */
  convert: (amountDzd: number, car?: Car | null) => number;
  /** Formate un montant DZD dans la devise active de cette voiture. */
  format: (amountDzd: number, car?: Car | null) => string;
  /** La devise active est-elle utilisable sur cette voiture ? */
  supports: (car?: Car | null) => boolean;
}

const CurrencyCtx = createContext<CurrencyValue | null>(null);

export const WebsiteCurrencyProvider: React.FC<{
  cars: Car[];
  children: React.ReactNode;
}> = ({ cars, children }) => {
  const [display, setDisplay] = useState<DisplayCurrency>('ALL');

  const available = useMemo<CurrencyCode[]>(() => {
    const set = new Set<CurrencyCode>(['DZD']);
    for (const car of cars) {
      for (const code of ALL_CURRENCIES) {
        if (isCurrencyEnabled(car.currencies as CarCurrencies, code)) set.add(code);
      }
    }
    return ALL_CURRENCIES.filter(c => set.has(c));
  }, [cars]);

  const value = useMemo<CurrencyValue>(() => {
    const active: CurrencyCode = display === 'ALL' ? 'DZD' : display;

    const rateFor = (car?: Car | null) => {
      if (active === 'DZD') return 1;
      return getCarRate(car?.currencies as CarCurrencies, active);
    };

    const convert = (amountDzd: number, car?: Car | null) => {
      const rate = rateFor(car);
      return rate > 0 ? convertFromDzd(amountDzd, active, rate) : 0;
    };

    return {
      display,
      setDisplay,
      active,
      available,
      rateFor,
      convert,
      format: (amountDzd, car) => {
        const rate = rateFor(car);
        if (rate <= 0) return '—';
        return formatCurrency(convertFromDzd(amountDzd, active, rate), active);
      },
      supports: (car) => active === 'DZD' || isCurrencyEnabled(car?.currencies as CarCurrencies, active),
    };
  }, [display, available]);

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
};

/** Hook du site public. Retourne un mode DZD neutre hors du provider. */
export function useWebsiteCurrency(): CurrencyValue {
  const ctx = useContext(CurrencyCtx);
  if (ctx) return ctx;
  return {
    display: 'ALL',
    setDisplay: () => {},
    active: 'DZD',
    available: ['DZD'],
    rateFor: () => 1,
    convert: (amountDzd) => Math.round(amountDzd),
    format: (amountDzd) => formatCurrency(Math.round(amountDzd), 'DZD'),
    supports: () => true,
  };
}

/**
 * Sélecteur de devise réutilisable (navbar + haut de la page des offres).
 * `variant="pills"` affiche des pastilles larges, `"compact"` un menu discret.
 */
export const CurrencySwitcher: React.FC<{
  variant?: 'pills' | 'compact';
  showAllOption?: boolean;
  className?: string;
  labelAll?: string;
}> = ({ variant = 'compact', showAllOption = true, className = '', labelAll = 'Toutes' }) => {
  const { display, setDisplay, available } = useWebsiteCurrency();

  const options: { value: DisplayCurrency; label: string; flag: string }[] = [
    ...(showAllOption ? [{ value: 'ALL' as DisplayCurrency, label: labelAll, flag: '🌍' }] : []),
    ...available.map(c => ({ value: c as DisplayCurrency, label: `${c} ${CURRENCIES[c].symbol}`, flag: CURRENCIES[c].flag })),
  ];

  if (variant === 'compact') {
    return (
      <select
        value={display}
        onChange={e => setDisplay(e.target.value as DisplayCurrency)}
        aria-label="Devise"
        className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-vel-surface border border-vel-border text-vel-ink outline-none cursor-pointer hover:border-[#DC2626] focus:border-[#DC2626] transition-colors ${className}`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.flag} {o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-vel-surface border border-vel-border ${className}`}>
      {options.map(o => {
        const activeOpt = display === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setDisplay(o.value)}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer ${
              activeOpt
                ? 'bg-[#DC2626] text-white shadow-md shadow-[#DC2626]/25'
                : 'text-vel-muted hover:text-vel-ink hover:bg-vel-abyss'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="mr-1.5">{o.flag}</span>{o.label}
          </button>
        );
      })}
    </div>
  );
};
