import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, TrendingUp, TrendingDown, Wallet, Car as CarIcon,
  ChevronDown, Printer, Loader2, AlertCircle, Users, User,
  Clock, Receipt, PieChart, FileText, Gauge, CheckCircle2, HandCoins,
} from 'lucide-react';
import { Language, Car, ReservationDetails, VehicleExpense } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { ReservationsService } from '../services/ReservationsService';
import { getVehicleExpenses } from '../services/expenseService';
import { generateReportHTML } from './ReportPrintTemplate';
import { generateOwnerReportHTML } from './OwnerReportTemplate';
import { usePermissions } from '../utils/permissions';
import { isCarInActiveCompany } from '../utils/companyContext';

interface CarGainsPageProps {
  lang: Language;
}

const T = (fr: string, ar: string, lang: Language) => (lang === 'fr' ? fr : ar);
const fmt = (n: number) => Math.round(n || 0).toLocaleString('fr-DZ');
const fmtDA = (n: number) => `${fmt(n)} DA`;
const fmtD = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

/** Montant réellement encaissé sur une réservation. */
const calcPaid = (r: ReservationDetails): number => {
  const payments = (r.payments || []) as any[];
  if (payments.length > 0) {
    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (total > 0) return total;
  }
  return Math.max(0, (Number(r.totalPrice) || 0) - (Number(r.remainingPayment) || 0));
};

const inRange = (dateStr: string, startDate: string, endDate: string): boolean => {
  if (!dateStr) return false;
  const d = dateStr.substring(0, 10);
  return (!startDate || d >= startDate) && (!endDate || d <= endDate);
};

/** Ouvre une iframe cachée et lance l'impression du HTML fourni. */
const printHtml = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* déjà retiré */ } }, 800);
  }, 350);
};

export const CarGainsPage: React.FC<CarGainsPageProps> = ({ lang }) => {
  const { can } = usePermissions();
  // La part agence est une donnée sensible : masquée si l'employé n'y a pas droit.
  const maySeeAgencyShare = can('car-gains', 'view_agency_share');

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [expandedRes, setExpandedRes] = useState<string | null>(null);
  const [expandedExp, setExpandedExp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Multi-agences : un admin scoppé ne voit que les voitures de son agence.
        const [carsData, links] = await Promise.all([
          DatabaseService.getCars(),
          DatabaseService.getCarCompanyLinks(),
        ]);
        const scoped = carsData.filter(c => isCarInActiveCompany(c.id, links));
        setCars(scoped);
        if (scoped.length > 0) setSelectedCarId(scoped[0].id);
      } catch (err) {
        console.error('Error loading cars:', err);
      }
    })();
  }, []);

  const handleGenerate = async () => {
    if (!selectedCarId || !startDate || !endDate) {
      setError(T('Sélectionnez un véhicule et une période.', 'اختر مركبة وفترة.', lang));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const [resList, expList] = await Promise.all([
        ReservationsService.getReservations(),
        (async () => (await getVehicleExpenses()).expenses || [])(),
      ]);

      const carRes = resList
        .filter(r => (r.carId || r.car?.id) === selectedCarId
          && inRange(r.step1?.departureDate || r.createdAt || '', startDate, endDate))
        .sort((a, b) => (b.step1?.departureDate || '').localeCompare(a.step1?.departureDate || ''));

      const carExp = (expList as VehicleExpense[])
        .filter(e => e.carId === selectedCarId && inRange(e.date, startDate, endDate))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setReservations(carRes);
      setExpenses(carExp);
      setGenerated(true);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err?.message || T('Erreur lors du chargement des données.', 'خطأ في تحميل البيانات.', lang));
    } finally {
      setLoading(false);
    }
  };

  const selectedCar = cars.find(c => c.id === selectedCarId);

  // ── Calculs financiers ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = reservations.filter(r => r.status !== 'cancelled');
    const totalPaid = active.reduce((s, r) => s + calcPaid(r), 0);
    const totalInvoiced = active.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0);
    const totalRemaining = reservations
      .filter(r => !['completed', 'cancelled'].includes(r.status))
      .reduce((s, r) => s + (Number(r.remainingPayment) || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);
    const rentedDays = active.reduce((s, r) => s + (Number(r.totalDays) || 0), 0);
    const netBenefit = totalPaid - totalExpenses;

    // Répartition agence / propriétaire pour un véhicule confié par un tiers :
    // l'agence garde `agencySharePerDay` × jours loués (plafonné aux recettes),
    // le propriétaire reçoit le reste, diminué des dépenses du véhicule.
    const isThirdParty = selectedCar?.ownerType === 'third_party';
    const sharePerDay = Number(selectedCar?.agencySharePerDay) || 0;
    const agencyShare = isThirdParty ? Math.min(totalPaid, sharePerDay * rentedDays) : totalPaid;
    const ownerBenefit = isThirdParty ? Math.max(0, totalPaid - agencyShare - totalExpenses) : 0;
    const agencyNet = isThirdParty ? agencyShare : netBenefit;

    return {
      active, totalPaid, totalInvoiced, totalRemaining, totalExpenses,
      rentedDays, netBenefit, isThirdParty, sharePerDay, agencyShare, ownerBenefit, agencyNet,
    };
  }, [reservations, expenses, selectedCar]);

  // ── Impressions ──────────────────────────────────────────────────────────
  const handlePrintFull = async () => {
    if (!selectedCar) return;
    try {
      const agencySettings = await DatabaseService.getWebsiteSettings();
      printHtml(generateReportHTML(selectedCar, reservations, expenses, startDate, endDate, agencySettings, lang));
    } catch (err) {
      console.error('Error printing report:', err);
      setError(T("Erreur lors de l'impression.", 'خطأ في الطباعة.', lang));
    }
  };

  /** Rapport remis au propriétaire : la part de l'agence n'y figure jamais. */
  const handlePrintOwner = async () => {
    if (!selectedCar) return;
    try {
      const agencySettings = await DatabaseService.getWebsiteSettings();
      printHtml(generateOwnerReportHTML({
        car: selectedCar,
        reservations,
        expenses,
        startDate,
        endDate,
        agencySettings,
        lang,
        totalCollected: stats.totalPaid,
        totalExpenses: stats.totalExpenses,
        ownerBenefit: stats.ownerBenefit,
        rentedDays: stats.rentedDays,
      }));
    } catch (err) {
      console.error('Error printing owner report:', err);
      setError(T("Erreur lors de l'impression.", 'خطأ في الطباعة.', lang));
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: T('Total facturé', 'الإجمالي المفوتر', lang),
      value: fmtDA(stats.totalInvoiced),
      sub: `${stats.active.length} ${T('location(s)', 'إيجار', lang)}`,
      icon: <FileText className="w-5 h-5" />,
      bar: 'bg-[#0F172A]', text: 'text-[#0F172A]',
    },
    {
      label: T('Encaissé', 'المحصّل', lang),
      value: fmtDA(stats.totalPaid),
      sub: T('Recettes réelles', 'الإيرادات الفعلية', lang),
      icon: <HandCoins className="w-5 h-5" />,
      bar: 'bg-[#0284C7]', text: 'text-[#0284C7]',
    },
    {
      label: T('Dépenses', 'المصاريف', lang),
      value: fmtDA(stats.totalExpenses),
      sub: `${expenses.length} ${T('poste(s)', 'بند', lang)}`,
      icon: <Receipt className="w-5 h-5" />,
      bar: 'bg-[#DC2626]', text: 'text-[#DC2626]',
    },
    {
      label: T('Bénéfice net', 'صافي الربح', lang),
      value: fmtDA(stats.netBenefit),
      sub: stats.netBenefit >= 0 ? T('Profit', 'ربح', lang) : T('Perte', 'خسارة', lang),
      icon: stats.netBenefit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />,
      bar: stats.netBenefit >= 0 ? 'bg-emerald-600' : 'bg-orange-500',
      text: stats.netBenefit >= 0 ? 'text-emerald-600' : 'text-orange-600',
    },
  ];

  return (
    <div className="space-y-7 pb-10">
      {/* ── En-tête + filtres ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl bg-[#0F172A] text-white"
      >
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-[#DC2626]/20 blur-3xl" />
        <div className="absolute -left-16 -bottom-24 w-64 h-64 rounded-full bg-[#0284C7]/20 blur-3xl" />

        <div className="relative p-8">
          <div className="flex items-center gap-4 mb-7">
            <span className="w-14 h-14 rounded-2xl bg-[#DC2626] flex items-center justify-center shadow-lg shadow-[#DC2626]/30">
              <PieChart className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase">
                {T('Bénéfices par voiture', 'أرباح كل سيارة', lang)}
              </h1>
              <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.25em] mt-1.5">
                {T('Locations · Dépenses · Répartition des bénéfices', 'الإيجارات · المصاريف · توزيع الأرباح', lang)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-black text-white/50 mb-2 uppercase tracking-[0.18em]">
                {T('Véhicule', 'المركبة', lang)}
              </label>
              <select
                value={selectedCarId}
                onChange={e => { setSelectedCarId(e.target.value); setGenerated(false); }}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white outline-none text-sm font-semibold backdrop-blur-sm hover:bg-white/15 focus:border-[#DC2626] transition-all cursor-pointer"
              >
                <option value="" className="bg-[#0F172A]">
                  {T('-- Choisir une voiture --', '-- اختر سيارة --', lang)}
                </option>
                {cars.map(car => (
                  <option key={car.id} value={car.id} className="bg-[#0F172A]">
                    {car.brand} {car.model} ({car.registration})
                    {car.ownerType === 'third_party' ? ` — ${car.ownerName || T('Tiers', 'طرف ثالث', lang)}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-white/50 mb-2 uppercase tracking-[0.18em]">
                {T('Du', 'من', lang)}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white outline-none text-sm font-semibold backdrop-blur-sm focus:border-[#DC2626] transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-white/50 mb-2 uppercase tracking-[0.18em]">
                {T('Au', 'إلى', lang)}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white outline-none text-sm font-semibold backdrop-blur-sm focus:border-[#DC2626] transition-all"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedCarId}
              className="btn-vel-cta px-8 py-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" />{T('Analyse…', 'جاري التحليل…', lang)}</>
                : <><TrendingUp size={16} />{T('Analyser la période', 'تحليل الفترة', lang)}</>}
            </button>

            {selectedCar && (
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border ${
                selectedCar.ownerType === 'third_party'
                  ? 'bg-[#0284C7]/15 border-[#0284C7]/40 text-[#7DD3FC]'
                  : 'bg-white/10 border-white/20 text-white/70'
              }`}>
                {selectedCar.ownerType === 'third_party' ? <Users size={13} /> : <User size={13} />}
                {selectedCar.ownerType === 'third_party'
                  ? `${T('Voiture de', 'سيارة', lang)} ${selectedCar.ownerName || T('tiers', 'طرف ثالث', lang)}`
                  : T('Voiture de l’agence', 'سيارة الوكالة', lang)}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-5">
          <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── État vide ────────────────────────────────────────────────── */}
        {!generated && !loading && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="glass-card py-20 text-center"
          >
            <CarIcon className="w-16 h-16 mx-auto mb-4 text-saas-text-muted opacity-25" />
            <p className="text-lg font-black text-saas-text-main mb-1">
              {T('Prêt à analyser les bénéfices ?', 'مستعد لتحليل الأرباح؟', lang)}
            </p>
            <p className="text-sm text-saas-text-muted max-w-md mx-auto">
              {T('Choisissez un véhicule et une période, puis lancez l’analyse pour voir toutes les locations, les dépenses et la répartition des bénéfices.',
                 'اختر مركبة وفترة، ثم شغّل التحليل لعرض كل الإيجارات والمصاريف وتوزيع الأرباح.', lang)}
            </p>
          </motion.div>
        )}

        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="h-28 rounded-3xl vel-skeleton" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl vel-skeleton" />)}
            </div>
          </motion.div>
        )}

        {/* ── Résultats ────────────────────────────────────────────────── */}
        {generated && !loading && selectedCar && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Fiche véhicule */}
            <div className="bg-white rounded-3xl border border-saas-border overflow-hidden">
              <span className="block h-1 bg-linear-to-r from-[#DC2626] to-[#0284C7]" />
              <div className="flex flex-col sm:flex-row items-center gap-6 p-6">
                <div className="w-40 h-28 rounded-2xl overflow-hidden shrink-0 bg-saas-bg border border-saas-border">
                  <img
                    src={selectedCar.images?.[0] || 'https://picsum.photos/seed/car/400/300'}
                    alt={`${selectedCar.brand} ${selectedCar.model}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                    {selectedCar.brand} {selectedCar.model}
                  </h2>
                  <p className="text-[#DC2626] font-black text-sm tracking-wide">{selectedCar.registration}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-saas-bg border border-saas-border text-saas-text-main px-3 py-1.5 rounded-lg">
                      <Calendar size={12} className="text-[#0284C7]" />{selectedCar.year}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-saas-bg border border-saas-border text-saas-text-main px-3 py-1.5 rounded-lg">
                      ⛽ {selectedCar.energy}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-saas-bg border border-saas-border text-saas-text-main px-3 py-1.5 rounded-lg">
                      <Gauge size={12} className="text-[#0284C7]" />{(selectedCar.mileage || 0).toLocaleString('fr-DZ')} km
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-saas-bg border border-saas-border text-saas-text-main px-3 py-1.5 rounded-lg">
                      <Clock size={12} className="text-[#0284C7]" />{stats.rentedDays} {T('jours loués', 'يوم مؤجر', lang)}
                    </span>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-saas-text-muted">
                    {T('Période analysée', 'الفترة المحللة', lang)}
                  </p>
                  <p className="font-black text-saas-text-main mt-1">{fmtD(startDate)}</p>
                  <p className="text-saas-text-muted text-sm">→ {fmtD(endDate)}</p>
                </div>
              </div>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 anim-stagger">
              {kpis.map(kpi => (
                <div key={kpi.label} className="relative bg-white rounded-2xl border border-saas-border p-5 overflow-hidden hover-lift">
                  <span className={`absolute inset-y-0 left-0 w-1 ${kpi.bar}`} />
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-saas-text-muted leading-tight pr-2">
                      {kpi.label}
                    </p>
                    <span className={kpi.text}>{kpi.icon}</span>
                  </div>
                  <p className={`text-xl font-black leading-tight ${kpi.text}`}>{kpi.value}</p>
                  <p className="text-[11px] text-saas-text-muted mt-1 font-semibold">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Répartition agence / propriétaire (véhicule confié) */}
            {stats.isThirdParty && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-saas-border overflow-hidden"
              >
                <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-black uppercase tracking-tight flex items-center gap-2.5">
                    <Users size={17} className="text-[#0284C7]" />
                    {T('Répartition des bénéfices', 'توزيع الأرباح', lang)}
                  </h3>
                  <span className="text-[11px] font-bold text-white/60">
                    {T('Part agence', 'حصة الوكالة', lang)} : {fmtDA(stats.sharePerDay)}/{T('jour', 'يوم', lang)} × {stats.rentedDays} {T('j', 'ي', lang)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                  <div className="rounded-2xl border border-saas-border p-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-saas-text-muted">
                      {T('Recettes encaissées', 'الإيرادات المحصلة', lang)}
                    </p>
                    <p className="text-2xl font-black text-[#0284C7] mt-1.5">{fmtDA(stats.totalPaid)}</p>
                  </div>

                  {maySeeAgencyShare ? (
                    <div className="rounded-2xl border-2 border-[#DC2626]/30 bg-[#DC2626]/5 p-5">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#DC2626]">
                        {T("Part de l'agence", 'حصة الوكالة', lang)}
                      </p>
                      <p className="text-2xl font-black text-[#DC2626] mt-1.5">{fmtDA(stats.agencyShare)}</p>
                      <p className="text-[11px] text-saas-text-muted mt-1">
                        {T('Non affichée sur le rapport propriétaire', 'لا تظهر في تقرير المالك', lang)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-saas-border p-5 flex items-center justify-center text-center">
                      <p className="text-xs text-saas-text-muted font-semibold">
                        {T("Part de l'agence masquée (permission requise)", 'حصة الوكالة مخفية (تتطلب صلاحية)', lang)}
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50 p-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      {T('Revenant au propriétaire', 'العائد للمالك', lang)}
                    </p>
                    <p className="text-2xl font-black text-emerald-700 mt-1.5">{fmtDA(stats.ownerBenefit)}</p>
                    <p className="text-[11px] text-emerald-700/70 mt-1">
                      {selectedCar.ownerName || '—'}{selectedCar.ownerPhone ? ` · ${selectedCar.ownerPhone}` : ''}
                    </p>
                  </div>
                </div>

                {/* Barre de répartition */}
                {stats.totalPaid > 0 && maySeeAgencyShare && (
                  <div className="px-6 pb-6">
                    <div className="h-3 rounded-full overflow-hidden bg-saas-bg border border-saas-border flex">
                      <div
                        className="bg-[#DC2626] h-full"
                        style={{ width: `${Math.min(100, (stats.agencyShare / stats.totalPaid) * 100)}%` }}
                        title={T("Part agence", 'حصة الوكالة', lang)}
                      />
                      <div
                        className="bg-[#DC2626]/25 h-full"
                        style={{ width: `${Math.min(100, (stats.totalExpenses / stats.totalPaid) * 100)}%` }}
                        title={T('Dépenses', 'المصاريف', lang)}
                      />
                      <div className="bg-emerald-500 h-full flex-1" title={T('Propriétaire', 'المالك', lang)} />
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3 text-[11px] font-bold text-saas-text-muted">
                      <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-[#DC2626] inline-block" />{T('Agence', 'الوكالة', lang)}</span>
                      <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-[#DC2626]/25 inline-block" />{T('Dépenses', 'المصاريف', lang)}</span>
                      <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />{T('Propriétaire', 'المالك', lang)}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Locations */}
            <div className="bg-white rounded-3xl border border-saas-border overflow-hidden">
              <div className="px-6 py-4 border-b border-saas-border flex items-center justify-between bg-saas-bg">
                <h3 className="font-black uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <Calendar size={17} className="text-[#0284C7]" />
                  {T('Locations', 'الإيجارات', lang)}
                  <span className="text-xs font-bold text-saas-text-muted">({reservations.length})</span>
                </h3>
                <span className="text-sm font-black text-[#0284C7]">+{fmtDA(stats.totalPaid)}</span>
              </div>

              {reservations.length === 0 ? (
                <p className="py-12 text-center text-sm text-saas-text-muted font-semibold">
                  {T('Aucune location sur cette période', 'لا توجد إيجارات في هذه الفترة', lang)}
                </p>
              ) : (
                <div className="divide-y divide-saas-border">
                  {reservations.map(res => {
                    const paid = calcPaid(res);
                    const debt = Number(res.remainingPayment) || 0;
                    const total = Number(res.totalPrice) || 0;
                    const isOpen = expandedRes === res.id;

                    return (
                      <div key={res.id}>
                        <button
                          onClick={() => setExpandedRes(isOpen ? null : res.id)}
                          className="w-full text-left px-6 py-4 hover:bg-saas-bg transition-colors flex items-center gap-4 cursor-pointer"
                        >
                          <span className={`w-2 h-10 rounded-full shrink-0 ${
                            res.status === 'cancelled' ? 'bg-slate-300'
                              : res.status === 'completed' ? 'bg-emerald-500'
                              : res.status === 'active' ? 'bg-[#0284C7]' : 'bg-[#DC2626]'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-saas-text-main truncate">
                              {res.client?.firstName} {res.client?.lastName}
                            </p>
                            <p className="text-xs text-saas-text-muted flex items-center gap-1.5 mt-0.5">
                              <Clock size={12} />
                              {fmtD(res.step1?.departureDate)} → {fmtD(res.step1?.returnDate)}
                              <span className="font-bold">({res.totalDays} j)</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-emerald-600 flex items-center gap-1 justify-end">
                              <CheckCircle2 size={14} />{fmtDA(paid)}
                            </p>
                            {debt > 0 && <p className="text-xs font-bold text-[#DC2626] mt-0.5">{T('Reste', 'المتبقي', lang)} {fmtDA(debt)}</p>}
                          </div>
                          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-saas-text-muted shrink-0">
                            <ChevronDown size={18} />
                          </motion.span>
                        </button>

                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden bg-saas-bg border-t border-saas-border"
                            >
                              <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                  { l: T('Total', 'الإجمالي', lang), v: fmtDA(total), c: 'text-saas-text-main' },
                                  { l: T('Avance', 'الدفعة الأولى', lang), v: fmtDA(Number(res.advancePayment) || 0), c: 'text-[#0284C7]' },
                                  { l: T('Payé', 'المدفوع', lang), v: fmtDA(paid), c: 'text-emerald-600' },
                                  { l: T('Reste', 'المتبقي', lang), v: fmtDA(debt), c: debt > 0 ? 'text-[#DC2626]' : 'text-emerald-600' },
                                ].map(cell => (
                                  <div key={cell.l} className="bg-white rounded-xl border border-saas-border p-3">
                                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-saas-text-muted">{cell.l}</p>
                                    <p className={`font-black mt-1 ${cell.c}`}>{cell.v}</p>
                                  </div>
                                ))}
                              </div>
                              {stats.isThirdParty && maySeeAgencyShare && (
                                <div className="px-6 pb-4 flex flex-wrap gap-3 text-xs">
                                  <span className="px-3 py-1.5 rounded-lg bg-[#DC2626]/8 border border-[#DC2626]/20 font-bold text-[#DC2626]">
                                    {T('Part agence', 'حصة الوكالة', lang)} : {fmtDA(stats.sharePerDay * (Number(res.totalDays) || 0))}
                                  </span>
                                  <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 font-bold text-emerald-700">
                                    {T('Part propriétaire', 'حصة المالك', lang)} : {fmtDA(Math.max(0, paid - stats.sharePerDay * (Number(res.totalDays) || 0)))}
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dépenses */}
            <div className="bg-white rounded-3xl border border-saas-border overflow-hidden">
              <div className="px-6 py-4 border-b border-saas-border flex items-center justify-between bg-saas-bg">
                <h3 className="font-black uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <Receipt size={17} className="text-[#DC2626]" />
                  {T('Dépenses', 'المصاريف', lang)}
                  <span className="text-xs font-bold text-saas-text-muted">({expenses.length})</span>
                </h3>
                <span className="text-sm font-black text-[#DC2626]">−{fmtDA(stats.totalExpenses)}</span>
              </div>

              {expenses.length === 0 ? (
                <p className="py-12 text-center text-sm text-saas-text-muted font-semibold">
                  {T('Aucune dépense sur cette période', 'لا توجد مصاريف في هذه الفترة', lang)}
                </p>
              ) : (
                <div className="divide-y divide-saas-border">
                  {expenses.map(exp => {
                    const isOpen = expandedExp === exp.id;
                    return (
                      <div key={exp.id}>
                        <button
                          onClick={() => setExpandedExp(isOpen ? null : exp.id)}
                          className="w-full text-left px-6 py-4 hover:bg-saas-bg transition-colors flex items-center gap-4 cursor-pointer"
                        >
                          <span className="w-2 h-10 rounded-full bg-[#DC2626] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-saas-text-main truncate">
                              {exp.expenseName || (exp.type || '').toUpperCase()}
                            </p>
                            <p className="text-xs text-saas-text-muted flex items-center gap-1.5 mt-0.5">
                              <Calendar size={12} />{fmtD(exp.date)}
                            </p>
                          </div>
                          <p className="font-black text-[#DC2626] shrink-0">−{fmtDA(Number(exp.cost) || 0)}</p>
                          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-saas-text-muted shrink-0">
                            <ChevronDown size={18} />
                          </motion.span>
                        </button>

                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden bg-saas-bg border-t border-saas-border"
                            >
                              <div className="px-6 py-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-saas-text-muted">{T('Type', 'النوع', lang)}</span>
                                  <span className="font-bold text-saas-text-main capitalize">{exp.type}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-saas-text-muted">{T('Montant', 'المبلغ', lang)}</span>
                                  <span className="font-black text-[#DC2626]">{fmtDA(Number(exp.cost) || 0)}</span>
                                </div>
                                {exp.note && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-saas-text-muted">{T('Note', 'ملاحظة', lang)}</span>
                                    <span className="text-saas-text-main text-right">{exp.note}</span>
                                  </div>
                                )}
                                {exp.currentMileage ? (
                                  <div className="flex justify-between">
                                    <span className="text-saas-text-muted">{T('Kilométrage', 'العداد', lang)}</span>
                                    <span className="text-saas-text-main font-bold">{exp.currentMileage.toLocaleString('fr-DZ')} km</span>
                                  </div>
                                ) : null}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Résumé financier */}
            <div className="bg-white rounded-3xl border border-saas-border overflow-hidden">
              <div className="px-6 py-4 border-b border-saas-border bg-saas-bg">
                <h3 className="font-black uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <Wallet size={17} className="text-[#0F172A]" />
                  {T('Résumé financier', 'الملخص المالي', lang)}
                </h3>
              </div>

              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  { l: T('Facturé', 'المفوتر', lang), v: stats.totalInvoiced, c: 'text-[#0F172A]' },
                  { l: T('Encaissé', 'المحصّل', lang), v: stats.totalPaid, c: 'text-[#0284C7]' },
                  { l: T('Reste dû', 'المتبقي', lang), v: stats.totalRemaining, c: 'text-orange-600' },
                  { l: T('Dépenses', 'المصاريف', lang), v: stats.totalExpenses, c: 'text-[#DC2626]' },
                ].map(item => (
                  <div key={item.l} className="text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-saas-text-muted mb-2">{item.l}</p>
                    <p className={`text-2xl font-black ${item.c}`}>{fmt(item.v)}</p>
                    <p className="text-[10px] text-saas-text-muted mt-0.5">DZD</p>
                  </div>
                ))}
              </div>

              <div className={`border-t border-saas-border px-6 py-5 flex flex-wrap items-center justify-between gap-3 ${
                stats.netBenefit >= 0 ? 'bg-emerald-50' : 'bg-orange-50'
              }`}>
                <span className={`font-black uppercase tracking-tight ${stats.netBenefit >= 0 ? 'text-emerald-800' : 'text-orange-800'}`}>
                  {stats.isThirdParty
                    ? T("Bénéfice net agence", 'صافي ربح الوكالة', lang)
                    : T('Bénéfice net', 'صافي الربح', lang)}
                </span>
                <span className={`text-3xl font-black ${stats.netBenefit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {stats.isThirdParty
                    ? (maySeeAgencyShare ? fmtDA(stats.agencyNet) : '•••')
                    : `${stats.netBenefit >= 0 ? '+' : ''}${fmtDA(stats.netBenefit)}`}
                </span>
              </div>
            </div>

            {/* Impressions */}
            {can('car-gains', 'print') && (
              <div className="flex flex-wrap justify-center gap-4 pt-2">
                <button onClick={handlePrintFull} className="btn-vel-outline-cyan px-8 py-3 text-xs">
                  <Printer size={16} />
                  {T('Rapport complet (interne)', 'التقرير الكامل (داخلي)', lang)}
                </button>
                {stats.isThirdParty && (
                  <button onClick={handlePrintOwner} className="btn-vel-cta px-8 py-3 text-xs">
                    <Printer size={16} />
                    {T('Rapport propriétaire', 'تقرير المالك', lang)}
                  </button>
                )}
              </div>
            )}
            {stats.isThirdParty && can('car-gains', 'print') && (
              <p className="text-center text-[11px] text-saas-text-muted">
                {T("Le rapport propriétaire n'affiche jamais la part de l'agence.",
                   'تقرير المالك لا يعرض أبداً حصة الوكالة.', lang)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CarGainsPage;
