import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { CarsPage } from './components/CarsPage';
import { MaintenancePage } from './components/MaintenancePage';
import { AgenciesPage } from './components/AgenciesPage';
import { ClientsPage } from './components/ClientsPage';
import { EquipePage } from './components/EquipePage';
import { ExpensesPage } from './components/ExpensesPage';
import { ConfigPage } from './components/ConfigPage';
import { WebsiteManagementPage } from './components/WebsiteManagementPage';
import { WebsiteOrders } from './components/WebsiteOrders';
import { ProtectionServicesPage } from './components/ProtectionServicesPage';
import { PlannerPage } from './components/PlannerPage';
import { Website } from './components/Website';
import { DashboardPage } from './components/DashboardPage';
import ReportsPage from './components/ReportsPage';
import { CarGainsPage } from './components/CarGainsPage';
import { ReservationsPage } from './components/ReservationsPage';
import { EntreprisesPage } from './components/EntreprisesPage';
import { Language, User, UserRole, Car, Agency, WorkerPermissions, Company } from './types';
import { supabase, supabaseConfigured } from './supabase';
import { SIDEBAR_ITEMS } from './constants';
import { DatabaseService } from './services/DatabaseService';
import { setupErrorInterceptor } from './utils/errorInterceptor';
import { DebugAuth } from './utils/debugAuth';
import { sessionService } from './utils/sessionService';
import { initTheme } from './utils/themeService';
import { PermissionsProvider, usePermissions } from './utils/permissions';
import { companyContext } from './utils/companyContext';
import { CompanyProvider } from './utils/companyProvider';

// Initialize global error interceptor on load
setupErrorInterceptor();

// Applique le thème clair/sombre enregistré avant le premier rendu
initTheme();

// Make Supabase available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).__supabase__ = supabase;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>('fr');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); // Add loading state
  const [isSidebarVisible, setIsSidebarVisible] = useState(window.innerWidth >= 1024);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cars, setCars] = useState<Car[]>([]);
  const [specialOffers, setSpecialOffers] = useState<any[]>([]);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [websiteSettings, setWebsiteSettings] = useState<any>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoadingAgenciesForWebsite, setIsLoadingAgenciesForWebsite] = useState(true);
  const [maintenanceAlertsCount, setMaintenanceAlertsCount] = useState(0);
  const [webOrdersCount, setWebOrdersCount] = useState(0);
  // Permissions de l'employé connecté (null pour un admin = accès total)
  const [workerPermissions, setWorkerPermissions] = useState<WorkerPermissions | null>(null);
  // Multi-agences : liste des agences (pour le switcher / le formulaire voiture)
  // et statut super-admin de l'utilisateur connecté.
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  // L'agence active doit être résolue AVANT que les pages ne chargent leurs
  // données, sinon une requête pourrait partir avec le mauvais périmètre.
  const [companyResolved, setCompanyResolved] = useState(false);
  const isAdminUser = !user || user.role === 'admin';
  
  // Refs to prevent multiple listener initialization (especially important in StrictMode dev environment)
  const authListenerInitialized = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isWebsiteMode = location.pathname === '/website';

  // Sync URL with active tab - extract tab from URL on mount and when URL changes
  useEffect(() => {
    const pathname = location.pathname;
    
    // Map URL paths to tab IDs
    const pathMap: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/planificateur': 'planner',
      '/gains-vehicule': 'car-gains',
      '/vehicules': 'vehicles',
      '/maintenance': 'maintenance',
      '/clients': 'clients',
      '/agences': 'agencies',
      '/equipe': 'team',
      '/personalisation': 'personalization',
      '/depenses': 'expenses',
      '/website-management': 'web-mgmt',
      '/website-commandes': 'web-orders',
      '/protection-services': 'protection-services',
      '/reservations': 'reservations',
      '/entreprises': 'entreprises',
      '/rapports': 'reports',
      '/configuration': 'config',
      '/': 'dashboard', // Default to dashboard
    };

    const tabId = pathMap[pathname] || 'dashboard';
    setActiveTab(tabId);
  }, [location.pathname]);

  // Charge les permissions de l'employé connecté (un admin n'en a pas besoin).
  useEffect(() => {
    if (!user || isAuthLoading) return;
    if (user.role === 'admin') {
      setWorkerPermissions(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await DatabaseService.getWorkerPermissionsByEmail(user.email);
        if (!cancelled) setWorkerPermissions(info?.permissions || { interfaces: [], actions: {} });
      } catch (err) {
        console.error('[Auth] Failed to load worker permissions:', err);
        if (!cancelled) setWorkerPermissions({ interfaces: [], actions: {} });
      }
    })();
    return () => { cancelled = true; };
  }, [user, isAuthLoading]);

  // Résout l'agence active + le statut super-admin de l'utilisateur, puis
  // charge la liste des agences (switcher + formulaire voiture). Le singleton
  // companyContext est alimenté ici pour que la couche service filtre/estampille
  // dès les premières requêtes.
  useEffect(() => {
    if (!user || isAuthLoading) return;
    let cancelled = false;
    setCompanyResolved(false);
    (async () => {
      try {
        // userId stocké = auth.uid() pour un admin (fallback si la session SDK
        // n'est pas encore restaurée au moment de la résolution).
        const stored = await sessionService.getCurrentSession();
        const info = await DatabaseService.getMyCompanyInfo({ userId: stored?.userId, email: user.email, role: user.role });
        if (cancelled) return;
        companyContext.setUserInfo(info.companyId, info.isSuperAdmin, info.scopeKnown);
        setIsSuperAdmin(info.isSuperAdmin);
      } catch (err) {
        console.warn('[Auth] Failed to resolve company info (defaulting to super-admin):', err);
        // Périmètre NON fiable : lecture non filtrée (comme avant), mais aucune
        // agence ne sera devinée à l'écriture (voir companyContext).
        companyContext.setUserInfo(null, true, false);
        if (!cancelled) setIsSuperAdmin(true);
      }
      try {
        const list = await DatabaseService.getCompanies();
        if (cancelled) return;
        companyContext.setCompanies(list);
        setCompanies(list);
      } catch (err) {
        // Table companies indisponible → l'app reste mono-agence (aucun switcher).
        console.warn('[Auth] Failed to load companies list:', err);
        if (!cancelled) setCompanies([]);
      } finally {
        // Périmètre prêt : les pages peuvent désormais charger avec le bon filtre.
        if (!cancelled) setCompanyResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user, isAuthLoading]);

  // Responsive sidebar visibility
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarVisible(true);
      } else {
        setIsSidebarVisible(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update URL when active tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    
    const urlMap: Record<string, string> = {
      'dashboard': '/dashboard',
      'planner': '/planificateur',
      'car-gains': '/gains-vehicule',
      'vehicles': '/vehicules',
      'maintenance': '/maintenance',
      'clients': '/clients',
      'agencies': '/agences',
      'team': '/equipe',
      'personalization': '/personalisation',
      'expenses': '/depenses',
      'web-mgmt': '/website-management',
      'web-orders': '/website-commandes',
      'protection-services': '/protection-services',
      'reservations': '/reservations',
      'entreprises': '/entreprises',
      'reports': '/rapports',
      'config': '/configuration',
    };
    
    // Navigate with empty state to clear any previous location.state
    // This prevents pages like MaintenancePage from re-opening modals
    // triggered by previous dashboard alert clicks
    navigate(urlMap[tabId] || '/dashboard', { state: {} });
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Load maintenance alerts count when user is authenticated
  useEffect(() => {
    if (!user || isAuthLoading) return;

    const loadAlerts = async () => {
      try {
        const alerts = await DatabaseService.getMaintenanceAlerts();
        setMaintenanceAlertsCount(alerts.length);
      } catch (err) {
        console.error('Error loading alerts:', err);
        setMaintenanceAlertsCount(0);
      }
      // Commandes du site en attente d'acceptation (badge planificateur) :
      // statut dédié 'website_reservation', avant que l'agence ne les accepte.
      try {
        const orders = await DatabaseService.getWebsiteOrders();
        setWebOrdersCount(orders.filter(o => o.status === 'website_reservation').length);
      } catch (err) {
        console.error('Error loading website orders count:', err);
        setWebOrdersCount(0);
      }
    };

    loadAlerts();

    // Refresh alerts every 5 minutes
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, isAuthLoading]);

  // Rafraîchit le badge « nouvelles commandes du site » (sidebar) après
  // qu'une commande a été acceptée / annulée dans « Commandes Website ».
  const refreshWebOrdersCount = async () => {
    try {
      const orders = await DatabaseService.getWebsiteOrders();
      setWebOrdersCount(orders.filter(o => o.status === 'website_reservation').length);
    } catch (err) {
      console.error('Error refreshing website orders count:', err);
    }
  };

  // Load cars from database. La table cars est lisible en anonyme (RLS),
  // ce qui permet au site public d'afficher les vraies voitures sans connexion.
  useEffect(() => {
    const loadCars = async () => {
      try {
        const dbCars = await DatabaseService.getCars();
        setCars(dbCars.length > 0 ? dbCars : mockCars);
      } catch (error) {
        console.error('Failed to load cars from database:', error);
        // Fallback to mock data if database load fails
        setCars(mockCars);
      }
    };

    loadCars();
  }, [user]); // Recharge après connexion/déconnexion

  // Load website data from database
  useEffect(() => {
    const loadWebsiteData = async () => {
      try {
        const [dbSpecialOffers, dbContactInfo, dbWebsiteSettings] = await Promise.all([
          DatabaseService.getSpecialOffers(),
          DatabaseService.getWebsiteContacts(),
          DatabaseService.getWebsiteSettings(),
        ]);

        setSpecialOffers(dbSpecialOffers);
        setContactInfo(dbContactInfo || mockContactInfo);
        setWebsiteSettings(dbWebsiteSettings || mockWebsiteSettings);

        // Branding dynamique : le titre et le favicon suivent le logo/nom
        // de l'agence en base (les PNG de public/ restent le défaut statique).
        if (dbWebsiteSettings?.name) {
          document.title = `${dbWebsiteSettings.name.split(/\s+/).slice(0, 3).join(' ')} | Location de Voitures`;
        }
        if (dbWebsiteSettings?.logo) {
          document.querySelectorAll("link[rel='icon']").forEach(link => {
            (link as HTMLLinkElement).href = dbWebsiteSettings.logo;
          });
        }
      } catch (error) {
        console.error('Failed to load website data from database:', error);
        // Fallback to mock data if database load fails
        setSpecialOffers([]);
        setContactInfo(mockContactInfo);
        setWebsiteSettings(mockWebsiteSettings);
      }
    };

    loadWebsiteData();
  }, []); // Load once on mount

  // fetch agencies for public website mode (used by ReservationWizard)
  useEffect(() => {
    if (!isWebsiteMode) return;

    const loadAgencies = async () => {
      try {
        const dbAgencies = await DatabaseService.getAgencies();
        setAgencies(dbAgencies.length > 0 ? dbAgencies : mockAgencies);
      } catch (err) {
        console.error('Failed to load agencies for website:', err);
        setAgencies(mockAgencies);
      } finally {
        setIsLoadingAgenciesForWebsite(false);
      }
    };

    loadAgencies();
  }, [isWebsiteMode]);

  // Define mock data immediately (used as fallback)
  const mockCars: Car[] = [
    {
      id: '1',
      brand: 'Toyota',
      model: 'Prius',
      registration: 'AB-123-CD',
      year: 2021,
      color: 'Blanc',
      vin: 'VIN123456',
      energy: 'Hybride',
      transmission: 'Automatique',
      seats: 5,
      doors: 4,
      priceDay: 5000,
      priceWeek: 28000,
      priceMonth: 90000,
      deposit: 50000,
      images: ['https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'],
      mileage: 45000,
    },
    {
      id: '2',
      brand: 'Mercedes',
      model: 'E-Class',
      registration: 'AB-456-EF',
      year: 2022,
      color: 'Noir',
      vin: 'VIN789012',
      energy: 'Essence',
      transmission: 'Automatique',
      seats: 5,
      doors: 4,
      priceDay: 12000,
      priceWeek: 70000,
      priceMonth: 200000,
      deposit: 100000,
      images: ['https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=500&h=400&fit=crop'],
      mileage: 23000,
    },
    {
      id: '3',
      brand: 'BMW',
      model: 'X5',
      registration: 'AB-789-GH',
      year: 2023,
      color: 'Gris',
      vin: 'VIN345678',
      energy: 'Essence',
      transmission: 'Automatique',
      seats: 7,
      doors: 4,
      priceDay: 15000,
      priceWeek: 85000,
      priceMonth: 250000,
      deposit: 125000,
      images: ['https://images.unsplash.com/photo-1605559424843-9e4c3ff86981?w=500&h=400&fit=crop'],
      mileage: 5000,
    },
  ];

  const mockAgencies: Agency[] = [
    {
      id: '1',
      name: 'Luxdrive Alger Centre',
      address: 'Boulevard Didouche Mourad',
      city: 'Alger',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Luxdrive Oran',
      address: 'Boulevard Khémisti',
      city: 'Oran',
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Luxdrive Annaba',
      address: 'Rue Larbi Ben Mhidi',
      city: 'Annaba',
      createdAt: new Date().toISOString(),
    },
  ];

  const mockContactInfo = {
    facebook: 'https://facebook.com/luxdrive',
    instagram: '@luxdrive_dz',
    tiktok: '@luxdrive',
    whatsapp: '+213 5 1234 5678',
    phone: '+213 5 1234 5678',
    address: 'Alger, Algeria',
    email: 'contact@luxdrive.com',
  };

  const mockWebsiteSettings = {
    name: 'Luxdrive Premium',
    description: 'Votre partenaire de confiance en location de véhicules',
    logo: 'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=200&h=200&fit=crop',
  };

  const handleLogin = (userObj: User) => {
    console.log('[Auth] ======= LOGIN HANDLER STARTED =======');
    console.log('[Auth] User logged in:', { name: userObj.name, role: userObj.role, email: userObj.email });
    console.log('[Auth] Current localStorage state:', {
      has_token: !!localStorage.getItem('supabase.auth.token'),
      token_preview: localStorage.getItem('supabase.auth.token')?.substring(0, 50) + '...'
    });
    setUser(userObj);
    // Add a delay before rendering dashboard to let Supabase settle
    setTimeout(() => {
      console.log('[Auth] 500ms delay complete, setting isAuthLoading to false');
      setIsAuthLoading(false);
    }, 500);
  };

  // Session restoration on app mount - use new session service
  useEffect(() => {
    if (authListenerInitialized.current) {
      console.log('[Auth] Session restoration already initialized, skipping');
      return;
    }
    
    authListenerInitialized.current = true;
    
    const restoreSession = async () => {
      console.log('\n[Auth] ======= SESSION RESTORATION STARTED =======');
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[Auth] Timestamp: ${timestamp}`);
      
      try {
        // Initialize session using new session service
        const session = await sessionService.initializeSession();
        
        if (!session) {
          console.log('[Auth] === No valid session found ===');
          setIsAuthLoading(false);
          return;
        }
        
        // CRITICAL: Sync the restored session with Supabase Auth SDK
        // This ensures Supabase queries work after page refresh
        console.log('[Auth] === Syncing session with Supabase ===');
        try {
          await supabase.auth.setSession({
            access_token: session.accessToken,
            refresh_token: session.refreshToken || ''
          });
          console.log('[Auth] Supabase session synchronized');
        } catch (syncError) {
          console.warn('[Auth] Failed to sync with Supabase:', syncError);
          // Continue anyway - local session is still valid
        }
        
        // Session restored from database/localStorage
        console.log('[Auth] === Session restored successfully ===');
        console.log('[Auth] User:', session.name, 'Role:', session.role);
        
        const userObj: User = {
          name: session.name,
          email: session.email,
          role: session.role as UserRole,
          avatar: '' // Add avatar property
        };
        
        setUser(userObj);
        console.log('[Auth] User state updated, ready to render dashboard');
        
        // Give React time to process state update before marking loading complete
        setTimeout(() => {
          console.log('[Auth] Setting isAuthLoading to false');
          setIsAuthLoading(false);
        }, 100);
        
      } catch (error) {
        console.error('[Auth] Session restoration error:', error);
        setUser(null);
        setIsAuthLoading(false);
      }
    };
    
    restoreSession();

    return () => {
      // No cleanup needed
    };
  }, []);

  const handleLogout = async () => {
    console.log('[Auth] Logout handler called');
    await sessionService.invalidateSession();
    await supabase.auth.signOut();
    companyContext.reset();
    setUser(null);
    navigate('/login');
  };

  // Component for Dashboard Layout (with Sidebar and Navbar)
  const DashboardLayout = () => {
    // Ensure we're using the current activeTab from parent scope
    const currentLocation = useLocation();
    
    // Sync URL path to activeTab when route changes
    useEffect(() => {
      const pathname = currentLocation.pathname;
      const pathMap: Record<string, string> = {
        '/dashboard': 'dashboard',
        '/planificateur': 'planner',
        '/gains-vehicule': 'car-gains',
        '/vehicules': 'vehicles',
        '/maintenance': 'maintenance',
        '/clients': 'clients',
        '/agences': 'agencies',
        '/equipe': 'team',
        '/personalisation': 'personalization',
        '/depenses': 'expenses',
        '/website-management': 'web-mgmt',
        '/website-commandes': 'web-orders',
        '/protection-services': 'protection-services',
        '/reservations': 'reservations',
        '/entreprises': 'entreprises',
        '/rapports': 'reports',
        '/configuration': 'config',
      };
      const tabId = pathMap[pathname] || 'dashboard';
      setActiveTab(tabId);
    }, [currentLocation.pathname]);

    const activeItem = SIDEBAR_ITEMS.find(item => item.id === activeTab) || SIDEBAR_ITEMS[0];

    /**
     * Garde d'accès : un employé qui saisit directement une URL non autorisée
     * ne doit pas voir l'écran. La sidebar filtre déjà les onglets, ceci ferme
     * la porte d'entrée par l'adresse.
     */
    const GuardedContent: React.FC<{ tabId: string; children: React.ReactNode }> = ({ tabId, children }) => {
      const { canSeeInterface } = usePermissions();
      if (canSeeInterface(tabId)) return <>{children}</>;
      return (
        <div className="glass-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/25 flex items-center justify-center mx-auto mb-5 text-3xl">
            🔒
          </div>
          <p className="text-lg font-black text-saas-text-main">
            {lang === 'fr' ? 'Accès non autorisé' : 'وصول غير مصرح به'}
          </p>
          <p className="text-sm text-saas-text-muted mt-2 max-w-md mx-auto">
            {lang === 'fr'
              ? "Cette section ne fait pas partie de vos permissions. Contactez l'administrateur si vous pensez qu'il s'agit d'une erreur."
              : 'هذا القسم ليس ضمن صلاحياتك. تواصل مع المسؤول إذا كنت تعتقد أن هذا خطأ.'}
          </p>
        </div>
      );
    };

    const renderContent = () => {
      switch (activeTab) {
        case 'dashboard':
          return <GuardedContent tabId="dashboard"><DashboardPage lang={lang} isAuthLoading={isAuthLoading} user={user} /></GuardedContent>;
        case 'planner':
          return <GuardedContent tabId="planner"><PlannerPage lang={lang} isAuthLoading={isAuthLoading} user={user} /></GuardedContent>;
        case 'car-gains':
          return <GuardedContent tabId="car-gains"><CarGainsPage lang={lang} /></GuardedContent>;
        case 'vehicles':
          return <GuardedContent tabId="vehicles"><CarsPage lang={lang} isAuthLoading={isAuthLoading} user={user} /></GuardedContent>;
        case 'maintenance':
          return <GuardedContent tabId="maintenance"><MaintenancePage lang={lang} isAuthLoading={isAuthLoading} user={user} /></GuardedContent>;
        case 'agencies':
          return <GuardedContent tabId="agencies"><AgenciesPage lang={lang} /></GuardedContent>;
        case 'clients':
          return <GuardedContent tabId="clients"><ClientsPage lang={lang} isAuthLoading={isAuthLoading} user={user} /></GuardedContent>;
        case 'entreprises':
          return <GuardedContent tabId="entreprises"><EntreprisesPage lang={lang} /></GuardedContent>;
        case 'team':
          return <GuardedContent tabId="team"><EquipePage lang={lang} /></GuardedContent>;
        case 'expenses':
          return <GuardedContent tabId="expenses"><ExpensesPage lang={lang} cars={cars} /></GuardedContent>;
        case 'web-mgmt':
          return <GuardedContent tabId="web-mgmt"><WebsiteManagementPage lang={lang} /></GuardedContent>;
        case 'web-orders':
          // Commandes du site = triage centralisé réservé au super-admin :
          // lui seul voit les commandes non encore rattachées à une agence.
          return (
            <GuardedContent tabId="web-orders">
              {isSuperAdmin ? (
                <WebsiteOrders lang={lang} companies={companies} onOrdersChanged={refreshWebOrdersCount} />
              ) : (
                <div className="glass-card p-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/25 flex items-center justify-center mx-auto mb-5 text-3xl">🔒</div>
                  <p className="text-lg font-black text-saas-text-main">
                    {lang === 'fr' ? 'Réservé au super-administrateur' : 'مخصص للمشرف العام'}
                  </p>
                  <p className="text-sm text-saas-text-muted mt-2 max-w-md mx-auto">
                    {lang === 'fr'
                      ? "Les commandes du site sont attribuées aux agences par le super-administrateur."
                      : 'يتم توزيع طلبات الموقع على الوكالات من طرف المشرف العام.'}
                  </p>
                </div>
              )}
            </GuardedContent>
          );
        case 'protection-services':
          return <GuardedContent tabId="protection-services"><ProtectionServicesPage lang={lang} /></GuardedContent>;
        case 'reservations':
          return <GuardedContent tabId="reservations"><ReservationsPage lang={lang} isAuthLoading={isAuthLoading} user={user} /></GuardedContent>;
        case 'reports':
          return <GuardedContent tabId="reports"><ReportsPage lang={lang} /></GuardedContent>;
        case 'config':
          return user ? <GuardedContent tabId="config"><ConfigPage lang={lang} user={user} /></GuardedContent> : null;
        default:
          return (
            <div className="space-y-8">
              <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black text-saas-text-main uppercase tracking-tighter">
                  {activeItem.icon} {activeItem.label[lang]}
                </h2>
                <p className="text-saas-text-muted font-bold uppercase text-[10px] tracking-widest">
                  {lang === 'fr' 
                    ? `Interface pour ${activeItem.label.fr}` 
                    : `واجهة لـ ${activeItem.label.ar}`}
                </p>
              </div>

              <div className="glass-card p-12 min-h-[500px] flex items-center justify-center border-dashed border-saas-border bg-white group">
                <div className="text-center space-y-6">
                  <div className="text-8xl opacity-10 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 transform group-hover:scale-110">
                    {activeItem.icon}
                  </div>
                  <div className="space-y-3">
                    <p className="text-saas-text-main font-black text-2xl uppercase tracking-tighter">
                      {lang === 'fr' ? 'Contenu en développement' : 'المحتوى قيد التطوير'}
                    </p>
                    <p className="text-saas-text-muted text-sm font-medium max-w-md mx-auto">
                      {lang === 'fr' 
                        ? 'Cette section est en cours de modernisation pour correspondre à votre nouveau standard SaaS.' 
                        : 'هذا القسم قيد التحديث ليتناسب مع معايير SaaS الجديدة الخاصة بك.'}
                    </p>
                  </div>
                  <button className="btn-saas-primary px-8 py-3">
                    {lang === 'fr' ? 'En savoir plus' : 'معرفة المزيد'}
                  </button>
                </div>
              </div>
            </div>
          );
      }
    };

    return (
      <div className={`flex min-h-screen bg-saas-bg text-saas-text-main ${lang === 'ar' ? 'font-arabic' : ''}`}>
        {!supabaseConfigured && (
          <div className="fixed inset-0 bg-yellow-100 text-yellow-900 flex items-center justify-center z-50 p-4 text-center">
            <strong>Warning:</strong> Supabase variables are missing. Set
            <code className="mx-1">VITE_SUPABASE_URL</code> and
            <code className="mx-1">VITE_SUPABASE_ANON_KEY</code> in your environment.
          </div>
        )}
        <Sidebar 
          lang={lang} 
          isVisible={isSidebarVisible} 
          setIsVisible={setIsSidebarVisible}
          onLogout={handleLogout}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          alertsCount={maintenanceAlertsCount}
          webOrdersCount={webOrdersCount}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar 
            user={user} 
            lang={lang} 
            setLang={setLang} 
            toggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)} 
          />
          
          <main className="admin-shell-main flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <AnimatePresence mode="wait">
              {/*
                ⚠️ Ne JAMAIS animer `filter` ici. Une valeur de filtre autre que
                `none` — y compris `blur(0px)` laissé en place à la fin de
                l'animation — fait de ce conteneur le bloc conteneur de tous les
                descendants en `position: fixed`. Les fenêtres modales
                s'ancraient alors en haut du contenu de la page : ouverte après
                avoir fait défiler, la fenêtre apparaissait hors de l'écran.
                `opacity` + `y` suffisent : Motion repose le transform à `none`.
              */}
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile Overlay */}
        <AnimatePresence>
          {isSidebarVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarVisible(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            />
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Helper component for protected routes that handles loading state
  const ProtectedRoute = () => {
    console.log('[ProtectedRoute] Rendering - isAuthLoading:', isAuthLoading, 'user:', user?.name || 'null');
    
    // Show loading state while auth is initializing, ou tant que l'agence
    // active n'est pas résolue (évite un chargement des pages hors périmètre).
    if (isAuthLoading || (user && !companyResolved)) {
      console.log('[ProtectedRoute] Auth/company still loading, showing spinner');
      return (
        <div className="min-h-screen flex items-center justify-center bg-saas-bg">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-4 border-saas-primary-via border-t-saas-primary-start rounded-full mx-auto mb-4"
            />
            <p className="text-saas-text-muted">Chargement...</p>
          </div>
        </div>
      );
    }

    // Redirect to login if not authenticated
    if (!user) {
      console.log('[ProtectedRoute] No user found, redirecting to login');
      return <Navigate to="/login" replace />;
    }

    // User is authenticated, render dashboard
    console.log('[ProtectedRoute] User authenticated, rendering dashboard');
    return (
      <PermissionsProvider isAdmin={isAdminUser} permissions={workerPermissions}>
        <CompanyProvider companies={companies}>
          <DashboardLayout />
        </CompanyProvider>
      </PermissionsProvider>
    );
  };

  return (
    <Routes>
      {/* Website route */}
      <Route path="/website" element={
        <Website
          lang={lang}
          onLangChange={setLang}
          // Le site public exclut les voitures masquées (isHiddenFromSite)
          cars={(cars.length > 0 ? cars : mockCars).filter(car => car.isHiddenFromSite !== true)}
          agencies={agencies.length > 0 ? agencies : mockAgencies}
          isLoadingAgencies={isLoadingAgenciesForWebsite}
          specialOffers={specialOffers}
          contactInfo={contactInfo}
          websiteSettings={websiteSettings}
        />
      } />

      {/* Login route */}
      <Route path="/login" element={
        isAuthLoading ? (
          <div className="min-h-screen flex items-center justify-center bg-saas-bg">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 border-4 border-saas-primary-via border-t-saas-primary-start rounded-full mx-auto mb-4"
              />
              <p className="text-saas-text-muted">Loading...</p>
            </div>
          </div>
        ) : user ? (
          <Navigate to="/dashboard" replace />
        ) : (
          <Login lang={lang} onLogin={handleLogin} />
        )
      } />

      {/* Dashboard and all interface routes - all protected */}
      <Route path="/dashboard" element={<ProtectedRoute />} />
      <Route path="/planificateur" element={<ProtectedRoute />} />
      <Route path="/gains-vehicule" element={<ProtectedRoute />} />
      <Route path="/vehicules" element={<ProtectedRoute />} />
      <Route path="/maintenance" element={<ProtectedRoute />} />
      <Route path="/clients" element={<ProtectedRoute />} />
      <Route path="/entreprises" element={<ProtectedRoute />} />
      <Route path="/agences" element={<ProtectedRoute />} />
      <Route path="/equipe" element={<ProtectedRoute />} />
      <Route path="/personalisation" element={<ProtectedRoute />} />
      <Route path="/depenses" element={<ProtectedRoute />} />
      <Route path="/website-management" element={<ProtectedRoute />} />
      <Route path="/website-commandes" element={<ProtectedRoute />} />
      <Route path="/protection-services" element={<ProtectedRoute />} />
      <Route path="/reservations" element={<ProtectedRoute />} />
      <Route path="/rapports" element={<ProtectedRoute />} />
      <Route path="/configuration" element={<ProtectedRoute />} />

      {/* Default redirect */}
      <Route path="/" element={
        isAuthLoading ? (
          <div className="min-h-screen flex items-center justify-center bg-saas-bg">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 border-4 border-saas-primary-via border-t-saas-primary-start rounded-full mx-auto mb-4"
              />
              <p className="text-saas-text-muted">Loading...</p>
            </div>
          </div>
        ) : <Navigate to={user ? "/dashboard" : "/login"} replace />
      } />

      {/* Fallback for unknown routes */}
      <Route path="*" element={
        isAuthLoading ? (
          <div className="min-h-screen flex items-center justify-center bg-saas-bg">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 border-4 border-saas-primary-via border-t-saas-primary-start rounded-full mx-auto mb-4"
              />
              <p className="text-saas-text-muted">Loading...</p>
            </div>
          </div>
        ) : <Navigate to={user ? "/dashboard" : "/login"} replace />
      } />
    </Routes>
  );
}