import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Plus, Loader2, Star, Pencil, X, Check, UserPlus, KeyRound, Mail, Eye, EyeOff } from 'lucide-react';
import { Language, Company } from '../types';
import { DatabaseService } from '../services/DatabaseService';

/**
 * Gestion des agences métier (companies) — réservée au super-admin.
 * Liste les agences, permet d'en créer de nouvelles (nom + logo optionnel,
 * agence principale = business indépendant avec sa propre comptabilité) et de
 * les renommer / changer leur logo.
 *
 * ⚠️ Ne concerne PAS les `agencies` (agences physiques de départ/retour).
 */
export const CompaniesManager: React.FC<{ lang: Language }> = ({ lang }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; logo: string; isPrimary: boolean }>({ name: '', logo: '', isPrimary: true });

  // Création d'un compte administrateur d'agence (spec B).
  const [adminFor, setAdminFor] = useState<Company | null>(null);
  const [adminForm, setAdminForm] = useState<{ fullName: string; email: string; password: string }>({ fullName: '', email: '', password: '' });
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  const t = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await DatabaseService.getCompanies();
      setCompanies(list);
    } catch (err: any) {
      console.error('Error loading companies:', err);
      setError(err?.message || t('Impossible de charger les agences.', 'تعذر تحميل الوكالات.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', logo: '', isPrimary: true });
    setShowForm(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({ name: c.name, logo: c.logo || '', isPrimary: c.isPrimary !== false });
    setShowForm(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(prev => ({ ...prev, logo: (ev.target?.result as string) || '' }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      setError(null);
      if (editing) {
        const updated = await DatabaseService.updateCompany(editing.id, { name: form.name, logo: form.logo || null, isPrimary: form.isPrimary });
        setCompanies(prev => prev.map(c => (c.id === editing.id ? updated : c)));
      } else {
        const created = await DatabaseService.createCompany({ name: form.name, logo: form.logo || null, isPrimary: form.isPrimary });
        setCompanies(prev => [...prev, created]);
      }
      setShowForm(false);
      setEditing(null);
    } catch (err: any) {
      console.error('Error saving company:', err);
      setError(err?.message || t("L'enregistrement a échoué.", 'فشل الحفظ.'));
    } finally {
      setSaving(false);
    }
  };

  const openAdmin = (c: Company) => {
    setAdminFor(c);
    setAdminForm({ fullName: '', email: '', password: '' });
    setAdminError(null);
    setAdminSuccess(null);
    setShowAdminPassword(false);
  };

  const handleCreateAdmin = async () => {
    if (!adminFor) return;
    const email = adminForm.email.trim().toLowerCase();
    if (!adminForm.fullName.trim()) { setAdminError(t('Nom complet requis', 'الاسم الكامل مطلوب')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAdminError(t('Email invalide', 'بريد غير صحيح')); return; }
    if (adminForm.password.length < 6) { setAdminError(t('Mot de passe : 6 caractères minimum', 'كلمة المرور: 6 أحرف على الأقل')); return; }
    try {
      setCreatingAdmin(true);
      setAdminError(null);
      await DatabaseService.createAgencyAdmin({
        email,
        password: adminForm.password,
        fullName: adminForm.fullName.trim(),
        companyId: adminFor.id,
      });
      setAdminSuccess(t(
        `Compte administrateur créé pour ${adminFor.name}. Il peut se connecter avec son email et son mot de passe.`,
        `تم إنشاء حساب مسؤول لـ ${adminFor.name}. يمكنه تسجيل الدخول ببريده وكلمة المرور.`
      ));
      setAdminForm({ fullName: '', email: '', password: '' });
    } catch (err: any) {
      console.error('Error creating agency admin:', err);
      const msg = err?.message || '';
      setAdminError(
        msg.includes('already') ? t('Cet email est déjà utilisé.', 'هذا البريد مستخدم بالفعل.') :
        (msg || t("La création du compte a échoué.", 'فشل إنشاء الحساب.'))
      );
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-lg border border-saas-border overflow-hidden">
      <div className="p-6 border-b border-saas-border bg-linear-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
          🏢 {t('Agences', 'الوكالات')}
        </h2>
        <button onClick={openCreate} className="btn-saas-primary px-5 py-2.5 flex items-center gap-2 text-sm">
          <Plus size={18} />
          {t('Nouvelle agence', 'وكالة جديدة')}
        </button>
      </div>

      <div className="p-8 space-y-6">
        <p className="text-sm text-saas-text-muted leading-relaxed">
          {t(
            "Une agence est un business indépendant avec sa propre comptabilité et ses propres employés. Créez-en une, puis créez son compte administrateur depuis la page de connexion.",
            'الوكالة نشاط مستقل بمحاسبته وموظفيه. أنشئ وكالة ثم أنشئ حساب مسؤولها من صفحة الدخول.'
          )}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-saas-primary-via" size={28} />
          </div>
        ) : companies.length === 0 ? (
          <p className="text-sm text-saas-text-muted italic py-6 text-center">
            {t('Aucune agence enregistrée.', 'لا توجد وكالات مسجلة.')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {companies.map(c => (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl border border-saas-border bg-saas-bg">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-saas-border bg-white flex items-center justify-center shrink-0">
                  {c.logo ? (
                    <img src={c.logo} alt={c.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Building2 className="text-saas-text-muted" size={22} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-saas-text-main truncate">{c.name}</p>
                  {c.isPrimary && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-600 mt-0.5">
                      <Star size={11} className="fill-amber-500 text-amber-500" />
                      {t('Agence principale', 'الوكالة الرئيسية')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openAdmin(c)}
                  className="p-2.5 rounded-xl bg-white border border-saas-border hover:border-[#0284C7] text-saas-text-muted hover:text-[#0284C7] transition-colors shrink-0"
                  title={t('Créer un compte admin', 'إنشاء حساب مسؤول')}
                >
                  <UserPlus size={16} />
                </button>
                <button
                  onClick={() => openEdit(c)}
                  className="p-2.5 rounded-xl bg-white border border-saas-border hover:border-saas-primary-via text-saas-text-muted hover:text-saas-primary-via transition-colors shrink-0"
                  title={t('Modifier', 'تعديل')}
                >
                  <Pencil size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulaire création / édition */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-start justify-center z-[70] p-4 overflow-y-auto sm:py-10"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-saas-border bg-[#0F172A] text-white flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {editing ? t("Modifier l'agence", 'تعديل الوكالة') : t('Nouvelle agence', 'وكالة جديدة')}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="label-saas">{t("Nom de l'agence", 'اسم الوكالة')}</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="input-saas"
                    placeholder={t('ex: MHD Auto Oran', 'مثال: MHD Auto وهران')}
                  />
                </div>

                <div className="space-y-3">
                  <label className="label-saas">{t('Logo (optionnel)', 'الشعار (اختياري)')}</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-saas-border bg-saas-bg flex items-center justify-center shrink-0">
                      {form.logo ? (
                        <img src={form.logo} alt="logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Building2 className="text-saas-text-muted" size={22} />
                      )}
                    </div>
                    <label className="block">
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      <span className="btn-saas-secondary px-5 py-2.5 inline-block cursor-pointer text-sm">
                        {t('Choisir un logo', 'اختيار شعار')}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Agence principale (« star ») : comptabilité + employés indépendants */}
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, isPrimary: !prev.isPrimary }))}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                    form.isPrimary ? 'border-amber-400 bg-amber-50' : 'border-saas-border bg-white'
                  }`}
                >
                  <Star size={22} className={form.isPrimary ? 'fill-amber-500 text-amber-500' : 'text-saas-text-muted'} />
                  <span className="flex-1">
                    <span className="block font-black text-saas-text-main">
                      {t('Agence principale', 'وكالة رئيسية')}
                    </span>
                    <span className="block text-xs text-saas-text-muted mt-0.5">
                      {t('Comptabilité et employés indépendants (business autonome).', 'محاسبة وموظفون مستقلون (نشاط قائم بذاته).')}
                    </span>
                  </span>
                  <span className={`w-11 h-6 rounded-full shrink-0 relative transition-colors ${form.isPrimary ? 'bg-amber-500' : 'bg-slate-300'}`}>
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: form.isPrimary ? 22 : 2 }} />
                  </span>
                </button>
              </div>

              <div className="p-6 border-t border-saas-border flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 btn-saas-outline py-3" disabled={saving}>
                  {t('Annuler', 'إلغاء')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 btn-saas-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {t('Enregistrer', 'حفظ')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Création d'un compte administrateur d'agence (spec B) */}
      <AnimatePresence>
        {adminFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-start justify-center z-[70] p-4 overflow-y-auto sm:py-10"
            onClick={() => setAdminFor(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-saas-border bg-[#0284C7] text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <UserPlus size={20} /> {t('Compte administrateur', 'حساب مسؤول')}
                  </h3>
                  <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mt-1 truncate">
                    {adminFor.name}
                  </p>
                </div>
                <button onClick={() => setAdminFor(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-5">
                <p className="text-sm text-saas-text-muted leading-relaxed">
                  {t(
                    "Cet administrateur aura accès à toutes les interfaces, mais uniquement aux données de cette agence (réservations, dépenses, employés, rapports…).",
                    'سيصل هذا المسؤول إلى جميع الواجهات، لكن فقط لبيانات هذه الوكالة (الحجوزات، المصاريف، الموظفون، التقارير…).'
                  )}
                </p>

                <div className="space-y-2">
                  <label className="label-saas flex items-center gap-1.5"><Building2 size={12} />{t('Nom complet', 'الاسم الكامل')}</label>
                  <input
                    value={adminForm.fullName}
                    onChange={e => setAdminForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="input-saas"
                    placeholder={t('Ex : Karim Oukkal', 'مثال: كريم')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-saas flex items-center gap-1.5"><Mail size={12} />Email</label>
                  <input
                    type="email"
                    value={adminForm.email}
                    onChange={e => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                    className="input-saas"
                    placeholder="admin@agence.dz"
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-saas flex items-center gap-1.5"><KeyRound size={12} />{t('Mot de passe', 'كلمة المرور')}</label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminForm.password}
                      onChange={e => setAdminForm(prev => ({ ...prev, password: e.target.value }))}
                      className="input-saas pr-11 font-mono"
                      placeholder="••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-saas-text-muted hover:text-saas-primary-via"
                    >
                      {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {adminError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{adminError}</div>
                )}
                {adminSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">{adminSuccess}</div>
                )}
              </div>

              <div className="p-6 border-t border-saas-border flex gap-3">
                <button onClick={() => setAdminFor(null)} className="flex-1 btn-saas-outline py-3" disabled={creatingAdmin}>
                  {t('Fermer', 'إغلاق')}
                </button>
                <button
                  onClick={handleCreateAdmin}
                  disabled={creatingAdmin}
                  className="flex-1 btn-vel-blue py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {creatingAdmin ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  {t('Créer le compte', 'إنشاء الحساب')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
