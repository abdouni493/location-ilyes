import { supabase } from '../supabase';
import { WorkerCommission } from '../types';
import { companyContext, scopeQuery } from '../utils/companyContext';

/**
 * COMMISSIONS EMPLOYÉS SUR RÉSERVATION
 *
 * Un employé ayant contribué à une réservation peut recevoir un montant fixe
 * ou un pourcentage du total. Deux modes :
 *  - 'immediate' : payé à la création → sortie de caisse agence (dépense
 *    magasin) et commission marquée « payée ».
 *  - 'deferred'  : mise sur le compte de l'employé, réglée plus tard via un
 *    acompte ou en supplément d'un paiement normal.
 */

const TABLE = 'reservation_worker_commissions';

function companyStamp(): { company_id?: string } {
  const id = companyContext.getWriteCompanyId();
  return id ? { company_id: id } : {};
}

const today = () => new Date().toISOString().split('T')[0];

export function mapCommissionRow(r: any): WorkerCommission {
  return {
    id: r.id,
    reservationId: r.reservation_id,
    workerId: r.worker_id,
    workerName: r.worker_name || undefined,
    commissionType: r.commission_type === 'percentage' ? 'percentage' : 'fixed',
    commissionValue: Number(r.commission_value) || 0,
    baseAmount: Number(r.base_amount) || 0,
    amount: Number(r.amount) || 0,
    payoutMode: r.payout_mode === 'deferred' ? 'deferred' : 'immediate',
    status: r.status === 'paid' ? 'paid' : 'pending',
    paidVia: r.paid_via || undefined,
    paidAt: r.paid_at || undefined,
    workerPaymentId: r.worker_payment_id || undefined,
    workerAdvanceId: r.worker_advance_id || undefined,
    storeExpenseId: r.store_expense_id || undefined,
    note: r.note || undefined,
    createdByName: r.created_by_name || undefined,
    createdAt: r.created_at,
    reservation: r.reservation
      ? {
          departureDate: r.reservation.departure_date,
          returnDate: r.reservation.return_date,
          totalPrice: Number(r.reservation.total_price) || 0,
          clientName: r.reservation.client
            ? `${r.reservation.client.first_name || ''} ${r.reservation.client.last_name || ''}`.trim()
            : undefined,
          carName: r.reservation.car
            ? `${r.reservation.car.brand || ''} ${r.reservation.car.model || ''}`.trim()
            : undefined,
          carPlate: r.reservation.car?.plate_number || r.reservation.car?.registration || undefined,
        }
      : undefined,
  };
}

export function computeCommissionAmount(type: 'fixed' | 'percentage', value: number, base: number): number {
  const v = Number(value) || 0;
  if (type === 'percentage') return Math.max(0, Math.round((base * v) / 100));
  return Math.max(0, Math.round(v));
}

const SELECT_WITH_RESERVATION = `
  *,
  reservation:reservations(
    departure_date, return_date, total_price,
    client:clients(*),
    car:cars(*)
  )
`;

export const WorkerCommissionService = {
  /** Crée la commission ; si mode « immediate », sort l'argent de la caisse agence. */
  async createCommission(input: {
    reservationId: string;
    workerId: string;
    workerName?: string;
    commissionType: 'fixed' | 'percentage';
    commissionValue: number;
    baseAmount: number;
    payoutMode: 'immediate' | 'deferred';
    note?: string;
    createdByName?: string | null;
    reservationLabel?: string;
  }): Promise<WorkerCommission> {
    const amount = computeCommissionAmount(input.commissionType, input.commissionValue, input.baseAmount);
    const immediate = input.payoutMode === 'immediate';

    let storeExpenseId: string | null = null;
    if (immediate && amount > 0) {
      // Sortie de caisse agence : enregistrée comme dépense magasin.
      const { data: exp, error: expErr } = await supabase
        .from('store_expenses')
        .insert({
          name: `Commission employé — ${input.workerName || ''}`.trim(),
          cost: amount,
          date: today(),
          note: [
            input.reservationLabel ? `Réservation : ${input.reservationLabel}` : null,
            input.commissionType === 'percentage'
              ? `${input.commissionValue}% de ${Math.round(input.baseAmount).toLocaleString('fr-FR')} DA`
              : 'Montant fixe',
            input.note || null,
          ].filter(Boolean).join(' · '),
          icon: '🤝',
          ...companyStamp(),
        })
        .select('id')
        .single();
      if (expErr) console.warn('[Commission] Dépense caisse non enregistrée :', expErr.message);
      storeExpenseId = exp?.id || null;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        reservation_id: input.reservationId,
        worker_id: input.workerId,
        worker_name: input.workerName || null,
        commission_type: input.commissionType,
        commission_value: Number(input.commissionValue) || 0,
        base_amount: Math.round(input.baseAmount || 0),
        amount,
        payout_mode: input.payoutMode,
        status: immediate ? 'paid' : 'pending',
        paid_via: immediate ? 'creation' : null,
        paid_at: immediate ? today() : null,
        store_expense_id: storeExpenseId,
        note: input.note || null,
        created_by_name: input.createdByName || null,
        ...companyStamp(),
      })
      .select(SELECT_WITH_RESERVATION)
      .single();
    if (error) throw error;
    return mapCommissionRow(data);
  },

  async getByReservation(reservationId: string): Promise<WorkerCommission[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('[Commission] lecture impossible :', error.message);
      return [];
    }
    return (data || []).map(mapCommissionRow);
  },

  async getByWorker(workerId: string): Promise<WorkerCommission[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT_WITH_RESERVATION)
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[Commission] lecture impossible :', error.message);
      return [];
    }
    return (data || []).map(mapCommissionRow);
  },

  /** Toutes les commissions de l'agence, groupées par employé (tolérant si la table n'existe pas). */
  async getAllGroupedByWorker(): Promise<Record<string, WorkerCommission[]>> {
    const { data, error } = await scopeQuery(supabase.from(TABLE).select(SELECT_WITH_RESERVATION))
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[Commission] lecture impossible :', error.message);
      return {};
    }
    const out: Record<string, WorkerCommission[]> = {};
    for (const row of data || []) {
      const c = mapCommissionRow(row);
      (out[c.workerId] ||= []).push(c);
    }
    return out;
  },

  /** Règle des commissions en attente (via acompte ou paiement normal). */
  async markPaid(ids: string[], via: 'advance' | 'payment', refs: { workerPaymentId?: string; workerAdvanceId?: string; date?: string }): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from(TABLE)
      .update({
        status: 'paid',
        paid_via: via,
        paid_at: refs.date || today(),
        worker_payment_id: refs.workerPaymentId || null,
        worker_advance_id: refs.workerAdvanceId || null,
      })
      .in('id', ids);
    if (error) throw error;
  },
};
