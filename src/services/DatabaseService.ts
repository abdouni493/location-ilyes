import { supabase } from '../supabase';
import { WorkerCommissionService } from './workerCommissionService';
import { Car, Client, Agency, Worker, WorkerAdvance, WorkerAbsence, WorkerPayment, WorkerRole, WorkerPermissions, Entreprise, RentalSettings, StoreExpense, VehicleExpense, MaintenanceAlert, WebsiteOrder, ReservationDetails, SpecialOffer, ContactInfo, WebsiteSettings, PromoCode, Company } from '../types';
import { parseCarCurrencies } from '../utils/currency';
import { companyContext, scopeQuery } from '../utils/companyContext';
import { sessionService } from '../utils/sessionService';

// Generic database service functions
export class DatabaseService {
  // Cars
  // ─── Helpers ─────────────────────────────────────────────────────────────
  /** Shared DB-row → Car mapper (ne fixe PAS le statut de disponibilité). */
  private static mapDbCar(dbCar: any): Car {
    return {
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
      // Conserve 'maintenance' si c'est ce que la DB contient ;
      // sinon on laisse 'disponible' comme valeur par défaut (sera recalculé par getCarsWithRealStatus).
      status: dbCar.status === 'maintenance' ? 'maintenance' : 'disponible',
      // === true : reste false tant que la migration n'a pas ajouté la colonne
      isHiddenFromSite: dbCar.is_hidden_from_site === true,
      // Propriété du véhicule (défaut : flotte de l'agence)
      ownerType: dbCar.owner_type === 'third_party' ? 'third_party' : 'personal',
      ownerName: dbCar.owner_name || undefined,
      ownerPhone: dbCar.owner_phone || undefined,
      agencySharePerDay: dbCar.agency_share_per_day != null ? Number(dbCar.agency_share_per_day) : 0,
      // Devises secondaires (JSONB) — absentes tant que la migration n'a pas tourné
      currencies: parseCarCurrencies(dbCar.currencies),
    };
  }

  /** Car (camelCase) → colonnes de la table `cars`. */
  private static carToDbPayload(car: Partial<Car>): Record<string, any> {
    const payload: Record<string, any> = {};
    if (car.brand !== undefined) payload.brand = car.brand;
    if (car.model !== undefined) payload.model = car.model;
    if (car.registration !== undefined) payload.plate_number = car.registration;
    if (car.year !== undefined) payload.year = car.year;
    if (car.color !== undefined) payload.color = car.color;
    if (car.vin !== undefined) payload.vin = car.vin;
    if (car.energy !== undefined) payload.energy = car.energy;
    if (car.transmission !== undefined) payload.transmission = car.transmission;
    if (car.seats !== undefined) payload.seats = car.seats;
    if (car.doors !== undefined) payload.doors = car.doors;
    if (car.priceDay !== undefined) payload.price_per_day = car.priceDay;
    if (car.priceWeek !== undefined) payload.price_week = car.priceWeek;
    if (car.priceMonth !== undefined) payload.price_month = car.priceMonth;
    if (car.deposit !== undefined) payload.deposit = car.deposit;
    if (car.mileage !== undefined) payload.mileage = car.mileage;
    if (car.images !== undefined) payload.image_url = car.images?.[0] || null;
    if (car.status !== undefined) payload.status = car.status;
    if (car.isHiddenFromSite !== undefined) payload.is_hidden_from_site = car.isHiddenFromSite;
    if (car.ownerType !== undefined) payload.owner_type = car.ownerType;
    if (car.ownerName !== undefined) payload.owner_name = car.ownerName || null;
    if (car.ownerPhone !== undefined) payload.owner_phone = car.ownerPhone || null;
    if (car.agencySharePerDay !== undefined) payload.agency_share_per_day = car.agencySharePerDay || 0;
    if (car.currencies !== undefined) payload.currencies = car.currencies || {};
    return payload;
  }

  /** Shared DB-row → SpecialOffer mapper (la ligne doit inclure le join car:cars(*)). */
  private static mapDbSpecialOffer(row: any): SpecialOffer {
    return {
      id: row.id,
      carId: row.car_id,
      car: this.mapDbCar(row.car || {}),
      oldPrice: Math.round(Number(row.old_price)),
      newPrice: Math.round(Number(row.new_price)),
      note: row.note,
      isActive: row.is_active,
      createdAt: row.created_at,
      label: row.label || undefined,
      discountType: row.discount_type || undefined,
      discountValue: row.discount_value != null ? Number(row.discount_value) : undefined,
      startDate: row.start_date || undefined,
      endDate: row.end_date || undefined,
    };
  }

  // ==========================================================================
  // MULTI-AGENCES (companies) — agences « métier » indépendantes
  // ==========================================================================

  private static mapCompanyRow(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      logo: row.logo || undefined,
      isPrimary: row.is_primary === true,
      createdAt: row.created_at,
    };
  }

  /**
   * Fragment `{ company_id }` à fusionner dans un payload d'insertion pour
   * estampiller la ligne sur l'agence active. Renvoie `{}` si aucune agence
   * n'est connue (le trigger DB remplira alors la valeur automatiquement).
   */
  private static companyStamp(): { company_id?: string } {
    const id = companyContext.getWriteCompanyId();
    return id ? { company_id: id } : {};
  }

  /** Liste des agences métier (la principale d'abord, puis par ancienneté). */
  static async getCompanies(): Promise<Company[]> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => this.mapCompanyRow(r));
  }

  /** Crée une nouvelle agence métier (super-admin uniquement). */
  static async createCompany(company: { name: string; logo?: string | null; isPrimary?: boolean }): Promise<Company> {
    const { data, error } = await supabase
      .from('companies')
      .insert([{
        name: company.name.trim(),
        logo: company.logo || null,
        // Une agence créée depuis l'app est une agence principale (business
        // indépendant avec sa propre comptabilité), sauf indication contraire.
        is_primary: company.isPrimary !== false,
      }])
      .select()
      .single();
    if (error) throw error;
    return this.mapCompanyRow(data);
  }

  static async updateCompany(id: string, updates: { name?: string; logo?: string | null; isPrimary?: boolean }): Promise<Company> {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.logo !== undefined) payload.logo = updates.logo || null;
    if (updates.isPrimary !== undefined) payload.is_primary = updates.isPrimary;

    const { data, error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.mapCompanyRow(data);
  }

  /**
   * Résout l'agence de l'utilisateur connecté + son statut super-admin, à
   * partir de `app_users` (par auth.uid()). Utilisé à la connexion.
   *
   * Robustesse : en cas d'échec de résolution, on renvoie `isSuperAdmin=true`
   * et `companyId=null` (aucun filtre) pour NE JAMAIS masquer les données de
   * l'agence existante. Les employés (session non-Supabase) sont résolus par
   * email sur la table `workers`.
   */
  static async getMyCompanyInfo(opts: { userId?: string | null; email?: string | null; role?: string | null }): Promise<{ companyId: string | null; isSuperAdmin: boolean; scopeKnown: boolean }> {
    // 1) Chemin Supabase Auth (admins / super-admins) : app_users par auth.uid()
    try {
      // Après la connexion, l'app purge la session SDK Supabase pour éviter
      // l'auto-refresh : on la restaure ici afin qu'auth.uid() (donc la RLS de
      // app_users) soit disponible avant la lecture.
      await sessionService.ensureSupabaseSession();
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || opts.userId || null;
      if (uid) {
        const { data, error } = await supabase
          .from('app_users')
          .select('company_id, is_super_admin')
          .eq('user_id', uid)
          .maybeSingle();
        if (!error && data) {
          return {
            companyId: data.company_id || null,
            isSuperAdmin: data.is_super_admin === true,
            // Périmètre lu dans la base : fiable (même si company_id est NULL,
            // c'est alors un compte racine assumé « toutes agences »).
            scopeKnown: true,
          };
        }
      }
    } catch (err) {
      console.warn('[DatabaseService] getMyCompanyInfo app_users lookup failed:', err);
    }

    // 2) Chemin employé (session worker_token, pas d'auth.uid) : workers.company_id
    if (opts.email) {
      try {
        const { data, error } = await supabase
          .from('workers')
          .select('company_id')
          .eq('email', opts.email)
          .maybeSingle();
        if (!error && data && data.company_id) {
          return { companyId: data.company_id, isSuperAdmin: false, scopeKnown: true };
        }
      } catch (err) {
        console.warn('[DatabaseService] getMyCompanyInfo workers lookup failed:', err);
      }
    }

    // 3) Repli sûr : aucun périmètre trouvé → l'utilisateur voit tout (zéro
    //    régression en LECTURE), mais on signale `scopeKnown: false` : à
    //    l'ÉCRITURE, l'application n'estampillera aucune agence et laissera le
    //    trigger DB (`auth_company_id()`) décider, plutôt que de rattacher la
    //    ligne à l'agence principale — ce qui la rendrait invisible pour son
    //    auteur dès que son périmètre redevient résoluble.
    console.warn('[DatabaseService] getMyCompanyInfo: agence introuvable pour cet utilisateur (app_users / workers) — périmètre non fiable.');
    return { companyId: null, isSuperAdmin: true, scopeKnown: false };
  }

  /**
   * Crée le compte de connexion (Supabase Auth) d'un admin d'agence puis son
   * rattachement `app_users` (is_super_admin = false). Réutilise la RPC
   * existante `upsert_worker_auth_user` (rôle « admin » ⇒ interface complète).
   */
  static async createAgencyAdmin(payload: { email: string; password: string; fullName: string; companyId: string }): Promise<void> {
    const userId = await this.upsertWorkerAuthUser(payload.email, payload.password, payload.fullName, 'admin');
    if (!userId) {
      throw new Error("Le compte d'authentification n'a pas pu être créé (aucun identifiant retourné).");
    }
    const { error } = await supabase
      .from('app_users')
      .upsert([{ user_id: userId, company_id: payload.companyId, is_super_admin: false }], { onConflict: 'user_id' });
    if (error) {
      throw new Error(
        "Compte créé, mais le rattachement à l'agence a échoué : " + (error.message || '') +
        " — vérifiez que la table app_users autorise le super-admin à écrire."
      );
    }
  }

  // ─── Liens voiture ↔ agence (table partagée `car_companies`) ──────────────

  /** Retourne, pour chaque voiture, la liste des ids d'agences liées. */
  static async getCarCompanyLinks(): Promise<Record<string, string[]>> {
    const { data, error } = await supabase
      .from('car_companies')
      .select('car_id, company_id');
    if (error) {
      console.warn('[DatabaseService] getCarCompanyLinks failed:', error.message);
      return {};
    }
    const map: Record<string, string[]> = {};
    for (const row of data || []) {
      if (!row.car_id || !row.company_id) continue;
      (map[row.car_id] ||= []).push(row.company_id);
    }
    return map;
  }

  /**
   * Remplace l'ensemble des liens agence d'une voiture (insertion/suppression).
   * `companyIds` vide = la voiture n'est explicitement liée à aucune agence
   * (elle est alors héritée par l'agence principale côté affichage admin).
   */
  static async setCarCompanies(carId: string, companyIds: string[]): Promise<void> {
    const wanted = Array.from(new Set(companyIds.filter(Boolean)));

    const { data: existing, error: readErr } = await supabase
      .from('car_companies')
      .select('company_id')
      .eq('car_id', carId);
    if (readErr) throw readErr;

    const current = new Set((existing || []).map((r: any) => r.company_id));
    const toAdd = wanted.filter(id => !current.has(id));
    const toRemove = Array.from(current).filter(id => !wanted.includes(id as string)) as string[];

    if (toAdd.length > 0) {
      const { error } = await supabase
        .from('car_companies')
        .insert(toAdd.map(company_id => ({ car_id: carId, company_id })));
      if (error) throw error;
    }
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('car_companies')
        .delete()
        .eq('car_id', carId)
        .in('company_id', toRemove);
      if (error) throw error;
    }
  }

  /**
   * Voitures pour l'interface ADMIN, filtrées selon l'agence active :
   *  - vue « toutes agences » (super-admin) : toutes les voitures ;
   *  - agence précise : uniquement celles liées à cette agence
   *    (une voiture SANS aucun lien est rattachée à l'agence principale).
   * Chaque voiture reçoit `companyIds` (pour les badges d'agence).
   * NB : la table `cars` reste PARTAGÉE — le site public n'utilise pas ceci.
   */
  static async getCarsForAdmin(): Promise<Car[]> {
    const [cars, links] = await Promise.all([this.getCars(), this.getCarCompanyLinks()]);
    const scopeId = companyContext.getScopeCompanyId();
    const primaryId = companyContext.getPrimaryCompanyId();

    const effectiveCompanies = (carId: string): string[] => {
      const ids = links[carId] || [];
      // Voiture historique jamais liée → rattachée à l'agence principale.
      if (ids.length === 0 && primaryId) return [primaryId];
      return ids;
    };

    const withCompanies = cars.map(car => ({ ...car, companyIds: effectiveCompanies(car.id) }));
    if (!scopeId) return withCompanies; // vue « toutes agences »
    return withCompanies.filter(car => (car.companyIds || []).includes(scopeId));
  }

  // ─── Cars ────────────────────────────────────────────────────────────────
  static async getCars(): Promise<Car[]> {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Le statut retourné ici est soit 'maintenance' (saisi manuellement en DB) soit
    // 'disponible' (placeholder). Utilise getCarsWithRealStatus() pour le statut calculé.
    return (data || []).map(dbCar => this.mapDbCar(dbCar));
  }

  /**
   * Retourne toutes les voitures avec leur statut RÉEL calculé à partir
   * des réservations actives.
   * - 'active'   couvre referenceDate → 'louer'
   * - 'confirmed' | 'pending' couvrent referenceDate → 'reserve'
   * - DB status === 'maintenance' → 'maintenance'
   * - sinon → 'disponible'
   *
   * @param referenceDate  Date de référence au format YYYY-MM-DD (défaut : aujourd'hui)
   */
  static async getCarsWithRealStatus(referenceDate?: string): Promise<Car[]> {
    const today = referenceDate || new Date().toISOString().substring(0, 10);

    // Récupère toutes les voitures et toutes les réservations en parallèle
    const [cars, reservationsResult] = await Promise.all([
      this.getCars(),
      supabase
        .from('reservations')
        .select('car_id, departure_date, return_date, status')
        .in('status', ['active', 'continued', 'confirmed', 'pending']),
    ]);

    const allReservations = reservationsResult.data || [];

    return cars.map(car => {
      // 'maintenance' est l'unique statut saisi manuellement — on ne le recalcule pas
      if (car.status === 'maintenance') return car;

      const carRes = allReservations.filter(r => r.car_id === car.id);

      const coversToday = (res: any) => {
        const dep = (res.departure_date || '').substring(0, 10);
        const ret = (res.return_date || '').substring(0, 10);
        return dep <= today && today <= ret;
      };

      const activeRes    = carRes.find(r => (r.status === 'active' || r.status === 'continued') && coversToday(r));
      const reservedRes  = carRes.find(r => (r.status === 'confirmed' || r.status === 'pending') && coversToday(r));

      let realStatus: Car['status'] = 'disponible';
      if (activeRes)   realStatus = 'louer';
      else if (reservedRes) realStatus = 'reserve';

      return { ...car, status: realStatus };
    });
  }

  /**
   * Retourne les voitures réellement disponibles pour une période donnée.
   * N'utilise PAS car.status pour filtrer — seul le chevauchement de réservations compte.
   * Les voitures en maintenance sont exclues.
   */
  static async getAvailableCars(departureDate?: string, returnDate?: string): Promise<Car[]> {
    const allCars = await this.getCars();

    // Exclure les voitures en maintenance (seul statut saisi manuellement)
    const nonMaintenance = allCars.filter(car => car.status !== 'maintenance');

    // Si aucune plage de dates, toutes les voitures non en maintenance sont disponibles
    if (!departureDate || !returnDate) {
      return nonMaintenance;
    }

    // Récupère les réservations qui bloquent la disponibilité
    const { data: allReservations, error } = await supabase
      .from('reservations')
      .select('car_id, departure_date, return_date')
      .in('status', ['pending', 'confirmed', 'active', 'continued']);

    if (error) {
      console.error('Error fetching reservations:', error);
      return nonMaintenance;
    }

    const departureTime = new Date(departureDate).getTime();
    const returnTime    = new Date(returnDate).getTime();

    // Exclut les voitures dont une réservation chevauche la période demandée
    return nonMaintenance.filter(car => {
      const carReservations = (allReservations || []).filter(r => r.car_id === car.id);
      return !carReservations.some(reservation => {
        const resStart = new Date(reservation.departure_date).getTime();
        const resEnd   = new Date(reservation.return_date).getTime();
        return departureTime < resEnd && returnTime > resStart;
      });
    });
  }

  static async getReservedCarsForPeriod(departureDate: string, returnDate: string): Promise<Array<{
    id: string;
    carId: string;
    brand: string;
    model: string;
    image: string;
    departureDate: string;
    returnDate: string;
    clientName: string;
  }>> {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        car_id,
        departure_date,
        return_date,
        client:clients(first_name, last_name),
        car:cars(brand, model, image_url)
      `)
      .in('status', ['pending', 'confirmed', 'active', 'continued']);

    if (error) {
      console.error('Error fetching reservations:', error);
      return [];
    }

    const departureTime = new Date(departureDate).getTime();
    const returnTime = new Date(returnDate).getTime();

    // Filter reservations that overlap with the provided date range
    const overlappingReservations = (reservations || []).filter(res => {
      const resStart = new Date(res.departure_date).getTime();
      const resEnd = new Date(res.return_date).getTime();
      return departureTime < resEnd && returnTime > resStart;
    });

    return overlappingReservations.map(res => ({
      id: res.id,
      carId: res.car_id,
      brand: res.car?.brand || '',
      model: res.car?.model || '',
      image: res.car?.image_url || 'https://picsum.photos/seed/car/400/300',
      departureDate: res.departure_date,
      returnDate: res.return_date,
      clientName: `${res.client?.first_name || ''} ${res.client?.last_name || ''}`,
    }));
  }

  static async createCar(car: Omit<Car, 'id' | 'created_at'>): Promise<Car> {
    // `car` peut arriver soit en camelCase (formulaire), soit déjà en
    // snake_case (anciens appels) : on ne mappe que les clés camelCase connues
    // et on laisse passer le reste tel quel.
    const mapped = this.carToDbPayload(car as Partial<Car>);
    const passthrough = Object.fromEntries(
      Object.entries(car as Record<string, any>).filter(([k]) => k.includes('_'))
    );
    const { data, error } = await supabase
      .from('cars')
      .insert([{ ...passthrough, ...mapped }])
      .select()
      .single();

    if (error) throw error;
    return this.mapDbCar(data);
  }

  static async updateCar(id: string, updates: Partial<Car>): Promise<Car> {
    const mapped = this.carToDbPayload(updates);
    const passthrough = Object.fromEntries(
      Object.entries(updates as Record<string, any>).filter(([k]) => k.includes('_'))
    );
    const { data, error } = await supabase
      .from('cars')
      .update({ ...passthrough, ...mapped })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapDbCar(data);
  }

  static async deleteCar(id: string): Promise<void> {
    const { error } = await supabase
      .from('cars')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Périodes déjà réservées (pending/confirmed/active) pour UNE voiture,
   * au format YYYY-MM-DD — utilisées pour bloquer les dates du calendrier public.
   * Essaie d'abord la RPC get_reserved_periods (SECURITY DEFINER, accessible aux
   * visiteurs anonymes malgré la RLS), puis retombe sur une lecture directe.
   */
  static async getReservedDateRangesForCar(carId: string): Promise<{ from: string; to: string }[]> {
    const mapRows = (rows: any[]) =>
      (rows || [])
        .filter(r => r.departure_date && r.return_date)
        .map(r => ({
          from: String(r.departure_date).substring(0, 10),
          to: String(r.return_date).substring(0, 10),
        }));

    try {
      const { data, error } = await supabase.rpc('get_reserved_periods', { p_car_id: carId });
      if (!error && Array.isArray(data)) return mapRows(data);
    } catch {
      // RPC absente (migration non appliquée) — on tente la lecture directe
    }

    const { data, error } = await supabase
      .from('reservations')
      .select('departure_date, return_date')
      .eq('car_id', carId)
      .in('status', ['pending', 'confirmed', 'active', 'continued']);

    if (error) {
      console.warn('getReservedDateRangesForCar failed:', error.message);
      return [];
    }
    return mapRows(data || []);
  }

  /** Masque / affiche une voiture sur le site public (colonne is_hidden_from_site). */
  static async setCarVisibility(id: string, isHidden: boolean): Promise<void> {
    const { error } = await supabase
      .from('cars')
      .update({ is_hidden_from_site: isHidden })
      .eq('id', id);

    if (error) {
      if ((error.message || '').includes('is_hidden_from_site')) {
        throw new Error(
          "La colonne is_hidden_from_site n'existe pas encore. Exécutez la migration supabase/migrations/20260702_offers_visibility.sql dans le SQL Editor de Supabase."
        );
      }
      throw error;
    }
  }

  // Clients
  static async getClients(): Promise<Client[]> {
    // Add retry logic for rate limiting
    const maxRetries = 2;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await scopeQuery(supabase
          .from('clients')
          .select('*'))
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Map snake_case to camelCase
        return (data || []).map(client => ({
          id: client.id,
          firstName: client.first_name,
          lastName: client.last_name,
          phone: client.phone,
          email: client.email,
          dateOfBirth: client.date_of_birth,
          placeOfBirth: client.place_of_birth,
          idCardNumber: client.id_card_number,
          licenseNumber: client.license_number,
          licenseExpirationDate: client.license_expiration_date,
          licenseDeliveryDate: client.license_delivery_date,
          licenseDeliveryPlace: client.license_delivery_place,
          documentType: client.document_type,
          documentNumber: client.document_number,
          documentDeliveryDate: client.document_delivery_date,
          documentExpirationDate: client.document_expiration_date,
          documentDeliveryAddress: client.document_delivery_address,
          wilaya: client.wilaya,
          completeAddress: client.complete_address,
          profilePhoto: client.profile_photo,
          scannedDocuments: client.scanned_documents,
          createdAt: client.created_at,
          agencyId: client.agency_id,
        }));
      } catch (error: any) {
        lastError = error;
        const message = error.message || '';
        
        // Check if it's a rate limit error
        if (message.includes('429') || message.includes('Too Many Requests')) {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`[DatabaseService] Rate limited on getClients, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }


  /** Mappe une ligne clients (snake_case) vers le modèle Client (camelCase). */
  private static mapClientRow(client: any): Client {
    return {
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
      phone: client.phone,
      email: client.email,
      dateOfBirth: client.date_of_birth,
      placeOfBirth: client.place_of_birth,
      idCardNumber: client.id_card_number,
      licenseNumber: client.license_number,
      licenseExpirationDate: client.license_expiration_date,
      licenseDeliveryDate: client.license_delivery_date,
      licenseDeliveryPlace: client.license_delivery_place,
      documentType: client.document_type,
      documentNumber: client.document_number,
      documentDeliveryDate: client.document_delivery_date,
      documentExpirationDate: client.document_expiration_date,
      documentDeliveryAddress: client.document_delivery_address,
      wilaya: client.wilaya,
      completeAddress: client.complete_address,
      profilePhoto: client.profile_photo,
      scannedDocuments: client.scanned_documents,
      createdAt: client.created_at,
      agencyId: client.agency_id,
    } as Client;
  }

  /** Les N derniers clients créés (affichage initial de la sélection client). */
  static async getRecentClients(limit: number = 6): Promise<Client[]> {
    const { data, error } = await scopeQuery(supabase
      .from('clients')
      .select('*'))
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(c => this.mapClientRow(c));
  }

  /** Recherche serveur (nom, prénom ou téléphone) sur TOUTE la base clients. */
  static async searchClients(query: string, limit: number = 30): Promise<Client[]> {
    const q = query.trim();
    if (!q) return [];
    // Échappe les caractères spéciaux du pattern PostgREST
    const safe = q.replace(/[%_,()]/g, ' ').trim();
    if (!safe) return [];

    const { data, error } = await scopeQuery(supabase
      .from('clients')
      .select('*'))
      .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(c => this.mapClientRow(c));
  }

  static async createClient(client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
    // Map camelCase to snake_case for database
    const dbClient = {
      first_name: client.firstName,
      last_name: client.lastName,
      phone: client.phone,
      email: client.email,
      date_of_birth: client.dateOfBirth || null,
      place_of_birth: client.placeOfBirth,
      id_card_number: client.idCardNumber || null,
      license_number: client.licenseNumber,
      license_expiration_date: client.licenseExpirationDate || null,
      license_delivery_date: client.licenseDeliveryDate || null,
      license_delivery_place: client.licenseDeliveryPlace,
      document_type: client.documentType,
      document_number: client.documentNumber,
      document_delivery_date: client.documentDeliveryDate || null,
      document_expiration_date: client.documentExpirationDate || null,
      document_delivery_address: client.documentDeliveryAddress,
      wilaya: client.wilaya,
      complete_address: client.completeAddress,
      profile_photo: client.profilePhoto,
      scanned_documents: client.scannedDocuments,
      agency_id: client.agencyId,
      // Rattachement multi-agences : estampillé sur l'agence active (le trigger
      // DB reste un filet de sécurité si la valeur est nulle).
      ...DatabaseService.companyStamp(),
    };

    const { data, error } = await supabase
      .from('clients')
      .insert([dbClient])
      .select()
      .single();

    if (error) throw error;

    // Map back to camelCase for the return
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      email: data.email,
      dateOfBirth: data.date_of_birth,
      placeOfBirth: data.place_of_birth,
      idCardNumber: data.id_card_number,
      licenseNumber: data.license_number,
      licenseExpirationDate: data.license_expiration_date,
      licenseDeliveryDate: data.license_delivery_date,
      licenseDeliveryPlace: data.license_delivery_place,
      documentType: data.document_type,
      documentNumber: data.document_number,
      documentDeliveryDate: data.document_delivery_date,
      documentExpirationDate: data.document_expiration_date,
      documentDeliveryAddress: data.document_delivery_address,
      wilaya: data.wilaya,
      completeAddress: data.complete_address,
      profilePhoto: data.profile_photo,
      scannedDocuments: data.scanned_documents,
      createdAt: data.created_at,
      agencyId: data.agency_id,
    };
  }

  static async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    // Map camelCase to snake_case for database
    const dbUpdates: any = {};
    if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
    if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.dateOfBirth !== undefined) dbUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.placeOfBirth !== undefined) dbUpdates.place_of_birth = updates.placeOfBirth;
    if (updates.idCardNumber !== undefined) dbUpdates.id_card_number = updates.idCardNumber;
    if (updates.licenseNumber !== undefined) dbUpdates.license_number = updates.licenseNumber;
    if (updates.licenseExpirationDate !== undefined) dbUpdates.license_expiration_date = updates.licenseExpirationDate;
    if (updates.licenseDeliveryDate !== undefined) dbUpdates.license_delivery_date = updates.licenseDeliveryDate;
    if (updates.licenseDeliveryPlace !== undefined) dbUpdates.license_delivery_place = updates.licenseDeliveryPlace;
    if (updates.documentType !== undefined) dbUpdates.document_type = updates.documentType;
    if (updates.documentNumber !== undefined) dbUpdates.document_number = updates.documentNumber;
    if (updates.documentDeliveryDate !== undefined) dbUpdates.document_delivery_date = updates.documentDeliveryDate;
    if (updates.documentExpirationDate !== undefined) dbUpdates.document_expiration_date = updates.documentExpirationDate;
    if (updates.documentDeliveryAddress !== undefined) dbUpdates.document_delivery_address = updates.documentDeliveryAddress;
    if (updates.wilaya !== undefined) dbUpdates.wilaya = updates.wilaya;
    if (updates.completeAddress !== undefined) dbUpdates.complete_address = updates.completeAddress;
    if (updates.profilePhoto !== undefined) dbUpdates.profile_photo = updates.profilePhoto;
    if (updates.scannedDocuments !== undefined) dbUpdates.scanned_documents = updates.scannedDocuments;
    if (updates.agencyId !== undefined) dbUpdates.agency_id = updates.agencyId;

    const { data, error } = await supabase
      .from('clients')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Map back to camelCase for the return
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      email: data.email,
      dateOfBirth: data.date_of_birth,
      placeOfBirth: data.place_of_birth,
      idCardNumber: data.id_card_number,
      licenseNumber: data.license_number,
      licenseExpirationDate: data.license_expiration_date,
      licenseDeliveryDate: data.license_delivery_date,
      licenseDeliveryPlace: data.license_delivery_place,
      documentType: data.document_type,
      documentNumber: data.document_number,
      documentDeliveryDate: data.document_delivery_date,
      documentExpirationDate: data.document_expiration_date,
      documentDeliveryAddress: data.document_delivery_address,
      wilaya: data.wilaya,
      completeAddress: data.complete_address,
      profilePhoto: data.profile_photo,
      scannedDocuments: data.scanned_documents,
      createdAt: data.created_at,
      agencyId: data.agency_id,
    };
  }

  static async deleteClient(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
  // Agencies
  static async getAgencies(): Promise<Agency[]> {
    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async createAgency(agency: Omit<Agency, 'id' | 'created_at'>): Promise<Agency> {
    // ensure an id exists (supabase table does not auto-generate)
    const withId = {
      ...agency,
      id: (agency as any).id || crypto.randomUUID(),
    };

    const { data, error } = await supabase
      .from('agencies')
      .insert([withId])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateAgency(id: string, updates: Partial<Agency>): Promise<Agency> {
    const { data, error } = await supabase
      .from('agencies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteAgency(id: string): Promise<void> {
    const { error } = await supabase
      .from('agencies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Workers
  static async getWorkers(): Promise<Worker[]> {
    const { data, error } = await scopeQuery(supabase
      .from('workers')
      .select(`
        *,
        advances:worker_advances(*),
        absences:worker_absences(*),
        payments:worker_payments(*)
      `))
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map snake_case to camelCase
    const workers = (data || []).map(worker => this.mapWorkerRow(worker));
    // Commissions sur réservations (table optionnelle : ignorée si absente)
    try {
      const byWorker = await WorkerCommissionService.getAllGroupedByWorker();
      workers.forEach(w => { w.commissions = byWorker[w.id] || []; });
    } catch (e) {
      console.warn('[getWorkers] commissions non chargées :', e);
    }
    return workers;
  }

  /** Ligne DB → Worker (camelCase), tolérant aux colonnes pas encore migrées. */
  private static mapWorkerRow(worker: any): Worker {
    return {
      id: worker.id,
      fullName: worker.full_name,
      dateOfBirth: worker.date_of_birth,
      phone: worker.phone,
      email: worker.email,
      address: worker.address,
      profilePhoto: worker.profile_photo,
      idCardNumber: worker.id_card_number || undefined,
      type: worker.type,
      roleId: worker.role_id || undefined,
      roleName: worker.role?.name || worker.role_name || undefined,
      startDate: worker.start_date || undefined,
      paymentEnabled: worker.payment_enabled !== false,
      paymentType: worker.payment_type,
      baseSalary: Number(worker.base_salary) || 0,
      username: worker.username,
      password: worker.password,
      accountEnabled: worker.account_enabled === true,
      authUserId: worker.auth_user_id || undefined,
      companyId: worker.company_id || undefined,
      permissions: this.parsePermissions(worker.permissions),
      advances: (worker.advances || []).map((a: any) => ({
        id: a.id,
        amount: Number(a.amount) || 0,
        date: a.date,
        note: a.note || undefined,
        settled: a.settled === true,
      })),
      absences: (worker.absences || []).map((a: any) => ({
        id: a.id,
        cost: Number(a.cost) || 0,
        date: a.date,
        note: a.note || undefined,
        settled: a.settled === true,
      })),
      payments: (worker.payments || []).map((p: any) => ({
        id: p.id,
        amount: Number(p.amount) || 0,
        date: p.date,
        baseSalary: Number(p.base_salary) || 0,
        advances: Number(p.advances) || 0,
        absences: Number(p.absences) || 0,
        netSalary: Number(p.net_salary) || 0,
        note: p.note || undefined,
        periodKey: p.period_key || undefined,
      })),
      createdAt: worker.created_at,
    };
  }

  /** JSONB `permissions` → WorkerPermissions normalisé. */
  private static parsePermissions(raw: any): WorkerPermissions {
    if (!raw || typeof raw !== 'object') return { interfaces: [], actions: {} };
    return {
      interfaces: Array.isArray(raw.interfaces) ? raw.interfaces.filter((x: any) => typeof x === 'string') : [],
      actions: raw.actions && typeof raw.actions === 'object'
        ? Object.fromEntries(
            Object.entries(raw.actions).map(([k, v]) => [k, Array.isArray(v) ? (v as any[]).filter(x => typeof x === 'string') : []])
          )
        : {},
    };
  }

  /** Permissions d'un employé identifié par son email (utilisé après connexion). */
  static async getWorkerPermissionsByEmail(email: string): Promise<{ permissions: WorkerPermissions; type: string; fullName: string } | null> {
    if (!email) return null;
    const { data, error } = await supabase
      .from('workers')
      .select('full_name, type, permissions')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) return null;
    return {
      permissions: this.parsePermissions(data.permissions),
      type: data.type || 'worker',
      fullName: data.full_name || '',
    };
  }

  /** Enregistre les permissions d'un employé. */
  static async updateWorkerPermissions(workerId: string, permissions: WorkerPermissions): Promise<void> {
    const { error } = await supabase
      .from('workers')
      .update({ permissions })
      .eq('id', workerId);
    if (error) throw error;
  }

  static async createWorker(worker: Omit<Worker, 'id' | 'createdAt' | 'advances' | 'absences' | 'payments'>): Promise<Worker> {
    // Create worker record in database with email and password
    console.log('[DatabaseService] Creating worker:', worker.email);
    
    const dbWorker: Record<string, any> = {
      full_name: worker.fullName,
      date_of_birth: worker.dateOfBirth || null,
      phone: worker.phone,
      email: worker.email,
      address: worker.address || null,
      profile_photo: worker.profilePhoto || null,
      id_card_number: worker.idCardNumber || null,
      type: worker.type,
      role_id: worker.roleId || null,
      start_date: worker.startDate || null,
      payment_enabled: worker.paymentEnabled !== false,
      payment_type: worker.paymentType || null,
      base_salary: worker.baseSalary || 0,
      username: worker.username,
      password: worker.password,
      account_enabled: worker.accountEnabled === true,
      auth_user_id: worker.authUserId || null,
      // Un nouvel employé démarre SANS permission : l'admin les attribue ensuite.
      permissions: worker.permissions || { interfaces: [], actions: {} },
    };

    // Agence de rattachement : valeur choisie dans le formulaire, sinon agence
    // active (le trigger DB reste un filet de sécurité).
    const workerCompanyId = (worker as any).companyId || companyContext.getWriteCompanyId();
    if (workerCompanyId) dbWorker.company_id = workerCompanyId;

    const { data, error } = await supabase
      .from('workers')
      .insert([dbWorker])
      .select()
      .single();

    if (error) {
      console.error('[DatabaseService] Worker creation failed:', error);
      throw error;
    }

    console.log('[DatabaseService] Worker created successfully:', data.id);

    return this.mapWorkerRow(data);
  }

  static async updateWorker(id: string, updates: Partial<Omit<Worker, 'advances' | 'absences' | 'payments'>>): Promise<Worker> {
    // Map camelCase to snake_case for database
    const dbUpdates: any = {};
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.dateOfBirth !== undefined) dbUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.profilePhoto !== undefined) dbUpdates.profile_photo = updates.profilePhoto;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.paymentType !== undefined) dbUpdates.payment_type = updates.paymentType;
    if (updates.baseSalary !== undefined) dbUpdates.base_salary = updates.baseSalary;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.password !== undefined) dbUpdates.password = updates.password;
    if (updates.idCardNumber !== undefined) dbUpdates.id_card_number = updates.idCardNumber || null;
    if (updates.roleId !== undefined) dbUpdates.role_id = updates.roleId || null;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null;
    if (updates.paymentEnabled !== undefined) dbUpdates.payment_enabled = updates.paymentEnabled;
    if (updates.accountEnabled !== undefined) dbUpdates.account_enabled = updates.accountEnabled;
    if (updates.authUserId !== undefined) dbUpdates.auth_user_id = updates.authUserId || null;
    if (updates.permissions !== undefined) dbUpdates.permissions = updates.permissions;
    if ((updates as any).companyId !== undefined) dbUpdates.company_id = (updates as any).companyId || null;

    const { data, error } = await supabase
      .from('workers')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapWorkerRow(data);
  }

  /**
   * Crée (ou met à jour) le compte de connexion Supabase Auth d'un employé.
   *
   * Passe par la RPC SECURITY DEFINER `upsert_worker_auth_user`, qui écrit
   * directement dans `auth.users` avec un mot de passe chiffré bcrypt. C'est
   * la seule façon de créer un compte depuis le navigateur sans la clé de
   * service ET sans déconnecter l'administrateur (contrairement à signUp).
   * L'employé peut ensuite se connecter normalement depuis la page de login.
   */
  static async upsertWorkerAuthUser(email: string, password: string, fullName: string, role: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('upsert_worker_auth_user', {
      p_email: email.trim().toLowerCase(),
      p_password: password,
      p_full_name: fullName,
      p_role: role,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('upsert_worker_auth_user')) {
        throw new Error(
          "La fonction upsert_worker_auth_user n'existe pas encore. Exécutez la migration supabase/migrations/20260725_mhd_auto_major_update.sql dans le SQL Editor de Supabase."
        );
      }
      throw error;
    }
    return (data as any)?.user_id || null;
  }

  /**
   * Met à jour SES PROPRES identifiants depuis Paramètres ▸ Profil & sécurité.
   *
   * Passe par la RPC `update_own_credentials`, qui vérifie le mot de passe
   * actuel puis applique le changement à la fois sur `auth.users` et sur la
   * fiche `workers`. On n'utilise pas `supabase.auth.updateUser()` : les
   * employés n'ont pas de session Auth (connexion via `login_worker`), et un
   * changement d'e-mail y resterait en attente de confirmation par lien.
   */
  static async updateOwnCredentials(payload: {
    currentEmail: string;
    currentPassword: string;
    newEmail?: string;
    newUsername?: string;
    newPassword?: string;
  }): Promise<{ email: string; emailChanged: boolean; passwordChanged: boolean }> {
    const { data, error } = await supabase.rpc('update_own_credentials', {
      p_current_email: payload.currentEmail.trim().toLowerCase(),
      p_current_password: payload.currentPassword,
      p_new_email: payload.newEmail?.trim().toLowerCase() || null,
      p_new_username: payload.newUsername?.trim() || null,
      p_new_password: payload.newPassword || null,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('INVALID_CURRENT_PASSWORD')) throw new Error('INVALID_CURRENT_PASSWORD');
      if (msg.includes('EMAIL_ALREADY_USED')) throw new Error('EMAIL_ALREADY_USED');
      if (msg.includes('USERNAME_ALREADY_USED')) throw new Error('USERNAME_ALREADY_USED');
      if (msg.includes('PASSWORD_TOO_SHORT')) throw new Error('PASSWORD_TOO_SHORT');
      if (msg.includes('update_own_credentials')) {
        throw new Error(
          "La fonction update_own_credentials n'existe pas encore. Exécutez la migration supabase/migrations/20260922_update_own_credentials.sql dans le SQL Editor de Supabase."
        );
      }
      throw error;
    }

    const res = (data as any) || {};
    return {
      email: res.email || payload.currentEmail,
      emailChanged: !!res.email_changed,
      passwordChanged: !!res.password_changed,
    };
  }

  /** Met à jour son propre nom complet (fiche employé + métadonnées Auth). */
  static async updateOwnProfileName(email: string, fullName: string): Promise<void> {
    const { error } = await supabase.rpc('update_own_profile', {
      p_email: email.trim().toLowerCase(),
      p_full_name: fullName,
    });
    if (error) {
      if ((error.message || '').includes('update_own_profile')) {
        throw new Error(
          "La fonction update_own_profile n'existe pas encore. Exécutez la migration supabase/migrations/20260922_update_own_credentials.sql dans le SQL Editor de Supabase."
        );
      }
      throw error;
    }
  }

  /** Supprime le compte de connexion d'un employé (le salarié reste en base). */
  static async deleteWorkerAuthUser(email: string): Promise<void> {
    const { error } = await supabase.rpc('delete_worker_auth_user', { p_email: email.trim().toLowerCase() });
    if (error && !(error.message || '').includes('delete_worker_auth_user')) throw error;
  }

  // ── Rôles d'employés (créés librement par l'admin) ───────────────────────
  static async getWorkerRoles(): Promise<WorkerRole[]> {
    const { data, error } = await supabase
      .from('worker_roles')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => ({ id: r.id, name: r.name, createdAt: r.created_at }));
  }

  static async createWorkerRole(name: string): Promise<WorkerRole> {
    const { data, error } = await supabase
      .from('worker_roles')
      .insert([{ name: name.trim() }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('Ce rôle existe déjà.');
      throw error;
    }
    return { id: data.id, name: data.name, createdAt: data.created_at };
  }

  static async deleteWorkerRole(id: string): Promise<void> {
    const { error } = await supabase.from('worker_roles').delete().eq('id', id);
    if (error) throw error;
  }

  static async deleteWorker(id: string): Promise<void> {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Worker Advances
  static async createWorkerAdvance(workerId: string, advance: Omit<WorkerAdvance, 'id' | 'createdAt'>): Promise<WorkerAdvance> {
    const dbAdvance = {
      worker_id: workerId,
      amount: advance.amount,
      date: advance.date,
      note: advance.note,
    };

    const { data, error } = await supabase
      .from('worker_advances')
      .insert([dbAdvance])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      amount: Number(data.amount) || 0,
      date: data.date,
      note: data.note,
      settled: data.settled === true,
    };
  }

  /** Marque des acomptes / absences comme déduits d'un paiement. */
  static async settleWorkerItems(advanceIds: string[], absenceIds: string[]): Promise<void> {
    if (advanceIds.length > 0) {
      const { error } = await supabase
        .from('worker_advances')
        .update({ settled: true })
        .in('id', advanceIds);
      if (error) throw error;
    }
    if (absenceIds.length > 0) {
      const { error } = await supabase
        .from('worker_absences')
        .update({ settled: true })
        .in('id', absenceIds);
      if (error) throw error;
    }
  }

  static async deleteWorkerAdvance(id: string): Promise<void> {
    const { error } = await supabase
      .from('worker_advances')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Worker Absences
  static async createWorkerAbsence(workerId: string, absence: Omit<WorkerAbsence, 'id' | 'createdAt'>): Promise<WorkerAbsence> {
    const dbAbsence = {
      worker_id: workerId,
      cost: absence.cost,
      date: absence.date,
      note: absence.note,
    };

    const { data, error } = await supabase
      .from('worker_absences')
      .insert([dbAbsence])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      cost: Number(data.cost) || 0,
      date: data.date,
      note: data.note,
      settled: data.settled === true,
    };
  }

  static async deleteWorkerAbsence(id: string): Promise<void> {
    const { error } = await supabase
      .from('worker_absences')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Worker Payments
  static async createWorkerPayment(workerId: string, payment: Omit<WorkerPayment, 'id' | 'createdAt'>): Promise<WorkerPayment> {
    const dbPayment: Record<string, any> = {
      worker_id: workerId,
      amount: payment.amount,
      date: payment.date,
      base_salary: payment.baseSalary,
      advances: payment.advances,
      absences: payment.absences,
      net_salary: payment.netSalary,
      note: payment.note || null,
      period_key: payment.periodKey || null,
    };

    const { data, error } = await supabase
      .from('worker_payments')
      .insert([dbPayment])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      amount: Number(data.amount) || 0,
      date: data.date,
      baseSalary: Number(data.base_salary) || 0,
      advances: Number(data.advances) || 0,
      absences: Number(data.absences) || 0,
      netSalary: Number(data.net_salary) || 0,
      note: data.note || undefined,
      periodKey: data.period_key || undefined,
    };
  }

  static async deleteWorkerPayment(id: string): Promise<void> {
    const { error } = await supabase
      .from('worker_payments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Store Expenses
  static async getStoreExpenses(): Promise<StoreExpense[]> {
    const { data, error } = await scopeQuery(supabase
      .from('store_expenses')
      .select('*'))
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async createStoreExpense(expense: Omit<StoreExpense, 'id' | 'created_at'>): Promise<StoreExpense> {
    const { data, error } = await supabase
      .from('store_expenses')
      .insert([{ ...expense, ...this.companyStamp() }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Vehicle Expenses
  static async getVehicleExpenses(): Promise<VehicleExpense[]> {
    const { data, error } = await scopeQuery(supabase
      .from('vehicle_expenses')
      .select('*'))
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async createVehicleExpense(expense: Omit<VehicleExpense, 'id' | 'created_at'>): Promise<VehicleExpense> {
    const { data, error } = await supabase
      .from('vehicle_expenses')
      .insert([{ ...expense, ...this.companyStamp() }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Maintenance Alerts
  static async getMaintenanceAlerts(): Promise<MaintenanceAlert[]> {
    try {
      const { data, error } = await scopeQuery(supabase
        .from('maintenance_alerts')
        .select('*'));

      if (error) throw error;
      return (data || []).map(alert => ({
        id: alert.id || '',
        carId: alert.car_id || '',
        carInfo: alert.car_info || '',
        type: alert.type || 'other',
        title: alert.title || 'Alert',
        message: alert.message || '',
        severity: alert.severity || 'medium',
        dueDate: alert.due_date,
        isExpired: alert.is_expired || false,
        daysUntilDue: alert.days_until_due,
        currentMileage: alert.current_mileage,
        nextServiceMileage: alert.next_service_mileage,
        createdAt: alert.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.warn('getMaintenanceAlerts failed, table may not exist or missing columns:', e);
      return [];
    }
  }

  static async createMaintenanceAlert(alert: Omit<MaintenanceAlert, 'id' | 'created_at'>): Promise<MaintenanceAlert> {
    const dbPayload = {
      car_id: alert.carId,
      car_info: alert.carInfo,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      due_date: alert.dueDate ?? null,
      is_expired: alert.isExpired,
      days_until_due: alert.daysUntilDue ?? null,
      current_mileage: alert.currentMileage ?? null,
      next_service_mileage: alert.nextServiceMileage ?? null,
      ...this.companyStamp(),
    };

    const { data, error } = await supabase
      .from('maintenance_alerts')
      .insert([dbPayload])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteMaintenanceAlert(carId: string, type: string): Promise<void> {
    const { error } = await scopeQuery(supabase
      .from('maintenance_alerts')
      .delete()
      .eq('car_id', carId)
      .eq('type', type));

    if (error) throw error;
  }

  // Website Orders
  static async getWebsiteOrders(): Promise<WebsiteOrder[]> {
    try {
      // Query pending reservations from reservations table (website orders)
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          client_id,
          car_id,
          departure_date,
          departure_time,
          departure_agency_id,
          return_date,
          return_time,
          return_agency_id,
          total_days,
          total_price,
          additional_fees,
          status,
          created_at,
          protection_assurance_id,
          protection_assurance_name,
          protection_assurance_price,
          currency,
          currency_rate,
          total_price_currency,
          promo_code,
          promo_discount_percentage,
          promo_discount_amount,
          flight_number,
          flight_date,
          flight_time,
          flight_ticket_image,
          client:clients(*),
          car:cars(*),
          reservation_services(*),
          protection_assurance:protection_assurances!reservations_protection_assurance_fkey(
            id, name, price_per_day, is_active, created_at,
            protection_assurance_item_links(
              id, status, item:protection_assurance_items(id, item_name, display_order)
            )
          )
        `)
        // Commandes du site EN ATTENTE d'acceptation ('website_reservation') +
        // celles refusées ('cancelled') que l'on garde visibles ici. Une fois
        // ACCEPTÉE, la commande passe 'pending' et migre vers le planificateur
        // (elle disparaît donc de cette liste).
        .in('status', ['website_reservation', 'cancelled'])
        // seules les commandes provenant du site public (source='website') —
        // pas les réservations créées par l'agence.
        // Colonne ajoutée par 20260708_reservation_source.sql.
        .eq('source', 'website')
        // Masque les commandes mises à la corbeille (suppression réversible).
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching website orders:', error);
        // Repli si une colonne (source / deleted_at) n'existe pas encore
        // (migration non appliquée) : on retente sans ces filtres pour ne pas
        // casser l'affichage des commandes.
        if (error.code === '42703' || /column .*(source|deleted_at).* does not exist/i.test(error.message || '') || /deleted_at/i.test(error.message || '')) {
          const retry = await supabase
            .from('reservations')
            .select(`
              id, client_id, car_id,
              departure_date, departure_time, departure_agency_id,
              return_date, return_time, return_agency_id,
              total_days, total_price, additional_fees, status, created_at,
              protection_assurance_id, protection_assurance_name, protection_assurance_price,
              client:clients(*), car:cars(*), reservation_services(*),
              protection_assurance:protection_assurances!reservations_protection_assurance_fkey(
                id, name, price_per_day, is_active, created_at,
                protection_assurance_item_links(
                  id, status, item:protection_assurance_items(id, item_name, display_order)
                )
              )
            `)
            // Sans colonne source, seul 'website_reservation' identifie de façon
            // fiable une commande du site (statut jamais utilisé par l'agence).
            .eq('status', 'website_reservation')
            .order('created_at', { ascending: false });
          if (retry.error) { console.warn('Website orders retry failed:', retry.error); return []; }
          return this.mapWebsiteOrders(retry.data || []);
        }
        return [];
      }

      // Transform reservations to WebsiteOrder format
      return DatabaseService.mapWebsiteOrders(data || []);
    } catch (err) {
      console.warn('Exception fetching website orders:', err);
      return [];
    }
  }

  /** Transforme des lignes `reservations` en objets WebsiteOrder pour l'UI. */
  private static mapWebsiteOrders(rows: any[]): WebsiteOrder[] {
    return (rows || []).map((reservation: any) => {
      const totalPrice = parseInt(reservation.total_price) || 0;
      const totalDays = reservation.total_days || 0;

      // Services supplémentaires attachés à la réservation
      const additionalServices = (reservation.reservation_services || []).map((s: any) => ({
        id: s.id,
        category: s.category,
        name: s.service_name,
        description: s.description,
        price: Math.round(Number(s.price) || 0),
        selected: true,
      }));
      const servicesTotal = additionalServices.reduce((sum: number, s: any) => sum + s.price, 0);

      // Assurance de protection sélectionnée
      const pa = reservation.protection_assurance;
      const protectionAssurance = pa ? {
        id: pa.id,
        name: pa.name,
        pricePerDay: Math.round(Number(pa.price_per_day) || 0),
        isActive: pa.is_active,
        createdAt: pa.created_at,
        items: (pa.protection_assurance_item_links || [])
          .map((link: any) => ({
            linkId: link.id,
            itemId: link.item?.id || null,
            name: link.item?.item_name || '',
            status: !!link.status,
            displayOrder: link.item?.display_order ?? 0,
          }))
          .sort((x: any, y: any) => (x.displayOrder ?? 0) - (y.displayOrder ?? 0)),
      } : undefined;
      const assuranceTotal = reservation.protection_assurance_price != null
        ? Math.round(Number(reservation.protection_assurance_price) * totalDays)
        : 0;

      return {
        id: reservation.id,
        carId: reservation.car_id,
        car: reservation.car || {},
        step1: {
          carId: reservation.car_id,
          departureDate: reservation.departure_date,
          departureTime: reservation.departure_time,
          departureAgency: reservation.departure_agency_id,
          returnDate: reservation.return_date,
          returnTime: reservation.return_time,
          returnAgency: reservation.return_agency_id,
          differentReturnAgency: reservation.departure_agency_id !== reservation.return_agency_id,
        },
        step2: {
          firstName: reservation.client?.first_name || '',
          lastName: reservation.client?.last_name || '',
          phone: reservation.client?.phone || '',
          email: reservation.client?.email || '',
          licenseNumber: reservation.client?.license_number || '',
          wilaya: reservation.client?.wilaya || '',
          completeAddress: reservation.client?.complete_address || '',
          // include profile photo like planner reservations do
          photo: reservation.client?.profile_photo || '',
          scannedDocuments: reservation.client?.documents_urls || [],
        },
        step3: {
          additionalServices,
        },
        totalDays,
        totalPrice: totalPrice,
        servicesTotal,
        protectionAssurance,
        protectionAssuranceName: reservation.protection_assurance_name || undefined,
        assuranceTotal,
        status: reservation.status || 'website_reservation',
        createdAt: reservation.created_at,
        source: 'website',
        // Devise choisie par le client (total_price reste en DZD)
        currency: reservation.currency || 'DZD',
        currencyRate: reservation.currency_rate != null ? Number(reservation.currency_rate) : 1,
        totalPriceCurrency: reservation.total_price_currency != null ? Number(reservation.total_price_currency) : undefined,
        // Code promo : absent = ne rien afficher
        promoCode: reservation.promo_code || undefined,
        promoDiscountPercentage: reservation.promo_discount_percentage != null ? Number(reservation.promo_discount_percentage) : undefined,
        promoDiscountAmount: reservation.promo_discount_amount != null ? Number(reservation.promo_discount_amount) : undefined,
        // Informations de vol
        flightNumber: reservation.flight_number || undefined,
        flightDate: reservation.flight_date || undefined,
        flightTime: reservation.flight_time || undefined,
        flightTicketImage: reservation.flight_ticket_image || undefined,
      } as WebsiteOrder;
    });
  }

  static async createWebsiteOrder(order: Omit<WebsiteOrder, 'id' | 'created_at'>): Promise<WebsiteOrder> {
    // Website orders are actually reservations with pending status
    const reservationData = {
      client_id: (order as any).clientId,
      car_id: order.carId,
      departure_date: order.step1.departureDate,
      departure_time: order.step1.departureTime,
      departure_agency_id: order.step1.departureAgency,
      return_date: order.step1.returnDate,
      return_time: order.step1.returnTime,
      return_agency_id: order.step1.returnAgency,
      total_days: order.totalDays,
      total_price: order.totalPrice,
      additional_fees: order.servicesTotal,
      // Nouvelle commande site = statut 'website_reservation' (en attente d'accept.)
      status: 'website_reservation',
      source: 'website',
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select()
      .single();

    if (error) throw error;
    return order;
  }

  static async updateWebsiteOrderStatus(orderId: string, status: 'website_reservation' | 'pending' | 'accepted' | 'confirmed' | 'processing' | 'completed' | 'cancelled'): Promise<void> {
    // Update reservation status (website orders are reservations)
    const { error } = await supabase
      .from('reservations')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;
  }

  /**
   * Accepte une commande du site en la ROUTANT vers une agence : en une seule
   * mise à jour, la réservation passe `status = 'pending'` ET reçoit son
   * `company_id`. Le client créé par la commande est estampillé sur la même
   * agence. Après quoi la réservation n'apparaît QUE dans le planificateur et
   * la comptabilité de l'agence choisie.
   */
  static async acceptWebsiteOrder(orderId: string, companyId: string): Promise<void> {
    // 1) Récupère le client rattaché AVANT de le réassigner à l'agence.
    const { data: resRow } = await supabase
      .from('reservations')
      .select('client_id')
      .eq('id', orderId)
      .maybeSingle();

    // 2) Une seule mise à jour : statut + agence.
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'pending', company_id: companyId })
      .eq('id', orderId);
    if (error) throw error;

    // 3) Estampille le client de la commande sur la même agence (non bloquant).
    if (resRow?.client_id) {
      const { error: clientErr } = await supabase
        .from('clients')
        .update({ company_id: companyId })
        .eq('id', resRow.client_id);
      if (clientErr) console.warn('[DatabaseService] acceptWebsiteOrder: client stamp failed:', clientErr.message);
    }
  }

  static async deleteWebsiteOrder(orderId: string): Promise<void> {
    // Suppression RÉVERSIBLE : la commande (= réservation) est placée dans la
    // corbeille au lieu d'être effacée. Restaurable depuis Paramètres.
    const { error } = await supabase
      .from('reservations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      // Repli si la migration n'est pas encore appliquée : suppression réelle.
      if (/deleted_at/i.test(error.message || '')) {
        const { error: hardErr } = await supabase
          .from('reservations')
          .delete()
          .eq('id', orderId);
        if (hardErr) throw hardErr;
        return;
      }
      throw error;
    }
  }

  // Reservations
  static async getReservations(): Promise<ReservationDetails[]> {
    const select = `
        *,
        client:clients(*),
        car:cars(*),
        payments:payments(*)
      `;
    let { data, error } = await scopeQuery(supabase
      .from('reservations')
      .select(select)
      // Masque les réservations mises à la corbeille (suppression réversible).
      .is('deleted_at', null))
      .order('created_at', { ascending: false });

    // Repli si la colonne deleted_at n'existe pas encore (migration non appliquée).
    if (error && /deleted_at/i.test(error.message || '')) {
      ({ data, error } = await scopeQuery(supabase
        .from('reservations')
        .select(select))
        .order('created_at', { ascending: false }));
    }

    if (error) throw error;
    return data || [];
  }

  static async createReservation(reservation: Omit<ReservationDetails, 'id' | 'created_at' | 'activatedAt' | 'completedAt'>): Promise<ReservationDetails> {
    const { data, error } = await supabase
      .from('reservations')
      .insert([{ ...reservation, ...this.companyStamp() }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Dashboard Statistics
  static async getDashboardStats() {
    // Add retry logic for rate limiting
    const maxRetries = 2;
    let lastError;
    // Les réservations en corbeille (deleted_at non nul) sont exclues des stats.
    // Si la colonne n'existe pas encore (migration non appliquée), on relance
    // sans ce filtre.
    let softDeleteSupported = true;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Applique le filtre « non supprimée » aux requêtes de réservations.
        const notTrashed = (q: any) => (softDeleteSupported ? q.is('deleted_at', null) : q);
        // Périmètre agence : chaque comptabilité est indépendante. La table
        // `cars` reste PARTAGÉE (non filtrée) — le nombre de voitures est global.
        // Run all queries in parallel for faster loading
        const [
          revenueResult,
          monthlyRevenueResult,
          storeExpensesResult,
          vehicleExpensesResult,
          clientsResult,
          carsResult,
          activeReservationsForCarsResult,
          totalReservationsResult,
          activeReservationsResult,
          overduePaymentsResult,
          recentReservationsResult,
          alertsResult
        ] = await Promise.all([
          scopeQuery(notTrashed(supabase.from('reservations').select('total_price').eq('status', 'completed'))),
          scopeQuery(notTrashed(supabase.from('reservations').select('total_price, completed_at').eq('status', 'completed').gte('completed_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()))),
          scopeQuery(supabase.from('store_expenses').select('cost')),
          scopeQuery(supabase.from('vehicle_expenses').select('cost')),
          scopeQuery(supabase.from('clients').select('id', { count: 'exact' })),
          supabase.from('cars').select('id', { count: 'exact' }),
          scopeQuery(notTrashed(supabase.from('reservations').select('car_id').in('status', ['pending', 'confirmed', 'active', 'continued']))),
          scopeQuery(notTrashed(supabase.from('reservations').select('id', { count: 'exact' }))),
          scopeQuery(notTrashed(supabase.from('reservations').select('id', { count: 'exact' }).in('status', ['confirmed', 'active', 'continued']))),
          scopeQuery(supabase.from('payments').select('id', { count: 'exact' }).eq('status', 'pending')),
          scopeQuery(notTrashed(supabase.from('reservations').select('*, client:clients(*), car:cars(*)').order('created_at', { ascending: false }).limit(5))),
          scopeQuery(supabase.from('maintenance_alerts').select('id', { count: 'exact' }))
        ]);

        // Extract data and errors
        const { data: revenueData, error: revenueError } = revenueResult;
        const { data: monthlyRevenueData, error: monthlyRevenueError } = monthlyRevenueResult;
        const { data: storeExpenses, error: storeError } = storeExpensesResult;
        const { data: vehicleExpenses, error: vehicleError } = vehicleExpensesResult;
        const { data: clients, error: clientsError } = clientsResult;
        const { data: cars, error: carsError } = carsResult;
        const { data: activeReservationsForCars, error: activeReservationsForCarsError } = activeReservationsForCarsResult;
        const { data: totalReservations, error: totalReservationsError } = totalReservationsResult;
        const { data: activeReservations, error: activeResError } = activeReservationsResult;
        const { data: overduePayments, error: overduePaymentsError } = overduePaymentsResult;
        const { data: recentReservations, error: recentReservationsError } = recentReservationsResult;
        const { data: alerts, error: alertsError } = alertsResult;

        // Throw on critical errors
        if (revenueError || storeError || vehicleError || clientsError || carsError || activeResError) {
          throw revenueError || storeError || vehicleError || clientsError || carsError || activeResError;
        }

        // Calculate available cars: total cars minus those with active/pending reservations
        const rentedCarIds = new Set(activeReservationsForCars?.map((r: any) => r.car_id) || []);
        const availableCarsCount = (cars?.length || 0) - rentedCarIds.size;

        // Calculate totals
        const totalRevenue = revenueData?.reduce((sum, r) => sum + r.total_price, 0) || 0;
        const monthlyRevenue = monthlyRevenueData?.reduce((sum, r) => sum + r.total_price, 0) || 0;
        const totalExpenses = (storeExpenses?.reduce((sum, e) => sum + e.cost, 0) || 0) +
                             (vehicleExpenses?.reduce((sum, e) => sum + e.cost, 0) || 0);
        const maintenanceAlertsCount = alertsError ? 0 : (alerts?.length || 0);

        // Calculate revenue by month (last 6 months)
        const revenueByMonth = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          const monthRevenue = revenueData?.filter(r => {
            const completedDate = new Date(r.completed_at || r.created_at);
            return completedDate >= month && completedDate < nextMonth;
          }).reduce((sum, r) => sum + r.total_price, 0) || 0;

          revenueByMonth.push({
            month: month.toLocaleDateString('fr-FR', { month: 'short' }),
            revenue: monthRevenue
          });
        }

    // Calculate car utilization (simplified - based on active reservations)
    const carUtilization = cars?.slice(0, 5).map(car => ({
      carId: car.id,
      carName: `${car.brand} ${car.model}`,
      utilization: Math.floor(Math.random() * 40) + 60 // Placeholder - would need actual calculation
    })) || [];

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalClients: clients?.length || 0,
      totalCars: cars?.length || 0,
      availableCars: availableCarsCount,
      totalReservations: totalReservations?.length || 0,
      activeReservations: activeReservations?.length || 0,
      overduePayments: overduePayments?.length || 0,
      maintenanceAlerts: maintenanceAlertsCount,
      monthlyRevenue,
      recentReservations: recentReservations || [],
      revenueByMonth,
      carUtilization
    };
      } catch (error: any) {
        lastError = error;
        const message = error.message || '';

        // Colonne deleted_at absente (migration 20260727 non appliquée) : on
        // relance les stats sans le filtre de corbeille.
        if (softDeleteSupported && /deleted_at/i.test(message)) {
          softDeleteSupported = false;
          continue;
        }

        // Check if it's a rate limit error
        if (message.includes('429') || message.includes('Too Many Requests')) {
          if (attempt < maxRetries) {
            // Exponential backoff: 1s, 2s, etc.
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`[DatabaseService] Rate limited on dashboard stats, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Retry
          }
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    // After all retries exhausted
    throw lastError;
  }

  // Website Management - Offres spéciales (promotions)
  // NOTE : les "offres ordinaires" (table offers) sont dépréciées — les voitures
  // existantes s'affichent désormais automatiquement sur le site (sauf masquées).
  // La table offers est conservée (0 ligne constatée) mais n'est plus lue ni écrite.

  /**
   * Construit le payload DB d'une offre spéciale. Les nouveaux champs (label,
   * remise, dates) ne sont inclus que s'ils sont renseignés, pour rester
   * compatible tant que la migration 20260702_offers_visibility.sql n'est pas appliquée.
   */
  private static buildSpecialOfferPayload(offer: Partial<Omit<SpecialOffer, 'id' | 'createdAt' | 'car'>>): any {
    const payload: any = {
      car_id: offer.carId,
      old_price: offer.oldPrice,
      new_price: offer.newPrice,
      note: offer.note,
      is_active: offer.isActive,
    };
    if (offer.label !== undefined) payload.label = offer.label || null;
    if (offer.discountType !== undefined) payload.discount_type = offer.discountType || null;
    if (offer.discountValue !== undefined) payload.discount_value = offer.discountValue ?? null;
    if (offer.startDate !== undefined) payload.start_date = offer.startDate || null;
    if (offer.endDate !== undefined) payload.end_date = offer.endDate || null;
    return payload;
  }

  private static specialOfferMigrationError(error: any): Error {
    const msg = error?.message || '';
    if (msg.includes('column') && /label|discount_type|discount_value|start_date|end_date/.test(msg)) {
      return new Error(
        "Colonnes d'offre spéciale manquantes. Exécutez la migration supabase/migrations/20260702_offers_visibility.sql dans le SQL Editor de Supabase."
      );
    }
    return error;
  }

  static async getSpecialOffers(): Promise<SpecialOffer[]> {
    try {
      const { data, error } = await supabase
        .from('special_offers')
        .select(`
          *,
          car:cars(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => this.mapDbSpecialOffer(row));
    } catch (e: any) {
      console.warn('getSpecialOffers failed, returning empty array', e.message || e);
      return [];
    }
  }

  static async createSpecialOffer(offer: Omit<SpecialOffer, 'id' | 'createdAt' | 'car'>): Promise<SpecialOffer> {
    const { data, error } = await supabase
      .from('special_offers')
      .insert([this.buildSpecialOfferPayload(offer)])
      .select(`
        *,
        car:cars(*)
      `)
      .single();

    if (error) throw this.specialOfferMigrationError(error);
    return this.mapDbSpecialOffer(data);
  }

  static async updateSpecialOffer(id: string, updates: Partial<Omit<SpecialOffer, 'id' | 'createdAt' | 'car'>>): Promise<SpecialOffer> {
    const { data, error } = await supabase
      .from('special_offers')
      .update(this.buildSpecialOfferPayload(updates))
      .eq('id', id)
      .select(`
        *,
        car:cars(*)
      `)
      .single();

    if (error) throw this.specialOfferMigrationError(error);
    return this.mapDbSpecialOffer(data);
  }

  /** Toggle affiché / masqué du site (colonne is_active). */
  static async toggleSpecialOfferStatus(id: string): Promise<SpecialOffer> {
    // First get current status
    const { data: current, error: fetchError } = await supabase
      .from('special_offers')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Toggle the status
    const { data, error } = await supabase
      .from('special_offers')
      .update({ is_active: !current.is_active })
      .eq('id', id)
      .select(`
        *,
        car:cars(*)
      `)
      .single();

    if (error) throw error;
    return this.mapDbSpecialOffer(data);
  }

  static async deleteSpecialOffer(id: string): Promise<void> {
    const { error } = await supabase
      .from('special_offers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }


  // Website Management - Contacts
  static async getWebsiteContacts(): Promise<ContactInfo> {
    try {
      const { data, error } = await supabase
        .from('website_contacts')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        return {
          facebook: data[0].facebook,
          instagram: data[0].instagram,
          tiktok: data[0].tiktok,
          whatsapp: data[0].whatsapp,
          phone: data[0].phone,
          address: data[0].address,
          email: data[0].email,
        };
      }
    } catch (e: any) {
      console.warn('getWebsiteContacts failed, returning empty object', e.message || e);
    }

    // Return empty object if error or no contacts exist
    return {};
  }

  static async updateWebsiteContacts(contacts: ContactInfo): Promise<ContactInfo> {
    // First, delete all existing records to ensure only one record exists
    await supabase
      .from('website_contacts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    // Then insert the new record
    const { data, error } = await supabase
      .from('website_contacts')
      .insert([{
        facebook: contacts.facebook,
        instagram: contacts.instagram,
        tiktok: contacts.tiktok,
        whatsapp: contacts.whatsapp,
        phone: contacts.phone,
        address: contacts.address,
        email: contacts.email,
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      facebook: data.facebook,
      instagram: data.instagram,
      tiktok: data.tiktok,
      whatsapp: data.whatsapp,
      phone: data.phone,
      address: data.address,
      email: data.email,
    };
  }

  // Website Management - Settings
  static async getWebsiteSettings(): Promise<WebsiteSettings> {
    try {
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        return {
          name: data[0].name,
          description: data[0].description,
          logo: data[0].logo,
          phone_number_2: data[0].phone_number_2,
          bank_number: data[0].bank_number,
          address: data[0].address,
          phone: data[0].phone,
          landing_background: data[0].landing_background,
        };
      }
    } catch (e: any) {
      console.warn('getWebsiteSettings failed, returning empty object', e.message || e);
    }

    // default empty - ensure required fields present
    return {
      name: '',
      description: '',
      logo: '',
      phone_number_2: '',
      bank_number: '',
      address: '',
      phone: '',
      landing_background: '',
    };
  }

  static async updateWebsiteSettings(settings: WebsiteSettings): Promise<WebsiteSettings> {
    // Les appels partiels (ConfigPage, upload de logo…) ne doivent pas effacer
    // les champs non fournis : on fusionne avec l'enregistrement existant.
    const current = await this.getWebsiteSettings();
    const merged = {
      name: settings.name ?? current.name,
      description: settings.description ?? current.description,
      logo: settings.logo ?? current.logo,
      phone_number_2: settings.phone_number_2 ?? current.phone_number_2,
      bank_number: settings.bank_number ?? current.bank_number,
      address: settings.address ?? current.address,
      phone: settings.phone ?? current.phone,
      landing_background: settings.landing_background ?? current.landing_background,
    };

    // First, delete all existing records to ensure only one record exists
    await supabase
      .from('website_settings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    // Then insert the new record
    let { data, error } = await supabase
      .from('website_settings')
      .insert([{
        ...merged,
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    // Colonne landing_background absente (migration 20260706 non appliquée) :
    // on réessaie sans la colonne pour ne pas bloquer la sauvegarde des autres champs.
    if (error && (error.message || '').includes('landing_background')) {
      const { landing_background: _lb, ...withoutBackground } = merged;
      ({ data, error } = await supabase
        .from('website_settings')
        .insert([{
          ...withoutBackground,
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single());
    }

    if (error) throw error;

    return {
      name: data.name,
      description: data.description,
      logo: data.logo,
      phone_number_2: data.phone_number_2,
      bank_number: data.bank_number,
      address: data.address,
      phone: data.phone,
      landing_background: data.landing_background,
    };
  }

  // Inspection Checklist Items
  static async getInspectionChecklistItems(): Promise<any[]> {
    const { data, error } = await supabase
      .from('inspection_checklist_items')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async createInspectionChecklistItem(item: {
    category: string;
    item_name: string;
    display_order?: number;
  }): Promise<any> {
    const { data, error } = await supabase
      .from('inspection_checklist_items')
      .insert([{
        category: item.category,
        item_name: item.item_name,
        display_order: item.display_order || 0
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteInspectionChecklistItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('inspection_checklist_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Vehicle Inspections
  static async createVehicleInspection(inspection: {
    reservation_id: string;
    type: 'departure' | 'return';
    mileage: number;
    fuel_level: string;
    agency_id: string;
    exterior_front_photo?: string;
    exterior_rear_photo?: string;
    interior_photo?: string;
    other_photos?: string[];
    client_signature?: string;
    notes?: string;
    date: string;
    time: string;
  }): Promise<any> {
    // upsert so that if an inspection already exists for this reservation/type it updates instead of inserting duplicate
    const { data, error } = await supabase
      .from('vehicle_inspections')
      .upsert([inspection], { onConflict: 'reservation_id,type' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateVehicleInspection(inspectionId: string, updates: Partial<{
    mileage: number;
    fuel_level: string;
    agency_id: string;
    exterior_front_photo?: string | null;
    exterior_rear_photo?: string | null;
    interior_photo?: string | null;
    other_photos?: string[];
    client_signature?: string | null;
    notes?: string | null;
    date?: string;
    time?: string;
  }>): Promise<any> {
    const { data, error } = await supabase
      .from('vehicle_inspections')
      .update(updates)
      .eq('id', inspectionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getVehicleInspections(reservationId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('vehicle_inspections')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Inspection Responses
  static async createInspectionResponses(responses: {
    inspection_id: string;
    checklist_item_id: string;
    status: boolean;
    note?: string;
  }[]): Promise<any[]> {
    try {
      // Request explicit columns to avoid complex auto-generated REST query params
      const { data, error } = await supabase
        .from('inspection_responses')
        .insert(responses)
        .select('id,inspection_id,checklist_item_id,status,note');

      if (error) {
        console.error('createInspectionResponses error:', error);
        throw error;
      }
      return data || [];
    } catch (err) {
      console.error('createInspectionResponses exception:', err);
      throw err;
    }
  }

  static async deleteInspectionResponses(inspectionId: string): Promise<void> {
    const { error } = await supabase
      .from('inspection_responses')
      .delete()
      .eq('inspection_id', inspectionId);

    if (error) throw error;
  }

  // Upsert inspection responses: create new rows or update existing ones by (inspection_id, checklist_item_id)
  static async upsertInspectionResponses(responses: {
    inspection_id: string;
    checklist_item_id: string;
    status: boolean;
    note?: string;
  }[]): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('inspection_responses')
        .upsert(responses, { onConflict: 'inspection_id,checklist_item_id' })
        .select('id,inspection_id,checklist_item_id,status,note');

      if (error) {
        console.error('upsertInspectionResponses error:', error);
        throw error;
      }
      return data || [];
    } catch (err) {
      console.error('upsertInspectionResponses exception:', err);
      throw err;
    }
  }

  // Services
  private static mapServiceRow(service: any) {
    return {
      id: service.id,
      category: service.category,
      name: service.service_name,
      description: service.description,
      price: Math.round(Number(service.price)),
      isActive: service.is_active,
      // Service obligatoire : pré-coché automatiquement sur toute réservation
      isMandatory: service.is_mandatory === true,
      createdAt: service.created_at,
    };
  }

  static async getServices(): Promise<any[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(service => this.mapServiceRow(service));
  }

  static async createService(service: Omit<any, 'id' | 'created_at'>): Promise<any> {
    const { data, error } = await supabase
      .from('services')
      .insert([{
        category: service.category,
        service_name: service.name,
        description: service.description,
        price: service.price,
        is_active: true,
        is_mandatory: service.isMandatory === true,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapServiceRow(data);
  }

  static async updateService(id: string, updates: any): Promise<any> {
    const payload: Record<string, any> = {
      service_name: updates.name,
      description: updates.description,
      price: updates.price,
      is_active: updates.isActive,
    };
    if (updates.isMandatory !== undefined) payload.is_mandatory = updates.isMandatory === true;

    const { data, error } = await supabase
      .from('services')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapServiceRow(data);
  }

  static async deleteService(id: string): Promise<void> {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Get drivers (workers with type 'driver')
  static async getDrivers(): Promise<Worker[]> {
    const { data, error } = await scopeQuery(supabase
      .from('workers')
      .select('*')
      .eq('type', 'driver'))
      .order('full_name', { ascending: true });

    if (error) throw error;

    return (data || []).map(worker => ({
      id: worker.id,
      fullName: worker.full_name,
      dateOfBirth: worker.date_of_birth,
      phone: worker.phone,
      email: worker.email,
      address: worker.address,
      profilePhoto: worker.profile_photo,
      type: worker.type,
      paymentType: worker.payment_type,
      baseSalary: worker.base_salary,
      username: worker.username,
      password: worker.password,
      advances: [],
      absences: [],
      payments: [],
      createdAt: worker.created_at,
    }));
  }

  // ========================================================================
  // PROTECTION ASSURANCES (forfaits d'assurance de protection)
  // ========================================================================

  // Master list of reusable items (like inspection_checklist_items)
  static async getProtectionAssuranceItems(): Promise<any[]> {
    const { data, error } = await supabase
      .from('protection_assurance_items')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return (data || []).map(it => ({
      id: it.id,
      name: it.item_name,
      displayOrder: it.display_order,
      createdAt: it.created_at,
    }));
  }

  static async createProtectionAssuranceItem(itemName: string, displayOrder = 0): Promise<any> {
    const { data, error } = await supabase
      .from('protection_assurance_items')
      .insert([{ item_name: itemName, display_order: displayOrder }])
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, name: data.item_name, displayOrder: data.display_order, createdAt: data.created_at };
  }

  static async deleteProtectionAssuranceItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('protection_assurance_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Assurances with their linked items (status true/false)
  static async getProtectionAssurances(includeInactive = false): Promise<any[]> {
    let query = supabase
      .from('protection_assurances')
      .select(`
        *,
        protection_assurance_item_links(
          id,
          status,
          item:protection_assurance_items(id, item_name, display_order)
        )
      `)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      pricePerDay: Math.round(Number(a.price_per_day) || 0),
      isActive: a.is_active,
      createdAt: a.created_at,
      items: (a.protection_assurance_item_links || [])
        .map((link: any) => ({
          linkId: link.id,
          itemId: link.item?.id || null,
          name: link.item?.item_name || '',
          status: !!link.status,
          displayOrder: link.item?.display_order ?? 0,
        }))
        .sort((x: any, y: any) => x.displayOrder - y.displayOrder),
    }));
  }

  // items: array of { itemId, status }
  static async createProtectionAssurance(payload: {
    name: string;
    pricePerDay: number;
    items?: { itemId: string; status: boolean }[];
  }): Promise<any> {
    const { data: assurance, error } = await supabase
      .from('protection_assurances')
      .insert([{ name: payload.name, price_per_day: payload.pricePerDay, is_active: true }])
      .select()
      .single();
    if (error) throw error;

    const items = payload.items || [];
    if (items.length > 0) {
      const links = items.map(it => ({
        assurance_id: assurance.id,
        item_id: it.itemId,
        status: it.status,
      }));
      const { error: linkError } = await supabase
        .from('protection_assurance_item_links')
        .insert(links);
      if (linkError) throw linkError;
    }
    return { id: assurance.id };
  }

  static async updateProtectionAssurance(id: string, payload: {
    name?: string;
    pricePerDay?: number;
    isActive?: boolean;
    items?: { itemId: string; status: boolean }[];
  }): Promise<void> {
    const updates: any = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.pricePerDay !== undefined) updates.price_per_day = payload.pricePerDay;
    if (payload.isActive !== undefined) updates.is_active = payload.isActive;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('protection_assurances')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    }

    // Replace links when items are provided
    if (payload.items) {
      const { error: delError } = await supabase
        .from('protection_assurance_item_links')
        .delete()
        .eq('assurance_id', id);
      if (delError) throw delError;

      if (payload.items.length > 0) {
        const links = payload.items.map(it => ({
          assurance_id: id,
          item_id: it.itemId,
          status: it.status,
        }));
        const { error: insError } = await supabase
          .from('protection_assurance_item_links')
          .insert(links);
        if (insError) throw insError;
      }
    }
  }

  static async deleteProtectionAssurance(id: string): Promise<void> {
    const { error } = await supabase
      .from('protection_assurances')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // ==========================================================================
  // CODES PROMO (gérés par l'admin, consommés par le site public)
  // ==========================================================================

  private static mapPromoCodeRow(row: any): PromoCode {
    return {
      id: row.id,
      code: row.code,
      discountPercentage: Number(row.discount_percentage),
      isActive: !!row.is_active,
      isUsed: !!row.is_used,
      usedAt: row.used_at,
      reservationId: row.reservation_id,
      createdAt: row.created_at,
    };
  }

  private static promoCodesMissingError(error: any): Error | null {
    const msg = error?.message || '';
    if (msg.includes('promo_codes') || error?.code === '42P01') {
      return new Error(
        "La table promo_codes n'existe pas encore. Exécutez la migration supabase/migrations/20260706_website_updates.sql dans le SQL Editor de Supabase."
      );
    }
    return null;
  }

  static async getPromoCodes(): Promise<PromoCode[]> {
    const { data, error } = await scopeQuery(supabase
      .from('promo_codes')
      .select('*'))
      .order('created_at', { ascending: false });

    if (error) throw this.promoCodesMissingError(error) || error;
    return (data || []).map(r => this.mapPromoCodeRow(r));
  }

  static async createPromoCode(code: string, discountPercentage: number): Promise<PromoCode> {
    const { data, error } = await supabase
      .from('promo_codes')
      .insert([{
        code: code.trim().toUpperCase(),
        discount_percentage: discountPercentage,
        is_active: true,
        is_used: false,
        ...this.companyStamp(),
      }])
      .select()
      .single();

    if (error) {
      if ((error.message || '').includes('promo_codes_code_unique') || error.code === '23505') {
        throw new Error('Ce code existe déjà — générez-en un autre.');
      }
      throw this.promoCodesMissingError(error) || error;
    }
    return this.mapPromoCodeRow(data);
  }

  static async setPromoCodeActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('promo_codes')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  }

  static async deletePromoCode(id: string): Promise<void> {
    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  /**
   * Vérifie un code promo côté serveur (RPC SECURITY DEFINER, accessible en
   * anonyme sans exposer la table). Retourne le pourcentage si valide.
   */
  static async verifyPromoCode(code: string): Promise<{ valid: boolean; discountPercentage?: number; reason?: string }> {
    const { data, error } = await supabase.rpc('verify_promo_code', { p_code: code });
    if (error) {
      if ((error.message || '').includes('verify_promo_code')) {
        return { valid: false, reason: 'missing_rpc' };
      }
      throw error;
    }
    return {
      valid: !!data?.valid,
      discountPercentage: data?.discount_percentage != null ? Number(data.discount_percentage) : undefined,
      reason: data?.reason,
    };
  }

  // ==========================================================================
  // SITE PUBLIC — création de réservation + disponibilité (RPC anti-RLS)
  // ==========================================================================

  /**
   * Crée client + réservation + services (+ consommation du code promo) en une
   * seule transaction via la RPC SECURITY DEFINER create_website_reservation.
   * C'est le SEUL chemin d'écriture du site public (le rôle anon n'a aucun
   * droit INSERT direct sur clients/reservations).
   */
  static async createWebsiteReservation(payload: {
    client: Record<string, any>;
    reservation: Record<string, any>;
    services?: { category: string; service_name: string; description?: string; price: number }[];
    promoCode?: string | null;
  }): Promise<{ reservationId: string; clientId: string }> {
    const { data, error } = await supabase.rpc('create_website_reservation', {
      p_client: payload.client,
      p_reservation: payload.reservation,
      p_services: payload.services || [],
      p_promo_code: payload.promoCode || null,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('create_website_reservation')) {
        throw new Error(
          "La fonction create_website_reservation n'existe pas encore. Exécutez la migration supabase/migrations/20260706_website_updates.sql dans le SQL Editor de Supabase."
        );
      }
      if (msg.includes('PROMO_CODE_INVALID')) {
        throw new Error('Le code promo est invalide ou a déjà été utilisé.');
      }
      if (msg.includes('CAR_UNAVAILABLE')) {
        throw new Error('Cette voiture vient d\'être réservée sur ces dates. Choisissez d\'autres dates.');
      }
      throw error;
    }

    return {
      reservationId: data?.reservation_id,
      clientId: data?.client_id,
    };
  }

  /**
   * IDs des voitures INDISPONIBLES sur une période (réservations pending/
   * accepted/confirmed/active qui chevauchent). Retourne null si la RPC
   * n'est pas encore installée (l'appelant affiche alors toutes les voitures).
   */
  static async getUnavailableCarIds(from: string, to: string): Promise<string[] | null> {
    try {
      const { data, error } = await supabase.rpc('get_unavailable_car_ids', { p_from: from, p_to: to });
      if (error) return null;
      return (data || []).map((r: any) => (typeof r === 'string' ? r : r.get_unavailable_car_ids || r.id)).filter(Boolean);
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // ENTREPRISES (clients société : contrats + factures)
  // ==========================================================================

  private static mapEntrepriseRow(row: any): Entreprise {
    return {
      id: row.id,
      name: row.name,
      rc: row.rc || undefined,
      art: row.art || undefined,
      nis: row.nis || undefined,
      nif: row.nif || undefined,
      address: row.address || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      createdAt: row.created_at,
    };
  }

  private static entreprisesMissingError(error: any): Error | null {
    const msg = error?.message || '';
    if (msg.includes('entreprises') || error?.code === '42P01') {
      return new Error(
        "La table entreprises n'existe pas encore. Exécutez la migration supabase/migrations/20260725_mhd_auto_major_update.sql dans le SQL Editor de Supabase."
      );
    }
    return null;
  }

  static async getEntreprises(): Promise<Entreprise[]> {
    const { data, error } = await scopeQuery(supabase
      .from('entreprises')
      .select('*'))
      .order('name', { ascending: true });
    if (error) throw this.entreprisesMissingError(error) || error;
    return (data || []).map(r => this.mapEntrepriseRow(r));
  }

  static async searchEntreprises(query: string, limit = 20): Promise<Entreprise[]> {
    const q = query.trim();
    if (!q) return this.getEntreprises();
    const { data, error } = await scopeQuery(supabase
      .from('entreprises')
      .select('*'))
      .ilike('name', `%${q}%`)
      .order('name', { ascending: true })
      .limit(limit);
    if (error) throw this.entreprisesMissingError(error) || error;
    return (data || []).map(r => this.mapEntrepriseRow(r));
  }

  static async createEntreprise(entreprise: Omit<Entreprise, 'id' | 'createdAt'>): Promise<Entreprise> {
    const { data, error } = await supabase
      .from('entreprises')
      .insert([{
        name: entreprise.name.trim(),
        rc: entreprise.rc || null,
        art: entreprise.art || null,
        nis: entreprise.nis || null,
        nif: entreprise.nif || null,
        address: entreprise.address || null,
        phone: entreprise.phone || null,
        email: entreprise.email || null,
        ...this.companyStamp(),
      }])
      .select()
      .single();
    if (error) throw this.entreprisesMissingError(error) || error;
    return this.mapEntrepriseRow(data);
  }

  static async updateEntreprise(id: string, updates: Partial<Entreprise>): Promise<Entreprise> {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.rc !== undefined) payload.rc = updates.rc || null;
    if (updates.art !== undefined) payload.art = updates.art || null;
    if (updates.nis !== undefined) payload.nis = updates.nis || null;
    if (updates.nif !== undefined) payload.nif = updates.nif || null;
    if (updates.address !== undefined) payload.address = updates.address || null;
    if (updates.phone !== undefined) payload.phone = updates.phone || null;
    if (updates.email !== undefined) payload.email = updates.email || null;

    const { data, error } = await supabase
      .from('entreprises')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw this.entreprisesMissingError(error) || error;
    return this.mapEntrepriseRow(data);
  }

  static async deleteEntreprise(id: string): Promise<void> {
    const { error } = await supabase.from('entreprises').delete().eq('id', id);
    if (error) throw this.entreprisesMissingError(error) || error;
  }

  /**
   * Historique d'une entreprise : réservations rattachées + totaux
   * (montant global, déjà payé, reste dû).
   */
  static async getEntrepriseHistory(entrepriseId: string): Promise<{
    reservations: any[];
    total: number;
    totalPaid: number;
    totalRemaining: number;
  }> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, client:clients(*), car:cars(*), payments(*)')
      .eq('entreprise_id', entrepriseId)
      .order('created_at', { ascending: false });

    if (error) throw this.entreprisesMissingError(error) || error;

    const rows = data || [];
    let total = 0;
    let totalPaid = 0;

    const reservations = rows.map((r: any) => {
      const resTotal = Number(r.total_price) || 0;
      const paid = (r.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      total += resTotal;
      totalPaid += paid;
      return {
        id: r.id,
        status: r.status,
        departureDate: r.departure_date,
        returnDate: r.return_date,
        totalDays: r.total_days,
        totalPrice: resTotal,
        paid,
        remaining: Math.max(0, resTotal - paid),
        clientName: r.client ? `${r.client.first_name || ''} ${r.client.last_name || ''}`.trim() : '',
        carInfo: r.car ? `${r.car.brand || ''} ${r.car.model || ''} — ${r.car.plate_number || ''}`.trim() : '',
        createdAt: r.created_at,
      };
    });

    return {
      reservations,
      total,
      totalPaid,
      totalRemaining: Math.max(0, total - totalPaid),
    };
  }

  // ==========================================================================
  // PARAMÈTRES DE LOCATION (limite de kilométrage, frais) — globaux
  // ==========================================================================

  static readonly DEFAULT_RENTAL_SETTINGS: RentalSettings = {
    mileageLimitPerDay: 0,
    excessMileageFeePerKm: 0,
    fuelFeePerLevel: 0,
  };

  /**
   * Réglages appliqués à TOUTES les fins de location. Une seule ligne
   * (singleton) dans `rental_settings`. Retourne les valeurs par défaut si la
   * table n'existe pas encore ou est vide — l'écran reste utilisable.
   */
  static async getRentalSettings(): Promise<RentalSettings> {
    try {
      const { data, error } = await supabase
        .from('rental_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error || !data) return { ...this.DEFAULT_RENTAL_SETTINGS };

      return {
        mileageLimitPerDay: Number(data.mileage_limit_per_day) || 0,
        excessMileageFeePerKm: Number(data.excess_mileage_fee_per_km) || 0,
        fuelFeePerLevel: Number(data.fuel_fee_per_level) || 0,
        updatedAt: data.updated_at,
      };
    } catch {
      return { ...this.DEFAULT_RENTAL_SETTINGS };
    }
  }

  static async saveRentalSettings(settings: RentalSettings): Promise<RentalSettings> {
    const payload = {
      id: 1,
      mileage_limit_per_day: settings.mileageLimitPerDay || 0,
      excess_mileage_fee_per_km: settings.excessMileageFeePerKm || 0,
      fuel_fee_per_level: settings.fuelFeePerLevel || 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('rental_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      if ((error.message || '').includes('rental_settings') || error.code === '42P01') {
        throw new Error(
          "La table rental_settings n'existe pas encore. Exécutez la migration supabase/migrations/20260725_mhd_auto_major_update.sql dans le SQL Editor de Supabase."
        );
      }
      throw error;
    }

    return {
      mileageLimitPerDay: Number(data.mileage_limit_per_day) || 0,
      excessMileageFeePerKm: Number(data.excess_mileage_fee_per_km) || 0,
      fuelFeePerLevel: Number(data.fuel_fee_per_level) || 0,
      updatedAt: data.updated_at,
    };
  }

  // ==========================================================================
  // INSPECTIONS — suppression définitive des photos à la clôture
  // ==========================================================================

  /**
   * Supprime DÉFINITIVEMENT toutes les photos d'inspection d'une réservation :
   * fichiers du bucket `inspection` + colonnes photo des lignes
   * `vehicle_inspections`. Appelé à la validation de « Terminer la location ».
   */
  static async purgeInspectionImages(reservationId: string): Promise<{ removedFiles: number }> {
    const { data: inspections, error } = await supabase
      .from('vehicle_inspections')
      .select('id, exterior_front_photo, exterior_rear_photo, interior_photo, other_photos, client_signature')
      .eq('reservation_id', reservationId);

    if (error) throw error;

    const urls: string[] = [];
    for (const insp of inspections || []) {
      urls.push(insp.exterior_front_photo, insp.exterior_rear_photo, insp.interior_photo, insp.client_signature);
      if (Array.isArray(insp.other_photos)) urls.push(...insp.other_photos);
    }

    // URL publique → chemin relatif dans le bucket `inspection`
    const paths = urls
      .filter((u): u is string => typeof u === 'string' && u.length > 0)
      .map(u => {
        const marker = '/storage/v1/object/public/inspection/';
        const idx = u.indexOf(marker);
        if (idx >= 0) return decodeURIComponent(u.substring(idx + marker.length));
        if (!u.startsWith('http') && !u.startsWith('data:')) return u.replace(/^\/+/, '');
        return null;
      })
      .filter((p): p is string => !!p);

    let removedFiles = 0;
    if (paths.length > 0) {
      const { data: removed, error: storageError } = await supabase.storage
        .from('inspection')
        .remove(Array.from(new Set(paths)));
      if (storageError) {
        console.warn('[purgeInspectionImages] Storage removal failed:', storageError.message);
      } else {
        removedFiles = (removed || []).length;
      }
    }

    // Efface les références en base, quoi qu'il arrive côté stockage
    const { error: clearError } = await supabase
      .from('vehicle_inspections')
      .update({
        exterior_front_photo: null,
        exterior_rear_photo: null,
        interior_photo: null,
        other_photos: [],
      })
      .eq('reservation_id', reservationId);

    if (clearError) throw clearError;

    return { removedFiles };
  }
}
