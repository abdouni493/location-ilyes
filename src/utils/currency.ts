/**
 * Multi-devises.
 *
 * Le DZD reste la devise de référence : tous les prix sont saisis et stockés
 * en dinars. Chaque voiture peut activer une ou plusieurs devises secondaires
 * avec son propre taux de change (1 unité de devise = N DZD). Les prix
 * jour / semaine / mois / caution des devises activées sont donc TOUJOURS
 * dérivés du DZD — il n'y a jamais deux sources de vérité.
 */

export type CurrencyCode = 'DZD' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  label: string;
  flag: string;
  /** Nombre de décimales à l'affichage. */
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  DZD: { code: 'DZD', symbol: 'DA', label: 'Dinar algérien', flag: '🇩🇿', decimals: 0 },
  USD: { code: 'USD', symbol: '$',  label: 'Dollar américain', flag: '🇺🇸', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€',  label: 'Euro',             flag: '🇪🇺', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£',  label: 'Livre sterling',   flag: '🇬🇧', decimals: 2 },
};

/** Devises secondaires activables sur une voiture (le DZD est toujours actif). */
export const SECONDARY_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP'];

export const ALL_CURRENCIES: CurrencyCode[] = ['DZD', ...SECONDARY_CURRENCIES];

/** Taux par défaut proposés à la création d'une voiture (1 devise = N DZD). */
export const DEFAULT_RATES: Record<CurrencyCode, number> = {
  DZD: 1,
  USD: 135,
  EUR: 150,
  GBP: 175,
};

/** Configuration d'une devise secondaire sur une voiture. */
export interface CarCurrencyConfig {
  enabled: boolean;
  /** 1 unité de cette devise = `rate` DZD. */
  rate: number;
}

export type CarCurrencies = Partial<Record<CurrencyCode, CarCurrencyConfig>>;

/** Convertit un montant en DZD vers la devise cible. */
export function convertFromDzd(amountDzd: number, currency: CurrencyCode, rate: number): number {
  if (currency === 'DZD') return Math.round(amountDzd);
  if (!rate || rate <= 0) return 0;
  const raw = amountDzd / rate;
  const decimals = CURRENCIES[currency].decimals;
  const factor = Math.pow(10, decimals);
  return Math.round(raw * factor) / factor;
}

/** Convertit un montant d'une devise vers le DZD. */
export function convertToDzd(amount: number, currency: CurrencyCode, rate: number): number {
  if (currency === 'DZD') return Math.round(amount);
  if (!rate || rate <= 0) return 0;
  return Math.round(amount * rate);
}

/** Formate un montant avec le symbole de la devise. */
export function formatCurrency(amount: number, currency: CurrencyCode = 'DZD'): string {
  const meta = CURRENCIES[currency] || CURRENCIES.DZD;
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = value.toLocaleString('fr-FR', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
  return currency === 'DZD' ? `${formatted} ${meta.symbol}` : `${meta.symbol}${formatted}`;
}

/** Formate un montant DZD directement dans la devise cible. */
export function formatFromDzd(amountDzd: number, currency: CurrencyCode, rate: number): string {
  return formatCurrency(convertFromDzd(amountDzd, currency, rate), currency);
}

/** Taux d'une voiture pour une devise (1 si DZD, 0 si non configurée). */
export function getCarRate(currencies: CarCurrencies | undefined, currency: CurrencyCode): number {
  if (currency === 'DZD') return 1;
  return currencies?.[currency]?.rate || 0;
}

/** Devise activée sur cette voiture ? (le DZD l'est toujours) */
export function isCurrencyEnabled(currencies: CarCurrencies | undefined, currency: CurrencyCode): boolean {
  if (currency === 'DZD') return true;
  return !!currencies?.[currency]?.enabled && (currencies?.[currency]?.rate || 0) > 0;
}

/** Liste des devises activées sur une voiture, DZD en tête. */
export function enabledCurrencies(currencies: CarCurrencies | undefined): CurrencyCode[] {
  return ALL_CURRENCIES.filter(c => isCurrencyEnabled(currencies, c));
}

/** Normalise la valeur JSON venant de la base en `CarCurrencies`. */
export function parseCarCurrencies(raw: any): CarCurrencies {
  if (!raw || typeof raw !== 'object') return {};
  const out: CarCurrencies = {};
  for (const code of SECONDARY_CURRENCIES) {
    const entry = raw[code];
    if (entry && typeof entry === 'object') {
      out[code] = {
        enabled: !!entry.enabled,
        rate: Number(entry.rate) || 0,
      };
    }
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════
   TIMBRE FISCAL (droit de timbre algérien sur les paiements en espèces)
   ══════════════════════════════════════════════════════════════════════
   • 300 DA à 30 000 DA      → 1 DA par tranche de 100 DA  (1 %)
   • 30 001 DA à 100 000 DA  → 1,5 DA par tranche de 100 DA (1,5 %)
   • plus de 100 000 DA      → 2 DA par tranche de 100 DA   (2 %)
   Le calcul se fait bien PAR TRANCHE de 100 DA entamée. */

export interface TimbreResult {
  /** Montant du timbre en DZD. */
  amount: number;
  /** Taux appliqué (1, 1.5 ou 2 %). 0 si hors barème. */
  rate: number;
  /** Nombre de tranches de 100 DA. */
  tranches: number;
}

export function computeTimbre(totalDzd: number): TimbreResult {
  const total = Math.max(0, Math.round(Number(totalDzd) || 0));
  if (total < 300) return { amount: 0, rate: 0, tranches: 0 };

  let rate: number;
  if (total <= 30000) rate = 1;
  else if (total <= 100000) rate = 1.5;
  else rate = 2;

  const tranches = Math.ceil(total / 100);
  const amount = Math.round(tranches * rate);
  return { amount, rate, tranches };
}

/** Libellé lisible du barème appliqué. */
export function timbreLabel(totalDzd: number, lang: 'fr' | 'ar' = 'fr'): string {
  const { rate } = computeTimbre(totalDzd);
  if (!rate) return lang === 'fr' ? 'Non applicable (< 300 DA)' : 'غير مطبق (< 300 دج)';
  const pretty = rate.toString().replace('.', ',');
  return lang === 'fr'
    ? `${pretty} DA par tranche de 100 DA (soit ${pretty} %)`
    : `${pretty} دج لكل شريحة 100 دج (أي ${pretty} %)`;
}
