import React, { useMemo, useState } from 'react';
import { Worker, Language, WorkerPayment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Check, Wallet, CalendarDays, TrendingDown, AlertTriangle } from 'lucide-react';
import { DatabaseService } from '../services/DatabaseService';
import { WorkerCommissionService } from '../services/workerCommissionService';

interface WorkerPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: Worker;
  lang: Language;
  onCreatePayment?: (payment: WorkerPayment) => Promise<void> | void;
}

const money = (n: number) => `${Math.round(n || 0).toLocaleString('fr-DZ')} DA`;

/** Clés de période entre la date d'entrée et aujourd'hui ('YYYY-MM' ou 'YYYY-MM-DD'). */
function buildPeriods(startDate: string | undefined, type: 'daily' | 'monthly'): string[] {
  const start = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(start.getTime())) return [];
  const today = new Date();
  const keys: string[] = [];

  if (type === 'monthly') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 1);
    let guard = 0;
    while (cursor <= end && guard < 60) {
      keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
      guard++;
    }
  } else {
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= today && guard < 120) {
      keys.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
  }
  return keys.reverse(); // périodes les plus récentes en premier
}

/**
 * PAIEMENT D'UN EMPLOYÉ
 *
 * Liste les périodes (mois ou jours) NON encore payées depuis sa date d'entrée,
 * ainsi que les acomptes et absences pas encore déduits. Le net est calculé
 * automatiquement mais reste modifiable ; la date de paiement est éditable et
 * la description facultative.
 */
export const WorkerPaymentModal: React.FC<WorkerPaymentModalProps> = ({ isOpen, onClose, worker, lang, onCreatePayment }) => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const paymentType: 'daily' | 'monthly' = worker.paymentType === 'daily' ? 'daily' : 'monthly';

  const paidKeys = useMemo(
    () => new Set((worker.payments || []).map(p => p.periodKey).filter(Boolean) as string[]),
    [worker.payments]
  );
  const unpaidPeriods = useMemo(
    () => buildPeriods(worker.startDate || worker.createdAt, paymentType).filter(k => !paidKeys.has(k)),
    [worker.startDate, worker.createdAt, paymentType, paidKeys]
  );
  const pendingAdvances = useMemo(() => (worker.advances || []).filter(a => !a.settled), [worker.advances]);
  const pendingAbsences = useMemo(() => (worker.absences || []).filter(a => !a.settled), [worker.absences]);
  // Commissions sur réservations mises sur le compte (payées en supplément)
  const pendingCommissions = useMemo(() => (worker.commissions || []).filter(c => c.status === 'pending'), [worker.commissions]);

  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(unpaidPeriods.slice(0, 1));
  const [selectedAdvances, setSelectedAdvances] = useState<string[]>(pendingAdvances.map(a => a.id));
  const [selectedAbsences, setSelectedAbsences] = useState<string[]>(pendingAbsences.map(a => a.id));
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>(pendingCommissions.map(c => c.id));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [manualAmount, setManualAmount] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseSalary = (Number(worker.baseSalary) || 0) * selectedPeriods.length;
  const advancesTotal = pendingAdvances.filter(a => selectedAdvances.includes(a.id)).reduce((s, a) => s + a.amount, 0);
  const absencesTotal = pendingAbsences.filter(a => selectedAbsences.includes(a.id)).reduce((s, a) => s + a.cost, 0);
  const commissionsTotal = pendingCommissions.filter(c => selectedCommissions.includes(c.id)).reduce((s, c) => s + c.amount, 0);
  const computedNet = Math.max(0, baseSalary + commissionsTotal - advancesTotal - absencesTotal);
  const netSalary = manualAmount === '' ? computedNet : Math.max(0, Number(manualAmount));

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const periodLabel = (key: string) => {
    if (paymentType === 'monthly') {
      const [y, m] = key.split('-');
      return new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ', { month: 'long', year: 'numeric' });
    }
    return new Date(key).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ');
  };

  const handleCreatePayment = async () => {
    if (selectedPeriods.length === 0 && selectedCommissions.length === 0) {
      setError(T('Sélectionnez au moins une période à payer.', 'اختر فترة واحدة على الأقل للدفع.'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Une ligne de paiement par période couverte : l'historique reste lisible
      // et ces périodes disparaissent des prochains calculs.
      // Paiement des seules commissions (aucune période) : une ligne sans période.
      const periods: (string | undefined)[] = selectedPeriods.length > 0 ? selectedPeriods : [undefined];
      const perPeriod = Math.round(netSalary / periods.length);
      let created: WorkerPayment | null = null;
      const commissionNote = commissionsTotal > 0
        ? `${T('Commissions réservations', 'عمولات الحجوزات')} +${money(commissionsTotal)}`
        : '';

      for (let i = 0; i < periods.length; i++) {
        const key = periods[i];
        // La dernière ligne absorbe l'arrondi pour retomber sur le net exact.
        const amount = i === periods.length - 1
          ? netSalary - perPeriod * (periods.length - 1)
          : perPeriod;

        created = await DatabaseService.createWorkerPayment(worker.id, {
          amount,
          date: paymentDate,
          baseSalary: Number(worker.baseSalary) || 0,
          advances: i === 0 ? advancesTotal : 0,
          absences: i === 0 ? absencesTotal : 0,
          netSalary: amount,
          note: [note.trim(), i === 0 ? commissionNote : ''].filter(Boolean).join(' · ') || undefined,
          periodKey: key,
        } as any);
      }

      // Marque les acomptes / absences comme déduits : plus jamais recomptés.
      await DatabaseService.settleWorkerItems(selectedAdvances, selectedAbsences);
      // Commissions réglées avec ce paiement normal.
      await WorkerCommissionService.markPaid(selectedCommissions, 'payment', { workerPaymentId: created?.id, date: paymentDate });

      if (created) await onCreatePayment?.(created);
      onClose();
    } catch (err: any) {
      console.error('Error creating payment:', err);
      setError(err?.message || T('Erreur lors du paiement', 'خطأ أثناء الدفع'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 bg-slate-900/55 backdrop-blur-sm overflow-y-auto sm:py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="bg-saas-bg w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-saas-border max-h-[calc(100vh-4rem)]"
      >
        <div className="relative overflow-hidden bg-[#0F172A] text-white px-8 py-6 shrink-0">
          <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-emerald-500/25 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Wallet className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter">{T('Paiement', 'الدفع')}</h2>
                <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.25em] mt-1">
                  {worker.fullName} · {paymentType === 'daily' ? T('journalier', 'يومي') : T('mensuel', 'شهري')} · {money(Number(worker.baseSalary) || 0)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-7 space-y-5">
          {worker.paymentEnabled === false && (
            <div className="flex items-start gap-3 rounded-2xl bg-orange-50 border border-orange-200 p-4">
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-orange-800">
                {T("Cet employé n'est pas marqué comme rémunéré. Vous pouvez tout de même enregistrer un paiement.",
                   'هذا الموظف غير مسجل كمتقاضٍ للأجر. يمكنك مع ذلك تسجيل دفعة.')}
              </p>
            </div>
          )}

          {/* Périodes non payées */}
          <section className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#0284C7] text-white flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </span>
                {paymentType === 'monthly' ? T('Mois non payés', 'الأشهر غير المدفوعة') : T('Jours non payés', 'الأيام غير المدفوعة')}
              </h3>
              <span className="text-xs font-black text-saas-text-muted">
                {selectedPeriods.length}/{unpaidPeriods.length}
              </span>
            </div>

            <div className="p-4">
              {unpaidPeriods.length === 0 ? (
                <p className="py-6 text-center text-sm font-semibold text-saas-text-muted">
                  {T('Toutes les périodes sont déjà payées 🎉', 'كل الفترات مدفوعة 🎉')}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto custom-scrollbar">
                  {unpaidPeriods.map(key => {
                    const on = selectedPeriods.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggle(selectedPeriods, setSelectedPeriods, key)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          on ? 'border-emerald-400 bg-emerald-50' : 'border-saas-border bg-saas-bg hover:border-saas-border-strong'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                          on ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                        }`}>
                          {on && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                        </span>
                        <span className="text-xs font-bold text-saas-text-main capitalize truncate">{periodLabel(key)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Acomptes / absences non déduits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-2xl border border-saas-border bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
                <h3 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center">
                    <TrendingDown className="w-4 h-4" />
                  </span>
                  {T('Acomptes à déduire', 'السلف المراد خصمها')}
                </h3>
              </div>
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {pendingAdvances.length === 0 ? (
                  <p className="py-4 text-center text-xs font-semibold text-saas-text-muted">
                    {T('Aucun acompte en attente', 'لا توجد سلف معلقة')}
                  </p>
                ) : pendingAdvances.map(a => {
                  const on = selectedAdvances.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(selectedAdvances, setSelectedAdvances, a.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        on ? 'border-orange-400 bg-orange-50' : 'border-saas-border bg-saas-bg'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        on ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
                      }`}>
                        {on && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-bold text-saas-text-main">{a.date}</span>
                        {a.note && <span className="block text-[11px] text-saas-text-muted truncate">{a.note}</span>}
                      </span>
                      <span className="text-sm font-black text-orange-600">−{money(a.amount)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-saas-border bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
                <h3 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#DC2626] text-white flex items-center justify-center">
                    <TrendingDown className="w-4 h-4" />
                  </span>
                  {T('Absences à déduire', 'الغيابات المراد خصمها')}
                </h3>
              </div>
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {pendingAbsences.length === 0 ? (
                  <p className="py-4 text-center text-xs font-semibold text-saas-text-muted">
                    {T('Aucune absence en attente', 'لا توجد غيابات معلقة')}
                  </p>
                ) : pendingAbsences.map(a => {
                  const on = selectedAbsences.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(selectedAbsences, setSelectedAbsences, a.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        on ? 'border-[#DC2626] bg-[#DC2626]/6' : 'border-saas-border bg-saas-bg'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        on ? 'border-[#DC2626] bg-[#DC2626]' : 'border-slate-300 bg-white'
                      }`}>
                        {on && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-bold text-saas-text-main">{a.date}</span>
                        {a.note && <span className="block text-[11px] text-saas-text-muted truncate">{a.note}</span>}
                      </span>
                      <span className="text-sm font-black text-[#DC2626]">−{money(a.cost)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Commissions en attente (ajoutées au paiement) */}
          {pendingCommissions.length > 0 && (
            <section className="rounded-2xl border border-saas-border bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
                <h3 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">🤝</span>
                  {T('Commissions réservations à ajouter', 'عمولات الحجوزات المراد إضافتها')}
                </h3>
              </div>
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {pendingCommissions.map(c => {
                  const on = selectedCommissions.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(selectedCommissions, setSelectedCommissions, c.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        on ? 'border-emerald-400 bg-emerald-50' : 'border-saas-border bg-saas-bg'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        on ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                      }`}>
                        {on && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-bold text-saas-text-main truncate">
                          {[c.reservation?.clientName, c.reservation?.carName].filter(Boolean).join(' · ') || T('Réservation', 'حجز')}
                        </span>
                        <span className="block text-[11px] text-saas-text-muted truncate">
                          {c.commissionType === 'percentage' ? `${c.commissionValue}% · ` : ''}{c.createdAt?.split('T')[0]}
                        </span>
                      </span>
                      <span className="text-sm font-black text-emerald-600">+{money(c.amount)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Calcul + saisie */}
          <section className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
              <h3 className="font-black text-sm uppercase tracking-tight text-saas-text-main">
                {T('Montant à verser', 'المبلغ المستحق')}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className={`grid gap-3 ${commissionsTotal > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                {[
                  { l: T('Salaire', 'الراتب'), v: money(baseSalary), c: 'text-[#0284C7]' },
                  ...(commissionsTotal > 0 ? [{ l: T('Commissions', 'العمولات'), v: `+${money(commissionsTotal)}`, c: 'text-emerald-600' }] : []),
                  { l: T('Acomptes', 'السلف'), v: `−${money(advancesTotal)}`, c: 'text-orange-600' },
                  { l: T('Absences', 'الغيابات'), v: `−${money(absencesTotal)}`, c: 'text-[#DC2626]' },
                ].map(cell => (
                  <div key={cell.l} className="rounded-xl border border-saas-border bg-saas-bg px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-saas-text-muted">{cell.l}</p>
                    <p className={`text-base font-black mt-0.5 ${cell.c}`}>{cell.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-saas">{T('Date du paiement', 'تاريخ الدفع')}</label>
                  <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="input-saas" />
                </div>
                <div>
                  <label className="label-saas">{T('Montant net (modifiable)', 'الصافي (قابل للتعديل)')}</label>
                  <input
                    type="number" min={0}
                    value={manualAmount === '' ? computedNet : manualAmount}
                    onChange={e => setManualAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="input-saas font-black"
                  />
                </div>
                <div>
                  <label className="label-saas">
                    {T('Description', 'الوصف')} <span className="normal-case font-normal">({T('optionnel', 'اختياري')})</span>
                  </label>
                  <input value={note} onChange={e => setNote(e.target.value)} className="input-saas" placeholder="—" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border-2 border-emerald-300 px-5 py-4">
                <span className="font-black uppercase tracking-tight text-emerald-800">
                  {T('Net à payer', 'الصافي للدفع')}
                </span>
                <span className="text-2xl font-black text-emerald-700">{money(netSalary)}</span>
              </div>
            </div>
          </section>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4"
              >
                <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-red-700">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 px-7 py-5 bg-white border-t border-saas-border flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="btn-saas-outline px-8 cursor-pointer">
            {T('Annuler', 'إلغاء')}
          </button>
          <button onClick={handleCreatePayment} disabled={saving} className="btn-saas-success px-10 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {T('Enregistrer le paiement', 'حفظ الدفعة')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
