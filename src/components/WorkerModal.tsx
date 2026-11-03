import React, { useState, useEffect } from 'react';
import { Worker, Language, PaymentType, WorkerRole, Company } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Loader2, User, Phone, Calendar, CreditCard, KeyRound, BadgeCheck,
  Plus, AlertTriangle, Camera, Briefcase, Mail, Building2,
} from 'lucide-react';
import { uploadWorkerProfilePhoto } from '../services/uploadWorkerImage';
import { DatabaseService } from '../services/DatabaseService';

interface WorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (worker: Partial<Worker>) => void;
  worker?: Worker;
  lang: Language;
  /** Agences métier (super-admin) — sélecteur « Agence » du personnel. */
  companies?: Company[];
  /** Agence par défaut d'un nouvel employé (agence active). */
  defaultCompanyId?: string;
}

const empty = (): Partial<Worker> => ({
  fullName: '',
  dateOfBirth: '',
  phone: '',
  email: '',
  address: '',
  profilePhoto: '',
  idCardNumber: '',
  type: 'worker',
  roleId: '',
  startDate: new Date().toISOString().split('T')[0],
  paymentEnabled: false,
  paymentType: 'monthly',
  baseSalary: 0,
  username: '',
  password: '',
  accountEnabled: false,
});

export const WorkerModal: React.FC<WorkerModalProps> = ({ isOpen, onClose, onSave, worker, lang, companies = [], defaultCompanyId }) => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const [formData, setFormData] = useState<Partial<Worker>>(empty());
  const [roles, setRoles] = useState<WorkerRole[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [showNewRole, setShowNewRole] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData(worker
      ? { ...empty(), ...worker, password: '' }
      : { ...empty(), companyId: defaultCompanyId });
    setValidationError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setRoles(await DatabaseService.getWorkerRoles());
      } catch {
        setRoles([]);
      }
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (patch: Partial<Worker>) => {
    setFormData(prev => ({ ...prev, ...patch }));
    if (validationError) setValidationError(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadWorkerProfilePhoto(file, worker?.id);
      if (result.success && result.url) set({ profilePhoto: result.url });
      else setUploadError(result.error || 'Upload failed');
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const createRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    setCreatingRole(true);
    try {
      const created = await DatabaseService.createWorkerRole(name);
      setRoles(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      set({ roleId: created.id, roleName: created.name });
      setNewRoleName('');
      setShowNewRole(false);
    } catch (err: any) {
      setValidationError(err?.message || T('Impossible de créer ce rôle', 'تعذر إنشاء هذا الدور'));
    } finally {
      setCreatingRole(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const errors: string[] = [];
    if (!formData.fullName?.trim()) errors.push(T('Nom complet requis', 'الاسم الكامل مطلوب'));
    if (!formData.phone?.trim()) errors.push(T('Téléphone requis', 'الهاتف مطلوب'));
    if (formData.paymentEnabled && (!formData.baseSalary || formData.baseSalary <= 0)) {
      errors.push(T('Montant de rémunération requis', 'مبلغ الأجر مطلوب'));
    }
    if (formData.accountEnabled) {
      if (!formData.email?.trim()) errors.push(T('Email requis pour le compte', 'البريد مطلوب للحساب'));
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.push(T('Email invalide', 'بريد غير صحيح'));
      if (!formData.username?.trim()) errors.push(T("Nom d'utilisateur requis", 'اسم المستخدم مطلوب'));
      if (!worker && !formData.password?.trim()) errors.push(T('Mot de passe requis', 'كلمة المرور مطلوبة'));
      else if (formData.password && formData.password.length < 6) {
        errors.push(T('Mot de passe : 6 caractères minimum', 'كلمة المرور: 6 أحرف على الأقل'));
      }
    }

    if (errors.length > 0) {
      setValidationError(errors.join(' · '));
      return;
    }

    try {
      setSaving(true);
      const roleName = roles.find(r => r.id === formData.roleId)?.name;
      await onSave({ ...formData, roleName, email: formData.email?.trim().toLowerCase() || '' });
    } catch (err: any) {
      console.error('Error saving worker:', err);
      let errorMsg = T("Erreur lors de l'enregistrement", 'خطأ أثناء الحفظ');
      if (err?.message) {
        if (err.message.includes('already registered') || err.message.includes('already exists')) {
          errorMsg = T('Cet email est déjà utilisé', 'هذا البريد الإلكتروني مستخدم بالفعل');
        } else {
          errorMsg = err.message;
        }
      }
      setValidationError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; accent?: string }> =
    ({ icon, title, children, accent = '#DC2626' }) => (
      <section className="rounded-2xl border border-saas-border bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
          <h3 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg text-white flex items-center justify-center" style={{ background: accent }}>
              {icon}
            </span>
            {title}
          </h3>
        </div>
        <div className="p-5">{children}</div>
      </section>
    );

  const Toggle: React.FC<{ on: boolean; onChange: () => void; accent?: string }> = ({ on, onChange, accent = '#DC2626' }) => (
    <button
      type="button"
      onClick={onChange}
      className="relative w-11 h-6 rounded-full shrink-0 transition-colors cursor-pointer"
      style={{ background: on ? accent : '#CBD5E1' }}
      aria-pressed={on}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
        style={{ left: on ? 22 : 2 }}
      />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 bg-slate-900/55 backdrop-blur-sm overflow-y-auto sm:py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="bg-saas-bg w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)] border border-saas-border"
      >
        <div className="relative overflow-hidden bg-[#0F172A] text-white px-8 py-6 shrink-0">
          <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-[#DC2626]/25 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-[#DC2626] flex items-center justify-center shadow-lg shadow-[#DC2626]/30">
                <User className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter">
                  {worker ? T('Modifier un employé', 'تعديل موظف') : T('Nouvel employé', 'موظف جديد')}
                </h2>
                <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.25em] mt-1">
                  {T('Fiche du personnel', 'بطاقة الموظف')}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-7 space-y-5">
          {/* Identité */}
          <Section icon={<User className="w-4 h-4" />} title={T('Informations personnelles', 'المعلومات الشخصية')}>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-saas-border bg-saas-bg flex items-center justify-center">
                  {formData.profilePhoto
                    ? <img src={formData.profilePhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    : <User className="w-10 h-10 text-saas-text-muted opacity-40" />}
                </div>
                <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-saas-border text-xs font-bold text-saas-text-main hover:border-[#DC2626] hover:text-[#DC2626] transition-colors cursor-pointer">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  {T('Photo', 'صورة')}
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
                </label>
                {uploadError && <p className="text-[11px] font-bold text-[#DC2626] text-center">{uploadError}</p>}
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label-saas">{T('Nom complet', 'الاسم الكامل')} *</label>
                  <input value={formData.fullName || ''} onChange={e => set({ fullName: e.target.value })}
                    className="input-saas" placeholder={T('Ex : Karim Oukkal', 'مثال: كريم')} />
                </div>
                <div>
                  <label className="label-saas flex items-center gap-1.5"><Calendar className="w-3 h-3" />{T('Date de naissance', 'تاريخ الميلاد')}</label>
                  <input type="date" value={formData.dateOfBirth || ''} onChange={e => set({ dateOfBirth: e.target.value })} className="input-saas" />
                </div>
                <div>
                  <label className="label-saas flex items-center gap-1.5">
                    <BadgeCheck className="w-3 h-3" />
                    {T("N° carte d'identité", 'رقم بطاقة الهوية')}
                    <span className="normal-case font-normal">({T('optionnel', 'اختياري')})</span>
                  </label>
                  <input value={formData.idCardNumber || ''} onChange={e => set({ idCardNumber: e.target.value })} className="input-saas" placeholder="—" />
                </div>
                <div>
                  <label className="label-saas flex items-center gap-1.5"><Phone className="w-3 h-3" />{T('Téléphone', 'الهاتف')} *</label>
                  <input value={formData.phone || ''} onChange={e => set({ phone: e.target.value })} className="input-saas" placeholder="+213 …" />
                </div>
                <div>
                  <label className="label-saas flex items-center gap-1.5"><Mail className="w-3 h-3" />Email</label>
                  <input type="email" value={formData.email || ''} onChange={e => set({ email: e.target.value })} className="input-saas" placeholder="nom@exemple.dz" />
                </div>
              </div>
            </div>
          </Section>

          {/* Poste */}
          <Section icon={<Briefcase className="w-4 h-4" />} title={T('Poste', 'المنصب')} accent="#0284C7">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="label-saas">{T('Rôle', 'الدور')}</label>
                <div className="flex gap-2">
                  <select
                    value={formData.roleId || ''}
                    onChange={e => set({ roleId: e.target.value })}
                    className="input-saas cursor-pointer flex-1"
                  >
                    <option value="">{T('— Sélectionner un rôle —', '— اختر دوراً —')}</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewRole(v => !v)}
                    className="px-4 rounded-xl bg-white border border-saas-border text-saas-text-main hover:border-[#0284C7] hover:text-[#0284C7] transition-colors cursor-pointer"
                    title={T('Créer un rôle', 'إنشاء دور')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {showNewRole && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 mt-3">
                        <input
                          value={newRoleName}
                          onChange={e => setNewRoleName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createRole(); } }}
                          className="input-saas flex-1"
                          placeholder={T('Nom du nouveau rôle (ex : Réceptionniste)', 'اسم الدور الجديد')}
                        />
                        <button
                          type="button"
                          onClick={createRole}
                          disabled={creatingRole || !newRoleName.trim()}
                          className="btn-vel-blue px-5 py-2.5 text-xs disabled:opacity-40"
                        >
                          {creatingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          {T('Créer', 'إنشاء')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="label-saas">{T('Type technique', 'النوع')}</label>
                <select
                  value={formData.type || 'worker'}
                  onChange={e => set({ type: e.target.value as any })}
                  className="input-saas cursor-pointer"
                >
                  <option value="worker">{T('Employé', 'موظف')}</option>
                  <option value="driver">{T('Chauffeur', 'سائق')}</option>
                  <option value="admin">{T('Administrateur', 'مدير')}</option>
                </select>
              </div>

              {/* Agence (multi-agences) — l'employé ne verra que les données de cette agence */}
              {companies.length > 1 && (
                <div className="sm:col-span-3">
                  <label className="label-saas flex items-center gap-1.5"><Building2 className="w-3 h-3" />{T('Agence', 'الوكالة')}</label>
                  <select
                    value={formData.companyId || ''}
                    onChange={e => set({ companyId: e.target.value })}
                    className="input-saas cursor-pointer sm:max-w-md"
                  >
                    <option value="">{T('— Sélectionner une agence —', '— اختر وكالة —')}</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="mt-1.5 text-[11px] text-saas-text-muted leading-snug">
                    {T("L'employé ne voit que les données de son agence.", 'يرى الموظف بيانات وكالته فقط.')}
                  </p>
                </div>
              )}

              <div className="sm:col-span-3">
                <label className="label-saas">{T('Date de début de travail', 'تاريخ بدء العمل')}</label>
                <input type="date" value={formData.startDate || ''} onChange={e => set({ startDate: e.target.value })} className="input-saas sm:max-w-xs" />
              </div>
            </div>
          </Section>

          {/* Rémunération */}
          <Section icon={<CreditCard className="w-4 h-4" />} title={T('Rémunération', 'الأجر')} accent="#0F172A">
            <div className="flex items-start gap-3.5 mb-4">
              <Toggle on={!!formData.paymentEnabled} onChange={() => set({ paymentEnabled: !formData.paymentEnabled })} />
              <div>
                <p className="font-black text-saas-text-main">
                  {T('Cet employé est rémunéré via l’application', 'هذا الموظف يتقاضى أجره عبر التطبيق')}
                </p>
                <p className="text-xs text-saas-text-muted mt-0.5">
                  {T('Désactivé : aucun calcul de salaire ne lui est appliqué.', 'معطّل: لا يتم حساب أي راتب له.')}
                </p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {formData.paymentEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="label-saas">{T('Périodicité', 'الدورية')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { v: 'daily' as PaymentType, l: T('Par jour', 'باليوم') },
                          { v: 'monthly' as PaymentType, l: T('Par mois', 'بالشهر') },
                        ]).map(opt => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => set({ paymentType: opt.v })}
                            className={`py-2.5 rounded-xl border-2 text-sm font-black transition-all cursor-pointer ${
                              formData.paymentType === opt.v
                                ? 'border-[#DC2626] bg-[#DC2626] text-white'
                                : 'border-saas-border bg-white text-saas-text-main hover:border-saas-border-strong'
                            }`}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label-saas">
                        {formData.paymentType === 'daily'
                          ? T('Montant par jour (DA)', 'المبلغ اليومي (دج)')
                          : T('Montant par mois (DA)', 'المبلغ الشهري (دج)')}
                      </label>
                      <input
                        type="number" min={0}
                        value={formData.baseSalary || ''}
                        onChange={e => set({ baseSalary: parseFloat(e.target.value) || 0 })}
                        className="input-saas font-bold"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Section>

          {/* Compte de connexion */}
          <Section icon={<KeyRound className="w-4 h-4" />} title={T('Compte de connexion', 'حساب الدخول')} accent="#0284C7">
            <div className="flex items-start gap-3.5 mb-4">
              <Toggle on={!!formData.accountEnabled} onChange={() => set({ accountEnabled: !formData.accountEnabled })} accent="#0284C7" />
              <div>
                <p className="font-black text-saas-text-main">
                  {T('Activer un compte de connexion', 'تفعيل حساب الدخول')}
                </p>
                <p className="text-xs text-saas-text-muted mt-0.5">
                  {T(
                    "Le compte est créé dans l'authentification Supabase : l'employé se connecte directement depuis la page de connexion avec son email et son mot de passe.",
                    'يُنشأ الحساب في مصادقة Supabase: يسجّل الموظف دخوله مباشرة من صفحة الدخول ببريده وكلمة المرور.'
                  )}
                </p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {formData.accountEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <label className="label-saas">Email *</label>
                      <input type="email" value={formData.email || ''} onChange={e => set({ email: e.target.value })} className="input-saas" placeholder="nom@exemple.dz" />
                    </div>
                    <div>
                      <label className="label-saas">{T("Nom d'utilisateur", 'اسم المستخدم')} *</label>
                      <input value={formData.username || ''} onChange={e => set({ username: e.target.value })} className="input-saas" placeholder="k.oukkal" />
                    </div>
                    <div>
                      <label className="label-saas">
                        {T('Mot de passe', 'كلمة المرور')}{' '}
                        {worker
                          ? <span className="normal-case font-normal">({T('vide = inchangé', 'فارغ = دون تغيير')})</span>
                          : '*'}
                      </label>
                      <input type="text" value={formData.password || ''} onChange={e => set({ password: e.target.value })} className="input-saas font-mono" placeholder="••••••" />
                    </div>
                  </div>

                  <p className="mt-3 flex items-start gap-2 text-[11px] text-saas-text-muted leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-0.5" />
                    {T(
                      "L'employé est créé sans aucune permission. Attribuez-lui ensuite ses interfaces et ses boutons via l'action « Permissions » de sa fiche.",
                      'يُنشأ الموظف بدون أي صلاحية. امنحه لاحقاً واجهاته وأزراره عبر إجراء «الصلاحيات» في بطاقته.'
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Section>

          {validationError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4"
            >
              <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-red-700">{validationError}</p>
            </motion.div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="btn-saas-outline px-8 cursor-pointer">
              {T('Annuler', 'إلغاء')}
            </button>
            <button type="submit" disabled={saving || uploading} className="btn-saas-primary px-10 cursor-pointer">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
              {worker ? T('Enregistrer', 'حفظ') : T("Créer l'employé", 'إنشاء الموظف')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
