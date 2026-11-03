export type Language = 'fr' | 'ar';

export type UserRole = 'admin' | 'worker' | 'driver';

export interface User {
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export interface SidebarItem {
  id: string;
  label: {
    fr: string;
    ar: string;
  };
  icon: string;
}

/**
 * Agence « métier » (multi-agences) — une entreprise indépendante avec sa
 * propre comptabilité et ses propres employés. À ne PAS confondre avec
 * `Agency` (agence physique = point de départ/retour). Le champ `company_id`
 * relie les données (réservations, clients, dépenses…) à l'une de ces agences.
 */
export interface Company {
  id: string;
  name: string;
  logo?: string;
  isPrimary?: boolean;
  createdAt?: string;
}

/** Propriété du véhicule : flotte de l'agence, ou véhicule confié par un tiers. */
export type CarOwnerType = 'personal' | 'third_party';

export interface Car {
  id: string;
  brand: string;
  model: string;
  registration: string;
  year: number;
  color: string;
  vin: string;
  energy: string;
  transmission: string;
  seats: number;
  doors: number;
  priceDay: number;
  priceWeek: number;
  priceMonth: number;
  deposit: number;
  images: string[];
  mileage: number;
  fuelLevel?: 'full' | 'half' | 'quarter' | 'eighth' | 'empty';
  // Statut dérivé des réservations réelles (calculé par getCarsWithRealStatus).
  // Seul 'maintenance' peut être saisi manuellement en base.
  status?: 'disponible' | 'reserve' | 'louer' | 'maintenance';
  // Masquée du site public (visible par défaut). Les vues admin l'affichent quand même.
  isHiddenFromSite?: boolean;

  // ── Propriété du véhicule ────────────────────────────────────────────
  /** 'personal' (défaut) = voiture de l'agence · 'third_party' = voiture d'un tiers. */
  ownerType?: CarOwnerType;
  ownerName?: string;
  ownerPhone?: string;
  /** Part revenant à l'agence par jour de location (DZD), pour un véhicule tiers. */
  agencySharePerDay?: number;

  // ── Multi-devises ────────────────────────────────────────────────────
  /**
   * Devises secondaires activables. Le DZD reste la base ; chaque devise
   * porte son taux de change (1 unité = N DZD) et les prix jour/semaine/
   * mois/caution en sont dérivés automatiquement.
   * Forme : { EUR: { enabled: true, rate: 150 }, USD: {...}, GBP: {...} }
   */
  currencies?: Record<string, { enabled: boolean; rate: number }>;

  // ── Multi-agences ────────────────────────────────────────────────────
  /**
   * Ids des agences (companies) auxquelles cette voiture est rattachée
   * (table `car_companies`). Une voiture peut appartenir à une ou plusieurs
   * agences. Vide/absent = héritée par l'agence principale.
   */
  companyIds?: string[];
}

/**
 * Clé du type de dépense véhicule.
 *
 * Les cinq clés historiques restent des types « système », mais la liste est
 * désormais ouverte : l'utilisateur peut créer ses propres types depuis la
 * page Maintenance (bougies, freins, pneus…). La clé créée est stockée telle
 * quelle dans `vehicle_expenses.type`, d'où le `string` en union.
 */
export type ExpenseType =
  | 'vidange' | 'assurance' | 'controle' | 'chaine' | 'autre'
  | (string & {});

/** Mode de suivi d'un type de maintenance. */
export type MaintenanceTracking =
  /** Compte à rebours en kilomètres (vidange, chaîne, bougies…). */
  | 'mileage'
  /** Compte à rebours en jours via une date d'expiration (assurance, contrôle). */
  | 'date'
  /** Simple ligne de dépense, sans échéance. */
  | 'simple';

/** Palette disponible pour un type de maintenance (classes Tailwind statiques). */
export type MaintenanceColor =
  | 'red' | 'blue' | 'amber' | 'green' | 'purple'
  | 'teal' | 'orange' | 'indigo' | 'pink' | 'slate';

/**
 * Définition d'un type de maintenance / dépense véhicule.
 * Table `maintenance_types` — les lignes `isSystem` ne sont pas supprimables.
 */
export interface MaintenanceType {
  id: string;
  key: string;
  labelFr: string;
  labelAr: string;
  icon: string;
  tracking: MaintenanceTracking;
  defaultIntervalKm?: number | null;
  defaultIntervalDays?: number | null;
  color: MaintenanceColor;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface Expense {
  id: string;
  carId: string;
  type: ExpenseType;
  cost: number;
  date: string;
  note?: string;
  // Specific fields
  nextVidangeKm?: number;
  expirationDate?: string;
  name?: string; // For 'autre'
}

export interface Rental {
  id: string;
  carId: string;
  clientId: string;
  clientName?: string;
  startDate: string;
  endDate: string;
  totalCost: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
}

export interface Agency {
  id: string;
  name: string;
  address: string;
  city: string;
  createdAt?: string;
}

export interface Client {
  id: string;
  // Personal Information
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;

  // Official Documents
  idCardNumber?: string;
  licenseNumber: string;
  licenseExpirationDate?: string;
  licenseDeliveryDate?: string;
  licenseDeliveryPlace?: string;

  // Additional Documents
  documentType?: 'id_card' | 'passport' | 'none';
  documentNumber?: string;
  documentDeliveryDate?: string;
  documentExpirationDate?: string;
  documentDeliveryAddress?: string;

  // Address & Location
  wilaya: string;
  completeAddress?: string;

  // Media
  profilePhoto?: string;
  scannedDocuments?: string[];

  createdAt: string;
  agencyId?: string;
}

export type PaymentType = 'daily' | 'monthly';

export interface WorkerAdvance {
  id: string;
  amount: number;
  date: string;
  note?: string;
  /** true dès qu'un paiement a déduit cet acompte. */
  settled?: boolean;
}

export interface WorkerAbsence {
  id: string;
  cost: number;
  date: string;
  note?: string;
  /** true dès qu'un paiement a déduit cette absence. */
  settled?: boolean;
}

/** Commission versée à un employé pour sa contribution à une réservation. */
export interface WorkerCommission {
  id: string;
  reservationId: string;
  workerId: string;
  workerName?: string;
  commissionType: 'fixed' | 'percentage';
  commissionValue: number;
  baseAmount: number;
  amount: number;
  /** 'immediate' = payée à la création (caisse agence) ; 'deferred' = sur son compte. */
  payoutMode: 'immediate' | 'deferred';
  status: 'pending' | 'paid';
  paidVia?: 'creation' | 'advance' | 'payment';
  paidAt?: string;
  workerPaymentId?: string;
  workerAdvanceId?: string;
  storeExpenseId?: string;
  note?: string;
  createdByName?: string;
  createdAt: string;
  reservation?: {
    departureDate?: string;
    returnDate?: string;
    totalPrice?: number;
    clientName?: string;
    carName?: string;
    carPlate?: string;
  };
}

export interface WorkerPayment {
  id: string;
  amount: number;
  date: string;
  baseSalary: number;
  advances: number;
  absences: number;
  netSalary: number;
  note?: string;
  /** Période couverte : 'YYYY-MM' en mensuel, 'YYYY-MM-DD' en journalier. */
  periodKey?: string;
}

/** Rôle métier créé librement par l'admin (Gérant, Réceptionniste, Chauffeur…). */
export interface WorkerRole {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Permissions d'un employé.
 * `interfaces` : ids des onglets visibles dans sa sidebar (voir SIDEBAR_ITEMS).
 * `actions`    : par onglet, les ids d'actions autorisées (voir INTERFACE_ACTIONS).
 */
export interface WorkerPermissions {
  interfaces: string[];
  actions: Record<string, string[]>;
}

export interface Worker {
  id: string;
  // Personal Information
  fullName: string;
  dateOfBirth?: string;
  phone: string;
  email: string;
  address?: string;
  profilePhoto?: string;
  /** Numéro de carte d'identité (optionnel). */
  idCardNumber?: string;

  // Work Information
  type: 'admin' | 'worker' | 'driver';
  /** Rôle métier libre (nom), en plus du `type` technique. */
  roleId?: string;
  roleName?: string;
  /** Date d'entrée en fonction. */
  startDate?: string;

  // Rémunération
  /** false = l'employé n'est pas rémunéré via l'application. */
  paymentEnabled?: boolean;
  paymentType?: PaymentType;
  baseSalary: number;

  // Login Credentials
  username: string;
  password: string;
  /** Un compte de connexion Supabase Auth est-il actif pour cet employé ? */
  accountEnabled?: boolean;
  /** id de l'utilisateur Supabase Auth associé (si compte créé). */
  authUserId?: string;
  /** Agence métier (company) de rattachement de l'employé. */
  companyId?: string;

  // Permissions (vide à la création : l'admin les attribue ensuite)
  permissions?: WorkerPermissions;

  // Records
  advances: WorkerAdvance[];
  absences: WorkerAbsence[];
  payments: WorkerPayment[];
  /** Commissions sur réservations (chargées à part, tolérant si table absente). */
  commissions?: WorkerCommission[];

  createdAt: string;
}

/** Client entreprise (société) — utilisé sur les contrats et les factures. */
export interface Entreprise {
  id: string;
  name: string;
  /** Registre de commerce, ex : 12/00-0000000B19 */
  rc?: string;
  /** Article d'imposition, ex : 000000000 */
  art?: string;
  /** Numéro d'identification statistique (15 chiffres). */
  nis?: string;
  /** Numéro d'identification fiscale (15 chiffres). */
  nif?: string;
  address?: string;
  phone?: string;
  email?: string;
  createdAt: string;
}
export interface StoreExpense {
  id: string;
  name: string;
  cost: number;
  date: string;
  note?: string;
  icon?: string;
  createdAt: string;
}

export interface VehicleExpense {
  id: string;
  carId: string;
  type: ExpenseType;
  cost: number;
  date: string;
  note?: string;
  currentMileage?: number;
  /** Intervalle (en km) avant la prochaine échéance, pas une valeur absolue. */
  nextVidangeKm?: number;
  expirationDate?: string;
  expenseName?: string;
  createdAt: string;
  oilFilterChanged?: boolean;
  airFilterChanged?: boolean;
  fuelFilterChanged?: boolean;
  acFilterChanged?: boolean;
}

export interface ReservationStep1 {
  carId: string;
  departureDate: string;
  departureTime: string;
  departureAgency: string;
  returnDate: string;
  returnTime: string;
  returnAgency: string;
  differentReturnAgency: boolean;
}

export interface ReservationStep2 {
  photo?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  licenseNumber: string;
  licenseExpiration?: string;
  licenseDelivery?: string;
  licenseDeliveryPlace?: string;
  additionalDocType?: 'id_card' | 'passport' | 'none';
  additionalDocNumber?: string;
  additionalDocDelivery?: string;
  additionalDocExpiration?: string;
  additionalDocDeliveryAddress?: string;
  wilaya: string;
  completeAddress?: string;
  scannedDocuments?: string[];
  // Informations de vol (réservations du site public)
  flightNumber?: string;
  flightDate?: string;
  flightTime?: string;
  flightTicketImage?: string;
}

export interface Reservation {
  id: string;
  step1: ReservationStep1;
  step2: ReservationStep2;
  carInfo: Car;
  totalDays: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

// Une offre spéciale est une PROMOTION attachée à une voiture existante.
// isActive = affichée sur le site (le toggle masquer/afficher) ;
// startDate/endDate (optionnelles) limitent la période de validité de la promo.
export interface SpecialOffer {
  id: string;
  carId: string;
  car: Car;
  oldPrice: number;
  newPrice: number;
  note?: string;
  isActive: boolean;
  createdAt: string;
  label?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  startDate?: string;
  endDate?: string;
}

export interface ContactInfo {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  whatsapp?: string;
  phone?: string;
  address?: string;
  email?: string;
}

export interface WebsiteSettings {
  name: string;
  description: string;
  logo?: string;
  phone_number_2?: string;
  bank_number?: string;
  address?: string;
  phone?: string;
  /** Image de fond du landing du site public (URL storage, affichée floutée). */
  landing_background?: string;
}

// Code promo utilisable sur la réservation du site public
export interface PromoCode {
  id: string;
  code: string;
  discountPercentage: number;
  isActive: boolean;
  isUsed: boolean;
  usedAt?: string | null;
  reservationId?: string | null;
  createdAt: string;
}

// Planner Types
export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  idCardNumber?: string;
  licenseNumber: string;
  licenseExpiration?: string;
  licenseDelivery?: string;
  licenseDeliveryPlace?: string;
  additionalDocType?: 'id_card' | 'passport' | 'none';
  additionalDocNumber?: string;
  additionalDocDelivery?: string;
  additionalDocExpiration?: string;
  additionalDocDeliveryAddress?: string;
  wilaya: string;
  completeAddress?: string;
  scannedDocuments?: string[];
  profilePhoto?: string;
  createdAt: string;
}

export interface InspectionItem {
  id: string;
  category: 'security' | 'equipment' | 'comfort' | 'cleanliness';
  name: string;
  checked: boolean;
}

export interface VehicleInspection {
  id: string;
  reservationId: string;
  type: 'departure' | 'return';
  mileage: number;
  fuelLevel: 'full' | 'half' | 'quarter' | 'eighth' | 'empty';
  location: string;
  date: string;
  time: string;
  interiorPhotos: string[];
  exteriorPhotos: string[];
  inspectionItems: InspectionItem[];
  notes: string;
  signature?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  date: string;
  method: 'cash' | 'card' | 'transfer' | 'check';
  note?: string;
  createdAt: string;
}

export interface AdditionalService {
  id: string;
  category: 'decoration' | 'equipment' | 'insurance' | 'service';
  name: string;
  description?: string;
  price: number;
  selected: boolean;
  /**
   * Service obligatoire : pré-sélectionné automatiquement sur toute nouvelle
   * réservation (application ET site public) et non décochable.
   */
  isMandatory?: boolean;
}

// Un item d'un forfait d'assurance de protection (avec son statut vrai/faux).
export interface ProtectionAssuranceItem {
  linkId?: string;
  itemId: string;
  name: string;
  status: boolean;
  displayOrder?: number;
}

// Un forfait d'assurance de protection (nom + prix/jour + liste d'items).
export interface ProtectionAssurance {
  id: string;
  name: string;
  pricePerDay: number;
  isActive: boolean;
  createdAt: string;
  items: ProtectionAssuranceItem[];
}

export interface ReservationDetails {
  id: string;
  clientId: string;
  client: Client;
  carId: string;
  car: Car;
  step1: ReservationStep1;
  step2: ReservationStep2;
  additionalServices: AdditionalService[];
  deposit: number;
  totalDays: number;
  totalPrice: number;
  discountAmount: number;
  discountType: 'percentage' | 'fixed';
  advancePayment: number;
  remainingPayment: number;
  // 'website_reservation' : commande brute reçue du site public, en attente
  // d'acceptation par l'agence (n'apparaît PAS dans le planificateur).
  // 'continued' : location ACTIVE prolongée (continuité de location) — le
  // client garde le véhicule des jours supplémentaires facturés à part.
  status: 'website_reservation' | 'pending' | 'accepted' | 'confirmed' | 'active' | 'continued' | 'completed' | 'cancelled';
  // Forfait d'assurance de protection sélectionné (snapshot + référence).
  protectionAssuranceId?: string;
  protectionAssuranceName?: string;
  protectionAssurancePrice?: number; // prix/jour au moment de la réservation
  protectionAssurance?: ProtectionAssurance; // détail (items) chargé pour l'affichage
  /** Caution activée / désactivée (défaut : activée). */
  cautionEnabled?: boolean;
  /** true si le total a été saisi manuellement à la création (ne pas recalculer). */
  isManualPrice?: boolean;
  /** Commissions employés liées à cette réservation. */
  workerCommissions?: WorkerCommission[];
  departureInspection?: VehicleInspection;
  returnInspection?: VehicleInspection;
  payments: Payment[];
  excessMileage?: number;
  missingFuel?: number;
  additionalFees: number;
  tvaApplied: boolean;
  notes?: string;
  conditions?: string;
  createdAt: string;
  activatedAt?: string;
  completedAt?: string;
  createdBy?: string;
  createdByName?: string;
  /** Origine de la réservation : 'website' (site public) ou 'agency' (admin). */
  source?: 'website' | 'agency';
  /**
   * Agence métier (`companies`) propriétaire de la réservation. NULL = commande
   * du site public pas encore acceptée (aucune agence rattachée).
   */
  companyId?: string | null;

  // ── Timbre fiscal (droit de timbre) ─────────────────────────────────
  timbreEnabled?: boolean;
  /** Taux appliqué : 1, 1.5 ou 2 (%). */
  timbreRate?: number;
  /** Montant du timbre en DZD. */
  timbreAmount?: number;

  // ── Devise choisie par le client (réservations du site public) ───────
  currency?: string;          // 'DZD' | 'USD' | 'EUR' | 'GBP'
  /** 1 unité de `currency` = `currencyRate` DZD (1 si DZD). */
  currencyRate?: number;
  /** Total dans la devise choisie (le totalPrice reste TOUJOURS en DZD). */
  totalPriceCurrency?: number;

  // ── Code promo consommé (site public) ───────────────────────────────
  promoCode?: string;
  promoDiscountPercentage?: number;
  /** Montant de la réduction en DZD. */
  promoDiscountAmount?: number;

  // ── Entreprise rattachée (facturation société) ──────────────────────
  entrepriseId?: string;
  entreprise?: Entreprise;

  // ── Informations de vol (réservations du site public) ───────────────
  flightNumber?: string;
  flightDate?: string;
  flightTime?: string;
  /** URL de l'image du billet fournie par le client. */
  flightTicketImage?: string;

  // ── Continuité de location (prolongation) ───────────────────────────
  /** Total des jours ajoutés par les prolongations successives. */
  continuationDays?: number;
  /** Total facturé au titre des prolongations (DZD). */
  continuationAmount?: number;
  /** Nombre de prolongations enregistrées. */
  continuationCount?: number;
  /** Date de retour AVANT la toute première prolongation. */
  originalReturnDate?: string;
  /** Durée (jours) du contrat initial, avant prolongation. */
  originalTotalDays?: number;
  /** Montant du contrat initial, avant prolongation. */
  originalTotalPrice?: number;
  /** Horodatage de la dernière prolongation. */
  lastContinuedAt?: string;
  /** Prolongations enregistrées (la plus récente en premier). */
  continuations?: ReservationContinuation[];
}

/**
 * Une prolongation (« continuité de location ») : des jours ajoutés à une
 * location en cours, facturés de façon TOTALEMENT INDÉPENDANTE du contrat
 * initial. Le contrat de continuité n'imprime que ces jours-là.
 */
export interface ReservationContinuation {
  id: string;
  reservationId: string;
  companyId?: string | null;
  /** Numéro d'ordre (1 = première prolongation). */
  sequenceNumber: number;
  /** Jours ajoutés à la location. */
  addedDays: number;
  /** Tarif journalier appliqué à CES jours uniquement. */
  pricePerDay: number;
  /** Coût total de la prolongation (jours ajoutés × tarif). */
  totalPrice: number;
  /** Date de retour avant cette prolongation. */
  previousReturnDate?: string;
  /** Nouvelle date de retour après cette prolongation. */
  newReturnDate?: string;
  returnTime?: string;
  /** Montant encaissé immédiatement (le reste part en dette). */
  paidAmount: number;
  paymentMethod?: string;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

/** Paramètres globaux de l'agence appliqués à toutes les fins de location. */
export interface RentalSettings {
  /** Limite de kilométrage incluse par jour de location (0 = illimité). */
  mileageLimitPerDay: number;
  /** Frais facturés par kilomètre au-delà de la limite (DZD). */
  excessMileageFeePerKm: number;
  /** Frais forfaitaires par cran de carburant manquant (DZD). */
  fuelFeePerLevel: number;
  updatedAt?: string;
}

export interface Invoice {
  id: string;
  reservationId: string;
  clientId: string;
  clientName: string;
  carId: string;
  carInfo: string;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  tvaAmount: number;
  additionalFees: number;
  totalAmount: number;
  totalPaid: number;
  remainingAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
  type: 'invoice' | 'quote' | 'contract';
  payments: Payment[];
  createdAt: string;
}

export interface MaintenanceAlert {
  id: string;
  carId: string;
  carInfo: string;
  type: 'vidange' | 'assurance' | 'controle' | 'chaine';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  isExpired: boolean;
  daysUntilDue?: number;
  currentMileage?: number;
  nextServiceMileage?: number;
  createdAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalReservations: number;
  activeReservations: number;
  totalClients: number;
  totalCars: number;
  availableCars: number;
  maintenanceAlerts: number;
  overduePayments: number;
  recentReservations: ReservationDetails[];
  revenueByMonth: { month: string; revenue: number }[];
  carUtilization: { carId: string; carInfo: string; utilization: number }[];
}

export interface WebsiteOrder {
  id: string;
  carId: string;
  car: Car;
  step1: ReservationStep1;
  step2: ReservationStep2;
  step3: {
    additionalServices: AdditionalService[];
  };
  totalDays: number;
  totalPrice: number;
  servicesTotal: number;
  // Assurance de protection sélectionnée
  protectionAssurance?: ProtectionAssurance;
  protectionAssuranceName?: string;
  assuranceTotal?: number;
  // 'website_reservation' : nouvelle commande en attente d'acceptation par l'agence.
  status: 'website_reservation' | 'pending' | 'accepted' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
  source: 'website';

  // Devise choisie par le client sur le site (totalPrice reste en DZD)
  currency?: string;
  currencyRate?: number;
  totalPriceCurrency?: number;

  // Code promo utilisé (absent = aucun code, ne rien afficher)
  promoCode?: string;
  promoDiscountPercentage?: number;
  promoDiscountAmount?: number;

  // Informations de vol saisies par le client
  flightNumber?: string;
  flightDate?: string;
  flightTime?: string;
  flightTicketImage?: string;
}

// Document Template Types
export type DocumentType = 'contrat' | 'devis' | 'facture' | 'recu' | 'engagement';

export interface DocumentField {
  x: number;
  y: number;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  maxWidth?: number;
  customText?: string; // For custom text blocks
  width?: number; // For images like logo
  height?: number; // For images like logo
  text?: string; // For dynamic text content
}

export interface DocumentTemplate {
  [key: string]: DocumentField;
}

export interface DocumentTemplates {
  contrat?: DocumentTemplate;
  devis?: DocumentTemplate;
  facture?: DocumentTemplate;
  recu?: DocumentTemplate;
  engagement?: DocumentTemplate;
}

export interface AgencySettings {
  id: string;
  agencyName: string;
  slogan?: string;
  address?: string;
  phone?: string;
  logo?: string;
  documentTemplates?: DocumentTemplates;
  createdAt: string;
  updatedAt: string;
}