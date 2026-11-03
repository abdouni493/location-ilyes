import React, { useState, useEffect } from 'react';
import { Language, ReservationDetails } from '../types';
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, Save, MapPin, CreditCard, Car as CarIcon, Camera, User, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Step1DatesLocations, Step2VehicleSelection, Step3DepartureInspection, Step4ClientSelection, Step5AdditionalServices, Step6FinalPricing } from './CreateReservationForm';
import { DatabaseService } from '../services/DatabaseService';
import { ReservationsService } from '../services/ReservationsService';
import { uploadInspectionImage } from '../services/uploadInspectionImage';

interface EditReservationFormProps {
  lang: Language;
  reservation: ReservationDetails;
  onBack: () => void;
  onUpdate?: (updated: ReservationDetails) => void;
  agencies: any[];
  isLoadingAgencies: boolean;
}

export const EditReservationForm: React.FC<EditReservationFormProps> = ({ lang, reservation, onBack, onUpdate, agencies, isLoadingAgencies }) => {
  // If status is accepted and inspection mode, start at step 3
  const isInspectionMode = reservation.status === 'accepted';
  const [currentStep, setCurrentStep] = useState(isInspectionMode ? 3 : 1);
  // agencies and isLoadingAgencies are passed in as props now
  const [formData, setFormData] = useState<Partial<ReservationDetails>>({
    id: reservation.id,
    clientId: reservation.clientId,
    client: reservation.client,
    carId: reservation.carId,
    car: reservation.car,
    step1: {
      departureDate: reservation.step1.departureDate,
      departureTime: reservation.step1.departureTime,
      returnDate: reservation.step1.returnDate,
      returnTime: reservation.step1.returnTime,
      departureLocation: '', // Will be set after agencies prop update
      returnLocation: '', // Will be set after agencies prop update
      differentReturnAgency: reservation.step1.differentReturnAgency,
    },
    step2: {
      selectedCar: reservation.car,
      firstName: reservation.client.firstName,
      lastName: reservation.client.lastName,
      phone: reservation.client.phone,
      email: reservation.client.email,
      dateOfBirth: reservation.client.dateOfBirth,
      placeOfBirth: reservation.client.placeOfBirth,
      licenseNumber: reservation.client.licenseNumber,
      licenseExpiration: reservation.client.licenseExpirationDate,
      licenseDelivery: reservation.client.licenseDeliveryDate,
      licenseDeliveryPlace: reservation.client.licenseDeliveryPlace,
      additionalDocType: reservation.client.documentType === 'none' ? undefined : (reservation.client.documentType as any),
      additionalDocNumber: reservation.client.documentNumber,
      additionalDocDelivery: reservation.client.documentDeliveryDate,
      additionalDocExpiration: reservation.client.documentExpirationDate,
      additionalDocDeliveryAddress: reservation.client.documentDeliveryAddress,
      wilaya: reservation.client.wilaya,
      completeAddress: reservation.client.completeAddress,
      scannedDocuments: reservation.client.scannedDocuments,
      photo: reservation.client.profilePhoto,
    },
    step3: {
      departureInspection: reservation.departureInspection
    },
    step4: {
      selectedClient: reservation.client
    },
    step5: {
      additionalServices: reservation.additionalServices || []
    },
    step6: {
      totalPrice: reservation.totalPrice,
      // Prix saisi manuellement à la création : persistant (is_manual_price)
      isManualTotal: reservation.isManualPrice === true,
      manualTotal: reservation.isManualPrice === true ? String(reservation.totalPrice ?? '') : '',
      tvaApplied: reservation.tvaApplied,
      tvaAmount: 0, // Will be calculated
      additionalFees: reservation.additionalFees,
      paymentNotes: reservation.notes,
      advancePayment: reservation.advancePayment,
      remainingPayment: reservation.remainingPayment,
      cautionEnabled: typeof reservation.cautionEnabled === 'boolean' ? reservation.cautionEnabled : true,
      cautionCurrency: (reservation as any).cautionCurrency || 'DZD',
      // Calculate euroAmount if caution was in EUR mode
      euroAmount: (reservation as any).cautionCurrency === 'EUR' && (reservation as any).euro_rate
        ? Math.round(((reservation as any).cautionAmountDzd || reservation.deposit) / (reservation as any).euro_rate * 100) / 100
        : '',
      euroRate: (reservation as any).euro_rate || 145,
      assuranceEnabled: (reservation as any).assuranceEnabled || false,
      assurancePercentage: (reservation as any).assurancePercentage || '',
      caution_amount_dzd: (reservation as any).cautionAmountDzd || reservation.deposit
    },
    additionalServices: reservation.additionalServices,
    deposit: (reservation as any).cautionAmountDzd || reservation.deposit,
    totalDays: reservation.totalDays,
    totalPrice: reservation.totalPrice,
    discountAmount: reservation.discountAmount,
    discountType: reservation.discountType,
    advancePayment: reservation.advancePayment,
    remainingPayment: reservation.remainingPayment,
    status: reservation.status,
    departureInspection: reservation.departureInspection,
    returnInspection: reservation.returnInspection,
    payments: reservation.payments,
    excessMileage: reservation.excessMileage,
    missingFuel: reservation.missingFuel,
    additionalFees: reservation.additionalFees,
    tvaApplied: reservation.tvaApplied,
    notes: reservation.notes,
    createdAt: reservation.createdAt,
    activatedAt: reservation.activatedAt,
    completedAt: reservation.completedAt
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Log caution and assurance values when component loads
  useEffect(() => {
    console.log('🔐 CAUTION & ASSURANCE VALUES LOADED:');
    console.log('   ├─ cautionCurrency:', (formData.step6 as any)?.cautionCurrency || 'DZD');
    console.log('   ├─ caution_amount_dzd:', (formData.step6 as any)?.caution_amount_dzd);
    console.log('   ├─ euroAmount:', (formData.step6 as any)?.euroAmount);
    console.log('   ├─ euroRate:', (formData.step6 as any)?.euroRate);
    console.log('   ├─ assuranceEnabled:', (formData.step6 as any)?.assuranceEnabled);
    console.log('   └─ assurancePercentage:', (formData.step6 as any)?.assurancePercentage);
  }, [formData.id]); // Log when editing a different reservation

  // whenever parent passes updated agencies list, ensure our step1 text fields are populated
  useEffect(() => {
    const departureAgency = agencies?.find(a => a.id === reservation.step1.departureAgency);
    const returnAgency = agencies?.find(a => a.id === reservation.step1.returnAgency);
    setFormData(prev => ({
      ...prev,
      step1: {
        ...prev.step1!,
        departureLocation: departureAgency?.name || departureAgency?.address || '',
        returnLocation: returnAgency?.name || returnAgency?.address || '',
      }
    }));
  }, [agencies, reservation.step1.departureAgency, reservation.step1.returnAgency]);

  // Sync clientId with selected client when client selection changes
  useEffect(() => {
    if (formData.step4?.selectedClient) {
      const newClientId = formData.step4.selectedClient.id;
      const currentClientId = formData.clientId;
      
      if (newClientId && newClientId !== currentClientId) {
        console.log('🔄 Client selection changed:', currentClientId, '→', newClientId);
        setFormData(prev => ({
          ...prev,
          clientId: newClientId,
          client: formData.step4!.selectedClient,
        }));
      }
    }
  }, [formData.step4?.selectedClient?.id]);

  // Sync carId with selected car when car selection changes
  useEffect(() => {
    if (formData.step2?.selectedCar) {
      const newCarId = formData.step2.selectedCar.id;
      const currentCarId = formData.carId;
      
      // Only update if the selected car is different
      if (newCarId && newCarId !== currentCarId) {
        console.log('🔄 Car selection changed:', currentCarId, '→', newCarId);
        console.log('   Selected car:', formData.step2.selectedCar.brand, formData.step2.selectedCar.model);
        
        setFormData(prev => ({
          ...prev,
          carId: newCarId,
          car: formData.step2.selectedCar,
        }));
      }
    }
  }, [formData.step2?.selectedCar?.id]);

  // Detect if price was manually edited by comparing stored price with calculated price
  useEffect(() => {
    // Le flag est désormais enregistré en base : l'heuristique ne sert plus
    // que pour les anciennes réservations (colonne absente).
    if (typeof reservation.isManualPrice === 'boolean') return;
    const calculateExpectedPrice = () => {
      const pricePerDay = reservation.car?.priceDay || 0;
      const servicesTotal = (reservation.additionalServices || []).reduce((sum, s) => sum + (s.price || 0), 0);
      const additionalFees = reservation.additionalFees || 0;
      const tvaAmount = reservation.tvaApplied ? (reservation.totalPrice ? Math.ceil(reservation.totalPrice * 0.19) : 0) : 0;
      
      const expectedPrice = (pricePerDay * reservation.totalDays) + servicesTotal + additionalFees + tvaAmount;
      return expectedPrice;
    };
    
    const expectedPrice = calculateExpectedPrice();
    const storedPrice = reservation.totalPrice || 0;
    const priceDifference = Math.abs(expectedPrice - storedPrice);
    
    // If price differs by more than 1 DA (accounting for rounding), it was manually edited
    if (priceDifference > 1) {
      console.log('💡 Manual price detected!');
      console.log('   ├─ Expected calculated: ' + expectedPrice.toLocaleString() + ' DA');
      console.log('   ├─ Stored (actual):     ' + storedPrice.toLocaleString() + ' DA');
      console.log('   └─ Difference:          ' + priceDifference.toLocaleString() + ' DA');
      
      setFormData(prev => ({
        ...prev,
        step6: {
          ...prev.step6!,
          isManualTotal: true,
          totalPrice: storedPrice,
          manualTotal: storedPrice.toString(),
        }
      }));
    }
  }, []); // Only run once on mount

  const steps = isInspectionMode
    ? [
        { id: 3, title: lang === 'fr' ? 'Inspection Départ' : 'فحص المغادرة', icon: '🔍' },
        { id: 5, title: lang === 'fr' ? 'Services Supplémentaires' : 'الخدمات الإضافية', icon: '🛠️' },
        { id: 6, title: lang === 'fr' ? 'Tarification Finale' : 'التسعير النهائي', icon: '💰' }
      ]
    : [
        { id: 1, title: lang === 'fr' ? 'Dates & Lieux' : 'التواريخ والأماكن', icon: '📅' },
        { id: 2, title: lang === 'fr' ? 'Sélection Véhicule' : 'اختيار المركبة', icon: '🚗' },
        { id: 3, title: lang === 'fr' ? 'Inspection Départ' : 'فحص المغادرة', icon: '🔍' },
        { id: 4, title: lang === 'fr' ? 'Client' : 'العميل', icon: '👤' },
        { id: 5, title: lang === 'fr' ? 'Services Supplémentaires' : 'الخدمات الإضافية', icon: '🛠️' },
        { id: 6, title: lang === 'fr' ? 'Tarification Finale' : 'التسعير النهائي', icon: '💰' }
      ];

  useEffect(() => {
    // Check if form data has changed from original reservation
    const hasFormChanges = JSON.stringify(formData) !== JSON.stringify(reservation);
    setHasChanges(hasFormChanges);
  }, [formData, reservation]);

  const handleNext = () => {
    if (isInspectionMode) {
      if (currentStep === 3) setCurrentStep(5);
      else if (currentStep === 5) setCurrentStep(6);
    } else {
      if (currentStep < 6) setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (isInspectionMode) {
      if (currentStep === 5) setCurrentStep(3);
      else if (currentStep === 6) setCurrentStep(5);
    } else {
      if (currentStep > 1) setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    try {
      console.log('🔍 === EDIT SAVE STARTED ===');
      console.log('📋 Current formData:', JSON.stringify(formData, null, 2));
      console.log('📋 Original reservation:', JSON.stringify(reservation, null, 2));

      // === DATES & DURATION CALCULATION ===
      const newDepartureDate = formData.step1?.departureDate || reservation.step1.departureDate;
      const newReturnDate = formData.step1?.returnDate || reservation.step1.returnDate;
      
      console.log('📅 Departure Date - Original:', reservation.step1.departureDate, '→ New:', newDepartureDate);
      console.log('📅 Return Date - Original:', reservation.step1.returnDate, '→ New:', newReturnDate);

      // Calculate new total days from dates
      const newTotalDays = Math.ceil(
        (new Date(newReturnDate).getTime() - new Date(newDepartureDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      console.log('📊 Total Days - Original:', reservation.totalDays, '→ New:', newTotalDays);

      // === PRICING CALCULATION ===
      const pricePerDay = reservation.pricePerDay || reservation.car?.priceDay || 0;
      const basePrice = pricePerDay * newTotalDays;
      
      console.log('💰 Price/Day:', pricePerDay, 'DA');
      console.log('💰 Base Price (old):', (pricePerDay * (reservation.totalDays || 0)).toLocaleString(), 'DA');
      console.log('💰 Base Price (new):', basePrice.toLocaleString(), 'DA');
      console.log('💾 Base Price calculation: pricePerDay (' + pricePerDay + ') × newTotalDays (' + newTotalDays + ') =', basePrice);

      // === SERVICES & FEES ===
      const servicesTotal = formData.step5?.additionalServices?.reduce((sum, s) => sum + (s.price || 0), 0) || 0;
      const discountAmount = formData.discountAmount || 0;
      const additionalFees = formData.step6?.additionalFees || formData.additionalFees || 0;
      const tvaAmount = formData.step6?.tvaAmount || 0;
      
      console.log('🛒 Services Total:', servicesTotal.toLocaleString(), 'DA', '| Services count:', formData.step5?.additionalServices?.length || 0);
      console.log('💳 Discount Amount:', discountAmount.toLocaleString(), 'DA', '(Type:', formData.discountType, ')');
      console.log('📝 Additional Fees:', additionalFees.toLocaleString(), 'DA');
      console.log('📊 TVA Amount (from formData.step6):', tvaAmount.toLocaleString(), 'DA (Applied:', formData.step6?.tvaApplied, ')');

      // === TOTAL PRICE CALCULATION ===
      // CHECK FOR MANUALLY EDITED TOTAL PRICE FIRST
      console.log('🔍 Checking for manual total price:');
      console.log('   ├─ formData.step6?.isManualTotal:', formData.step6?.isManualTotal);
      console.log('   ├─ formData.step6?.manualTotal:', formData.step6?.manualTotal);
      console.log('   ├─ formData.step6?.totalPrice:', formData.step6?.totalPrice);
      console.log('   └─ formData.totalPrice:', formData.totalPrice);
      
      let newTotalPrice: number;
      
      if (formData.step6?.isManualTotal && formData.step6?.totalPrice) {
        // User manually edited the total price - use that value
        newTotalPrice = formData.step6.totalPrice;
        console.log('🔧 MANUAL TOTAL PRICE DETECTED: Using manually edited value', newTotalPrice.toLocaleString(), 'DA');
      } else if (formData.totalPrice && formData.totalPrice > 0 && 
                 formData.step6?.isManualTotal) {
        // Alternative: Check top-level totalPrice if manually edited
        newTotalPrice = formData.totalPrice;
        console.log('🔧 MANUAL TOTAL PRICE (from top-level): Using manually edited value', newTotalPrice.toLocaleString(), 'DA');
      } else {
        // Calculate normally
        newTotalPrice = basePrice + servicesTotal + additionalFees + tvaAmount;
        console.log('💰 Calculation: basePrice (' + basePrice + ') + servicesTotal (' + servicesTotal + ') + additionalFees (' + additionalFees + ') + tvaAmount (' + tvaAmount + ') = ' + newTotalPrice);
      }
      
      console.log('💰 Subtotal before discount:', newTotalPrice.toLocaleString(), 'DA');

      // Apply discount ONLY if not manually set
      if (!formData.step6?.isManualTotal) {
        if (formData.discountType === 'percentage' && discountAmount > 0) {
          const oldPrice = newTotalPrice;
          newTotalPrice = newTotalPrice * (1 - discountAmount / 100);
          console.log('💰 After discount (' + discountAmount + '%): ' + oldPrice + ' × (1 - ' + discountAmount + '/100) =', newTotalPrice.toLocaleString(), 'DA');
        } else if (formData.discountType === 'fixed' && discountAmount > 0) {
          const oldPrice = newTotalPrice;
          newTotalPrice = newTotalPrice - discountAmount;
          console.log('💰 After discount (fixed ' + discountAmount + ' DA): ' + oldPrice + ' - ' + discountAmount + ' =', newTotalPrice.toLocaleString(), 'DA');
        }
      } else {
        console.log('⚠️ MANUAL TOTAL SET: Skipping discount application');
      }

      // Ensure total price is not negative and is a valid number
      newTotalPrice = Math.max(0, Math.round(newTotalPrice || 0));
      
      console.log('💰 FINAL TOTAL PRICE:', newTotalPrice.toLocaleString(), 'DA');
      console.log('✅ Price calculation summary:');
      console.log('   - Base Price: ' + basePrice);
      console.log('   - Services: ' + servicesTotal);
      console.log('   - Additional Fees: ' + additionalFees);
      console.log('   - TVA: ' + tvaAmount);
      console.log('   - Discount: ' + (formData.discountType === 'percentage' ? discountAmount + '%' : discountAmount + ' DA'));
      console.log('   - FINAL: ' + newTotalPrice);

      // === DEPOSIT (CAUTION) ===
      const newDeposit = formData.deposit !== undefined ? formData.deposit : reservation.deposit;
      console.log('🔐 Deposit - Original:', (reservation.deposit || 0).toLocaleString(), 'DA → New:', newDeposit.toLocaleString(), 'DA');

      // === ADVANCE & REMAINING PAYMENT ===
      const newAdvancePayment = formData.step6?.advancePayment || formData.advancePayment || 0;
      const newRemainingPayment = Math.max(0, newTotalPrice - newAdvancePayment);
      
      console.log('💳 Advance Payment:', newAdvancePayment.toLocaleString(), 'DA');
      console.log('💳 Remaining Payment:', newRemainingPayment.toLocaleString(), 'DA (calculation: ' + newTotalPrice + ' - ' + newAdvancePayment + ')');

      // Prepare the update data
      const updateData: any = {
        // Car & Booking Details
        carId: formData.carId,
        departureDate: newDepartureDate,
        returnDate: newReturnDate,
        departureTime: formData.step1?.departureTime,
        returnTime: formData.step1?.returnTime,
        totalDays: newTotalDays,
        
        // Pricing
        discountAmount: formData.discountAmount,
        discountType: formData.discountType,
        advancePayment: newAdvancePayment,
        remainingPayment: newRemainingPayment,
        notes: formData.step6?.paymentNotes || formData.notes,
        tvaApplied: formData.step6?.tvaApplied || formData.tvaApplied,
        tvaAmount: formData.step6?.tvaAmount,
        additionalFees: formData.step6?.additionalFees || formData.additionalFees,
        totalPrice: newTotalPrice,
        
        // Client (selected in edit mode)
        clientId: formData.step4?.selectedClient?.id || formData.clientId || reservation.clientId,
        
        // Deposit & Status
        deposit: (formData.step6 as any)?.caution_amount_dzd || (formData.step6 as any)?.editedDeposit || newDeposit,
        cautionEnabled: formData.step6?.cautionEnabled !== false,
        isManualPrice: !!formData.step6?.isManualTotal,
        // Caution and Assurance fields
        cautionAmountDzd: (formData.step6 as any)?.caution_amount_dzd || newDeposit,
        cautionCurrency: (formData.step6 as any)?.cautionCurrency || 'DZD',
        euroRate: (formData.step6 as any)?.euroRate || 145,
        assuranceEnabled: (formData.step6 as any)?.assuranceEnabled || false,
        assurancePercentage: (formData.step6 as any)?.assuranceEnabled 
          ? (formData.step6 as any)?.assurancePercentage !== '' 
            ? Number((formData.step6 as any)?.assurancePercentage) 
            : 0
          : 0,
        
        // If in inspection mode (accepted), set status to confirmed
        ...(isInspectionMode ? { status: 'confirmed' } : {})
      };

      console.log('📤 UPDATE DATA TO SAVE:', JSON.stringify(updateData, null, 2));
      console.log('📊 Key values being saved:');
      console.log('   ├─ BOOKING DETAILS:');
      console.log('   │  ├─ carId: ' + updateData.carId);
      console.log('   │  ├─ car: ' + (formData.car?.brand + ' ' + formData.car?.model || 'N/A'));
      console.log('   │  ├─ departureDate: ' + updateData.departureDate);
      console.log('   │  ├─ returnDate: ' + updateData.returnDate);
      console.log('   │  ├─ departureTime: ' + updateData.departureTime);
      console.log('   │  └─ returnTime: ' + updateData.returnTime);
      console.log('   ├─ PRICING:');
      console.log('   │  ├─ totalPrice: ' + updateData.totalPrice);
      console.log('   │  ├─ deposit: ' + updateData.deposit);
      console.log('   │  ├─ advancePayment: ' + updateData.advancePayment);
      console.log('   │  └─ remainingPayment: ' + updateData.remainingPayment);
      console.log('   ├─ CAUTION & ASSURANCE:');
      console.log('   │  ├─ cautionCurrency: ' + updateData.cautionCurrency);
      console.log('   │  ├─ cautionAmountDzd: ' + updateData.cautionAmountDzd);
      console.log('   │  ├─ euroRate: ' + updateData.euroRate);
      console.log('   │  ├─ assuranceEnabled: ' + updateData.assuranceEnabled);
      console.log('   │  └─ assurancePercentage: ' + updateData.assurancePercentage);
      console.log('   └─ OTHER:');
      console.log('      ├─ totalDays: ' + updateData.totalDays);
      console.log('      └─ status: ' + (updateData.status || 'unchanged'));

      // Update the reservation
      console.log('💾 Saving to database...');
      const savedResult = await ReservationsService.updateReservation(reservation.id, updateData);
      console.log('✅ Reservation saved successfully');
      console.log('📊 Saved result:', JSON.stringify(savedResult, null, 2));

      // Update reservation services
      const services = formData.step5?.additionalServices || [];
      console.log('🛒 Updating services:', services.length, 'items');
      await ReservationsService.updateReservationServices(reservation.id, services);
      console.log('✅ Services updated successfully');

      // Save/update departure inspection if present
      const inspection = formData.step3?.departureInspection;
      if (inspection) {
        try {
          console.log('🔍 Updating inspection...');
          // Determine agency_id from inspection location
          let agencyId = reservation.step1.departureAgency || reservation.step1.returnAgency || '';
          if (inspection.location) {
            // Find agency by name-city match
            const agencies = await DatabaseService.getAgencies();
            const matchingAgency = agencies.find((agency: any) => 
              `${agency.name} - ${agency.city}` === inspection.location
            );
            if (matchingAgency) {
              agencyId = matchingAgency.id;
            }
          }

          // If inspection has a DB id (uuid) attempt update, else create
          const isDbId = inspection.id && !inspection.id.toString().startsWith('inspection');
          if (isDbId) {
            await DatabaseService.updateVehicleInspection(inspection.id, {
              mileage: inspection.mileage || 0,
              fuel_level: inspection.fuelLevel || 'full',
              agency_id: agencyId,
              exterior_front_photo: inspection.exteriorPhotos?.[0] || null,
              exterior_rear_photo: inspection.exteriorPhotos?.[1] || null,
              interior_photo: inspection.interiorPhotos?.[0] || null,
              other_photos: inspection.other_photos || inspection.otherPhotos || [],
              client_signature: inspection.signature || inspection.client_signature || null,
              notes: inspection.notes || null,
              date: inspection.date,
              time: inspection.time
            });

            // Upsert responses for ALL checklist items (preserve unchecked as false)
            const responses = (inspection.inspectionItems || []).map((it: any) => ({
              inspection_id: inspection.id,
              checklist_item_id: it.id,
              status: !!it.checked,
              note: it.note || null
            }));
            if (responses.length > 0) await DatabaseService.upsertInspectionResponses(responses);

            // also update car mileage on edit
            if (inspection.mileage && inspection.mileage > 0) {
              await DatabaseService.updateCar(reservation.carId, {
                mileage: inspection.mileage
              });
            }
          } else {
            // Create new inspection
            const created = await DatabaseService.createVehicleInspection({
              reservation_id: reservation.id,
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

            // update local formData with new inspection id so future saves update instead of insert
            setFormData(prev => ({
              ...prev,
              step3: {
                ...prev.step3,
                departureInspection: {
                  ...(prev.step3?.departureInspection || {}),
                  id: created.id
                }
              }
            }));

            // After creating inspection, upsert responses for all checklist items
            const responses = (inspection.inspectionItems || []).map((it: any) => ({
              inspection_id: created.id,
              checklist_item_id: it.id,
              status: !!it.checked,
              note: it.note || null
            }));
            if (responses.length > 0) await DatabaseService.upsertInspectionResponses(responses);

            // update car mileage after creating new inspection
            if (inspection.mileage && inspection.mileage > 0) {
              await DatabaseService.updateCar(reservation.carId, {
                mileage: inspection.mileage
              });
            }
          }
          console.log('✅ Inspection updated successfully');
        } catch (err) {
          console.error('Error saving inspection during edit:', err);
          throw err; // propagate so outer catch prevents closing the modal
        }
      }

      // Update local reservation data for immediate UI feedback
      const updatedReservation = {
        ...reservation,
        ...updateData,
        clientId: updateData.clientId || reservation.clientId,
        client: formData.step4?.selectedClient || formData.client || reservation.client,
        step1: formData.step1,
        step4: formData.step4,
        step6: formData.step6,
        step3: formData.step3,
        step5: formData.step5
      };

      console.log('✅ === SAVE COMPLETED SUCCESSFULLY ===');
      console.log('📊 Updated Reservation Data:', JSON.stringify(updatedReservation, null, 2));
      console.log('✨ Price Update Summary:');
      console.log('   ├─ BEFORE: totalPrice=' + reservation.totalPrice + ' DA | deposit=' + reservation.deposit + ' DA');
      console.log('   └─ AFTER:  totalPrice=' + updateData.totalPrice + ' DA | deposit=' + updateData.deposit + ' DA');
      console.log('✨ Duration Update Summary:');
      console.log('   ├─ BEFORE: totalDays=' + reservation.totalDays);
      console.log('   └─ AFTER:  totalDays=' + updateData.totalDays);
      console.log('✨ Payment Summary:');
      console.log('   ├─ Advance: ' + updateData.advancePayment + ' DA');
      console.log('   ├─ Remaining: ' + updateData.remainingPayment + ' DA');
      console.log('   └─ Total: ' + (updateData.advancePayment + updateData.remainingPayment) + ' DA (should equal ' + updateData.totalPrice + ')');
      
      // notify parent so it can refresh its state
      if (onUpdate) {
        console.log('🔔 Notifying parent component with updated data...');
        console.log('📤 Data passed to parent onUpdate:', JSON.stringify(updatedReservation, null, 2));
        onUpdate(updatedReservation as ReservationDetails);
        console.log('✅ Parent component notified with:');
        console.log('   ├─ ID: ' + updatedReservation.id);
        console.log('   ├─ totalPrice: ' + updatedReservation.totalPrice);
        console.log('   ├─ deposit: ' + updatedReservation.deposit);
        console.log('   ├─ totalDays: ' + updatedReservation.totalDays);
        console.log('   └─ status: ' + updatedReservation.status);
      }
      
      // Show success message briefly before navigating back
      console.log('🎉 Waiting 500ms before returning to previous view...');
      setTimeout(() => {
        console.log('👈 Navigating back to previous view');
        onBack();
      }, 500);
    } catch (error) {
      console.error('❌ === ERROR DURING SAVE ===', error);
      console.error('📋 Error stack:', error instanceof Error ? error.stack : 'Unknown error');
      alert(lang === 'fr' ? '❌ Erreur lors de la mise à jour de la réservation. Vérifiez la console pour plus de détails.' : '❌ Error updating reservation. Check console for details.');
    }
  };

  const handleSaveAndContinue = () => {
    handleSave();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            {lang === 'fr' ? 'Retour' : 'العودة'}
          </button>
          <div>
            <h2 className="text-3xl font-black text-saas-text-main uppercase tracking-tighter">
              ✏️ {lang === 'fr' ? 'Modifier Réservation' : 'تعديل الحجز'}
            </h2>
            <p className="text-saas-text-muted font-bold uppercase text-[10px] tracking-widest">
              #{reservation.id} • {lang === 'fr' ? 'Étape' : 'الخطوة'} {currentStep} {lang === 'fr' ? 'sur' : 'من'} 6
            </p>
          </div>
        </div>

        {/* Save Indicator */}
        {hasChanges && (
          <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-bold text-sm">
              {lang === 'fr' ? 'Modifications non sauvegardées' : 'تغييرات غير محفوظة'}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 transition-colors ${
                idx < steps.findIndex(s => s.id === currentStep) ? 'bg-green-500 text-white' :
                idx === steps.findIndex(s => s.id === currentStep) ? 'bg-blue-500 text-white' :
                'bg-slate-200 text-slate-500'
              }`}>
                {idx < steps.findIndex(s => s.id === currentStep) ? <CheckCircle className="w-6 h-6" /> : step.icon}
              </div>
              <p className={`text-xs font-bold text-center ${
                idx <= steps.findIndex(s => s.id === currentStep) ? 'text-slate-900' : 'text-slate-500'
              }`}>
                {step.title}
              </p>
            </div>
          ))}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${isInspectionMode ? ((steps.findIndex(s => s.id === currentStep) + 1) / steps.length) * 100 : (currentStep / 6) * 100}%` }}
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
            {(!isInspectionMode && currentStep === 1) && <Step1DatesLocations lang={lang} formData={formData} setFormData={setFormData} agencies={agencies} isLoadingAgencies={isLoadingAgencies} />}
            {(!isInspectionMode && currentStep === 2) && <Step2VehicleSelection lang={lang} formData={formData} setFormData={setFormData} />}
            {(isInspectionMode ? currentStep === 3 : currentStep === 3) && <Step3DepartureInspection lang={lang} formData={formData} setFormData={setFormData} />}
            {(!isInspectionMode && currentStep === 4) && <Step4ClientSelection lang={lang} formData={formData} setFormData={setFormData} />}
            {(isInspectionMode ? currentStep === 5 : currentStep === 5) && <Step5AdditionalServices lang={lang} formData={formData} setFormData={setFormData} />}
            {(isInspectionMode ? currentStep === 6 : currentStep === 6) && <Step6FinalPricing lang={lang} formData={formData} setFormData={setFormData} />}
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

        <div className="flex gap-3">
          {hasChanges && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-bold transition-all"
            >
              <Save className="w-4 h-4" />
              {lang === 'fr' ? 'Sauvegarder' : 'حفظ'}
            </button>
          )}

          {currentStep < 6 ? (
            <button
              onClick={handleNext}
              className="btn-saas-primary"
            >
              {lang === 'fr' ? 'Suivant' : 'التالي'}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSaveAndContinue}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-bold transition-all"
            >
              ✅ {lang === 'fr' ? 'Finaliser Modifications' : 'إنهاء التعديلات'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Edit Step 1: Dates & Locations
const EditStep1DatesLocations: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => (
  <div className="space-y-8">
    <h3 className="text-2xl font-black text-slate-900">
      📅 {lang === 'fr' ? 'Modifier Dates et Lieux' : 'تعديل التواريخ والأماكن'}
    </h3>

    <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200">
      <div className="flex items-center gap-2 text-yellow-800 mb-4">
        <AlertTriangle className="w-5 h-5" />
        <p className="font-bold">
          {lang === 'fr' ? '⚠️ Modification des dates peut affecter la disponibilité du véhicule' : '⚠️ تعديل التواريخ قد يؤثر على توفر المركبة'}
        </p>
      </div>
    </div>

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
            <select
              value={formData.step1?.departureLocation || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                step1: { ...prev.step1!, departureLocation: e.target.value }
              }))}
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{lang === 'fr' ? 'Sélectionner une agence...' : 'اختر وكالة...'}</option>
              <option value="AGENCE MHD-AUTO">{lang === 'fr' ? 'AGENCE MHD-AUTO' : 'وكالة MHD-AUTO'}</option>
              <option value="Autre agence">{lang === 'fr' ? 'Autre agence' : 'وكالة أخرى'}</option>
            </select>
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
            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{lang === 'fr' ? 'Sélectionner une agence...' : 'اختر وكالة...'}</option>
            <option value="AGENCE MHD-AUTO">{lang === 'fr' ? 'AGENCE MHD-AUTO' : 'وكالة MHD-AUTO'}</option>
            <option value="Autre agence">{lang === 'fr' ? 'Autre agence' : 'وكالة أخرى'}</option>
          </select>
        </div>
      </div>
    </div>

    {/* Duration Summary */}
    {(formData.step1?.departureDate && formData.step1?.returnDate) && (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
        <h4 className="text-lg font-black text-slate-900 mb-4">
          ⏱️ {lang === 'fr' ? 'Nouveau Résumé de Durée' : 'ملخص المدة الجديد'}
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

// Simplified edit versions of other steps - they would follow similar patterns
const EditStep2VehicleSelection: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => (
  <div className="space-y-8">
    <h3 className="text-2xl font-black text-slate-900">
      🚗 {lang === 'fr' ? 'Modifier le Véhicule' : 'تعديل المركبة'}
    </h3>

    <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
      <div className="flex items-center gap-2 text-red-800 mb-4">
        <AlertTriangle className="w-5 h-5" />
        <p className="font-bold">
          {lang === 'fr' ? '⚠️ Changer de véhicule peut nécessiter une nouvelle inspection' : '⚠️ تغيير المركبة قد يتطلب فحصاً جديداً'}
        </p>
      </div>
    </div>

    {/* Current Vehicle */}
    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
      <h4 className="text-lg font-black text-slate-900 mb-4">
        🚗 {lang === 'fr' ? 'Véhicule Actuel' : 'المركبة الحالية'}
      </h4>
      {formData.car && (
        <div className="flex items-center gap-4">
          <img
            src={formData.car.images[0]}
            alt={`${formData.car.brand} ${formData.car.model}`}
            className="w-16 h-12 rounded-lg object-cover"
          />
          <div>
            <p className="font-bold text-lg">{formData.car.brand} {formData.car.model}</p>
            <p className="text-slate-600">{formData.car.registration}</p>
          </div>
        </div>
      )}
    </div>

    {/* Vehicle selection would go here - similar to create form */}
    <div className="text-center py-12">
      <CarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <p className="text-slate-500 text-lg">
        {lang === 'fr' ? 'Sélecteur de véhicule à implémenter' : 'محدد المركبة للتنفيذ'}
      </p>
    </div>
  </div>
);

const EditStep3DepartureInspection: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
  agencies: any[];
  isLoadingAgencies: boolean;
}> = ({ lang, formData, setFormData, agencies, isLoadingAgencies }) => {
  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState<'full' | 'half' | 'quarter' | 'eighth' | 'empty'>('full');
  const [selectedInspectionLocation, setSelectedInspectionLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<any[]>([]);
  const [signature, setSignature] = useState('');
  const initializeRef = React.useRef(false);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const inspectionId = formData.step3?.departureInspection?.id;
      const result = await uploadInspectionImage(file, inspectionId, type);
      if (result.success && result.url) {
        const url = result.url;
        setPhotos(prev => [...prev, { url, type, file }]);
        // also update formData arrays
        setFormData(prev => {
          const dep = prev.step3?.departureInspection || {};
          const interior = (dep.interiorPhotos || []).slice();
          const exterior = (dep.exteriorPhotos || []).slice();
          const other = (dep.other_photos || dep.otherPhotos || []).slice();
          if (type === 'interior') interior.push(url);
          else if (type === 'exterior_front' || type === 'exterior_rear' || type === 'exterior') exterior.push(url);
          else other.push(url);
          return {
            ...prev,
            step3: {
              ...prev.step3,
              departureInspection: {
                ...(prev.step3?.departureInspection || {}),
                interiorPhotos: interior,
                exteriorPhotos: exterior,
                other_photos: other,
                otherPhotos: other
              }
            }
          };
        });
      } else {
        alert(result.error || (lang === 'fr' ? 'Erreur lors du téléchargement' : 'خطأ في التحميل'));
      }
    } catch (err) {
      console.error('Error uploading photo in edit form:', err);
      alert(lang === 'fr' ? 'Erreur lors du téléchargement' : 'خطأ في التحميل');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const next = prev.filter((_, i) => i !== index);
      // rebuild arrays in formData from remaining photos
      setFormData(prevForm => {
        const dep = prevForm.step3?.departureInspection || {};
        const remaining = next.map(p => p.url);
        return {
          ...prevForm,
          step3: {
            ...prevForm.step3,
            departureInspection: {
              ...(prevForm.step3?.departureInspection || {}),
              interiorPhotos: next.filter(p => p.type === 'interior').map(p => p.url),
              exteriorPhotos: next.filter(p => p.type === 'exterior').map(p => p.url),
              other_photos: next.filter(p => p.type === 'other').map(p => p.url),
              otherPhotos: next.filter(p => p.type === 'other').map(p => p.url),
            }
          }
        };
      });
      return next;
    });
  };

  // Initialize from existing inspection data - only on first load
  useEffect(() => {
    const inspection = formData.step3?.departureInspection;
    if (inspection && !initializeRef.current) {
      initializeRef.current = true;
      setMileage(inspection.mileage?.toString() || '');
      setFuelLevel(inspection.fuelLevel || 'full');
      setSelectedInspectionLocation(inspection.location || '');
      setNotes(inspection.notes || '');
      setSignature(inspection.signature || inspection.client_signature || '');
      // Collect all photo types into a single photos array with type tags
      const combined: any[] = [];
      if (inspection.interiorPhotos && inspection.interiorPhotos.length) {
        combined.push(...inspection.interiorPhotos.map((url: string) => ({ url, type: 'interior' })));
      }
      if (inspection.exteriorPhotos && inspection.exteriorPhotos.length) {
        combined.push(...inspection.exteriorPhotos.map((url: string) => ({ url, type: 'exterior' })));
      }
      if (inspection.other_photos && inspection.other_photos.length) {
        combined.push(...inspection.other_photos.map((url: string) => ({ url, type: 'other' })));
      }
      if (inspection.otherPhotos && inspection.otherPhotos.length) {
        combined.push(...inspection.otherPhotos.map((url: string) => ({ url, type: 'other' })));
      }
      setPhotos(combined);

      // Merge with master checklist items so UI shows all checklist entries with correct checked state
      (async () => {
        try {
          const checklist = await ReservationsService.getChecklistItems();
          // map existing responses by checklist id
          const respMap: Record<string, any> = {};
          (inspection.inspectionItems || []).forEach((r: any) => {
            respMap[r.id] = r;
          });
          const merged = checklist.map((item: any) => ({
            id: item.id,
            name: item.item_name,
            category: item.category === 'securite' ? 'security' : item.category === 'equipements' ? 'equipment' : item.category === 'confort' ? 'comfort' : 'cleanliness',
            checked: !!(respMap[item.id] && respMap[item.id].status),
            note: respMap[item.id]?.note || ''
          }));

          // set into formData so save uses full checklist
          setFormData(prev => ({
            ...prev,
            step3: {
              ...prev.step3,
              departureInspection: {
                ...(prev.step3?.departureInspection || {}),
                inspectionItems: merged
              }
            }
          }));
        } catch (err) {
          console.error('Failed to load checklist items for merge:', err);
        }
      })();
    }
  }, []);

  // Update formData when individual values change
  const updateInspectionData = React.useCallback(() => {
    const inspectionData = {
      id: formData.step3?.departureInspection?.id || `inspection_${Date.now()}`,
      reservationId: formData.id || '',
      type: 'departure' as const,
      mileage: parseInt(mileage) || 0,
      fuelLevel,
      location: selectedInspectionLocation,
      date: formData.step3?.departureInspection?.date || new Date().toISOString().split('T')[0],
      time: formData.step3?.departureInspection?.time || new Date().toTimeString().split(' ')[0],
      interiorPhotos: photos.filter(p => p.type === 'interior').map(p => p.url),
      exteriorPhotos: photos.filter(p => p.type.includes('exterior')).map(p => p.url),
      inspectionItems: formData.step3?.departureInspection?.inspectionItems || [],
      notes,
      signature,
      client_signature: signature, // always sync to DB field
      createdAt: formData.step3?.departureInspection?.createdAt || new Date().toISOString()
    };

    setFormData(prev => ({
      ...prev,
      step3: {
        ...prev.step3,
        departureInspection: inspectionData
      }
    }));
  }, [mileage, fuelLevel, selectedInspectionLocation, notes, signature, photos, formData.step3?.departureInspection?.id, formData.step3?.departureInspection?.date, formData.step3?.departureInspection?.time, formData.step3?.departureInspection?.inspectionItems, formData.step3?.departureInspection?.createdAt, formData.id, setFormData]);

  // Debounced update on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      updateInspectionData();
    }, 500);
    return () => clearTimeout(timer);
  }, [mileage, fuelLevel, selectedInspectionLocation, notes, signature, photos, updateInspectionData]);

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-black text-slate-900">
        🔍 {lang === 'fr' ? 'Modifier Inspection Départ' : 'Edit Departure Inspection'}
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Basic Inspection Info */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
          <h4 className="text-lg font-black text-slate-900 mb-4">
            📊 {lang === 'fr' ? 'Informations de Base' : 'Basic Information'}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block font-bold text-slate-900 mb-2">
                ⛽ {lang === 'fr' ? 'Kilométrage au Départ' : 'Departure Mileage'}
              </label>
              <input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-900 mb-3">
                ⛽ {lang === 'fr' ? 'Niveau de Carburant' : 'Fuel Level'}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { value: 'full', label: 'PLEIN' },
                  { value: 'half', label: '1/2' },
                  { value: 'quarter', label: '1/4' },
                  { value: 'eighth', label: '1/8' },
                  { value: 'empty', label: 'VIDE' }
                ].map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setFuelLevel(level.value as any)}
                    className={`p-2 text-xs border rounded-lg font-bold transition-colors ${
                      fuelLevel === level.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-900 mb-2">
                📍 {lang === 'fr' ? 'Lieu d\'Inspection' : 'Inspection Location'}
              </label>
              <select
                value={selectedInspectionLocation}
                onChange={(e) => setSelectedInspectionLocation(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoadingAgencies}
              >
                <option value="">
                  {isLoadingAgencies 
                    ? (lang === 'fr' ? 'Chargement...' : 'Loading...') 
                    : (lang === 'fr' ? 'Sélectionner une agence...' : 'Select an agency...')
                  }
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
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
          <h4 className="text-lg font-black text-slate-900 mb-4">
            📝 {lang === 'fr' ? 'Notes' : 'Notes'}
          </h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder={lang === 'fr' ? 'Notes sur l\'inspection...' : 'Inspection notes...'}
          />
        </div>

        {/* Photos and Signature */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
          <h4 className="text-lg font-black text-slate-900 mb-4">
            📸 {lang === 'fr' ? 'Photos & Signature' : 'Photos & Signature'}
          </h4>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">
                {lang === 'fr' ? 'Photos téléchargées:' : 'Uploaded photos:'} {photos.length}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Upload buttons */}
                {[
                  { label: 'Extérieur Avant', type: 'exterior_front' },
                  { label: 'Intérieur', type: 'interior' },
                  { label: 'Extérieur Arrière', type: 'exterior_rear' },
                  { label: 'Autres', type: 'other' }
                ].map((item) => (
                  <div key={item.type} className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, item.type)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center hover:bg-slate-50 transition-colors">
                      <Camera className="w-8 h-8 text-slate-500 mb-2" />
                      <span className="text-sm text-slate-700 font-bold text-center">{lang === 'fr' ? item.label : item.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Render photo thumbnails with resolved URLs */}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                  {photos.map((photo, idx) => {
                    const resolveUrl = (u?: string) => {
                      if (!u) return u;
                      if (u.startsWith('http')) return u;
                      const base = import.meta.env.VITE_SUPABASE_URL || '';
                      if (!base) return u;
                      if (u.startsWith('/')) return `${base}${u}`;
                      if (u.includes('/storage/v1')) return `${base}${u}`;
                      if (u.includes('inspection')) return `${base}/storage/v1/object/public/${u.replace(/^\\+/, '')}`;
                      return `${base}/storage/v1/object/public/inspection/${u}`;
                    };

                    const src = resolveUrl(photo.url);
                    return (
                      <div key={idx} className="relative group">
                        <img src={src} alt={`Photo ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {signature && (
                <div>
                  <p className="text-sm font-bold text-slate-900 mb-2">
                    ✍️ {lang === 'fr' ? 'Signature client' : 'Client signature'}
                  </p>
                  <img src={signature} alt="Signature" className="w-full h-16 object-contain border border-slate-300 rounded" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditStep4ClientSelection: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => (
  <div className="space-y-8">
    <h3 className="text-2xl font-black text-slate-900">
      👤 {lang === 'fr' ? 'Modifier le Client' : 'تعديل العميل'}
    </h3>

    <div className="text-center py-12">
      <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <p className="text-slate-500 text-lg">
        {lang === 'fr' ? 'Éditeur de client à implémenter' : 'محرر العميل للتنفيذ'}
      </p>
    </div>
  </div>
);

const EditStep5AdditionalServices: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => (
  <div className="space-y-8">
    <h3 className="text-2xl font-black text-slate-900">
      🛠️ {lang === 'fr' ? 'Modifier Services Supplémentaires' : 'تعديل الخدمات الإضافية'}
    </h3>

    <div className="text-center py-12">
      <Plus className="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <p className="text-slate-500 text-lg">
        {lang === 'fr' ? 'Éditeur de services à implémenter' : 'محرر الخدمات للتنفيذ'}
      </p>
    </div>
  </div>
);

const EditStep6FinalPricing: React.FC<{
  lang: Language;
  formData: Partial<ReservationDetails>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ReservationDetails>>>;
}> = ({ lang, formData, setFormData }) => (
  <div className="space-y-8">
    <h3 className="text-2xl font-black text-slate-900">
      💰 {lang === 'fr' ? 'Ajuster Tarification Finale' : 'تعديل التسعير النهائي'}
    </h3>

    <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200">
      <div className="flex items-center gap-2 text-yellow-800 mb-4">
        <AlertTriangle className="w-5 h-5" />
        <p className="font-bold">
          {lang === 'fr' ? '⚠️ Les modifications de prix peuvent nécessiter l\'accord du client' : '⚠️ تعديلات الأسعار قد تحتاج إلى موافقة العميل'}
        </p>
      </div>
    </div>

    <div className="text-center py-12">
      <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <p className="text-slate-500 text-lg">
        {lang === 'fr' ? 'Éditeur de tarification à implémenter' : 'محرر التسعير للتنفيذ'}
      </p>
    </div>
  </div>
);