/**
 * Conditions Templates - Arabic and French
 * Used for printing rental conditions without database connection
 * Language: Both Arabic (RTL) and French (LTR)
 */

export interface ConditionItem {
  title: string;
  content: string;
}

export interface ConditionsTemplate {
  language: 'ar' | 'fr';
  title: string;
  subtitle: string;
  conditions: ConditionItem[];
  clientSignatureLabel: string;
  agencySignatureLabel: string;
}

/**
 * ARABIC CONDITIONS TEMPLATE
 * Complete rental agreement conditions in Arabic
 */
export const ARABIC_CONDITIONS_TEMPLATE: ConditionsTemplate = {
  language: 'ar',
  title: 'شروط الإيجار',
  subtitle: 'يمكنك قراءة شروط العقد في الأسفل ومصادقة عليها',
  conditions: [
    {
      title: 'السن',
      content: 'يجب أن يكون السائق يبلغ من العمر 20 عامًا على الأقل، وأن يكون حاصلًا على رخصة قيادة منذ سنتين على الأقل'
    },
    {
      title: 'جواز السفر',
      content: 'إيداع جواز السفر البيومتري إلزامي، بالإضافة إلى دفع تأمين ابتدائي يبدأ من 30.000,00 دج حسب فئة المركبة، ويُعدّ هذا بمثابة ضمان تطلبه'
    },
    {
      title: 'الوقود',
      content: 'الوقود يكون على نفقة الزبون'
    },
    {
      title: 'قانون ونظام',
      content: 'يتم الدفع نقدًا عند تسليم السيارة'
    },
    {
      title: 'النظافة',
      content: 'تسلم السيارة نظيفة ويجب إرجاعها في نفس الحالة، وفي حال عدم ذلك، سيتم احتساب تكلفة الغسيل بمبلغ 1000 دج'
    },
    {
      title: 'مكان التسليم',
      content: 'يتم تسليم السيارات في موقف السيارات التابع لوكالاتنا'
    },
    {
      title: 'جدول المواعيد',
      content: 'يجب على الزبون احترام المواعيد المحددة عند الحجز. يجب الإبلاغ مسبقًا عن أي تغيير. لا يمكن للزبون تمديد مدة الإيجار إلا بعد الحصول على إذن من وكالتنا للإيجار، وذلك بإشعار مسبق لا يقل عن 48 ساعة'
    },
    {
      title: 'الأضرار والخسائر',
      content: 'في حالة السرقة أو تضرر المركبة، يجب تقديم تصريح لدى مصالح الشرطة أو الدرك الوطني. قبل أي تصريح، يجب على الزبون إبلاغ وكالة الكراء بشكل إلزامي'
    },
    {
      title: 'حد السرقة',
      content: 'في حالة السرقة أو تضرر المركبة، يجب تقديم تصريح لدى مصالح الشرطة أو الدرك الوطني. قبل أي تصريح، يجب على الزبون إبلاغ وكالة الكراء بشكل إلزامي'
    },
    {
      title: 'تأمين',
      content: 'يستفيد من التأمين فقط السائقون المذكورون في عقد الكراء. يُمنع منعًا باتًّا إعارة أو تأجير المركبة من الباطن. وتكون جميع الأضرار الناتجة عن مثل هذه الحالات على عاتق الزبون بالكامل'
    },
    {
      title: 'عطل ميكانيكي',
      content: 'خلال فترة الإيجار، وبناء على عدد الكيلومترات المقطوعة، يجب على الزبون إجراء الفحوصات اللازمة مثل مستوى الزيت، حالة المحرك، ضغط الإطارات، وغيرها. في حال حدوث عطل ميكانيكي بسبب إهمال الزبون في إجراء هذه الفحوصات أو لأي سبب آخر ناتج عن مسؤولية الزبون (مثلاً: كسر حوض الزيت، العارضة السفلية، القفل أو غيرها)، فإن تكاليف الإصلاح والصيانة تكون على عاتق الزبون بالكامل'
    },
    {
      title: 'خسائر إضافية',
      content: 'الأضرار التي تلحق بالعجلات والإطارات، القيادة بالإطارات المفرغة من الهواء، التدهور، السرقة، نهب الملحقات، أعمال التخريب، الأضرار الميكانيكية الناتجة عن سوء استخدام المركبة، المخالفات المرورية، الأضرار التي تحدث أسفل المركبة (الصدام الأمامي، الجوانب، حوض الزيت، العادم) والأضرار الناتجة عن الاضطرابات والشغب، كلها سيتم تحميل تكلفتها على الزبون'
    },
    {
      title: 'ضريبة التأخر',
      content: 'مدة الإيجار تُحتسب على فترات كاملة مدتها 24 ساعة غير قابلة للتقسيم، ابتداءً من وقت حجز المركبة وحتى الوقت المذكور في العقد. يجب على الزبون إعادة المركبة في نفس الوقت، وإلا سيتم احتساب تكلفة تأخير مقدارها 800 دينار لكل ساعة تأخير'
    },
    {
      title: 'عدد الأميال',
      content: 'عدد الكيلومترات محدود لجميع مركباتنا بـ 300 كم يوميًا، ويُفرض غرامة قدرها 30 دج عن كل كيلومتر زائد'
    },
    {
      title: 'شروط',
      content: 'يُقرّ الزبون بأنه اطّلع على شروط الإيجار هذه وقبلها دون أي تحفظ، ويتعهد بتوقيع هذا العقد'
    }
  ],
  clientSignatureLabel: 'امضاء وبصمة الزبون',
  agencySignatureLabel: 'امضاء صاحب وكالة'
};

/**
 * FRENCH CONDITIONS TEMPLATE
 * Complete rental agreement conditions in French
 */
export const FRENCH_CONDITIONS_TEMPLATE: ConditionsTemplate = {
  language: 'fr',
  title: 'Les Conditions Générales de location véhicule',
  subtitle: 'Vous pouvez lire les conditions de location, elles apparaîtront sur le contra de location',
  conditions: [
    {
      title: 'Age',
      content: 'Le conducteur doit être âgé au minimum de 20 ans et être titulaire d\'un permis de conduire d\'au moins 2 ans.'
    },
    {
      title: 'Passeport',
      content: 'Dépôt obligatoire du passeport biométrique et le consionnement a partir de 30.000,00Da selon la catégorie du vhécule qui constitue une garantie que nous de mandons.'
    },
    {
      title: 'Carburant',
      content: 'Le carburant est à la charge du client.'
    },
    {
      title: 'Règlement',
      content: 'Le paiement se fait à la livraison de la voiture en espèces.'
    },
    {
      title: 'Propreté',
      content: 'Le véhicule est livré propre et doit être restitué dans le même état, faute de quoi le lavage sera facturé au prix de 1000 Da.'
    },
    {
      title: 'Lieux de livraisons',
      content: 'La livraison des voitures s\'effectue sur le parking de nos agences.'
    },
    {
      title: 'Horaire',
      content: 'Le client doit respecter les horaires établit à la réservation. Tout changement doit être signalé à l\'avance. Le client ne peut prolonger sa location que sur autorisation de notre agence location avec un préavis de 48 heures.'
    },
    {
      title: 'Cas de sinistre',
      content: 'Assurance de base : Le client s\'engage à payer tout dégât occasionné sur le véhicule qu\'il soit fautif ou non fautif. Toutes dégats sur le véhicule feras l\'objet d\'un ponctionnement sur la contion de garantie'
    },
    {
      title: 'Cas de vol',
      content: 'Avant toute déclaration au préalable le client doit obligatoirement informé l\'agence de location Le vol ou la dégradation du véhicule doivent faire lobjet d\'une déclaration auprès des services de police ou de la gendarmerie.'
    },
    {
      title: 'Assurances',
      content: 'Seuls les conducteurs mentionnés sur le contrat de location bénéficient de l\'assurance. Le prêt et la sous-location du véhicule sont strictement interdits. L\'intégralité des dommages survenus dans ces circonstances est à la charge du client.'
    },
    {
      title: 'Panne mécanique',
      content: 'Au cours de la location en fonction du kilométrage parcourus le client doit effectuer les contrôles d\'usage (niveau d\'huile, moteur, pression des pneus, etc....). En cas de panne mécanique due à la négligence du client pour ne pas avoir effectué les contrôles d\'usage ou pour tout autre raisons due à la responsabilité du client (ex: casse carter d\'huile, triangle inférieur, serrure ou autres etc.), la prise en charge du dépannage et de la réparation sont à la charge totale du client.'
    },
    {
      title: 'Dégâts supplémentaire',
      content: 'Les dégâts aux jantes et pneumatiques, le roulage à plat des pneumatiques, la détérioration, les vols, les pillages d\'accessoires, les actes de vandalisme, les dégâts mécaniques dus à une mauvaise utilisation du véhicule, les procès verbaux, les dégâts survenus en dessous du véhicule (jupe, bas de caisse, carter d\'huile, échappement) et les dommages causés par les troubles et émeutes seront facturés au client.'
    },
    {
      title: 'Pénalité de retard',
      content: 'La durée de location se calcul par tranche de 24 heure non fractionnable depuis l\'heure de la réservation du véhicule et l\'heure mentionnée sur le contrat. Le client doit restituer le véhicule à la même heure autrement chaque heure de retard sera facturée au prix de 800 dinars/heure.'
    },
    {
      title: 'Kilométrage',
      content: 'Le kilométrage est limité pour tous nos véhicules a 300Km/Jour.'
    },
    {
      title: 'Acceptation',
      content: 'Le client déclare avoir pris connaissance et accepter sans réserve les présentes conditions de location.et s engage a signé ce contrat.'
    }
  ],
  clientSignatureLabel: 'Signature et empreinte du client',
  agencySignatureLabel: 'Signature et scellés de l\'Agence'
};

/**
 * Get conditions template by language
 */
export const getConditionsTemplate = (language: 'ar' | 'fr'): ConditionsTemplate => {
  return language === 'ar' ? ARABIC_CONDITIONS_TEMPLATE : FRENCH_CONDITIONS_TEMPLATE;
};

/**
 * Generate HTML content for printing conditions.
 * Pixel-matches the ConditionsPersonalizer modal UI exactly:
 *   - Blue gradient header  : linear-gradient(135deg, #003399 → #0047b2)
 *   - Title                 : 24px / 800
 *   - Subtitle              : 14px italic
 *   - Condition font        : 14px / 1.7  (bold #003399 prefix)
 *   - Row divider           : 1px solid #eef0f7, padding 10px 0
 *   - Acceptance box        : bg #f0f4ff, border #b8ccee, 13.5px / 600
 *   - Signature label       : 13px / 700 / #003399
 *   - Signature line height : 50px, bg #f8faff
 *   - Side padding          : 56px (matches card padding 44px 56px)
 *   - Page border           : 2px solid #003399
 */
export const generateConditionsPrintHTML = (language: 'ar' | 'fr'): string => {
  const template = getConditionsTemplate(language);
  const isArabic = language === 'ar';
  const dir = isArabic ? 'rtl' : 'ltr';
  const textAlign = isArabic ? 'right' : 'left';

  const conditionsHTML = template.conditions
    .map(
      (condition, index) => `
      <div class="condition-item">
        <p class="condition-text">
          <span class="condition-title">${index + 1}- ${condition.title} </span>${condition.content}
        </p>
      </div>`
    )
    .join('');

  const acceptanceText = isArabic
    ? 'يُقرّ المستأجر بأنه اطّلع على شروط الإيجار هذه وقبلها دون أي تحفظ، ويتعهد بتوقيع هذا العقد.'
    : "Le client déclare avoir pris connaissance et accepter sans réserve les présentes conditions de location et s'engage à signer ce contrat.";

  const printDate = new Date().toLocaleDateString(isArabic ? 'en-US' : 'fr-FR');

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${language}">
<head>
  <meta charset="utf-8">
  <title>${template.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      width: 794px;
      margin: 0;
      padding: 0;
      background: white;
    }

    body {
      font-family: 'Arial', 'Helvetica Neue', sans-serif;
      color: #222;
      direction: ${dir};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── PAGE ── */
    .page {
      width: 794px;
      min-height: 1123px;
      padding-bottom: 30px;
      display: flex;
      flex-direction: column;
      background: white;
      border: 2px solid #003399;
    }

    /* ── HEADER (÷1.2) ── */
    .header {
      background: linear-gradient(135deg, #003399 0%, #0047b2 100%);
      color: white;
      padding: 18px 47px 15px;
      text-align: center;
      flex-shrink: 0;
    }

    .header h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 7px;
      letter-spacing: 0.3px;
    }

    .header p {
      font-size: 11.5px;
      margin: 0;
      opacity: 0.88;
      font-style: italic;
      color: rgba(255,255,255,0.88);
    }

    /* ── CONTENT (÷1.2) ── */
    .content {
      flex: 1;
      padding: 15px 47px 0;
    }

    /* ── CONDITION ROWS (÷1.2) ── */
    .condition-item {
      padding: 8px 0;
      border-bottom: 1px solid #eef0f7;
    }
    .condition-item:last-child { border-bottom: none; }

    .condition-text {
      font-size: 11.5px;
      color: #222;
      line-height: 1.55;
      margin: 0;
      text-align: ${textAlign};
    }

    .condition-title {
      font-weight: 700;
      color: #003399;
    }

    /* ── ACCEPTANCE (÷1.2) ── */
    .acceptance {
      margin: 17px 47px 0;
      padding: 8px 12px;
      background: #f0f4ff;
      border-radius: 5px;
      border: 1px solid #b8ccee;
      font-size: 11px;
      color: #003399;
      font-weight: 600;
      text-align: ${textAlign};
    }

    /* ── SIGNATURES (÷1.2) ── */
    .signatures-section {
      margin: 23px 47px 0;
      padding-top: 15px;
      border-top: 2px solid #003399;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 27px;
    }

    .signature-block { text-align: center; }

    .signature-line {
      border-top: 2px solid #003399;
      height: 42px;
      margin-bottom: 8px;
      background: #f8faff;
      border-radius: 4px 4px 0 0;
    }

    .signature-label {
      font-size: 11px;
      font-weight: 700;
      color: #003399;
      letter-spacing: 0.2px;
    }

    .print-date {
      text-align: center;
      font-size: 9px;
      color: #888;
      margin: 13px 47px 0;
      padding-top: 10px;
      border-top: 1px solid #dde3f5;
    }

    @media print {
      @page { size: A4; margin: 0; }
      html, body { width: 794px; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">

    <div class="header">
      <h1>${template.title}</h1>
      <p>${template.subtitle}</p>
    </div>

    <div class="content">
      ${conditionsHTML}
    </div>

    <div class="acceptance">
      ${acceptanceText}
    </div>

    <div class="signatures-section">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">🏢 ${template.agencySignatureLabel}</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">✍️ ${template.clientSignatureLabel}</div>
      </div>
    </div>

    <div class="print-date">
      ${isArabic ? 'التاريخ: ' : 'Date: '}${printDate}
    </div>

  </div>
</body>
</html>`;
};
