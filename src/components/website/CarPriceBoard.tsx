import React from 'react';
import { Car, Language, SpecialOffer } from '../../types';
import { useWebsiteCurrency } from './CurrencyContext';
import {
  CurrencyCode, CURRENCIES, ALL_CURRENCIES,
  isCurrencyEnabled, getCarRate, convertFromDzd, formatCurrency,
} from '../../utils/currency';
import { WEEK_DAYS, MONTH_DAYS, weekDayRate, monthDayRate } from '../../utils/pricing';

/**
 * Tableau des tarifs d'une voiture sur le site public.
 *
 * • Devise sélectionnée → une seule colonne de prix, bien lisible.
 * • « Toutes devises »   → une ligne par devise activée sur la voiture, avec
 *   le dinar en tête ; les tarifs restent alignés jour / semaine / mois /
 *   caution pour rester lisibles même avec trois devises.
 *
 * Les trois formules sont annoncées au TARIF JOURNALIER — seule grandeur
 * directement comparable d'une ligne à l'autre. Le total d'une formule n'est
 * pas affiché ici : il apparaît au récapitulatif, une fois les dates connues.
 */
export const CarPriceBoard: React.FC<{
  lang: Language;
  car: Car;
  promo?: SpecialOffer;
  /** `card` : compact (grille d'offres) · `detail` : aéré (fiche véhicule). */
  variant?: 'card' | 'detail';
}> = ({ lang, car, promo, variant = 'card' }) => {
  const { display, active } = useWebsiteCurrency();

  const perDay = { fr: '/j', ar: '/ي' }[lang];

  const rows: {
    key: string;
    /** Durée de la formule : c'est elle qui titre la ligne. */
    label: string;
    /** Montant mis en avant : tarif journalier de la formule. */
    dzd: number;
    /** Ancien tarif barré (promotion). */
    old?: number;
    isDeposit?: boolean;
  }[] = [
    {
      key: 'day',
      label: { fr: 'Jour', ar: 'يوم' }[lang],
      dzd: promo ? promo.newPrice : car.priceDay,
      old: promo ? car.priceDay : undefined,
    },
    {
      key: 'week',
      label: { fr: `Semaine · ${WEEK_DAYS} j`, ar: `أسبوع · ${WEEK_DAYS} أيام` }[lang],
      dzd: weekDayRate(car),
    },
    {
      key: 'month',
      label: { fr: `Mois · ${MONTH_DAYS} j`, ar: `شهر · ${MONTH_DAYS} يوماً` }[lang],
      dzd: monthDayRate(car),
    },
    { key: 'deposit', label: { fr: 'Caution', ar: 'الكفالة' }[lang], dzd: car.deposit, isDeposit: true },
  ];

  const currencies: CurrencyCode[] = display === 'ALL'
    ? ALL_CURRENCIES.filter(c => isCurrencyEnabled(car.currencies as any, c))
    : [active];

  const fmt = (dzd: number, code: CurrencyCode) => {
    const rate = getCarRate(car.currencies as any, code);
    if (code !== 'DZD' && rate <= 0) return '—';
    return formatCurrency(convertFromDzd(dzd, code, rate), code);
  };

  const compact = variant === 'card';
  const textSize = compact ? 'text-[10px]' : 'text-sm';
  const valueSize = compact ? 'text-xs' : 'text-base';

  // ── Une seule devise : rendu simple ──────────────────────────────────────
  if (currencies.length <= 1) {
    const code = currencies[0] || 'DZD';
    return (
      <div
        className={`rounded-lg ${compact ? 'px-2.5 py-2 space-y-1' : 'px-4 py-3.5 space-y-2'}`}
        style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.12)' }}
      >
        {display !== 'ALL' && code !== 'DZD' && (
          <p className={`${textSize} font-black uppercase tracking-widest text-vel-muted flex items-center gap-1`}>
            {CURRENCIES[code].flag} {code}
          </p>
        )}
        {rows.map(r => (
          <div
            key={r.key}
            className={`flex justify-between items-baseline gap-3 ${textSize} ${r.isDeposit ? 'pt-1.5' : ''}`}
            style={r.isDeposit ? { borderTop: '1px solid rgba(15,23,42,0.06)' } : undefined}
          >
            <span className="text-vel-muted leading-snug">{r.label}</span>
            <span className={`font-black ${valueSize} text-right whitespace-nowrap`} style={{ color: r.isDeposit ? 'rgba(248,113,113,0.95)' : '#DC2626' }}>
              {r.old !== undefined && (
                <span className="line-through mr-1 font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>
                  {fmt(r.old, code)}
                </span>
              )}
              {fmt(r.dzd, code)}
              {!r.isDeposit && <span className="font-bold opacity-60">{perDay}</span>}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // ── Plusieurs devises : tableau aligné, DZD en colonne principale ────────
  return (
    <div
      className={`rounded-lg overflow-hidden ${compact ? '' : ''}`}
      style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`text-left ${compact ? 'px-2.5 py-1.5 text-[9px]' : 'px-4 py-2.5 text-[11px]'} font-black uppercase tracking-wider text-vel-muted`}>
                {{ fr: 'Tarif', ar: 'السعر' }[lang]}
              </th>
              {currencies.map(code => (
                <th
                  key={code}
                  className={`text-right ${compact ? 'px-2 py-1.5 text-[9px]' : 'px-4 py-2.5 text-[11px]'} font-black uppercase tracking-wider whitespace-nowrap`}
                  style={{ color: code === 'DZD' ? '#DC2626' : '#0284C7' }}
                >
                  <span className="mr-0.5">{CURRENCIES[code].flag}</span>{code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.key}
                style={r.isDeposit ? { borderTop: '1px solid rgba(15,23,42,0.08)' } : undefined}
              >
                <td className={`${compact ? 'px-2.5 py-1 text-[10px]' : 'px-4 py-2 text-sm'} text-vel-muted whitespace-nowrap`}>
                  {r.label}
                </td>
                {currencies.map(code => (
                  <td
                    key={code}
                    className={`text-right ${compact ? 'px-2 py-1 text-[10px]' : 'px-4 py-2 text-sm'} font-bold whitespace-nowrap`}
                    style={{
                      color: r.isDeposit
                        ? 'rgba(248,113,113,0.95)'
                        : code === 'DZD' ? '#DC2626' : 'var(--color-vel-slate)',
                    }}
                  >
                    {r.old !== undefined && (
                      <span className="line-through mr-1 font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>
                        {fmt(r.old, code)}
                      </span>
                    )}
                    {fmt(r.dzd, code)}
                    {!r.isDeposit && <span className="font-bold opacity-60">{perDay}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
