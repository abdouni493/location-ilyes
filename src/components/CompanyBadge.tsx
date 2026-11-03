import React from 'react';
import { Building2, AlertTriangle } from 'lucide-react';
import { Language } from '../types';
import { useCompany } from '../utils/companyProvider';

/**
 * Agence de l'utilisateur connecté — affichage seul.
 *
 * Il n'y a plus de bascule d'agence dans la barre de navigation : chacun voit
 * uniquement l'agence sous laquelle il s'est connecté. Ce badge se contente
 * donc de rappeler ce périmètre, sans aucune interaction.
 */
export const CompanyBadge: React.FC<{ lang: Language }> = ({ lang }) => {
  const { companies, activeCompanyId, userCompanyId, scopeKnown } = useCompany();

  // L'agence du compte connecté prime ; `activeCompanyId` sert de repli.
  const company =
    companies.find(c => c.id === userCompanyId) ||
    companies.find(c => c.id === activeCompanyId);

  // Périmètre indéterminé alors que plusieurs agences existent : ce compte voit
  // les données de TOUTES les agences. On l'affiche clairement plutôt que de
  // laisser croire à un cloisonnement qui n'a pas lieu (une réservation créée
  // ici n'appartiendrait alors à aucune agence).
  if (!company && companies.length > 1 && !scopeKnown) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 text-[10px] sm:text-xs font-bold text-amber-800 shadow-sm max-w-[10rem] sm:max-w-[16rem]"
        title={
          lang === 'fr'
            ? "Aucune agence rattachée à ce compte : vous voyez les données de toutes les agences. Rattachez ce compte à une agence (Paramètres → Agences)."
            : 'لا توجد وكالة مرتبطة بهذا الحساب: أنت ترى بيانات جميع الوكالات.'
        }
      >
        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
        <span className="truncate uppercase tracking-tight">
          {lang === 'fr' ? 'Toutes les agences' : 'كل الوكالات'}
        </span>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div
      className="flex items-center gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl bg-white border border-saas-border text-[10px] sm:text-xs font-bold text-saas-text-main shadow-sm max-w-[10rem] sm:max-w-[14rem]"
      title={lang === 'fr' ? 'Votre agence' : 'وكالتك'}
    >
      {company.logo ? (
        <img
          src={company.logo}
          alt={company.name}
          className="w-5 h-5 rounded-md object-cover border border-saas-border shrink-0"
          referrerPolicy="no-referrer"
        />
      ) : (
        <Building2 size={16} className="text-saas-primary-via shrink-0" />
      )}
      <span className="truncate uppercase tracking-tight">{company.name}</span>
    </div>
  );
};
