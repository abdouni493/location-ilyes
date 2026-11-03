import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Plus, Upload, Trash2, ImageOff, ShieldCheck, Wrench, Sparkles } from 'lucide-react';
import { Language } from '../types';

/* ══════════════════════════════════════════════════════════════════════════
   COMPOSANTS D'INSPECTION PARTAGÉS
   Une seule implémentation de la check-list et des zones photo, réutilisée à
   l'identique par : l'étape « Inspection Départ » de la création de
   réservation, la fenêtre « Activer la location » et « Terminer la location ».
   ══════════════════════════════════════════════════════════════════════════ */

export interface ChecklistItemLike {
  id: string;
  /** Libellé (formes DB et applicatives tolérées). */
  item_name?: string;
  name?: string;
  /** 'securite' | 'equipements' | 'confort' (DB) ou 'security' | 'equipment' | 'comfort' | 'cleanliness'. */
  category: string;
}

export const CATEGORY_META = (lang: Language) => ([
  {
    key: 'securite',
    aliases: ['securite', 'security'],
    title: lang === 'fr' ? 'Sécurité' : 'الأمان',
    icon: <ShieldCheck className="w-4 h-4" />,
    accent: '#DC2626',
  },
  {
    key: 'equipements',
    aliases: ['equipements', 'equipment'],
    title: lang === 'fr' ? 'Équipements' : 'المعدات',
    icon: <Wrench className="w-4 h-4" />,
    accent: '#0284C7',
  },
  {
    key: 'confort',
    aliases: ['confort', 'comfort', 'cleanliness'],
    title: lang === 'fr' ? 'Confort & Propreté' : 'الراحة والنظافة',
    icon: <Sparkles className="w-4 h-4" />,
    accent: '#0F172A',
  },
]);

const labelOf = (item: ChecklistItemLike) => item.item_name || item.name || '';

/**
 * Check-list d'inspection — LE rendu de référence.
 * `readOnly` fige les états (consultation), `onDeleteItem` n'apparaît que là
 * où la suppression d'un élément du référentiel est autorisée.
 */
export const InspectionChecklist: React.FC<{
  lang: Language;
  items: ChecklistItemLike[];
  responses: Record<string, boolean>;
  onToggle?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  readOnly?: boolean;
  /** Bandeau de titre au-dessus des catégories. */
  title?: string;
  /** Rendu compact (fenêtres modales). */
  compact?: boolean;
}> = ({ lang, items, responses, onToggle, onDeleteItem, readOnly = false, title, compact = false }) => {
  const categories = CATEGORY_META(lang);

  const grouped = categories.map(cat => ({
    ...cat,
    items: items.filter(i => cat.aliases.includes(String(i.category || '').toLowerCase())),
  })).filter(c => c.items.length > 0);

  const total = items.length;
  const checked = items.filter(i => responses[i.id]).length;
  const ratio = total > 0 ? Math.round((checked / total) * 100) : 0;

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-saas-border bg-saas-bg p-8 text-center">
        <p className="text-sm font-semibold text-saas-text-muted">
          {lang === 'fr' ? 'Aucun élément de contrôle disponible.' : 'لا توجد عناصر فحص متاحة.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barre de progression globale */}
      <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h4 className="font-black uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center">
              <Check className="w-4 h-4" />
            </span>
            {title || (lang === 'fr' ? "Contrôle d'état du véhicule" : 'فحص حالة المركبة')}
          </h4>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-saas-text-muted">
              {checked}/{total} {lang === 'fr' ? 'validés' : 'مؤكد'}
            </span>
            <span className={`px-3 py-1 rounded-lg text-xs font-black ${
              ratio === 100 ? 'bg-emerald-100 text-emerald-700'
                : ratio >= 50 ? 'bg-[#0284C7]/10 text-[#0284C7]'
                : 'bg-[#DC2626]/10 text-[#DC2626]'
            }`}>
              {ratio}%
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-saas-bg">
          <motion.div
            className="h-full bg-linear-to-r from-[#DC2626] to-[#0284C7]"
            initial={{ width: 0 }}
            animate={{ width: `${ratio}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Catégories */}
      {grouped.map(cat => {
        const catChecked = cat.items.filter(i => responses[i.id]).length;
        return (
          <div key={cat.key} className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-saas-border bg-saas-bg">
              <h5 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                  style={{ background: cat.accent }}
                >
                  {cat.icon}
                </span>
                {cat.title}
              </h5>
              <span className="text-[11px] font-black text-saas-text-muted">
                {catChecked}/{cat.items.length}
              </span>
            </div>

            <div className={`grid gap-2.5 p-4 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
              {cat.items.map(item => {
                const ok = !!responses[item.id];
                return (
                  <motion.div
                    key={item.id}
                    layout
                    onClick={() => !readOnly && onToggle?.(item.id)}
                    className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 transition-all ${
                      readOnly ? '' : 'cursor-pointer'
                    } ${
                      ok
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-saas-border bg-saas-bg hover:border-[#DC2626]/40'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                        ok ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {ok ? (
                          <motion.span
                            key="on"
                            initial={{ scale: 0, rotate: -60 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.18 }}
                          >
                            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="off"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.18 }}
                          >
                            <X className="w-3 h-3 text-slate-400" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>

                    <span className={`flex-1 text-sm font-bold leading-snug ${ok ? 'text-emerald-800' : 'text-saas-text-main'}`}>
                      {labelOf(item)}
                    </span>

                    {onDeleteItem && !readOnly && (
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteItem(item.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-saas-text-muted hover:text-[#DC2626] hover:bg-white transition-all cursor-pointer"
                        title={lang === 'fr' ? 'Supprimer cet élément' : 'حذف هذا العنصر'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Ajout d'un élément personnalisé au référentiel de la check-list. */
export const ChecklistItemComposer: React.FC<{
  lang: Language;
  category: string;
  onCategoryChange: (category: string) => void;
  value: string;
  onValueChange: (value: string) => void;
  onAdd: () => void;
  busy?: boolean;
}> = ({ lang, category, onCategoryChange, value, onValueChange, onAdd, busy }) => (
  <div className="flex flex-col sm:flex-row gap-2.5 p-4 rounded-2xl border border-dashed border-saas-border bg-saas-bg">
    <select
      value={category}
      onChange={e => onCategoryChange(e.target.value)}
      className="input-saas sm:w-56 cursor-pointer"
    >
      <option value="securite">🛡️ {lang === 'fr' ? 'Sécurité' : 'الأمان'}</option>
      <option value="equipements">🔧 {lang === 'fr' ? 'Équipements' : 'المعدات'}</option>
      <option value="confort">✨ {lang === 'fr' ? 'Confort' : 'الراحة'}</option>
    </select>
    <input
      type="text"
      value={value}
      onChange={e => onValueChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
      placeholder={lang === 'fr' ? 'Ajouter un élément de contrôle…' : 'إضافة عنصر فحص…'}
      className="input-saas flex-1"
    />
    <button
      onClick={onAdd}
      disabled={busy || !value.trim()}
      className="btn-vel-cta px-6 py-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Plus className="w-4 h-4" />
      {lang === 'fr' ? 'Ajouter' : 'إضافة'}
    </button>
  </div>
);

export interface InspectionPhoto {
  url: string;
  type: string;
  file?: File;
}

export const PHOTO_SLOTS = (lang: Language) => ([
  { type: 'exterior_front', label: lang === 'fr' ? 'Extérieur avant' : 'الخارج الأمامي', icon: '🚙' },
  { type: 'exterior_rear', label: lang === 'fr' ? 'Extérieur arrière' : 'الخارج الخلفي', icon: '🚘' },
  { type: 'interior', label: lang === 'fr' ? 'Intérieur' : 'الداخل', icon: '💺' },
  { type: 'other', label: lang === 'fr' ? 'Autres / détails' : 'أخرى', icon: '📷' },
]);

/** Résout un chemin de stockage en URL absolue affichable. */
export const resolvePhotoUrl = (u?: string): string | undefined => {
  if (!u) return u;
  if (u.startsWith('http') || u.startsWith('data:')) return u;
  const base = import.meta.env.VITE_SUPABASE_URL || '';
  if (!base) return u;
  if (u.startsWith('/')) return `${base}${u}`;
  if (u.includes('/storage/v1')) return `${base}${u}`;
  if (u.includes('inspection')) return `${base}/storage/v1/object/public/${u.replace(/^\/+/, '')}`;
  return `${base}/storage/v1/object/public/inspection/${u}`;
};

/**
 * Zones de dépôt des photos d'inspection : une carte par angle de prise de vue,
 * la vignette remplace la zone dès qu'une photo est chargée.
 */
export const InspectionPhotoUploader: React.FC<{
  lang: Language;
  photos: InspectionPhoto[];
  onUpload: (file: File, type: string) => void | Promise<void>;
  onRemove: (index: number) => void;
  uploadingType?: string | null;
  readOnly?: boolean;
  title?: string;
}> = ({ lang, photos, onUpload, onRemove, uploadingType, readOnly = false, title }) => {
  const slots = PHOTO_SLOTS(lang);

  return (
    <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-saas-border bg-saas-bg flex items-center justify-between">
        <h4 className="font-black uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center">
            <Upload className="w-4 h-4" />
          </span>
          {title || (lang === 'fr' ? "Photos d'état" : 'صور الحالة')}
        </h4>
        <span className="text-xs font-bold text-saas-text-muted">
          {photos.length} {lang === 'fr' ? 'photo(s)' : 'صورة'}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {!readOnly && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {slots.map(slot => {
              const busy = uploadingType === slot.type;
              const count = photos.filter(p => p.type === slot.type).length;
              return (
                <label
                  key={slot.type}
                  className={`group relative aspect-4/3 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden ${
                    busy
                      ? 'border-[#0284C7] bg-[#0284C7]/5 cursor-wait'
                      : 'border-saas-border bg-saas-bg hover:border-[#DC2626] hover:bg-[#DC2626]/5 cursor-pointer'
                  }`}
                >
                  <span className="text-2xl transition-transform group-hover:scale-110">{slot.icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-saas-text-muted text-center px-2 leading-tight group-hover:text-[#DC2626] transition-colors">
                    {slot.label}
                  </span>
                  {count > 0 && (
                    <span className="absolute top-2 right-2 min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
                      {count}
                    </span>
                  )}
                  {busy && (
                    <motion.span
                      className="absolute inset-x-0 bottom-0 h-1 bg-[#0284C7]"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ transformOrigin: 'left' }}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) onUpload(file, slot.type);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              );
            })}
          </div>
        )}

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimatePresence initial={false}>
              {photos.map((photo, index) => {
                const slot = slots.find(s => s.type === photo.type);
                return (
                  <motion.div
                    key={`${photo.url}-${index}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="group relative aspect-4/3 rounded-2xl overflow-hidden border border-saas-border bg-saas-bg"
                  >
                    <img
                      src={resolvePhotoUrl(photo.url)}
                      alt={slot?.label || `Photo ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/70 to-transparent text-white text-[10px] font-black uppercase tracking-wider px-3 py-2">
                      {slot?.label || photo.type}
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => onRemove(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#DC2626] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer"
                        title={lang === 'fr' ? 'Retirer' : 'إزالة'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          readOnly && (
            <div className="py-10 text-center text-saas-text-muted">
              <ImageOff className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">
                {lang === 'fr' ? 'Aucune photo enregistrée.' : 'لا توجد صور محفوظة.'}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

/** Sélecteur de niveau de carburant, style commun aux trois écrans. */
export const FUEL_LEVELS: { value: 'full' | 'half' | 'quarter' | 'eighth' | 'empty'; label: string }[] = [
  { value: 'full', label: 'PLEIN' },
  { value: 'half', label: '1/2' },
  { value: 'quarter', label: '1/4' },
  { value: 'eighth', label: '1/8' },
  { value: 'empty', label: 'VIDE' },
];

/** Ordre décroissant : sert à comparer départ/retour (index plus grand = moins plein). */
export const FUEL_ORDER = ['full', 'half', 'quarter', 'eighth', 'empty'] as const;

export const fuelLabel = (level?: string) =>
  FUEL_LEVELS.find(l => l.value === level)?.label || '—';

export const FuelLevelPicker: React.FC<{
  value: string;
  onChange: (value: any) => void;
  disabled?: boolean;
  accent?: string;
}> = ({ value, onChange, disabled = false, accent = '#DC2626' }) => (
  <div className="grid grid-cols-5 gap-2">
    {FUEL_LEVELS.map(level => {
      const active = value === level.value;
      return (
        <button
          key={level.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(level.value)}
          className={`py-2.5 px-1 rounded-xl border-2 text-xs font-black transition-all ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${active ? 'text-white shadow-md' : 'border-saas-border bg-white text-saas-text-main hover:border-saas-border-strong'}`}
          style={active ? { background: accent, borderColor: accent } : undefined}
        >
          {level.label}
        </button>
      );
    })}
  </div>
);
