import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, Gauge, CalendarClock, Receipt, Check } from 'lucide-react';
import { Language, MaintenanceColor, MaintenanceTracking, MaintenanceType } from '../types';
import {
  MAINTENANCE_COLORS,
  TYPE_ICON_CHOICES,
  paletteOf,
  slugifyKey,
} from '../services/maintenanceTypeService';
import { ModalPortal } from './ui/ModalPortal';

interface MaintenanceTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Renvoie le type créé/modifié une fois enregistré en base. */
  onSave: (payload: {
    id?: string;
    labelFr: string;
    labelAr: string;
    icon: string;
    tracking: MaintenanceTracking;
    defaultIntervalKm: number | null;
    defaultIntervalDays: number | null;
    color: MaintenanceColor;
  }) => Promise<void> | void;
  /** Type existant à modifier (sinon création). */
  type?: MaintenanceType | null;
  /** Clés déjà utilisées — sert à prévenir l'utilisateur d'un doublon. */
  existingKeys?: string[];
  saving?: boolean;
  error?: string | null;
  lang: Language;
}

const TRACKING_CHOICES: {
  value: MaintenanceTracking;
  icon: React.ReactNode;
  fr: string;
  ar: string;
  hintFr: string;
  hintAr: string;
}[] = [
  {
    value: 'mileage',
    icon: <Gauge size={18} />,
    fr: 'Kilométrage',
    ar: 'المسافة',
    hintFr: 'Compte à rebours en KM — comme la vidange (bougies, freins, pneus…).',
    hintAr: 'العد التنازلي بالكيلومترات — مثل تغيير الزيت.',
  },
  {
    value: 'date',
    icon: <CalendarClock size={18} />,
    fr: 'Échéance',
    ar: 'تاريخ الانتهاء',
    hintFr: "Compte à rebours en jours via une date d'expiration (assurance, vignette…).",
    hintAr: 'العد التنازلي بالأيام عبر تاريخ الانتهاء.',
  },
  {
    value: 'simple',
    icon: <Receipt size={18} />,
    fr: 'Simple',
    ar: 'بسيط',
    hintFr: 'Dépense ponctuelle, sans échéance à surveiller (lavage, péage…).',
    hintAr: 'نفقة عادية بدون تاريخ استحقاق.',
  },
];

export const MaintenanceTypeModal: React.FC<MaintenanceTypeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  type = null,
  existingKeys = [],
  saving = false,
  error = null,
  lang,
}) => {
  const isEditing = !!type?.id && !type.id.startsWith('system-');
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const [labelFr, setLabelFr] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [icon, setIcon] = useState('🔧');
  const [tracking, setTracking] = useState<MaintenanceTracking>('mileage');
  const [intervalKm, setIntervalKm] = useState(10000);
  const [intervalDays, setIntervalDays] = useState(365);
  const [color, setColor] = useState<MaintenanceColor>('purple');

  useEffect(() => {
    if (!isOpen) return;
    if (type) {
      setLabelFr(type.labelFr || '');
      setLabelAr(type.labelAr || '');
      setIcon(type.icon || '🔧');
      setTracking(type.tracking);
      setIntervalKm(type.defaultIntervalKm ?? 10000);
      setIntervalDays(type.defaultIntervalDays ?? 365);
      setColor(type.color);
    } else {
      setLabelFr('');
      setLabelAr('');
      setIcon('🔧');
      setTracking('mileage');
      setIntervalKm(10000);
      setIntervalDays(365);
      setColor('purple');
    }
  }, [type, isOpen]);

  const nextKey = useMemo(() => slugifyKey(labelFr), [labelFr]);
  const duplicate = !isEditing && !!labelFr.trim() && existingKeys.includes(nextKey);
  const palette = paletteOf(color);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelFr.trim()) return;
    await onSave({
      id: type?.id,
      labelFr: labelFr.trim(),
      labelAr: labelAr.trim() || labelFr.trim(),
      icon,
      tracking,
      defaultIntervalKm: tracking === 'mileage' ? Number(intervalKm) || 10000 : null,
      defaultIntervalDays: tracking === 'date' ? Number(intervalDays) || 365 : null,
      color,
    });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overscroll-contain">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-saas-border max-h-[92vh] sm:max-h-[calc(100vh-6rem)]"
      >
        {/* En-tête */}
        <div className="px-6 py-5 bg-linear-to-r from-saas-secondary-start to-saas-secondary-end text-white flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl backdrop-blur-sm">
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">
                {isEditing ? T('Modifier le type', 'تعديل النوع') : T('Nouveau type de dépense', 'نوع نفقة جديد')}
              </h2>
              <p className="text-white/75 text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5">
                {T('Maintenance véhicule', 'صيانة المركبة')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-saas-bg">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm font-semibold text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* Nom */}
          <section className="bg-white rounded-2xl border border-saas-border p-5 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
              {T('Identité', 'الهوية')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-saas">{T('Nom (français) *', 'الاسم (بالفرنسية) *')}</label>
                <input
                  value={labelFr}
                  onChange={e => setLabelFr(e.target.value)}
                  placeholder={T('ex : Bougies', 'مثال: شمعات الإشعال')}
                  className="input-saas"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="label-saas">{T('Nom (arabe)', 'الاسم (بالعربية)')}</label>
                <input
                  value={labelAr}
                  onChange={e => setLabelAr(e.target.value)}
                  placeholder={T('اختياري', 'شمعات الإشعال')}
                  dir="rtl"
                  className="input-saas"
                />
              </div>
            </div>
            {duplicate && (
              <p className="text-xs font-semibold text-amber-600">
                ⚠️ {T(
                  'Un type portant ce nom existe déjà — une clé unique sera générée.',
                  'يوجد نوع بنفس الاسم — سيتم إنشاء مفتاح فريد.'
                )}
              </p>
            )}
          </section>

          {/* Icône */}
          <section className="bg-white rounded-2xl border border-saas-border p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
              {T('Icône', 'الأيقونة')}
            </p>
            <div className="grid grid-cols-8 sm:grid-cols-11 gap-2">
              {TYPE_ICON_CHOICES.map(choice => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setIcon(choice)}
                  className={`aspect-square rounded-xl text-lg flex items-center justify-center border-2 transition-all cursor-pointer ${
                    icon === choice
                      ? 'border-saas-primary-via bg-saas-primary-via/10 scale-105'
                      : 'border-saas-border bg-saas-bg hover:border-saas-primary-via/40'
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
          </section>

          {/* Mode de suivi */}
          <section className="bg-white rounded-2xl border border-saas-border p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
              {T('Mode de suivi', 'طريقة المتابعة')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TRACKING_CHOICES.map(choice => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => setTracking(choice.value)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    tracking === choice.value
                      ? 'border-saas-primary-via bg-saas-primary-via/5 shadow-sm'
                      : 'border-saas-border bg-saas-bg hover:border-saas-primary-via/40'
                  }`}
                >
                  <div className={`flex items-center gap-2 font-black text-sm ${
                    tracking === choice.value ? 'text-saas-primary-via' : 'text-saas-text-main'
                  }`}>
                    {choice.icon}
                    {T(choice.fr, choice.ar)}
                  </div>
                  <p className="text-[11px] text-saas-text-muted mt-1.5 leading-snug">
                    {T(choice.hintFr, choice.hintAr)}
                  </p>
                </button>
              ))}
            </div>

            {tracking === 'mileage' && (
              <div className="pt-2">
                <label className="label-saas">{T('Intervalle par défaut (KM)', 'الفاصل الافتراضي (كم)')}</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={intervalKm || ''}
                  onChange={e => setIntervalKm(parseInt(e.target.value) || 0)}
                  className="input-saas font-bold"
                />
                <p className="text-[11px] text-saas-text-muted mt-1.5">
                  {T(
                    'Pré-rempli à la création d’une dépense de ce type. Modifiable à chaque saisie.',
                    'يُملأ تلقائياً عند إنشاء نفقة من هذا النوع.'
                  )}
                </p>
              </div>
            )}

            {tracking === 'date' && (
              <div className="pt-2">
                <label className="label-saas">{T('Validité par défaut (jours)', 'الصلاحية الافتراضية (أيام)')}</label>
                <input
                  type="number"
                  min={0}
                  value={intervalDays || ''}
                  onChange={e => setIntervalDays(parseInt(e.target.value) || 0)}
                  className="input-saas font-bold"
                />
              </div>
            )}
          </section>

          {/* Couleur */}
          <section className="bg-white rounded-2xl border border-saas-border p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
              {T('Couleur', 'اللون')}
            </p>
            <div className="flex flex-wrap gap-2.5">
              {MAINTENANCE_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: paletteOf(c).swatch }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  aria-label={c}
                >
                  {color === c && <Check size={16} />}
                </button>
              ))}
            </div>

            {/* Aperçu */}
            <div className={`mt-2 flex items-center justify-between gap-3 p-3.5 rounded-2xl border ${palette.bg} ${palette.border}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className={`text-sm font-black ${palette.text}`}>
                    {labelFr || T('Aperçu du type', 'معاينة النوع')}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
                    {tracking === 'mileage'
                      ? `${(Number(intervalKm) || 0).toLocaleString('fr-FR')} KM`
                      : tracking === 'date'
                      ? `${Number(intervalDays) || 0} ${T('jours', 'يوم')}`
                      : T('Sans échéance', 'بدون استحقاق')}
                  </p>
                </div>
              </div>
              <span className={`w-3 h-3 rounded-full ${palette.dot}`} />
            </div>
          </section>
        </form>

        {/* Pied */}
        <div className="p-5 border-t border-saas-border bg-white flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-saas-bg border border-saas-border hover:bg-white transition-colors text-saas-text-main cursor-pointer"
          >
            {T('Annuler', 'إلغاء')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !labelFr.trim()}
            className="flex-1 btn-saas-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isEditing ? T('Enregistrer', 'حفظ') : T('Créer le type', 'إنشاء النوع')}
          </button>
        </div>
      </motion.div>
      </div>
    </ModalPortal>
  );
};
