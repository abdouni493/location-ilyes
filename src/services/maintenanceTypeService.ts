import { supabase } from '../supabase';
import { MaintenanceColor, MaintenanceTracking, MaintenanceType } from '../types';

/**
 * Types de maintenance / dépenses véhicule.
 *
 * Les cinq types historiques (vidange, chaîne, assurance, contrôle, autre) sont
 * livrés en base comme lignes « système » : ils ne sont ni supprimables ni
 * renommables sur leur clé. L'utilisateur peut en créer autant qu'il veut
 * (bougies, freins, pneus…) directement depuis la page Maintenance.
 *
 * Tant que la migration SQL n'est pas appliquée, on retombe sur la liste
 * intégrée ci-dessous : l'application continue de fonctionner exactement comme
 * avant, avec un bandeau invitant à exécuter le SQL.
 */

const TABLE = 'maintenance_types';

/** Liste de secours = ce que la migration SQL insère par défaut. */
export const DEFAULT_MAINTENANCE_TYPES: MaintenanceType[] = [
  {
    id: 'system-vidange', key: 'vidange',
    labelFr: 'Vidange', labelAr: 'تغيير الزيت', icon: '🛢️',
    tracking: 'mileage', defaultIntervalKm: 10000, defaultIntervalDays: null,
    color: 'amber', isSystem: true, isActive: true, sortOrder: 10,
  },
  {
    id: 'system-chaine', key: 'chaine',
    labelFr: 'Chaîne / Distribution', labelAr: 'السلسلة', icon: '⛓️',
    tracking: 'mileage', defaultIntervalKm: 60000, defaultIntervalDays: null,
    color: 'teal', isSystem: true, isActive: true, sortOrder: 20,
  },
  {
    id: 'system-bougies', key: 'bougies',
    labelFr: 'Bougies', labelAr: 'شمعات الإشعال', icon: '🔌',
    tracking: 'mileage', defaultIntervalKm: 30000, defaultIntervalDays: null,
    color: 'purple', isSystem: true, isActive: true, sortOrder: 30,
  },
  {
    id: 'system-assurance', key: 'assurance',
    labelFr: 'Assurance', labelAr: 'التأمين', icon: '🛡️',
    tracking: 'date', defaultIntervalKm: null, defaultIntervalDays: 365,
    color: 'blue', isSystem: true, isActive: true, sortOrder: 40,
  },
  {
    id: 'system-controle', key: 'controle',
    labelFr: 'Contrôle technique', labelAr: 'الفحص الفني', icon: '🛠️',
    tracking: 'date', defaultIntervalKm: null, defaultIntervalDays: 365,
    color: 'indigo', isSystem: true, isActive: true, sortOrder: 50,
  },
  {
    id: 'system-autre', key: 'autre',
    labelFr: 'Autre', labelAr: 'أخرى', icon: '❓',
    tracking: 'simple', defaultIntervalKm: null, defaultIntervalDays: null,
    color: 'slate', isSystem: true, isActive: true, sortOrder: 900,
  },
];

/** Emojis proposés dans le sélecteur du formulaire de type. */
export const TYPE_ICON_CHOICES = [
  '🛢️', '⛓️', '🔌', '🛡️', '🛠️', '🔧', '⚙️', '🧰',
  '🛞', '🚿', '❄️', '🔋', '💡', '🪛', '🧯', '🚗',
  '⛽', '🩹', '🪫', '📄', '🧼', '❓',
];

/**
 * Classes Tailwind par couleur. Écrites en dur : Tailwind ne peut pas générer
 * de classes construites dynamiquement (`bg-${color}-50` ne compile pas).
 */
export interface TypePalette {
  bg: string;
  bgSoft: string;
  border: string;
  text: string;
  textSoft: string;
  ring: string;
  dot: string;
  gradient: string;
  swatch: string;
}

export const TYPE_PALETTES: Record<MaintenanceColor, TypePalette> = {
  red:    { bg:'bg-red-50',    bgSoft:'bg-red-100/60',    border:'border-red-200',    text:'text-red-700',    textSoft:'text-red-600',    ring:'ring-red-500/30',    dot:'bg-red-500',    gradient:'from-red-500 to-red-600',       swatch:'#DC2626' },
  blue:   { bg:'bg-blue-50',   bgSoft:'bg-blue-100/60',   border:'border-blue-200',   text:'text-blue-700',   textSoft:'text-blue-600',   ring:'ring-blue-500/30',   dot:'bg-blue-500',   gradient:'from-sky-500 to-sky-600',       swatch:'#0284C7' },
  amber:  { bg:'bg-amber-50',  bgSoft:'bg-amber-100/60',  border:'border-amber-200',  text:'text-amber-700',  textSoft:'text-amber-600',  ring:'ring-amber-500/30',  dot:'bg-amber-500',  gradient:'from-amber-500 to-orange-500',  swatch:'#D97706' },
  green:  { bg:'bg-green-50',  bgSoft:'bg-green-100/60',  border:'border-green-200',  text:'text-green-700',  textSoft:'text-green-600',  ring:'ring-green-500/30',  dot:'bg-green-500',  gradient:'from-emerald-500 to-green-600', swatch:'#10B981' },
  purple: { bg:'bg-purple-50', bgSoft:'bg-purple-100/60', border:'border-purple-200', text:'text-purple-700', textSoft:'text-purple-600', ring:'ring-purple-500/30', dot:'bg-purple-500', gradient:'from-purple-500 to-violet-600', swatch:'#9333EA' },
  teal:   { bg:'bg-teal-50',   bgSoft:'bg-teal-100/60',   border:'border-teal-200',   text:'text-teal-700',   textSoft:'text-teal-600',   ring:'ring-teal-500/30',   dot:'bg-teal-500',   gradient:'from-teal-500 to-cyan-600',     swatch:'#0D9488' },
  orange: { bg:'bg-orange-50', bgSoft:'bg-orange-100/60', border:'border-orange-200', text:'text-orange-700', textSoft:'text-orange-600', ring:'ring-orange-500/30', dot:'bg-orange-500', gradient:'from-orange-500 to-red-500',    swatch:'#EA580C' },
  indigo: { bg:'bg-indigo-50', bgSoft:'bg-indigo-100/60', border:'border-indigo-200', text:'text-indigo-700', textSoft:'text-indigo-600', ring:'ring-indigo-500/30', dot:'bg-indigo-500', gradient:'from-indigo-500 to-blue-600',   swatch:'#4F46E5' },
  pink:   { bg:'bg-pink-50',   bgSoft:'bg-pink-100/60',   border:'border-pink-200',   text:'text-pink-700',   textSoft:'text-pink-600',   ring:'ring-pink-500/30',   dot:'bg-pink-500',   gradient:'from-pink-500 to-rose-600',     swatch:'#DB2777' },
  slate:  { bg:'bg-slate-50',  bgSoft:'bg-slate-100/60',  border:'border-slate-200',  text:'text-slate-700',  textSoft:'text-slate-600',  ring:'ring-slate-500/30',  dot:'bg-slate-500',  gradient:'from-slate-500 to-slate-700',   swatch:'#475569' },
};

export const MAINTENANCE_COLORS = Object.keys(TYPE_PALETTES) as MaintenanceColor[];

export const paletteOf = (color?: string): TypePalette =>
  TYPE_PALETTES[(color as MaintenanceColor)] || TYPE_PALETTES.slate;

/** Libellé d'un type dans la langue courante. */
export const typeLabel = (type: MaintenanceType, lang: 'fr' | 'ar'): string =>
  (lang === 'ar' ? type.labelAr : type.labelFr) || type.labelFr || type.key;

/**
 * Type de secours pour une clé inconnue (dépense enregistrée avec un type
 * supprimé depuis). Évite tout crash d'affichage.
 */
export const unknownType = (key: string): MaintenanceType => ({
  id: `unknown-${key}`,
  key,
  labelFr: key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Autre',
  labelAr: key || 'أخرى',
  icon: '🔧',
  tracking: 'simple',
  defaultIntervalKm: null,
  defaultIntervalDays: null,
  color: 'slate',
  isSystem: false,
  isActive: false,
  sortOrder: 999,
});

/** Retrouve un type par clé, avec repli automatique. */
export const findType = (types: MaintenanceType[], key: string): MaintenanceType =>
  types.find(t => t.key === key) || unknownType(key);

/** Transforme un libellé libre en clé technique stable. */
export const slugifyKey = (label: string): string =>
  label
    // NFD sépare les lettres de leurs accents ; le filtre ASCII qui suit les
    // supprime, ce qui donne une clé technique stable (« Bougies » -> bougies).
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 40) || `type_${Date.now().toString(36)}`;

const mapRow = (row: any): MaintenanceType => ({
  id: row.id,
  key: row.key,
  labelFr: row.label_fr,
  labelAr: row.label_ar || row.label_fr,
  icon: row.icon || '🔧',
  tracking: (row.tracking || 'simple') as MaintenanceTracking,
  defaultIntervalKm: row.default_interval_km,
  defaultIntervalDays: row.default_interval_days,
  color: (row.color || 'slate') as MaintenanceColor,
  isSystem: !!row.is_system,
  isActive: row.is_active !== false,
  sortOrder: row.sort_order ?? 100,
});

/**
 * Charge la liste des types.
 * `usingFallback` = la table n'existe pas encore (migration SQL non exécutée).
 */
export async function getMaintenanceTypes(): Promise<{
  success: boolean;
  types: MaintenanceType[];
  usingFallback: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label_fr', { ascending: true });

    if (error) {
      console.warn('[maintenanceTypes] table indisponible, repli sur les types intégrés:', error.message);
      return { success: true, types: DEFAULT_MAINTENANCE_TYPES, usingFallback: true, error: error.message };
    }

    const types = (data || []).map(mapRow);
    if (types.length === 0) {
      return { success: true, types: DEFAULT_MAINTENANCE_TYPES, usingFallback: true };
    }

    return { success: true, types, usingFallback: false };
  } catch (err: any) {
    console.warn('[maintenanceTypes] erreur inattendue, repli sur les types intégrés:', err);
    return { success: true, types: DEFAULT_MAINTENANCE_TYPES, usingFallback: true, error: err?.message };
  }
}

export interface MaintenanceTypeInput {
  key?: string;
  labelFr: string;
  labelAr?: string;
  icon?: string;
  tracking: MaintenanceTracking;
  defaultIntervalKm?: number | null;
  defaultIntervalDays?: number | null;
  color?: MaintenanceColor;
  isActive?: boolean;
  sortOrder?: number;
}

export async function addMaintenanceType(
  input: MaintenanceTypeInput,
  existingKeys: string[] = []
): Promise<{ success: boolean; type?: MaintenanceType; error?: string }> {
  try {
    // Clé unique : on suffixe tant que la clé est déjà prise.
    let key = input.key || slugifyKey(input.labelFr);
    let n = 2;
    while (existingKeys.includes(key)) key = `${slugifyKey(input.labelFr)}_${n++}`;

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        key,
        label_fr: input.labelFr,
        label_ar: input.labelAr || input.labelFr,
        icon: input.icon || '🔧',
        tracking: input.tracking,
        default_interval_km: input.tracking === 'mileage' ? (input.defaultIntervalKm ?? 10000) : null,
        default_interval_days: input.tracking === 'date' ? (input.defaultIntervalDays ?? 365) : null,
        color: input.color || 'slate',
        is_system: false,
        is_active: input.isActive !== false,
        sort_order: input.sortOrder ?? 100,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, type: mapRow(data) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Échec de la création du type' };
  }
}

export async function updateMaintenanceType(
  id: string,
  updates: Partial<MaintenanceTypeInput>
): Promise<{ success: boolean; type?: MaintenanceType; error?: string }> {
  try {
    const payload: Record<string, any> = {};
    if (updates.labelFr !== undefined) payload.label_fr = updates.labelFr;
    if (updates.labelAr !== undefined) payload.label_ar = updates.labelAr;
    if (updates.icon !== undefined) payload.icon = updates.icon;
    if (updates.tracking !== undefined) payload.tracking = updates.tracking;
    if (updates.defaultIntervalKm !== undefined) payload.default_interval_km = updates.defaultIntervalKm;
    if (updates.defaultIntervalDays !== undefined) payload.default_interval_days = updates.defaultIntervalDays;
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, type: mapRow(data) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Échec de la mise à jour du type' };
  }
}

/**
 * Supprime un type personnalisé. Les dépenses déjà enregistrées avec ce type
 * restent en base : elles s'affichent alors via `unknownType()`.
 */
export async function deleteMaintenanceType(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('is_system', false);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Échec de la suppression du type' };
  }
}
