import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardStats, MaintenanceAlert, Language, Car, ReservationDetails, VehicleExpense, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, TrendingUp, Users, Car as CarIcon, Calendar, CalendarCheck, Clock, BarChart3, PieChart, DollarSign, Wrench, Shield, FileCheck, Loader2, AlertCircle } from 'lucide-react';
import { DatabaseService } from '../services/DatabaseService';
import { getCars } from '../services/carService';
import { getVehicleExpenses } from '../services/expenseService';
import { getVidangeAlert, getAssuranceAlert, getControleAlert, getChaineAlert } from '../utils/vidangeAlerts';
import { ReservationsService } from '../services/ReservationsService';
import { getReservationAlerts } from '../utils/reservationAlerts';
import { ReservationAlertCard } from './ReservationAlertCard';
import { scheduleNotification, checkAndTriggerScheduledNotifications, requestNotificationPermission } from '../services/notificationService';

// Mock data for dashboard (removed - now using real data)

interface DashboardPageProps {
  lang: Language;
  isAuthLoading?: boolean;
  user?: User | null;
}

interface AlertCardProps {
  alert: MaintenanceAlert;
  lang: Language;
  onAlertClick?: (alert: MaintenanceAlert) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, lang, onAlertClick }) => {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'low':
        return {
          bg: 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-800 dark:text-green-200',
          accent: 'bg-green-500',
          icon: '🟢',
          glow: 'shadow-green-500/20'
        };
      case 'medium':
        return {
          bg: 'bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-800 dark:text-yellow-200',
          accent: 'bg-yellow-500',
          icon: '🟡',
          glow: 'shadow-yellow-500/20'
        };
      case 'high':
        return {
          bg: 'bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-900/20 dark:to-red-900/20',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-800 dark:text-orange-200',
          accent: 'bg-orange-500',
          icon: '🟠',
          glow: 'shadow-orange-500/20'
        };
      case 'critical':
        return {
          bg: 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200',
          accent: 'bg-red-500',
          icon: '🔴',
          glow: 'shadow-red-500/20'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900/20 dark:to-slate-900/20',
          border: 'border-gray-200 dark:border-gray-800',
          text: 'text-gray-800 dark:text-gray-200',
          accent: 'bg-gray-500',
          icon: '⚪',
          glow: 'shadow-gray-500/20'
        };
    }
  };

  const styles = getSeverityStyles(alert.severity);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'vidange': return '🛢️';
      case 'assurance': return '🛡️';
      case 'controle': return '🔍';
      case 'chaine': return '⛓️';
      default: return '⚠️';
    }
  };

  const getProgressPercentage = () => {
    if ((alert.type === 'vidange' || alert.type === 'chaine') && alert.currentMileage !== undefined && alert.nextServiceMileage) {
      return Math.min(((alert.currentMileage || 0) / alert.nextServiceMileage) * 100, 100);
    }
    if (alert.dueDate) {
      const totalDays = alert.type === 'assurance' ? 365 : 180; // Approximate annual cycles
      const daysUntilDue = alert.daysUntilDue || 0;
      const daysSinceCreation = Math.max(0, totalDays - daysUntilDue);
      return Math.min((daysSinceCreation / totalDays) * 100, 100);
    }
    return 0;
  };

  const progressPercentage = getProgressPercentage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{
        scale: 1.03,
        boxShadow: `0 20px 40px -12px ${styles.glow}`,
        y: -2
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
      className={`relative overflow-hidden p-6 rounded-2xl border-2 ${styles.bg} ${styles.border} shadow-xl hover:shadow-2xl transition-all duration-500 backdrop-blur-sm`}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-current rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-current rounded-full translate-y-12 -translate-x-12"></div>
      </div>

      {/* Severity indicator stripe */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${styles.accent}`}></div>

      <div className="relative flex items-start gap-4">
        {/* Animated Icon */}
        <motion.div
          animate={{
            rotate: alert.severity === 'critical' ? [0, 10, -10, 0] : [0, 5, -5, 0],
            scale: alert.severity === 'critical' ? [1, 1.1, 1] : [1, 1.05, 1]
          }}
          transition={{
            duration: alert.severity === 'critical' ? 1.5 : 2,
            repeat: Infinity
          }}
          className="text-3xl flex-shrink-0 p-2 bg-white/20 rounded-xl backdrop-blur-sm"
        >
          {getAlertIcon(alert.type)}
        </motion.div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className={`font-bold text-lg uppercase tracking-tight ${styles.text}`}>
                {alert.title}
              </h4>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-lg"
              >
                {styles.icon}
              </motion.div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              alert.isExpired
                ? 'bg-red-500 text-white'
                : alert.severity === 'critical'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                : alert.severity === 'high'
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
            }`}>
              {alert.isExpired
                ? (lang === 'fr' ? 'EXPIRÉ' : 'منتهي الصلاحية')
                : alert.daysUntilDue !== undefined
                ? (lang === 'fr' ? `${alert.daysUntilDue} JOURS` : `${alert.daysUntilDue} أيام`)
                : (lang === 'fr' ? 'À VENIR' : 'قادم')
              }
            </div>
          </div>

          {/* Main Message */}
          <p className={`${styles.text} text-sm mb-4 leading-relaxed font-medium`}>
            {alert.message}
          </p>

          {/* Car Information */}
          <div className={`mb-4 p-3 rounded-xl bg-white/30 backdrop-blur-sm border border-white/20`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🚗</span>
              <span className={`font-semibold text-sm ${styles.text}`}>
                {alert.carInfo}
              </span>
            </div>

            {/* Mileage Progress for Vidange and Chaine */}
            {(alert.type === 'vidange' || alert.type === 'chaine') && alert.currentMileage !== undefined && alert.nextServiceMileage && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.text}>
                    {lang === 'fr' ? 'Kilométrage actuel:' : 'الكيلومترات الحالية:'}
                  </span>
                  <span className={`font-bold ${styles.text}`}>
                    {alert.currentMileage.toLocaleString()} km
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.text}>
                    {lang === 'fr' ? 'Prochaine vidange:' : 'الفيد الثاني:'}
                  </span>
                  <span className={`font-bold ${styles.text}`}>
                    {alert.nextServiceMileage.toLocaleString()} km
                  </span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={`h-full rounded-full ${styles.accent}`}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className={styles.text}>
                    {lang === 'fr' ? 'Progression:' : 'التقدم:'}
                  </span>
                  <span className={`font-bold ${styles.text}`}>
                    {progressPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Date Progress for Assurance/Controle */}
            {(alert.type === 'assurance' || alert.type === 'controle') && alert.dueDate && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.text}>
                    {lang === 'fr' ? 'Échéance:' : 'الموعد النهائي:'}
                  </span>
                  <span className={`font-bold ${styles.text}`}>
                    {new Date(alert.dueDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-SA')}
                  </span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={`h-full rounded-full ${styles.accent}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Additional Details */}
          <div className={`grid grid-cols-2 gap-2 text-xs ${styles.text}`}>
            <div className="flex justify-between">
              <span>{lang === 'fr' ? 'Type:' : 'النوع:'}</span>
              <span className="font-medium capitalize">{alert.type}</span>
            </div>
            <div className="flex justify-between">
              <span>{lang === 'fr' ? 'Sévérité:' : 'الخطورة:'}</span>
              <span className="font-medium capitalize">{alert.severity}</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span>{lang === 'fr' ? 'Créé le:' : 'تم الإنشاء:'}</span>
              <span className="font-medium">
                {new Date(alert.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-SA')}
              </span>
            </div>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAlertClick?.(alert)}
            className={`mt-4 w-full py-2 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${
              alert.isExpired
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white/20 hover:bg-white/30 text-current backdrop-blur-sm border border-white/30'
            }`}
          >
            {lang === 'fr' ? 'Ajouter une dépense' : 'إضافة نفقة'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ lang, isAuthLoading = false, user = null }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalReservations: 0,
    activeReservations: 0,
    totalClients: 0,
    totalCars: 0,
    availableCars: 0,
    maintenanceAlerts: 0,
    overduePayments: 0,
    recentReservations: [],
    revenueByMonth: [],
    carUtilization: []
  });
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  const [showOnlyReservationAlerts, setShowOnlyReservationAlerts] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'all' | 'maintenance' | 'reservations'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip loading if authentication is still in progress or user not available
    if (isAuthLoading) return;
    if (!user) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch real data from database in parallel
        const [dbStats, dbAlerts, carsResult, expensesResult, reservationsResult] = await Promise.all([
          DatabaseService.getDashboardStats(),
          DatabaseService.getMaintenanceAlerts(),
          getCars(),
          getVehicleExpenses(),
          ReservationsService.getReservations()
        ]);

        // Set cars and expenses for vidange alerts
        if (carsResult.success && carsResult.cars) {
          setCars(carsResult.cars.map(dbCar => ({
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
          })));
        }

        if (expensesResult.success && expensesResult.expenses) {
          setVehicleExpenses(expensesResult.expenses);
        }

        // Set reservations for alerts
        if (Array.isArray(reservationsResult)) {
          setReservations(reservationsResult);
        }

        // Map database stats to component state
        setStats({
          totalRevenue: dbStats.totalRevenue,
          totalExpenses: dbStats.totalExpenses,
          netProfit: dbStats.netProfit,
          totalClients: dbStats.totalClients,
          totalCars: dbStats.totalCars,
          activeReservations: dbStats.activeReservations,
          maintenanceAlerts: dbStats.maintenanceAlerts,
          // Use actual data from database
          monthlyRevenue: dbStats.monthlyRevenue || 0,
          totalReservations: dbStats.totalReservations || 0,
          availableCars: dbStats.availableCars || 0,
          overduePayments: dbStats.overduePayments || 0,
          recentReservations: dbStats.recentReservations || [],
          revenueByMonth: dbStats.revenueByMonth || [],
          carUtilization: dbStats.carUtilization || []
        });

        setAlerts(dbAlerts);

        setLoading(false);
      } catch (err: any) {
        console.error('Error loading dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
        setLoading(false);
      }
    };

    loadDashboardData();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [user, isAuthLoading]);

  // Schedule notifications for reservations expiring tomorrow
  useEffect(() => {
    if (reservations.length === 0) return;

    // Request notification permission on first load
    requestNotificationPermission();

    // Get all alerts to find expiring_tomorrow alerts
    const allAlerts = getReservationAlerts(reservations);
    const expiringTomorrowAlerts = allAlerts.filter(a => a.type === 'expiring_tomorrow');

    // Schedule notifications for each expiring reservation
    expiringTomorrowAlerts.forEach(alert => {
      const returnDate = new Date(alert.reservation.step1.returnDate);
      const clientName = `${alert.reservation.client.firstName} ${alert.reservation.client.lastName}`;
      const vehicleName = `${alert.reservation.car.brand} ${alert.reservation.car.model}`;
      const message = `La réservation de ${clientName} pour ${vehicleName} expire demain!`;
      
      scheduleNotification(alert.reservationId, returnDate, message);
    });

    console.log(`[Dashboard] Scheduled ${expiringTomorrowAlerts.length} notification(s) for expiring reservations`);
  }, [reservations]);

  // Check and trigger scheduled notifications every minute
  useEffect(() => {
    const notificationCheckInterval = setInterval(() => {
      checkAndTriggerScheduledNotifications();
    }, 60000); // Check every minute

    // Check immediately on mount
    checkAndTriggerScheduledNotifications();

    return () => clearInterval(notificationCheckInterval);
  }, []);

  // Filter maintenance alerts by status (exclude 'ok' status which means resolved)
  const maintenanceAlerts = cars
    .flatMap(car => [
      { type: 'vidange', alert: getVidangeAlert(car, vehicleExpenses), car },
      { type: 'assurance', alert: getAssuranceAlert(car, vehicleExpenses), car },
      { type: 'controle', alert: getControleAlert(car, vehicleExpenses), car },
      { type: 'chaine', alert: getChaineAlert(car, vehicleExpenses), car }
    ])
    .filter(item => item.alert !== null && item.alert.status !== 'ok')
    .map(item => ({
      ...item.alert,
      type: item.type,
      carId: item.car.id,
      carInfo: `${item.car.brand} ${item.car.model} - ${item.car.registration}`,
      id: `${item.car.id}-${item.type}`,
      severity: (item.alert as any).status === 'overdue' ? 'critical' : (item.alert as any).status === 'warning' ? 'high' : 'low',
      title: item.type === 'vidange' ? 'Vidange' : item.type === 'assurance' ? 'Assurance' : item.type === 'controle' ? 'Contrôle' : 'Chaîne',
      daysUntilDue: (item.alert as any).daysRemaining || 0,
      dueDate: (item.alert as any).expirationDate || null,
      currentMileage: (item.alert as any).currentMileage || 0,
      nextServiceMileage: (item.alert as any).nextVidangeKm || 0,
      isExpired: (item.alert as any).status === 'overdue'
    } as MaintenanceAlert));

  const reservationAlerts = getReservationAlerts(reservations);

  // Commandes du site public en attente d'acceptation par l'agence
  // (statut dédié 'website_reservation', avant acceptation).
  const pendingWebOrdersCount = reservations.filter(
    r => r.source === 'website' && r.status === 'website_reservation'
  ).length;

  // Apply alert filter
  let visibleAlerts = maintenanceAlerts;
  let visibleResAlerts = reservationAlerts;
  
  if (alertFilter === 'maintenance') {
    visibleResAlerts = [];
  } else if (alertFilter === 'reservations') {
    visibleAlerts = [];
  }

  const criticalAlerts = visibleAlerts.filter(a => a.severity === 'critical');
  const highAlerts = visibleAlerts.filter(a => a.severity === 'high');
  const otherAlerts = visibleAlerts.filter(a => a.severity !== 'critical' && a.severity !== 'high');

  const handleAlertClick = (alert: MaintenanceAlert) => {
    // Navigate to maintenance page with pre-selected car and expense type
    navigate('/maintenance', {
      state: {
        selectedCarId: alert.carId,
        expenseType: alert.type,
        showExpenseModal: true
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-saas-primary-via border-t-transparent rounded-full"
        />
        <span className="ml-4 text-saas-text-main font-medium">
          {lang === 'fr' ? 'Chargement du tableau de bord...' : 'جاري تحميل لوحة القيادة...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-saas-text-main mb-2">
            {lang === 'fr' ? 'Erreur de chargement' : 'خطأ في التحميل'}
          </h3>
          <p className="text-saas-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Alerte : nouvelles commandes du site web en attente d'acceptation */}
      <AnimatePresence>
        {pendingWebOrdersCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => navigate('/website-commandes')}
            className="group relative w-full flex items-center gap-4 sm:gap-5 overflow-hidden bg-gradient-to-r from-indigo-500 via-blue-600 to-blue-700 rounded-3xl px-5 sm:px-6 py-5 text-left text-white shadow-xl shadow-indigo-500/30 transition-all hover:shadow-2xl hover:shadow-indigo-500/40"
          >
            {/* Reflet animé qui balaie la carte */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] bg-white/10"
              animate={{ x: ['0%', '400%'] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
            />

            {/* Cloche + pastille du nombre */}
            <span className="relative flex-shrink-0">
              <motion.span
                className="absolute -inset-2 rounded-full bg-white/25"
                animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-3xl backdrop-blur"
              >
                🔔
              </motion.span>
              <span className="absolute -top-1.5 -right-1.5 min-w-[24px] h-6 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-black rounded-full ring-2 ring-white shadow-lg">
                {pendingWebOrdersCount > 99 ? '99+' : pendingWebOrdersCount}
              </span>
            </span>

            <div className="relative flex-1 min-w-0">
              <p className="font-black text-base sm:text-lg uppercase tracking-tight">
                {lang === 'fr'
                  ? `${pendingWebOrdersCount} nouvelle${pendingWebOrdersCount > 1 ? 's' : ''} commande${pendingWebOrdersCount > 1 ? 's' : ''} du site web`
                  : `${pendingWebOrdersCount} طلب جديد من الموقع`}
              </p>
              <p className="text-indigo-100 text-xs sm:text-sm font-medium">
                {lang === 'fr'
                  ? 'En attente de votre acceptation — cliquez pour les traiter'
                  : 'في انتظار موافقتك — انقر لمعالجتها'}
              </p>
            </div>
            <span className="relative px-4 sm:px-5 py-2.5 bg-white/20 backdrop-blur border border-white/30 font-bold rounded-xl text-sm whitespace-nowrap transition-transform group-hover:translate-x-1">
              {lang === 'fr' ? 'Traiter →' : 'معالجة →'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Alert Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-2xl border border-saas-border shadow-sm p-4">
        <h3 className="text-xs font-bold text-saas-text-muted uppercase tracking-widest sm:mr-1">
          {lang === 'fr' ? 'Filtrer les alertes' : 'تصفية التنبيهات'}
        </h3>

        <div className="flex flex-wrap gap-2">
          {([
            { key: 'all',          fr: 'Toutes',       ar: 'الجميع',  emoji: '📋', active: 'from-blue-500 to-indigo-600 shadow-blue-500/30' },
            { key: 'maintenance',  fr: 'Maintenance',  ar: 'الصيانة', emoji: '🔧', active: 'from-emerald-500 to-teal-600 shadow-emerald-500/30' },
            { key: 'reservations', fr: 'Réservations', ar: 'الحجوزات', emoji: '📅', active: 'from-cyan-500 to-sky-600 shadow-cyan-500/30' },
          ] as const).map(opt => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAlertFilter(opt.key)}
              className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wide transition-all duration-300 flex items-center gap-2 border ${
                alertFilter === opt.key
                  ? `bg-gradient-to-r ${opt.active} text-white border-transparent shadow-lg`
                  : 'bg-saas-bg border-saas-border text-saas-text-muted hover:text-saas-text-main hover:border-saas-primary-via/40'
              }`}
            >
              <span className="text-base">{opt.emoji}</span>
              <span>{lang === 'fr' ? opt.fr : opt.ar}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Vidange Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'maintenance') && (
      <div
        className="relative"
      >
        {(() => {
          const vidangeAlerts = cars
            .map(car => ({
              car,
              alert: getVidangeAlert(car, vehicleExpenses)
            }))
            .filter(item => item.alert !== null && item.alert.status !== 'ok');

          if (vidangeAlerts.length === 0) return null;

          const overdueAlerts = vidangeAlerts.filter(item => item.alert?.status === 'overdue');
          const warningAlerts = vidangeAlerts.filter(item => item.alert?.status === 'warning');

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      overdueAlerts.length > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-amber-500 to-amber-600'
                    }`}>
                      <span className="text-2xl">🛢️</span>
                    </div>
                    {(overdueAlerts.length > 0 || warningAlerts.length > 0) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                      {lang === 'fr' ? 'Alertes Vidange' : 'تنبيهات الصيانة'}
                    </h2>
                    <p className="text-saas-text-muted font-medium">
                      {overdueAlerts.length} {lang === 'fr' ? 'en retard' : 'متأخرة'}, {warningAlerts.length} {lang === 'fr' ? 'avertissements' : 'تحذيرات'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vidangeAlerts.map((item, index) => {
                  const { car, alert } = item;
                  if (!alert) return null;

                  return (
                    <motion.div
                      key={car.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => {
                        navigate('/maintenance', {
                          state: {
                            selectedCarId: car.id,
                            expenseType: 'vidange',
                            showExpenseModal: true
                          }
                        });
                      }}
                      className={`p-5 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all ${
                        alert.status === 'overdue'
                          ? 'bg-red-50 border-red-300 hover:shadow-red-200'
                          : alert.status === 'warning'
                          ? 'bg-amber-50 border-amber-300 hover:shadow-amber-200'
                          : 'bg-green-50 border-green-300 hover:shadow-green-200'
                      } shadow-lg hover:shadow-2xl`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase tracking-tight ${
                            alert.status === 'overdue'
                              ? 'text-red-700'
                              : alert.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}>
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{car.registration}</p>
                        </div>
                        <AlertCircle className={`flex-shrink-0 ${
                          alert.status === 'overdue'
                            ? 'text-red-600'
                            : alert.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`} size={20} />
                      </div>
                      <p className={`text-xs font-bold ${
                        alert.status === 'overdue'
                          ? 'text-red-600'
                          : alert.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-600 border-t pt-2">
                        Kilométrage: {alert.currentMileage.toLocaleString()} / {alert.nextVidangeKm.toLocaleString()} KM
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Assurance Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'maintenance') && (
      <div className="relative">
        {(() => {
          const assuranceAlerts = cars
            .map(car => ({
              car,
              alert: getAssuranceAlert(car, vehicleExpenses)
            }))
            .filter(item => item.alert !== null && item.alert.status !== 'ok');

          if (assuranceAlerts.length === 0) return null;

          const expiredAlerts = assuranceAlerts.filter(item => item.alert?.status === 'overdue');
          const warningAlerts = assuranceAlerts.filter(item => item.alert?.status === 'warning');
          const okAlerts = assuranceAlerts.filter(item => item.alert?.status === 'ok');

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      expiredAlerts.length > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}>
                      <span className="text-2xl">🛡️</span>
                    </div>
                    {(expiredAlerts.length > 0 || warningAlerts.length > 0) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                      {lang === 'fr' ? 'Alertes Assurance' : 'تنبيهات التأمين'}
                    </h2>
                    <p className="text-saas-text-muted font-medium">
                      {expiredAlerts.length} {lang === 'fr' ? 'expirées' : 'منتهية الصلاحية'}, {warningAlerts.length} {lang === 'fr' ? 'avertissements' : 'تحذيرات'}, {okAlerts.length} {lang === 'fr' ? 'valides' : 'صحيحة'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assuranceAlerts.map((item, index) => {
                  const { car, alert } = item;
                  if (!alert) return null;

                  return (
                    <motion.div
                      key={car.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => {
                        navigate('/maintenance', {
                          state: {
                            selectedCarId: car.id,
                            expenseType: 'assurance',
                            showExpenseModal: true
                          }
                        });
                      }}
                      className={`p-5 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all ${
                        alert.status === 'overdue'
                          ? 'bg-red-50 border-red-300 hover:shadow-red-200'
                          : alert.status === 'warning'
                          ? 'bg-amber-50 border-amber-300 hover:shadow-amber-200'
                          : 'bg-green-50 border-green-300 hover:shadow-green-200'
                      } shadow-lg hover:shadow-2xl`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase tracking-tight ${
                            alert.status === 'overdue'
                              ? 'text-red-700'
                              : alert.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}>
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{car.registration}</p>
                        </div>
                        <Shield className={`flex-shrink-0 ${
                          alert.status === 'overdue'
                            ? 'text-red-600'
                            : alert.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`} size={20} />
                      </div>
                      <p className={`text-xs font-bold ${
                        alert.status === 'overdue'
                          ? 'text-red-600'
                          : alert.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {alert.message}
                      </p>
                      <div className="text-xs text-gray-600 border-t pt-2 space-y-1">
                        <p>
                          {lang === 'fr' ? 'Expiration:' : 'الانتهاء:'} {alert.expirationDate ? new Date(alert.expirationDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-SA') : 'N/A'}
                        </p>
                        <p>
                          {(alert.daysRemaining ?? 0) >= 0
                            ? `${lang === 'fr' ? 'Jours restants:' : 'الأيام المتبقية:'} ${alert.daysRemaining}`
                            : `${lang === 'fr' ? 'Jours expirés:' : 'الأيام المنتهية:'} ${Math.abs(alert.daysRemaining ?? 0)}`
                          }
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Controle Technique Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'maintenance') && (
      <div className="relative">
        {(() => {
          const controleAlerts = cars
            .map(car => ({
              car,
              alert: getControleAlert(car, vehicleExpenses)
            }))
            .filter(item => item.alert !== null && item.alert.status !== 'ok');

          if (controleAlerts.length === 0) return null;

          const expiredAlerts = controleAlerts.filter(item => item.alert?.status === 'overdue');
          const warningAlerts = controleAlerts.filter(item => item.alert?.status === 'warning');
          const okAlerts = controleAlerts.filter(item => item.alert?.status === 'ok');

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      expiredAlerts.length > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-purple-500 to-purple-600'
                    }`}>
                      <span className="text-2xl">🔍</span>
                    </div>
                    {(expiredAlerts.length > 0 || warningAlerts.length > 0) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                      {lang === 'fr' ? 'Alertes Contrôle Technique' : 'تنبيهات الفحص الفني'}
                    </h2>
                    <p className="text-saas-text-muted font-medium">
                      {expiredAlerts.length} {lang === 'fr' ? 'expirées' : 'منتهية الصلاحية'}, {warningAlerts.length} {lang === 'fr' ? 'avertissements' : 'تحذيرات'}, {okAlerts.length} {lang === 'fr' ? 'valides' : 'صحيحة'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {controleAlerts.map((item, index) => {
                  const { car, alert } = item;
                  if (!alert) return null;

                  return (
                    <motion.div
                      key={car.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => {
                        navigate('/maintenance', {
                          state: {
                            selectedCarId: car.id,
                            expenseType: 'controle',
                            showExpenseModal: true
                          }
                        });
                      }}
                      className={`p-5 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all ${
                        alert.status === 'overdue'
                          ? 'bg-red-50 border-red-300 hover:shadow-red-200'
                          : alert.status === 'warning'
                          ? 'bg-amber-50 border-amber-300 hover:shadow-amber-200'
                          : 'bg-green-50 border-green-300 hover:shadow-green-200'
                      } shadow-lg hover:shadow-2xl`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase tracking-tight ${
                            alert.status === 'overdue'
                              ? 'text-red-700'
                              : alert.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}>
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{car.registration}</p>
                        </div>
                        <FileCheck className={`flex-shrink-0 ${
                          alert.status === 'overdue'
                            ? 'text-red-600'
                            : alert.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`} size={20} />
                      </div>
                      <p className={`text-xs font-bold ${
                        alert.status === 'overdue'
                          ? 'text-red-600'
                          : alert.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {alert.message}
                      </p>
                      <div className="text-xs text-gray-600 border-t pt-2 space-y-1">
                        <p>
                          {lang === 'fr' ? 'Expiration:' : 'الانتهاء:'} {alert.expirationDate ? new Date(alert.expirationDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-SA') : 'N/A'}
                        </p>
                        <p>
                          {(alert.daysRemaining ?? 0) >= 0
                            ? `${lang === 'fr' ? 'Jours restants:' : 'الأيام المتبقية:'} ${alert.daysRemaining}`
                            : `${lang === 'fr' ? 'Jours expirés:' : 'الأيام المنتهية:'} ${Math.abs(alert.daysRemaining ?? 0)}`
                          }
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Chaîne (Chain/Belt) Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'maintenance') && (
      <div className="relative">
        {(() => {
          const chaineAlerts = cars
            .map(car => ({
              car,
              alert: getChaineAlert(car, vehicleExpenses)
            }))
            .filter(item => item.alert !== null && item.alert.status !== 'ok');

          if (chaineAlerts.length === 0) return null;

          const overdueAlerts = chaineAlerts.filter(item => item.alert?.status === 'overdue');
          const warningAlerts = chaineAlerts.filter(item => item.alert?.status === 'warning');

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      overdueAlerts.length > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-orange-500 to-orange-600'
                    }`}>
                      <span className="text-2xl">⛓️</span>
                    </div>
                    {(overdueAlerts.length > 0 || warningAlerts.length > 0) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                      {lang === 'fr' ? 'Alertes Chaîne / Courroie' : 'تنبيهات السلسلة / التيمي'}
                    </h2>
                    <p className="text-saas-text-muted font-medium">
                      {overdueAlerts.length} {lang === 'fr' ? 'en retard' : 'متأخرة'}, {warningAlerts.length} {lang === 'fr' ? 'avertissements' : 'تحذيرات'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chaineAlerts.map((item, index) => {
                  const { car, alert } = item;
                  if (!alert) return null;

                  return (
                    <motion.div
                      key={car.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => {
                        navigate('/maintenance', {
                          state: {
                            selectedCarId: car.id,
                            expenseType: 'chaine',
                            showExpenseModal: true
                          }
                        });
                      }}
                      className={`p-5 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all ${
                        alert.status === 'overdue'
                          ? 'bg-red-50 border-red-300 hover:shadow-red-200'
                          : alert.status === 'warning'
                          ? 'bg-amber-50 border-amber-300 hover:shadow-amber-200'
                          : 'bg-green-50 border-green-300 hover:shadow-green-200'
                      } shadow-lg hover:shadow-2xl`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase tracking-tight ${
                            alert.status === 'overdue'
                              ? 'text-red-700'
                              : alert.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}>
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{car.registration}</p>
                        </div>
                        <span className="text-xl flex-shrink-0">⛓️</span>
                      </div>
                      <p className={`text-xs font-bold ${
                        alert.status === 'overdue'
                          ? 'text-red-600'
                          : alert.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-600 border-t pt-2">
                        {lang === 'fr' ? 'Kilométrage:' : 'الكيلومترات:'} {alert.currentMileage.toLocaleString()} / {alert.nextVidangeKm.toLocaleString()} KM
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Reservation Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'reservations') && reservations && reservations.length > 0 && (() => {
        const resAlerts = getReservationAlerts(reservations);
        
        if (resAlerts.length === 0) return null;

        const criticalResAlerts = resAlerts.filter(a => a.severity === 'critical');
        const highResAlerts = resAlerts.filter(a => a.severity === 'high');
        const mediumResAlerts = resAlerts.filter(a => a.severity === 'medium');

        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="relative"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                    criticalResAlerts.length > 0
                      ? 'bg-gradient-to-br from-red-600 to-rose-600'
                      : highResAlerts.length > 0
                      ? 'bg-gradient-to-br from-orange-500 to-red-600'
                      : 'bg-gradient-to-br from-yellow-500 to-orange-600'
                  }`}>
                    <span className="text-2xl">🚗</span>
                  </div>
                  {resAlerts.length > 0 && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-pulse shadow-lg"
                    />
                  )}
                </motion.div>
                <div>
                  <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                    {lang === 'fr' ? 'Alertes Réservations' : 'تنبيهات الحجوزات'}
                  </h2>
                  <p className="text-saas-text-muted font-medium">
                    {criticalResAlerts.length} {lang === 'fr' ? 'critiques' : 'حرجة'}, {highResAlerts.length} {lang === 'fr' ? 'élevées' : 'عالية'}, {mediumResAlerts.length} {lang === 'fr' ? 'moyennes' : 'متوسطة'}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowOnlyReservationAlerts(!showOnlyReservationAlerts)}
                className={`px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wide transition-all ${
                  showOnlyReservationAlerts
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                }`}
              >
                {lang === 'fr' ? '+ Voir Alertes' : '+ عرض التنبيهات'}
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {resAlerts.map((alert, index) => (
                <ReservationAlertCard
                  key={alert.id}
                  alert={alert}
                  onAlertClick={(res) => {
                    console.log('[Reservation Alert] Clicked alert:', res.reservationId, res.id);
                    navigate('/planner', {
                      state: {
                        selectedReservationId: res.reservationId,
                        viewMode: 'details'
                      }
                    });
                  }}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════
          TABLEAU DE BORD — En-tête, indicateurs, graphiques, actions.
          Les blocs d'alertes ci-dessus conservent volontairement leur design
          d'origine (bannière commandes, filtres, vidanges, réservations).
          ══════════════════════════════════════════════════════════════════ */}

      {/* En-tête */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl bg-[#0F172A] text-white p-8"
      >
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-[#DC2626]/22 blur-3xl" />
        <div className="absolute -left-16 -bottom-24 w-64 h-64 rounded-full bg-[#0284C7]/22 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div>
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 rounded-2xl bg-[#DC2626] flex items-center justify-center shadow-lg shadow-[#DC2626]/30">
                <BarChart3 className="w-7 h-7" />
              </span>
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase">
                  {lang === 'fr' ? 'Tableau de bord' : 'لوحة القيادة'}
                </h1>
                <p className="text-white/55 font-bold uppercase text-[10px] tracking-[0.25em] mt-1.5">
                  {lang === 'fr' ? "Vue d'ensemble de l'activité" : 'نظرة عامة على النشاط'}
                </p>
              </div>
            </div>

            <p className="mt-5 flex items-center gap-2 text-sm text-white/60 font-medium capitalize">
              <Clock className="w-4 h-4" />
              {currentTime.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>

          {/* Chiffres clés en un coup d'œil */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4">
            {[
              { label: lang === 'fr' ? 'Clients' : 'العملاء', value: stats.totalClients },
              { label: lang === 'fr' ? 'Véhicules' : 'المركبات', value: stats.totalCars },
              { label: lang === 'fr' ? 'Contrats' : 'العقود', value: stats.totalReservations },
            ].map(k => (
              <div key={k.label} className="rounded-2xl bg-white/8 border border-white/15 px-5 py-4 text-center backdrop-blur-sm">
                <p className="text-2xl font-black leading-none">{k.value}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/50 mt-1.5">{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Indicateurs principaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 anim-stagger">
        {[
          {
            label: lang === 'fr' ? 'Réservations actives' : 'الحجوزات النشطة',
            value: stats.activeReservations.toLocaleString('fr-DZ'),
            hint: lang === 'fr' ? 'En cours et confirmées' : 'جارية ومؤكدة',
            icon: <CalendarCheck className="w-5 h-5" />,
            bar: 'bg-[#0284C7]', text: 'text-[#0284C7]',
            onClick: () => navigate('/planificateur'),
          },
          {
            label: lang === 'fr' ? 'Véhicules disponibles' : 'المركبات المتاحة',
            value: `${stats.availableCars}/${stats.totalCars}`,
            hint: stats.totalCars > 0
              ? `${Math.round((stats.availableCars / stats.totalCars) * 100)} % ${lang === 'fr' ? 'de la flotte' : 'من الأسطول'}`
              : '—',
            icon: <CarIcon className="w-5 h-5" />,
            bar: 'bg-emerald-500', text: 'text-emerald-600',
            onClick: () => navigate('/vehicules'),
          },
          {
            label: lang === 'fr' ? 'Revenu du mois' : 'إيرادات الشهر',
            value: `${Math.round(stats.monthlyRevenue || 0).toLocaleString('fr-DZ')} DA`,
            hint: lang === 'fr'
              ? `Total : ${Math.round(stats.totalRevenue || 0).toLocaleString('fr-DZ')} DA`
              : `الإجمالي: ${Math.round(stats.totalRevenue || 0).toLocaleString('fr-DZ')} دج`,
            icon: <TrendingUp className="w-5 h-5" />,
            bar: 'bg-[#0F172A]', text: 'text-[#0F172A]',
            onClick: () => navigate('/rapports'),
          },
          {
            label: lang === 'fr' ? 'Alertes maintenance' : 'تنبيهات الصيانة',
            value: String(stats.maintenanceAlerts),
            hint: `${criticalAlerts.length} ${lang === 'fr' ? 'critique(s)' : 'حرجة'}`,
            icon: <AlertTriangle className="w-5 h-5" />,
            bar: 'bg-[#DC2626]', text: 'text-[#DC2626]',
            onClick: () => navigate('/maintenance'),
          },
        ].map(kpi => (
          <button
            key={kpi.label}
            onClick={kpi.onClick}
            className="relative text-left bg-white rounded-2xl border border-saas-border p-5 overflow-hidden hover-lift cursor-pointer"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${kpi.bar}`} />
            <div className="flex items-start justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-saas-text-muted leading-tight pr-2">
                {kpi.label}
              </p>
              <span className={kpi.text}>{kpi.icon}</span>
            </div>
            <p className={`text-2xl font-black leading-tight ${kpi.text}`}>{kpi.value}</p>
            <p className="text-[11px] text-saas-text-muted mt-1 font-semibold">{kpi.hint}</p>
          </button>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenus par mois */}
        <div className="bg-white rounded-3xl border border-saas-border overflow-hidden">
          <div className="px-6 py-4 border-b border-saas-border bg-saas-bg flex items-center justify-between">
            <h3 className="font-black uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-[#0F172A] text-white flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </span>
              {lang === 'fr' ? 'Revenus par mois' : 'الإيرادات الشهرية'}
            </h3>
          </div>

          <div className="p-6">
            {(stats.revenueByMonth || []).length === 0 ? (
              <p className="py-12 text-center text-sm font-semibold text-saas-text-muted">
                {lang === 'fr' ? 'Aucune donnée de revenu sur la période' : 'لا توجد بيانات إيرادات'}
              </p>
            ) : (
              <div className="space-y-3">
                {stats.revenueByMonth.map((item, index) => {
                  const max = Math.max(...stats.revenueByMonth.map(r => r.revenue), 1);
                  const pct = Math.round((item.revenue / max) * 100);
                  return (
                    <div key={item.month} className="flex items-center gap-4">
                      <span className="w-12 text-[11px] font-black uppercase tracking-wider text-saas-text-muted shrink-0">
                        {item.month}
                      </span>
                      <div className="flex-1 h-3 rounded-full bg-saas-bg border border-saas-border overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full bg-linear-to-r from-[#DC2626] to-[#0284C7]"
                        />
                      </div>
                      <span className="w-28 text-right text-sm font-black text-saas-text-main shrink-0">
                        {Math.round(item.revenue).toLocaleString('fr-DZ')} DA
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Taux d'utilisation des véhicules */}
        <div className="bg-white rounded-3xl border border-saas-border overflow-hidden">
          <div className="px-6 py-4 border-b border-saas-border bg-saas-bg flex items-center justify-between">
            <h3 className="font-black uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-[#0284C7] text-white flex items-center justify-center">
                <CarIcon className="w-4 h-4" />
              </span>
              {lang === 'fr' ? 'Utilisation des véhicules' : 'استخدام المركبات'}
            </h3>
          </div>

          <div className="p-6">
            {(stats.carUtilization || []).length === 0 ? (
              <p className="py-12 text-center text-sm font-semibold text-saas-text-muted">
                {lang === 'fr' ? 'Aucune donnée d’utilisation' : 'لا توجد بيانات استخدام'}
              </p>
            ) : (
              <div className="space-y-4">
                {stats.carUtilization.slice(0, 6).map((car, index) => (
                  <div key={car.carId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-saas-text-main truncate pr-3">{car.carInfo}</span>
                      <span className={`text-sm font-black shrink-0 ${
                        car.utilization >= 70 ? 'text-emerald-600'
                          : car.utilization >= 35 ? 'text-[#0284C7]' : 'text-[#DC2626]'
                      }`}>
                        {car.utilization}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-saas-bg border border-saas-border overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, car.utilization)}%` }}
                        transition={{ duration: 0.7, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full ${
                          car.utilization >= 70 ? 'bg-emerald-500'
                            : car.utilization >= 35 ? 'bg-[#0284C7]' : 'bg-[#DC2626]'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accès rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 anim-stagger">
        {[
          {
            title: lang === 'fr' ? 'Nouvelle réservation' : 'حجز جديد',
            desc: lang === 'fr' ? 'Créer un contrat de location' : 'إنشاء عقد تأجير',
            cta: lang === 'fr' ? 'Créer' : 'إنشاء',
            icon: <CalendarCheck className="w-5 h-5" />,
            accent: '#DC2626',
            to: '/planificateur',
          },
          {
            title: lang === 'fr' ? 'Ajouter un véhicule' : 'إضافة مركبة',
            desc: lang === 'fr' ? 'Étendre la flotte' : 'توسيع الأسطول',
            cta: lang === 'fr' ? 'Ajouter' : 'إضافة',
            icon: <CarIcon className="w-5 h-5" />,
            accent: '#0284C7',
            to: '/vehicules',
          },
          {
            title: lang === 'fr' ? 'Bénéfices par voiture' : 'أرباح كل سيارة',
            desc: lang === 'fr' ? 'Locations, dépenses, bénéfices' : 'الإيجارات والمصاريف والأرباح',
            cta: lang === 'fr' ? 'Analyser' : 'تحليل',
            icon: <PieChart className="w-5 h-5" />,
            accent: '#0F172A',
            to: '/gains-vehicule',
          },
          {
            title: lang === 'fr' ? 'Rapports' : 'التقارير',
            desc: lang === 'fr' ? 'Performances et statistiques' : 'الأداء والإحصائيات',
            cta: lang === 'fr' ? 'Voir' : 'عرض',
            icon: <BarChart3 className="w-5 h-5" />,
            accent: '#059669',
            to: '/rapports',
          },
        ].map(action => (
          <button
            key={action.title}
            onClick={() => navigate(action.to)}
            className="group relative text-left bg-white rounded-3xl border border-saas-border p-6 overflow-hidden hover-lift cursor-pointer"
          >
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: action.accent }} />
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white mb-4"
              style={{ background: action.accent }}
            >
              {action.icon}
            </span>
            <h4 className="font-black text-saas-text-main leading-tight">{action.title}</h4>
            <p className="text-xs text-saas-text-muted mt-1 leading-relaxed">{action.desc}</p>
            <span
              className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-transform group-hover:translate-x-1"
              style={{ color: action.accent }}
            >
              {action.cta} →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
