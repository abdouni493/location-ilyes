import React from 'react';
import { Worker, Language } from '../types';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { commissionStatusLabel } from './ReservationCommissionsPanel';

interface WorkerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: Worker;
  lang: Language;
}

export const WorkerHistoryModal: React.FC<WorkerHistoryModalProps> = ({ isOpen, onClose, worker, lang }) => {
  if (!isOpen) return null;

  const totalAdvances = worker.advances.reduce((sum, a) => sum + a.amount, 0);
  const totalAbsences = worker.absences.reduce((sum, a) => sum + a.cost, 0);
  const totalPayments = worker.payments.reduce((sum, p) => sum + p.amount, 0);
  const commissions = worker.commissions || [];
  const commissionsPaid = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const commissionsPending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ') : '—');

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto sm:py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-saas-border max-h-[calc(100vh-4rem)]"
      >
        <div className="p-6 border-b border-saas-border flex items-center justify-between bg-linear-to-r from-saas-primary-start via-saas-primary-via to-saas-primary-end text-white">
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
            📜 {{fr: 'Historique', ar: 'السجل التاريخي'}[lang]}
          </h2>
          <button onClick={onClose} className="p-2.5 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* Statistics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <p className="text-[9px] text-orange-600 font-bold uppercase tracking-widest mb-1">💳 {{fr: 'Total Avances', ar: 'إجمالي السلف'}[lang]}</p>
              <p className="text-lg font-black text-orange-700">{totalAdvances.toLocaleString('fr-FR')} DZ</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="text-[9px] text-red-600 font-bold uppercase tracking-widest mb-1">⚠️ {{fr: 'Total Absences', ar: 'إجمالي الغيابات'}[lang]}</p>
              <p className="text-lg font-black text-red-700">{totalAbsences.toLocaleString('fr-FR')} DZ</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mb-1">🤝 {{fr: 'Commissions payées', ar: 'العمولات المدفوعة'}[lang]}</p>
              <p className="text-lg font-black text-emerald-700">{commissionsPaid.toLocaleString('fr-FR')} DZ</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <p className="text-[9px] text-amber-600 font-bold uppercase tracking-widest mb-1">🗂️ {{fr: 'Commissions à payer', ar: 'العمولات المستحقة'}[lang]}</p>
              <p className="text-lg font-black text-amber-700">{commissionsPending.toLocaleString('fr-FR')} DZ</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 col-span-2">
              <p className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mb-1">💸 {{fr: 'Total Paiements', ar: 'إجمالي الدفعات'}[lang]}</p>
              <p className="text-lg font-black text-blue-700">{totalPayments.toLocaleString('fr-FR')} DZ</p>
            </div>
          </div>

          {/* Commissions Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-saas-primary-via uppercase tracking-[0.2em]">
              🤝 {{fr: 'Commissions réservations', ar: 'عمولات الحجوزات'}[lang]} ({commissions.length})
            </h3>
            {commissions.length > 0 ? (
              <div className="space-y-2">
                {commissions.map((c, idx) => (
                  <div key={c.id} className={`p-3 rounded-lg border ${c.status === 'paid' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-slate-700">#{idx + 1}</span>
                      <span className="text-xs font-bold text-slate-700">{fmt(c.createdAt)}</span>
                    </div>
                    <p className="text-sm font-black text-emerald-700 mb-1">+ {c.amount.toLocaleString('fr-FR')} DZ</p>
                    <div className="space-y-0.5 text-xs text-slate-600">
                      {(c.reservation?.clientName || c.reservation?.carName) && (
                        <p>🚗 {[c.reservation?.clientName, c.reservation?.carName, c.reservation?.carPlate].filter(Boolean).join(' · ')}</p>
                      )}
                      {c.reservation?.departureDate && (
                        <p>📅 {fmt(c.reservation.departureDate)} → {fmt(c.reservation.returnDate)}</p>
                      )}
                      <p>📐 {c.commissionType === 'percentage'
                        ? `${c.commissionValue}% ${lang === 'fr' ? 'de' : 'من'} ${Math.round(c.baseAmount).toLocaleString('fr-FR')} DZ`
                        : (lang === 'fr' ? 'Montant fixe' : 'مبلغ ثابت')}</p>
                      <p className="font-bold">{c.status === 'paid' ? '✅' : '⏳'} {commissionStatusLabel(c, lang)}{c.paidAt ? ` — ${fmt(c.paidAt)}` : ''}</p>
                      {c.note && <p>📝 {c.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-saas-text-muted">{{fr: 'Aucune commission enregistrée', ar: 'لا توجد عمولات مسجلة'}[lang]}</p>
            )}
          </div>

          {/* Advances Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-saas-primary-via uppercase tracking-[0.2em]">
              💳 {{fr: 'Avances', ar: 'السلف'}[lang]} ({worker.advances.length})
            </h3>
            {worker.advances.length > 0 ? (
              <div className="space-y-2">
                {worker.advances.map((adv, idx) => (
                  <div key={adv.id} className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-orange-700">#{idx + 1}</span>
                      <span className="text-xs font-bold text-orange-700">{new Date(adv.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ')}</span>
                    </div>
                    <p className="text-sm font-bold text-orange-700 mb-1">{adv.amount.toLocaleString('fr-FR')} DZ</p>
                    {adv.note && <p className="text-xs text-orange-600">{adv.note}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-saas-text-muted">{{fr: 'Aucune avance enregistrée', ar: 'لا توجد سلف مسجلة'}[lang]}</p>
            )}
          </div>

          {/* Absences Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-saas-primary-via uppercase tracking-[0.2em]">
              ⚠️ {{fr: 'Absences', ar: 'الغيابات'}[lang]} ({worker.absences.length})
            </h3>
            {worker.absences.length > 0 ? (
              <div className="space-y-2">
                {worker.absences.map((abs, idx) => (
                  <div key={abs.id} className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-red-700">#{idx + 1}</span>
                      <span className="text-xs font-bold text-red-700">{new Date(abs.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ')}</span>
                    </div>
                    <p className="text-sm font-bold text-red-700 mb-1">- {abs.cost.toLocaleString('fr-FR')} DZ</p>
                    {abs.note && <p className="text-xs text-red-600">{abs.note}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-saas-text-muted">{{fr: 'Aucune absence enregistrée', ar: 'لا توجد غيابات مسجلة'}[lang]}</p>
            )}
          </div>

          {/* Payments Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-saas-primary-via uppercase tracking-[0.2em]">
              💸 {{fr: 'Paiements', ar: 'الدفعات'}[lang]} ({worker.payments.length})
            </h3>
            {worker.payments.length > 0 ? (
              <div className="space-y-2">
                {worker.payments.map((pay, idx) => (
                  <div key={pay.id} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-700">#{idx + 1}</span>
                      <span className="text-xs font-bold text-blue-700">{new Date(pay.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ')}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-blue-600">
                        <span>{{fr: 'Montant', ar: 'المبلغ'}[lang]}:</span>
                        <span className="font-bold">{pay.amount.toLocaleString('fr-FR')} DZ</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>{{fr: 'Salaire Net', ar: 'الراتب الصافي'}[lang]}:</span>
                        <span className="font-bold">{pay.netSalary.toLocaleString('fr-FR')} DZ</span>
                      </div>
                    </div>
                    {pay.note && <p className="text-xs text-blue-600 mt-2">{pay.note}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-saas-text-muted">{{fr: 'Aucun paiement enregistré', ar: 'لا توجد دفعات مسجلة'}[lang]}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-saas-border flex items-center gap-2 bg-saas-bg">
          <button 
            onClick={onClose}
            className="flex-1 btn-saas-outline py-2"
          >
            {{fr: 'Fermer', ar: 'إغلاق'}[lang]}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
