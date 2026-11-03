import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, CalendarPlus, Loader2 } from 'lucide-react';
import { Language, ReservationDetails } from '../types';
import { computeRentalBase } from '../utils/pricing';

/**
 * Continuité de location — le client garde le véhicule N jours de plus.
 *
 * Règle métier centrale : le coût de la prolongation est **indépendant**.
 * Il est calculé sur les SEULS jours ajoutés (barème mois / semaine / jour du
 * véhicule appliqué à ces jours-là), jamais en rejugeant la durée totale. Les
 * jours déjà facturés du contrat initial ne sont donc jamais recalculés.
 */

const addDays = (isoDate: string, days: number): string => {
  const base = new Date(isoDate);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + days);
  return base.toISOString().substring(0, 10);
};

const fmtDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

export interface ContinuationPayload {
  addedDays: number;
  pricePerDay: number;
  totalPrice: number;
  newReturnDate: string;
  paidAmount: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'check';
  notes: string;
}

export const ContinuationModal: React.FC<{
  lang: Language;
  reservation: ReservationDetails;
  onClose: () => void;
  onConfirm: (payload: ContinuationPayload) => Promise<void>;
}> = ({ lang, reservation, onClose, onConfirm }) => {
  const fr = lang === 'fr';
  const DA = fr ? 'DA' : 'د.ج';

  const [days, setDays] = useState<string>('1');
  const [customPricePerDay, setCustomPricePerDay] = useState<string>('');
  const [paidNow, setPaidNow] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer' | 'check'>('cash');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addedDays = Math.max(0, Math.floor(Number(days) || 0));
  const currentReturnDate = (reservation.step1?.returnDate || '').substring(0, 10);

  /**
   * Tarif journalier SUGGÉRÉ pour les jours ajoutés : barème du véhicule
   * appliqué aux seuls jours ajoutés (7 jours ajoutés ⇒ tarif semaine, etc.).
   */
  const suggestedPerDay = useMemo(() => {
    if (addedDays <= 0) return Number(reservation.car?.priceDay) || 0;
    const base = computeRentalBase(reservation.car, addedDays);
    return base.total > 0 ? Math.round(base.total / addedDays) : (Number(reservation.car?.priceDay) || 0);
  }, [reservation.car, addedDays]);

  const pricePerDay = customPricePerDay.trim() !== ''
    ? Math.max(0, Math.round(Number(customPricePerDay) || 0))
    : suggestedPerDay;

  const continuationTotal = Math.round(pricePerDay * addedDays);
  const newReturnDate = addedDays > 0 && currentReturnDate ? addDays(currentReturnDate, addedDays) : '';

  const paidNowNum = Math.max(0, Math.min(continuationTotal, Math.round(Number(paidNow) || 0)));
  const currentDebt = Math.max(0, Number(reservation.remainingPayment) || 0);
  const newDebt = currentDebt + continuationTotal - paidNowNum;

  const alreadyAdded = Number(reservation.continuationDays) || 0;

  const handleConfirm = async () => {
    if (addedDays <= 0) {
      setError(fr ? 'Indiquez au moins 1 jour supplémentaire.' : 'أدخل يوماً إضافياً واحداً على الأقل.');
      return;
    }
    if (!newReturnDate) {
      setError(fr ? 'Date de retour actuelle introuvable.' : 'تاريخ العودة الحالي غير متوفر.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onConfirm({
        addedDays,
        pricePerDay,
        totalPrice: continuationTotal,
        newReturnDate,
        paidAmount: paidNowNum,
        paymentMethod: method,
        notes: notes.trim(),
      });
    } catch (e: any) {
      setError(e?.message || (fr ? 'Enregistrement impossible.' : 'تعذر الحفظ.'));
      setIsSaving(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50"
        onClick={isSaving ? undefined : onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto sm:py-8 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-sky-700 px-6 py-5 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <CalendarPlus className="w-5 h-5" />
                {fr ? 'Continuité de location' : 'تمديد الكراء'}
              </h2>
              <p className="text-cyan-100 text-xs mt-0.5 font-medium">
                {reservation.client?.firstName} {reservation.client?.lastName} · {reservation.car?.brand} {reservation.car?.model}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Contrat en cours — rappel (jamais recalculé) */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">{fr ? 'Retour prévu actuel' : 'تاريخ العودة الحالي'}</span>
                <span className="font-black text-slate-900">{fmtDate(currentReturnDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">{fr ? 'Durée déjà facturée' : 'المدة المفوترة'}</span>
                <span className="font-bold text-slate-700">{reservation.totalDays || 0} {fr ? 'jours' : 'أيام'}</span>
              </div>
              {alreadyAdded > 0 && (
                <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                  <span className="text-cyan-600 font-bold">{fr ? 'Déjà prolongé de' : 'تم التمديد بـ'}</span>
                  <span className="font-black text-cyan-700">+{alreadyAdded} {fr ? 'jours' : 'أيام'}</span>
                </div>
              )}
            </div>

            {/* Jours ajoutés */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                {fr ? 'Jours supplémentaires demandés' : 'الأيام الإضافية المطلوبة'} *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={days}
                  onChange={e => setDays(e.target.value)}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-slate-100"
                />
                {[1, 3, 7, 30].map(n => (
                  <button
                    key={n}
                    onClick={() => setDays(String(n))}
                    disabled={isSaving}
                    className={`px-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
                      addedDays === n ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>

            {/* Tarif journalier appliqué à CES jours */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                {fr ? 'Tarif par jour appliqué' : 'السعر اليومي المطبق'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={customPricePerDay}
                  onChange={e => setCustomPricePerDay(e.target.value)}
                  placeholder={`${suggestedPerDay.toLocaleString('fr-DZ')} ${DA} (${fr ? 'suggéré' : 'مقترح'})`}
                  disabled={isSaving}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-slate-100"
                />
                {customPricePerDay.trim() !== '' && (
                  <button
                    onClick={() => setCustomPricePerDay('')}
                    disabled={isSaving}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 px-2 py-1 rounded-lg"
                  >
                    {fr ? 'Auto' : 'تلقائي'}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {fr
                  ? 'Tarif issu du barème du véhicule appliqué aux seuls jours ajoutés.'
                  : 'السعر مأخوذ من تسعيرة المركبة ومطبق على الأيام المضافة فقط.'}
              </p>
            </div>

            {/* Récapitulatif — coût INDÉPENDANT */}
            <div className="bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-cyan-700 font-medium">{fr ? 'Nouvelle date de retour' : 'تاريخ العودة الجديد'}</span>
                <span className="font-black text-cyan-900">{fmtDate(newReturnDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-cyan-700 font-medium">
                  {fr ? 'Coût de la prolongation' : 'تكلفة التمديد'} ({addedDays} × {pricePerDay.toLocaleString('fr-DZ')})
                </span>
                <span className="font-black text-cyan-900">{continuationTotal.toLocaleString('fr-DZ')} {DA}</span>
              </div>
              <p className="text-[11px] text-cyan-700 font-semibold border-t border-cyan-200 pt-2">
                ℹ️ {fr
                  ? 'Montant indépendant : les jours du contrat initial ne sont pas recalculés.'
                  : 'مبلغ مستقل: أيام العقد الأصلي لا يُعاد احتسابها.'}
              </p>
            </div>

            {/* Encaissement immédiat (optionnel) */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                {fr ? 'Encaissé maintenant (optionnel)' : 'المحصل الآن (اختياري)'}
              </label>
              <input
                type="number"
                min="0"
                max={continuationTotal}
                value={paidNow}
                onChange={e => setPaidNow(e.target.value)}
                placeholder={fr ? '0 — tout part en dette' : '0 — الكل يضاف للدين'}
                disabled={isSaving}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-slate-100"
              />
              {paidNowNum > 0 && (
                <div className="flex gap-2 pt-1">
                  {([
                    { id: 'cash', fr: 'Espèces', ar: 'نقداً' },
                    { id: 'card', fr: 'Carte', ar: 'بطاقة' },
                    { id: 'transfer', fr: 'Virement', ar: 'تحويل' },
                    { id: 'check', fr: 'Chèque', ar: 'شيك' },
                  ] as const).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      disabled={isSaving}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                        method === m.id ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {fr ? m.fr : m.ar}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Impact sur la dette */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">{fr ? 'Dette actuelle' : 'الدين الحالي'}</span>
                <span className="font-bold text-slate-800">{currentDebt.toLocaleString('fr-DZ')} {DA}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-red-200 pt-2">
                <span className="text-red-600 font-black">{fr ? 'Dette après prolongation' : 'الدين بعد التمديد'}</span>
                <span className="font-black text-red-700">{newDebt.toLocaleString('fr-DZ')} {DA}</span>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                {fr ? 'Note (optionnel)' : 'ملاحظة (اختياري)'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={fr ? 'Ex : prolongation demandée par téléphone...' : 'مثال: تمديد بطلب هاتفي...'}
                disabled={isSaving}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-slate-100"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {fr ? 'Annuler' : 'إلغاء'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving || addedDays <= 0}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {fr ? 'Enregistrement...' : 'جاري الحفظ...'}</>
                ) : (
                  <>🔁 {fr ? 'Confirmer la continuité' : 'تأكيد التمديد'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

/**
 * Confirmation d'impression proposée juste après la création d'une
 * prolongation : l'agence imprime le contrat de continuité dans la foulée.
 */
export const ContinuationPrintPrompt: React.FC<{
  lang: Language;
  addedDays: number;
  totalPrice: number;
  onPrint: () => void;
  onSkip: () => void;
}> = ({ lang, addedDays, totalPrice, onPrint, onSkip }) => {
  const fr = lang === 'fr';
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onSkip}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-600 to-sky-700 px-6 py-5">
            <h2 className="text-xl font-black text-white">
              ✅ {fr ? 'Continuité enregistrée' : 'تم تسجيل التمديد'}
            </h2>
            <p className="text-cyan-100 text-xs mt-0.5 font-medium">
              +{addedDays} {fr ? 'jours' : 'أيام'} · {totalPrice.toLocaleString('fr-DZ')} {fr ? 'DA' : 'د.ج'}
            </p>
          </div>
          <div className="p-6 space-y-5">
            <p className="text-slate-700 font-medium">
              {fr
                ? 'Voulez-vous imprimer le nouveau contrat de continuité maintenant ?'
                : 'هل تريد طباعة عقد التمديد الجديد الآن؟'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onSkip}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                {fr ? 'Plus tard' : 'لاحقاً'}
              </button>
              <button
                onClick={onPrint}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                🖨️ {fr ? 'Imprimer le contrat' : 'طباعة العقد'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};
