import React from 'react';
import { Worker, Language } from '../types';
import { motion } from 'motion/react';
import {
  Eye, Wallet, HandCoins, CalendarX, History, Pencil, Trash2, ShieldCheck,
  Phone, Mail, BadgeCheck, KeyRound,
} from 'lucide-react';
import { usePermissions } from '../utils/permissions';

interface WorkerCardProps {
  worker: Worker;
  index: number;
  lang: Language;
  onDetails: () => void;
  onPayment: () => void;
  onAdvance: () => void;
  onAbsence: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Absent = l'utilisateur courant n'a pas le droit de gérer les permissions. */
  onPermissions?: () => void;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker, index, lang,
  onDetails, onPayment, onAdvance, onAbsence, onHistory, onEdit, onDelete, onPermissions,
}) => {
  const { can } = usePermissions();
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const typeLabel =
    worker.type === 'admin' ? T('Administrateur', 'مسؤول')
      : worker.type === 'driver' ? T('Chauffeur', 'سائق')
      : T('Employé', 'موظف');

  const permissionCount = worker.permissions?.interfaces?.length || 0;

  const actions: { key: string; icon: React.ReactNode; label: string; onClick: () => void; cls: string; show: boolean }[] = [
    { key: 'view', icon: <Eye className="w-3.5 h-3.5" />, label: T('Voir', 'عرض'), onClick: onDetails,
      cls: 'border-saas-border hover:border-[#0284C7] hover:text-[#0284C7]', show: can('team', 'view') },
    { key: 'edit', icon: <Pencil className="w-3.5 h-3.5" />, label: T('Modifier', 'تعديل'), onClick: onEdit,
      cls: 'border-saas-border hover:border-[#0284C7] hover:text-[#0284C7]', show: can('team', 'edit') },
    { key: 'permissions', icon: <ShieldCheck className="w-3.5 h-3.5" />, label: T('Permissions', 'الصلاحيات'), onClick: onPermissions || (() => {}),
      cls: 'border-[#0284C7]/35 text-[#0284C7] hover:bg-[#0284C7]/8', show: !!onPermissions },
    { key: 'advance', icon: <HandCoins className="w-3.5 h-3.5" />, label: T('Acompte', 'سلفة'), onClick: onAdvance,
      cls: 'border-saas-border hover:border-orange-500 hover:text-orange-600', show: can('team', 'advance') },
    { key: 'absence', icon: <CalendarX className="w-3.5 h-3.5" />, label: T('Absence', 'غياب'), onClick: onAbsence,
      cls: 'border-saas-border hover:border-orange-500 hover:text-orange-600', show: can('team', 'absence') },
    { key: 'payment', icon: <Wallet className="w-3.5 h-3.5" />, label: T('Paiement', 'الدفع'), onClick: onPayment,
      cls: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50', show: can('team', 'payment') },
    { key: 'history', icon: <History className="w-3.5 h-3.5" />, label: T('Historique', 'السجل'), onClick: onHistory,
      cls: 'border-saas-border hover:border-[#0F172A] hover:text-[#0F172A]', show: true },
    { key: 'delete', icon: <Trash2 className="w-3.5 h-3.5" />, label: T('Supprimer', 'حذف'), onClick: onDelete,
      cls: 'border-[#DC2626]/35 text-[#DC2626] hover:bg-[#DC2626]/8', show: can('team', 'delete') },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group relative bg-white rounded-3xl border border-saas-border overflow-hidden hover-lift flex flex-col"
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#DC2626] to-[#0284C7]" />

      {/* En-tête */}
      <div className="p-5 flex items-start gap-4 border-b border-saas-border">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-saas-border bg-saas-bg flex items-center justify-center shrink-0">
          {worker.profilePhoto
            ? <img src={worker.profilePhoto} alt={worker.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            : <span className="text-2xl">👤</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-saas-text-main truncate leading-tight">{worker.fullName}</h3>
          <p className="text-[11px] font-black uppercase tracking-wider text-[#DC2626] mt-0.5">
            {worker.roleName || typeLabel}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {worker.accountEnabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0284C7]/10 border border-[#0284C7]/25 text-[9px] font-black uppercase tracking-wider text-[#0284C7]">
                <KeyRound className="w-2.5 h-2.5" />{T('Compte actif', 'حساب مفعّل')}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
              permissionCount > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-saas-bg border-saas-border text-saas-text-muted'
            }`}>
              <ShieldCheck className="w-2.5 h-2.5" />
              {permissionCount > 0 ? `${permissionCount} ${T('accès', 'وصول')}` : T('Aucun accès', 'بدون صلاحيات')}
            </span>
          </div>
        </div>
      </div>

      {/* Informations */}
      <div className="px-5 py-4 space-y-1.5 text-xs border-b border-saas-border flex-1">
        <p className="flex items-center gap-2 text-saas-text-muted">
          <Phone className="w-3.5 h-3.5 text-saas-text-muted shrink-0" />
          <span className="text-saas-text-main font-semibold truncate">{worker.phone || '—'}</span>
        </p>
        <p className="flex items-center gap-2 text-saas-text-muted">
          <Mail className="w-3.5 h-3.5 text-saas-text-muted shrink-0" />
          <span className="truncate">{worker.email || '—'}</span>
        </p>
        {worker.startDate && (
          <p className="flex items-center gap-2 text-saas-text-muted">
            <BadgeCheck className="w-3.5 h-3.5 text-saas-text-muted shrink-0" />
            <span>{T('Depuis le', 'منذ')} {worker.startDate}</span>
          </p>
        )}
        {worker.paymentEnabled && worker.baseSalary > 0 && (
          <p className="flex items-center gap-2 pt-1.5 mt-1.5 border-t border-saas-border">
            <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-black text-emerald-700">
              {worker.baseSalary.toLocaleString('fr-DZ')} DA
            </span>
            <span className="text-saas-text-muted">
              / {worker.paymentType === 'daily' ? T('jour', 'يوم') : T('mois', 'شهر')}
            </span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-saas-bg flex flex-wrap gap-1.5">
        {actions.filter(a => a.show).map(a => (
          <button
            key={a.key}
            onClick={a.onClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white border text-[11px] font-bold text-saas-text-main transition-colors cursor-pointer ${a.cls}`}
          >
            {a.icon}{a.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
