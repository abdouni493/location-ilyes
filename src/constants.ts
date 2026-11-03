import { SidebarItem, Agency, Car } from './types';

/**
 * Scène Spline 3D du hero de la page d'accueil publique.
 * TODO : coller ici l'URL .splinecode d'une scène de VOITURE dont vous avez
 * les droits (export "Code" → "React" dans votre compte Spline, ex :
 * "https://prod.spline.design/xxxxxxxx/scene.splinecode").
 * Tant que cette constante est vide, le hero affiche le visuel statique
 * (anneaux animés + logo) — rien ne casse.
 */
export const HERO_SPLINE_SCENE_URL = '';

/** Nom commercial affiché sur le site public (navbar, footer, pages vitrine). */
export const SITE_NAME = 'MHD AUTO';

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'dashboard', label: { fr: 'Tableau de bord', ar: 'لوحة القيادة' }, icon: '📊' },
  { id: 'planner', label: { fr: 'Planificateur', ar: 'المخطط' }, icon: '📅' },
  { id: 'web-orders', label: { fr: 'Website réservations', ar: 'حجوزات الموقع' }, icon: '🛒' },
  { id: 'reservations', label: { fr: 'Contrats', ar: 'العقود' }, icon: '🧾' },
  { id: 'protection-services', label: { fr: 'Protection & Services', ar: 'الحماية والخدمات' }, icon: '🛡️' },
  { id: 'vehicles', label: { fr: 'Véhicules', ar: 'المركبات' }, icon: '🚗' },
  { id: 'maintenance', label: { fr: 'Maintenance', ar: 'الصيانة' }, icon: '🔧' },
  { id: 'clients', label: { fr: 'Clients', ar: 'العملاء' }, icon: '👥' },
  { id: 'entreprises', label: { fr: 'Entreprises', ar: 'الشركات' }, icon: '🏭' },
  { id: 'agencies', label: { fr: 'Agences', ar: 'الوكالات' }, icon: '🏢' },
  { id: 'team', label: { fr: 'Équipe', ar: 'الفريق' }, icon: '🤝' },
  { id: 'expenses', label: { fr: 'Dépenses', ar: 'المصاريف' }, icon: '📉' },
  { id: 'web-mgmt', label: { fr: 'Website management', ar: 'إدارة الموقع' }, icon: '🌐' },
  { id: 'car-gains', label: { fr: 'Bénéfices par voiture', ar: 'أرباح كل سيارة' }, icon: '💰' },
  { id: 'reports', label: { fr: 'Rapports', ar: 'التقارير' }, icon: '📄' },
  { id: 'config', label: { fr: 'Settings', ar: 'الإعدادات' }, icon: '⚙️' },
];

/**
 * Catalogue des actions (boutons) disponibles par interface.
 * Sert d'unique source de vérité à l'écran « Permissions » de l'équipe :
 * l'admin coche les interfaces visibles, puis les boutons autorisés dans
 * chacune. Les actions sensibles (paiements, suppressions) sont explicitement
 * séparées afin de pouvoir les refuser individuellement.
 */
export interface InterfaceAction {
  id: string;
  label: { fr: string; ar: string };
  /** Action sensible : mise en avant dans l'écran des permissions. */
  sensitive?: boolean;
}

export const INTERFACE_ACTIONS: Record<string, InterfaceAction[]> = {
  dashboard: [
    { id: 'view_stats', label: { fr: 'Voir les statistiques', ar: 'عرض الإحصائيات' } },
    { id: 'view_alerts', label: { fr: 'Voir les alertes', ar: 'عرض التنبيهات' } },
  ],
  planner: [
    { id: 'create', label: { fr: 'Créer une réservation', ar: 'إنشاء حجز' } },
    { id: 'edit', label: { fr: 'Modifier une réservation', ar: 'تعديل حجز' } },
    { id: 'activate', label: { fr: 'Activer la location', ar: 'تفعيل التأجير' } },
    { id: 'complete', label: { fr: 'Terminer la location', ar: 'إنهاء التأجير' } },
    { id: 'cancel', label: { fr: 'Annuler une réservation', ar: 'إلغاء حجز' }, sensitive: true },
    { id: 'delete', label: { fr: 'Supprimer une réservation', ar: 'حذف حجز' }, sensitive: true },
    { id: 'payments', label: { fr: 'Gérer les paiements', ar: 'إدارة المدفوعات' }, sensitive: true },
    { id: 'delete_payment', label: { fr: 'Supprimer un paiement', ar: 'حذف دفعة' }, sensitive: true },
    { id: 'print', label: { fr: 'Imprimer les documents', ar: 'طباعة الوثائق' } },
    { id: 'send_email', label: { fr: 'Envoyer par email', ar: 'إرسال بالبريد' } },
  ],
  'web-orders': [
    { id: 'view', label: { fr: 'Consulter les commandes', ar: 'عرض الطلبات' } },
    { id: 'accept', label: { fr: 'Accepter une commande', ar: 'قبول طلب' } },
    { id: 'cancel', label: { fr: 'Annuler une commande', ar: 'إلغاء طلب' }, sensitive: true },
    { id: 'delete', label: { fr: 'Supprimer une commande', ar: 'حذف طلب' }, sensitive: true },
  ],
  reservations: [
    { id: 'view', label: { fr: 'Consulter les contrats', ar: 'عرض العقود' } },
    { id: 'print', label: { fr: 'Imprimer un contrat', ar: 'طباعة عقد' } },
    { id: 'invoice', label: { fr: 'Générer une facture', ar: 'إنشاء فاتورة' } },
    { id: 'payments', label: { fr: 'Gérer les paiements', ar: 'إدارة المدفوعات' }, sensitive: true },
    { id: 'delete_payment', label: { fr: 'Supprimer un paiement', ar: 'حذف دفعة' }, sensitive: true },
    { id: 'delete', label: { fr: 'Supprimer un contrat', ar: 'حذف عقد' }, sensitive: true },
  ],
  'protection-services': [
    { id: 'create', label: { fr: 'Créer', ar: 'إنشاء' } },
    { id: 'edit', label: { fr: 'Modifier', ar: 'تعديل' } },
    { id: 'delete', label: { fr: 'Supprimer', ar: 'حذف' }, sensitive: true },
  ],
  vehicles: [
    { id: 'create', label: { fr: 'Ajouter un véhicule', ar: 'إضافة مركبة' } },
    { id: 'edit', label: { fr: 'Modifier un véhicule', ar: 'تعديل مركبة' } },
    { id: 'delete', label: { fr: 'Supprimer un véhicule', ar: 'حذف مركبة' }, sensitive: true },
    { id: 'toggle_visibility', label: { fr: 'Masquer / afficher sur le site', ar: 'إخفاء/إظهار في الموقع' } },
    { id: 'view_prices', label: { fr: 'Voir les tarifs', ar: 'عرض الأسعار' } },
  ],
  maintenance: [
    { id: 'create', label: { fr: 'Ajouter une intervention', ar: 'إضافة صيانة' } },
    { id: 'edit', label: { fr: 'Modifier', ar: 'تعديل' } },
    { id: 'delete', label: { fr: 'Supprimer', ar: 'حذف' }, sensitive: true },
  ],
  clients: [
    { id: 'create', label: { fr: 'Créer un client', ar: 'إنشاء عميل' } },
    { id: 'edit', label: { fr: 'Modifier un client', ar: 'تعديل عميل' } },
    { id: 'delete', label: { fr: 'Supprimer un client', ar: 'حذف عميل' }, sensitive: true },
    { id: 'history', label: { fr: 'Voir l\'historique', ar: 'عرض السجل' } },
  ],
  entreprises: [
    { id: 'create', label: { fr: 'Créer une entreprise', ar: 'إنشاء شركة' } },
    { id: 'edit', label: { fr: 'Modifier une entreprise', ar: 'تعديل شركة' } },
    { id: 'delete', label: { fr: 'Supprimer une entreprise', ar: 'حذف شركة' }, sensitive: true },
    { id: 'history', label: { fr: 'Voir l\'historique', ar: 'عرض السجل' } },
  ],
  agencies: [
    { id: 'create', label: { fr: 'Créer une agence', ar: 'إنشاء وكالة' } },
    { id: 'edit', label: { fr: 'Modifier une agence', ar: 'تعديل وكالة' } },
    { id: 'delete', label: { fr: 'Supprimer une agence', ar: 'حذف وكالة' }, sensitive: true },
  ],
  team: [
    { id: 'create', label: { fr: 'Créer un employé', ar: 'إنشاء موظف' } },
    { id: 'view', label: { fr: 'Voir la fiche', ar: 'عرض البطاقة' } },
    { id: 'edit', label: { fr: 'Modifier un employé', ar: 'تعديل موظف' } },
    { id: 'delete', label: { fr: 'Supprimer un employé', ar: 'حذف موظف' }, sensitive: true },
    { id: 'permissions', label: { fr: 'Gérer les permissions', ar: 'إدارة الصلاحيات' }, sensitive: true },
    { id: 'advance', label: { fr: 'Acomptes', ar: 'السلف' }, sensitive: true },
    { id: 'absence', label: { fr: 'Absences', ar: 'الغيابات' } },
    { id: 'payment', label: { fr: 'Payer un employé', ar: 'دفع راتب' }, sensitive: true },
    { id: 'delete_payment', label: { fr: 'Supprimer un paiement', ar: 'حذف دفعة' }, sensitive: true },
  ],
  personalization: [
    { id: 'edit', label: { fr: 'Modifier les modèles', ar: 'تعديل النماذج' } },
    { id: 'delete', label: { fr: 'Supprimer un modèle', ar: 'حذف نموذج' }, sensitive: true },
  ],
  expenses: [
    { id: 'create', label: { fr: 'Ajouter une dépense', ar: 'إضافة مصروف' } },
    { id: 'edit', label: { fr: 'Modifier une dépense', ar: 'تعديل مصروف' } },
    { id: 'delete', label: { fr: 'Supprimer une dépense', ar: 'حذف مصروف' }, sensitive: true },
  ],
  'web-mgmt': [
    { id: 'edit_settings', label: { fr: 'Modifier les réglages du site', ar: 'تعديل إعدادات الموقع' } },
    { id: 'offers', label: { fr: 'Gérer les offres', ar: 'إدارة العروض' } },
    { id: 'promo_codes', label: { fr: 'Gérer les codes promo', ar: 'إدارة أكواد الخصم' }, sensitive: true },
    { id: 'delete', label: { fr: 'Supprimer', ar: 'حذف' }, sensitive: true },
  ],
  'car-gains': [
    { id: 'view', label: { fr: 'Consulter les bénéfices', ar: 'عرض الأرباح' } },
    { id: 'view_agency_share', label: { fr: 'Voir la part de l\'agence', ar: 'عرض حصة الوكالة' }, sensitive: true },
    { id: 'print', label: { fr: 'Imprimer le rapport', ar: 'طباعة التقرير' } },
  ],
  reports: [
    { id: 'view', label: { fr: 'Consulter les rapports', ar: 'عرض التقارير' } },
    { id: 'export', label: { fr: 'Exporter / imprimer', ar: 'تصدير / طباعة' } },
  ],
  config: [
    { id: 'edit', label: { fr: 'Modifier la configuration', ar: 'تعديل الإعدادات' }, sensitive: true },
    { id: 'rental_settings', label: { fr: 'Paramètres de location', ar: 'إعدادات التأجير' }, sensitive: true },
  ],
};

// Agencies data
export const AGENCIES: Agency[] = [
  {
    id: '1',
    name: 'Agence Centre Ville',
    address: '123 Rue Principal, Alger Centre',
    city: 'Alger'
  },
  {
    id: '2',
    name: 'Agence Aéroport',
    address: 'Aéroport Houari Boumediene, Alger',
    city: 'Alger'
  },
  {
    id: '3',
    name: 'Agence Oran',
    address: '456 Boulevard de la République, Oran',
    city: 'Oran'
  },
  {
    id: '4',
    name: 'Agence Constantine',
    address: '789 Rue de France, Constantine',
    city: 'Constantine'
  }
];

// Car images data
export const CAR_IMAGES = {
  toyota: [
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop'
  ],
  renault: [
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'
  ],
  peugeot: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'
  ],
  citroen: [
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop'
  ],
  bmw: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'
  ],
  mercedes: [
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop'
  ],
  audi: [
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'
  ],
  default: [
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop'
  ]
};

export const TRANSLATIONS = {
  fr: {
    login: 'Connexion',
    email: 'Email',
    password: 'Mot de passe',
    username: 'Nom d\'utilisateur',
    signup: 'Créer un compte',
    admin: 'Administrateur',
    worker: 'Employé',
    driver: 'Chauffeur',
    logout: 'Déconnexion',
    welcome: 'Bienvenue',
    changeLang: 'العربية',
  },
  ar: {
    login: 'تسجيل الدخول',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    username: 'اسم المستخدم',
    signup: 'إنشاء حساب',
    admin: 'مدير',
    worker: 'موظف',
    driver: 'سائق',
    logout: 'تسجيل الخروج',
    welcome: 'مرحباً',
    changeLang: 'Français',
  }
};
