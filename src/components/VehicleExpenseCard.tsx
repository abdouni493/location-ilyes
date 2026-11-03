import React from 'react';
import { VehicleExpense, Language, Car, MaintenanceType } from '../types';
import { motion } from 'motion/react';
import { Pencil, Trash2, Gauge, CalendarDays, Flag } from 'lucide-react';
import { paletteOf, typeLabel } from '../services/maintenanceTypeService';

interface VehicleExpenseCardProps {
  expense: VehicleExpense;
  car?: Car;
  /** Définition du type de la dépense (résolue par la page appelante). */
  type: MaintenanceType;
  index: number;
  lang: Language;
  onEdit: () => void;
  onDelete: () => void;
}

const FILTER_FLAGS: { key: keyof VehicleExpense; icon: string; fr: string; ar: string }[] = [
  { key: 'oilFilterChanged',  icon: '🛢️', fr: 'Huile',     ar: 'الزيت' },
  { key: 'airFilterChanged',  icon: '💨', fr: 'Air',       ar: 'هواء' },
  { key: 'fuelFilterChanged', icon: '⛽', fr: 'Carburant', ar: 'وقود' },
  { key: 'acFilterChanged',   icon: '❄️', fr: 'Clim',      ar: 'تكييف' },
];

export const VehicleExpenseCard: React.FC<VehicleExpenseCardProps> = ({
  expense,
  car,
  type,
  index,
  lang,
  onEdit,
  onDelete,
}) => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);
  const palette = paletteOf(type.color);

  // Jours restants avant expiration (types à échéance uniquement).
  const expiration = (() => {
    if (!expense.expirationDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const exp = new Date(expense.expirationDate); exp.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((exp.getTime() - today.getTime()) / 86400000);
    return { daysLeft, isExpired: daysLeft < 0, isWarning: daysLeft >= 0 && daysLeft <= 30 };
  })();

  const nextMileage =
    expense.currentMileage !== undefined && expense.currentMileage !== null && expense.nextVidangeKm
      ? expense.currentMileage + expense.nextVidangeKm
      : null;

  const accent = expiration?.isExpired
    ? 'border-red-300'
    : expiration?.isWarning
    ? 'border-amber-300'
    : 'border-saas-border';

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className={`bg-white rounded-3xl border ${accent} shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col group`}
    >
      {/* ── Bandeau type ────────────────────────────────────────────── */}
      <div className={`px-4 py-3 flex items-center gap-3 border-b ${palette.bg} ${palette.border}`}>
        <span className="w-10 h-10 rounded-xl bg-white/80 border border-white flex items-center justify-center text-lg shrink-0">
          {type.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black uppercase tracking-tight truncate ${palette.text}`}>
            {typeLabel(type, lang)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
            {fmtDate(expense.date)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-black text-saas-text-main leading-none">
            {(Number(expense.cost) || 0).toLocaleString('fr-FR')}
          </p>
          <p className="text-[9px] font-black uppercase tracking-widest text-saas-text-muted mt-0.5">DZD</p>
        </div>
      </div>

      {/* ── Véhicule ────────────────────────────────────────────────── */}
      <div className="p-4 flex items-center gap-3 border-b border-saas-border">
        <div className="w-14 h-11 rounded-xl overflow-hidden border border-saas-border bg-saas-bg shrink-0">
          {car?.images?.[0] ? (
            <img
              src={car.images[0]}
              alt={`${car.brand} ${car.model}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">🚗</div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-saas-text-main truncate">
            {car ? `${car.brand} ${car.model}` : T('Véhicule supprimé', 'مركبة محذوفة')}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-saas-text-muted truncate">
            {car?.registration || '—'}
          </p>
        </div>
      </div>

      {/* ── Détails ─────────────────────────────────────────────────── */}
      <div className="p-4 space-y-2.5 flex-1">
        {expense.expenseName && (
          <div className="flex items-start justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-saas-text-muted shrink-0 pt-0.5">
              📝 {T('Libellé', 'التسمية')}
            </span>
            <span className="text-xs font-bold text-saas-text-main text-right">{expense.expenseName}</span>
          </div>
        )}

        {expense.currentMileage !== undefined && expense.currentMileage !== null && expense.currentMileage > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
              <Gauge size={12} /> {T('Kilométrage', 'المسافة')}
            </span>
            <span className="text-xs font-black text-saas-text-main">
              {expense.currentMileage.toLocaleString('fr-FR')} KM
            </span>
          </div>
        )}

        {nextMileage !== null && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-saas-bg border border-saas-border">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
              <Flag size={12} /> {T('Prochaine échéance', 'الاستحقاق القادم')}
            </span>
            <span className="text-xs font-black text-saas-text-main">
              {nextMileage.toLocaleString('fr-FR')} KM
            </span>
          </div>
        )}

        {expense.expirationDate && (
          <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border ${
            expiration?.isExpired
              ? 'bg-red-50 border-red-200'
              : expiration?.isWarning
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
              <CalendarDays size={12} /> {T('Expiration', 'الانتهاء')}
            </span>
            <span className={`text-xs font-black ${
              expiration?.isExpired ? 'text-red-700' : expiration?.isWarning ? 'text-amber-700' : 'text-green-700'
            }`}>
              {fmtDate(expense.expirationDate)}
              {expiration && (
                <span className="ml-1.5 font-bold">
                  {expiration.isExpired
                    ? `· ${T('expiré', 'منتهي')}`
                    : `· ${expiration.daysLeft} ${T('j', 'ي')}`}
                </span>
              )}
            </span>
          </div>
        )}

        {expense.type === 'vidange' && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {FILTER_FLAGS.map(f => {
              const on = !!expense[f.key];
              return (
                <span
                  key={String(f.key)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                    on ? 'bg-green-50 border-green-200 text-green-700' : 'bg-saas-bg border-saas-border text-saas-text-muted'
                  }`}
                >
                  {on ? '✅' : '☐'} {f.icon} {T(f.fr, f.ar)}
                </span>
              );
            })}
          </div>
        )}

        {expense.note && (
          <p className="text-xs text-saas-text-muted italic pt-1 border-t border-saas-border">
            {expense.note}
          </p>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-saas-border bg-saas-bg flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl bg-white border border-saas-border text-saas-text-main hover:border-saas-secondary-start hover:text-saas-secondary-start transition-colors cursor-pointer"
        >
          <Pencil size={13} /> {T('Modifier', 'تعديل')}
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl bg-white border border-saas-border text-saas-text-main hover:border-red-400 hover:text-red-600 transition-colors cursor-pointer"
        >
          <Trash2 size={13} /> {T('Supprimer', 'حذف')}
        </button>
      </div>
    </motion.div>
  );
};
