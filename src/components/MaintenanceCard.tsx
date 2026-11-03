import React from 'react';
import { motion } from 'motion/react';
import { Car, Language, MaintenanceType } from '../types';
import {
  MaintenanceItemStatus,
  MaintenanceStatus,
  LEVEL_STYLES,
} from '../services/maintenanceService';
import { paletteOf, typeLabel } from '../services/maintenanceTypeService';
import { Edit2, Plus, Gauge, Receipt, ChevronRight } from 'lucide-react';

interface MaintenanceCardProps {
  maintenance: MaintenanceStatus;
  lang: Language;
  onEditCar: (car: Car) => void;
  /** Ouvre le formulaire de dépense pour ce véhicule et ce type. */
  onAddExpense: (car: Car, type: MaintenanceType) => void;
  /** Ouvre le formulaire sans type imposé. */
  onQuickAdd: (car: Car) => void;
  /** Agences rattachées au véhicule (multi-agences) — masqué si mono-agence. */
  companyBadges?: { id: string; name: string }[];
}

/**
 * Part consommée de l'intervalle, entre 0 et 1.
 * Sert uniquement à la barre de progression : au-delà de l'échéance, on sature
 * à 100 % (le dépassement est déjà signalé par la couleur rouge).
 */
const progressOf = (item: MaintenanceItemStatus): number | null => {
  if (item.type.tracking === 'mileage') {
    if (!item.intervalKm || item.kmRemaining === null) return null;
    return Math.min(1, Math.max(0, (item.intervalKm - item.kmRemaining) / item.intervalKm));
  }
  if (item.type.tracking === 'date') {
    if (item.daysRemaining === null) return null;
    const total = item.type.defaultIntervalDays || 365;
    return Math.min(1, Math.max(0, (total - item.daysRemaining) / total));
  }
  return null;
};

export const MaintenanceCard: React.FC<MaintenanceCardProps> = ({
  maintenance,
  lang,
  onEditCar,
  onAddExpense,
  onQuickAdd,
  companyBadges,
}) => {
  const { car, items, worstLevel, criticalCount, warningCount, totalCost } = maintenance;
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  // Seuls les types à échéance apparaissent dans le compte à rebours.
  const trackedItems = items.filter(i => i.type.tracking !== 'simple');
  const simpleItems = items.filter(i => i.type.tracking === 'simple' && i.count > 0);
  const level = LEVEL_STYLES[worstLevel];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      className="bg-white rounded-3xl border border-saas-border shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col group"
    >
      {/* ── Visuel véhicule ─────────────────────────────────────────── */}
      <div className="relative h-40 overflow-hidden bg-saas-bg">
        <img
          src={car.images[0] || 'https://picsum.photos/seed/car/400/300'}
          alt={`${car.brand} ${car.model}`}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/85 via-slate-900/25 to-transparent" />

        <button
          onClick={() => onEditCar(car)}
          title={T('Modifier le véhicule', 'تعديل المركبة')}
          className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-saas-text-main rounded-xl transition-all shadow-sm cursor-pointer"
        >
          <Edit2 size={15} />
        </button>

        {/* Badge d'état global */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${level.bg} ${level.border} ${level.text}`}>
          {criticalCount > 0
            ? `${criticalCount} ${T('critique', 'حرج')}${criticalCount > 1 ? 's' : ''}`
            : warningCount > 0
            ? `${warningCount} ${T('à surveiller', 'للمراقبة')}`
            : T(level.label.fr, level.label.ar)}
        </div>

        {/* Identité */}
        <div className="absolute bottom-0 inset-x-0 p-4 text-white">
          <h3 className="text-lg font-black uppercase tracking-tight leading-tight">
            {car.brand} {car.model}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
              {car.registration}
            </span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
              {car.year}
            </span>
          </div>
          {/* Badges d'agence — le parc étant commun, ils indiquent le rattachement */}
          {companyBadges && companyBadges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {companyBadges.map(b => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 border border-white/30 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-sm"
                >
                  🏢 {b.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bandeau kilométrage ─────────────────────────────────────── */}
      <div className="px-4 py-3 bg-saas-bg border-b border-saas-border flex items-center justify-between">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
          <Gauge size={14} /> {T('Compteur', 'العداد')}
        </span>
        <span className="text-lg font-black text-saas-text-main tracking-tight">
          {(car.mileage || 0).toLocaleString('fr-FR')} <span className="text-xs text-saas-text-muted">KM</span>
        </span>
      </div>

      {/* ── Échéances ───────────────────────────────────────────────── */}
      <div className="p-4 flex-1 space-y-2">
        {trackedItems.length === 0 && (
          <p className="text-xs text-saas-text-muted text-center py-6">
            {T('Aucun type suivi. Créez-en un depuis « Types de dépenses ».',
               'لا يوجد نوع متابع. أنشئ نوعاً من « أنواع النفقات ».')}
          </p>
        )}

        {trackedItems.map(item => {
          const p = paletteOf(item.type.color);
          const lvl = LEVEL_STYLES[item.level];
          const progress = progressOf(item);
          const value =
            item.type.tracking === 'mileage' ? item.kmRemaining : item.daysRemaining;
          const unit =
            item.type.tracking === 'mileage' ? T('KM', 'كم') : T('JOURS', 'يوم');

          return (
            <button
              key={item.type.key}
              onClick={() => onAddExpense(car, item.type)}
              title={T(`Nouvelle dépense · ${item.type.labelFr}`, `نفقة جديدة · ${item.type.labelAr}`)}
              className={`w-full text-left px-3 py-2.5 rounded-2xl border transition-all hover:shadow-sm cursor-pointer ${lvl.bg} ${lvl.border}`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${p.bg} border ${p.border}`}>
                  {item.type.icon}
                </span>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black uppercase tracking-wide truncate ${lvl.text}`}>
                    {typeLabel(item.type, lang)}
                  </p>
                  <p className="text-[10px] text-saas-text-muted font-semibold truncate">
                    {item.lastDate
                      ? item.type.tracking === 'mileage'
                        ? `${new Date(item.lastDate).toLocaleDateString('fr-FR')} · ${(item.lastMileage ?? 0).toLocaleString('fr-FR')} km → ${(item.nextMileage ?? 0).toLocaleString('fr-FR')} km`
                        : `${T('Expire le', 'ينتهي في')} ${item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('fr-FR') : '—'}`
                      : T('Jamais enregistré', 'غير مسجل')}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-base font-black leading-none ${lvl.text}`}>
                    {value === null || value === undefined ? '—' : Math.abs(value).toLocaleString('fr-FR')}
                  </p>
                  <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${lvl.text} opacity-70`}>
                    {value !== null && value !== undefined && value < 0 ? T('DÉPASSÉ', 'متجاوز') : unit}
                  </p>
                </div>
              </div>

              {progress !== null && (
                <div className="mt-2 h-1.5 rounded-full bg-white/70 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${lvl.bar}`}
                  />
                </div>
              )}
            </button>
          );
        })}

        {/* Types sans échéance déjà utilisés sur ce véhicule */}
        {simpleItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {simpleItems.map(item => (
              <button
                key={item.type.key}
                onClick={() => onAddExpense(car, item.type)}
                className="px-2.5 py-1 rounded-lg bg-saas-bg border border-saas-border text-[10px] font-bold text-saas-text-muted hover:border-saas-primary-via hover:text-saas-primary-via transition-colors cursor-pointer"
              >
                {item.type.icon} {typeLabel(item.type, lang)} · {item.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Pied : cumul + action ───────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-saas-border bg-saas-bg flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-saas-text-muted">
            <Receipt size={11} /> {T('Total dépenses', 'إجمالي النفقات')}
          </p>
          <p className="text-sm font-black text-saas-text-main truncate">
            {totalCost.toLocaleString('fr-FR')} DZD
            <span className="text-[10px] font-bold text-saas-text-muted ml-1.5">
              · {maintenance.expenseCount}
            </span>
          </p>
        </div>
        <button
          onClick={() => onQuickAdd(car)}
          className="btn-saas-primary px-3.5 py-2 text-xs shrink-0"
        >
          <Plus size={14} />
          {T('Dépense', 'نفقة')}
          <ChevronRight size={14} className="opacity-70" />
        </button>
      </div>
    </motion.div>
  );
};
