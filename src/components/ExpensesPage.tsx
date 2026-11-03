import React, { useState, useEffect, useMemo } from 'react';
import { StoreExpense, VehicleExpense, Language, Car, MaintenanceAlert, MaintenanceType } from '../types';
import { StoreExpenseCard } from './StoreExpenseCard';
import { StoreExpenseModal } from './StoreExpenseModal';
import { VehicleExpenseCard } from './VehicleExpenseCard';
import { VehicleExpenseModal } from './VehicleExpenseModal';
import { MaintenanceTypeModal } from './MaintenanceTypeModal';
import { ConfirmModal } from './ConfirmModal';
import {
  Plus, Loader2, AlertCircle, Search, Wallet, Store, Car as CarIcon,
  LayoutGrid, ListTree, Settings2, TrendingUp, Receipt, CalendarRange, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getStoreExpenses, addStoreExpense, updateStoreExpense, deleteStoreExpense,
  getVehicleExpenses, addVehicleExpense, updateVehicleExpense, deleteVehicleExpense,
} from '../services/expenseService';
import {
  addMaintenanceType, findType, getMaintenanceTypes, paletteOf, typeLabel, updateMaintenanceType,
} from '../services/maintenanceTypeService';
import { DatabaseService } from '../services/DatabaseService';
import { getVidangeAlert, getAssuranceAlert, getControleAlert, getChaineAlert } from '../utils/vidangeAlerts';

interface ExpensesPageProps {
  lang: Language;
  cars: Car[];
}

/** Types historiques qui alimentent les alertes du tableau de bord. */
const ALERT_TYPES = ['vidange', 'assurance', 'controle', 'chaine'] as const;
type AlertType = typeof ALERT_TYPES[number];

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ lang, cars }) => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const [scope, setScope] = useState<'store' | 'vehicle'>('vehicle');
  const [storeExpenses, setStoreExpenses] = useState<StoreExpense[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
  const [types, setTypes] = useState<MaintenanceType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<StoreExpense | VehicleExpense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [carFilter, setCarFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'byCar'>('grid');
  const [openCarId, setOpenCarId] = useState<string | null>(null);

  // Création d'un type sans quitter la page
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [pendingTypeKey, setPendingTypeKey] = useState<string | null>(null);

  // ── Alertes de maintenance ────────────────────────────────────────────
  const buildMaintenanceAlert = (
    car: Car,
    type: AlertType,
    alertObj: any
  ): Omit<MaintenanceAlert, 'id' | 'created_at'> => {
    const severity: 'low' | 'medium' | 'high' | 'critical' =
      alertObj.status === 'overdue' ? 'critical' : alertObj.status === 'warning' ? 'high' : 'medium';

    const titles: Record<AlertType, [string, string]> = {
      vidange:   ['Vidange en retard', 'Vidange planifiée'],
      chaine:    ['Chaîne en retard', 'Chaîne planifiée'],
      assurance: ['Assurance expirée', 'Assurance à jour'],
      controle:  ['Contrôle technique expirée', 'Contrôle technique à jour'],
    };

    return {
      carId: car.id,
      carInfo: `${car.brand} ${car.model} - ${car.registration}`,
      type,
      title: titles[type][alertObj.status === 'overdue' ? 0 : 1],
      message: alertObj.message,
      severity,
      dueDate:
        (type === 'assurance' || type === 'controle') && alertObj.expirationDate
          ? alertObj.expirationDate.toISOString().split('T')[0]
          : undefined,
      isExpired: alertObj.status === 'overdue',
      daysUntilDue: alertObj.status === 'overdue' ? -alertObj.daysRemaining : alertObj.daysRemaining,
      currentMileage: alertObj.currentMileage,
      nextServiceMileage: alertObj.nextVidangeKm,
      createdAt: new Date().toISOString(),
    };
  };

  /** Recalcule et resynchronise l'alerte d'un couple véhicule / type. */
  const syncAlert = async (typeKey: string, carId: string, expenses: VehicleExpense[]) => {
    if (!ALERT_TYPES.includes(typeKey as AlertType)) return;
    const car = cars.find(c => c.id === carId);
    if (!car) return;

    try {
      const alertObj =
        typeKey === 'vidange'   ? getVidangeAlert(car, expenses)   :
        typeKey === 'chaine'    ? getChaineAlert(car, expenses)    :
        typeKey === 'assurance' ? getAssuranceAlert(car, expenses) :
                                  getControleAlert(car, expenses);

      await DatabaseService.deleteMaintenanceAlert(car.id, typeKey);
      if (alertObj) {
        await DatabaseService.createMaintenanceAlert(
          buildMaintenanceAlert(car, typeKey as AlertType, alertObj)
        );
      }
    } catch (alertError) {
      console.warn('Error syncing maintenance alert:', alertError);
    }
  };

  // ── Chargement ────────────────────────────────────────────────────────
  const loadTypes = async () => {
    const result = await getMaintenanceTypes();
    setTypes(result.types);
    return result.types;
  };

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [storeResult, vehicleResult] = await Promise.all([
          getStoreExpenses(),
          getVehicleExpenses(),
          loadTypes(),
        ]);

        if (storeResult.success && storeResult.expenses) setStoreExpenses(storeResult.expenses);
        if (vehicleResult.success && vehicleResult.expenses) setVehicleExpenses(vehicleResult.expenses);
      } catch (err: any) {
        console.error('Error loading expenses:', err);
        if (err.message?.includes('JWT') || err.message?.includes('auth') || err.code === 'PGRST301') {
          setError(T('Session expirée. Veuillez vous reconnecter.', 'انتهت الجلسة. يرجى إعادة الاتصال.'));
        } else {
          setError(T('Échec du chargement des dépenses', 'فشل تحميل النفقات'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtres ───────────────────────────────────────────────────────────
  const filteredVehicleExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return vehicleExpenses
      .filter(expense => {
        if (typeFilter !== 'all' && expense.type !== typeFilter) return false;
        if (carFilter !== 'all' && expense.carId !== carFilter) return false;
        if (!q) return true;

        const car = cars.find(c => c.id === expense.carId);
        const type = findType(types, expense.type);
        return (
          (car && (
            car.brand.toLowerCase().includes(q) ||
            car.model.toLowerCase().includes(q) ||
            car.registration.toLowerCase().includes(q) ||
            (car.vin || '').toLowerCase().includes(q)
          )) ||
          type.labelFr.toLowerCase().includes(q) ||
          (expense.expenseName || '').toLowerCase().includes(q) ||
          (expense.note || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vehicleExpenses, searchQuery, typeFilter, carFilter, cars, types]);

  const filteredStoreExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return storeExpenses
      .filter(e => !q || e.name.toLowerCase().includes(q) || (e.note || '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [storeExpenses, searchQuery]);

  /** Historique regroupé par véhicule (vue « Par véhicule »). */
  const expensesByCar = useMemo(() => {
    const groups = new Map<string, VehicleExpense[]>();
    filteredVehicleExpenses.forEach(e => {
      const list = groups.get(e.carId) || [];
      list.push(e);
      groups.set(e.carId, list);
    });
    return [...groups.entries()]
      .map(([carId, list]) => ({
        car: cars.find(c => c.id === carId),
        carId,
        expenses: list,
        total: list.reduce((s, e) => s + (Number(e.cost) || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredVehicleExpenses, cars]);

  /** Types réellement présents dans les données + types actifs déclarés. */
  const filterableTypes = useMemo(() => {
    const used = new Set(vehicleExpenses.map(e => e.type));
    const declared = types.filter(t => t.isActive !== false);
    const extras = [...used]
      .filter(key => !declared.some(t => t.key === key))
      .map(key => findType(types, key));
    return [...declared, ...extras];
  }, [types, vehicleExpenses]);

  const stats = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    const vehicleTotal = vehicleExpenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);
    const storeTotal = storeExpenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);
    const monthTotal = [...vehicleExpenses, ...storeExpenses]
      .filter(e => (e.date || '').startsWith(monthKey))
      .reduce((s, e) => s + (Number(e.cost) || 0), 0);
    return {
      vehicleTotal,
      storeTotal,
      monthTotal,
      count: vehicleExpenses.length + storeExpenses.length,
    };
  }, [vehicleExpenses, storeExpenses]);

  // ── Dépenses magasin ──────────────────────────────────────────────────
  const handleSaveStoreExpense = async (data: Partial<StoreExpense>) => {
    try {
      if (editingExpense && 'name' in editingExpense && storeExpenses.some(e => e.id === editingExpense.id)) {
        const result = await updateStoreExpense(editingExpense.id, data);
        if (result.success && result.expense) {
          setStoreExpenses(storeExpenses.map(e => (e.id === editingExpense.id ? result.expense! : e)));
        }
      } else {
        const result = await addStoreExpense({
          name: data.name || '',
          cost: data.cost || 0,
          date: data.date || new Date().toISOString().split('T')[0],
          note: data.note,
          icon: data.icon || '🏪',
        });
        if (result.success && result.expense) setStoreExpenses([result.expense, ...storeExpenses]);
      }
      setIsModalOpen(false);
      setEditingExpense(null);
    } catch (err) {
      console.error('Error saving store expense:', err);
      setError(T('Échec de l’enregistrement de la dépense magasin', 'فشل حفظ نفقة المتجر'));
    }
  };

  // ── Dépenses véhicule ─────────────────────────────────────────────────
  const handleSaveVehicleExpense = async (data: Partial<VehicleExpense>) => {
    try {
      const isUpdate =
        editingExpense && 'carId' in editingExpense && vehicleExpenses.some(e => e.id === editingExpense.id);

      if (isUpdate) {
        const result = await updateVehicleExpense(editingExpense!.id, data);
        if (result.success && result.expense) {
          const updated = vehicleExpenses.map(e => (e.id === editingExpense!.id ? result.expense! : e));
          setVehicleExpenses(updated);
          await syncAlert(result.expense.type, result.expense.carId, updated);
        }
      } else {
        const result = await addVehicleExpense({
          carId: data.carId || '',
          type: data.type || 'autre',
          cost: data.cost || 0,
          date: data.date || new Date().toISOString().split('T')[0],
          note: data.note,
          currentMileage: data.currentMileage,
          nextVidangeKm: data.nextVidangeKm,
          expenseName: data.expenseName,
          expirationDate: data.expirationDate,
          oilFilterChanged: data.oilFilterChanged || false,
          airFilterChanged: data.airFilterChanged || false,
          fuelFilterChanged: data.fuelFilterChanged || false,
          acFilterChanged: data.acFilterChanged || false,
        });
        if (result.success && result.expense) {
          const updated = [result.expense, ...vehicleExpenses];
          setVehicleExpenses(updated);
          await syncAlert(result.expense.type, result.expense.carId, updated);
        } else if (!result.success) {
          throw new Error(result.error);
        }
      }
      setIsModalOpen(false);
      setEditingExpense(null);
    } catch (err: any) {
      console.error('Error saving vehicle expense:', err);
      setError(
        T('Échec de l’enregistrement de la dépense : ', 'فشل حفظ النفقة: ')
        + (err?.message || T('erreur inconnue', 'خطأ غير معروف'))
      );
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        if (scope === 'store') {
          const result = await deleteStoreExpense(deleteConfirm.id);
          if (result.success) setStoreExpenses(storeExpenses.filter(e => e.id !== deleteConfirm.id));
        } else {
          const result = await deleteVehicleExpense(deleteConfirm.id);
          if (result.success) setVehicleExpenses(vehicleExpenses.filter(e => e.id !== deleteConfirm.id));
        }
      } catch (err) {
        console.error('Error deleting expense:', err);
        setError(T('Échec de la suppression', 'فشل الحذف'));
      }
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  // ── Types ─────────────────────────────────────────────────────────────
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

      await loadTypes();
      setPendingTypeKey(result.type.key);
      setIsTypeModalOpen(false);
    } catch (err: any) {
      setTypeError(
        (err?.message || T('erreur inconnue', 'خطأ غير معروف'))
        + T(' — exécutez le script SQL de mise à jour si la table est absente.', ' — نفّذ سكربت SQL إذا كان الجدول غير موجود.')
      );
    } finally {
      setSavingType(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-saas-primary-via animate-spin mx-auto mb-4" />
          <p className="text-saas-text-muted font-bold">{T('Chargement…', 'جاري التحميل…')}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { icon: <CarIcon size={18} />,    label: T('Dépenses véhicules', 'نفقات المركبات'), value: `${stats.vehicleTotal.toLocaleString('fr-FR')} DZD`, cls: 'bg-sky-50 border-sky-200 text-sky-700' },
    { icon: <Store size={18} />,      label: T('Dépenses magasin', 'نفقات المتجر'),     value: `${stats.storeTotal.toLocaleString('fr-FR')} DZD`,   cls: 'bg-purple-50 border-purple-200 text-purple-700' },
    { icon: <CalendarRange size={18} />, label: T('Ce mois-ci', 'هذا الشهر'),           value: `${stats.monthTotal.toLocaleString('fr-FR')} DZD`,   cls: 'bg-amber-50 border-amber-200 text-amber-700' },
    { icon: <Receipt size={18} />,    label: T('Écritures', 'العمليات'),                value: stats.count.toString(),                              cls: 'bg-green-50 border-green-200 text-green-700' },
  ];

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
              <Wallet size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                {T('Dépenses', 'النفقات')}
              </h1>
              <p className="text-white/75 text-[10px] font-bold uppercase tracking-[0.25em] mt-1">
                {T('Entretien véhicules et charges du magasin', 'صيانة المركبات ومصاريف المتجر')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" size={17} />
              <input
                type="text"
                placeholder={T('Rechercher…', 'بحث…')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 py-3 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl outline-none focus:border-white/60 w-full sm:w-72 transition-all font-medium text-sm text-white placeholder:text-white/60"
              />
            </div>
            <button
              onClick={() => { setEditingExpense(null); setPendingTypeKey(null); setIsModalOpen(true); }}
              className="px-4 py-3 rounded-xl bg-white text-saas-primary-via hover:bg-white/90 transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs cursor-pointer"
            >
              <Plus size={17} /> {T('Ajouter', 'إضافة')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">
          {statCards.map(card => (
            <div key={card.label} className={`rounded-2xl border p-4 ${card.cls}`}>
              <div className="flex items-center gap-2 opacity-80">
                {card.icon}
                <span className="text-[9px] font-black uppercase tracking-[0.18em]">{card.label}</span>
              </div>
              <p className="text-lg font-black tracking-tight mt-1.5">{card.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Erreur ──────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-4"
        >
          <p className="text-red-700 font-semibold text-sm">⚠️ {error}</p>
          <div className="flex items-center gap-2 shrink-0">
            {error.includes('Session') && (
              <button onClick={() => window.location.reload()} className="btn-saas-primary text-xs px-4 py-2">
                {T('Se reconnecter', 'إعادة الاتصال')}
              </button>
            )}
            <button
              onClick={() => setError(null)}
              className="text-xs font-black uppercase tracking-wider text-red-700 hover:underline cursor-pointer"
            >
              {T('Fermer', 'إغلاق')}
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Sélecteur de périmètre ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-saas-border shadow-sm p-2 flex flex-col sm:flex-row gap-2">
        {([
          { id: 'vehicle', icon: <CarIcon size={17} />, fr: 'Entretien & frais véhicules', ar: 'صيانة ورسوم المركبات', count: vehicleExpenses.length },
          { id: 'store',   icon: <Store size={17} />,   fr: 'Dépenses du magasin',          ar: 'نفقات المتجر',          count: storeExpenses.length },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setScope(tab.id); setEditingExpense(null); setIsModalOpen(false); }}
            className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
              scope === tab.id
                ? 'bg-linear-to-r from-saas-primary-start via-saas-primary-via to-saas-primary-end text-white shadow-md'
                : 'bg-saas-bg text-saas-text-muted hover:text-saas-text-main'
            }`}
          >
            {tab.icon}
            {T(tab.fr, tab.ar)}
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
              scope === tab.id ? 'bg-white/20' : 'bg-white border border-saas-border'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Filtres véhicules ───────────────────────────────────────── */}
      {scope === 'vehicle' && (
        <div className="bg-white rounded-2xl border border-saas-border shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-saas-text-muted uppercase tracking-[0.2em] mr-1">
              {T('Type', 'النوع')}
            </span>
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3.5 py-2 rounded-xl font-bold text-[11px] uppercase tracking-widest border transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-saas-primary-via text-white border-saas-primary-via'
                  : 'bg-saas-bg text-saas-text-muted border-saas-border hover:border-saas-primary-via/50'
              }`}
            >
              {T('Tous', 'الكل')}
            </button>
            {filterableTypes.map(type => {
              const p = paletteOf(type.color);
              const active = typeFilter === type.key;
              const count = vehicleExpenses.filter(e => e.type === type.key).length;
              return (
                <button
                  key={type.key}
                  onClick={() => setTypeFilter(type.key)}
                  className={`px-3.5 py-2 rounded-xl font-bold text-[11px] uppercase tracking-widest border transition-all flex items-center gap-1.5 cursor-pointer ${
                    active ? `${p.bg} ${p.border} ${p.text} ring-2 ${p.ring}` : 'bg-saas-bg text-saas-text-muted border-saas-border hover:border-saas-primary-via/50'
                  }`}
                >
                  <span>{type.icon}</span>
                  {typeLabel(type, lang)}
                  <span className="opacity-60">{count}</span>
                </button>
              );
            })}
            <button
              onClick={() => { setTypeError(null); setIsTypeModalOpen(true); }}
              className="px-3.5 py-2 rounded-xl font-bold text-[11px] uppercase tracking-widest border border-dashed border-saas-border text-saas-secondary-start hover:border-saas-secondary-start transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Settings2 size={13} /> {T('Nouveau type', 'نوع جديد')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-saas-border">
            <span className="text-[10px] font-black text-saas-text-muted uppercase tracking-[0.2em] mr-1 mt-3">
              {T('Véhicule', 'المركبة')}
            </span>
            <select
              value={carFilter}
              onChange={e => setCarFilter(e.target.value)}
              className="input-saas w-auto min-w-56 py-2 mt-3 text-sm"
            >
              <option value="all">{T('Tous les véhicules', 'كل المركبات')}</option>
              {cars.map(car => (
                <option key={car.id} value={car.id}>
                  {car.brand} {car.model} — {car.registration}
                </option>
              ))}
            </select>

            <div className="ml-auto mt-3 flex items-center gap-1 bg-saas-bg rounded-xl p-1 border border-saas-border">
              {([
                { id: 'grid',  icon: <LayoutGrid size={14} />, fr: 'Grille',       ar: 'شبكة' },
                { id: 'byCar', icon: <ListTree size={14} />,   fr: 'Par véhicule', ar: 'حسب المركبة' },
              ] as const).map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === mode.id ? 'bg-white shadow-sm text-saas-text-main' : 'text-saas-text-muted'
                  }`}
                >
                  {mode.icon} {T(mode.fr, mode.ar)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Alertes vidange ─────────────────────────────────────────── */}
      {scope === 'vehicle' && (
        <div className="space-y-3">
          {cars.map(car => {
            const alert = getVidangeAlert(car, vehicleExpenses);
            if (!alert || alert.status === 'ok') return null;
            const overdue = alert.status === 'overdue';
            return (
              <motion.div
                key={car.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border flex items-center gap-3 ${
                  overdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <AlertCircle className={overdue ? 'text-red-600 shrink-0' : 'text-amber-600 shrink-0'} size={20} />
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-xs uppercase tracking-tight ${overdue ? 'text-red-700' : 'text-amber-700'}`}>
                    {car.brand} {car.model} ({car.registration}) — {alert.message}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${overdue ? 'text-red-600' : 'text-amber-600'}`}>
                    {T('Compteur', 'العداد')}: {alert.currentMileage.toLocaleString('fr-FR')} KM ·{' '}
                    {T('Prochaine vidange à', 'التغيير القادم عند')} {alert.nextVidangeKm.toLocaleString('fr-FR')} KM
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Contenu ─────────────────────────────────────────────────── */}
      {scope === 'store' ? (
        filteredStoreExpenses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence>
              {filteredStoreExpenses.map((expense, index) => (
                <StoreExpenseCard
                  key={expense.id}
                  expense={expense}
                  index={index}
                  lang={lang}
                  onEdit={() => { setEditingExpense(expense); setIsModalOpen(true); }}
                  onDelete={() => setDeleteConfirm({ isOpen: true, id: expense.id })}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState label={T('Aucune dépense de magasin', 'لا توجد نفقات للمتجر')} />
        )
      ) : viewMode === 'grid' ? (
        filteredVehicleExpenses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence>
              {filteredVehicleExpenses.map((expense, index) => (
                <VehicleExpenseCard
                  key={expense.id}
                  expense={expense}
                  car={cars.find(c => c.id === expense.carId)}
                  type={findType(types, expense.type)}
                  index={index}
                  lang={lang}
                  onEdit={() => { setEditingExpense(expense); setIsModalOpen(true); }}
                  onDelete={() => setDeleteConfirm({ isOpen: true, id: expense.id })}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState label={T('Aucune dépense de véhicule trouvée', 'لم يتم العثور على نفقات المركبة')} />
        )
      ) : expensesByCar.length > 0 ? (
        /* ── Historique par véhicule ───────────────────────────────── */
        <div className="space-y-3">
          {expensesByCar.map(group => {
            const open = openCarId === group.carId;
            return (
              <div key={group.carId} className="bg-white rounded-2xl border border-saas-border shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenCarId(open ? null : group.carId)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-saas-bg transition-colors cursor-pointer text-left"
                >
                  <div className="w-16 h-12 rounded-xl overflow-hidden border border-saas-border bg-saas-bg shrink-0">
                    {group.car?.images?.[0] ? (
                      <img src={group.car.images[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🚗</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-saas-text-main truncate">
                      {group.car ? `${group.car.brand} ${group.car.model}` : T('Véhicule supprimé', 'مركبة محذوفة')}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-saas-text-muted">
                      {group.car?.registration || group.carId.slice(0, 8)} · {group.expenses.length} {T('dépenses', 'نفقات')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-saas-text-muted justify-end">
                      <TrendingUp size={11} /> {T('Total', 'الإجمالي')}
                    </p>
                    <p className="text-sm font-black text-saas-text-main">
                      {group.total.toLocaleString('fr-FR')} DZD
                    </p>
                  </div>
                  <ChevronDown size={18} className={`text-saas-text-muted transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-saas-border"
                    >
                      <div className="divide-y divide-saas-border">
                        {group.expenses.map(expense => {
                          const type = findType(types, expense.type);
                          const p = paletteOf(type.color);
                          return (
                            <div key={expense.id} className="p-3.5 flex items-center gap-3 hover:bg-saas-bg transition-colors">
                              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border ${p.bg} ${p.border}`}>
                                {type.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-black truncate ${p.text}`}>
                                  {typeLabel(type, lang)}
                                  {expense.expenseName ? ` · ${expense.expenseName}` : ''}
                                </p>
                                <p className="text-[10px] font-semibold text-saas-text-muted truncate">
                                  {new Date(expense.date).toLocaleDateString('fr-FR')}
                                  {expense.currentMileage ? ` · ${expense.currentMileage.toLocaleString('fr-FR')} km` : ''}
                                  {expense.expirationDate ? ` · ${T('expire', 'ينتهي')} ${new Date(expense.expirationDate).toLocaleDateString('fr-FR')}` : ''}
                                </p>
                              </div>
                              <p className="text-sm font-black text-saas-text-main shrink-0">
                                {(Number(expense.cost) || 0).toLocaleString('fr-FR')} DZD
                              </p>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => { setEditingExpense(expense); setIsModalOpen(true); }}
                                  className="p-1.5 rounded-lg bg-saas-bg border border-saas-border text-saas-text-muted hover:text-saas-secondary-start transition-colors cursor-pointer"
                                  title={T('Modifier', 'تعديل')}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ isOpen: true, id: expense.id })}
                                  className="p-1.5 rounded-lg bg-saas-bg border border-saas-border text-saas-text-muted hover:text-red-600 transition-colors cursor-pointer"
                                  title={T('Supprimer', 'حذف')}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState label={T('Aucune dépense de véhicule trouvée', 'لم يتم العثور على نفقات المركبة')} />
      )}

      {/* ── Modales ─────────────────────────────────────────────────── */}
      {scope === 'store' && (
        <StoreExpenseModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingExpense(null); }}
          onSave={handleSaveStoreExpense}
          expense={editingExpense as StoreExpense | undefined}
          lang={lang}
        />
      )}

      <AnimatePresence>
        {scope === 'vehicle' && isModalOpen && (
          <VehicleExpenseModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingExpense(null); }}
            onSave={handleSaveVehicleExpense}
            expense={editingExpense as VehicleExpense | undefined}
            cars={cars}
            types={types}
            onRequestNewType={() => { setTypeError(null); setIsTypeModalOpen(true); }}
            pendingTypeKey={pendingTypeKey}
            lang={lang}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTypeModalOpen && (
          <MaintenanceTypeModal
            isOpen={isTypeModalOpen}
            onClose={() => setIsTypeModalOpen(false)}
            onSave={handleSaveType}
            existingKeys={types.map(t => t.key)}
            saving={savingType}
            error={typeError}
            lang={lang}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={{ fr: 'Supprimer la dépense', ar: 'حذف النفقة' }}
        message={{
          fr: 'Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action est irréversible.',
          ar: 'هل أنت متأكد من حذف هذه النفقة؟ هذا الإجراء لا يمكن التراجع عنه.',
        }}
        onConfirm={confirmDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        lang={lang}
      />
    </div>
  );
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-saas-border"
  >
    <Receipt className="mx-auto text-saas-text-muted mb-3" size={30} />
    <p className="text-saas-text-muted font-medium">{label}</p>
  </motion.div>
);
