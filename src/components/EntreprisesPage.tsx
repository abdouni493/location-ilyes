import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Plus, Search, Pencil, Trash2, History, X, Loader2,
  FileText, Landmark, Hash, ReceiptText, Phone, Mail, MapPin, AlertTriangle,
} from 'lucide-react';
import { Language, Entreprise } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { usePermissions } from '../utils/permissions';

/* ══════════════════════════════════════════════════════════════════════════
   ENTREPRISES — clients société utilisés sur les contrats et les factures
   ══════════════════════════════════════════════════════════════════════════ */

const fmt = (n: number) => `${Math.round(n || 0).toLocaleString('fr-FR')} DA`;

// ─── Formulaire de création / édition ────────────────────────────────────
export const EntrepriseModal: React.FC<{
  lang: Language;
  entreprise?: Entreprise | null;
  onClose: () => void;
  onSaved: (entreprise: Entreprise) => void;
}> = ({ lang, entreprise, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: entreprise?.name || '',
    rc: entreprise?.rc || '',
    art: entreprise?.art || '',
    nis: entreprise?.nis || '',
    nif: entreprise?.nif || '',
    address: entreprise?.address || '',
    phone: entreprise?.phone || '',
    email: entreprise?.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields: { key: keyof typeof form; icon: React.ReactNode; label: string; placeholder: string }[] = [
    { key: 'name', icon: <Building2 className="w-4 h-4" />, label: lang === 'fr' ? "Nom de l'entreprise" : 'اسم الشركة', placeholder: lang === 'fr' ? "Nom de l'entreprise" : 'اسم الشركة' },
    { key: 'rc', icon: <FileText className="w-4 h-4" />, label: 'RC', placeholder: 'Ex: 12/00-0000000B19' },
    { key: 'art', icon: <Landmark className="w-4 h-4" />, label: 'ART', placeholder: 'Ex: 000000000' },
    { key: 'nis', icon: <Hash className="w-4 h-4" />, label: 'NIS', placeholder: 'Ex: 000000000000000' },
    { key: 'nif', icon: <ReceiptText className="w-4 h-4" />, label: 'NIF', placeholder: 'Ex: 000000000000000' },
    { key: 'address', icon: <MapPin className="w-4 h-4" />, label: lang === 'fr' ? 'Adresse' : 'العنوان', placeholder: lang === 'fr' ? 'Adresse complète' : 'العنوان الكامل' },
    { key: 'phone', icon: <Phone className="w-4 h-4" />, label: lang === 'fr' ? 'Téléphone' : 'الهاتف', placeholder: '+213 …' },
    { key: 'email', icon: <Mail className="w-4 h-4" />, label: 'Email', placeholder: 'contact@entreprise.dz' },
  ];

  const save = async () => {
    if (!form.name.trim()) {
      setError(lang === 'fr' ? "Le nom de l'entreprise est obligatoire." : 'اسم الشركة مطلوب.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = entreprise
        ? await DatabaseService.updateEntreprise(entreprise.id, form)
        : await DatabaseService.createEntreprise(form);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur inattendue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto sm:py-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-saas-border overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]"
      >
        <div className="px-8 py-6 bg-[#0F172A] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-[#DC2626] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-xl font-black tracking-tight">
                {entreprise
                  ? (lang === 'fr' ? "Modifier l'entreprise" : 'تعديل الشركة')
                  : (lang === 'fr' ? 'Nouvelle entreprise' : 'شركة جديدة')}
              </h3>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                {lang === 'fr' ? 'Client société' : 'عميل شركة'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-saas-bg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {fields.map(f => (
              <div key={f.key} className={f.key === 'name' || f.key === 'address' ? 'md:col-span-2' : ''}>
                <label className="flex items-center gap-2 text-xs font-bold text-saas-text-muted uppercase tracking-wider mb-2">
                  <span className="text-saas-primary-via">{f.icon}</span>
                  {f.label}
                  {f.key === 'name' && <span className="text-saas-primary-via">*</span>}
                </label>
                <input
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="input-saas"
                />
              </div>
            ))}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4"
            >
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </motion.div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-saas-border bg-white flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-saas-outline px-8 cursor-pointer" disabled={saving}>
            {lang === 'fr' ? 'Annuler' : 'إلغاء'}
          </button>
          <button onClick={save} disabled={saving} className="btn-saas-primary px-10 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {lang === 'fr' ? 'Enregistrer' : 'حفظ'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Historique d'une entreprise ─────────────────────────────────────────
const EntrepriseHistoryModal: React.FC<{
  lang: Language;
  entreprise: Entreprise;
  onClose: () => void;
}> = ({ lang, entreprise, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ reservations: any[]; total: number; totalPaid: number; totalRemaining: number }>({
    reservations: [], total: 0, totalPaid: 0, totalRemaining: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        setData(await DatabaseService.getEntrepriseHistory(entreprise.id));
      } catch (err: any) {
        setError(err?.message || 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [entreprise.id]);

  const statusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'active': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto sm:py-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-saas-border overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]"
      >
        <div className="px-8 py-6 bg-[#0F172A] text-white flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black tracking-tight flex items-center gap-3">
              <History className="w-5 h-5 text-[#0284C7]" />
              {entreprise.name}
            </h3>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
              {lang === 'fr' ? 'Historique des réservations' : 'سجل الحجوزات'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Totaux */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-saas-bg border-b border-saas-border">
          {[
            { label: lang === 'fr' ? 'Total' : 'الإجمالي', value: data.total, accent: 'text-[#0F172A]', bar: 'bg-[#0F172A]' },
            { label: lang === 'fr' ? 'Total payé' : 'المدفوع', value: data.totalPaid, accent: 'text-green-700', bar: 'bg-green-600' },
            { label: lang === 'fr' ? 'Total reste' : 'المتبقي', value: data.totalRemaining, accent: 'text-[#DC2626]', bar: 'bg-[#DC2626]' },
          ].map(card => (
            <div key={card.label} className="relative bg-white rounded-2xl border border-saas-border p-5 overflow-hidden">
              <span className={`absolute inset-y-0 left-0 w-1 ${card.bar}`} />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted mb-1">{card.label}</p>
              <p className={`text-2xl font-black ${card.accent}`}>{fmt(card.value)}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-saas-text-muted">
              <Loader2 className="w-7 h-7 animate-spin text-saas-primary-via" />
              <p className="text-sm font-semibold">{lang === 'fr' ? 'Chargement…' : 'جاري التحميل…'}</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 font-semibold text-sm">{error}</div>
          ) : data.reservations.length === 0 ? (
            <div className="py-16 text-center text-saas-text-muted">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold">{lang === 'fr' ? 'Aucune réservation pour cette entreprise' : 'لا توجد حجوزات لهذه الشركة'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-[0.15em] text-saas-text-muted border-b border-saas-border">
                    <th className="py-3 pr-4">{lang === 'fr' ? 'Période' : 'الفترة'}</th>
                    <th className="py-3 pr-4">{lang === 'fr' ? 'Véhicule' : 'المركبة'}</th>
                    <th className="py-3 pr-4">{lang === 'fr' ? 'Client' : 'العميل'}</th>
                    <th className="py-3 pr-4">{lang === 'fr' ? 'Statut' : 'الحالة'}</th>
                    <th className="py-3 pr-4 text-right">{lang === 'fr' ? 'Total' : 'الإجمالي'}</th>
                    <th className="py-3 pr-4 text-right">{lang === 'fr' ? 'Payé' : 'المدفوع'}</th>
                    <th className="py-3 text-right">{lang === 'fr' ? 'Reste' : 'المتبقي'}</th>
                  </tr>
                </thead>
                <tbody className="anim-stagger">
                  {data.reservations.map(r => (
                    <tr key={r.id} className="border-b border-saas-border/60 hover:bg-saas-bg transition-colors">
                      <td className="py-3 pr-4 font-semibold text-saas-text-main whitespace-nowrap">
                        {r.departureDate} → {r.returnDate}
                        <span className="block text-[11px] font-normal text-saas-text-muted">{r.totalDays} j</span>
                      </td>
                      <td className="py-3 pr-4 text-saas-text-main">{r.carInfo || '—'}</td>
                      <td className="py-3 pr-4 text-saas-text-main">{r.clientName || '—'}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${statusStyle(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-bold text-saas-text-main">{fmt(r.totalPrice)}</td>
                      <td className="py-3 pr-4 text-right font-bold text-green-700">{fmt(r.paid)}</td>
                      <td className="py-3 text-right font-bold text-[#DC2626]">{fmt(r.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Page principale ─────────────────────────────────────────────────────
export const EntreprisesPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const { can } = usePermissions();
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<{ open: boolean; entreprise: Entreprise | null }>({ open: false, entreprise: null });
  const [historyFor, setHistoryFor] = useState<Entreprise | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Entreprise | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEntreprises(await DatabaseService.getEntreprises());
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entreprises;
    return entreprises.filter(e =>
      [e.name, e.rc, e.art, e.nis, e.nif, e.phone, e.email]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    );
  }, [entreprises, query]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await DatabaseService.deleteEntreprise(confirmDelete.id);
      setEntreprises(prev => prev.filter(e => e.id !== confirmDelete.id));
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible');
    } finally {
      setConfirmDelete(null);
    }
  };

  const onSaved = (saved: Entreprise) => {
    setEntreprises(prev => {
      const exists = prev.some(e => e.id === saved.id);
      return exists ? prev.map(e => (e.id === saved.id ? saved : e)) : [saved, ...prev];
    });
  };

  const identityRows = (e: Entreprise) => ([
    { icon: <FileText className="w-3.5 h-3.5" />, label: 'RC', value: e.rc },
    { icon: <Landmark className="w-3.5 h-3.5" />, label: 'ART', value: e.art },
    { icon: <Hash className="w-3.5 h-3.5" />, label: 'NIS', value: e.nis },
    { icon: <ReceiptText className="w-3.5 h-3.5" />, label: 'NIF', value: e.nif },
  ]);

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl bg-[#0F172A] text-white p-8"
      >
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#DC2626]/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-20 w-56 h-56 rounded-full bg-[#0284C7]/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-[#DC2626] flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </span>
              {lang === 'fr' ? 'Entreprises' : 'الشركات'}
            </h2>
            <p className="text-white/60 font-bold uppercase text-[10px] tracking-[0.25em] mt-2">
              {lang === 'fr'
                ? `${entreprises.length} entreprise(s) · contrats & factures société`
                : `${entreprises.length} شركة · العقود والفواتير`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 w-64">
              <Search className="w-4 h-4 text-white/60" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={lang === 'fr' ? 'Rechercher…' : 'بحث…'}
                className="bg-transparent outline-none text-sm w-full placeholder:text-white/40"
              />
            </div>
            {can('entreprises', 'create') && (
              <button
                onClick={() => setModal({ open: true, entreprise: null })}
                className="btn-vel-cta px-6 py-2.5 text-xs"
              >
                <Plus className="w-4 h-4" />
                {lang === 'fr' ? 'Nouvelle entreprise' : 'شركة جديدة'}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-5">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}

      {/* Cartes */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => <div key={i} className="h-56 rounded-3xl vel-skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-saas-text-muted opacity-25" />
          <p className="text-lg font-black text-saas-text-main">
            {lang === 'fr' ? 'Aucune entreprise enregistrée' : 'لا توجد شركات مسجلة'}
          </p>
          <p className="text-sm text-saas-text-muted mt-1">
            {lang === 'fr'
              ? 'Créez votre première entreprise pour l’utiliser sur vos contrats et factures.'
              : 'أنشئ أول شركة لاستعمالها في العقود والفواتير.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 anim-stagger">
          {filtered.map(e => (
            <div
              key={e.id}
              className="group relative bg-white rounded-3xl border border-saas-border overflow-hidden hover-lift"
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#DC2626] to-[#0284C7]" />
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <span className="w-12 h-12 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-saas-text-main leading-tight truncate">{e.name}</h3>
                    {(e.phone || e.email) && (
                      <p className="text-xs text-saas-text-muted mt-1 truncate">
                        {[e.phone, e.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  {identityRows(e).map(row => (
                    <div key={row.label} className="rounded-xl bg-saas-bg border border-saas-border px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-saas-text-muted">
                        <span className="text-saas-secondary-start">{row.icon}</span>{row.label}
                      </p>
                      <p className="text-xs font-bold text-saas-text-main truncate mt-0.5">{row.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {e.address && (
                  <p className="mt-4 flex items-start gap-2 text-xs text-saas-text-muted">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{e.address}</span>
                  </p>
                )}
              </div>

              <div className="px-6 py-4 border-t border-saas-border bg-saas-bg flex items-center gap-2">
                {can('entreprises', 'history') && (
                  <button
                    onClick={() => setHistoryFor(e)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-saas-border text-xs font-bold text-saas-text-main hover:border-[#0284C7] hover:text-[#0284C7] transition-colors cursor-pointer"
                  >
                    <History className="w-4 h-4" />
                    {lang === 'fr' ? 'Historique' : 'السجل'}
                  </button>
                )}
                {can('entreprises', 'edit') && (
                  <button
                    onClick={() => setModal({ open: true, entreprise: e })}
                    className="p-2.5 rounded-xl bg-white border border-saas-border text-saas-text-muted hover:border-[#0284C7] hover:text-[#0284C7] transition-colors cursor-pointer"
                    title={lang === 'fr' ? 'Modifier' : 'تعديل'}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {can('entreprises', 'delete') && (
                  <button
                    onClick={() => setConfirmDelete(e)}
                    className="p-2.5 rounded-xl bg-white border border-saas-border text-saas-text-muted hover:border-[#DC2626] hover:text-[#DC2626] transition-colors cursor-pointer"
                    title={lang === 'fr' ? 'Supprimer' : 'حذف'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal.open && (
          <EntrepriseModal
            lang={lang}
            entreprise={modal.entreprise}
            onClose={() => setModal({ open: false, entreprise: null })}
            onSaved={onSaved}
          />
        )}
        {historyFor && (
          <EntrepriseHistoryModal lang={lang} entreprise={historyFor} onClose={() => setHistoryFor(null)} />
        )}
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto sm:py-8"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={ev => ev.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-saas-border"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-7 h-7 text-[#DC2626]" />
              </div>
              <h3 className="text-xl font-black text-saas-text-main text-center mb-2">
                {lang === 'fr' ? 'Supprimer cette entreprise ?' : 'حذف هذه الشركة؟'}
              </h3>
              <p className="text-sm text-saas-text-muted text-center mb-7">
                <strong className="text-saas-text-main">{confirmDelete.name}</strong>
                {lang === 'fr'
                  ? ' sera retirée de la liste. Les réservations déjà rattachées conservent leurs données.'
                  : ' سيتم حذفها من القائمة. الحجوزات المرتبطة تحتفظ ببياناتها.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="btn-saas-outline flex-1 cursor-pointer">
                  {lang === 'fr' ? 'Annuler' : 'إلغاء'}
                </button>
                <button onClick={handleDelete} className="btn-saas-danger flex-1 cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                  {lang === 'fr' ? 'Supprimer' : 'حذف'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EntreprisesPage;
