import { supabase } from '../supabase';
import { Car, MaintenanceTracking, MaintenanceType, VehicleExpense } from '../types';
import { DEFAULT_MAINTENANCE_TYPES } from './maintenanceTypeService';

/** Niveau d'alerte d'une échéance. `unknown` = aucune donnée saisie. */
export type MaintenanceLevel = 'critical' | 'warning' | 'success' | 'unknown';

/** État d'un type de maintenance pour un véhicule donné. */
export interface MaintenanceItemStatus {
  type: MaintenanceType;
  /** Dernière intervention enregistrée pour ce type. */
  expense: VehicleExpense | null;
  lastDate: string | null;
  /** Suivi kilométrique ------------------------------------------------ */
  lastMileage: number | null;
  /** Kilométrage absolu de la prochaine échéance (dernier relevé + intervalle). */
  nextMileage: number | null;
  intervalKm: number | null;
  kmRemaining: number | null;
  /** Suivi par date ---------------------------------------------------- */
  expirationDate: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  /** Cumuls sur tout l'historique du véhicule pour ce type. */
  count: number;
  totalCost: number;
  level: MaintenanceLevel;
}

export interface MaintenanceStatus {
  car: Car;
  items: MaintenanceItemStatus[];
  /** Pire niveau parmi les échéances suivies (km/date). */
  worstLevel: MaintenanceLevel;
  criticalCount: number;
  warningCount: number;
  totalCost: number;
  expenseCount: number;
  lastExpenseDate: string | null;
}

/** Seuils d'alerte, partagés par toutes les vues. */
export const KM_WARNING_THRESHOLD = 2000;
export const DAYS_WARNING_THRESHOLD = 30;

/** Mappe une ligne brute `vehicle_expenses` vers le modèle applicatif. */
const mapExpenseRow = (exp: any): VehicleExpense => {
  if (exp.carId) return exp as VehicleExpense; // déjà au format applicatif
  return {
    id: exp.id,
    carId: exp.car_id,
    type: exp.type,
    cost: exp.cost,
    date: exp.date,
    note: exp.note,
    currentMileage: exp.current_mileage,
    nextVidangeKm: exp.next_vidange_km,
    expirationDate: exp.expiration_date,
    expenseName: exp.expense_name,
    createdAt: exp.created_at,
    oilFilterChanged: exp.oil_filter_changed || false,
    airFilterChanged: exp.air_filter_changed || false,
    fuelFilterChanged: exp.fuel_filter_changed || false,
    acFilterChanged: exp.ac_filter_changed || false,
  };
};

/** Horodatage de référence d'une dépense (createdAt si dispo, sinon date). */
const stamp = (e: VehicleExpense): number => {
  const t = e.createdAt ? new Date(e.createdAt).getTime() : NaN;
  if (!Number.isNaN(t)) return t;
  const d = new Date(e.date).getTime();
  return Number.isNaN(d) ? 0 : d;
};

/** Dernière dépense d'une liste (la plus récente par date puis par création). */
const latestOf = (list: VehicleExpense[]): VehicleExpense | null => {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => {
    const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (!Number.isNaN(byDate) && byDate !== 0) return byDate;
    return stamp(b) - stamp(a);
  })[0];
};

/** Nombre de jours entiers entre aujourd'hui et une date d'expiration. */
const daysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Niveau d'alerte à partir de la valeur restante.
 * - km   : rouge <= 0, orange <= 2 000 km, vert au-delà
 * - jours: rouge < 0, orange <= 30 jours, vert au-delà
 */
export function getStatusLevel(
  tracking: MaintenanceTracking,
  value: number | null | undefined
): MaintenanceLevel {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  if (tracking === 'mileage') {
    if (value <= 0) return 'critical';
    if (value <= KM_WARNING_THRESHOLD) return 'warning';
    return 'success';
  }
  if (tracking === 'date') {
    if (value < 0) return 'critical';
    if (value <= DAYS_WARNING_THRESHOLD) return 'warning';
    return 'success';
  }
  return 'unknown';
}

/** Classes de la pastille d'état, communes à toutes les vues maintenance. */
export const LEVEL_STYLES: Record<MaintenanceLevel, { bg: string; border: string; text: string; bar: string; label: { fr: string; ar: string } }> = {
  critical: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    bar: 'bg-red-500',    label: { fr: 'Critique',  ar: 'حرج' } },
  warning:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  bar: 'bg-amber-500',  label: { fr: 'Bientôt',   ar: 'قريباً' } },
  success:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  bar: 'bg-green-500',  label: { fr: 'Bon',       ar: 'جيد' } },
  unknown:  { bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  bar: 'bg-slate-400',  label: { fr: 'À saisir',  ar: 'غير مسجل' } },
};

const WORST_ORDER: MaintenanceLevel[] = ['critical', 'warning', 'success', 'unknown'];

/**
 * Calcule l'état de maintenance de chaque véhicule, pour tous les types
 * (système + personnalisés). Les types `simple` restent des lignes de dépense :
 * ils remontent leur cumul mais pas de compte à rebours.
 */
export async function getMaintenanceStatus(
  cars: Car[],
  allExpenses?: VehicleExpense[],
  types: MaintenanceType[] = DEFAULT_MAINTENANCE_TYPES
): Promise<MaintenanceStatus[]> {
  try {
    let expensesPool: VehicleExpense[] = (allExpenses || []).map(mapExpenseRow);

    // Repli : si l'appelant n'a pas fourni les dépenses, on les charge ici.
    if (!allExpenses) {
      const { data, error } = await supabase
        .from('vehicle_expenses')
        .select('*')
        .order('date', { ascending: false });
      if (error) {
        console.error('[maintenance] lecture des dépenses impossible:', error.message);
        return [];
      }
      expensesPool = (data || []).map(mapExpenseRow);
    }

    const activeTypes = types.filter(t => t.isActive !== false);

    return cars.map(car => {
      const carExpenses = expensesPool.filter(e => e.carId === car.id);

      const items: MaintenanceItemStatus[] = activeTypes.map(type => {
        const group = carExpenses.filter(e => e.type === type.key);
        const latest = latestOf(group);
        const totalCost = group.reduce((s, e) => s + (Number(e.cost) || 0), 0);

        let lastMileage: number | null = null;
        let intervalKm: number | null = null;
        let nextMileage: number | null = null;
        let kmRemaining: number | null = null;
        let expirationDate: string | null = null;
        let daysRemaining: number | null = null;

        if (type.tracking === 'mileage' && latest) {
          lastMileage = latest.currentMileage ?? null;
          intervalKm = latest.nextVidangeKm ?? null;
          if (lastMileage !== null && intervalKm) {
            nextMileage = lastMileage + intervalKm;
            kmRemaining = nextMileage - (car.mileage || 0);
          }
        }

        if (type.tracking === 'date' && latest?.expirationDate) {
          expirationDate = latest.expirationDate;
          daysRemaining = daysUntil(latest.expirationDate);
        }

        const level = getStatusLevel(
          type.tracking,
          type.tracking === 'mileage' ? kmRemaining : daysRemaining
        );

        return {
          type,
          expense: latest,
          lastDate: latest?.date || null,
          lastMileage,
          nextMileage,
          intervalKm,
          kmRemaining,
          expirationDate,
          daysRemaining,
          isExpired: level === 'critical',
          count: group.length,
          totalCost,
          level,
        };
      });

      const tracked = items.filter(i => i.type.tracking !== 'simple');
      const worstLevel =
        WORST_ORDER.find(lvl => tracked.some(i => i.level === lvl)) || 'unknown';

      const dated = carExpenses.map(e => e.date).filter(Boolean).sort();

      return {
        car,
        items,
        worstLevel,
        criticalCount: tracked.filter(i => i.level === 'critical').length,
        warningCount: tracked.filter(i => i.level === 'warning').length,
        totalCost: carExpenses.reduce((s, e) => s + (Number(e.cost) || 0), 0),
        expenseCount: carExpenses.length,
        lastExpenseDate: dated.length ? dated[dated.length - 1] : null,
      };
    });
  } catch (error) {
    console.error('Error getting maintenance status:', error);
    return [];
  }
}
