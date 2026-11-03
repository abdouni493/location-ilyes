import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Car, Language, Company } from '../types';
import { X, Plus, Loader2, User, Users, Wallet, Coins, Info, Building2, Check } from 'lucide-react';
import { uploadCarImage } from '../services/uploadCarImage';
import {
  CurrencyCode, CURRENCIES, SECONDARY_CURRENCIES, DEFAULT_RATES,
  CarCurrencies, convertFromDzd, formatCurrency,
} from '../utils/currency';
import {
  WEEK_DAYS, MONTH_DAYS,
  weekDayRate, monthDayRate, weekTotal, monthTotal,
} from '../utils/pricing';

interface CarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (car: Partial<Car>) => void;
  onDelete?: (id: string) => void;
  car?: Car;
  lang: Language;
  /** Agences métier disponibles (multi-agences). */
  companies?: Company[];
  /** Agences pré-sélectionnées (liens actuels de la voiture, ou défaut pour une nouvelle). */
  initialCompanyIds?: string[];
}

const emptyForm = (): Partial<Car> => ({
  brand: '',
  model: '',
  registration: '',
  year: new Date().getFullYear(),
  color: '',
  vin: '',
  energy: 'Essence',
  transmission: 'Manuelle',
  seats: 5,
  doors: 5,
  priceDay: 0,
  priceWeek: 0,
  priceMonth: 0,
  deposit: 0,
  images: [],
  mileage: 0,
  // Par défaut : voiture appartenant à l'agence
  ownerType: 'personal',
  ownerName: '',
  ownerPhone: '',
  agencySharePerDay: 0,
  currencies: {},
});

export const CarModal: React.FC<CarModalProps> = ({ isOpen, onClose, onSave, onDelete, car, lang, companies = [], initialCompanyIds }) => {
  const [formData, setFormData] = useState<Partial<Car>>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    const base = car ? { ...emptyForm(), ...car } : emptyForm();
    // `priceWeek` / `priceMonth` sont des tarifs JOURNALIERS. On matérialise
    // simplement le repli (tarif à la journée) pour que le champ affiché soit
    // exactement ce qui sera enregistré.
    setFormData({
      ...base,
      priceWeek: weekDayRate(base),
      priceMonth: monthDayRate(base),
      companyIds: initialCompanyIds ? [...initialCompanyIds] : (car?.companyIds || []),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car, isOpen]);

  const toggleCompany = (id: string) => {
    setFormData(prev => {
      const set = new Set(prev.companyIds || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...prev, companyIds: Array.from(set) };
    });
  };

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ['year', 'seats', 'doors', 'deposit', 'mileage', 'agencySharePerDay'];
    const parsed = numericFields.includes(name) || name.startsWith('price') ? Number(value) : value;

    setFormData(prev => {
      const next: Partial<Car> = { ...prev, [name]: parsed };

      // Le tarif à la journée sert de valeur par défaut aux deux formules :
      // tant qu'aucune remise semaine / mois n'a été saisie (champ vide ou
      // encore aligné sur l'ancien tarif jour), on le recopie. Dès que
      // l'agence saisit une remise, elle n'est plus jamais écrasée.
      if (name === 'priceDay') {
        const previousDay = Number(prev.priceDay ?? 0);
        if (!prev.priceWeek || Number(prev.priceWeek) === previousDay) next.priceWeek = Number(parsed);
        if (!prev.priceMonth || Number(prev.priceMonth) === previousDay) next.priceMonth = Number(parsed);
      }

      return next;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadingImages(true);
      try {
        const newImages: string[] = [];
        for (const file of Array.from(files)) {
          const result = await uploadCarImage(file as File, car?.id);
          if (result.success && result.url) newImages.push(result.url);
        }
        setFormData(prev => ({
          ...prev,
          images: newImages.length > 0 ? newImages : prev.images,
        }));
      } catch (err) {
        console.error('Error uploading images:', err);
      } finally {
        setUploadingImages(false);
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Devises ──────────────────────────────────────────────────────────────
  const currencies: CarCurrencies = formData.currencies || {};

  const toggleCurrency = (code: CurrencyCode) => {
    setFormData(prev => {
      const current = prev.currencies || {};
      const entry = current[code];
      return {
        ...prev,
        currencies: {
          ...current,
          [code]: { enabled: !entry?.enabled, rate: entry?.rate || DEFAULT_RATES[code] },
        },
      };
    });
  };

  const setRate = (code: CurrencyCode, rate: number) => {
    setFormData(prev => {
      const current = prev.currencies || {};
      return {
        ...prev,
        currencies: { ...current, [code]: { enabled: current[code]?.enabled ?? true, rate } },
      };
    });
  };

  // Tarifs journaliers saisis par l'agence : « à la journée », « en semaine »,
  // « au mois ». Les totaux de formule en sont dérivés (× 7 / × 30).
  const weekPerDay = weekDayRate(formData);
  const monthPerDay = monthDayRate(formData);
  const weekTotalDzd = weekTotal(formData);
  const monthTotalDzd = monthTotal(formData);

  /**
   * Lignes du tableau de conversion. `dzd` = montant mis en avant (tarif
   * journalier), `totalDzd` = total de la formule rappelé en dessous.
   */
  const priceRows: { key: string; label: string; dzd: number; totalDzd?: number; totalLabel?: string }[] = [
    { key: 'priceDay', label: lang === 'fr' ? 'Jour' : 'يوم', dzd: Number(formData.priceDay ?? 0) },
    {
      key: 'priceWeek',
      label: lang === 'fr' ? `Jour (${WEEK_DAYS} j)` : `يوم (${WEEK_DAYS} أيام)`,
      dzd: weekPerDay,
      totalDzd: weekTotalDzd,
      totalLabel: lang === 'fr' ? '/ sem.' : '/ أسبوع',
    },
    {
      key: 'priceMonth',
      label: lang === 'fr' ? `Jour (${MONTH_DAYS} j)` : `يوم (${MONTH_DAYS} يوماً)`,
      dzd: monthPerDay,
      totalDzd: monthTotalDzd,
      totalLabel: lang === 'fr' ? '/ mois' : '/ شهر',
    },
    { key: 'deposit', label: lang === 'fr' ? 'Caution' : 'الضمان', dzd: Number(formData.deposit ?? 0) },
  ];

  const isThirdParty = formData.ownerType === 'third_party';

  const sectionTitle = (icon: React.ReactNode, title: string) => (
    <h3 className="text-xs font-black text-saas-primary-via flex items-center gap-3 uppercase tracking-[0.2em]">
      <span className="p-2 bg-saas-primary-via/10 rounded-lg text-saas-primary-via flex items-center justify-center">{icon}</span>
      {title}
    </h3>
  );

  return (
    // Ancré en haut, centré horizontalement : le formulaire étant long, un
    // centrage vertical le faisait déborder hors de l'écran sur petits écrans.
    // `overflow-y-auto` sur le calque permet de faire défiler la fenêtre entière.
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:pt-8 sm:pb-8 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)] border border-saas-border my-auto sm:my-0"
      >
        <div className="p-8 border-b border-saas-border flex items-center justify-between bg-[#0F172A] text-white">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              {car ? '✏️ Modifier Véhicule' : '🚗 Nouveau Véhicule'}
            </h2>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">
              {lang === 'fr' ? 'Gestion de flotte professionnelle' : 'إدارة الأسطول الاحترافية'}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar bg-saas-bg">
          {/* ── 1. Propriété du véhicule (première décision) ───────────────── */}
          <section className="space-y-6">
            {sectionTitle(<Users size={14} />, lang === 'fr' ? 'Propriété du Véhicule' : 'ملكية المركبة')}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, ownerType: 'personal' }))}
                className={`text-left p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                  !isThirdParty
                    ? 'border-[#DC2626] bg-[#DC2626]/8 shadow-sm'
                    : 'border-saas-border bg-white hover:border-saas-border-strong'
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${!isThirdParty ? 'bg-[#DC2626] text-white' : 'bg-saas-bg text-saas-text-muted'}`}>
                    <User size={17} />
                  </span>
                  <span className="font-black text-saas-text-main">
                    {lang === 'fr' ? 'Voiture personnelle' : 'سيارة شخصية'}
                  </span>
                  {!isThirdParty && (
                    <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-[#DC2626] bg-white border border-[#DC2626]/30 px-2 py-0.5 rounded-full">
                      {lang === 'fr' ? 'Par défaut' : 'افتراضي'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-saas-text-muted leading-relaxed">
                  {lang === 'fr'
                    ? "Le véhicule appartient à l'agence : 100 % des bénéfices lui reviennent."
                    : 'المركبة ملك للوكالة: 100٪ من الأرباح تعود إليها.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, ownerType: 'third_party' }))}
                className={`text-left p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                  isThirdParty
                    ? 'border-[#0284C7] bg-[#0284C7]/8 shadow-sm'
                    : 'border-saas-border bg-white hover:border-saas-border-strong'
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${isThirdParty ? 'bg-[#0284C7] text-white' : 'bg-saas-bg text-saas-text-muted'}`}>
                    <Users size={17} />
                  </span>
                  <span className="font-black text-saas-text-main">
                    {lang === 'fr' ? "Voiture d'une autre personne" : 'سيارة شخص آخر'}
                  </span>
                </div>
                <p className="text-xs text-saas-text-muted leading-relaxed">
                  {lang === 'fr'
                    ? "Véhicule confié par un propriétaire : l'agence perçoit une part fixe par jour de location."
                    : 'مركبة موكلة من مالك: الوكالة تأخذ حصة ثابتة لكل يوم تأجير.'}
                </p>
              </button>
            </div>

            {isThirdParty && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border border-[#0284C7]/25 rounded-2xl p-6">
                  <div className="space-y-2">
                    <label className="label-saas">{lang === 'fr' ? 'Nom du propriétaire' : 'اسم المالك'}</label>
                    <input
                      name="ownerName"
                      value={formData.ownerName || ''}
                      onChange={handleChange}
                      className="input-saas"
                      placeholder={lang === 'fr' ? 'ex: Karim Oukkal' : 'مثال: كريم'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-saas">{lang === 'fr' ? 'Téléphone du propriétaire' : 'هاتف المالك'}</label>
                    <input
                      name="ownerPhone"
                      value={formData.ownerPhone || ''}
                      onChange={handleChange}
                      className="input-saas"
                      placeholder="+213 …"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-saas">
                      {lang === 'fr' ? "Part de l'agence / jour (DA)" : 'حصة الوكالة / يوم (دج)'}
                    </label>
                    <input
                      name="agencySharePerDay"
                      type="number"
                      min={0}
                      value={formData.agencySharePerDay ?? 0}
                      onChange={handleChange}
                      className="input-saas"
                      placeholder="0"
                    />
                    <p className="flex items-start gap-1.5 text-[11px] text-saas-text-muted leading-snug">
                      <Info size={12} className="mt-0.5 shrink-0 text-[#0284C7]" />
                      {lang === 'fr'
                        ? "Montant que l'agence garde sur chaque jour loué ; le reste revient au propriétaire."
                        : 'المبلغ الذي تحتفظ به الوكالة عن كل يوم مؤجر؛ الباقي للمالك.'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </section>

          {/* ── 1bis. Disponibilité par agence (multi-agences) ────────────── */}
          {/* Affiché uniquement s'il existe plusieurs agences (mono-agence = inchangé). */}
          {companies.length > 1 && (
            <section className="space-y-6">
              {sectionTitle(<Building2 size={14} />, lang === 'fr' ? 'Disponible pour' : 'متاحة لـ')}
              <p className="flex items-start gap-2 text-xs text-saas-text-muted leading-relaxed -mt-2">
                <Info size={13} className="mt-0.5 shrink-0 text-saas-primary-via" />
                {lang === 'fr'
                  ? "Choisissez la ou les agences qui exploitent ce véhicule. Une voiture partagée par deux agences reste disponible aux deux (la disponibilité des dates reste commune : pas de double réservation)."
                  : 'اختر الوكالة/الوكالات التي تستغل هذه المركبة. السيارة المشتركة تبقى متاحة للطرفين (تبقى مواعيد الحجز مشتركة: لا حجز مزدوج).'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {companies.map(c => {
                  const selected = (formData.companyIds || []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCompany(c.id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selected ? 'border-saas-primary-via bg-saas-primary-via/8' : 'border-saas-border bg-white hover:border-saas-border-strong'
                      }`}
                    >
                      <span className="w-10 h-10 rounded-xl overflow-hidden border border-saas-border bg-saas-bg flex items-center justify-center shrink-0">
                        {c.logo ? (
                          <img src={c.logo} alt={c.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Building2 size={18} className="text-saas-text-muted" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0 font-black text-saas-text-main truncate">{c.name}</span>
                      <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                        selected ? 'border-saas-primary-via bg-saas-primary-via text-white' : 'border-saas-border'
                      }`}>
                        {selected && <Check size={15} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 2. Media & Photos ─────────────────────────────────────────── */}
          <section className="space-y-6">
            {sectionTitle('📸', 'Media & Photos')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formData.images?.map((img, idx) => (
                <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden border-2 border-white shadow-md group">
                  <img src={img} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-2 right-2 bg-[#DC2626] text-white p-2 rounded-xl hover:bg-[#B91C1C] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <label
                className="aspect-video rounded-2xl border-2 border-dashed border-saas-border bg-white flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#DC2626] hover:bg-[#DC2626]/5 text-saas-text-muted hover:text-[#DC2626] transition-all group"
                onClick={e => { if (uploadingImages) e.preventDefault(); }}
              >
                <div className="w-10 h-10 rounded-xl bg-saas-bg flex items-center justify-center text-saas-text-muted group-hover:text-[#DC2626] transition-colors">
                  {uploadingImages ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {uploadingImages ? 'Upload en cours...' : 'Ajouter des photos'}
                </span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploadingImages} />
              </label>
            </div>
          </section>

          {/* ── 3. Informations Générales ─────────────────────────────────── */}
          <section className="space-y-6">
            {sectionTitle('🏷️', 'Informations Générales')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="label-saas">Marque</label>
                <input name="brand" value={formData.brand} onChange={handleChange} className="input-saas" placeholder="ex: Mercedes-Benz" />
              </div>
              <div className="space-y-2">
                <label className="label-saas">Modèle</label>
                <input name="model" value={formData.model} onChange={handleChange} className="input-saas" placeholder="ex: S-Class" />
              </div>
              <div className="space-y-2">
                <label className="label-saas">Immatriculation</label>
                <input name="registration" value={formData.registration} onChange={handleChange} className="input-saas" placeholder="ex: 12345-123-16" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label-saas">Année</label>
                  <input name="year" type="number" value={formData.year} onChange={handleChange} className="input-saas" />
                </div>
                <div className="space-y-2">
                  <label className="label-saas">Couleur</label>
                  <input name="color" value={formData.color} onChange={handleChange} className="input-saas" placeholder="ex: Obsidian Black" />
                </div>
              </div>
            </div>
          </section>

          {/* ── 4. Fiche Technique ────────────────────────────────────────── */}
          <section className="space-y-6">
            {sectionTitle('⚙️', 'Fiche Technique')}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="space-y-2">
                <label className="label-saas">Énergie</label>
                <select name="energy" value={formData.energy} onChange={handleChange} className="input-saas">
                  <option>Essence</option>
                  <option>Diesel</option>
                  <option>Hybride</option>
                  <option>Électrique</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="label-saas">Boîte</label>
                <select name="transmission" value={formData.transmission} onChange={handleChange} className="input-saas">
                  <option>Manuelle</option>
                  <option>Automatique</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="label-saas">Places</label>
                <input name="seats" type="number" value={formData.seats} onChange={handleChange} className="input-saas" />
              </div>
              <div className="space-y-2">
                <label className="label-saas">Kilométrage</label>
                <input name="mileage" type="number" value={formData.mileage} onChange={handleChange} className="input-saas" />
              </div>
              <div className="space-y-2">
                <label className="label-saas">VIN (Châssis)</label>
                <input name="vin" value={formData.vin} onChange={handleChange} className="input-saas" placeholder="N° châssis" />
              </div>
            </div>
          </section>

          {/* ── 5. Tarification DZD (base de calcul) ──────────────────────── */}
          <section className="space-y-6">
            {sectionTitle(<Wallet size={14} />, lang === 'fr' ? 'Tarification & Caution (DZD — base)' : 'التسعير والضمان (دج)')}

            <div className="flex items-start gap-2.5 rounded-xl bg-[#DC2626]/6 border border-[#DC2626]/20 px-4 py-3">
              <Info size={15} className="text-[#DC2626] shrink-0 mt-0.5" />
              <p className="text-xs text-saas-text-main leading-relaxed">
                {lang === 'fr'
                  ? `Saisissez un prix PAR JOUR pour chaque formule. Les totaux semaine (× ${WEEK_DAYS}) et mois (× ${MONTH_DAYS}) sont calculés automatiquement et servent de base aux réservations.`
                  : `أدخل السعر لليوم الواحد لكل صيغة. يُحسب إجمالي الأسبوع (× ${WEEK_DAYS}) والشهر (× ${MONTH_DAYS}) تلقائياً.`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Tarif à la journée */}
              <div className="space-y-2">
                <label className="label-saas">
                  {lang === 'fr' ? 'Prix / jour (à la journée)' : 'السعر / اليوم (يومي)'}
                </label>
                <div className="relative">
                  <input
                    name="priceDay"
                    type="number"
                    min={0}
                    value={formData.priceDay ?? 0}
                    onChange={handleChange}
                    className="input-saas pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-saas-text-muted pointer-events-none">DA</span>
                </div>
                <p className="text-[11px] text-saas-text-muted font-medium min-h-[1.25rem]">
                  {lang === 'fr' ? 'Locations de moins de 7 jours.' : 'الإيجارات لأقل من 7 أيام.'}
                </p>
              </div>

              {/* Tarif journalier en formule semaine → total ×7 */}
              <div className="space-y-2">
                <label className="label-saas">
                  {lang === 'fr' ? 'Prix / jour (formule semaine)' : 'السعر / اليوم (صيغة أسبوع)'}
                </label>
                <div className="relative">
                  <input
                    name="priceWeek"
                    type="number"
                    min={0}
                    value={formData.priceWeek ?? 0}
                    onChange={handleChange}
                    className="input-saas pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-saas-text-muted pointer-events-none">DA</span>
                </div>
                <p className="text-[11px] font-bold text-[#DC2626] min-h-[1.25rem]">
                  {lang === 'fr' ? 'Total semaine' : 'إجمالي الأسبوع'} :{' '}
                  <span className="font-black">{weekTotalDzd.toLocaleString('fr-FR')} DA</span>
                </p>
              </div>

              {/* Tarif journalier en formule mois → total ×30 */}
              <div className="space-y-2">
                <label className="label-saas">
                  {lang === 'fr' ? 'Prix / jour (formule mois)' : 'السعر / اليوم (صيغة شهر)'}
                </label>
                <div className="relative">
                  <input
                    name="priceMonth"
                    type="number"
                    min={0}
                    value={formData.priceMonth ?? 0}
                    onChange={handleChange}
                    className="input-saas pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-saas-text-muted pointer-events-none">DA</span>
                </div>
                <p className="text-[11px] font-bold text-[#DC2626] min-h-[1.25rem]">
                  {lang === 'fr' ? 'Total mois' : 'إجمالي الشهر'} :{' '}
                  <span className="font-black">{monthTotalDzd.toLocaleString('fr-FR')} DA</span>
                </p>
              </div>

              {/* Caution */}
              <div className="space-y-2">
                <label className="label-saas">{lang === 'fr' ? 'Caution' : 'الضمان'}</label>
                <div className="relative">
                  <input
                    name="deposit"
                    type="number"
                    min={0}
                    value={formData.deposit ?? 0}
                    onChange={handleChange}
                    className="input-saas pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-saas-text-muted pointer-events-none">DA</span>
                </div>
                <p className="text-[11px] text-saas-text-muted font-medium min-h-[1.25rem]">
                  {lang === 'fr' ? 'Bloquée à la remise des clés.' : 'محجوزة عند تسليم المفاتيح.'}
                </p>
              </div>
            </div>

            {/* Récapitulatif des totaux réellement facturés */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-saas-border bg-white px-5 py-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-saas-text-muted">
                  {lang === 'fr' ? `Formule semaine (${WEEK_DAYS} jours)` : `صيغة أسبوع (${WEEK_DAYS} أيام)`}
                </p>
                <p className="text-2xl font-black text-saas-text-main leading-tight mt-1">
                  {weekPerDay.toLocaleString('fr-FR')} <span className="text-sm font-bold text-saas-text-muted">DA / {lang === 'fr' ? 'jour' : 'يوم'}</span>
                </p>
                <p className="text-sm font-bold text-[#DC2626]">
                  ({weekTotalDzd.toLocaleString('fr-FR')} DA {lang === 'fr' ? 'au total' : 'الإجمالي'})
                </p>
              </div>
              <div className="rounded-2xl border border-saas-border bg-white px-5 py-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-saas-text-muted">
                  {lang === 'fr' ? `Formule mois (${MONTH_DAYS} jours)` : `صيغة شهر (${MONTH_DAYS} يوماً)`}
                </p>
                <p className="text-2xl font-black text-saas-text-main leading-tight mt-1">
                  {monthPerDay.toLocaleString('fr-FR')} <span className="text-sm font-bold text-saas-text-muted">DA / {lang === 'fr' ? 'jour' : 'يوم'}</span>
                </p>
                <p className="text-sm font-bold text-[#DC2626]">
                  ({monthTotalDzd.toLocaleString('fr-FR')} DA {lang === 'fr' ? 'au total' : 'الإجمالي'})
                </p>
              </div>
            </div>
          </section>

          {/* ── 6. Autres devises ─────────────────────────────────────────── */}
          <section className="space-y-6">
            {sectionTitle(<Coins size={14} />, lang === 'fr' ? 'Autres Devises' : 'عملات أخرى')}

            <div className="flex items-start gap-2.5 rounded-xl bg-[#0284C7]/8 border border-[#0284C7]/20 px-4 py-3">
              <Info size={15} className="text-[#0284C7] shrink-0 mt-0.5" />
              <p className="text-xs text-saas-text-main leading-relaxed">
                {lang === 'fr'
                  ? "Le dinar reste la référence. Activez une devise et saisissez son taux de change : les prix jour, semaine, mois et la caution sont calculés automatiquement à partir des montants en DZD ci-dessus."
                  : 'الدينار هو المرجع. فعّل عملة وأدخل سعر صرفها: تُحسب أسعار اليوم والأسبوع والشهر والضمان تلقائياً من مبالغ الدينار أعلاه.'}
              </p>
            </div>

            <div className="space-y-4">
              {SECONDARY_CURRENCIES.map(code => {
                const meta = CURRENCIES[code];
                const conf = currencies[code];
                const enabled = !!conf?.enabled;
                const rate = conf?.rate ?? DEFAULT_RATES[code];

                return (
                  <div
                    key={code}
                    className={`rounded-2xl border-2 transition-all overflow-hidden ${
                      enabled ? 'border-[#0284C7]/40 bg-white' : 'border-saas-border bg-white/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleCurrency(code)}
                        className={`relative w-12 h-6.5 rounded-full transition-colors shrink-0 cursor-pointer ${enabled ? 'bg-[#0284C7]' : 'bg-slate-300'}`}
                        style={{ height: 26 }}
                        aria-pressed={enabled}
                        aria-label={`${enabled ? 'Désactiver' : 'Activer'} ${meta.label}`}
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                          className="absolute top-0.5 w-[22px] h-[22px] rounded-full bg-white shadow"
                          style={{ left: enabled ? 24 : 2 }}
                        />
                      </button>

                      <div className="flex items-center gap-2.5 min-w-[190px]">
                        <span className="text-xl">{meta.flag}</span>
                        <div>
                          <p className="font-black text-saas-text-main leading-tight">
                            {meta.code} <span className="text-saas-text-muted font-bold">({meta.symbol})</span>
                          </p>
                          <p className="text-[11px] text-saas-text-muted">{meta.label}</p>
                        </div>
                      </div>

                      {enabled && (
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-saas-text-muted">
                            {lang === 'fr' ? 'Taux de change' : 'سعر الصرف'}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={rate}
                              onChange={e => setRate(code, Number(e.target.value))}
                              className="w-32 bg-white border border-saas-border rounded-xl px-3 py-2 text-right font-bold text-saas-text-main outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/10 transition-all"
                            />
                          </div>
                          <span className="text-xs font-bold text-saas-text-muted whitespace-nowrap">
                            DA / 1 {meta.symbol}
                          </span>
                        </div>
                      )}
                    </div>

                    {enabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden border-t border-saas-border bg-saas-bg"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
                          {priceRows.map(row => {
                            const converted = convertFromDzd(row.dzd, code, rate);
                            const convertedTotal = row.totalDzd !== undefined
                              ? convertFromDzd(row.totalDzd, code, rate)
                              : undefined;
                            return (
                              <div key={row.key} className="rounded-xl bg-white border border-saas-border px-4 py-3">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-saas-text-muted">{row.label}</p>
                                <p className="text-lg font-black text-[#0284C7] leading-tight mt-0.5">
                                  {rate > 0 ? formatCurrency(converted, code) : '—'}
                                </p>
                                <p className="text-[10px] text-saas-text-muted">{row.dzd.toLocaleString('fr-FR')} DA</p>
                                {convertedTotal !== undefined && (
                                  <p className="text-[10px] font-bold text-saas-text-muted mt-0.5">
                                    ({rate > 0 ? formatCurrency(convertedTotal, code) : '—'} {row.totalLabel})
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="p-8 border-t border-saas-border flex items-center justify-between gap-4 bg-white">
          <div>
            {car && onDelete && (
              <button onClick={() => onDelete(car.id)} className="btn-saas-danger px-8 cursor-pointer" disabled={isSubmitting}>
                {lang === 'fr' ? 'Supprimer' : 'حذف'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="btn-saas-outline px-8 cursor-pointer" disabled={isSubmitting}>
              {lang === 'fr' ? 'Annuler' : 'إلغاء'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting || uploadingImages}
              className="btn-saas-primary px-12 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {lang === 'fr' ? 'Enregistrement...' : 'جاري الحفظ...'}
                </>
              ) : (
                lang === 'fr' ? 'Enregistrer le véhicule' : 'حفظ المركبة'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
