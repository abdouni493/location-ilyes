import React, { createContext, useContext, useMemo } from 'react';
import { WorkerPermissions } from '../types';
import { SIDEBAR_ITEMS } from '../constants';

/**
 * Permissions de l'utilisateur connecté.
 *
 * L'administrateur voit tout : `isAdmin` court-circuite tous les contrôles.
 * Un employé ne voit que les interfaces cochées dans son profil, et dans
 * chacune, uniquement les boutons d'action autorisés.
 */
interface PermissionsValue {
  isAdmin: boolean;
  permissions: WorkerPermissions | null;
  /** L'onglet est-il visible dans la sidebar ? */
  canSeeInterface: (interfaceId: string) => boolean;
  /** Le bouton d'action est-il autorisé dans cette interface ? */
  can: (interfaceId: string, actionId: string) => boolean;
  /** Ids des onglets visibles, dans l'ordre de SIDEBAR_ITEMS. */
  visibleInterfaces: string[];
}

const PermissionsContext = createContext<PermissionsValue>({
  isAdmin: true,
  permissions: null,
  canSeeInterface: () => true,
  can: () => true,
  visibleInterfaces: SIDEBAR_ITEMS.map(i => i.id),
});

export const PermissionsProvider: React.FC<{
  isAdmin: boolean;
  permissions: WorkerPermissions | null;
  children: React.ReactNode;
}> = ({ isAdmin, permissions, children }) => {
  const value = useMemo<PermissionsValue>(() => {
    const allIds = SIDEBAR_ITEMS.map(i => i.id);

    if (isAdmin) {
      return {
        isAdmin: true,
        permissions,
        canSeeInterface: () => true,
        can: () => true,
        visibleInterfaces: allIds,
      };
    }

    const allowedInterfaces = new Set(permissions?.interfaces || []);
    const actions = permissions?.actions || {};

    return {
      isAdmin: false,
      permissions,
      canSeeInterface: (interfaceId: string) => allowedInterfaces.has(interfaceId),
      can: (interfaceId: string, actionId: string) =>
        allowedInterfaces.has(interfaceId) && (actions[interfaceId] || []).includes(actionId),
      visibleInterfaces: allIds.filter(id => allowedInterfaces.has(id)),
    };
  }, [isAdmin, permissions]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export function usePermissions(): PermissionsValue {
  return useContext(PermissionsContext);
}

/**
 * Masque ses enfants quand l'action n'est pas autorisée.
 * Usage : <Can i="planner" a="delete"><button …/></Can>
 */
export const Can: React.FC<{
  i: string;
  a: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ i, a, children, fallback = null }) => {
  const { can } = usePermissions();
  return <>{can(i, a) ? children : fallback}</>;
};
