import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Car, Company, Language, MaintenanceType, VehicleExpense } from '../types';
import { MaintenanceCard } from './MaintenanceCard';
import { CarModal } from './CarModal';
import { VehicleExpenseModal } from './VehicleExpenseModal';
import { MaintenanceTypeModal } from './MaintenanceTypeModal';
import { ConfirmModal } from './ConfirmModal';
import { MaintenanceStatus, getMaintenanceStatus } from '../services/maintenanceService';
import {
  addMaintenanceType,
  deleteMaintenanceType,
  getMaintenanceTypes,
  paletteOf,
  typeLabel,
  updateMaintenanceType,
} from '../services/maintenanceTypeService';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Loader2, RefreshCw, Plus, Wrench, AlertTriangle, Clock,
  CheckCircle2, Coins, Settings2, Pencil, Trash2, ChevronDown, Database,
} from 'lucide-react';
import { getCars, updateCar } from '../services/carService';
import { addVehicleExpense, getVehicleExpenses } from '../services/expenseService';
import { DatabaseService } from '../services/DatabaseService';
import { companyContext } from '../utils/companyContext';

interface MaintenancePageProps {
  lang: Language;
  isAuthLoading?: boolean;
  user?: any;
}

type StatusFilter = 'all' | 'critical' | 'warning' | 'success';

export const MaintenancePage: React.FC<MaintenancePageProps> = ({
  lang,
  isAuthLoading = false,
  user = null,
}) => {
  const location = useLocation();
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const [cars, setCars] = useState<Car[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceStatus[]>([]);
  const [types, setTypes] = useState<MaintenanceType[]>([]);
  const [typesFallback, setTypesFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');

  // ── Multi-agences ────────────────────────────────────────────────────────
  // Le parc `cars` est PARTAGÉ : la maintenance couvre TOUTES les voitures de
  // TOUTES les agences, quelle que soit l'agence active. Les liens
  // voiture↔agence servent uniquement à l'affichage (badges) et au filtre
  // facultatif ci-dessous ('all' par défaut = parc complet).
  const [companies, setCompanies] = useState<Company[]>([]);
  const [carLinks, setCarLinks] = useState<Record<string, string[]>>({});
  const [companyFilter, setCompanyFilter] = useState<string>('all');

  /** Agences effectives d'une voiture : ses liens, ou l'agence principale. */
  const carCompanyIds = (carId: string): string[] => {
    const ids = carLinks[carId] || [];
    if (ids.length > 0) return ids;
    const primaryId = companyContext.getPrimaryCompanyId();
    return primaryId ? [primaryId] : [];
  };

  /** Badges d'agence affichés sur la carte de maintenance. */
  const carCompanyBadges = (carId: string): { id: string; name: string }[] =>
    carCompanyIds(carId)
      .map(id => companies.find(c => c.id === id))
      .filter((c): c is Company => !!c)
      .map(c => ({ id: c.id, name: c.name }));

  // Modales
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [prefilledExpense, setPrefilledExpense] = useState<Partial<VehicleExpense> | undefined>(undefined);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);

  // Gestion des types de dépenses
  const [showTypes, setShowTypes] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<MaintenanceType | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [pendingTypeKey, setPendingTypeKey] = useState<string | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<MaintenanceType | null>(null);

  /**
   * Ouvre TOUJOURS le formulaire en CRÉATION.
   *
   * Le gabarit renvoyé ne porte jamais d'`id` : la fenêtre affiche donc
   * « Nouvelle dépense » et l'enregistrement insère une nouvelle ligne.
   */
  const openNewExpense = (car: Car, type?: MaintenanceType) => {
    const today = new Date().toISOString().split('T')[0];
    const resolved = type || types[0];

    setSelectedCar(car);
    setExpenseError(null);
    setPendingTypeKey(null);
    setPrefilledExpense({
      // Pas d'`id` : création, jamais édition.
      carId: car.id,
      type: resolved?.key || 'autre',
      cost: 0,
      note: '',
      date: today,
      currentMileage: car.mileage,
      ...(resolved?.tracking === 'mileage'
        ? { nextVidangeKm: resolved.defaultIntervalKm ?? 10000 }
        : {}),
      ...(resolved?.tracking === 'date'
        ? {
            expirationDate: new Date(
              Date.now() + (resolved.defaultIntervalDays ?? 365) * 86400000
            ).toISOString().split('T')[0],
          }
        : {}),
    });
    setIsExpenseModalOpen(true);
  };

  // ── Chargement ─────────────────────────────────────────────────────────
  const loadCarsData = async () => {
    try {
      setLoading(true);

      const typesResult = await getMaintenanceTypes();
      setTypes(typesResult.types);
      setTypesFallback(typesResult.usingFallback);

      const [result, links, companyList] = await Promise.all([
        getCars(),
        DatabaseService.getCarCompanyLinks(),
        DatabaseService.getCompanies().catch(() => [] as Company[]),
      ]);
      setCarLinks(links);
      setCompanies(companyList);
      if (result.success && result.cars) {
        // AUCUN filtre d'agence : le suivi de maintenance porte sur le parc
        // entier, toutes agences confondues.
        const mappedCars: Car[] = result.cars.map(dbCar => ({
          id: dbCar.id || '',
          brand: dbCar.brand,
          model: dbCar.model,
          registration: dbCar.plate_number,
          year: dbCar.year,
          color: dbCar.color || 'Premium',
          vin: dbCar.vin || '',
          energy: dbCar.energy || 'Essence',
          transmission: dbCar.transmission || 'Automatique',
          seats: dbCar.seats || 5,
          doors: dbCar.doors || 4,
          priceDay: Math.round(Number(dbCar.price_per_day)),
          priceWeek: Math.round(Number(dbCar.price_week || dbCar.price_per_day)),
          priceMonth: Math.round(Number(dbCar.price_month || dbCar.price_per_day)),
          deposit: Math.round(Number(dbCar.deposit || dbCar.price_per_day * 2)),
          images: dbCar.image_url ? [dbCar.image_url] : ['https://picsum.photos/seed/car/400/300'],
          mileage: dbCar.mileage || 0,
          status: (dbCar.status || 'disponible') as Car['status'],
        }));

        setCars(mappedCars);

        const expensesResult = await getVehicleExpenses();
        const allExpenses = expensesResult.expenses || [];

        const maintenanceStatus = await getMaintenanceStatus(
          mappedCars,
          allExpenses,
          typesResult.types
        );
        setMaintenanceData(maintenanceStatus);
      }
    } catch (err) {
      console.error('Error loading cars:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) return;
    loadCarsData();
  }, [user, isAuthLoading]);

  // Arrivée depuis une alerte du tableau de bord
  useEffect(() => {
    const state = location.state as any;
    if (
      state &&
      typeof state.selectedCarId === 'string' && state.selectedCarId.length > 0 &&
      typeof state.expenseType === 'string' && state.expenseType.length > 0 &&
      state.showExpenseModal === true
    ) {
      const car = cars.find(c => c.id === state.selectedCarId);
      if (car) {
        openNewExpense(car, types.find(t => t.key === state.expenseType));
        window.history.replaceState({}, document.title);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, cars, types]);

  // ── Véhicule ───────────────────────────────────────────────────────────
  const handleEditCar = (car: Car) => {
    setSelectedCar(car);
    setIsCarModalOpen(true);
  };

  const handleSaveCar = async (carData: Partial<Car>) => {
    try {
      if (selectedCar) {
        const updateData = {
          brand: carData.brand || selectedCar.brand,
          model: carData.model || selectedCar.model,
          year: carData.year || selectedCar.year,
          plate_number: carData.registration || selectedCar.registration,
          price_per_day: carData.priceDay || selectedCar.priceDay,
          status: carData.status || selectedCar.status || 'disponible',
          image_url: carData.images?.[0] || selectedCar.images[0],
          color: carData.color || selectedCar.color,
          vin: carData.vin || selectedCar.vin,
          energy: carData.energy || selectedCar.energy,
          transmission: carData.transmission || selectedCar.transmission,
          seats: carData.seats || selectedCar.seats,
          doors: carData.doors || selectedCar.doors,
          price_week: carData.priceWeek || selectedCar.priceWeek,
          price_month: carData.priceMonth || selectedCar.priceMonth,
          deposit: carData.deposit || selectedCar.deposit,
          mileage: carData.mileage || selectedCar.mileage,
        };
        const result = await updateCar(selectedCar.id, updateData);
        if (result.success) await loadCarsData();
      }
      setIsCarModalOpen(false);
      setSelectedCar(null);
    } catch (err) {
      console.error('Error updating car:', err);
    }
  };

  // ── Dépense ────────────────────────────────────────────────────────────
  /**
   * Enregistre une NOUVELLE dépense en base (table `vehicle_expenses`).
   * Elle alimente aussi bien les compteurs de cette page que l'historique du
   * véhicule affiché dans la page Dépenses.
   */
  const handleSaveExpense = async (expenseData: Partial<VehicleExpense>) => {
    const carId = expenseData.carId || selectedCar?.id;
    if (!carId) {
      setExpenseError(T('Sélectionnez un véhicule.', 'اختر مركبة.'));
      return;
    }

    setSavingExpense(true);
    setExpenseError(null);
    try {
      const result = await addVehicleExpense({
        carId,
        type: expenseData.type || 'autre',
        cost: Number(expenseData.cost) || 0,
        date: expenseData.date || new Date().toISOString().split('T')[0],
        note: expenseData.note || '',
        currentMileage: expenseData.currentMileage ?? selectedCar?.mileage ?? 0,
        nextVidangeKm: expenseData.nextVidangeKm || undefined,
        expirationDate: expenseData.expirationDate || undefined,
        expenseName: expenseData.expenseName || '',
        oilFilterChanged: expenseData.oilFilterChanged || false,
        airFilterChanged: expenseData.airFilterChanged || false,
        fuelFilterChanged: expenseData.fuelFilterChanged || false,
        acFilterChanged: expenseData.acFilterChanged || false,
      });

      if (!result.success) throw new Error(result.error || 'Insertion refusée');

      await loadCarsData();
      setIsExpenseModalOpen(false);
      setSelectedCar(null);
      setPrefilledExpense(undefined);
    } catch (err: any) {
      console.error('Error saving expense:', err);
      setExpenseError(
        T("La dépense n'a pas pu être enregistrée : ", 'تعذر حفظ النفقة: ')
        + (err?.message || T('erreur inconnue', 'خطأ غير معروف'))
      );
    } finally {
      setSavingExpense(false);
    }
  };

  // ── Types de dépenses ──────────────────────────────────────────────────
  const handleSaveType = async (payload: any) => {
    setSavingType(true);
    setTypeError(null);
    try {
      const result = payload.id && !String(payload.id).startsWith('system-')
        ? await updateMaintenanceType(payload.id, payload)
        : await addMaintenanceType(payload, types.map(t => t.key));

      if (!result.success || !result.type) {
        throw new Error(result.error || T('Enregistrement refusé', 'تم رفض الحفظ'));
      }

      const refreshed = await getMaintenanceTypes();
      setTypes(refreshed.types);
      setTypesFallback(refreshed.usingFallback);
      setMaintenanceData(await getMaintenanceStatus(
        cars,
        (await getVehicleExpenses()).expenses || [],
        refreshed.types
      ));

      setPendingTypeKey(result.type.key);
      setIsTypeModalOpen(false);
      setEditingType(null);
    } catch (err: any) {
      setTypeError(
        (err?.message || T('erreur inconnue', 'خطأ غير معروف'))
        + (typesFallback
          ? T(' — exécutez d’abord le script SQL de mise à jour.', ' — نفّذ سكربت SQL أولاً.')
          : '')
      );
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) return;
    const result = await deleteMaintenanceType(typeToDelete.id);
    if (result.success) {
      const refreshed = await getMaintenanceTypes();
      setTypes(refreshed.types);
      setMaintenanceData(await getMaintenanceStatus(
        cars,
        (await getVehicleExpenses()).expenses || [],
        refreshed.types
      ));
    }
    setTypeToDelete(null);
  };

  // ── Filtrage & statistiques ────────────────────────────────────────────
  const filteredData = useMemo(() => maintenanceData.filter(item => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.car.brand.toLowerCase().includes(q) ||
      item.car.model.toLowerCase().includes(q) ||
      item.car.registration.toLowerCase().includes(q) ||
      // La recherche accepte aussi le nom d'une agence.
      carCompanyBadges(item.car.id).some(b => b.name.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (companyFilter !== 'all' && !carCompanyIds(item.car.id).includes(companyFilter)) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'success') {
      return item.criticalCount === 0 && item.warningCount === 0;
    }
    return item.items.some(i => i.level === filterStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [maintenanceData, searchTerm, filterStatus, companyFilter, carLinks, companies]);

  /**
   * Liste stable passée au formulaire de dépense : un tableau recréé à chaque
   * rendu réinitialiserait la saisie en cours.
   */
  const expenseModalCars = useMemo(
    () => (cars.length > 0 ? cars : selectedCar ? [selectedCar] : []),
    [cars, selectedCar]
  );

  const stats = useMemo(() => ({
    vehicles: maintenanceData.length,
    critical: maintenanceData.reduce((s, m) => s + m.criticalCount, 0),
    warning: maintenanceData.reduce((s, m) => s + m.warningCount, 0),
    cost: maintenanceData.reduce((s, m) => s + m.totalCost, 0),
  }), [maintenanceData]);

  const statCards = [
    { icon: <Wrench size={18} />,        label: T('Véhicules suivis', 'مركبات متابعة'), value: stats.vehicles.toString(),                  cls: 'bg-sky-50 border-sky-200 text-sky-700' },
    { icon: <AlertTriangle size={18} />, label: T('Alertes critiques', 'تنبيهات حرجة'), value: stats.critical.toString(),                  cls: 'bg-red-50 border-red-200 text-red-700' },
    { icon: <Clock size={18} />,         label: T('À surveiller', 'للمراقبة'),          value: stats.warning.toString(),                   cls: 'bg-amber-50 border-amber-200 text-amber-700' },
    { icon: <Coins size={18} />,         label: T('Coût total', 'التكلفة الإجمالية'),   value: `${stats.cost.toLocaleString('fr-FR')} DZD`, cls: 'bg-green-50 border-green-200 text-green-700' },
  ];

  const FILTER_META: Record<StatusFilter, { fr: string; ar: string; icon: React.ReactNode; active: string }> = {
    all:      { fr: 'Tous',      ar: 'الكل',   icon: <Wrench size={14} />,        active: 'bg-saas-primary-via text-white border-saas-primary-via' },
    critical: { fr: 'Critique',  ar: 'حرج',    icon: <AlertTriangle size={14} />, active: 'bg-red-500 text-white border-red-500' },
    warning:  { fr: 'À venir',   ar: 'قريباً', icon: <Clock size={14} />,         active: 'bg-amber-500 text-white border-amber-500' },
    success:  { fr: 'À jour',    ar: 'محدّث',  icon: <CheckCircle2 size={14} />,  active: 'bg-green-600 text-white border-green-600' },
  };

  return (
    <div className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-saas-border bg-white shadow-sm overflow-hidden"
      >
        <div className="bg-linear-to-r from-saas-primary-start via-saas-primary-via to-saas-primary-end px-6 py-6 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Wrench size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                {T('Maintenance', 'الصيانة')}
              </h1>
              <p className="text-white/75 text-[10px] font-bold uppercase tracking-[0.25em] mt-1">
                {T('Échéances, entretiens et coûts par véhicule', 'المواعيد والصيانة والتكاليف لكل مركبة')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" size={17} />
              <input
                type="text"
                placeholder={T('Rechercher un véhicule…', 'بحث عن مركبة…')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-11 pr-4 py-3 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl outline-none focus:border-white/60 w-full sm:w-72 transition-all font-medium text-sm text-white placeholder:text-white/60"
              />
            </div>
            <button
              onClick={loadCarsData}
              title={T('Actualiser', 'تحديث')}
              className="px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              <span className="font-bold uppercase tracking-widest text-xs">
                {T('Actualiser', 'تحديث')}
              </span>
            </button>
            <button
              onClick={() => cars[0] && openNewExpense(cars[0])}
              disabled={cars.length === 0}
              className="px-4 py-3 rounded-xl bg-white text-saas-primary-via hover:bg-white/90 transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs disabled:opacity-50 cursor-pointer"
            >
              <Plus size={17} /> {T('Dépense', 'نفقة')}
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">
          {statCards.map(card => (
            <div key={card.label} className={`rounded-2xl border p-4 ${card.cls}`}>
              <div className="flex items-center gap-2 opacity-80">
                {card.icon}
                <span className="text-[9px] font-black uppercase tracking-[0.18em]">{card.label}</span>
              </div>
              <p className="text-xl font-black tracking-tight mt-1.5">{card.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Bandeau migration SQL ───────────────────────────────────── */}
      {typesFallback && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <Database className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-semibold text-amber-800">
            {T(
              'Types de dépenses en mode intégré : exécutez le script SQL « 20260817_maintenance_custom_types.sql » dans Supabase pour créer et enregistrer vos propres types.',
              'أنواع النفقات في الوضع المدمج: نفّذ سكربت SQL في Supabase لإنشاء أنواعك الخاصة.'
            )}
          </p>
        </div>
      )}

      {/* ── Retour d'enregistrement ─────────────────────────────────── */}
      <AnimatePresence>
        {savingExpense && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-white border border-saas-border rounded-2xl p-4"
          >
            <Loader2 className="w-5 h-5 animate-spin text-saas-primary-via shrink-0" />
            <p className="text-sm font-semibold text-saas-text-main">
              {T('Enregistrement de la dépense…', 'جاري حفظ النفقة…')}
            </p>
          </motion.div>
        )}
        {expenseError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-start justify-between gap-4 bg-red-50 border border-red-200 rounded-2xl p-4"
          >
            <p className="text-sm font-semibold text-red-700">⚠️ {expenseError}</p>
            <button
              onClick={() => setExpenseError(null)}
              className="text-xs font-black uppercase tracking-wider text-red-700 hover:underline cursor-pointer shrink-0"
            >
              {T('Fermer', 'إغلاق')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Barre de filtres + gestion des types ────────────────────── */}
      <div className="bg-white rounded-2xl border border-saas-border shadow-sm">
        <div className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-saas-text-muted uppercase tracking-[0.2em] mr-1">
            {T('Filtrer', 'تصفية')}
          </span>
          {(Object.keys(FILTER_META) as StatusFilter[]).map(status => {
            const meta = FILTER_META[status];
            const active = filterStatus === status;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center gap-2 border cursor-pointer ${
                  active
                    ? meta.active
                    : 'bg-saas-bg text-saas-text-muted border-saas-border hover:border-saas-primary-via/50'
                }`}
              >
                {meta.icon}
                {T(meta.fr, meta.ar)}
              </button>
            );
          })}

          <button
            onClick={() => setShowTypes(v => !v)}
            className="ml-auto px-4 py-2 rounded-xl font-bold text-[11px] uppercase tracking-widest border border-saas-border bg-saas-bg text-saas-text-main hover:border-saas-secondary-start hover:text-saas-secondary-start transition-all flex items-center gap-2 cursor-pointer"
          >
            <Settings2 size={14} />
            {T('Types de dépenses', 'أنواع النفقات')}
            <span className="px-1.5 py-0.5 rounded-md bg-white border border-saas-border text-[10px]">
              {types.length}
            </span>
            <ChevronDown size={14} className={`transition-transform ${showTypes ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filtre d'agence — le parc est commun, rien n'est masqué par défaut */}
        {companies.length > 1 && (
          <div className="px-4 pb-4 -mt-1 flex flex-wrap items-center gap-2 border-t border-saas-border pt-4">
            <span className="text-[10px] font-black text-saas-text-muted uppercase tracking-[0.2em] mr-1">
              {T('Agence', 'الوكالة')}
            </span>
            {[{ id: 'all', name: T('Toutes les agences', 'كل الوكالات'), count: maintenanceData.length },
              ...companies.map(c => ({
                id: c.id,
                name: c.name,
                count: maintenanceData.filter(m => carCompanyIds(m.car.id).includes(c.id)).length,
              }))].map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCompanyFilter(chip.id)}
                className={`px-4 py-2 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center gap-2 border cursor-pointer ${
                  companyFilter === chip.id
                    ? 'bg-saas-primary-via text-white border-saas-primary-via'
                    : 'bg-saas-bg text-saas-text-muted border-saas-border hover:border-saas-primary-via/50'
                }`}
              >
                {chip.id === 'all' ? '🚘' : '🏢'} {chip.name}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                  companyFilter === chip.id ? 'bg-white/25' : 'bg-white border border-saas-border'
                }`}>{chip.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Panneau de gestion des types */}
        <AnimatePresence initial={false}>
          {showTypes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-saas-border"
            >
              <div className="p-4 bg-saas-bg space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-saas-text-muted">
                    {T(
                      'Créez vos propres types (bougies, freins, pneus…) : ils apparaissent aussitôt dans la maintenance et dans les dépenses.',
                      'أنشئ أنواعك الخاصة: تظهر فوراً في الصيانة والنفقات.'
                    )}
                  </p>
                  <button
                    onClick={() => { setEditingType(null); setTypeError(null); setIsTypeModalOpen(true); }}
                    className="btn-saas-secondary px-4 py-2 text-xs shrink-0"
                  >
                    <Plus size={14} /> {T('Nouveau type', 'نوع جديد')}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {types.map(type => {
                    const p = paletteOf(type.color);
                    return (
                      <div
                        key={type.id}
                        className={`rounded-2xl border p-3.5 flex items-center gap-3 ${p.bg} ${p.border}`}
                      >
                        <span className="w-10 h-10 rounded-xl bg-white/70 border border-white flex items-center justify-center text-lg shrink-0">
                          {type.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-black truncate ${p.text}`}>
                            {typeLabel(type, lang)}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-saas-text-muted">
                            {type.tracking === 'mileage'
                              ? `${(type.defaultIntervalKm || 0).toLocaleString('fr-FR')} KM`
                              : type.tracking === 'date'
                              ? `${type.defaultIntervalDays || 0} ${T('jours', 'يوم')}`
                              : T('Sans échéance', 'بدون استحقاق')}
                            {type.isSystem && ` · ${T('système', 'نظام')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingType(type); setTypeError(null); setIsTypeModalOpen(true); }}
                            title={T('Modifier', 'تعديل')}
                            className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-saas-text-muted hover:text-saas-secondary-start transition-colors cursor-pointer"
                          >
                            <Pencil size={13} />
                          </button>
                          {!type.isSystem && (
                            <button
                              onClick={() => setTypeToDelete(type)}
                              title={T('Supprimer', 'حذف')}
                              className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-saas-text-muted hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Grille des véhicules ────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-96 bg-white rounded-3xl border border-saas-border">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-11 h-11 text-saas-primary-via animate-spin" />
            <p className="text-saas-text-muted font-medium">
              {T('Chargement des véhicules…', 'جاري تحميل السيارات…')}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence mode="popLayout">
              {filteredData.map(maintenance => (
                <MaintenanceCard
                  key={maintenance.car.id}
                  maintenance={maintenance}
                  lang={lang}
                  companyBadges={companies.length > 1 ? carCompanyBadges(maintenance.car.id) : undefined}
                  onEditCar={handleEditCar}
                  onAddExpense={(car, type) => openNewExpense(car, type)}
                  onQuickAdd={car => openNewExpense(car)}
                />
              ))}
            </AnimatePresence>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-saas-border">
              <Wrench className="mx-auto text-saas-text-muted mb-3" size={32} />
              <p className="text-saas-text-muted font-medium">
                {T('Aucun véhicule trouvé.', 'لم يتم العثور على مركبات.')}
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Modales ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCarModalOpen && (
          <CarModal
            isOpen={isCarModalOpen}
            onClose={() => { setIsCarModalOpen(false); setSelectedCar(null); }}
            onSave={handleSaveCar}
            car={selectedCar || undefined}
            lang={lang}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpenseModalOpen && selectedCar && (
          <VehicleExpenseModal
            key={`${selectedCar.id}-${prefilledExpense?.type || 'new'}`}
            isOpen={isExpenseModalOpen}
            onClose={() => {
              setIsExpenseModalOpen(false);
              setSelectedCar(null);
              setPrefilledExpense(undefined);
            }}
            onSave={handleSaveExpense}
            expense={prefilledExpense}
            cars={expenseModalCars}
            types={types}
            onRequestNewType={() => { setEditingType(null); setTypeError(null); setIsTypeModalOpen(true); }}
            pendingTypeKey={pendingTypeKey}
            saving={savingExpense}
            lang={lang}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTypeModalOpen && (
          <MaintenanceTypeModal
            isOpen={isTypeModalOpen}
            onClose={() => { setIsTypeModalOpen(false); setEditingType(null); }}
            onSave={handleSaveType}
            type={editingType}
            existingKeys={types.map(t => t.key)}
            saving={savingType}
            error={typeError}
            lang={lang}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!typeToDelete}
        onClose={() => setTypeToDelete(null)}
        onConfirm={handleDeleteType}
        title={{ fr: 'Supprimer le type', ar: 'حذف النوع' }}
        message={{
          fr: `Supprimer « ${typeToDelete?.labelFr || ''} » ? Les dépenses déjà enregistrées avec ce type sont conservées.`,
          ar: `حذف « ${typeToDelete?.labelAr || ''} »؟ يتم الاحتفاظ بالنفقات المسجلة مسبقاً.`,
        }}
        lang={lang}
      />
    </div>
  );
};
