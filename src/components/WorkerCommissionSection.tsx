import React, { useEffect, useState } from 'react';
import { Language, Worker } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { computeCommissionAmount } from '../services/workerCommissionService';

export interface WorkerCommissionDraft {
  enabled: boolean;
  workerId: string;
  workerName: string;
  commissionType: 'fixed' | 'percentage';
  commissionValue: number | '';
  payoutMode: 'immediate' | 'deferred';
  note: string;
}

export const emptyCommissionDraft: WorkerCommissionDraft = {
  enabled: false,
  workerId: '',
  workerName: '',
  commissionType: 'percentage',
  commissionValue: '',
  payoutMode: 'immediate',
  note: '',
};

/**
 * Option « Commission employé » de la dernière étape de création :
 * l'utilisateur choisit l'employé ayant contribué à la réservation, un montant
 * fixe ou un pourcentage du total, et s'il est payé MAINTENANT (sortie de
 * caisse agence) ou PLUS TARD (mis sur son compte : acompte / paiement normal).
 */
export const WorkerCommissionSection: React.FC<{
  lang: Language;
  baseAmount: number;
  value: WorkerCommissionDraft | undefined;
  onChange: (v: WorkerCommissionDraft) => void;
}> = ({ lang, baseAmount, value, onChange }) => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);
  const draft = value || emptyCommissionDraft;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!draft.enabled || workers.length > 0) return;
    let cancelled = false;
    setLoading(true);
    DatabaseService.getWorkers()
      .then(list => { if (!cancelled) setWorkers(list); })
      .catch(err => console.error('Error loading workers:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [draft.enabled]);

  const set = (patch: Partial<WorkerCommissionDraft>) => onChange({ ...draft, ...patch });
  const amount = computeCommissionAmount(draft.commissionType, Number(draft.commissionValue) || 0, baseAmount);

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border-2 border-emerald-200 space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={e => set({ enabled: e.target.checked })}
          className="w-5 h-5 accent-emerald-600"
        />
        <span className="text-lg font-black text-emerald-900">
          🤝 {T('Commission employé (contribution à cette réservation)', 'عمولة الموظف (المساهمة في هذا الحجز)')}
        </span>
      </label>

      {draft.enabled && (
        <div className="space-y-4">
          <div>
            <label className="block font-bold text-emerald-900 mb-2">👤 {T('Employé', 'الموظف')}</label>
            <select
              value={draft.workerId}
              onChange={e => {
                const w = workers.find(x => x.id === e.target.value);
                set({ workerId: e.target.value, workerName: w?.fullName || '' });
              }}
              className="w-full p-3 border border-emerald-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{loading ? T('Chargement…', 'جاري التحميل…') : T('— Choisir un employé —', '— اختر موظفا —')}</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>
                  {w.fullName}{w.roleName ? ` (${w.roleName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-emerald-900 mb-2">📐 {T('Type de commission', 'نوع العمولة')}</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['percentage', T('Pourcentage (%)', 'نسبة (%)')],
                  ['fixed', T('Montant fixe (DA)', 'مبلغ ثابت (دج)')],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set({ commissionType: k })}
                    className={`p-3 rounded-lg border-2 font-bold text-sm transition-all ${
                      draft.commissionType === k ? 'border-emerald-500 bg-emerald-100 text-emerald-900' : 'border-emerald-200 bg-white text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block font-bold text-emerald-900 mb-2">
                {draft.commissionType === 'percentage' ? `% ${T('du total', 'من الإجمالي')}` : T('Montant (DA)', 'المبلغ (دج)')}
              </label>
              <input
                type="number"
                min={0}
                max={draft.commissionType === 'percentage' ? 100 : undefined}
                value={draft.commissionValue}
                onChange={e => set({ commissionValue: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="0"
                className="w-full p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-emerald-900 mb-2">💸 {T('Mode de paiement de la commission', 'طريقة دفع العمولة')}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set({ payoutMode: 'immediate' })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${draft.payoutMode === 'immediate' ? 'border-emerald-500 bg-emerald-100' : 'border-emerald-200 bg-white'}`}
              >
                <p className="font-black text-emerald-900 text-sm">⚡ {T('Payer maintenant', 'الدفع الآن')}</p>
                <p className="text-xs text-slate-600">{T('Déduit du total et sorti de la caisse de l\'agence', 'يخصم من الإجمالي ويخرج من صندوق الوكالة')}</p>
              </button>
              <button
                type="button"
                onClick={() => set({ payoutMode: 'deferred' })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${draft.payoutMode === 'deferred' ? 'border-emerald-500 bg-emerald-100' : 'border-emerald-200 bg-white'}`}
              >
                <p className="font-black text-emerald-900 text-sm">🗂️ {T('Mettre sur son compte', 'إضافة إلى حسابه')}</p>
                <p className="text-xs text-slate-600">{T('Payé plus tard via acompte ou en supplément du paiement normal', 'يدفع لاحقا عبر تسبيق أو كإضافة للدفع العادي')}</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-emerald-900 mb-2">📝 {T('Note (optionnel)', 'ملاحظة (اختياري)')}</label>
            <input
              type="text"
              value={draft.note}
              onChange={e => set({ note: e.target.value })}
              className="w-full p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-white rounded-xl p-4 border border-emerald-200 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">{T('Total de la réservation', 'إجمالي الحجز')}</span>
              <span className="font-bold">{Math.round(baseAmount).toLocaleString()} DA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{T('Commission employé', 'عمولة الموظف')}</span>
              <span className="font-black text-emerald-700">- {amount.toLocaleString()} DA</span>
            </div>
            <div className="flex justify-between border-t border-emerald-100 pt-1">
              <span className="text-slate-600">{T('Net agence', 'صافي الوكالة')}</span>
              <span className="font-black text-slate-900">{Math.max(0, Math.round(baseAmount - amount)).toLocaleString()} DA</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
