import { ReservationDetails, VehicleExpense, Language, Car } from '../types';

/**
 * RAPPORT PROPRIÉTAIRE — document imprimable remis au propriétaire du véhicule.
 *
 * Règle absolue : ce document N'AFFICHE JAMAIS la part revenant à l'agence.
 * Il ne montre que ce qui concerne le propriétaire : informations de l'agence
 * (en-tête + logo), période, fiche du véhicule, coordonnées du propriétaire,
 * liste des locations, liste des dépenses, et le bénéfice qui lui revient.
 */

export interface OwnerReportData {
  car: Car;
  reservations: ReservationDetails[];
  expenses: VehicleExpense[];
  startDate: string;
  endDate: string;
  agencySettings: any;
  lang: Language;
  /** Recettes encaissées sur la période (DZD). */
  totalCollected: number;
  /** Total des dépenses du véhicule sur la période (DZD). */
  totalExpenses: number;
  /** Bénéfice revenant au propriétaire (DZD) — la part agence est déjà retirée. */
  ownerBenefit: number;
  /** Nombre de jours loués sur la période. */
  rentedDays: number;
}

const esc = (v: any) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const generateOwnerReportHTML = (data: OwnerReportData): string => {
  const {
    car, reservations, expenses, startDate, endDate, agencySettings, lang,
    totalCollected, totalExpenses, ownerBenefit, rentedDays,
  } = data;

  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);
  const fmt = (n: number) => `${Math.round(n || 0).toLocaleString('fr-DZ')} DA`;
  const fmtD = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString(isFr ? 'fr-FR' : 'ar-DZ'); } catch { return d; }
  };

  const paidOf = (r: ReservationDetails) => {
    const payments = (r.payments || []) as any[];
    const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (sum > 0) return sum;
    return Math.max(0, (Number(r.totalPrice) || 0) - (Number(r.remainingPayment) || 0));
  };

  const activeRes = reservations.filter(r => r.status !== 'cancelled');

  const rentalRows = activeRes.length
    ? activeRes.map(r => `
        <tr>
          <td>${esc(fmtD(r.step1?.departureDate))}</td>
          <td>${esc(fmtD(r.step1?.returnDate))}</td>
          <td class="center">${esc(r.totalDays || 0)}</td>
          <td>${esc(`${r.client?.firstName || ''} ${r.client?.lastName || ''}`.trim() || '—')}</td>
          <td class="right strong">${esc(fmt(paidOf(r)))}</td>
        </tr>`).join('')
    : `<tr><td colspan="5" class="empty">${T('Aucune location sur cette période', 'لا توجد إيجارات في هذه الفترة')}</td></tr>`;

  const expenseRows = expenses.length
    ? expenses.map(e => `
        <tr>
          <td>${esc(fmtD(e.date))}</td>
          <td>${esc(e.expenseName || e.type || '—')}</td>
          <td>${esc(e.note || '—')}</td>
          <td class="right strong negative">− ${esc(fmt(Number(e.cost) || 0))}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="empty">${T('Aucune dépense sur cette période', 'لا توجد مصاريف في هذه الفترة')}</td></tr>`;

  const logo = agencySettings?.logo
    ? `<img class="logo" src="${esc(agencySettings.logo)}" alt="logo" />`
    : `<div class="logo logo-fallback">M</div>`;

  return `<!DOCTYPE html>
<html dir="${isFr ? 'ltr' : 'rtl'}" lang="${isFr ? 'fr' : 'ar'}">
<head>
<meta charset="UTF-8">
<title>${T('Rapport propriétaire', 'تقرير المالك')} — ${esc(car.brand)} ${esc(car.model)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif;
    color: #0F172A;
    background: #FFFFFF;
    font-size: 12px;
    line-height: 1.5;
  }
  .page { max-width: 820px; margin: 0 auto; padding: 28px 30px 40px; }

  /* En-tête agence */
  .header {
    display:flex; align-items:center; justify-content:space-between; gap:20px;
    background:#0F172A; color:#fff; border-radius:14px; padding:20px 24px;
  }
  .brand { display:flex; align-items:center; gap:14px; }
  .logo { width:56px; height:56px; border-radius:12px; object-fit:cover; background:#fff; }
  .logo-fallback {
    display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,#DC2626,#B91C1C); color:#fff;
    font-size:26px; font-weight:900; font-style:italic;
  }
  .brand h1 { font-size:20px; font-weight:900; letter-spacing:-0.4px; }
  .brand p { font-size:10.5px; color:rgba(255,255,255,0.65); margin-top:2px; }
  .doc-title { text-align:${isFr ? 'right' : 'left'}; }
  .doc-title .kicker {
    display:inline-block; background:#DC2626; color:#fff; border-radius:999px;
    padding:4px 12px; font-size:9.5px; font-weight:800; letter-spacing:1.4px; text-transform:uppercase;
  }
  .doc-title h2 { font-size:17px; font-weight:900; margin-top:8px; }
  .doc-title .period { font-size:11px; color:rgba(255,255,255,0.7); margin-top:2px; }

  /* Blocs d'identité */
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:18px; }
  .card { border:1px solid #E2E8F0; border-radius:12px; padding:14px 16px; }
  .card h3 {
    font-size:9.5px; font-weight:900; text-transform:uppercase; letter-spacing:1.4px;
    color:#DC2626; margin-bottom:9px; padding-bottom:7px; border-bottom:1px solid #E2E8F0;
  }
  .row { display:flex; justify-content:space-between; gap:12px; padding:3px 0; }
  .row .k { color:#64748B; font-size:11px; }
  .row .v { font-weight:700; font-size:11.5px; text-align:${isFr ? 'right' : 'left'}; }

  /* Synthèse */
  .totals { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:18px; }
  .total-box { border:1px solid #E2E8F0; border-radius:12px; padding:14px; text-align:center; }
  .total-box .label {
    font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:1.3px; color:#64748B;
  }
  .total-box .value { font-size:19px; font-weight:900; margin-top:5px; }
  .total-box.collected .value { color:#0284C7; }
  .total-box.spent .value { color:#DC2626; }
  .total-box.owner { background:#0F172A; border-color:#0F172A; }
  .total-box.owner .label { color:rgba(255,255,255,0.6); }
  .total-box.owner .value { color:#fff; }

  /* Tables */
  section { margin-top:22px; page-break-inside:auto; }
  section > h3 {
    font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:1.4px;
    color:#0F172A; margin-bottom:9px; display:flex; align-items:center; gap:8px;
  }
  section > h3::before { content:''; width:4px; height:14px; border-radius:2px; background:#DC2626; }
  table { width:100%; border-collapse:collapse; }
  thead th {
    background:#F8FAFC; color:#64748B; font-size:9px; font-weight:900;
    text-transform:uppercase; letter-spacing:1px; padding:9px 10px;
    text-align:${isFr ? 'left' : 'right'}; border-bottom:1.5px solid #E2E8F0;
  }
  tbody td { padding:9px 10px; border-bottom:1px solid #F1F5F9; font-size:11.5px; }
  tbody tr:nth-child(even) td { background:#FCFDFE; }
  .right { text-align:${isFr ? 'right' : 'left'}; }
  .center { text-align:center; }
  .strong { font-weight:800; }
  .negative { color:#DC2626; }
  .empty { text-align:center; color:#94A3B8; font-style:italic; padding:16px; }
  tfoot td {
    padding:10px; font-weight:900; font-size:12px;
    border-top:1.5px solid #0F172A; background:#F8FAFC;
  }

  /* Bandeau final */
  .payout {
    margin-top:24px; border-radius:14px; background:#0F172A; color:#fff;
    padding:18px 24px; display:flex; align-items:center; justify-content:space-between;
  }
  .payout .label { font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:1.6px; }
  .payout .amount { font-size:26px; font-weight:900; }

  .signatures { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:34px; }
  .sig { border-top:1px solid #CBD5E1; padding-top:8px; font-size:10.5px; color:#64748B; text-align:center; }

  footer {
    margin-top:26px; padding-top:12px; border-top:1px solid #E2E8F0;
    font-size:9.5px; color:#94A3B8; display:flex; justify-content:space-between;
  }

  @media print {
    @page { size:A4; margin:10mm; }
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { padding:0; max-width:none; }
    section { page-break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="brand">
      ${logo}
      <div>
        <h1>${esc(agencySettings?.name || agencySettings?.agencyName || 'MHD AUTO')}</h1>
        <p>${esc(agencySettings?.address || '')}${agencySettings?.phone ? ' · ' + esc(agencySettings.phone) : ''}</p>
        ${agencySettings?.email ? `<p>${esc(agencySettings.email)}</p>` : ''}
      </div>
    </div>
    <div class="doc-title">
      <span class="kicker">${T('Rapport propriétaire', 'تقرير المالك')}</span>
      <h2>${esc(car.brand)} ${esc(car.model)}</h2>
      <p class="period">${T('Période', 'الفترة')} : ${esc(fmtD(startDate))} → ${esc(fmtD(endDate))}</p>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <h3>${T('Véhicule', 'المركبة')}</h3>
      <div class="row"><span class="k">${T('Marque / Modèle', 'الماركة / الموديل')}</span><span class="v">${esc(car.brand)} ${esc(car.model)}</span></div>
      <div class="row"><span class="k">${T('Immatriculation', 'رقم التسجيل')}</span><span class="v">${esc(car.registration)}</span></div>
      <div class="row"><span class="k">${T('Année', 'السنة')}</span><span class="v">${esc(car.year)}</span></div>
      <div class="row"><span class="k">${T('Couleur', 'اللون')}</span><span class="v">${esc(car.color || '—')}</span></div>
      <div class="row"><span class="k">${T('Énergie', 'الوقود')}</span><span class="v">${esc(car.energy || '—')}</span></div>
      <div class="row"><span class="k">${T('Kilométrage', 'العداد')}</span><span class="v">${esc((car.mileage || 0).toLocaleString('fr-DZ'))} km</span></div>
    </div>
    <div class="card">
      <h3>${T('Propriétaire', 'المالك')}</h3>
      <div class="row"><span class="k">${T('Nom', 'الاسم')}</span><span class="v">${esc(car.ownerName || '—')}</span></div>
      <div class="row"><span class="k">${T('Téléphone', 'الهاتف')}</span><span class="v">${esc(car.ownerPhone || '—')}</span></div>
      <div class="row"><span class="k">${T('Période du rapport', 'فترة التقرير')}</span><span class="v">${esc(fmtD(startDate))} → ${esc(fmtD(endDate))}</span></div>
      <div class="row"><span class="k">${T('Locations', 'الإيجارات')}</span><span class="v">${activeRes.length}</span></div>
      <div class="row"><span class="k">${T('Jours loués', 'أيام التأجير')}</span><span class="v">${rentedDays}</span></div>
      <div class="row"><span class="k">${T('Édité le', 'حرر في')}</span><span class="v">${esc(new Date().toLocaleDateString(isFr ? 'fr-FR' : 'ar-DZ'))}</span></div>
    </div>
  </div>

  <div class="totals">
    <div class="total-box collected">
      <div class="label">${T('Recettes encaissées', 'الإيرادات المحصلة')}</div>
      <div class="value">${esc(fmt(totalCollected))}</div>
    </div>
    <div class="total-box spent">
      <div class="label">${T('Dépenses véhicule', 'مصاريف المركبة')}</div>
      <div class="value">− ${esc(fmt(totalExpenses))}</div>
    </div>
    <div class="total-box owner">
      <div class="label">${T('Bénéfice propriétaire', 'ربح المالك')}</div>
      <div class="value">${esc(fmt(ownerBenefit))}</div>
    </div>
  </div>

  <section>
    <h3>${T('Liste des locations', 'قائمة الإيجارات')}</h3>
    <table>
      <thead>
        <tr>
          <th>${T('Départ', 'المغادرة')}</th>
          <th>${T('Retour', 'العودة')}</th>
          <th class="center">${T('Jours', 'أيام')}</th>
          <th>${T('Client', 'العميل')}</th>
          <th class="right">${T('Encaissé', 'المحصل')}</th>
        </tr>
      </thead>
      <tbody>${rentalRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4">${T('Total encaissé', 'إجمالي المحصل')}</td>
          <td class="right">${esc(fmt(totalCollected))}</td>
        </tr>
      </tfoot>
    </table>
  </section>

  <section>
    <h3>${T('Liste des dépenses', 'قائمة المصاريف')}</h3>
    <table>
      <thead>
        <tr>
          <th>${T('Date', 'التاريخ')}</th>
          <th>${T('Intitulé', 'البيان')}</th>
          <th>${T('Note', 'ملاحظة')}</th>
          <th class="right">${T('Montant', 'المبلغ')}</th>
        </tr>
      </thead>
      <tbody>${expenseRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3">${T('Total des dépenses', 'إجمالي المصاريف')}</td>
          <td class="right negative">− ${esc(fmt(totalExpenses))}</td>
        </tr>
      </tfoot>
    </table>
  </section>

  <div class="payout">
    <span class="label">${T('Montant revenant au propriétaire', 'المبلغ العائد للمالك')}</span>
    <span class="amount">${esc(fmt(ownerBenefit))}</span>
  </div>

  <div class="signatures">
    <div class="sig">${T("Signature de l'agence", 'توقيع الوكالة')}</div>
    <div class="sig">${T('Signature du propriétaire', 'توقيع المالك')}</div>
  </div>

  <footer>
    <span>${esc(agencySettings?.name || 'MHD AUTO')} — ${T('Rapport propriétaire', 'تقرير المالك')}</span>
    <span>${esc(new Date().toLocaleString(isFr ? 'fr-FR' : 'ar-DZ'))}</span>
  </footer>

</div>
</body>
</html>`;
};
