import React, { useState, useRef, useEffect } from 'react';
import { ProtectionAssuranceCards } from './website/wizard/StepAssurance';
import { WorkerCommissionSection } from './WorkerCommissionSection';
import { WorkerCommissionService } from '../services/workerCommissionService';
import { Language, ReservationDetails, Client, Car, VehicleInspection, Payment, AdditionalService, ProtectionAssurance } from '../types';
import {
  WEEK_DAYS, MONTH_DAYS,
  computeRentalBase, weekDayRate, monthDayRate, weekTotal, monthTotal,
} from '../utils/pricing';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Calendar, Clock, MapPin, Car as CarIcon, User, CreditCard, CheckCircle, Plus, Search, X, Camera, Fuel, AlertTriangle, Check, Upload, PenTool } from 'lucide-react';
import { AGENCIES, CAR_IMAGES } from '../constants';
import { DatabaseService } from '../services/DatabaseService';
import { ReservationsService } from '../services/ReservationsService';
import { uploadInspectionImage } from '../services/uploadInspectionImage';
import { ClientModal } from './ClientModal';
import { supabase } from '../supabase';
import {
  InspectionChecklist, ChecklistItemComposer, InspectionPhotoUploader,
  FuelLevelPicker, InspectionPhoto,
} from './InspectionChecklist';
import { computeTimbre, timbreLabel } from '../utils/currency';

// Signature Pad Component
const SignaturePad: React.FC<{
  lang: Language;
  onSignatureChange: (signature: string) => void;
  initialSignature?: string;
}> = ({ lang, onSignatureChange, initialSignature }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSignatureChange(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange('');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Set drawing properties
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If there is an initial signature, draw it onto the canvas
    if (initialSignature) {
      const img = new Image();
      // allow loading from storage URL (CORS) if possible
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
        onSignatureChange(initialSignature);
      };
      img.src = initialSignature;
    } else {
      // clear if no initial signature
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  }, [initialSignature]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full aspect-square border border-purple-300 rounded-lg cursor-crosshair bg-white"
          style={{ touchAction: 'none' }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-purple-400">
              <PenTool className="w-4 h-4 mx-auto mb-1" />
              <p className="text-xs font-bold">
                {lang === 'fr' ? 'Signez ici' : 'وقع هنا'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-purple-700 font-bold">
          {lang === 'fr' ? 'Signature numérique' : 'التوقيع الرقمي'}
        </p>
        <button
          onClick={clearSignature}
          className="text-red-600 hover:text-red-800 font-bold text-xs underline"
        >
          {lang === 'fr' ? 'Effacer' : 'مسح'}
        </button>
      </div>
    </div>
  );
};

interface CreateReservationFormProps {
  lang: Language;
  onBack: () => void;
  inspectionMode?: boolean;
  initialData?: Partial<ReservationDetails>;
  defaultStatus?: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  user?: any;
  // Alternative step order:
  // 1) Dates & Lieux  2) Véhicule  3) Tarification Finale (sans infos client)
  // 4) Client  5) Services  6) Inspection Départ (+ création)
  altFlow?: boolean;
}

export const CreateReservationForm: React.FC<CreateReservationFormProps> = ({ lang, onBack, inspectionMode = false, initialData, defaultStatus = 'pending', user, altFlow = false }) => {
  const [currentStep, setCurrentStep] = useState(inspectionMode ? 3 : 1);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [isLoadingAgencies, setIsLoadingAgencies] = useState(true);

  // Load agencies from database on component mount
  useEffect(() => {
    const loadAgencies = async () => {
      try {
        setIsLoadingAgencies(true);
        const data = await DatabaseService.getAgencies();
        setAgencies(data || []);
      } catch (err) {
        console.error('Error loading agencies:', err);
        // Fallback to constants if database fails
        setAgencies(AGENCIES);
      } finally {
        setIsLoadingAgencies(false);
      }
    };

    loadAgencies();
  }, []);

  // When in inspection mode with initialData, map additionalServices and other data to step5
  useEffect(() => {
    if (inspectionMode && initialData) {
      const services = (initialData as any).additionalServices;
      const updates: any = {};
      // Auto-select services
      if (services && services.length > 0 && !formData.step5?.additionalServices?.length) {
        updates.step5 = {
          additionalServices: services
        };
      }
      // Auto-select locations from step1
      if (!formData.step1?.departureLocation) {
        // First try to get from step1, then try direct properties
        const departureLocation = (initialData as any).step1?.departureLocation || (initialData as any).departureLocation || '';
        const returnLocation = (initialData as any).step1?.returnLocation || (initialData as any).returnLocation || departureLocation;
        const departureDate = (initialData as any).step1?.departureDate || (initialData as any).departureDate || formData.step1?.departureDate;
        const returnDate = (initialData as any).step1?.returnDate || (initialData as any).returnDate || formData.step1?.returnDate;
        const departureTime = (initialData as any).step1?.departureTime || (initialData as any).departureTime || '';
        const returnTime = (initialData as any).step1?.returnTime || (initialData as any).returnTime || '';
        
        updates.step1 = {
          ...(formData.step1 || {}),
          departureLocation,
          returnLocation,
          departureDate,
          returnDate,
          departureTime,
          returnTime,
          departureAgency: (initialData as any).step1?.departureAgency,
          returnAgency: (initialData as any).step1?.returnAgency
        };
      }
      // Auto-select car
      if (!formData.step2?.selectedCar && (initialData as any).car) {
        updates.step2 = {
          selectedCar: (initialData as any).car
        };
      }
      // Auto-select client
      if (!formData.step4?.selectedClient && (initialData as any).client) {
        updates.step4 = {
          selectedClient: (initialData as any).client
        };
      }
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({
          ...prev,
          ...updates
        }));
      }
    }
  }, [inspectionMode, initialData]);

  const [formData, setFormData] = useState<Partial<ReservationDetails>>(initialData || {
    step1: {
      departureDate: '',
      departureTime: '',
      returnDate: '',
      returnTime: '',
      departureLocation: '',
      returnLocation: ''
    },
    step2: {
      selectedCar: null
    },
    step3: {
      departureInspection: null
    },
    step4: {
      selectedClient: null
    },
    step5: {
      additionalServices: []
    },
    step6: {
      pricing: {
        basePrice: 0,
        additionalFees: 0,
        totalPrice: 0,
        advancePayment: 0,
        remainingPayment: 0,
        deposit: 0
      }
    }
  });

  const totalSteps = 7;
  const steps = altFlow ? [
    { id: 1, title: lang === 'fr' ? 'Dates & Lieux' : 'التواريخ والأماكن', icon: '📅' },
    { id: 2, title: lang === 'fr' ? 'Sélection Véhicule' : 'اختيار المركبة', icon: '🚗' },
    { id: 3, title: lang === 'fr' ? 'Tarification Finale' : 'التسعير النهائي', icon: '💰' },
    { id: 4, title: lang === 'fr' ? 'Client' : 'العميل', icon: '👤' },
    { id: 5, title: lang === 'fr' ? 'Assurance de Protection' : 'تأمين الحماية', icon: '🛡️' },
    { id: 6, title: lang === 'fr' ? 'Services Supplémentaires' : 'الخدمات الإضافية', icon: '🛠️' },
    { id: 7, title: lang === 'fr' ? 'Inspection Départ' : 'فحص المغادرة', icon: '🔍' }
  ] : [
    { id: 1, title: lang === 'fr' ? 'Dates & Lieux' : 'التواريخ والأماكن', icon: '📅' },
    { id: 2, title: lang === 'fr' ? 'Sélection Véhicule' : 'اختيار المركبة', icon: '🚗' },
    { id: 3, title: lang === 'fr' ? 'Inspection Départ' : 'فحص المغادرة', icon: '🔍' },
    { id: 4, title: lang === 'fr' ? 'Client' : 'العميل', icon: '👤' },
    { id: 5, title: lang === 'fr' ? 'Assurance de Protection' : 'تأمين الحماية', icon: '🛡️' },
    { id: 6, title: lang === 'fr' ? 'Services Supplémentaires' : 'الخدمات الإضافية', icon: '🛠️' },
    { id: 7, title: lang === 'fr' ? 'Tarification Finale' : 'التسعير النهائي', icon: '💰' }
  ];

  const handleNext = () => {
    if (inspectionMode && currentStep === 3) {
      // In inspection mode: step 3 (inspection) -> step 6 (services), skip client & assurance
      setCurrentStep(6);
    } else if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (inspectionMode && currentStep === 6) {
      // Go back to step 3 (inspection) when in inspection mode from services
      setCurrentStep(3);
    } else if (inspectionMode && currentStep === 7) {
      // Go back to step 6 (services) from pricing in inspection mode
      setCurrentStep(6);
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      // Find agency IDs
      const departureAgency = agencies.find(a => a.name === formData.step1?.departureLocation || a.address === formData.step1?.departureLocation);
      const returnAgency = agencies.find(a => a.name === formData.step1?.returnLocation || a.address === formData.step1?.returnLocation) || departureAgency;

      // Skip agency validation if inspectionMode (for both pending and accepted reservations)
      if (!(inspectionMode && initialData)) {
        if (!departureAgency || !returnAgency) {
          alert(lang === 'fr' ? 'Agence introuvable' : 'الوكالة غير موجودة');
          return;
        }
      }

      // Calculate total days
      const totalDays = Math.ceil((new Date(formData.step1.returnDate).getTime() - new Date(formData.step1.departureDate).getTime()) / (1000 * 60 * 60 * 24));

      // Calculate total price
      const step6 = formData.step6 || {};
      const totalPrice = step6.totalPrice || 0;
      const advancePayment = step6.advancePayment || 0;
      const remainingPayment = Math.max(0, totalPrice - advancePayment);

      // Timbre fiscal (droit de timbre) éventuellement activé à la dernière étape
      const timbreEnabled = !!(step6 as any).timbreEnabled;
      const timbreRate = timbreEnabled ? ((step6 as any).timbreRate ?? null) : null;
      const timbreAmount = timbreEnabled ? ((step6 as any).timbreAmount ?? 0) : 0;

      // Statut de création : si l'agent a renseigné quoi que ce soit dans
      // l'étape « Inspection Départ » (check-list, kilométrage, carburant,
      // lieu, note, photo, signature), la réservation part directement en
      // « confirmed ». Sinon elle reste « pending ».
      const inspectionTouched = !!(formData as any).inspectionTouched;
      const creationStatus: 'pending' | 'confirmed' = inspectionTouched ? 'confirmed' : 'pending';

      // Create reservation using ReservationsService
      // Skip client/car validation if inspectionMode (for both pending and accepted reservations)
      if (!(inspectionMode && initialData)) {
        if (!formData.step4?.selectedClient?.id || !formData.step2?.selectedCar?.id || !departureAgency?.id || !returnAgency?.id) {
          alert(lang === 'fr' ? 'Veuillez sélectionner un client, un véhicule et des agences valides.' : 'يرجى اختيار عميل ومركبة ووكالات صحيحة.');
          return;
        }
      }
      let clientId = formData.step4?.selectedClient?.id || '';
      let carId = formData.step2?.selectedCar?.id || '';
      let departureAgencyId = departureAgency?.id || '';
      let returnAgencyId = returnAgency?.id || '';
      if (inspectionMode && initialData) {
        clientId = (initialData as any)?.client?.id || '';
        carId = (initialData as any)?.car?.id || '';
        departureAgencyId = (initialData as any)?.departure_agency_id || (initialData as any)?.departureAgencyId || (initialData as any)?.step1?.departureAgency || '';
        returnAgencyId = (initialData as any)?.return_agency_id || (initialData as any)?.returnAgencyId || (initialData as any)?.step1?.returnAgency || '';
        // Block if any required UUID is missing
        if (!clientId || !carId || !departureAgencyId || !returnAgencyId) {
          alert(lang === 'fr' ? "Impossible de créer la réservation: données manquantes (client, véhicule ou agence)." : "لا يمكن إنشاء الحجز: بيانات مفقودة (عميل أو مركبة أو وكالة).");
          return;
        }
      }
      
      // Use appropriate function based on mode
      let reservationId: string;
      if (inspectionMode && initialData) {
        // Update existing reservation in inspection mode and change status to confirmed
        reservationId = (initialData as any).id;
        await ReservationsService.updateReservation(reservationId, {
          status: 'confirmed',
          notes: formData.step6?.notes || '',
          totalPrice: totalPrice,
          // Conserve le prix saisi manuellement + l'état de la caution
          isManualPrice: !!(step6 as any).isManualTotal,
          cautionEnabled: (step6 as any).cautionEnabled !== false,
          advancePayment: advancePayment,
          remainingPayment: remainingPayment,
          timbreEnabled,
          timbreRate,
          timbreAmount,
        });
      } else {
        // Create new reservation
        // Déclaré hors du try : le bloc catch le journalise aussi.
        let workerFullName: string | null = null;
        try {
          // Fetch worker's full name from database using email
          if (user?.email) {
            try {
              console.log('🔍 Fetching worker by email:', user.email);
              
              const { data: workerData, error: workerError } = await supabase
                .from('workers')
                .select('full_name, email, username')
                .eq('email', user.email)
                .single();
              
              console.log('📦 Worker query result:', {
                data: workerData,
                error: workerError?.message
              });
              
              if (!workerError && workerData) {
                workerFullName = workerData.full_name;
                console.log('✅ Successfully fetched worker full_name:', workerFullName);
              } else {
                console.log('⚠️ Could not fetch worker:', workerError?.message);
                // Don't fall back to user.name (which might be email)
              }
            } catch (err: any) {
              console.error('❌ Error fetching worker:', err);
            }
          }
          
          console.log('Creating reservation with creator info:', {
            userEmail: user?.email,
            workerFullName: workerFullName
          });
          
          const result = await ReservationsService.createReservation({
            clientId,
            carId,
            departureDate: formData.step1?.departureDate || '',
            departureTime: formData.step1?.departureTime || '',
            departureAgencyId,
            returnDate: formData.step1?.returnDate || '',
            returnTime: formData.step1?.returnTime || '',
            returnAgencyId,
            pricePerDay: formData.step2?.selectedCar?.priceDay || 0,
            priceWeek: formData.step2?.selectedCar?.priceWeek || 0,
            priceMonth: formData.step2?.selectedCar?.priceMonth || 0,
            totalDays: totalDays,
            totalPrice: totalPrice,
            deposit: formData.step2?.selectedCar?.deposit || 0,
            advancePayment: advancePayment,
            remainingPayment: remainingPayment,
            // « confirmed » si l'inspection de départ a été renseignée,
            // « pending » si l'agent n'a rien touché sur cet écran.
            status: creationStatus,
            notes: formData.step6?.notes || '',
            // Timbre fiscal
            timbreEnabled,
            timbreRate,
            timbreAmount,
            // Caution and Assurance fields
            cautionAmountDzd: (formData.step6 as any)?.caution_amount_dzd || formData.step2?.selectedCar?.deposit || 0,
            cautionCurrency: (formData.step6 as any)?.cautionCurrency || 'DZD',
            cautionEnabled: (formData.step6 as any)?.cautionEnabled !== false,
            isManualPrice: !!(formData.step6 as any)?.isManualTotal,
            euroRate: (formData.step6 as any)?.euroRate || 145,
            assuranceEnabled: (formData.step6 as any)?.assuranceEnabled || false,
            assurancePercentage: (formData.step6 as any)?.assuranceEnabled
              ? (formData.step6 as any)?.assurancePercentage !== ''
                ? Number((formData.step6 as any)?.assurancePercentage)
                : 0
              : 0,
            // Assurance de protection sélectionnée (snapshot nom + prix/jour)
            protectionAssuranceId: formData.protectionAssurance?.id || null,
            protectionAssuranceName: formData.protectionAssurance?.name || null,
            protectionAssurancePrice: formData.protectionAssurance?.pricePerDay ?? null,
            // Creator info - Only save name since User object doesn't have ID
            createdBy: null,  // No user ID available in current auth system
            createdByName: workerFullName || null,
          });
          
          console.log('✅ Reservation created successfully with ID:', result.id);
          reservationId = result.id;
        } catch (creationError: any) {
          console.error('❌ Error creating reservation with creator info:', {
            error: creationError?.message,
            details: creationError,
            creatorData: {
              createdBy: null,
              createdByName: workerFullName
            }
          });
          throw creationError;
        }
      }

      // Commission employé (option de la dernière étape)
      const wc = (formData as any).workerCommission;
      if (!(inspectionMode && initialData) && wc?.enabled && wc.workerId && Number(wc.commissionValue) > 0) {
        try {
          const st6: any = formData.step6 || {};
          const base = Number(st6.finalTotal) || totalPrice;
          const client = formData.step4?.selectedClient as any;
          const car = formData.step2?.selectedCar as any;
          await WorkerCommissionService.createCommission({
            reservationId,
            workerId: wc.workerId,
            workerName: wc.workerName,
            commissionType: wc.commissionType,
            commissionValue: Number(wc.commissionValue),
            baseAmount: base,
            payoutMode: wc.payoutMode,
            note: wc.note,
            reservationLabel: [
              client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : '',
              car ? `${car.brand || ''} ${car.model || ''}`.trim() : '',
              `${formData.step1?.departureDate || ''} → ${formData.step1?.returnDate || ''}`,
            ].filter(Boolean).join(' · '),
          });
        } catch (commissionError: any) {
          console.error('❌ Error saving worker commission:', commissionError);
          alert(lang === 'fr'
            ? `Réservation créée, mais la commission employé n'a pas pu être enregistrée : ${commissionError?.message || ''}`
            : `تم إنشاء الحجز، لكن تعذر حفظ عمولة الموظف: ${commissionError?.message || ''}`);
        }
      }

      // Save selected services
      const selectedServices = formData.step5?.additionalServices || [];
      if (selectedServices.length > 0) {
        await ReservationsService.updateReservationServices(reservationId, selectedServices);
      }

      // Save departure inspection ONLY if the agent actually filled the
      // « Inspection de départ » screen. Le kilométrage est pré-rempli avec le
      // compteur du véhicule, ce qui écrivait auparavant une inspection fantôme
      // (et créait un enregistrement d'inspection) même pour une réservation
      // restée « en attente ». En mode inspection (activation d'une réservation
      // existante) on enregistre toujours.
      const shouldSaveInspection = inspectionTouched || (inspectionMode && !!initialData);
      const inspection = shouldSaveInspection ? formData.step3?.departureInspection : undefined;
      if (inspection) {
        try {
          // Determine agency_id: prefer explicit agency id from step1, else fallback to first agency
          const agencyId = formData.step1?.departureAgency || (agencies && agencies[0]?.id) || '';

          // Check if a departure inspection already exists for this reservation
          const existingDeparture = formData.departureInspection;
          if (existingDeparture && existingDeparture.id) {
            // Update existing inspection
            await DatabaseService.updateVehicleInspection(existingDeparture.id, {
              mileage: inspection.mileage || 0,
              fuel_level: inspection.fuelLevel || 'full',
              agency_id: agencyId,
              exterior_front_photo: inspection.exteriorPhotos?.[0] || null,
              exterior_rear_photo: inspection.exteriorPhotos?.[1] || null,
              interior_photo: inspection.interiorPhotos?.[0] || null,
              other_photos: inspection.other_photos || inspection.otherPhotos || [],
              client_signature: inspection.signature || inspection.client_signature || null,
              notes: inspection.notes || null,
              date: inspection.date || new Date().toISOString().split('T')[0],
              time: inspection.time || new Date().toTimeString().split(' ')[0]
            });

            // Save checklist responses for ALL items (store true/false)
            const responses = (inspection.inspectionItems || []).map((it: any) => ({
              inspection_id: existingDeparture.id,
              checklist_item_id: it.id,
              status: !!it.checked,
              note: it.note || null
            }));

            if (responses.length > 0) {
              await DatabaseService.upsertInspectionResponses(responses);
            }

            // Update car mileage
            if (inspection.mileage && inspection.mileage > 0) {
              await DatabaseService.updateCar(formData.step2.selectedCar.id, {
                mileage: inspection.mileage
              });
            }
          } else {
            // Create new inspection if none exists
            const createdInspection = await DatabaseService.createVehicleInspection({
              reservation_id: reservationId,
              type: 'departure',
              mileage: inspection.mileage || 0,
              fuel_level: inspection.fuelLevel || 'full',
              agency_id: agencyId,
              exterior_front_photo: inspection.exteriorPhotos?.[0] || null,
              exterior_rear_photo: inspection.exteriorPhotos?.[1] || null,
              interior_photo: inspection.interiorPhotos?.[0] || null,
              other_photos: inspection.other_photos || inspection.otherPhotos || [],
              client_signature: inspection.signature || inspection.client_signature || null,
              notes: inspection.notes || null,
              date: inspection.date || new Date().toISOString().split('T')[0],
              time: inspection.time || new Date().toTimeString().split(' ')[0]
            });

            // Save checklist responses for ALL items (store true/false)
            const responses = (inspection.inspectionItems || []).map((it: any) => ({
              inspection_id: createdInspection.id,
              checklist_item_id: it.id,
              status: !!it.checked,
              note: it.note || null
            }));

            if (responses.length > 0) {
              await DatabaseService.upsertInspectionResponses(responses);
            }

            // Update car mileage
            if (inspection.mileage && inspection.mileage > 0) {
              await DatabaseService.updateCar(formData.step2.selectedCar.id, {
                mileage: inspection.mileage
              });
            }
          }
        } catch (err) {
          console.error('Error saving inspection:', err);
        }
      }


      onBack();
    } catch (err: any) {
      console.error('❌ Error ' + (inspectionMode && initialData ? 'updating' : 'creating') + ' reservation:', {
        message: err?.message,
        error: err,
        stack: err?.stack
      });
      alert(lang === 'fr' ? `Erreur: ${err.message}` : `خطأ: ${err.message}`);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setFormData(prev => ({
          ...prev,
          step4: {
            ...prev.step4!,
            [field]: result
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white hover:text-blue-200 font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            {lang === 'fr' ? 'Retour' : 'العودة'}
          </button>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
              ➕ {lang === 'fr' ? 'Nouvelle Réservation' : 'حجز جديد'}
            </h2>
            <p className="text-white font-bold uppercase text-[10px] tracking-widest">
              {`${lang === 'fr' ? 'Étape' : 'الخطوة'} ${currentStep} ${lang === 'fr' ? 'sur' : 'من'} 6`}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          {steps.filter(step => !inspectionMode || [3, 5, 6].includes(step.id)).map((step) => (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 transition-colors ${
                step.id < currentStep ? 'bg-green-500 text-white' :
                step.id === currentStep ? 'bg-blue-500 text-white' :
                'bg-slate-200 text-slate-500'
              }`}>
                {step.id < currentStep ? <CheckCircle className="w-6 h-6" /> : step.icon}
              </div>
              <p className={`text-xs font-bold text-center ${
                step.id <= currentStep ? 'text-slate-900' : 'text-slate-500'
              }`}>
                {step.title}
              </p>
            </div>
          ))}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${inspectionMode ? (currentStep === 3 ? 33 : currentStep === 6 ? 66 : 100) : (currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-slate-200"
        >
          <div className="p-8">
            {altFlow ? (
              <>
                {/* Alternative order: Dates → Véhicule → Tarification (sans client) → Client → Assurance → Services → Inspection */}
                {currentStep === 1 && <Step1DatesLocations lang={lang} formData={formData} setFormData={setFormData} agencies={agencies} isLoadingAgencies={isLoadingAgencies} inspectionMode={inspectionMode} initialData={initialData} />}
                {currentStep === 2 && <Step2VehicleSelection lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 3 && <Step6FinalPricing lang={lang} formData={formData} setFormData={setFormData} inspectionMode={inspectionMode} initialData={initialData} agencies={agencies} hideClientInfo={true} />}
                {currentStep === 4 && <Step4ClientSelection lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 5 && <Step5ProtectionAssurance lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 6 && <Step5AdditionalServices lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 7 && <Step3DepartureInspection lang={lang} formData={formData} setFormData={setFormData} />}
              </>
            ) : (
              <>
                {currentStep === 1 && <Step1DatesLocations lang={lang} formData={formData} setFormData={setFormData} agencies={agencies} isLoadingAgencies={isLoadingAgencies} inspectionMode={inspectionMode} initialData={initialData} />}
                {currentStep === 2 && <Step2VehicleSelection lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 3 && <Step3DepartureInspection lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 4 && <Step4ClientSelection lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 5 && <Step5ProtectionAssurance lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 6 && <Step5AdditionalServices lang={lang} formData={formData} setFormData={setFormData} />}
                {currentStep === 7 && <Step6FinalPricing lang={lang} formData={formData} setFormData={setFormData} inspectionMode={inspectionMode} initialData={initialData} agencies={agencies} />}
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors ${
            currentStep === 1
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-slate-600 hover:bg-slate-700 text-white'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          {lang === 'fr' ? 'Précédent' : 'السابق'}
        </button>

        {currentStep < totalSteps ? (
          <button
            onClick={handleNext}
            className="btn-saas-primary"
          >
            {lang === 'fr' ? 'Suivant' : 'التالي'}
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="btn-saas-primary flex items-center gap-2"
          >
            ✅ {lang === 'fr' ? 'Créer Réservation' : 'إنشاء الحجز'}
          </button>
        )}
      </div>
    </div>
  );
};

// Step 1: Dates & Locations
export const Step1DatesLocations: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
  agencies: any[];
  isLoadingAgencies: boolean;
  inspectionMode?: boolean;
  initialData?: Partial<ReservationDetails>;
}> = ({ lang, formData, setFormData, agencies, isLoadingAgencies, inspectionMode = false, initialData }) => {
  const [showReturnLocation, setShowReturnLocation] = useState(false);

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-black text-slate-900">
        📅 {lang === 'fr' ? 'Dates et Lieux de Location' : 'تواريخ وأماكن التأجير'}
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Departure */}
        <div className="space-y-4">
          <h4 className="text-lg font-black text-green-700 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {lang === 'fr' ? 'Départ' : 'المغادرة'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-900 mb-2">
                📅 {lang === 'fr' ? 'Date' : 'التاريخ'}
              </label>
              <input
                type="date"
                value={formData.step1?.departureDate || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  step1: { ...prev.step1!, departureDate: e.target.value }
                }))}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-900 mb-2">
                🕐 {lang === 'fr' ? 'Heure' : 'الوقت'}
              </label>
              <input
                type="time"
                value={formData.step1?.departureTime || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  step1: { ...prev.step1!, departureTime: e.target.value }
                }))}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-900 mb-2">
              📍 {lang === 'fr' ? 'Lieu de Prise en Charge' : 'مكان الاستلام'}
            </label>
            {inspectionMode && initialData && initialData.status === 'accepted' ? (
              <div className="w-full p-3 border border-slate-200 rounded-lg bg-slate-100 text-lg font-bold text-slate-900">
                {(() => {
                  if (!agencies || agencies.length === 0) {
                    return 'Erreur: agences non chargées.';
                  }
                  let agencyId = initialData.departure_agency_id || initialData.departureAgencyId;
                  // Only fallback if agencyId is truly missing
                  if (!agencyId) {
                    if (initialData.client && (initialData.client.agencyId || initialData.client.agency_id)) {
                      agencyId = initialData.client.agencyId || initialData.client.agency_id;
                    } else if (formData.step4?.selectedClient && (formData.step4.selectedClient.agencyId || formData.step4.selectedClient.agency_id)) {
                      agencyId = formData.step4.selectedClient.agencyId || formData.step4.selectedClient.agency_id;
                    }
                  }
                  if (agencyId) {
                    const agency = agencies.find(a => a.id === agencyId);
                    return agency ? `${agency.name}${agency.address ? ' - ' + agency.address : ''}` : `Erreur: agence non trouvée (ID: ${agencyId})`;
                  }
                  return 'Erreur: ID agence non spécifié.';
                })()}
              </div>
            ) : (
              <select
                value={formData.step1?.departureLocation || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  step1: { ...prev.step1!, departureLocation: e.target.value }
                }))}
                disabled={isLoadingAgencies}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-100"
              >
                <option value="">{isLoadingAgencies ? (lang === 'fr' ? 'Chargement...' : 'جاري التحميل...') : (lang === 'fr' ? 'Sélectionner une agence...' : 'اختر وكالة...')}</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.name || agency.address}>
                    {agency.name} {agency.address ? `- ${agency.address}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Return */}
        <div className="space-y-4">
          <h4 className="text-lg font-black text-blue-700 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {lang === 'fr' ? 'Retour' : 'العودة'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-900 mb-2">
                📅 {lang === 'fr' ? 'Date' : 'التاريخ'}
              </label>
              <input
                type="date"
                value={formData.step1?.returnDate || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  step1: { ...prev.step1!, returnDate: e.target.value }
                }))}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-900 mb-2">
                🕐 {lang === 'fr' ? 'Heure' : 'الوقت'}
              </label>
              <input
                type="time"
                value={formData.step1?.returnTime || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  step1: { ...prev.step1!, returnTime: e.target.value }
                }))}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Agence différente button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowReturnLocation(!showReturnLocation)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${
                showReturnLocation
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-300'
              }`}
            >
              🏢 {lang === 'fr' ? 'Agence différente' : 'وكالة مختلفة'}
            </button>
          </div>

          {/* Return Location - shown only when Agence différente is clicked */}
          <AnimatePresence>
            {showReturnLocation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div>
                  <label className="block font-bold text-slate-900 mb-2">
                    📍 {lang === 'fr' ? 'Lieu de Restitution' : 'مكان الإرجاع'}
                  </label>
                  <select
                    value={formData.step1?.returnLocation || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      step1: { ...prev.step1!, returnLocation: e.target.value }
                    }))}
                    disabled={isLoadingAgencies}
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                  >
                    <option value="">{isLoadingAgencies ? (lang === 'fr' ? 'Chargement...' : 'جاري التحميل...') : (lang === 'fr' ? 'Sélectionner une agence...' : 'اختر وكالة...')}</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.name || agency.address}>
                        {agency.name} {agency.address ? `- ${agency.address}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    {/* Duration Summary */}
    {(formData.step1?.departureDate && formData.step1?.returnDate) && (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
        <h4 className="text-lg font-black text-slate-900 mb-4">
          ⏱️ {lang === 'fr' ? 'Résumé de Durée' : 'ملخص المدة'}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-slate-600">{lang === 'fr' ? 'Jours' : 'الأيام'}</p>
            <p className="text-2xl font-black text-slate-900">
              {Math.ceil((new Date(formData.step1.returnDate).getTime() - new Date(formData.step1.departureDate).getTime()) / (1000 * 60 * 60 * 24))}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-slate-600">{lang === 'fr' ? 'Départ' : 'المغادرة'}</p>
            <p className="text-lg font-bold text-slate-900">{formData.step1.departureDate}</p>
            <p className="text-sm text-slate-600">{formData.step1.departureTime}</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-slate-600">{lang === 'fr' ? 'Retour' : 'العودة'}</p>
            <p className="text-lg font-bold text-slate-900">{formData.step1.returnDate}</p>
            <p className="text-sm text-slate-600">{formData.step1.returnTime}</p>
          </div>
        </div>
      </div>
    )}
  </div>
);
};
// Step 2: Vehicle Selection
export const Step2VehicleSelection: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [availableCars, setAvailableCars] = useState<Car[]>([]);
  const [reservedCars, setReservedCars] = useState<any[]>([]);
  const [isLoadingCars, setIsLoadingCars] = useState(false);
  const [deselectAlert, setDeselectAlert] = useState(false);

  const departureDate = formData.step1?.departureDate;
  const returnDate    = formData.step1?.returnDate;
  const hasDates      = !!departureDate && !!returnDate;

  // Reload whenever the date range changes (both dates must be in the dependency array)
  useEffect(() => {
    if (!hasDates) {
      setAvailableCars([]);
      setReservedCars([]);
      return;
    }

    const loadCars = async () => {
      try {
        setIsLoadingCars(true);
        const [avail, reserved] = await Promise.all([
          DatabaseService.getAvailableCars(departureDate, returnDate),
          DatabaseService.getReservedCarsForPeriod(departureDate!, returnDate!),
        ]);

        setAvailableCars(avail || []);
        setReservedCars(reserved || []);

        // Auto-désélectionne si la voiture choisie devient indisponible après un changement de dates
        const selectedId = (formData as any).step2?.selectedCar?.id;
        if (selectedId) {
          const stillAvailable = (avail || []).some(c => c.id === selectedId);
          if (!stillAvailable) {
            setFormData(prev => ({ ...prev, step2: { ...((prev as any).step2 || {}), selectedCar: undefined } }));
            setDeselectAlert(true);
            setTimeout(() => setDeselectAlert(false), 5000);
          }
        }
      } catch (err) {
        console.error('Error loading cars:', err);
        setAvailableCars([]);
        setReservedCars([]);
      } finally {
        setIsLoadingCars(false);
      }
    };

    loadCars();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureDate, returnDate]);

  // Filtrer la recherche uniquement sur les voitures disponibles
  const filteredAvailable = availableCars.filter(car =>
    car.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    car.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    car.registration.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-black text-slate-900">
        🚗 {lang === 'fr' ? 'Sélection du Véhicule' : 'اختيار المركبة'}
      </h3>

      {/* Alert déselection */}
      {deselectAlert && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 border border-orange-300 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <p className="text-sm font-bold text-orange-800">
            {lang === 'fr'
              ? 'La voiture sélectionnée n\'est plus disponible pour ces dates.'
              : 'السيارة المختارة لم تعد متاحة لهذه التواريخ.'}
          </p>
        </motion.div>
      )}

      {/* Message si pas de dates */}
      {!hasDates && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <span className="text-5xl mb-4 block">📅</span>
          <p className="text-slate-600 font-bold text-lg">
            {lang === 'fr' ? 'Choisissez d\'abord les dates' : 'اختر التواريخ أولاً'}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            {lang === 'fr'
              ? 'Retournez à l\'étape 1 pour sélectionner une période de location.'
              : 'ارجع إلى الخطوة 1 لاختيار فترة الإيجار.'}
          </p>
        </div>
      )}

      {hasDates && (
        <>
          {/* Véhicules réservés — alerte ambre EN PREMIER */}
          {reservedCars.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-black text-amber-900 text-lg">
                    {lang === 'fr' ? 'Réservés sur cette période' : 'محجوزة في هذه الفترة'}
                    <span className="ml-2 text-sm font-semibold text-amber-700">({reservedCars.length})</span>
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    {lang === 'fr'
                      ? 'Ces véhicules ne sont pas disponibles — cliquez pour voir les détails.'
                      : 'هذه المركبات غير متاحة — انقر لرؤية التفاصيل.'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {reservedCars.map((reservation) => (
                  <div key={reservation.id}
                    className="bg-white rounded-xl p-3 border border-amber-200 opacity-70 cursor-not-allowed"
                    style={{ cursor: 'not-allowed' }}
                  >
                    <div className="relative mb-2 overflow-hidden rounded-lg bg-slate-100 h-24">
                      <img src={reservation.image} alt={`${reservation.brand} ${reservation.model}`}
                        className="w-full h-full object-cover grayscale" referrerPolicy="no-referrer" />
                      {/* Badge Indisponible */}
                      <div className="absolute top-1 left-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                        {lang === 'fr' ? 'Indisponible' : 'غير متاح'}
                      </div>
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-slate-900 truncate">{reservation.brand} {reservation.model}</p>
                      <p className="text-slate-600 text-[10px] mt-1">
                        {lang === 'fr' ? 'Client: ' : 'العميل: '}{reservation.clientName}
                      </p>
                      <div className="mt-1.5 pt-1.5 border-t border-amber-100 text-slate-500 text-[10px]">
                        {new Date(reservation.departureDate).toLocaleDateString()}
                        {' → '}
                        {new Date(reservation.returnDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barre de recherche (disponibles uniquement) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text"
              placeholder={lang === 'fr' ? 'Rechercher parmi les disponibles...' : 'البحث في المتاحة...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoadingCars}
            />
          </div>

          {/* Chargement */}
          {isLoadingCars && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-slate-500">{lang === 'fr' ? 'Chargement des véhicules...' : 'جاري تحميل المركبات...'}</p>
              </div>
            </div>
          )}

          {/* Section — véhicules disponibles */}
          {!isLoadingCars && (
            <>
              <div>
                <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  {lang === 'fr' ? 'Véhicules disponibles' : 'المركبات المتاحة'}
                  <span className="text-slate-400 font-semibold">({filteredAvailable.length})</span>
                </h4>

                {filteredAvailable.length === 0 ? (
                  <div className="text-center py-10">
                    <CarIcon className="w-14 h-14 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold">
                      {lang === 'fr' ? 'Aucun véhicule disponible sur cette période' : 'لا توجد مركبات متاحة في هذه الفترة'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredAvailable.map((car) => (
                      <motion.div key={car.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          step2: { ...((prev as any).step2 || {}), selectedCar: car }
                        }))}
                        className={`relative overflow-hidden rounded-2xl shadow-lg cursor-pointer transition-all duration-300 ${
                          (formData as any).step2?.selectedCar?.id === car.id
                            ? 'ring-4 ring-blue-500 shadow-2xl'
                            : 'hover:shadow-xl'
                        }`}
                      >
                        {/* Badge disponible */}
                        <div className="absolute top-3 left-3 z-10 bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                          {lang === 'fr' ? '✓ Disponible' : '✓ متاح'}
                        </div>

                        {/* Selected indicator */}
                        {(formData as any).step2?.selectedCar?.id === car.id && (
                          <div className="absolute top-3 right-3 z-10 bg-blue-500 text-white rounded-full p-1.5">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                        )}

                        {/* Car Image */}
                        <div className="relative h-48 overflow-hidden">
                          <img src={car.images[0]} alt={`${car.brand} ${car.model}`}
                            className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          <div className="absolute bottom-4 left-4 text-white">
                            <h4 className="text-xl font-black">{car.brand} {car.model}</h4>
                            <p className="text-sm opacity-90">{car.year} • {car.color}</p>
                          </div>
                        </div>

                        {/* Car Details */}
                        <div className="p-6 bg-white">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                                <Fuel className="w-4 h-4" />
                                <span className="text-sm">{car.energy}</span>
                              </div>
                              <p className="text-xs text-slate-500">{lang === 'fr' ? 'Carburant' : 'الوقود'}</p>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                                <CarIcon className="w-4 h-4" />
                                <span className="text-sm">{car.transmission}</span>
                              </div>
                              <p className="text-xs text-slate-500">{lang === 'fr' ? 'Transmission' : 'النقل'}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">{lang === 'fr' ? 'Prix/Jour' : 'السعر/يوم'}</span>
                              <span className="font-bold text-green-600">{car.priceDay.toLocaleString()} DA</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">{lang === 'fr' ? `Prix/Jour · ${WEEK_DAYS} j` : `السعر/يوم · ${WEEK_DAYS} أيام`}</span>
                              <span className="font-bold text-blue-600">
                                {weekDayRate(car).toLocaleString()} DA
                                <span className="font-medium text-slate-500"> ({weekTotal(car).toLocaleString()} DA)</span>
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">{lang === 'fr' ? `Prix/Jour · ${MONTH_DAYS} j` : `السعر/يوم · ${MONTH_DAYS} يوماً`}</span>
                              <span className="font-bold text-purple-600">
                                {monthDayRate(car).toLocaleString()} DA
                                <span className="font-medium text-slate-500"> ({monthTotal(car).toLocaleString()} DA)</span>
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">{lang === 'fr' ? 'Caution' : 'الضمان'}</span>
                              <span className="font-bold text-slate-900">{car.deposit.toLocaleString()} DA</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Selected Car Summary */}
      {formData.step2?.selectedCar && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200"
        >
          <h4 className="text-lg font-black text-green-900 mb-4 flex items-center gap-2">
            ✅ {lang === 'fr' ? 'Véhicule Sélectionné' : 'المركبة المختارة'}
            <CheckCircle className="w-5 h-5" />
          </h4>
          <div className="flex items-center gap-4">
            <img
              src={formData.step2.selectedCar.images[0]}
              alt={`${formData.step2.selectedCar.brand} ${formData.step2.selectedCar.model}`}
              className="w-16 h-12 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="font-bold text-lg">{formData.step2.selectedCar.brand} {formData.step2.selectedCar.model}</p>
              <p className="text-slate-600">{formData.step2.selectedCar.registration} • {formData.step2.selectedCar.color}</p>
              <p className="text-green-600 font-bold">{formData.step2.selectedCar.priceDay.toLocaleString()} DA/{lang === 'fr' ? 'jour' : 'يوم'}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Step 3: Departure Inspection
export const Step3DepartureInspection: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => {
  const [fuelLevel, setFuelLevel] = useState<'full' | 'half' | 'quarter' | 'eighth' | 'empty'>('full');

  // Resolve the selected car (supports both regular and inspection modes)
  const _selectedCar = formData.step2?.selectedCar || (formData as any).car;
  const _carMileage: number | undefined = (_selectedCar as any)?.mileage;

  // Pre-fill with existing inspection mileage, or fall back to current car mileage
  const [mileage, setMileage] = useState(() => {
    const existingMileage = formData.step3?.departureInspection?.mileage;
    if (existingMileage && existingMileage > 0) return existingMileage.toString();
    return _carMileage ? _carMileage.toString() : '';
  });
  const [selectedInspectionLocation, setSelectedInspectionLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  const [agencies, setAgencies] = useState<any[]>([]);
  const [isLoadingAgencies, setIsLoadingAgencies] = useState(true);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(true);
  const [newCustomItem, setNewCustomItem] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('securite');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; itemId: string | null; itemName: string }>({ show: false, itemId: null, itemName: '' });

  /**
   * Trace toute intervention de l'utilisateur sur cet ecran (case cochee,
   * kilometrage saisi, carburant, lieu, note, photo, signature).
   * Si l'inspection a ete touchee, la reservation est creee directement en
   * statut « confirmed » ; sinon elle reste « pending ».
   */
  const markTouched = React.useCallback(() => {
    setFormData(prev => (prev as any).inspectionTouched
      ? prev
      : ({ ...prev, inspectionTouched: true } as any));
  }, [setFormData]);

  // Load agencies from database on component mount
  useEffect(() => {
    const loadAgencies = async () => {
      try {
        setIsLoadingAgencies(true);
        const data = await DatabaseService.getAgencies();
        setAgencies(data || []);
      } catch (err) {
        console.error('Error loading agencies:', err);
        setAgencies(AGENCIES); // Fallback to static data
      } finally {
        setIsLoadingAgencies(false);
      }
    };

    loadAgencies();
  }, []);

  // Load checklist items from database
  useEffect(() => {
    const loadChecklistItems = async () => {
      try {
        setIsLoadingChecklist(true);
        const data = await DatabaseService.getInspectionChecklistItems();
        setChecklistItems(data || []);
      } catch (err) {
        console.error('Error loading checklist items:', err);
        // Fallback to hardcoded items if database fails
        setChecklistItems([
          { id: 'sec-1', category: 'securite', item_name: 'Ceintures de sécurité', display_order: 1 },
          { id: 'sec-2', category: 'securite', item_name: 'Freins', display_order: 2 },
          { id: 'sec-3', category: 'securite', item_name: 'Feux', display_order: 3 },
          { id: 'sec-4', category: 'securite', item_name: 'Pneus', display_order: 4 },
          { id: 'sec-5', category: 'securite', item_name: 'Direction', display_order: 5 },
          { id: 'sec-6', category: 'securite', item_name: 'Klaxon', display_order: 6 },
          { id: 'sec-7', category: 'securite', item_name: 'Rétroviseurs', display_order: 7 },
          { id: 'sec-8', category: 'securite', item_name: 'Essuie-glaces', display_order: 8 },
          { id: 'sec-9', category: 'securite', item_name: 'Airbags', display_order: 9 },
          { id: 'sec-10', category: 'securite', item_name: 'Triangle de signalisation', display_order: 10 },
          { id: 'sec-11', category: 'securite', item_name: 'Extincteur', display_order: 11 },
          { id: 'sec-12', category: 'securite', item_name: 'Cric et roue de secours', display_order: 12 },
          { id: 'eq-1', category: 'equipements', item_name: 'GPS', display_order: 1 },
          { id: 'eq-2', category: 'equipements', item_name: 'Siège bébé', display_order: 2 },
          { id: 'eq-3', category: 'equipements', item_name: 'Chaîne neige', display_order: 3 },
          { id: 'eq-4', category: 'equipements', item_name: 'Câbles de démarrage', display_order: 4 },
          { id: 'eq-5', category: 'equipements', item_name: 'Kit de premiers secours', display_order: 5 },
          { id: 'eq-6', category: 'equipements', item_name: 'Radio/CD', display_order: 6 },
          { id: 'eq-7', category: 'equipements', item_name: 'Climatisation', display_order: 7 },
          { id: 'eq-8', category: 'equipements', item_name: 'Verrouillage centralisé', display_order: 8 },
          { id: 'eq-9', category: 'equipements', item_name: 'Ouverture automatique portes', display_order: 9 },
          { id: 'eq-10', category: 'equipements', item_name: 'Régulateur de vitesse', display_order: 10 },
          { id: 'eq-11', category: 'equipements', item_name: 'Caméra de recul', display_order: 11 },
          { id: 'eq-12', category: 'equipements', item_name: 'Capteurs de stationnement', display_order: 12 },
          { id: 'com-1', category: 'confort', item_name: 'Sièges', display_order: 1 },
          { id: 'com-2', category: 'confort', item_name: 'Volant', display_order: 2 },
          { id: 'com-3', category: 'confort', item_name: 'Tableau de bord', display_order: 3 },
          { id: 'com-4', category: 'confort', item_name: 'Éclairage intérieur', display_order: 4 },
          { id: 'com-5', category: 'confort', item_name: 'Vitres électriques', display_order: 5 },
          { id: 'com-6', category: 'confort', item_name: 'Rétroviseurs électriques', display_order: 6 },
          { id: 'com-7', category: 'confort', item_name: 'Autoradio', display_order: 7 },
          { id: 'com-8', category: 'confort', item_name: 'Prises USB', display_order: 8 },
          { id: 'com-9', category: 'confort', item_name: 'Cendrier', display_order: 9 },
          { id: 'com-10', category: 'confort', item_name: 'Coffre-fort', display_order: 10 },
          { id: 'com-11', category: 'confort', item_name: 'Tapis de sol', display_order: 11 },
          { id: 'com-12', category: 'confort', item_name: 'Propreté générale', display_order: 12 }
        ]);
      } finally {
        setIsLoadingChecklist(false);
      }
    };

    loadChecklistItems();
  }, []);

  // Get departure agency name from formData
  const departureAgency = AGENCIES.find(agency => agency.id === formData.step1?.departureAgency);

  // Initialize selected inspection location with departure agency
  useEffect(() => {
    if (departureAgency && !selectedInspectionLocation) {
      setSelectedInspectionLocation(`${departureAgency.name} - ${departureAgency.city}`);
    }
  }, [departureAgency, selectedInspectionLocation]);

  const inspectionLocation = selectedInspectionLocation || (departureAgency ? `${departureAgency.name} - ${departureAgency.city}` : '');

  // Early return if no step1 data
  if (!formData.step1) {
    return (
      <div className="space-y-8">
        <h3 className="text-2xl font-black text-slate-900">
          🔍 {lang === 'fr' ? 'Inspection de Départ' : 'فحص المغادرة'}
        </h3>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <p className="text-red-700 font-bold">
            {lang === 'fr' ? 'Erreur: Informations de réservation manquantes. Veuillez revenir à l\'étape précédente.' : 'خطأ: معلومات الحجز مفقودة. يرجى العودة إلى الخطوة السابقة.'}
          </p>
        </div>
      </div>
    );
  }

  // Group checklist items by category
  const groupedItems = checklistItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  // State for checklist responses
  const [checklistResponses, setChecklistResponses] = useState<Record<string, boolean>>({});
  const initializedInspectionRef = React.useRef(false);

  const toggleChecklistItem = (itemId: string) => {
    markTouched();
    setChecklistResponses(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Initialize from existing inspection data
  useEffect(() => {
    if (!formData.step3?.departureInspection) return;
    if (initializedInspectionRef.current) return;
    initializedInspectionRef.current = true;
    const inspection = formData.step3.departureInspection;
    setFuelLevel(inspection.fuelLevel || 'full');
    // Use saved inspection mileage if > 0, otherwise keep car's current mileage as default
    setMileage(
      inspection.mileage && inspection.mileage > 0
        ? inspection.mileage.toString()
        : _carMileage ? _carMileage.toString() : ''
    );
    setSelectedInspectionLocation(inspection.location || '');
    setNotes(inspection.notes || '');
    setPhotos([
      ...(inspection.interiorPhotos?.map((url: string) => ({ url, type: 'interior' })) || []),
      ...(inspection.exteriorPhotos?.map((url: string) => ({ url, type: 'exterior' })) || [])
    ]);
    setSignature(inspection.signature || '');

    // Initialize checklist responses (robust matching)
    // Stored inspection items may contain either the checklist item id or older response ids,
    // so we attempt to match by id first, then by name as a fallback.
    const responses: Record<string, boolean> = {};
    const masterItems = checklistItems || [];
    // If we already have a master list, build responses for those
    if (masterItems.length > 0) {
      masterItems.forEach((master: any) => {
        const saved = inspection.inspectionItems?.find((si: any) => (
          si.id === master.id || // best case: stored uses checklist item id
          si.name === master.item_name || // fallback: match by name
          si.responseId === master.id // if mapping included responseId
        ));
        responses[master.id] = saved ? !!saved.checked : false;
      });
    } else {
      // If master list not yet loaded, map whatever we have keyed by stored ids/names
      inspection.inspectionItems?.forEach((item: any) => {
        responses[item.id] = item.checked;
        if (item.name) responses[item.name] = item.checked;
      });
    }
    setChecklistResponses(responses);
  }, [formData.step3?.departureInspection]);

  const saveInspectionData = () => {
    // Prepare inspection items from checklist responses
    const inspectionItems: any[] = [];
    Object.entries(checklistResponses).forEach(([itemId, checked]) => {
      const item = checklistItems.find(i => i.id === itemId);
      if (item) {
        inspectionItems.push({
          id: item.id,
          category: item.category,
          name: item.item_name,
          checked: checked
        });
      }
    });

    // Save inspection data to formData
    setFormData(prev => ({
      ...prev,
      step3: {
        departureInspection: {
          id: prev.step3?.departureInspection?.id || `inspection_${Date.now()}`,
          reservationId: prev.id || '',
          type: 'departure',
          mileage: parseInt(mileage) || 0,
          fuelLevel: fuelLevel,
          location: inspectionLocation,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0],
          interiorPhotos: photos.filter(p => p.type === 'interior').map(p => p.url),
          exteriorPhotos: photos.filter(p => p.type === 'exterior').map(p => p.url),
          inspectionItems: inspectionItems,
          notes: notes,
          signature: signature,
          createdAt: prev.step3?.departureInspection?.createdAt || new Date().toISOString()
        }
      }
    }));
  };

  // Auto-save inspection data when key fields change
  useEffect(() => {
    if (mileage || fuelLevel !== 'full' || notes || signature || photos.length > 0 || Object.keys(checklistResponses).length > 0) {
      saveInspectionData();
    }
  }, [mileage, fuelLevel, notes, signature, photos, checklistResponses]);

  const addCustomChecklistItem = async () => {
    if (!newCustomItem.trim()) return;

    try {
      const newItem = await DatabaseService.createInspectionChecklistItem({
        category: selectedCategory,
        item_name: newCustomItem.trim(),
        display_order: groupedItems[selectedCategory]?.length || 0
      });

      setChecklistItems(prev => [...prev, newItem]);
      // initialize response for the newly added item to false (unchecked)
      setChecklistResponses(prev => ({ ...prev, [newItem.id]: false }));
      setNewCustomItem('');
    } catch (error: any) {
      console.error('Error adding checklist item:', error);
      // Check if it's an RLS policy error
      if (error?.code === '42501') {
        alert(lang === 'fr' 
          ? 'Erreur: Les politiques de sécurité de la base de données empêchent l\'ajout. Veuillez contacter l\'administrateur.' 
          : 'خطأ: سياسات الأمان في قاعدة البيانات تمنع الإضافة. يرجى الاتصال بالمسؤول.');
      } else {
        alert(lang === 'fr' ? 'Erreur lors de l\'ajout de l\'élément' : 'خطأ في إضافة العنصر');
      }
    }
  };

  const removeChecklistItem = async (itemId: string) => {
    const item = checklistItems.find(i => i.id === itemId);
    setDeleteConfirmation({ show: true, itemId, itemName: item?.item_name || '' });
  };

  const confirmDeleteItem = async () => {
    if (!deleteConfirmation.itemId) return;

    try {
      await DatabaseService.deleteInspectionChecklistItem(deleteConfirmation.itemId);
      setChecklistItems(prev => prev.filter(item => item.id !== deleteConfirmation.itemId));
      setDeleteConfirmation({ show: false, itemId: null, itemName: '' });
    } catch (error: any) {
      console.error('Error deleting checklist item:', error);
      // Check if it's an RLS policy error
      if (error?.code === '42501') {
        alert(lang === 'fr' 
          ? 'Erreur: Les politiques de sécurité de la base de données empêchent la suppression. Veuillez contacter l\'administrateur.' 
          : 'خطأ: سياسات الأمان في قاعدة البيانات تمنع الحذف. يرجى الاتصال بالمسؤول.');
      } else {
        alert(lang === 'fr' ? 'Erreur lors de la suppression de l\'élément' : 'خطأ في حذف العنصر');
      }
      setDeleteConfirmation({ show: false, itemId: null, itemName: '' });
    }
  };

  const handlePhotoUpload = async (file: File, type: string) => {
    if (!file) return;
    markTouched();
    setUploadingType(type);
    try {
      const result = await uploadInspectionImage(file, undefined, type);
      if (result.success && result.url) {
        setPhotos(prev => [...prev, { url: result.url!, type, file }]);
      } else {
        alert(result.error || (lang === 'fr' ? 'Erreur lors du téléchargement' : 'خطأ في التحميل'));
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert(lang === 'fr' ? 'Erreur lors du téléchargement' : 'خطأ في التحميل');
    } finally {
      setUploadingType(null);
    }
  };

  const removePhoto = (index: number) => {
    markTouched();
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };


  // Update formData with inspection data
  useEffect(() => {
    if (mileage && inspectionLocation) {
      const inspectionData: VehicleInspection = {
        id: `inspection_${Date.now()}`,
        reservationId: '',
        type: 'departure',
        mileage: parseInt(mileage) || 0,
        fuelLevel,
        location: inspectionLocation,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        interiorPhotos: photos.filter(photo => photo.type === 'interior').map(p => p.url),
        exteriorPhotos: photos.filter(photo => photo.type.includes('exterior')).map(p => p.url),
        inspectionItems: checklistItems.map((item) => ({
          id: item.id,
          name: item.item_name,
          checked: checklistResponses[item.id] || false,
          category: item.category === 'securite' ? 'security' :
                   item.category === 'equipements' ? 'equipment' :
                   item.category === 'confort' ? 'comfort' : 'cleanliness'
        })),
        notes,
        createdAt: new Date().toISOString()
      };

      setFormData(prev => ({
        ...prev,
        step3: {
          ...prev.step3,
          departureInspection: inspectionData
        }
      }));
    }
  }, [mileage, fuelLevel, inspectionLocation, notes, photos, checklistItems, checklistResponses, setFormData]);

  // When the checklist items list changes (e.g., after adding/removing items),
  // merge any stored inspection responses and preserve current UI state.
  useEffect(() => {
    const storedInspection = formData.step3?.departureInspection;
    // Only add missing entries; avoid calling setState if nothing to change
    setChecklistResponses(prev => {
      const next: Record<string, boolean> = { ...prev };
      let needsUpdate = false;
      checklistItems.forEach((item) => {
        if (next[item.id] === undefined) {
          const saved = storedInspection?.inspectionItems?.find((it: any) => it.id === item.id);
          next[item.id] = saved ? !!saved.checked : false;
          needsUpdate = true;
        }
      });
      return needsUpdate ? next : prev;
    });
    // Intentionally only depend on checklistItems to avoid reacting to formData changes
  }, [checklistItems]);

  const selectedCarInfo = formData.step2?.selectedCar || (formData as any).car;
  const inspectionTouched = !!(formData as any).inspectionTouched;

  return (
    <div className="space-y-7">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0F172A] text-white p-7">
        <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-[#DC2626]/25 blur-3xl" />
        <div className="absolute -left-12 -bottom-20 w-52 h-52 rounded-full bg-[#0284C7]/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-[#DC2626] flex items-center justify-center shadow-lg shadow-[#DC2626]/30">
              <Search className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter">
                {lang === 'fr' ? 'Inspection de départ' : 'فحص المغادرة'}
              </h3>
              <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.25em] mt-1">
                {lang === 'fr' ? 'État du véhicule à la remise des clés' : 'حالة المركبة عند تسليم المفاتيح'}
              </p>
            </div>
          </div>

          {/* Indique clairement l'effet du remplissage sur le statut créé */}
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-wider ${
            inspectionTouched
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
              : 'bg-white/10 border-white/20 text-white/60'
          }`}>
            <span className={`w-2 h-2 rounded-full ${inspectionTouched ? 'bg-emerald-400' : 'bg-white/40'}`} />
            {inspectionTouched
              ? (lang === 'fr' ? 'Réservation → Confirmée' : 'الحجز ← مؤكد')
              : (lang === 'fr' ? 'Réservation → En attente' : 'الحجز ← في الانتظار')}
          </div>
        </div>
      </div>

      {/* ── Véhicule + relevés ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Fiche véhicule */}
        <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
            <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white flex items-center justify-center">
                <CarIcon className="w-4 h-4" />
              </span>
              {lang === 'fr' ? 'Véhicule' : 'المركبة'}
            </h4>
          </div>
          {selectedCarInfo ? (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={selectedCarInfo?.images?.[0]}
                  alt={`${selectedCarInfo?.brand} ${selectedCarInfo?.model}`}
                  className="w-20 h-16 rounded-xl object-cover border border-saas-border shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-black text-saas-text-main truncate">
                    {selectedCarInfo?.brand} {selectedCarInfo?.model}
                  </p>
                  <p className="text-[#DC2626] font-bold text-sm">{selectedCarInfo?.registration}</p>
                </div>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-saas-border">
                {[
                  { l: lang === 'fr' ? 'Couleur' : 'اللون', v: selectedCarInfo?.color },
                  { l: lang === 'fr' ? 'Année' : 'السنة', v: selectedCarInfo?.year },
                  { l: lang === 'fr' ? 'Énergie' : 'الوقود', v: selectedCarInfo?.energy },
                  { l: lang === 'fr' ? 'Transmission' : 'ناقل الحركة', v: selectedCarInfo?.transmission },
                ].map(row => (
                  <div key={row.l} className="flex justify-between text-sm">
                    <span className="text-saas-text-muted">{row.l}</span>
                    <span className="font-bold text-saas-text-main">{row.v || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="p-6 text-sm text-saas-text-muted text-center">
              {lang === 'fr' ? 'Aucun véhicule sélectionné.' : 'لم يتم اختيار مركبة.'}
            </p>
          )}
        </div>

        {/* Relevés */}
        <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
            <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#0284C7] text-white flex items-center justify-center">
                <Fuel className="w-4 h-4" />
              </span>
              {lang === 'fr' ? 'Relevés au départ' : 'القراءات عند المغادرة'}
            </h4>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <label className="label-saas">
                {lang === 'fr' ? 'Kilométrage au départ' : 'عداد الكيلومترات عند المغادرة'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={mileage}
                  onChange={(e) => { markTouched(); setMileage(e.target.value); }}
                  className="input-saas pr-12 font-bold"
                  placeholder="0"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-saas-text-muted pointer-events-none">km</span>
              </div>
              {_carMileage !== undefined && _carMileage > 0 && (
                <p className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0284C7]/8 border border-[#0284C7]/20 text-[11px] font-bold text-[#0284C7]">
                  <AlertTriangle size={12} />
                  {lang === 'fr'
                    ? `Compteur actuel du véhicule : ${_carMileage.toLocaleString('fr-DZ')} km`
                    : `العداد الحالي للمركبة: ${_carMileage.toLocaleString('fr-DZ')} كم`}
                </p>
              )}
            </div>

            <div>
              <label className="label-saas">{lang === 'fr' ? 'Niveau de carburant' : 'مستوى الوقود'}</label>
              <FuelLevelPicker
                value={fuelLevel}
                onChange={(v) => { markTouched(); setFuelLevel(v); }}
                accent="#0284C7"
              />
            </div>

            <div>
              <label className="label-saas">{lang === 'fr' ? "Lieu d'inspection" : 'مكان الفحص'}</label>
              <select
                value={selectedInspectionLocation}
                onChange={(e) => { markTouched(); setSelectedInspectionLocation(e.target.value); }}
                className="input-saas cursor-pointer"
                disabled={isLoadingAgencies}
              >
                <option value="">
                  {isLoadingAgencies
                    ? (lang === 'fr' ? 'Chargement…' : 'جاري التحميل…')
                    : (lang === 'fr' ? 'Sélectionner une agence…' : 'اختر وكالة…')}
                </option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={`${agency.name} - ${agency.city}`}>
                    {agency.name} - {agency.city}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-saas-border bg-white overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
            <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white flex items-center justify-center">
                <PenTool className="w-4 h-4" />
              </span>
              {lang === 'fr' ? "Notes d'inspection" : 'ملاحظات الفحص'}
              <span className="text-[10px] font-bold text-saas-text-muted normal-case tracking-normal">
                ({lang === 'fr' ? 'optionnel' : 'اختياري'})
              </span>
            </h4>
          </div>
          <div className="p-5 flex-1 flex">
            <textarea
              value={notes}
              onChange={(e) => { markTouched(); setNotes(e.target.value); }}
              className="input-saas flex-1 resize-none min-h-[220px]"
              placeholder={lang === 'fr'
                ? 'État général, rayures, impacts, observations particulières…'
                : 'الحالة العامة، الخدوش، الملاحظات الخاصة…'}
            />
          </div>
        </div>
      </div>

      {/* ── Check-list (rendu de référence partagé) ─────────────────────── */}
      {isLoadingChecklist ? (
        <div className="h-40 rounded-2xl vel-skeleton" />
      ) : (
        <div className="space-y-4">
          <InspectionChecklist
            lang={lang}
            items={checklistItems}
            responses={checklistResponses}
            onToggle={toggleChecklistItem}
            onDeleteItem={removeChecklistItem}
          />
          <ChecklistItemComposer
            lang={lang}
            category={selectedCategory}
            onCategoryChange={setSelectedCategory}
            value={newCustomItem}
            onValueChange={setNewCustomItem}
            onAdd={addCustomChecklistItem}
          />
        </div>
      )}

      {/* ── Photos ──────────────────────────────────────────────────────── */}
      <InspectionPhotoUploader
        lang={lang}
        photos={photos}
        onUpload={handlePhotoUpload}
        onRemove={removePhoto}
        uploadingType={uploadingType}
        title={lang === 'fr' ? "Photos d'état initial" : 'صور الحالة الأولية'}
      />

      {/* ── Signature ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-saas-border bg-saas-bg">
          <h4 className="font-black uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#0F172A] text-white flex items-center justify-center">
              <PenTool className="w-4 h-4" />
            </span>
            {lang === 'fr' ? 'Signature du client' : 'توقيع العميل'}
          </h4>
        </div>

        <div className="p-6 flex flex-col items-center gap-5">
          <div className="rounded-2xl border-2 border-dashed border-saas-border bg-saas-bg p-4">
            <SignaturePad
              lang={lang}
              initialSignature={signature}
              onSignatureChange={(s) => { markTouched(); setSignature(s); }}
            />
          </div>

          {signature && !signature.startsWith('data:') && (
            <img src={signature} alt="signature" className="max-w-full h-auto border border-saas-border rounded-lg" />
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="signature-confirm"
              onChange={markTouched}
              className="w-5 h-5 rounded border-saas-border accent-[#DC2626] cursor-pointer"
            />
            <span className="text-saas-text-main font-bold text-sm">
              {lang === 'fr'
                ? "Je confirme avoir inspecté le véhicule et accepte son état actuel"
                : 'أؤكد أنني قمت بفحص المركبة وأقبل حالتها الحالية'}
            </span>
          </label>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 p-4 overflow-y-auto sm:py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-red-200"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">
              {lang === 'fr' ? 'Confirmer la suppression' : 'تأكيد الحذف'}
            </h3>
            <p className="text-slate-600 text-center mb-6">
              {lang === 'fr' 
                ? `Êtes-vous sûr de vouloir supprimer l'élément "${deleteConfirmation.itemName}"?` 
                : `هل أنت متأكد من حذف "${deleteConfirmation.itemName}"?`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmation({ show: false, itemId: null, itemName: '' })}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
              >
                {lang === 'fr' ? 'Annuler' : 'إلغاء'}
              </button>
              <button
                onClick={confirmDeleteItem}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                {lang === 'fr' ? 'Supprimer' : 'حذف'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export const Step4ClientSelection: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  // Sans recherche : seulement les 6 derniers clients créés.
  // Avec recherche : interrogation serveur sur TOUTE la base clients.
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the last 6 clients from database
  useEffect(() => {
    const loadClients = async () => {
      setLoading(true);
      try {
        const list = await DatabaseService.getRecentClients(6);
        setRecentClients(list);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load clients:', err);
        setError('Impossible de charger les clients');
      } finally {
        setLoading(false);
      }
    };
    loadClients();
  }, []);

  // Recherche serveur avec debounce (couvre les clients hors des 6 récents)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await DatabaseService.searchClients(q);
        setSearchResults(results);
      } catch (err) {
        console.error('Client search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearchMode = searchQuery.trim().length > 0;
  const filteredClients = isSearchMode ? searchResults : recentClients;

  const handleSaveClient = async (clientData: Partial<Client>): Promise<void> => {
    try {
      const created = await DatabaseService.createClient(clientData as Omit<Client, 'id' | 'createdAt'>);
      setRecentClients(prev => [created, ...prev].slice(0, 6));

      // Auto-select the newly created client and close modal
      setFormData(prev => ({
        ...prev,
        step4: { selectedClient: created }
      }));
      setIsClientModalOpen(false);
    } catch (err) {
      console.error('Error saving client:', err);
      throw new Error(lang === 'fr' ? 'Erreur lors de l\'enregistrement' : 'خطأ في الحفظ');
    }
  };

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-black text-slate-900">
        👤 {lang === 'fr' ? 'Sélection du Client' : 'اختيار العميل'}
      </h3>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-4"
        >
          <p className="text-red-600 font-medium">⚠️ {error}</p>
        </motion.div>
      )}

      {/* Search and Add New */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3 text-saas-text-muted" size={18} />
          <input
            type="text"
            placeholder={lang === 'fr' ? 'Rechercher un client...' : 'ابحث عن عميل...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-saas pl-10 w-full"
          />
        </div>
        <button
          onClick={() => setIsClientModalOpen(true)}
          className="btn-saas-primary whitespace-nowrap w-full sm:w-auto justify-center"
        >
          <Plus size={18} />
          {lang === 'fr' ? 'Nouveau Client' : 'عميل جديد'}
        </button>
      </div>

      {/* Indication : 6 derniers clients ou résultats de recherche */}
      {!loading && (
        <p className="text-xs font-bold uppercase tracking-widest text-saas-text-muted">
          {isSearchMode
            ? (lang === 'fr' ? `🔎 Résultats de recherche (${filteredClients.length})` : `🔎 نتائج البحث (${filteredClients.length})`)
            : (lang === 'fr' ? '🕒 Les 6 derniers clients — utilisez la recherche pour trouver les autres' : '🕒 آخر 6 عملاء — استخدم البحث للعثور على الآخرين')}
        </p>
      )}

      {/* Loading State */}
      {loading || searching ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-saas-primary-via"></div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl opacity-30 mb-4">👥</div>
          <p className="text-saas-text-muted font-semibold">
            {lang === 'fr' ? 'Aucun client trouvé' : 'لم يتم العثور على عملاء'}
          </p>
        </div>
      ) : (
        /* Client List */
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredClients.map((client) => (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setFormData(prev => ({
                  ...prev,
                  step4: { selectedClient: client }
                }))}
                className={`border-2 rounded-xl p-4 cursor-pointer transition-all hover:scale-105 ${
                  formData.step4?.selectedClient?.id === client.id
                    ? 'border-saas-primary-via bg-blue-50 shadow-lg'
                    : 'border-saas-border hover:border-saas-primary-muted hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  {client.profilePhoto ? (
                    <img
                      src={client.profilePhoto}
                      alt={`${client.firstName} ${client.lastName}`}
                      className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border-2 border-saas-primary-muted"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-saas-primary-muted flex items-center justify-center bg-saas-bg">
                      <span className="text-2xl">👤</span>
                    </div>
                  )}
                  <p className="font-bold text-sm text-saas-text-main">{client.firstName} {client.lastName}</p>
                  <p className="text-saas-text-muted text-xs">📱 {client.phone}</p>
                  <p className="text-saas-text-muted text-xs">🆔 {client.licenseNumber}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Selected Client Summary */}
      {formData.step4?.selectedClient && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-linear-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200"
        >
          <h4 className="text-lg font-black text-green-900 mb-4 flex items-center gap-2">
            <CheckCircle size={20} />
            {lang === 'fr' ? 'Client Sélectionné' : 'العميل المختار'}
          </h4>
          <div className="flex items-center gap-4">
            {formData.step4.selectedClient.profilePhoto ? (
              <img
                src={formData.step4.selectedClient.profilePhoto}
                alt={`${formData.step4.selectedClient.firstName} ${formData.step4.selectedClient.lastName}`}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-200">
                <span className="text-lg">👤</span>
              </div>
            )}
            <div>
              <p className="font-bold text-lg text-saas-text-main">{formData.step4.selectedClient.firstName} {formData.step4.selectedClient.lastName}</p>
              <p className="text-saas-text-muted">{formData.step4.selectedClient.phone}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Client Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        lang={lang}
      />
    </div>
  );
};

// Step: Protection Assurance selection (before Services)
export const Step5ProtectionAssurance: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => {
  const [assurances, setAssurances] = useState<ProtectionAssurance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setAssurances(await DatabaseService.getProtectionAssurances());
      } catch (err) {
        console.error('Error loading protection assurances:', err);
        setAssurances([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selected = formData.protectionAssurance || null;

  // Nombre de jours (pour afficher le coût total du forfait)
  const days = (() => {
    const d1 = formData.step1?.departureDate;
    const d2 = formData.step1?.returnDate;
    if (!d1 || !d2) return 0;
    return Math.max(0, Math.ceil((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24)));
  })();

  const selectAssurance = (a: ProtectionAssurance | null) => {
    setFormData(prev => ({ ...prev, protectionAssurance: a || undefined }));
  };

  return (
    <ProtectionAssuranceCards
      lang={lang}
      assurances={assurances}
      loading={loading}
      selected={selected}
      onSelect={selectAssurance}
      days={days}
    />
  );
};

// Step 5: Additional Services
export const Step5AdditionalServices: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => {
  const [services, setServices] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [driverCaution, setDriverCaution] = useState(0);
  const [newService, setNewService] = useState({ name: '', price: 0, description: '', category: 'service', isMandatory: false });
  const [showNewServiceForm, setShowNewServiceForm] = useState(false);
  const [showDriverList, setShowDriverList] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; serviceId: string | null; serviceName: string }>({ show: false, serviceId: null, serviceName: '' });

  // Load services from database on mount
  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoadingServices(true);
        const dbServices = await DatabaseService.getServices();
        setServices(dbServices);

        // Services obligatoires : cochés automatiquement dès l'arrivée sur
        // l'étape, sans écraser une sélection déjà faite.
        const mandatory = dbServices.filter((s: any) => s.isMandatory);
        if (mandatory.length > 0) {
          setFormData(prev => {
            const current = prev.step5?.additionalServices || [];
            const missing = mandatory.filter((m: any) =>
              !current.some((c: any) => c.id === m.id || (c.name && c.name === m.name))
            );
            if (missing.length === 0) return prev;
            return {
              ...prev,
              step5: {
                ...prev.step5,
                additionalServices: [
                  ...current,
                  ...missing.map((m: any) => ({ ...m, selected: true, isMandatory: true })),
                ],
              },
            } as any;
          });
        }
      } catch (err) {
        console.error('Error loading services:', err);
        setServices([]);
      } finally {
        setLoadingServices(false);
      }
    };
    loadServices();
  }, []);

  // Ensure selected services are properly maintained when services load
  useEffect(() => {
    if (services.length > 0 && formData.step5?.additionalServices) {
      // Check if all selected services still exist in the loaded services
      // For editing existing reservations, the services come from reservation_services table
      // We need to match them with the master services table
      const validServices = formData.step5.additionalServices.map(selectedService => {
        // Try to find matching service in master services table
        const matchingMasterService = services.find(masterService => {
          const masterName = masterService.name || masterService.service_name;
          const selectedName = (selectedService.name || selectedService.service_name);
          const idsMatch = masterService.id && (masterService.id === selectedService.id || masterService.id === selectedService.originalServiceId || masterService.id === selectedService.service_id);
          const namesMatch = masterName && selectedName && masterName === selectedName;
          const categoriesMatch = !selectedService.category || masterService.category === selectedService.category;
          return categoriesMatch && (idsMatch || namesMatch);
        });

        // If found, use the master service data but keep the selected service's additional fields
        if (matchingMasterService) {
          return {
            ...matchingMasterService,
            ...selectedService, // Keep any additional fields like driver_id, driver_caution
            originalServiceId: matchingMasterService.id // Ensure we have the master service ID
          };
        }

        // If not found in master services, keep the selected service as-is
        return selectedService;
      });

      // Only update if the services actually changed
      const servicesChanged = validServices.length !== formData.step5.additionalServices.length ||
        validServices.some((service, index) => {
          const original = formData.step5.additionalServices[index];
          const originalName = original?.name || original?.service_name;
          const newName = service?.name || service?.service_name;
          return !original || newName !== originalName || service.category !== original.category;
        });

      if (servicesChanged) {
        setFormData(prev => ({
          ...prev,
          step5: {
            additionalServices: validServices
          }
        }));
      }
    }
  }, [services]); // Only depend on services, not formData.step5.additionalServices

  // Load drivers when toggle is clicked
  const loadDrivers = async () => {
    if (drivers.length > 0) {
      setShowDriverList(!showDriverList);
      return;
    }
    try {
      setLoadingDrivers(true);
      const dbDrivers = await DatabaseService.getDrivers();
      setDrivers(dbDrivers);
      setShowDriverList(true);
    } catch (err) {
      console.error('Error loading drivers:', err);
      setDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const servicesEqual = (master: any, selected: any) => {
    if (!master || !selected) return false;
    const masterId = master.id;
    const selId = selected.id || selected.originalServiceId || selected.service_id;
    const masterName = master.name || master.service_name;
    const selName = selected.name || selected.service_name;

    if (masterId && selId && masterId === selId) return true;
    if (masterName && selName && masterName === selName) return true;
    return false;
  };

  const toggleService = (service: any) => {
    // Un service obligatoire ne peut pas être décoché.
    if (service.isMandatory) return;

    const currentServices = formData.step5?.additionalServices || [];
    const isSelected = currentServices.some(s => servicesEqual(service, s) || servicesEqual(s, service));

    if (isSelected) {
      setFormData(prev => ({
        ...prev,
        step5: {
          additionalServices: currentServices.filter(s => !(servicesEqual(s, service) || servicesEqual(service, s)))
        }
      }));
    } else {
      // Add the service with the original service ID for reference
      const serviceToAdd = {
        ...service,
        originalServiceId: service.id // Keep reference to original service
      };
      setFormData(prev => ({
        ...prev,
        step5: {
          additionalServices: [...currentServices, serviceToAdd]
        }
      }));
    }
  };

  const createNewService = async () => {
    if (newService.name && newService.price > 0) {
      try {
        const created = await DatabaseService.createService({
          category: newService.category,
          name: newService.name,
          description: newService.description,
          price: newService.price,
          isMandatory: newService.isMandatory,
        });

        setServices(prev => [...prev, created]);
        // Ajoute directement le nouveau service à la sélection. Un service
        // obligatoire est ignoré par toggleService, on l'insère donc manuellement.
        setFormData(prev => {
          const current = prev.step5?.additionalServices || [];
          if (current.some(s => s.id === created.id)) return prev;
          return {
            ...prev,
            step5: {
              ...prev.step5,
              additionalServices: [
                ...current,
                { ...created, originalServiceId: created.id, selected: true },
              ],
            },
          } as any;
        });

        setNewService({
          name: '',
          price: 0,
          description: '',
          category: 'service',
          isMandatory: false,
        });
        setShowNewServiceForm(false);
      } catch (err) {
        console.error('Error creating service:', err);
        alert(lang === 'fr' ? 'Erreur lors de la création du service' : 'خطأ في إنشاء الخدمة');
      }
    }
  };

  const deleteService = async (serviceId: string) => {
    setDeleteConfirmation({ show: true, serviceId, serviceName: services.find(s => s.id === serviceId)?.name || '' });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.serviceId) return;

    try {
      await DatabaseService.deleteService(deleteConfirmation.serviceId);
      setServices(prev => prev.filter(s => s.id !== deleteConfirmation.serviceId));
      
      // Remove from selected services if it was selected
      const currentServices = formData.step5?.additionalServices || [];
      if (currentServices.some(s => s.id === deleteConfirmation.serviceId)) {
        setFormData(prev => ({
          ...prev,
          step5: {
            additionalServices: currentServices.filter(s => s.id !== deleteConfirmation.serviceId)
          }
        }));
      }

      setDeleteConfirmation({ show: false, serviceId: null, serviceName: '' });
    } catch (err) {
      console.error('Error deleting service:', err);
      alert(lang === 'fr' ? 'Erreur lors de la suppression du service' : 'خطأ في حذف الخدمة');
      setDeleteConfirmation({ show: false, serviceId: null, serviceName: '' });
    }
  };

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-black text-slate-900">
        🛠️ {lang === 'fr' ? 'Services Supplémentaires' : 'الخدمات الإضافية'}
      </h3>

      {/* Add New Service Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowNewServiceForm(true)}
          className="btn-saas-primary"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          {lang === 'fr' ? 'Créer un Service' : 'إنشاء خدمة'}
        </button>
      </div>

      {/* Loading State */}
      {loadingServices ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-saas-primary-via"></div>
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl opacity-30 mb-4">🛠️</div>
          <p className="text-saas-text-muted font-semibold">
            {lang === 'fr' ? 'Aucun service disponible' : 'لا توجد خدمات متاحة'}
          </p>
        </div>
      ) : (
        /* Available Services */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((service) => {
            const isSelected = formData.step5?.additionalServices?.some(s => 
              servicesEqual(service, s) || servicesEqual(s, service)
            );

            return (
              <motion.div
                key={service.id}
                onClick={() => toggleService(service)}
                whileHover={{ scale: 1.02 }}
                className={`border-2 rounded-2xl p-6 cursor-pointer transition-all group relative ${
                  isSelected
                    ? 'border-green-500 bg-green-50 shadow-lg'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteService(service.id);
                  }}
                  className="absolute bottom-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
                  title={lang === 'fr' ? 'Supprimer ce service' : 'حذف هذه الخدمة'}
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-slate-900 flex items-center gap-2 flex-wrap">
                      {service.name}
                      {service.isMandatory && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#DC2626] bg-[#DC2626]/10 border border-[#DC2626]/25 px-2 py-0.5 rounded-full">
                          {lang === 'fr' ? 'Obligatoire' : 'إلزامي'}
                        </span>
                      )}
                    </h4>
                    <p className="text-slate-600 text-sm mb-2">{service.description}</p>
                    <p className="font-bold text-green-700">{service.price.toLocaleString()} DA</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'border-green-500 bg-green-500' : 'border-slate-300'
                  }`}>
                    {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Chauffeur Selection */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
        <h4 className="text-lg font-black text-blue-900 mb-4">
          🚗 {lang === 'fr' ? 'Chauffeur (Optionnel)' : 'السائق (اختياري)'}
        </h4>

        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-blue-900">
            {lang === 'fr' ? 'Activer le chauffeur' : 'تفعيل السائق'}
          </span>
          <button
            onClick={loadDrivers}
            disabled={loadingDrivers}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              selectedDriver ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                selectedDriver ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Driver List */}
        {showDriverList && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 mt-4 pt-4 border-t border-blue-200"
          >
            {loadingDrivers ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : drivers.length === 0 ? (
              <p className="text-blue-700 text-center py-4">
                {lang === 'fr' ? 'Aucun chauffeur disponible' : 'لا توجد سائقين متاحين'}
              </p>
            ) : (
              <div className="space-y-2">
                {drivers.map((driver) => (
                  <div
                    key={driver.id}
                    onClick={() => {
                      setSelectedDriver(driver);
                      setShowDriverList(false);
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedDriver?.id === driver.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {driver.fullName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{driver.fullName}</p>
                        <p className="text-slate-600 text-sm">📱 {driver.phone}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Selected Driver */}
        {selectedDriver && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {selectedDriver.fullName.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{selectedDriver.fullName}</p>
                <p className="text-blue-700">📱 {selectedDriver.phone}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Caution Amount */}
      {selectedDriver && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-200">
          <label className="block font-bold text-yellow-900 mb-2">
            💰 {lang === 'fr' ? 'Caution Requise (DA)' : 'الضمان المطلوب (دج)'}
          </label>
          <input
            type="number"
            value={driverCaution}
            onChange={(e) => setDriverCaution(Number(e.target.value))}
            placeholder="0"
            className="w-full p-3 border border-yellow-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Selected Services Summary */}
      {formData.step5?.additionalServices && formData.step5.additionalServices.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
          <h4 className="text-lg font-black text-blue-900 mb-4">
            🛒 {lang === 'fr' ? 'Services Sélectionnés' : 'الخدمات المختارة'}
          </h4>
          <div className="space-y-2">
            {formData.step5.additionalServices.map((service) => (
              <div key={service.id} className="flex justify-between items-center">
                <span className="font-bold">{service.name}</span>
                <span className="font-bold text-blue-700">{service.price.toLocaleString()} DA</span>
              </div>
            ))}
            {selectedDriver && driverCaution > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-bold">💰 {lang === 'fr' ? 'Caution Chauffeur' : 'ضمان السائق'}</span>
                <span className="font-bold text-blue-700">{driverCaution.toLocaleString()} DA</span>
              </div>
            )}
            <div className="border-t border-blue-300 pt-2 mt-4">
              <div className="flex justify-between items-center text-lg font-black">
                <span>{lang === 'fr' ? 'Total Suppléments' : 'إجمالي الملاحق'}</span>
                <span>
                  {(
                    formData.step5.additionalServices.reduce((sum, s) => sum + s.price, 0) +
                    (selectedDriver && driverCaution > 0 ? driverCaution : 0)
                  ).toLocaleString()} DA
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Service Modal */}
      <AnimatePresence>
        {showNewServiceForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto sm:py-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[calc(100vh-4rem)] overflow-y-auto"
            >
              <h3 className="text-xl font-black text-slate-900 mb-6">
                ➕ {lang === 'fr' ? 'Créer un Service' : 'إنشاء خدمة'}
              </h3>

              <div className="space-y-5">
                {/* Service Category */}
                <div>
                  <label className="block font-bold text-slate-900 mb-2">
                    📂 {lang === 'fr' ? 'Catégorie' : 'الفئة'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: 'service', fr: 'Service', ar: 'خدمة', icon: '🛎️' },
                      { value: 'decoration', fr: 'Décoration', ar: 'زينة', icon: '🎀' },
                      { value: 'equipment', fr: 'Équipement', ar: 'معدات', icon: '🧰' },
                      { value: 'insurance', fr: 'Assurance', ar: 'تأمين', icon: '🛡️' },
                    ].map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewService(prev => ({ ...prev, category: c.value }))}
                        className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-bold transition-all ${
                          newService.category === c.value
                            ? 'border-saas-primary-via bg-saas-primary-via/5 text-saas-primary-via'
                            : 'border-slate-200 text-slate-500 hover:border-saas-primary-via/40'
                        }`}
                      >
                        <span className="text-lg">{c.icon}</span>
                        {lang === 'fr' ? c.fr : c.ar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-900 mb-2">
                      {lang === 'fr' ? 'Nom du service' : 'اسم الخدمة'}
                    </label>
                    <input
                      placeholder={lang === 'fr' ? 'Ex : Nettoyage véhicule' : 'مثال: تنظيف السيارة'}
                      value={newService.name}
                      onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-900 mb-2">
                      {lang === 'fr' ? 'Prix (DA)' : 'السعر (دج)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={newService.price || ''}
                      onChange={(e) => setNewService(prev => ({ ...prev, price: Number(e.target.value) }))}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-900 mb-2">
                    {lang === 'fr' ? 'Description (optionnel)' : 'الوصف (اختياري)'}
                  </label>
                  <textarea
                    placeholder={lang === 'fr' ? 'Détails du service…' : 'تفاصيل الخدمة…'}
                    value={newService.description}
                    onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>

                {/* Service obligatoire */}
                <button
                  type="button"
                  onClick={() => setNewService(prev => ({ ...prev, isMandatory: !prev.isMandatory }))}
                  className={`w-full flex items-start gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    newService.isMandatory ? 'border-[#DC2626] bg-[#DC2626]/6' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`relative w-11 h-6 rounded-full shrink-0 mt-0.5 transition-colors ${newService.isMandatory ? 'bg-[#DC2626]' : 'bg-slate-300'}`}
                  >
                    <motion.span
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                      style={{ left: newService.isMandatory ? 22 : 2 }}
                    />
                  </span>
                  <span>
                    <span className="block font-black text-slate-900">
                      {lang === 'fr' ? 'Service obligatoire' : 'خدمة إلزامية'}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {lang === 'fr'
                        ? "Sélectionné automatiquement à l'étape « Services » de chaque nouvelle réservation, dans l'application comme sur le site public. Le client ne peut pas le décocher."
                        : 'يتم اختياره تلقائياً في خطوة «الخدمات» لكل حجز جديد، في التطبيق وفي الموقع. لا يمكن للعميل إلغاء تحديده.'}
                    </span>
                  </span>
                </button>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewServiceForm(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg"
                >
                  {lang === 'fr' ? 'Annuler' : 'إلغاء'}
                </button>
                <button
                  onClick={createNewService}
                  disabled={!newService.name || newService.price <= 0}
                  className="flex-1 btn-saas-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
                >
                  {lang === 'fr' ? 'Créer Service' : 'إنشاء الخدمة'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 p-4 overflow-y-auto sm:py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-red-200"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">
              {lang === 'fr' ? 'Confirmer la suppression' : 'تأكيد الحذف'}
            </h3>
            <p className="text-slate-600 text-center mb-6">
              {lang === 'fr' 
                ? `Êtes-vous sûr de vouloir supprimer le service "${deleteConfirmation.serviceName}"?` 
                : `هل أنت متأكد من حذف "${deleteConfirmation.serviceName}"?`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmation({ show: false, serviceId: null, serviceName: '' })}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
              >
                {lang === 'fr' ? 'Annuler' : 'إلغاء'}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                {lang === 'fr' ? 'Supprimer' : 'حذف'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// Step 6: Final Pricing
export const Step6FinalPricing: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
  inspectionMode?: boolean;
  initialData?: Partial<ReservationDetails>;
  agencies: any[];
  // When true, hide the client information section (used when this step is shown
  // before the client has been selected in the alternative flow).
  hideClientInfo?: boolean;
}> = ({ lang, formData, setFormData, inspectionMode, initialData, agencies, hideClientInfo = false }) => {
  const [tvaEnabled, setTvaEnabled] = useState(false);
  const [tvaRate, setTvaRate] = useState(19); // Default TVA rate
  const [advancePayment, setAdvancePayment] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isManualTotal, setIsManualTotal] = useState(false);
  const [manualTotal, setManualTotal] = useState<number | ''>('');
  const [cautionEnabled, setCautionEnabled] = useState(true);
  const [editedDeposit, setEditedDeposit] = useState<number | ''>('');
  
  // Multi-currency caution states
  const [cautionCurrency, setCautionCurrency] = useState<'DZD' | 'EUR'>('DZD');
  const [euroAmount, setEuroAmount] = useState<number | ''>('');
  const [euroRate, setEuroRate] = useState(145); // Default exchange rate
  
  // Assurance Serenity states
  const [assuranceEnabled, setAssuranceEnabled] = useState(false);
  const [assurancePercentage, setAssurancePercentage] = useState<number | ''>('');

  // Timbre fiscal (droit de timbre) — barème par tranche de 100 DA
  const [timbreEnabled, setTimbreEnabled] = useState(false);

  const hasInitialized = React.useRef(false);

  // TVA rates options
  const tvaRates = [0, 9, 19, 21];

  // Log on component mount
  useEffect(() => {
    return () => {
    };
  }, []);

  // Initialize from existing step6 data (only once per reservation)
  useEffect(() => {
    // Reset initialization flag if formData.id changes (different reservation being edited)
    if ((formData as any).id && hasInitialized.current) {
      hasInitialized.current = false;
    }
    
    // Réservation existante SANS step6 (ex. inspection depuis le planificateur) :
    // on reprend les valeurs ENREGISTRÉES (prix manuel, caution, timbre…) au
    // lieu de tout recalculer — sinon le prix modifié à la création était perdu.
    if (!hasInitialized.current && !formData.step6?.pricing && !formData.step6?.totalPrice && (formData as any).id && (formData as any).totalPrice !== undefined) {
      hasInitialized.current = true;
      const r: any = formData;
      setTvaEnabled(!!r.tvaApplied);
      setAdvancePayment(r.advancePayment || 0);
      setPaymentNotes(r.notes || '');
      if (r.isManualPrice) {
        setIsManualTotal(true);
        setManualTotal(Number(r.totalPrice) || 0);
      }
      setCautionEnabled(r.cautionEnabled !== false);
      setCautionCurrency(r.cautionCurrency || 'DZD');
      setEuroRate(r.euroRate || 145);
      if (r.cautionCurrency === 'EUR' && r.euroRate) {
        setEuroAmount(Math.round(((r.cautionAmountDzd || r.deposit || 0) / r.euroRate) * 100) / 100);
      }
      if (r.cautionAmountDzd) setEditedDeposit(r.cautionAmountDzd);
      setAssuranceEnabled(!!r.assuranceEnabled);
      setAssurancePercentage(r.assurancePercentage || '');
      setTimbreEnabled(!!r.timbreEnabled);
      return;
    }

    if (!hasInitialized.current && formData.step6) {
      hasInitialized.current = true;
      setCautionEnabled((formData.step6 as any).cautionEnabled !== false);
      setTvaEnabled(formData.step6.tvaApplied || false);
      setTvaRate(19); // Default
      setAdvancePayment(formData.step6.advancePayment || 0);
      setPaymentNotes(formData.step6.paymentNotes || '');
      // Initialize manual total fields
      setIsManualTotal(formData.step6.isManualTotal || false);
      setManualTotal(formData.step6.totalPrice || '');
      // Initialize currency fields
      const savedCurrency = (formData.step6 as any).cautionCurrency || 'DZD';
      const savedEuroAmount = (formData.step6 as any).euroAmount || '';
      const savedEuroRate = (formData.step6 as any).euroRate || 145;
      const savedCautionDzd = (formData.step6 as any).caution_amount_dzd;
      
      console.log('💾 STEP6 INITIALIZATION:');
      console.log('   ├─ cautionCurrency:', savedCurrency);
      console.log('   ├─ euroAmount:', savedEuroAmount);
      console.log('   ├─ euroRate:', savedEuroRate);
      console.log('   ├─ caution_amount_dzd:', savedCautionDzd);
      console.log('   ├─ assuranceEnabled:', (formData.step6 as any).assuranceEnabled);
      console.log('   └─ assurancePercentage:', (formData.step6 as any).assurancePercentage);
      
      setCautionCurrency(savedCurrency);
      setEuroAmount(savedEuroAmount);
      setEuroRate(savedEuroRate);
      
      // Initialize editedDeposit from saved caution_amount_dzd if it differs from default
      if (savedCautionDzd && savedCautionDzd !== deposit) {
        console.log('💾 Setting editedDeposit from saved caution_amount_dzd:', savedCautionDzd);
        setEditedDeposit(savedCautionDzd);
      } else if (savedCautionDzd) {
        setEditedDeposit(savedCautionDzd);
      }
      
      // Initialize assurance fields
      setAssuranceEnabled((formData.step6 as any).assuranceEnabled || false);
      setAssurancePercentage((formData.step6 as any).assurancePercentage || '');

      // Timbre fiscal
      setTimbreEnabled((formData.step6 as any).timbreEnabled || false);
    }
  }, [(formData as any).id]); // Reinitialize when editing a different reservation

  // Initialize editedDeposit from formData or selectedCar
  useEffect(() => {
    if (formData.deposit) {
      setEditedDeposit(formData.deposit);
    } else if (formData.step2?.selectedCar) {
      setEditedDeposit(formData.step2.selectedCar.deposit || 0);
    } else if ((formData as any).car) {
      setEditedDeposit((formData as any).car.deposit || 0);
    }
  }, [formData.step2?.selectedCar, (formData as any).car]);

  // Auto-calculate DZD from EUR
  useEffect(() => {
    if (cautionCurrency === 'EUR' && euroAmount && euroRate) {
      const dzd = Math.round(Number(euroAmount) * Number(euroRate));
      setEditedDeposit(dzd);
    }
  }, [cautionCurrency, euroAmount, euroRate]);

  // Calculate pricing
  // Get car data from either step2 (new flow) or car (existing reservation/inspection)
  const selectedCar = formData.step2?.selectedCar || (formData as any).car;
  
  const days = formData.step1?.departureDate && formData.step1?.returnDate
    ? Math.ceil((new Date(formData.step1.returnDate).getTime() - new Date(formData.step1.departureDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // La durée est facturée par tranches décroissantes : mois entiers au total
  // mois, semaines entières au total semaine, puis les jours isolés au tarif
  // journalier. Une période d'exactement 7 ou 30 jours tombe donc bien sur le
  // total « formule » saisi sur le véhicule.
  const rental = computeRentalBase(selectedCar, days);
  const calculatedBasePrice = rental.total;
  const monthlyPrice = rental.monthsAmount;
  const weeklyPrice = rental.weeksAmount;
  const remainingPrice = rental.extraDaysAmount;
  const months = rental.months;
  const weeks = rental.weeks;
  const remainingDays = rental.extraDays;

  const servicesTotal = formData.step5?.additionalServices?.reduce((sum, s) => sum + s.price, 0) || 0;
  // Assurance de protection : prix/jour × nombre de jours
  const protectionAssuranceCost = formData.protectionAssurance
    ? Math.round((formData.protectionAssurance.pricePerDay || 0) * days)
    : 0;
  const subtotal = calculatedBasePrice + servicesTotal + protectionAssuranceCost;
  const tvaAmount = tvaEnabled ? (subtotal * tvaRate) / 100 : 0;
  const computedPrice = Math.max(0, Math.round(subtotal + tvaAmount));
  const deposit = editedDeposit !== '' ? Number(editedDeposit) : (selectedCar?.deposit || 0);
  const totalPrice = isManualTotal && manualTotal !== '' ? Math.max(0, Math.round(Number(manualTotal))) : computedPrice;
  
  // Calculate assurance amount
  const assuranceAmount = assuranceEnabled && assurancePercentage !== ''
    ? Math.round(totalPrice * (Number(assurancePercentage) / 100))
    : 0;

  // Timbre fiscal : calculé sur le total location + assurance Serenity.
  // Barème par tranche de 100 DA — 1 % / 1,5 % / 2 % selon le montant.
  const timbreBase = totalPrice + assuranceAmount;
  const timbre = computeTimbre(timbreBase);
  const timbreAmount = timbreEnabled ? timbre.amount : 0;

  const finalTotal = totalPrice + assuranceAmount + timbreAmount;

  // Console logging for debugging
  React.useEffect(() => {
  }, [days, weeks, remainingDays, calculatedBasePrice, servicesTotal, tvaAmount, computedPrice, totalPrice, deposit, editedDeposit, tvaEnabled, tvaRate, isManualTotal, manualTotal]);

  // Update formData with values (manual override takes precedence)
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      step1: {
        ...prev.step1,
        departureDate: formData.step1?.departureDate || prev.step1?.departureDate,
        returnDate: formData.step1?.returnDate || prev.step1?.returnDate
      },
      step6: {
        ...prev.step6,
        totalPrice: totalPrice,
        isManualTotal: isManualTotal,
        manualTotal: manualTotal,
        tvaApplied: tvaEnabled,
        tvaAmount: tvaAmount,
        additionalFees: prev.step6?.additionalFees ?? prev.additionalFees,
        advancePayment: prev.step6?.advancePayment ?? prev.advancePayment,
        remainingPayment: prev.step6?.remainingPayment ?? prev.remainingPayment,
        paymentNotes: prev.step6?.paymentNotes ?? prev.notes,
        cautionEnabled: cautionEnabled,
        // Multi-currency caution fields
        cautionCurrency: cautionCurrency,
        euroAmount: euroAmount,
        euroRate: euroRate,
        // Assurance fields
        assuranceEnabled: assuranceEnabled,
        assurancePercentage: assurancePercentage,
        assuranceAmount: assuranceAmount,
        finalTotal: finalTotal,
        // Timbre fiscal (repris sur le contrat imprimé)
        timbreEnabled: timbreEnabled,
        timbreRate: timbreEnabled ? timbre.rate : null,
        timbreAmount: timbreAmount,
        // Caution amount in DZD for database
        caution_amount_dzd: cautionCurrency === 'EUR' && euroAmount && euroRate
          ? Math.round(Number(euroAmount) * Number(euroRate))
          : (editedDeposit !== '' ? Number(editedDeposit) : deposit),
      },
      deposit: deposit,
      totalPrice: totalPrice
    }));
  }, [totalPrice, isManualTotal, manualTotal, tvaEnabled, tvaAmount, cautionEnabled, cautionCurrency, euroAmount, euroRate, assuranceEnabled, assurancePercentage, assuranceAmount, timbreEnabled, timbreAmount, timbre.rate, finalTotal, deposit, editedDeposit]);

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-black text-slate-900">
        💰 {lang === 'fr' ? 'Récapitulatif de la Réservation' : 'ملخص الحجز'}
      </h3>

      {/* CLIENT INFORMATION SECTION */}
      {!hideClientInfo && formData.step4?.selectedClient && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border-2 border-orange-200">
          <h4 className="text-lg font-black text-orange-900 mb-4">👤 {lang === 'fr' ? 'Informations Client' : 'معلومات العميل'}</h4>
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Client Image */}
            <div className="flex-shrink-0 w-32 h-32 rounded-full overflow-hidden border-4 border-orange-300 shadow-lg bg-orange-100 flex items-center justify-center">
              {formData.step4.selectedClient.profilePhoto ? (
                <img
                  src={formData.step4.selectedClient.profilePhoto}
                  alt={`${formData.step4.selectedClient.firstName} ${formData.step4.selectedClient.lastName}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-5xl">👤</span>
              )}
            </div>
            {/* Client Details */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-bold text-orange-700 mb-1">{lang === 'fr' ? 'Nom Complet' : 'الاسم الكامل'}</p>
                <p className="text-lg font-bold text-orange-900">{formData.step4.selectedClient.firstName} {formData.step4.selectedClient.lastName}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-orange-700 mb-1">{lang === 'fr' ? 'Téléphone' : 'الهاتف'}</p>
                <p className="text-lg font-bold text-orange-900">{formData.step4.selectedClient.phone}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-orange-700 mb-1">{lang === 'fr' ? 'Email' : 'البريد الإلكتروني'}</p>
                <p className="text-lg text-orange-900">{formData.step4.selectedClient.email || '-'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm font-bold text-orange-700 mb-1">{lang === 'fr' ? 'Adresse' : 'العنوان'}</p>
                <p className="text-lg text-orange-900">{formData.step4.selectedClient.completeAddress || formData.step4.selectedClient.wilaya || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CAR INFORMATION SECTION */}
      {formData.step2?.selectedCar && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
          <h4 className="text-lg font-black text-blue-900 mb-4">🚗 {lang === 'fr' ? 'Informations du Véhicule' : 'معلومات المركبة'}</h4>
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Car Image */}
            <div className="flex-shrink-0">
              <img
                src={formData.step2.selectedCar.images[0]}
                alt={`${formData.step2.selectedCar.brand} ${formData.step2.selectedCar.model}`}
                className="w-40 h-32 rounded-lg object-cover border-3 border-blue-300 shadow-lg"
              />
            </div>
            {/* Car Details */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">{lang === 'fr' ? 'Modèle' : 'الموديل'}</p>
                <p className="text-lg font-bold text-blue-900">{formData.step2.selectedCar.brand} {formData.step2.selectedCar.model}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">{lang === 'fr' ? 'Immatriculation' : 'رقم التسجيل'}</p>
                <p className="text-lg font-bold text-blue-900">{formData.step2.selectedCar.registration}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">{lang === 'fr' ? 'Couleur' : 'اللون'}</p>
                <p className="text-lg text-blue-900">{formData.step2.selectedCar.color}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">{lang === 'fr' ? 'Carburant' : 'الوقود'}</p>
                <p className="text-lg text-blue-900">⛽ {formData.step2.selectedCar.energy || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">{lang === 'fr' ? 'Caution' : 'الضمان'}</p>
                <p className="text-lg font-bold text-blue-900">{formData.step2.selectedCar.deposit.toLocaleString()} DA</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">{lang === 'fr' ? 'Transmission' : 'ناقل الحركة'}</p>
                <p className="text-lg text-blue-900">{formData.step2.selectedCar.transmission || '-'}</p>
              </div>
            </div>
          </div>
          {/* Pricing Grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-blue-200">
            <div className="text-center">
              <p className="text-sm text-blue-600 font-bold">{lang === 'fr' ? 'Prix/Jour' : 'السعر/يوم'}</p>
              <p className="text-2xl font-black text-blue-900">{formData.step2.selectedCar.priceDay.toLocaleString()} DA</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-blue-600 font-bold">{lang === 'fr' ? `Prix/Jour · ${WEEK_DAYS} j` : `السعر/يوم · ${WEEK_DAYS} أيام`}</p>
              <p className="text-2xl font-black text-blue-900">{weekDayRate(formData.step2.selectedCar).toLocaleString()} DA</p>
              <p className="text-xs font-bold text-blue-600">({weekTotal(formData.step2.selectedCar).toLocaleString()} DA / {lang === 'fr' ? 'semaine' : 'أسبوع'})</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-blue-600 font-bold">{lang === 'fr' ? `Prix/Jour · ${MONTH_DAYS} j` : `السعر/يوم · ${MONTH_DAYS} يوماً`}</p>
              <p className="text-2xl font-black text-blue-900">{monthDayRate(formData.step2.selectedCar).toLocaleString()} DA</p>
              <p className="text-xs font-bold text-blue-600">({monthTotal(formData.step2.selectedCar).toLocaleString()} DA / {lang === 'fr' ? 'mois' : 'شهر'})</p>
            </div>
          </div>
        </div>
      )}

      {/* RESERVATION DETAILS SECTION */}
      <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200">
        <h4 className="text-lg font-black text-slate-900 mb-4">📋 {lang === 'fr' ? 'Détails de la Réservation' : 'تفاصيل الحجز'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-bold text-slate-700 mb-1">📅 {lang === 'fr' ? 'Date de Départ' : 'تاريخ المغادرة'}</p>
            <p className="text-lg font-bold text-slate-900">{formData.step1?.departureDate}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-bold text-slate-700 mb-1">📅 {lang === 'fr' ? 'Date de Retour' : 'تاريخ العودة'}</p>
            <p className="text-lg font-bold text-slate-900">{formData.step1?.returnDate}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-bold text-slate-700 mb-1">⏱️ {lang === 'fr' ? 'Durée' : 'المدة'}</p>
            <p className="text-lg font-bold text-slate-900">{days} {lang === 'fr' ? 'jours' : 'أيام'}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-bold text-slate-700 mb-2">📊 {lang === 'fr' ? 'Semaines/Jours (Éditable)' : 'أسابيع/أيام (قابل للتعديل)'}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">{lang === 'fr' ? 'Semaines' : 'أسابيع'}</label>
                <input
                  type="number"
                  min="0"
                  value={weeks}
                  onChange={(e) => {
                    const newWeeks = Number(e.target.value) || 0;
                    const newRemainingDays = remainingDays;
                    const totalNewDays = (newWeeks * 7) + newRemainingDays;
                    if (totalNewDays > 0 && formData.step1?.departureDate) {
                      const departure = new Date(formData.step1.departureDate);
                      const newReturn = new Date(departure);
                      newReturn.setDate(newReturn.getDate() + totalNewDays);
                      const returnDateStr = newReturn.toISOString().split('T')[0];
                      setFormData(prev => ({
                        ...prev,
                        step1: { ...prev.step1!, returnDate: returnDateStr }
                      }));
                    }
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">{lang === 'fr' ? 'Jours' : 'أيام'}</label>
                <input
                  type="number"
                  min="0"
                  max="6"
                  value={remainingDays}
                  onChange={(e) => {
                    const newRemainingDays = Math.min(Number(e.target.value) || 0, 6);
                    const totalNewDays = (weeks * 7) + newRemainingDays;
                    if (totalNewDays > 0 && formData.step1?.departureDate) {
                      const departure = new Date(formData.step1.departureDate);
                      const newReturn = new Date(departure);
                      newReturn.setDate(newReturn.getDate() + totalNewDays);
                      const returnDateStr = newReturn.toISOString().split('T')[0];
                      setFormData(prev => ({
                        ...prev,
                        step1: { ...prev.step1!, returnDate: returnDateStr }
                      }));
                    }
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-bold"
                />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-bold text-slate-700 mb-1">📍 {lang === 'fr' ? 'Lieu de Départ' : 'مكان المغادرة'}</p>
            <p className="text-lg font-bold text-slate-900">{
              (() => {
                let agencyId = null;
                if (inspectionMode && initialData && initialData.status === 'accepted') {
                  agencyId = initialData.departure_agency_id;
                } else if (formData.step1?.departureLocation) {
                  // Try to match by agency name
                  const agencyByName = (agencies || []).find(a => a.name === formData.step1.departureLocation);
                  if (agencyByName) return `${agencyByName.name}${agencyByName.address ? ' - ' + agencyByName.address : ''}`;
                  // fallback: treat as ID
                  agencyId = formData.step1.departureLocation;
                }
                if (agencyId) {
                  const agency = (agencies || []).find(a => a.id === agencyId);
                  return agency ? `${agency.name}${agency.address ? ' - ' + agency.address : ''}` : 'Agence non trouvée';
                }
                return 'Non spécifié';
              })()
            }</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-bold text-slate-700 mb-1">📍 {lang === 'fr' ? 'Lieu de Retour' : 'مكان العودة'}</p>
            <p className="text-lg font-bold text-slate-900">{
              inspectionMode && initialData && initialData.status === 'accepted'
                ? (() => {
                    if (initialData.return_agency_id) {
                      const agency = (agencies || []).find(a => a.id === initialData.return_agency_id);
                      return agency ? `${agency.name}${agency.address ? ' - ' + agency.address : ''}` : 'Agence non trouvée';
                    }
                    return 'Non spécifié';
                  })()
                : (formData.step1?.returnLocation && formData.step1?.returnLocation.trim() !== ''
                    ? formData.step1?.returnLocation
                    : ((formData.step1?.departureLocation && formData.step1?.departureLocation.trim() !== '')
                        ? formData.step1?.departureLocation
                        : 'Non spécifié'))
            }</p>
          </div>
          {formData.step3?.selectedDriver && (
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-sm font-bold text-slate-700 mb-1">🧑‍✈️ {lang === 'fr' ? 'Chauffeur' : 'السائق'}</p>
              <p className="text-lg font-bold text-slate-900">{formData.step3.selectedDriver}</p>
            </div>
          )}
        </div>
      </div>

          {/* Pricing Breakdown */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
            <h4 className="text-lg font-black text-slate-900 mb-6">
              💰 {lang === 'fr' ? 'Décomposition du Prix' : 'تفصيل السعر'}
            </h4>

            <div className="space-y-4">
              {/* Base Price Breakdown */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h5 className="font-bold text-slate-900 mb-3">{lang === 'fr' ? 'Prix de Base du Véhicule' : 'سعر المركبة الأساسي'}</h5>
                <div className="space-y-2">
                  {months > 0 && (
                    <div className="flex justify-between items-center">
                      <span>
                        {months} {lang === 'fr' ? (months > 1 ? 'mois' : 'mois') : 'شهر'} × {rental.monthTotal.toLocaleString()} DA
                        <span className="text-slate-500"> ({monthDayRate(selectedCar).toLocaleString()} DA × {MONTH_DAYS} {lang === 'fr' ? 'j' : 'ي'})</span>
                      </span>
                      <span className="font-bold">{monthlyPrice.toLocaleString()} DA</span>
                    </div>
                  )}
                  {weeks > 0 && (
                    <div className="flex justify-between items-center">
                      <span>
                        {weeks} {lang === 'fr' ? (weeks > 1 ? 'semaines' : 'semaine') : 'أسبوع'} × {rental.weekTotal.toLocaleString()} DA
                        <span className="text-slate-500"> ({weekDayRate(selectedCar).toLocaleString()} DA × {WEEK_DAYS} {lang === 'fr' ? 'j' : 'ي'})</span>
                      </span>
                      <span className="font-bold">{weeklyPrice.toLocaleString()} DA</span>
                    </div>
                  )}
                  {remainingDays > 0 && (
                    <div className="flex justify-between items-center">
                      <span>{remainingDays} {lang === 'fr' ? 'jour(s)' : 'يوم'} × {rental.dayRate.toLocaleString()} DA</span>
                      <span className="font-bold">{remainingPrice.toLocaleString()} DA</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-300 pt-2 text-lg font-bold">
                    <span>{lang === 'fr' ? 'Sous-total Véhicule' : 'المجموع الفرعي للمركبة'}</span>
                    <span>{calculatedBasePrice.toLocaleString()} DA</span>
                  </div>
                </div>
              </div>

          {/* Services */}
          {formData.step5?.additionalServices && formData.step5.additionalServices.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h5 className="font-bold text-blue-900 mb-3">{lang === 'fr' ? 'Services Supplémentaires' : 'الخدمات الإضافية'}</h5>
              <div className="space-y-2">
                {formData.step5.additionalServices.map((service) => (
                  <div key={service.id} className="flex justify-between items-center">
                    <span>{service.name}</span>
                    <span>{service.price.toLocaleString()} DA</span>
                  </div>
                ))}
                <div className="flex justify-between items-center border-t border-blue-300 pt-2 font-bold">
                  <span>{lang === 'fr' ? 'Total Services' : 'إجمالي الخدمات'}</span>
                  <span>{servicesTotal.toLocaleString()} DA</span>
                </div>
              </div>
            </div>
          )}

          {/* Assurance de protection sélectionnée */}
          {formData.protectionAssurance && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <h5 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                🛡️ {lang === 'fr' ? 'Assurance de Protection' : 'تأمين الحماية'}
              </h5>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{formData.protectionAssurance.name}</span>
                <span className="text-sm text-red-700">
                  {(formData.protectionAssurance.pricePerDay || 0).toLocaleString()} DA/{lang === 'fr' ? 'j' : 'ي'} × {days}
                </span>
              </div>
              {formData.protectionAssurance.items && formData.protectionAssurance.items.length > 0 && (
                <div className="space-y-1 mb-2">
                  {formData.protectionAssurance.items.map((item) => (
                    <div key={item.linkId || item.itemId} className="flex items-center gap-2 text-sm">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                        item.status ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700'
                      }`}>
                        {item.status ? '✓' : '✕'}
                      </span>
                      <span className={item.status ? 'text-slate-700' : 'text-slate-400 line-through'}>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center border-t border-red-300 pt-2 font-bold">
                <span>{lang === 'fr' ? 'Total Assurance' : 'إجمالي التأمين'}</span>
                <span>{protectionAssuranceCost.toLocaleString()} DA</span>
              </div>
            </div>
          )}

          {/* TVA Section */}
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-bold text-yellow-900">{lang === 'fr' ? 'Taxe sur la Valeur Ajoutée (TVA)' : 'ضريبة القيمة المضافة (TVA)'}</h5>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={tvaEnabled}
                  onChange={(e) => setTvaEnabled(e.target.checked)}
                  className="w-4 h-4 text-yellow-600 border-yellow-300 rounded focus:ring-yellow-500"
                />
                <span className="font-bold text-yellow-900">{lang === 'fr' ? 'Appliquer TVA' : 'تطبيق TVA'}</span>
              </label>
            </div>

            {tvaEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-yellow-800 mb-2">
                    {lang === 'fr' ? 'Taux de TVA' : 'معدل TVA'}
                  </label>
                  <select
                    value={tvaRate}
                    onChange={(e) => setTvaRate(Number(e.target.value))}
                    className="w-full p-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    {tvaRates.map((rate) => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-between items-center text-lg font-bold text-yellow-900">
                  <span>TVA ({tvaRate}%)</span>
                  <span>{tvaAmount.toLocaleString()} DA</span>
                </div>
              </div>
            )}
          </div>

          {/* Final Total */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
            <div className="flex justify-between items-center text-xl font-black text-green-900">
              <span>{lang === 'fr' ? 'TOTAL LOCATION' : 'إجمالي التأجير'}</span>
              {!isManualTotal ? (
                <span>{totalPrice.toLocaleString()} DA</span>
              ) : (
                <input
                  type="number"
                  inputMode="decimal"
                  value={manualTotal === '' ? '' : manualTotal}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (value === '') {
                      setManualTotal('');
                    } else {
                      const numValue = parseInt(value, 10);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setManualTotal(numValue);
                      }
                    }
                  }}
                  className="w-32 p-1 border border-green-300 rounded text-right font-bold"
                />
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="manual-price-toggle"
                checked={isManualTotal}
                onChange={(e) => {
                  setIsManualTotal(e.target.checked);
                  if (!e.target.checked) {
                    setManualTotal('');
                  }
                }}
              />
              <label htmlFor="manual-price-toggle" className="text-green-900 text-sm font-bold">
                {lang === 'fr' ? 'Modifier manuellement' : 'Edit price manually'}
              </label>
            </div>
            {tvaEnabled && (
              <p className="text-sm text-green-700 mt-1">
                {lang === 'fr' ? 'Dont TVA:' : 'تشمل TVA:'} {tvaAmount.toLocaleString()} DA ({tvaRate}%)
              </p>
            )}
          </div>

          {/* Deposit with toggle and manual edit, only display if activated */}
          <div className="space-y-3 py-3 border-t border-slate-300">
            <label className="flex items-center gap-2 ml-4">
              <input
                type="checkbox"
                checked={cautionEnabled}
                onChange={(e) => setCautionEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
              />
              <span className="font-bold text-blue-700">{lang === 'fr' ? 'Activer Caution' : 'تفعيل الضمان'}</span>
            </label>
            {cautionEnabled && (
              <div className="ml-4 space-y-3">
                {/* Currency Selector */}
                <div className="flex gap-2 items-center">
                  <span className="font-bold text-blue-700">{lang === 'fr' ? 'Devise' : 'العملة'}: </span>
                  <select
                    value={cautionCurrency}
                    onChange={(e) => {
                      setCautionCurrency(e.target.value as 'DZD' | 'EUR');
                      if (e.target.value === 'DZD') {
                        setEuroAmount('');
                      } else {
                        setEditedDeposit('');
                      }
                    }}
                    className="p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold"
                  >
                    <option value="DZD">DZD (DA)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                {/* DZD Mode */}
                {cautionCurrency === 'DZD' && (
                  <div className="flex gap-2 items-center">
                    <span className="font-bold text-blue-700">{lang === 'fr' ? 'Caution (remboursable)' : 'الضمان (قابل للاسترداد)'}: </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={editedDeposit === '' ? '' : editedDeposit}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (value === '') {
                          setEditedDeposit('');
                        } else {
                          const numValue = parseInt(value, 10);
                          if (!isNaN(numValue) && numValue >= 0) {
                            setEditedDeposit(numValue);
                          }
                        }
                      }}
                      className="w-32 p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right font-bold"
                      placeholder="0"
                    />
                    <span className="text-blue-700 font-bold">DA</span>
                  </div>
                )}

                {/* EUR Mode */}
                {cautionCurrency === 'EUR' && (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-blue-700">{lang === 'fr' ? 'Montant EUR' : 'المبلغ بالیورو'}: </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={euroAmount === '' ? '' : euroAmount}
                        onChange={(e) => {
                          const value = e.target.value.trim();
                          if (value === '') {
                            setEuroAmount('');
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              setEuroAmount(numValue);
                            }
                          }
                        }}
                        className="w-32 p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right font-bold"
                        placeholder="0"
                      />
                      <span className="text-blue-700 font-bold">€</span>
                    </div>

                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-blue-700">{lang === 'fr' ? 'Taux de change' : 'سعر الصرف'}: </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={euroRate === '' ? '' : euroRate}
                        onChange={(e) => {
                          const value = e.target.value.trim();
                          if (value === '') {
                            setEuroRate('');
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue > 0) {
                              setEuroRate(numValue);
                            }
                          }
                        }}
                        className="w-32 p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right font-bold"
                        placeholder="145"
                      />
                      <span className="text-blue-700 font-bold">DA/€</span>
                    </div>

                    {euroAmount && euroRate && (
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700">
                          {lang === 'fr' ? '= ' : '= '} 
                          <span className="font-bold">{Math.round(Number(euroAmount) * Number(euroRate)).toLocaleString()}</span> DA
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRICING SUMMARY & VERIFICATION */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-indigo-200">
        <h4 className="text-lg font-black text-indigo-900 mb-4">📋 {lang === 'fr' ? 'Vérification Finale' : 'التحقق النهائي'}</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column - Pricing */}
          <div className="space-y-2 bg-white rounded-lg p-4 border border-indigo-200">
            <h5 className="font-bold text-indigo-900 text-center mb-3">💰 {lang === 'fr' ? 'Détails des Prix' : 'تفاصيل الأسعار'}</h5>
            
            <div className="flex justify-between text-sm">
              <span className="text-indigo-700">{lang === 'fr' ? 'Prix Base:' : 'السعر الأساسي:'}</span>
              <span className="font-bold text-indigo-900">{calculatedBasePrice.toLocaleString()} DA</span>
            </div>
            
            {servicesTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-indigo-700">{lang === 'fr' ? 'Services:' : 'الخدمات:'}</span>
                <span className="font-bold text-indigo-900">{servicesTotal.toLocaleString()} DA</span>
              </div>
            )}
            
            {tvaEnabled && tvaAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-indigo-700">{lang === 'fr' ? 'TVA (' + tvaRate + '%):' : 'TVA (' + tvaRate + '%):'}</span>
                <span className="font-bold text-indigo-900">{tvaAmount.toLocaleString()} DA</span>
              </div>
            )}
            
            <div className="border-t border-indigo-200 pt-2 flex justify-between text-base font-bold">
              <span className="text-indigo-900">{lang === 'fr' ? 'TOTAL:' : 'المجموع:'}</span>
              <span className="text-lg text-indigo-600">{totalPrice.toLocaleString()} DA</span>
            </div>

            <div className="flex justify-between text-sm pt-2">
              <span className="text-indigo-700">{lang === 'fr' ? 'Caution:' : 'الضمان:'}</span>
              <span className="font-bold text-indigo-900">{deposit.toLocaleString()} DA</span>
            </div>

            {/* Assurance Serenity Section */}
            <div className="border-t border-indigo-200 pt-3 mt-3">
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={assuranceEnabled}
                  onChange={(e) => {
                    setAssuranceEnabled(e.target.checked);
                    if (!e.target.checked) {
                      setAssurancePercentage('');
                    }
                  }}
                  className="w-4 h-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                />
                <span className="font-bold text-purple-700">
                  {lang === 'fr' ? '🛡️ Assurance Serenity' : '🛡️ تأمين Serenity'}
                </span>
              </label>
              {assuranceEnabled && (
                <div className="ml-6 space-y-2">
                  <div className="flex gap-2 items-center">
                    <label className="text-sm font-bold text-purple-700 w-24">
                      {lang === 'fr' ? 'Pourcentage:' : 'النسبة:'}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={assurancePercentage === '' ? '' : assurancePercentage}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (value === '') {
                          setAssurancePercentage('');
                        } else {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue) && numValue >= 0) {
                            setAssurancePercentage(numValue);
                          }
                        }
                      }}
                      className="w-20 p-1 border border-purple-300 rounded text-right font-bold"
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <span className="text-purple-700 font-bold">%</span>
                  </div>
                  {assuranceAmount > 0 && (
                    <div className="p-2 bg-purple-50 rounded border border-purple-200">
                      <p className="text-sm text-purple-700">
                        {lang === 'fr' ? 'Montant Assurance:' : 'مبلغ التأمين:'}
                        <span className="font-bold ml-2">{assuranceAmount.toLocaleString()} DA</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── TIMBRE FISCAL (droit de timbre) ─────────────────────── */}
            <div className="border-t border-indigo-200 pt-3 mt-3">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timbreEnabled}
                  onChange={(e) => setTimbreEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-saas-border accent-[#DC2626] cursor-pointer"
                />
                <span className="font-bold text-[#DC2626]">
                  {lang === 'fr' ? '🧾 Timbre fiscal' : '🧾 الطابع الجبائي'}
                </span>
              </label>

              <AnimatePresence initial={false}>
                {timbreEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="ml-6 space-y-2">
                      <div className="rounded-lg border border-[#DC2626]/25 bg-[#DC2626]/5 p-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-saas-text-muted">
                            {lang === 'fr' ? 'Base de calcul' : 'أساس الحساب'}
                          </span>
                          <span className="font-bold text-saas-text-main">{timbreBase.toLocaleString('fr-DZ')} DA</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-saas-text-muted">
                            {lang === 'fr' ? 'Barème appliqué' : 'التعريفة المطبقة'}
                          </span>
                          <span className="font-bold text-[#DC2626] text-right">{timbreLabel(timbreBase, lang)}</span>
                        </div>
                        <div className="flex justify-between text-base border-t border-[#DC2626]/20 pt-1.5">
                          <span className="font-bold text-saas-text-main">
                            {lang === 'fr' ? 'Montant du timbre' : 'مبلغ الطابع'}
                          </span>
                          <span className="font-black text-[#DC2626]">{timbreAmount.toLocaleString('fr-DZ')} DA</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-saas-text-muted leading-relaxed">
                        {lang === 'fr'
                          ? 'Barème : 300 → 30 000 DA = 1 DA / 100 DA (1 %) · 30 001 → 100 000 DA = 1,5 DA / 100 DA (1,5 %) · au-delà de 100 000 DA = 2 DA / 100 DA (2 %). Le timbre apparaît sur le contrat imprimé.'
                          : 'التعريفة: 300 → 30000 دج = 1 دج/100 دج · 30001 → 100000 دج = 1.5 دج/100 دج · أكثر من 100000 دج = 2 دج/100 دج. يظهر الطابع في العقد المطبوع.'}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Total général incluant assurance + timbre */}
            {(assuranceAmount > 0 || timbreAmount > 0) && (
              <div className="border-t border-indigo-200 pt-3 mt-3 flex justify-between items-center">
                <span className="font-black text-indigo-900">
                  {lang === 'fr' ? 'TOTAL À PAYER' : 'الإجمالي المستحق'}
                </span>
                <span className="text-xl font-black text-indigo-600">
                  {finalTotal.toLocaleString('fr-DZ')} DA
                </span>
              </div>
            )}
          </div>

          {/* Right Column - Duration & Payment */}
          <div className="space-y-2 bg-white rounded-lg p-4 border border-indigo-200">
            <h5 className="font-bold text-indigo-900 text-center mb-3">⏱️ {lang === 'fr' ? 'Durée et Paiement' : 'المدة والدفع'}</h5>
            
            <div className="flex justify-between text-sm">
              <span className="text-indigo-700">{lang === 'fr' ? 'Nombre de jours:' : 'عدد الأيام:'}</span>
              <span className="font-bold text-indigo-900">{days}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-indigo-700">{lang === 'fr' ? 'Semaines:' : 'الأسابيع:'}</span>
              <span className="font-bold text-indigo-900">{weeks}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-indigo-700">{lang === 'fr' ? 'Jours restants:' : 'الأيام المتبقية:'}</span>
              <span className="font-bold text-indigo-900">{remainingDays}</span>
            </div>

            <div className="border-t border-indigo-200 pt-2">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-indigo-700">{lang === 'fr' ? 'Acompte:' : 'الدفعة الأولى:'}</span>
                <span className="font-bold text-indigo-900">{advancePayment.toLocaleString()} DA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-indigo-700">{lang === 'fr' ? 'Reste à payer:' : 'المتبقي:'}</span>
                <span className="font-bold text-indigo-900">{(totalPrice - advancePayment).toLocaleString()} DA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Storage Info */}
        <div className="mt-4 bg-indigo-100 rounded-lg p-3 border border-indigo-300">
          <p className="text-xs text-indigo-900 mb-2">
            <span className="font-bold">💾 {lang === 'fr' ? 'Cette étape sauvegarde:' : 'هذه الخطوة تحفظ:'}</span>
          </p>
          <ul className="text-xs text-indigo-800 space-y-1 ml-4">
            <li>✓ {lang === 'fr' ? 'Prix Total: ' : 'السعر الكلي: '}<span className="font-bold">{totalPrice.toLocaleString()} DA</span></li>
            <li>✓ {lang === 'fr' ? 'Caution: ' : 'الضمان: '}<span className="font-bold">{deposit.toLocaleString()} DA</span></li>
            {assuranceEnabled && assuranceAmount > 0 && (
              <li>✓ {lang === 'fr' ? 'Assurance Serenity: ' : 'تأمين Serenity: '}<span className="font-bold">{assuranceAmount.toLocaleString()} DA ({assurancePercentage}%)</span></li>
            )}
            {timbreEnabled && timbreAmount > 0 && (
              <li>✓ {lang === 'fr' ? 'Timbre fiscal: ' : 'الطابع الجبائي: '}<span className="font-bold">{timbreAmount.toLocaleString()} DA ({String(timbre.rate).replace('.', ',')} %)</span></li>
            )}
            <li>✓ {lang === 'fr' ? 'Total général: ' : 'المجموع العام: '}<span className="font-bold">{finalTotal.toLocaleString()} DA</span></li>
            <li>✓ {lang === 'fr' ? 'Durée: ' : 'المدة: '}<span className="font-bold">{days} {lang === 'fr' ? 'jours' : 'أيام'}</span></li>
            <li>✓ {lang === 'fr' ? 'TVA Appliquée: ' : 'تطبيق TVA: '}<span className="font-bold">{tvaEnabled ? (lang === 'fr' ? 'Oui (' + tvaRate + '%)' : 'نعم (' + tvaRate + '%)') : (lang === 'fr' ? 'Non' : 'لا')}</span></li>
          </ul>
        </div>
      </div>

      {/* Payment Terms */}
      <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
        <h4 className="text-lg font-black text-purple-900 mb-4">
          💳 {lang === 'fr' ? 'Modalités de Paiement' : 'شروط الدفع'}
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-purple-900 mb-2">
                💰 {lang === 'fr' ? 'Acompte à la Réservation' : 'الدفعة الأولى عند الحجز'}
              </label>
              <input
                type="number"
                value={advancePayment || ''}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setAdvancePayment(value);
                  setFormData(prev => ({
                    ...prev,
                    step6: {
                      ...prev.step6,
                      advancePayment: value,
                      remainingPayment: Math.max(0, totalPrice - value)
                    }
                  }));
                }}
                placeholder="0"
                className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block font-bold text-purple-900 mb-2">
                📊 {lang === 'fr' ? 'Reste à Payer' : 'المبلغ المتبقي'}
              </label>
              <input
                type="number"
                value={Math.max(0, totalPrice - advancePayment)}
                readOnly
                className="w-full p-3 bg-purple-100 border border-purple-200 rounded-lg text-purple-900 font-bold"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-purple-900 mb-2">
              📝 {lang === 'fr' ? 'Notes de Paiement' : 'ملاحظات الدفع'}
            </label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              placeholder={lang === 'fr' ? 'Conditions spéciales de paiement...' : 'شروط دفع خاصة...'}
            />
          </div>
        </div>
      </div>

      {/* Commission employé — uniquement à la création d'une réservation */}
      {!inspectionMode && !(formData as any).id && (
        <WorkerCommissionSection
          lang={lang}
          baseAmount={finalTotal}
          value={(formData as any).workerCommission}
          onChange={(v) => setFormData(prev => ({ ...prev, workerCommission: v } as any))}
        />
      )}
    </div>
  );
};