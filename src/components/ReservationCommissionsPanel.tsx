import React, { useEffect, useState } from 'react';
import { Language, WorkerCommission } from '../types';
import { WorkerCommissionService } from '../services/workerCommissionService';

const fmtDate = (d: string | undefined, lang: Language) =>
  d ? new Date(d).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ') : '—';

export const commissionStatusLabel = (c: WorkerCommission, lang: Language): string => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);
  if (c.status === 'pending') return T('En attente — sur le compte de l\'employé', 'معلقة — في حساب الموظف');
  if (c.paidVia === 'creation') return T('Payée à la création (caisse agence)', 'مدفوعة عند الإنشاء (صندوق الوكالة)');
  if (c.paidVia === 'advance') return T('Payée via acompte', 'مدفوعة عبر تسبيق');
  if (c.paidVia === 'payment') return T('Payée avec le paiement normal', 'مدفوعة مع الدفع العادي');
  return T('Payée', 'مدفوعة');
};

/** Affiche les commissions employés d'une réservation (rien si aucune). */
export const ReservationCommissionsPanel: React.FC<{ lang: Language; reservationId: string; totalPrice?: number }> = ({ lang, reservationId, totalPrice }) => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);
  const [items, setItems] = useState<WorkerCommission[]>([]);

  useEffect(() => {
    if (!reservationId) return;
    WorkerCommissionService.getByReservation(reservationId).then(setItems);
  }, [reservationId]);

  if (items.length === 0) return null;
  const total = items.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="mt-6 bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
      <h3 className="text-lg font-black text-emerald-900 mb-4">🤝 {T('Commission employé', 'عمولة الموظف')}</h3>
      <div className="space-y-3">
        {items.map(c => (
          <div key={c.id} className="bg-white rounded-xl p-4 border border-emerald-100 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-600">{T('Employé', 'الموظف')}</span><span className="font-black">{c.workerName || '—'}</span></div>
            <div className="flex justify-between">
              <span className="text-slate-600">{T('Type', 'النوع')}</span>
              <span className="font-bold">
                {c.commissionType === 'percentage'
                  ? `${c.commissionValue}% ${T('de', 'من')} ${Math.round(c.baseAmount).toLocaleString()} DA`
                  : T('Montant fixe', 'مبلغ ثابت')}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-slate-600">{T('Montant', 'المبلغ')}</span><span className="font-black text-emerald-700">{c.amount.toLocaleString()} DA</span></div>
            <div className="flex justify-between">
              <span className="text-slate-600">{T('Mode', 'الطريقة')}</span>
              <span className="font-bold">{c.payoutMode === 'immediate' ? T('Payée maintenant', 'مدفوعة الآن') : T('Sur le compte de l\'employé', 'في حساب الموظف')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{T('Statut', 'الحالة')}</span>
              <span className={`font-bold ${c.status === 'paid' ? 'text-green-700' : 'text-orange-600'}`}>{commissionStatusLabel(c, lang)}</span>
            </div>
            {c.paidAt && <div className="flex justify-between"><span className="text-slate-600">{T('Date de paiement', 'تاريخ الدفع')}</span><span className="font-bold">{fmtDate(c.paidAt, lang)}</span></div>}
            <div className="flex justify-between"><span className="text-slate-600">{T('Créée le', 'أنشئت في')}</span><span className="font-bold">{fmtDate(c.createdAt, lang)}</span></div>
            {c.note && <p className="text-xs text-slate-500 pt-1">📝 {c.note}</p>}
          </div>
        ))}
        {typeof totalPrice === 'number' && (
          <div className="flex justify-between text-sm font-black pt-2 border-t border-emerald-200">
            <span>{T('Net agence après commission', 'صافي الوكالة بعد العمولة')}</span>
            <span>{Math.max(0, Math.round(totalPrice - total)).toLocaleString()} DA</span>
          </div>
        )}
      </div>
    </div>
  );
};
