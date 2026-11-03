import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  X, Plus, Car as CarIcon, Gauge, CalendarDays, Wallet, Flag,
  StickyNote, Loader2, Filter as FilterIcon, ShieldAlert,
} from 'lucide-react';
import { VehicleExpense, Language, Car, MaintenanceType, MaintenanceTracking } from '../types';
import { findType, paletteOf, typeLabel } from '../services/maintenanceTypeService';
import { ModalPortal } from './ui/ModalPortal';

interface VehicleExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<VehicleExpense>) => void;
  /**
   * Dépense à éditer OU simple gabarit de pré-remplissage.
   * C'est la présence d'un `id` qui fait la différence : sans `id`, on est
   * TOUJOURS en création, même si les champs arrivent pré-remplis.
   */
  expense?: Partial<VehicleExpense>;
  cars: Car[];
  /** Types disponibles (système + personnalisés). */
  types: MaintenanceType[];
  /**
   * Ouvre le formulaire de création d'un type sans quitter la saisie.
   * Renvoie la clé du type créé pour qu'il soit sélectionné immédiatement.
   */
  onRequestNewType?: () => void;
  /** Clé du type fraîchement créé, à sélectionner automatiquement. */
  pendingTypeKey?: string | null;
  /** Verrouille le véhicule (ouverture depuis la fiche d'un véhicule). */
  lockedCarId?: string;
  saving?: boolean;
  lang: Language;
}

const FILTERS: { name: 'oilFilterChanged' | 'airFilterChanged' | 'fuelFilterChanged' | 'acFilterChanged'; icon: string; fr: string; ar: string }[] = [
  { name: 'oilFilterChanged',  icon: '🛢️', fr: 'Filtre à huile',      ar: 'فلتر الزيت' },
  { name: 'airFilterChanged',  icon: '💨', fr: 'Filtre à air',         ar: 'فلتر الهواء' },
  { name: 'fuelFilterChanged', icon: '⛽', fr: 'Filtre à carburant',   ar: 'فلتر الوقود' },
  { name: 'acFilterChanged',   icon: '❄️', fr: 'Filtre climatisation', ar: 'فلتر التكييف' },
];

const today = () => new Date().toISOString().split('T')[0];

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr || today());
  d.setDate(d.getDate() + (days || 0));
  return d.toISOString().split('T')[0];
};

export const VehicleExpenseModal: React.FC<VehicleExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  expense,
  cars,
  types,
  onRequestNewType,
  pendingTypeKey,
  lockedCarId,
  saving = false,
  lang,
}) => {
  // Édition uniquement si la dépense existe déjà en base (elle porte un id).
  const isEditing = !!expense?.id;
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const activeTypes = useMemo(
    () => types.filter(t => t.isActive !== false),
    [types]
  );

  const [formData, setFormData] = useState({
    carId: '',
    type: 'vidange' as string,
    cost: 0,
    date: today(),
    note: '',
    currentMileage: 0,
    /** Intervalle avant la prochaine échéance (en km). */
    nextVidangeKm: 0,
    /** Kilométrage absolu de la prochaine échéance. */
    prochainKm: 0,
    expenseName: '',
    expirationDate: '',
    oilFilterChanged: false,
    airFilterChanged: false,
    fuelFilterChanged: false,
    acFilterChanged: false,
  });

  const selectedType = findType(activeTypes.length ? activeTypes : types, formData.type);
  const palette = paletteOf(selectedType.color);
  const tracking: MaintenanceTracking = selectedType.tracking;
  const selectedCar = cars.find(c => c.id === formData.carId);

  useEffect(() => {
    if (!isOpen) return;

    const fallbackType = activeTypes[0]?.key || 'autre';
    if (expense) {
      const typeKey = (expense.type as string) || fallbackType;
      const def = findType(types, typeKey);
      const interval = expense.nextVidangeKm ?? (def.tracking === 'mileage' ? def.defaultIntervalKm ?? 10000 : 0);
      const mileage = expense.currentMileage ?? 0;
      setFormData({
        carId: expense.carId || lockedCarId || (cars.length > 0 ? cars[0].id : ''),
        type: typeKey,
        cost: expense.cost ?? 0,
        date: expense.date || today(),
        note: expense.note || '',
        currentMileage: mileage,
        nextVidangeKm: interval || 0,
        prochainKm: mileage + (interval || 0),
        expenseName: expense.expenseName || '',
        expirationDate: expense.expirationDate || '',
        oilFilterChanged: !!expense.oilFilterChanged,
        airFilterChanged: !!expense.airFilterChanged,
        fuelFilterChanged: !!expense.fuelFilterChanged,
        acFilterChanged: !!expense.acFilterChanged,
      });
    } else {
      const car = cars.find(c => c.id === lockedCarId) || cars[0] || null;
      const def = findType(types, fallbackType);
      const mileage = car?.mileage || 0;
      const interval = def.tracking === 'mileage' ? def.defaultIntervalKm ?? 10000 : 0;
      setFormData({
        carId: car?.id || '',
        type: fallbackType,
        cost: 0,
        date: today(),
        note: '',
        currentMileage: mileage,
        nextVidangeKm: interval,
        prochainKm: mileage + interval,
        expenseName: '',
        expirationDate: def.tracking === 'date' ? addDays(today(), def.defaultIntervalDays ?? 365) : '',
        oilFilterChanged: false,
        airFilterChanged: false,
        fuelFilterChanged: false,
        acFilterChanged: false,
      });
    }
    // `types` est volontairement hors dépendances : un rechargement de la liste
    // ne doit pas réinitialiser une saisie en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, isOpen, cars, lockedCarId]);

  /** Sélection automatique du type qui vient d'être créé depuis ce formulaire. */
  useEffect(() => {
    if (!pendingTypeKey) return;
    const created = types.find(t => t.key === pendingTypeKey);
    if (created) selectType(created);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTypeKey, types]);

  const selectType = (type: MaintenanceType) => {
    setFormData(prev => {
      const interval =
        type.tracking === 'mileage'
          ? (prev.nextVidangeKm && findType(types, prev.type).tracking === 'mileage'
              ? prev.nextVidangeKm
              : type.defaultIntervalKm ?? 10000)
          : 0;
      const mileage = prev.currentMileage || selectedCar?.mileage || 0;
      return {
        ...prev,
        type: type.key,
        nextVidangeKm: interval,
        currentMileage: mileage,
        prochainKm: mileage + interval,
        expirationDate:
          type.tracking === 'date'
            ? prev.expirationDate || addDays(prev.date, type.defaultIntervalDays ?? 365)
            : prev.expirationDate,
      };
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type: inputType } = e.target;

    if (inputType === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: target.checked }));
      return;
    }

    const numeric = ['cost', 'currentMileage', 'nextVidangeKm', 'prochainKm'].includes(name);
    const numValue = numeric ? parseInt(value) || 0 : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: numValue } as typeof prev;

      // Calcul bidirectionnel : kilométrage actuel ⇄ intervalle ⇄ prochain.
      if (tracking === 'mileage' && numeric) {
        if (name === 'nextVidangeKm') {
          updated.prochainKm = updated.currentMileage + (numValue as number);
        } else if (name === 'prochainKm') {
          updated.nextVidangeKm = (numValue as number) - updated.currentMileage;
        } else if (name === 'currentMileage') {
          updated.prochainKm = (numValue as number) + updated.nextVidangeKm;
        }
      }

      return updated;
    });
  };

  const handleCarChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const carId = e.target.value;
    const car = cars.find(c => c.id === carId);
    const mileage = car?.mileage || 0;
    setFormData(prev => ({
      ...prev,
      carId,
      currentMileage: mileage,
      prochainKm: mileage + prev.nextVidangeKm,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.carId) return;

    const submitData: Partial<VehicleExpense> = {
      carId: formData.carId,
      type: formData.type,
      cost: formData.cost,
      date: formData.date,
      note: formData.note || undefined,
    };

    if (tracking === 'mileage') {
      submitData.currentMileage = formData.currentMileage;
      submitData.nextVidangeKm = formData.nextVidangeKm;
    } else if (tracking === 'date') {
      submitData.expirationDate = formData.expirationDate || undefined;
    }

    // Le libellé libre reste utile pour tous les types sans échéance.
    if (formData.expenseName) submitData.expenseName = formData.expenseName;

    if (formData.type === 'vidange') {
      submitData.oilFilterChanged = formData.oilFilterChanged;
      submitData.airFilterChanged = formData.airFilterChanged;
      submitData.fuelFilterChanged = formData.fuelFilterChanged;
      submitData.acFilterChanged = formData.acFilterChanged;
    }

    onSave(submitData);
  };

  if (!isOpen) return null;

  const kmRemaining = formData.prochainKm - (selectedCar?.mileage ?? formData.currentMileage);
  const daysRemaining = formData.expirationDate
    ? Math.ceil((new Date(formData.expirationDate).getTime() - new Date(today()).getTime()) / 86400000)
    : null;

  return (
    <ModalPortal>
      {/* Centrée dans le viewport : la fenêtre s'ouvre là où l'utilisateur se
          trouve, quel que soit le défilement de la page en arrière-plan. */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overscroll-contain">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-saas-border max-h-[92vh] sm:max-h-[calc(100vh-6rem)]"
      >
        {/* ── En-tête ───────────────────────────────────────────────── */}
        <div className="px-6 py-5 bg-linear-to-r from-saas-primary-start via-saas-primary-via to-saas-primary-end text-white flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl">
              {selectedType.icon}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                {isEditing ? T('Modifier la dépense', 'تعديل النفقة') : T('Nouvelle dépense', 'نفقة جديدة')}
              </h2>
              <p className="text-white/75 text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5">
                {typeLabel(selectedType, lang)}
                {selectedCar ? ` · ${selectedCar.brand} ${selectedCar.model}` : ''}
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-5 bg-saas-bg">
          {/* ── Véhicule ────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-saas-border p-5 space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
              <CarIcon size={13} /> {T('Véhicule', 'المركبة')}
            </div>
            <select
              name="carId"
              value={formData.carId}
              onChange={handleCarChange}
              className="input-saas font-semibold disabled:opacity-70"
              disabled={!!lockedCarId}
              required
            >
              <option value="">{T('Sélectionner un véhicule', 'اختر مركبة')}</option>
              {cars.map(car => (
                <option key={car.id} value={car.id}>
                  {car.brand} {car.model} — {car.registration}
                </option>
              ))}
            </select>
            {selectedCar && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-saas-bg border border-saas-border">
                <span className="text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
                  {T('Kilométrage au compteur', 'عداد المسافة')}
                </span>
                <span className="text-base font-black text-saas-text-main">
                  {(selectedCar.mileage || 0).toLocaleString('fr-FR')} KM
                </span>
              </div>
            )}
          </section>

          {/* ── Type de dépense ─────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-saas-border p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
                <FilterIcon size={13} /> {T('Type de dépense', 'نوع النفقة')}
              </div>
              {onRequestNewType && (
                <button
                  type="button"
                  onClick={onRequestNewType}
                  className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-saas-secondary-start hover:text-saas-secondary-end transition-colors cursor-pointer"
                >
                  <Plus size={14} /> {T('Nouveau type', 'نوع جديد')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {activeTypes.map(type => {
                const p = paletteOf(type.color);
                const active = formData.type === type.key;
                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => selectType(type)}
                    className={`px-3 py-3 rounded-2xl border-2 transition-all flex items-center gap-2.5 text-left cursor-pointer ${
                      active
                        ? `${p.bg} ${p.border} shadow-sm ring-2 ${p.ring}`
                        : 'bg-saas-bg border-saas-border hover:border-vel-border-strong'
                    }`}
                  >
                    <span className="text-xl shrink-0">{type.icon}</span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-black leading-tight truncate ${active ? p.text : 'text-saas-text-main'}`}>
                        {typeLabel(type, lang)}
                      </span>
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-saas-text-muted">
                        {type.tracking === 'mileage'
                          ? T('Suivi KM', 'متابعة كم')
                          : type.tracking === 'date'
                          ? T('Échéance', 'استحقاق')
                          : T('Simple', 'بسيط')}
                      </span>
                    </span>
                  </button>
                );
              })}

              {onRequestNewType && (
                <button
                  type="button"
                  onClick={onRequestNewType}
                  className="px-3 py-3 rounded-2xl border-2 border-dashed border-saas-border hover:border-saas-primary-via hover:bg-saas-primary-via/5 transition-all flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-lg bg-saas-primary-via/10 text-saas-primary-via flex items-center justify-center shrink-0">
                    <Plus size={16} />
                  </span>
                  <span className="text-xs font-black text-saas-text-muted leading-tight">
                    {T('Créer un type', 'إنشاء نوع')}
                  </span>
                </button>
              )}
            </div>
          </section>

          {/* ── Montant & date (commun à tous les types) ────────────── */}
          <section className="bg-white rounded-2xl border border-saas-border p-5 space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
              <Wallet size={13} /> {T('Montant et date', 'المبلغ والتاريخ')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-saas">💵 {T('Coût (DZD)', 'التكلفة (دينار)')}</label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost || ''}
                  onChange={handleChange}
                  placeholder="0"
                  className="input-saas text-lg font-black"
                  min="0"
                />
              </div>
              <div>
                <label className="label-saas">📅 {T('Date', 'التاريخ')}</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="input-saas font-semibold"
                  required
                />
              </div>
            </div>

            {tracking === 'simple' && (
              <div>
                <label className="label-saas">📝 {T('Nom de la dépense', 'اسم النفقة')}</label>
                <input
                  type="text"
                  name="expenseName"
                  value={formData.expenseName}
                  onChange={handleChange}
                  placeholder={T('ex : Réparation pneu', 'مثال: إصلاح الإطار')}
                  className="input-saas"
                  required={formData.type === 'autre'}
                />
              </div>
            )}
          </section>

          {/* ── Suivi kilométrique ──────────────────────────────────── */}
          {tracking === 'mileage' && (
            <section className={`rounded-2xl border p-5 space-y-4 ${palette.bg} ${palette.border}`}>
              <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${palette.text}`}>
                <Gauge size={13} /> {T('Suivi kilométrique', 'المتابعة بالكيلومترات')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-saas">🚗 {T('Kilométrage actuel', 'المسافة الحالية')}</label>
                  <input
                    type="number"
                    name="currentMileage"
                    value={formData.currentMileage || ''}
                    onChange={handleChange}
                    placeholder="0"
                    className="input-saas font-bold"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="label-saas">↩️ {T('Intervalle (KM)', 'الفاصل (كم)')}</label>
                  <input
                    type="number"
                    name="nextVidangeKm"
                    value={formData.nextVidangeKm || ''}
                    onChange={handleChange}
                    placeholder="0"
                    className="input-saas font-bold"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label-saas">🏁 {T('Prochaine échéance', 'الاستحقاق القادم')}</label>
                  <input
                    type="number"
                    name="prochainKm"
                    value={formData.prochainKm || ''}
                    onChange={handleChange}
                    placeholder="0"
                    className="input-saas font-black"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-saas-border">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
                  <Flag size={13} /> {T('Restant après cette intervention', 'المتبقي بعد هذه العملية')}
                </span>
                <span className={`text-base font-black ${
                  kmRemaining <= 0 ? 'text-red-600' : kmRemaining <= 2000 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {kmRemaining.toLocaleString('fr-FR')} KM
                </span>
              </div>

              {/* Filtres : spécifique à la vidange */}
              {formData.type === 'vidange' && (
                <div className="bg-white rounded-xl border border-saas-border p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
                    🔧 {T('Filtres changés', 'الفلاتر المتغيرة')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FILTERS.map(f => (
                      <label
                        key={f.name}
                        htmlFor={f.name}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                          formData[f.name]
                            ? 'bg-green-50 border-green-200'
                            : 'bg-saas-bg border-saas-border hover:border-vel-border-strong'
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={f.name}
                          name={f.name}
                          checked={formData[f.name]}
                          onChange={handleChange}
                          className="w-4 h-4 rounded cursor-pointer accent-green-600"
                        />
                        <span className="text-base">{f.icon}</span>
                        <span className={`text-xs font-bold ${formData[f.name] ? 'text-green-700' : 'text-saas-text-main'}`}>
                          {T(f.fr, f.ar)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Suivi par échéance ──────────────────────────────────── */}
          {tracking === 'date' && (
            <section className={`rounded-2xl border p-5 space-y-4 ${palette.bg} ${palette.border}`}>
              <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${palette.text}`}>
                <CalendarDays size={13} /> {T("Date d'expiration", 'تاريخ الانتهاء')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="label-saas">{selectedType.icon} {T("Expire le", 'ينتهي في')}</label>
                  <input
                    type="date"
                    name="expirationDate"
                    value={formData.expirationDate}
                    onChange={handleChange}
                    className="input-saas font-semibold"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-saas-border">
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
                    <ShieldAlert size={13} /> {T('Validité', 'الصلاحية')}
                  </span>
                  <span className={`text-base font-black ${
                    daysRemaining === null ? 'text-saas-text-muted'
                      : daysRemaining < 0 ? 'text-red-600'
                      : daysRemaining <= 30 ? 'text-amber-600'
                      : 'text-green-600'
                  }`}>
                    {daysRemaining === null
                      ? '—'
                      : `${daysRemaining} ${T('jours', 'يوم')}`}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* ── Note ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-saas-border p-5 space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
              <StickyNote size={13} /> {T('Note (optionnel)', 'ملاحظة (اختياري)')}
            </div>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder={T('Détails supplémentaires…', 'تفاصيل إضافية…')}
              className="input-saas resize-none"
              rows={3}
            />
          </section>
        </form>

        {/* ── Pied ──────────────────────────────────────────────────── */}
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
            disabled={saving || !formData.carId}
            className="flex-1 btn-saas-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isEditing ? T('Enregistrer', 'حفظ') : T('Ajouter la dépense', 'إضافة النفقة')}
          </button>
        </div>
      </motion.div>
      </div>
    </ModalPortal>
  );
};
