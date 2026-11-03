/**
 * Tarification location : jour / semaine / mois.
 *
 * Règle métier (unique source de vérité) :
 *
 * • L'agence saisit un **prix par jour** pour chacune des trois formules :
 *   – `priceDay`   : tarif journalier « à la journée » ;
 *   – `priceWeek`  : tarif journalier « en formule semaine » ;
 *   – `priceMonth` : tarif journalier « en formule mois ».
 *
 *   ⚠️ Malgré leur nom, `priceWeek` / `priceMonth` (colonnes `price_week` /
 *   `price_month`) contiennent bien un tarif JOURNALIER, pas un total. C'est
 *   la valeur que l'agence saisit et voit dans la fiche véhicule.
 *
 * • Le **total** d'une formule est toujours dérivé : `priceWeek × 7` pour la
 *   semaine, `priceMonth × 30` pour le mois. Il n'est jamais stocké.
 * • L'affichage (site public, fiches véhicule) montre le tarif journalier, et
 *   le total de la formule entre parenthèses.
 *
 * Toutes les vues passent par les helpers ci-dessous afin qu'un seul endroit
 * décide des multiplicateurs et des valeurs de repli.
 */

/** Nombre de jours facturés dans une formule « semaine ». */
export const WEEK_DAYS = 7;
/** Nombre de jours facturés dans une formule « mois ». */
export const MONTH_DAYS = 30;

/** Sous-ensemble de `Car` nécessaire au calcul (facilite les appels partiels). */
export interface CarRates {
  priceDay?: number | null;
  /** Tarif JOURNALIER en formule semaine. */
  priceWeek?: number | null;
  /** Tarif JOURNALIER en formule mois. */
  priceMonth?: number | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Tarif journalier « à la journée ». */
export const dayRate = (car?: CarRates | null): number => num(car?.priceDay);

/**
 * Tarif journalier en formule semaine. Repli sur le tarif « à la journée »
 * tant qu'aucun tarif semaine n'a été saisi (donc aucune remise).
 */
export const weekDayRate = (car?: CarRates | null): number =>
  num(car?.priceWeek) || dayRate(car);

/** Tarif journalier en formule mois. Repli sur le tarif « à la journée ». */
export const monthDayRate = (car?: CarRates | null): number =>
  num(car?.priceMonth) || dayRate(car);

/** Total d'une semaine : tarif journalier semaine × 7. */
export const weekTotal = (car?: CarRates | null): number =>
  Math.round(weekDayRate(car) * WEEK_DAYS);

/** Total d'un mois : tarif journalier mois × 30. */
export const monthTotal = (car?: CarRates | null): number =>
  Math.round(monthDayRate(car) * MONTH_DAYS);

/** Décomposition d'une durée de location en mois / semaines / jours. */
export interface RentalBreakdown {
  /** Durée totale demandée, en jours. */
  days: number;
  months: number;
  weeks: number;
  /** Jours restants facturés au tarif journalier. */
  extraDays: number;
  /** Tarifs JOURNALIERS retenus pour chaque formule. */
  monthDayRate: number;
  weekDayRate: number;
  dayRate: number;
  /** Totaux unitaires d'une formule (utiles à l'affichage du détail). */
  monthTotal: number;
  weekTotal: number;
  /** Montants par tranche. */
  monthsAmount: number;
  weeksAmount: number;
  extraDaysAmount: number;
  /** Somme des trois tranches. */
  total: number;
}

/**
 * Calcule le prix de base d'une location.
 *
 * La durée est consommée par tranches décroissantes : mois entiers d'abord
 * (formule la plus avantageuse), puis semaines entières, puis jours isolés.
 * Une réservation de 7 jours est donc facturée `tarif semaine × 7`, une de
 * 30 jours `tarif mois × 30` — exactement comme le demande la grille.
 */
export function computeRentalBase(car: CarRates | null | undefined, days: number): RentalBreakdown {
  const totalDays = Math.max(0, Math.floor(Number(days) || 0));

  const mDay = monthDayRate(car);
  const wDay = weekDayRate(car);
  const dRate = dayRate(car);

  const mTotal = Math.round(mDay * MONTH_DAYS);
  const wTotal = Math.round(wDay * WEEK_DAYS);

  const months = Math.floor(totalDays / MONTH_DAYS);
  const afterMonths = totalDays % MONTH_DAYS;
  const weeks = Math.floor(afterMonths / WEEK_DAYS);
  const extraDays = afterMonths % WEEK_DAYS;

  const monthsAmount = months * mTotal;
  const weeksAmount = weeks * wTotal;
  const extraDaysAmount = extraDays * dRate;

  return {
    days: totalDays,
    months,
    weeks,
    extraDays,
    monthDayRate: mDay,
    weekDayRate: wDay,
    dayRate: dRate,
    monthTotal: mTotal,
    weekTotal: wTotal,
    monthsAmount,
    weeksAmount,
    extraDaysAmount,
    total: Math.round(monthsAmount + weeksAmount + extraDaysAmount),
  };
}
