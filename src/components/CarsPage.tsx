import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Car, Rental, Language, Expense, ReservationDetails, MaintenanceType, VehicleExpense, Company } from '../types';
import { CarCard } from './CarCard';
import { CarModal } from './CarModal';
import { CarDetailsModal } from './CarDetailsModal';
import { VehicleExpenseModal } from './VehicleExpenseModal';
import { MaintenanceTypeModal } from './MaintenanceTypeModal';
import { HistoryModal } from './HistoryModal';
import { CarReportModal } from './CarReportModal';
import { ConfirmModal } from './ConfirmModal';
import { Plus, Search, Loader2, RefreshCw, Coins, CheckCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCars, addCar, updateCar, deleteCar, AddCarData } from '../services/carService';
import { addVehicleExpense, getVehicleExpenses } from '../services/expenseService';
import {
  addMaintenanceType, getMaintenanceTypes, updateMaintenanceType,
} from '../services/maintenanceTypeService';
import { ReservationsService } from '../services/ReservationsService';
import { DatabaseService } from '../services/DatabaseService';
import { parseCarCurrencies, SECONDARY_CURRENCIES, CURRENCIES, DEFAULT_RATES } from '../utils/currency';
import { usePermissions } from '../utils/permissions';
import { companyContext } from '../utils/companyContext';

interface CarsPageProps {
  lang: Language;
  isAuthLoading?: boolean;
  user?: any;
}

export const CarsPage: React.FC<CarsPageProps> = ({ lang, isAuthLoading = false, user = null }) => {
  const [cars, setCars] = useState<Car[]>([]);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  // Multi-agences : liste des agences + liens voiture↔agence (car_companies).
  // Le parc est COMMUN : aucune voiture n'est masquée selon l'agence active.
  const [companies, setCompanies] = useState<Company[]>([]);
  const [carLinks, setCarLinks] = useState<Record<string, string[]>>({});
  // Filtre d'agence PUREMENT VISUEL ('all' = tout le parc, valeur par défaut).
  // Il ne restreint pas les droits : il aide juste à retrouver une voiture.
  const [companyFilter, setCompanyFilter] = useState<string>('all');

  useEffect(() => {
    if (isAuthLoading || !user) return;
    (async () => {
      try {
        const [list, links] = await Promise.all([
          DatabaseService.getCompanies(),
          DatabaseService.getCarCompanyLinks(),
        ]);
        setCompanies(list);
        setCarLinks(links);
      } catch (err) {
        console.warn('Error loading company links for cars:', err);
      }
    })();
  }, [user, isAuthLoading]);

  /** Agences effectives d'une voiture : ses liens, ou l'agence principale par défaut. */
  const carCompanyIds = (carId: string): string[] => {
    const ids = carLinks[carId] || [];
    if (ids.length === 0) {
      const primaryId = companyContext.getPrimaryCompanyId();
      return primaryId ? [primaryId] : [];
    }
    return ids;
  };

  /** Badges d'agence affichés sur la carte (super-admin) : nom des agences liées. */
  const carCompanyBadges = (carId: string): { id: string; name: string }[] =>
    carCompanyIds(carId)
      .map(id => companies.find(c => c.id === id))
      .filter((c): c is Company => !!c)
      .map(c => ({ id: c.id, name: c.name }));

  // ── Statuts réels calculés à partir des réservations ──────────────────────
  /** Calcule le statut réel de chaque voiture d'après les réservations chargées */
  const computeRealStatuses = (rawCars: Car[], allReservations: ReservationDetails[]): Car[] => {
    const today = new Date().toISOString().substring(0, 10);
    return rawCars.map(car => {
      // La maintenance reste la priorité (saisie manuellement)
      if (car.status === 'maintenance') return car;

      const carRes = allReservations.filter(r => r.carId === car.id || (r.car && r.car.id === car.id));
      const coversToday = (r: ReservationDetails) => {
        const dep = (r.step1?.departureDate || '').substring(0, 10);
        const ret = (r.step1?.returnDate    || '').substring(0, 10);
        return dep <= today && today <= ret;
      };

      const active   = carRes.find(r => (r.status === 'active' || r.status === 'continued') && coversToday(r));
      const reserved = carRes.find(r => (r.status === 'confirmed' || r.status === 'pending') && coversToday(r));

      let realStatus: Car['status'] = 'disponible';
      if (active)   realStatus = 'louer';
      else if (reserved) realStatus = 'reserve';

      return { ...car, status: realStatus };
    });
  };

  /** Retourne la réservation en cours pour une voiture donnée (pour afficher client + dates) */
  const getActiveReservationInfo = (carId: string) => {
    const today = new Date().toISOString().substring(0, 10);
    const res = reservations.find(r => {
      const id = r.carId || r.car?.id;
      if (id !== carId) return false;
      if (!['active', 'continued', 'confirmed', 'pending'].includes(r.status)) return false;
      const dep = (r.step1?.departureDate || '').substring(0, 10);
      const ret = (r.step1?.returnDate    || '').substring(0, 10);
      return dep <= today && today <= ret;
    });
    if (!res) return null;
    return {
      clientName: res.client ? `${res.client.firstName} ${res.client.lastName}` : '',
      departureDate: res.step1?.departureDate || '',
      returnDate:    res.step1?.returnDate    || '',
    };
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250); // wait quarter-second after user stops typing

    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [carToDelete, setCarToDelete] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportExpenses, setReportExpenses] = useState<VehicleExpense[]>([]);
  const [reportReservations, setReportReservations] = useState<ReservationDetails[]>([]);

  // ── Types de dépenses (partagés avec la page Maintenance) ─────────────────
  const [expenseTypes, setExpenseTypes] = useState<MaintenanceType[]>([]);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [pendingTypeKey, setPendingTypeKey] = useState<string | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    getMaintenanceTypes().then(result => setExpenseTypes(result.types));
  }, []);

  /**
   * Liste stable passée au formulaire de dépense : un tableau recréé à chaque
   * rendu réinitialiserait la saisie en cours.
   */
  const expenseModalCars = useMemo(
    () => (selectedCar ? [selectedCar] : []),
    [selectedCar]
  );

  // ── Taux de change global (appliqué à TOUTES les voitures) ────────────────
  type RateConfig = { enabled: boolean; rate: number };
  const [globalRates, setGlobalRates] = useState<Record<'USD' | 'EUR' | 'GBP', RateConfig>>({
    USD: { enabled: false, rate: DEFAULT_RATES.USD },
    EUR: { enabled: false, rate: DEFAULT_RATES.EUR },
    GBP: { enabled: false, rate: DEFAULT_RATES.GBP },
  });
  const [showRatesPanel, setShowRatesPanel] = useState(false);
  const [applyingRates, setApplyingRates] = useState(false);
  const [ratesMessage, setRatesMessage] = useState<string | null>(null);
  const ratesInitialized = useRef(false);

  // Pré-remplit les taux globaux à partir de la configuration existante des
  // voitures (première voiture qui a un taux défini pour chaque devise).
  useEffect(() => {
    if (ratesInitialized.current) return;
    if (cars.length === 0) return;
    ratesInitialized.current = true;
    setGlobalRates(prev => {
      const next = { ...prev };
      for (const code of SECONDARY_CURRENCIES) {
        const carWith = cars.find(c => (c.currencies as any)?.[code]?.rate);
        const anyEnabled = cars.some(c => (c.currencies as any)?.[code]?.enabled);
        if (carWith) {
          next[code] = { enabled: anyEnabled, rate: (carWith.currencies as any)[code].rate };
        }
      }
      return next;
    });
  }, [cars]);

  /**
   * Applique les taux de change saisis à TOUTES les voitures. Les prix
   * (jour/semaine/mois/caution) restent stockés en DZD ; seules les devises
   * secondaires + leur taux sont uniformisés, donc l'affichage converti de
   * chaque voiture bascule instantanément sur le même taux.
   */
  const applyGlobalRates = async () => {
    setApplyingRates(true);
    setRatesMessage(null);
    try {
      const currencies: Record<string, RateConfig> = {};
      for (const code of SECONDARY_CURRENCIES) {
        currencies[code] = {
          enabled: globalRates[code].enabled,
          rate: Number(globalRates[code].rate) || 0,
        };
      }
      const results = await Promise.all(
        cars.map(c => updateCar(c.id, { currencies } as any))
      );
      const failed = results.filter(r => !r.success).length;
      setCars(prev => prev.map(c => ({ ...c, currencies: { ...(currencies as any) } })));
      setRatesMessage(
        failed === 0
          ? (lang === 'fr'
              ? `Taux appliqués à ${cars.length} véhicule(s).`
              : `تم تطبيق الأسعار على ${cars.length} مركبة.`)
          : (lang === 'fr'
              ? `${cars.length - failed}/${cars.length} mis à jour · ${failed} échec(s).`
              : `${cars.length - failed}/${cars.length} تم التحديث · ${failed} فشل.`)
      );
    } catch (err) {
      console.error('Error applying global rates:', err);
      setRatesMessage(lang === 'fr' ? "Erreur lors de l'application des taux." : 'خطأ أثناء تطبيق الأسعار.');
    } finally {
      setApplyingRates(false);
    }
  };

  const loadCarsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getCars();
      if (result.success && result.cars) {
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
          // Conserve 'maintenance' si en DB ; le vrai statut sera recalculé avec les réservations
          status: dbCar.status === 'maintenance' ? 'maintenance' : 'disponible',
          fuelLevel: dbCar.fuel_level || 'full',
          isHiddenFromSite: dbCar.is_hidden_from_site === true,
          // Propriété du véhicule + devises secondaires
          ownerType: (dbCar as any).owner_type === 'third_party' ? 'third_party' : 'personal',
          ownerName: (dbCar as any).owner_name || undefined,
          ownerPhone: (dbCar as any).owner_phone || undefined,
          agencySharePerDay: Number((dbCar as any).agency_share_per_day) || 0,
          currencies: parseCarCurrencies((dbCar as any).currencies),
        }));
        setCars(mappedCars);
      }
    } catch (err) {
      console.error('Error loading cars:', err);
      setError('Failed to load cars');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Skip loading if authentication is still in progress or user not available
    if (isAuthLoading) return;
    if (!user) return;

    loadCarsData();
  }, [user, isAuthLoading]);

  useEffect(() => {
    // Skip loading if authentication is still in progress or user not available
    if (isAuthLoading) return;
    if (!user) return;

    const loadReservations = async () => {
      try {
        console.log('Loading reservations...');
        const reservationsData = await ReservationsService.getReservations();
        console.log('Raw reservations from database:', reservationsData);
        setReservations(reservationsData);
      } catch (err) {
        console.error('Error loading reservations:', err);
      }
    };

    loadReservations();
  }, [user, isAuthLoading]);

  // Voitures avec leur statut RÉEL calculé (dépend des réservations chargées)
  const carsWithRealStatus = useMemo(
    () => computeRealStatuses(cars, reservations),
    [cars, reservations]
  );

  // ── Périmètre : PARC COMPLET, toutes agences confondues ───────────────────
  // Le parc `cars` est PARTAGÉ entre les agences : cette page affiche donc
  // TOUTES les voitures quelle que soit l'agence active (aucun filtre
  // d'agence). Le rattachement reste lisible grâce aux badges d'agence sur
  // chaque carte, et un filtre d'agence facultatif permet de se restreindre
  // ponctuellement à une agence sans masquer le reste du parc.
  const filteredCars = carsWithRealStatus.filter(car => {
    const q = debouncedSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      car.brand.toLowerCase().includes(q) ||
      car.model.toLowerCase().includes(q) ||
      car.registration.toLowerCase().includes(q) ||
      // La recherche accepte aussi le nom d'une agence.
      carCompanyBadges(car.id).some(b => b.name.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (companyFilter !== 'all' && !carCompanyIds(car.id).includes(companyFilter)) return false;
    return true;
  });

  // Compteurs par statut réel — sur le parc entier (toutes agences).
  const counters = useMemo(() => ({
    disponible:  carsWithRealStatus.filter(c => c.status === 'disponible').length,
    reserve:     carsWithRealStatus.filter(c => c.status === 'reserve').length,
    louer:       carsWithRealStatus.filter(c => c.status === 'louer').length,
    maintenance: carsWithRealStatus.filter(c => c.status === 'maintenance').length,
  }), [carsWithRealStatus]);

  const handleAddCar = () => {
    setSelectedCar(null);
    setIsCarModalOpen(true);
  };

  const handleEditCar = (car: Car) => {
    setSelectedCar(car);
    setIsCarModalOpen(true);
  };

  /** Persiste les liens voiture↔agence (car_companies) et met à jour l'état local. */
  const persistCarCompanies = async (carId: string, companyIds?: string[]) => {
    if (!companyIds) return;
    try {
      await DatabaseService.setCarCompanies(carId, companyIds);
      setCarLinks(prev => ({ ...prev, [carId]: Array.from(new Set(companyIds)) }));
    } catch (err) {
      console.warn('Error saving car companies:', err);
    }
  };

  /** Agences pré-sélectionnées pour une NOUVELLE voiture (agence active / principale). */
  const defaultNewCarCompanyIds = (): string[] => {
    const scope = companyContext.getScopeCompanyId();
    if (scope) return [scope];
    const write = companyContext.getWriteCompanyId();
    if (write) return [write];
    return companies.map(c => c.id);
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
          fuel_level: carData.fuelLevel || selectedCar.fuelLevel || 'full',
          // Propriété du véhicule
          owner_type: carData.ownerType || selectedCar.ownerType || 'personal',
          owner_name: (carData.ownerType ?? selectedCar.ownerType) === 'third_party'
            ? (carData.ownerName ?? selectedCar.ownerName ?? null)
            : null,
          owner_phone: (carData.ownerType ?? selectedCar.ownerType) === 'third_party'
            ? (carData.ownerPhone ?? selectedCar.ownerPhone ?? null)
            : null,
          agency_share_per_day: (carData.ownerType ?? selectedCar.ownerType) === 'third_party'
            ? (carData.agencySharePerDay ?? selectedCar.agencySharePerDay ?? 0)
            : 0,
          // Devises secondaires activées
          currencies: carData.currencies ?? selectedCar.currencies ?? {},
        };
        const result = await updateCar(selectedCar.id, updateData);
        if (result.success) {
          setCars(prev => prev.map(c => c.id === selectedCar.id ? { ...c, ...carData } as Car : c));
          await persistCarCompanies(selectedCar.id, carData.companyIds);
        }
      } else {
        const newCarData: AddCarData = {
          brand: carData.brand || '',
          model: carData.model || '',
          year: carData.year || new Date().getFullYear(),
          plate_number: carData.registration || '',
          price_per_day: carData.priceDay || 0,
          status: 'disponible',
          image_url: carData.images?.[0],
          color: carData.color || '',
          vin: carData.vin || '',
          energy: carData.energy || 'Essence',
          transmission: carData.transmission || 'Manuelle',
          seats: carData.seats || 5,
          doors: carData.doors || 5,
          price_week: carData.priceWeek || 0,
          price_month: carData.priceMonth || 0,
          deposit: carData.deposit || 0,
          mileage: carData.mileage || 0,
          // Propriété du véhicule (par défaut : voiture de l'agence)
          owner_type: carData.ownerType || 'personal',
          owner_name: carData.ownerType === 'third_party' ? (carData.ownerName || null) : null,
          owner_phone: carData.ownerType === 'third_party' ? (carData.ownerPhone || null) : null,
          agency_share_per_day: carData.ownerType === 'third_party' ? (carData.agencySharePerDay || 0) : 0,
          currencies: carData.currencies || {},
        };
        const result = await addCar(newCarData);
        if (result.success && result.car) {
          const newCar: Car = {
            id: result.car.id || '',
            brand: result.car.brand,
            model: result.car.model,
            registration: result.car.plate_number,
            year: result.car.year,
            color: result.car.color || 'Premium',
            vin: result.car.vin || '',
            energy: result.car.energy || 'Essence',
            transmission: result.car.transmission || 'Automatique',
            seats: result.car.seats || 5,
            doors: result.car.doors || 4,
            priceDay: Math.round(Number(result.car.price_per_day)),
            priceWeek: Math.round(Number(result.car.price_week || result.car.price_per_day)),
            priceMonth: Math.round(Number(result.car.price_month || result.car.price_per_day)),
            deposit: Math.round(Number(result.car.deposit || result.car.price_per_day * 2)),
            images: result.car.image_url ? [result.car.image_url] : ['https://picsum.photos/seed/car/400/300'],
            mileage: result.car.mileage || 0,
            ownerType: (result.car as any).owner_type === 'third_party' ? 'third_party' : 'personal',
            ownerName: (result.car as any).owner_name || undefined,
            ownerPhone: (result.car as any).owner_phone || undefined,
            agencySharePerDay: Number((result.car as any).agency_share_per_day) || 0,
            currencies: parseCarCurrencies((result.car as any).currencies),
          };
          setCars(prev => [...prev, newCar]);
          await persistCarCompanies(newCar.id, carData.companyIds);
        }
      }
      setIsCarModalOpen(false);
    } catch (err) {
      console.error('Error saving car:', err);
      setError('Failed to save car');
    }
  };

  const handleDeleteCar = async (id: string) => {
    setCarToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (carToDelete) {
      try {
        const result = await deleteCar(carToDelete);
        if (result.success) {
          setCars(prev => prev.filter(c => c.id !== carToDelete));
          setCarToDelete(null);
          if (selectedCar?.id === carToDelete) {
            setIsCarModalOpen(false);
          }
        }
      } catch (err) {
        console.error('Error deleting car:', err);
        setError('Failed to delete car');
      }
    }
  };

  const handleViewDetails = (car: Car) => {
    setSelectedCar(car);
    setIsDetailsModalOpen(true);
  };

  const handleHistory = (car: Car) => {
    setSelectedCar(car);
    setIsHistoryModalOpen(true);
  };

  const handleExpenses = (car: Car) => {
    setSelectedCar(car);
    setIsExpenseModalOpen(true);
  };

  const handleReports = async (car: Car) => {
    setSelectedCar(car);
    // Fetch all expenses for this car
    const expensesResult = await getVehicleExpenses();
    let carExpenses = [];
    if (expensesResult.success && expensesResult.expenses) {
      carExpenses = expensesResult.expenses.filter(e => e.carId === car.id);
    }
    setReportExpenses(carExpenses);
    // Filter reservations for this car
    const carReservations = reservations.filter(r => r.carId === car.id);
    setReportReservations(carReservations);
    setIsReportModalOpen(true);
  };

  /**
   * Seul le basculement vers/depuis 'maintenance' est autorisé manuellement.
   * Les statuts 'disponible' / 'reserve' / 'louer' sont calculés automatiquement.
   */
  const handleStatusChange = async (carId: string, newStatus: string) => {
    const allowed = ['maintenance', 'disponible'];
    if (!allowed.includes(newStatus)) return; // Sécurité — ignore les appels non autorisés
    try {
      const result = await updateCar(carId, { status: newStatus } as any);
      if (result.success) {
        setCars(prev => prev.map(c =>
          c.id === carId ? { ...c, status: newStatus as Car['status'] } : c
        ));
      } else {
        setError('Failed to update car status');
      }
    } catch (err) {
      console.error('Error updating car status:', err);
      setError('Failed to update car status');
    }
  };

  /**
   * Enregistre la dépense saisie depuis la fiche du véhicule.
   * Elle atterrit dans `vehicle_expenses` : le même historique que celui
   * affiché par les pages Dépenses et Maintenance.
   */
  const handleSaveExpense = async (expenseData: Partial<VehicleExpense>) => {
    const carId = expenseData.carId || selectedCar?.id;
    if (!carId) return;

    setSavingExpense(true);
    try {
      const result = await addVehicleExpense({
        carId,
        type: expenseData.type || 'autre',
        cost: expenseData.cost || 0,
        date: expenseData.date || new Date().toISOString().split('T')[0],
        note: expenseData.note,
        currentMileage: expenseData.currentMileage,
        nextVidangeKm: expenseData.nextVidangeKm,
        expirationDate: expenseData.expirationDate,
        expenseName: expenseData.expenseName,
        oilFilterChanged: expenseData.oilFilterChanged || false,
        airFilterChanged: expenseData.airFilterChanged || false,
        fuelFilterChanged: expenseData.fuelFilterChanged || false,
        acFilterChanged: expenseData.acFilterChanged || false,
      });

      if (!result.success) {
        console.error('Error saving expense to DB', result.error);
        setError(lang === 'fr' ? "La dépense n'a pas pu être enregistrée." : 'تعذر حفظ النفقة.');
        return;
      }

      setIsExpenseModalOpen(false);
      setPendingTypeKey(null);
    } catch (err) {
      console.error('Unexpected error saving expense', err);
      setError(lang === 'fr' ? "La dépense n'a pas pu être enregistrée." : 'تعذر حفظ النفقة.');
    } finally {
      setSavingExpense(false);
    }
  };

  /** Création d'un type de dépense sans quitter la fiche véhicule. */
  const handleSaveExpenseType = async (payload: any) => {
    setSavingType(true);
    setTypeError(null);
    try {
      const result = payload.id && !String(payload.id).startsWith('system-')
        ? await updateMaintenanceType(payload.id, payload)
        : await addMaintenanceType(payload, expenseTypes.map(t => t.key));

      if (!result.success || !result.type) {
        throw new Error(result.error || 'Enregistrement refusé');
      }

      const refreshed = await getMaintenanceTypes();
      setExpenseTypes(refreshed.types);
      setPendingTypeKey(result.type.key);
      setIsTypeModalOpen(false);
    } catch (err: any) {
      setTypeError(
        (err?.message || 'erreur inconnue')
        + (lang === 'fr'
          ? ' — exécutez le script SQL de mise à jour si la table est absente.'
          : ' — نفّذ سكربت SQL إذا كان الجدول غير موجود.')
      );
    } finally {
      setSavingType(false);
    }
  };

  return (
    <div className="space-y-10">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-100 border-2 border-red-400 text-red-800 p-4 rounded-2xl"
        >
          {error}
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white p-8 rounded-2xl border border-saas-border shadow-sm">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-saas-text-main tracking-tighter uppercase flex items-center gap-3">
            {lang === 'fr' ? 'Parc Automobile' : 'أسطول السيارات'}
          </h1>
          <p className="text-saas-primary-via font-bold text-[10px] uppercase tracking-[0.3em]">
            {lang === 'fr' ? 'Gestion de votre flotte premium' : 'إدارة أسطولك المتميز'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-saas-text-muted group-focus-within:text-saas-primary-via transition-colors" size={18} />
            <input
              type="text"
              placeholder={lang === 'fr' ? 'Rechercher un véhicule...' : 'بحث عن مركبة...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3.5 bg-saas-bg border border-saas-border rounded-xl outline-none focus:border-saas-primary-via w-full sm:w-80 transition-all font-medium text-sm shadow-sm"
            />
          </div>
          <button
            onClick={loadCarsData}
            className="btn-saas-secondary px-6 py-3.5 group w-full sm:w-auto justify-center"
            title={lang === 'fr' ? 'Actualiser' : 'تحديث'}
          >
            <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-bold uppercase tracking-widest text-xs">
              {lang === 'fr' ? 'Actualiser' : 'تحديث'}
            </span>
          </button>
          <button
            onClick={handleAddCar}
            className="btn-saas-primary px-8 py-3.5 group w-full sm:w-auto justify-center"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
            <span className="font-bold uppercase tracking-widest text-xs">
              {lang === 'fr' ? 'Nouveau Véhicule' : 'مركبة جديدة'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Filtre d'agence (parc commun à toutes les agences) ─────────────── */}
      {companies.length > 1 && (
        <div className="bg-white rounded-2xl border border-saas-border shadow-sm p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-saas-text-muted">
            {lang === 'fr'
              ? `Parc commun — ${cars.length} véhicule${cars.length > 1 ? 's' : ''} visibles pour toutes les agences`
              : `أسطول مشترك — ${cars.length} مركبة مرئية لكل الوكالات`}
          </p>
          <div className="flex flex-wrap gap-2">
            {[{ id: 'all', name: lang === 'fr' ? 'Toutes les agences' : 'كل الوكالات', count: cars.length },
              ...companies.map(c => ({
                id: c.id,
                name: c.name,
                count: cars.filter(car => carCompanyIds(car.id).includes(c.id)).length,
              }))].map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCompanyFilter(chip.id)}
                className={`px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${
                  companyFilter === chip.id
                    ? 'bg-saas-primary-via text-white border-saas-primary-via shadow-sm'
                    : 'bg-saas-bg text-saas-text-muted border-saas-border hover:border-saas-primary-via/40'
                }`}
              >
                {chip.id === 'all' ? '🚘' : '🏢'} {chip.name}
                <span className="ml-2 opacity-70">{chip.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Taux de change global (appliqué à toutes les voitures) ─────────── */}
      <div className="bg-white rounded-2xl border border-saas-border shadow-sm overflow-hidden">
        <button
          onClick={() => setShowRatesPanel(v => !v)}
          className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-saas-bg transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-saas-primary-via/10 text-saas-primary-via flex items-center justify-center">
              <Coins size={18} />
            </span>
            <span className="text-left">
              <span className="block font-black text-saas-text-main text-sm uppercase tracking-tight">
                {lang === 'fr' ? 'Taux de change global' : 'سعر الصرف العام'}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-saas-text-muted mt-0.5">
                {lang === 'fr'
                  ? 'Appliqué à toutes les voitures en une fois'
                  : 'يُطبق على جميع السيارات دفعة واحدة'}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-saas-text-muted">
              {SECONDARY_CURRENCIES.filter(c => globalRates[c].enabled).map(c => (
                <span key={c} className="px-2 py-1 rounded-lg bg-saas-bg border border-saas-border">
                  {CURRENCIES[c].flag} {globalRates[c].rate} DA
                </span>
              ))}
            </span>
            <motion.span animate={{ rotate: showRatesPanel ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={18} className="text-saas-text-muted" />
            </motion.span>
          </span>
        </button>

        <AnimatePresence initial={false}>
          {showRatesPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-saas-border bg-saas-bg"
            >
              <div className="p-6 space-y-4">
                <p className="text-xs text-saas-text-muted leading-relaxed">
                  {lang === 'fr'
                    ? "1 unité de devise = X DA. Activez une devise et fixez son taux, puis appliquez : le taux et l'activation sont copiés sur chaque voiture, et tous les prix affichés dans cette devise se recalculent avec le même taux."
                    : '1 وحدة عملة = X دج. فعّل عملة وحدّد سعرها ثم طبّق: يُنسخ السعر والتفعيل على كل سيارة، وتُحتسب كل الأسعار المعروضة بهذه العملة بنفس السعر.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {SECONDARY_CURRENCIES.map(code => {
                    const cfg = globalRates[code];
                    const meta = CURRENCIES[code];
                    return (
                      <div
                        key={code}
                        className={`rounded-2xl border-2 p-4 transition-all ${
                          cfg.enabled ? 'border-saas-primary-via bg-white' : 'border-saas-border bg-white/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-black text-saas-text-main">
                            <span className="text-xl">{meta.flag}</span>
                            {code} <span className="text-saas-text-muted font-bold">({meta.symbol})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setGlobalRates(prev => ({ ...prev, [code]: { ...prev[code], enabled: !prev[code].enabled } }))
                            }
                            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${cfg.enabled ? 'bg-saas-primary-via' : 'bg-slate-300'}`}
                            aria-label={code}
                          >
                            <motion.span
                              layout
                              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                              style={{ left: cfg.enabled ? 22 : 2 }}
                            />
                          </button>
                        </div>

                        <label className="block text-[10px] font-black uppercase tracking-widest text-saas-text-muted mt-4 mb-1.5">
                          {lang === 'fr' ? `Taux (1 ${code} = ? DA)` : `السعر (1 ${code} = ? دج)`}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            value={cfg.rate}
                            disabled={!cfg.enabled}
                            onChange={e =>
                              setGlobalRates(prev => ({
                                ...prev,
                                [code]: { ...prev[code], rate: e.target.value === '' ? 0 : Number(e.target.value) },
                              }))
                            }
                            className="w-full pl-3 pr-12 py-2.5 bg-saas-bg border border-saas-border rounded-xl outline-none focus:border-saas-primary-via font-bold text-sm disabled:opacity-50 transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-saas-text-muted">DA</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <button
                    onClick={applyGlobalRates}
                    disabled={applyingRates || cars.length === 0}
                    className="btn-saas-primary px-6 py-3 disabled:opacity-60"
                  >
                    {applyingRates
                      ? <Loader2 size={18} className="animate-spin" />
                      : <CheckCircle size={18} />}
                    <span className="font-bold uppercase tracking-widest text-xs">
                      {lang === 'fr'
                        ? `Appliquer à toutes les voitures (${cars.length})`
                        : `تطبيق على كل السيارات (${cars.length})`}
                    </span>
                  </button>
                  {ratesMessage && (
                    <span className="text-xs font-semibold text-saas-text-muted">{ratesMessage}</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Compteurs statuts réels ─────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: 'disponible', label: { fr: 'Disponibles', ar: 'متاحة' },     color: 'bg-green-50 border-green-200 text-green-700',  dot: 'bg-green-500',  count: counters.disponible },
            { key: 'reserve',    label: { fr: 'Réservés',    ar: 'محجوزة' },    color: 'bg-amber-50 border-amber-200 text-amber-700',   dot: 'bg-amber-500',  count: counters.reserve },
            { key: 'louer',      label: { fr: 'En Location', ar: 'في الإيجار' }, color: 'bg-red-50 border-red-200 text-red-700',         dot: 'bg-red-500',    count: counters.louer },
            { key: 'maintenance',label: { fr: 'Maintenance', ar: 'صيانة' },     color: 'bg-gray-50 border-gray-200 text-gray-600',      dot: 'bg-gray-500',   count: counters.maintenance },
          ].map(item => (
            <motion.div key={item.key}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`glass-card border flex items-center gap-3 p-4 ${item.color}`}>
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${item.dot}`} />
              <div>
                <p className="text-2xl font-black">{item.count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{item.label[lang]}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center min-h-96 bg-white rounded-2xl border border-saas-border"
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-saas-primary-via animate-spin" />
            <p className="text-saas-text-muted font-medium">
              {lang === 'fr' ? 'Chargement des véhicules...' : 'جاري تحميل السيارات...'}
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCars.map(car => (
              <CarCard
                key={car.id}
                car={car}
                lang={lang}
                onDelete={handleDeleteCar}
                onEdit={handleEditCar}
                onViewDetails={handleViewDetails}
                onHistory={handleHistory}
                onExpenses={handleExpenses}
                onReports={handleReports}
                onStatusChange={handleStatusChange}
                activeReservationInfo={getActiveReservationInfo(car.id)}
                // Badges d'agence : affichés dès qu'il existe plusieurs
                // agences, car le parc est commun (mono-agence = inchangé).
                companyBadges={companies.length > 1 ? carCompanyBadges(car.id) : undefined}
              />
            ))}
          </div>

          {filteredCars.length === 0 && (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-medium">
                {lang === 'fr' ? 'Aucun véhicule trouvé.' : 'لم يتم العثور على مركبات.'}
              </p>
            </div>
          )}
        </>
      )}

      <CarModal
        isOpen={isCarModalOpen}
        onClose={() => setIsCarModalOpen(false)}
        onSave={handleSaveCar}
        onDelete={handleDeleteCar}
        car={selectedCar || undefined}
        lang={lang}
        companies={companies}
        initialCompanyIds={selectedCar ? carCompanyIds(selectedCar.id) : defaultNewCarCompanyIds()}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDelete}
        title={{
          fr: 'Confirmation de suppression',
          ar: 'تأكيد الحذف'
        }}
        message={{
          fr: 'Êtes-vous sûr de vouloir supprimer ce véhicule ? Cette action est irréversible.',
          ar: 'هل أنت متأكد من رغبتك في حذف هذه المركبة؟ هذا الإجراء لا يمكن التراجع عنه.'
        }}
        lang={lang}
      />

      {selectedCar && (
        <>
          <CarDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            car={selectedCar}
            lang={lang}
          />
          <AnimatePresence>
            {isExpenseModalOpen && (
              <VehicleExpenseModal
                isOpen={isExpenseModalOpen}
                onClose={() => { setIsExpenseModalOpen(false); setPendingTypeKey(null); }}
                onSave={handleSaveExpense}
                cars={expenseModalCars}
                types={expenseTypes}
                lockedCarId={selectedCar.id}
                onRequestNewType={() => { setTypeError(null); setIsTypeModalOpen(true); }}
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
                onClose={() => setIsTypeModalOpen(false)}
                onSave={handleSaveExpenseType}
                existingKeys={expenseTypes.map(t => t.key)}
                saving={savingType}
                error={typeError}
                lang={lang}
              />
            )}
          </AnimatePresence>
          <HistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            car={selectedCar}
            reservations={reservations}
            lang={lang}
          />
          <CarReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            car={selectedCar}
            reservations={reportReservations}
            expenses={reportExpenses}
            lang={lang}
          />
        </>
      )}
    </div>
  );
};
