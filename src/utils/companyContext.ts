import { Company } from '../types';

/**
 * Contexte « agence active » (multi-agences).
 *
 * Deux besoins cohabitent :
 *  1. La couche service (`DatabaseService`, `ReservationsService`) — des
 *     classes statiques sans accès au contexte React — doit lire de façon
 *     SYNCHRONE l'agence courante pour filtrer/estampiller les requêtes.
 *     → un singleton module (`companyContext`) tenu à jour à la connexion.
 *  2. L'interface (badges, garde d'accès) doit RÉAGIR à la résolution.
 *     → un `CompanyProvider` React (voir `companyProvider.tsx`) qui alimente ce
 *        singleton puis expose les mêmes valeurs via un hook.
 *
 * Règle de scoping — chacun ne voit QUE l'agence sous laquelle il s'est
 * connecté ; il n'existe plus aucune bascule d'agence dans l'interface :
 *  - Utilisateur rattaché à une agence : figé sur SON `company_id`.
 *  - Compte racine sans `company_id` : vue combinée (aucun filtre), sinon
 *    l'application serait vide pour lui.
 *
 * ⚠️ On ne touche JAMAIS au concept `agencies` (agences physiques de
 *    départ/retour) : la dimension métier ici est `company`.
 */

/**
 * Valeur sentinelle : aucun filtre d'agence. Réservée aux comptes racine sans
 * `company_id` — plus aucun utilisateur ne peut y basculer depuis l'interface.
 */
export const ALL_COMPANIES = 'all';

/**
 * Ancienne clé de persistance du sélecteur d'agence. Le sélecteur a été retiré :
 * on nettoie la valeur résiduelle pour qu'un choix historique ne continue pas à
 * restreindre (ou élargir) la vue d'un utilisateur.
 */
const LEGACY_ACTIVE_STORAGE_KEY = 'active_company_id_v1';

function clearLegacyActive() {
  try { localStorage.removeItem(LEGACY_ACTIVE_STORAGE_KEY); } catch { /* noop */ }
}

interface CompanyState {
  /** Agence de rattachement de l'utilisateur connecté (fixe). */
  userCompanyId: string | null;
  isSuperAdmin: boolean;
  /** Agence principale (is_primary) — héberge les voitures non explicitement liées. */
  primaryCompanyId: string | null;
  /** Périmètre courant : l'agence de l'utilisateur, ou ALL_COMPANIES. */
  activeCompanyId: string;
  /** true dès que les infos ont été résolues depuis `app_users`. */
  resolved: boolean;
  /**
   * true = le périmètre vient RÉELLEMENT de la base (`app_users` ou `workers`).
   * false = la résolution a échoué / n'a rien trouvé : on est en vue « toutes
   * agences » par défaut de sécurité, mais on ne SAIT PAS à quelle agence
   * appartient l'utilisateur — il ne faut alors JAMAIS deviner une agence à
   * l'écriture (voir `getWriteCompanyId`).
   */
  scopeKnown: boolean;
}

// Défaut SÛR : super-admin + vue « toutes agences » ⇒ aucun filtre appliqué
// tant que la résolution n'a pas eu lieu (l'agence actuelle reste intacte).
const state: CompanyState = {
  userCompanyId: null,
  isSuperAdmin: true,
  primaryCompanyId: null,
  activeCompanyId: ALL_COMPANIES,
  resolved: false,
  scopeKnown: false,
};

// Snapshot immuable exposé à React (`useSyncExternalStore`). Il DOIT garder la
// même référence tant que l'état ne change pas, sinon React boucle. On le
// remplace uniquement dans `emit()`.
let snapshot: Readonly<CompanyState> = { ...state };

type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  snapshot = { ...state };
  listeners.forEach(l => { try { l(); } catch { /* noop */ } });
}

export const companyContext = {
  /**
   * Renseigne l'identité de l'utilisateur (après connexion / restauration).
   * Le périmètre est TOUJOURS l'agence de rattachement du compte connecté :
   * il n'y a plus de bascule ni de choix persisté. Seul un compte racine sans
   * `company_id` reste en vue combinée.
   */
  setUserInfo(userCompanyId: string | null, isSuperAdmin: boolean, scopeKnown: boolean = true) {
    clearLegacyActive();
    state.userCompanyId = userCompanyId;
    state.isSuperAdmin = isSuperAdmin;
    state.resolved = true;
    state.scopeKnown = scopeKnown;
    state.activeCompanyId = userCompanyId || ALL_COMPANIES;
    emit();
  },

  /** Enregistre la liste des agences et en déduit l'agence principale. */
  setCompanies(companies: Company[]) {
    const primary = companies.find(c => c.isPrimary) || companies[0];
    state.primaryCompanyId = primary?.id || state.primaryCompanyId || null;
    // Si l'agence de rattachement a disparu → repli sans filtre plutôt que de
    // laisser l'utilisateur sur un périmètre inexistant (donc vide).
    if (
      state.activeCompanyId !== ALL_COMPANIES &&
      companies.length > 0 &&
      !companies.some(c => c.id === state.activeCompanyId)
    ) {
      state.activeCompanyId = ALL_COMPANIES;
    }
    emit();
  },

  /** Réinitialise à la déconnexion. */
  reset() {
    clearLegacyActive();
    state.userCompanyId = null;
    state.isSuperAdmin = true;
    state.primaryCompanyId = null;
    state.activeCompanyId = ALL_COMPANIES;
    state.resolved = false;
    state.scopeKnown = false;
    emit();
  },

  getSnapshot(): Readonly<CompanyState> { return snapshot; },
  getUserCompanyId() { return state.userCompanyId; },
  isResolved() { return state.resolved; },
  isScopeKnown() { return state.scopeKnown; },
  getIsSuperAdmin() { return state.isSuperAdmin; },
  getPrimaryCompanyId() { return state.primaryCompanyId; },
  getActiveCompanyId() { return state.activeCompanyId; },
  isAllView() { return state.activeCompanyId === ALL_COMPANIES; },

  /**
   * Id d'agence par lequel FILTRER les lectures, ou `null` = aucun filtre
   * (compte racine sans agence de rattachement).
   */
  getScopeCompanyId(): string | null {
    return state.activeCompanyId === ALL_COMPANIES ? null : state.activeCompanyId;
  },

  /**
   * Id d'agence à ESTAMPILLER sur les insertions. Sans filtre, on retombe sur
   * l'agence de l'utilisateur (ou l'agence principale) ; si rien n'est connu,
   * `null` laisse le trigger DB remplir la valeur.
   */
  getWriteCompanyId(): string | null {
    if (state.activeCompanyId !== ALL_COMPANIES) return state.activeCompanyId;
    // Périmètre INCONNU (résolution échouée, ou pas encore faite) : on
    // n'estampille RIEN. Deviner l'agence principale ici enverrait la ligne
    // dans une AUTRE agence que celle de l'utilisateur — elle deviendrait
    // alors invisible pour lui (bug « je crée une réservation, je ne la
    // retrouve nulle part »). `null` laisse le trigger DB
    // (`set_company_id_from_auth`) trancher avec `auth_company_id()`, qui est
    // la source de vérité côté base.
    if (!state.resolved || !state.scopeKnown) return null;
    return state.userCompanyId || state.primaryCompanyId || null;
  },

  /**
   * Attend que le périmètre d'agence soit résolu (connexion en cours de
   * restauration). À `await` AVANT toute écriture estampillée, pour ne jamais
   * insérer une ligne avec un périmètre encore vide. Renvoie la main au bout de
   * `timeoutMs` même si rien n'a été résolu (on n'empêche jamais l'écriture).
   */
  whenResolved(timeoutMs = 8000): Promise<void> {
    if (state.resolved) return Promise.resolve();
    return new Promise<void>(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        unsubscribe();
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      const unsubscribe = companyContext.subscribe(() => {
        if (state.resolved) finish();
      });
      if (state.resolved) finish();
    });
  },

  /**
   * Une ligne métier (portant `company_id`) appartient-elle au périmètre
   * courant ? Garde-fou d'affichage : même si une requête oubliait
   * `scopeQuery`, l'agence ne verra jamais les lignes d'une autre agence.
   */
  belongsToActiveCompany(rowCompanyId: string | null | undefined): boolean {
    const scope = state.activeCompanyId === ALL_COMPANIES ? null : state.activeCompanyId;
    if (!scope) return true;
    return rowCompanyId === scope;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/**
 * Applique le filtre d'agence à une requête Supabase de LECTURE (business data).
 * En vue « toutes agences » (super-admin), la requête est renvoyée inchangée.
 * NE JAMAIS utiliser sur les tables PARTAGÉES (cars, offers, services…) ni sur
 * les vérifications de disponibilité (qui restent globales inter-agences).
 */
export function scopeQuery<T>(query: T): T {
  const cid = companyContext.getScopeCompanyId();
  if (!cid) return query;
  // supabase-js renvoie un builder chaînable ; `.eq` conserve le type.
  return (query as any).eq('company_id', cid) as T;
}

/**
 * Une voiture est-elle visible dans le périmètre de l'agence active ?
 *  - aucun filtre (compte racine) : toujours vrai ;
 *  - agence précise : vrai si la voiture est liée à cette agence (table
 *    car_companies). Une voiture SANS aucun lien est rattachée à l'agence
 *    principale (compat. voitures historiques).
 * `links` = map carId -> [companyId] (voir DatabaseService.getCarCompanyLinks).
 */
export function isCarInActiveCompany(carId: string, links: Record<string, string[]>): boolean {
  const scope = companyContext.getScopeCompanyId();
  if (!scope) return true;
  const ids = (links[carId] && links[carId].length)
    ? links[carId]
    : (companyContext.getPrimaryCompanyId() ? [companyContext.getPrimaryCompanyId() as string] : []);
  return ids.includes(scope);
}
