import React, { useState, useEffect } from 'react';
import { Language, ReservationDetails, Payment, VehicleInspection, InspectionItem, Agency, RentalSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Calendar, Clock, MapPin, Fuel, Camera, FileText, CreditCard, DollarSign, Printer, AlertTriangle, CheckCircle, XCircle, Plus, Trash2, Edit, Eye, Car as CarIcon, User, Phone, Mail, CreditCard as CardIcon, Shield, Wrench, Sofa, Sparkles, Droplets } from 'lucide-react';
import { ReservationsService } from '../services/ReservationsService';
import { ReservationCommissionsPanel } from './ReservationCommissionsPanel';
import { DatabaseService } from '../services/DatabaseService';
import { supabase } from '../supabase';
import { uploadInspectionImage } from '../services/uploadInspectionImage';
import {
  InspectionChecklist, InspectionPhotoUploader, FuelLevelPicker,
  InspectionPhoto, FUEL_ORDER, fuelLabel,
} from './InspectionChecklist';

interface ReservationDetailsViewProps {
  lang: Language;
  reservation: ReservationDetails;
  onBack: () => void;
  onUpdate?: (reservation: ReservationDetails) => void;
}

export const ReservationDetailsView: React.FC<ReservationDetailsViewProps> = ({ lang, reservation, onBack, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'inspections' | 'payments' | 'financial'>('overview');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const handleAddPayment = () => {
    setShowPaymentModal(true);
  };

  const handleSavePayment = (payment: Payment) => {
    const updatedReservation = {
      ...reservation,
      payments: [...reservation.payments, payment],
      advancePayment: reservation.advancePayment + payment.amount,
      remainingPayment: Math.max(0, reservation.remainingPayment - payment.amount)
    };
    onUpdate?.(updatedReservation);
  };

  const handleDeletePayment = (paymentId: string) => {
    const paymentToDelete = reservation.payments.find(p => p.id === paymentId);
    if (!paymentToDelete) return;

    const updatedReservation = {
      ...reservation,
      payments: reservation.payments.filter(p => p.id !== paymentId),
      advancePayment: reservation.advancePayment - paymentToDelete.amount,
      remainingPayment: reservation.remainingPayment + paymentToDelete.amount
    };
    onUpdate?.(updatedReservation);
  };

  const handlePrintPayment = (payment: Payment) => {
    // Print logic here
    console.log('Print payment:', payment);
    // You could open a print dialog or generate a PDF
  };

  const handleActivate = () => {
    setShowActivationModal(true);
  };

  const handleComplete = () => {
    setShowCompletionModal(true);
  };

  const handlePrint = (type: 'quote' | 'contract' | 'receipt' | 'versement') => {
    // Print logic here
    console.log('Print:', type);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-saas-primary-start hover:text-saas-primary-end font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            {lang === 'fr' ? 'Retour' : 'العودة'}
          </button>
          <div>
            <h2 className="text-3xl font-black text-saas-text-main uppercase tracking-tighter">
              👁️ {lang === 'fr' ? 'Détails de Réservation' : 'تفاصيل الحجز'}
            </h2>
            <p className="text-saas-text-muted font-bold uppercase text-[10px] tracking-widest">
              #{reservation.id}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handlePrint('quote')}
            className="btn-saas-primary text-sm"
          >
            📋 {lang === 'fr' ? 'Devis' : 'عرض أسعار'}
          </button>
          <button
            onClick={() => handlePrint('contract')}
            className="btn-saas-success text-sm"
          >
            📄 {lang === 'fr' ? 'Contrat' : 'عقد'}
          </button>
          <button
            onClick={() => handlePrint('versement')}
            className="btn-saas-secondary text-sm"
          >
            🧾 {lang === 'fr' ? 'Versement' : 'إيصال'}
          </button>
        </div>
      </div>

      {/* Status and Quick Actions */}
      <div className="glass-card p-6 border border-saas-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${
              reservation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
              reservation.status === 'accepted' ? 'bg-teal-100 text-teal-800' :
              reservation.status === 'active' ? 'bg-blue-100 text-blue-800' :
              reservation.status === 'continued' ? 'bg-cyan-100 text-cyan-800' :
              reservation.status === 'completed' ? 'bg-purple-100 text-purple-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {reservation.status === 'confirmed' ? '✅ Confirmé' :
               reservation.status === 'accepted' ? '✅ Accepté' :
               reservation.status === 'active' ? '🔄 Actif' :
               reservation.status === 'continued' ? (lang === 'fr' ? '🔁 Location continuée' : '🔁 كراء ممدد') :
               reservation.status === 'completed' ? '🏁 Terminé' :
               '⏳ En attente'}
            </span>
            <div className="text-sm text-saas-text-muted">
              <p>💰 {lang === 'fr' ? 'Total:' : 'المجموع:'} {reservation.totalPrice.toLocaleString()} {lang === 'fr' ? 'DA' : 'د.ج'}</p>
              <p>💳 {lang === 'fr' ? 'Payé:' : 'مدفوع:'} {reservation.advancePayment.toLocaleString()} {lang === 'fr' ? 'DA' : 'د.ج'}</p>
              <p>⚠️ {lang === 'fr' ? 'Reste:' : 'متبقي:'} {reservation.remainingPayment.toLocaleString()} {lang === 'fr' ? 'DA' : 'د.ج'}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {(reservation.status === 'confirmed' || reservation.status === 'accepted') && (
              <button
                onClick={handleActivate}
                className="btn-saas-success"
              >
                ✅ {lang === 'fr' ? 'Activer' : 'تفعيل'}
              </button>
            )}
            {(reservation.status === 'active' || reservation.status === 'continued') && (
              <button
                onClick={handleComplete}
                className="btn-saas-secondary"
              >
                🏁 {lang === 'fr' ? 'Terminer' : 'إنهاء'}
              </button>
            )}
            <button
              onClick={handleAddPayment}
              className="btn-saas-primary"
            >
              💳 {lang === 'fr' ? 'Régler Dette' : 'تسوية الدين'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="glass-card border border-saas-border">
        <div className="flex border-b border-saas-border">
          {[
            { id: 'overview', label: lang === 'fr' ? 'Aperçu' : 'نظرة عامة', icon: '👁️' },
            { id: 'inspections', label: lang === 'fr' ? 'Inspections' : 'الفحوصات', icon: '🔍' },
            { id: 'payments', label: lang === 'fr' ? 'Paiements' : 'المدفوعات', icon: '💰' },
            { id: 'financial', label: lang === 'fr' ? 'Financier' : 'المالي', icon: '📊' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-4 px-6 text-center font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-saas-primary-start/10 text-saas-primary-start border-b-2 border-saas-primary-start'
                  : 'text-saas-text-muted hover:bg-saas-bg'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab lang={lang} reservation={reservation} />}
          {activeTab === 'inspections' && <InspectionsTab lang={lang} reservation={reservation} />}
          {activeTab === 'payments' && <PaymentsTab lang={lang} reservation={reservation} onAddPayment={handleAddPayment} onDeletePayment={handleDeletePayment} onPrintPayment={handlePrintPayment} />}
          {activeTab === 'financial' && <FinancialTab lang={lang} reservation={reservation} />}
          {(activeTab === 'overview' || activeTab === 'financial') && (
            <ReservationCommissionsPanel lang={lang} reservationId={reservation.id} totalPrice={reservation.totalPrice} />
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPaymentModal && (
          <PaymentModal lang={lang} reservation={reservation} onClose={() => setShowPaymentModal(false)} onAddPayment={handleSavePayment} />
        )}
        {showActivationModal && (
          <ActivationModal lang={lang} reservation={reservation} onClose={() => setShowActivationModal(false)} onActivate={onUpdate} />
        )}
        {showCompletionModal && (
          <CompletionModal lang={lang} reservation={reservation} onClose={() => setShowCompletionModal(false)} onComplete={onUpdate} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{ lang: Language; reservation: ReservationDetails }> = ({ lang, reservation }) => (
  <div className="space-y-8">
    {/* Chronologie de la Location */}
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
      <h3 className="text-xl font-black text-slate-900 mb-6">
        📅 {lang === 'fr' ? 'Chronologie de la Location' : 'جدولة التأجير'}
      </h3>
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <div className="bg-blue-100 rounded-full p-4 mb-2">
            <MapPin className="w-8 h-8 text-blue-600" />
          </div>
          <p className="font-bold text-slate-900">{lang === 'fr' ? 'Départ' : 'المغادرة'}</p>
          <p className="text-sm text-slate-600">{reservation.step1.departureDate}</p>
          <p className="text-sm text-slate-600">{reservation.step1.departureTime}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-0.5 bg-blue-300"></div>
          <Clock className="w-6 h-6 text-blue-500" />
          <div className="w-16 h-0.5 bg-blue-300"></div>
        </div>
        <div className="text-center">
          <div className="bg-green-100 rounded-full p-4 mb-2">
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
          <p className="font-bold text-slate-900">{lang === 'fr' ? 'Durée' : 'المدة'}</p>
          <p className="text-sm text-slate-600">{reservation.totalDays} {lang === 'fr' ? 'jours' : 'أيام'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-0.5 bg-green-300"></div>
          <Clock className="w-6 h-6 text-green-500" />
          <div className="w-16 h-0.5 bg-green-300"></div>
        </div>
        <div className="text-center">
          <div className="bg-purple-100 rounded-full p-4 mb-2">
            <MapPin className="w-8 h-8 text-purple-600" />
          </div>
          <p className="font-bold text-slate-900">{lang === 'fr' ? 'Retour' : 'العودة'}</p>
          <p className="text-sm text-slate-600">{reservation.step1.returnDate}</p>
          <p className="text-sm text-slate-600">{reservation.step1.returnTime}</p>
        </div>
      </div>
    </div>

    {/* Client & Vehicle Info */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Client Info */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
        <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          👤 {lang === 'fr' ? 'Locataire' : 'المستأجر'}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {reservation.client.profilePhoto && (
              <img
                src={reservation.client.profilePhoto}
                alt={`${reservation.client.firstName} ${reservation.client.lastName}`}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-bold text-lg">{reservation.client.firstName} {reservation.client.lastName}</p>
              <p className="text-slate-600">📱 {reservation.client.phone}</p>
              <p className="text-slate-600">📧 {reservation.client.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-bold text-slate-900">🆔 {lang === 'fr' ? 'Permis' : 'رخصة'}</p>
              <p className="text-slate-600">{reservation.client.licenseNumber}</p>
            </div>
            <div>
              <p className="font-bold text-slate-900">🎂 {lang === 'fr' ? 'Naissance' : 'الميلاد'}</p>
              <p className="text-slate-600">{reservation.client.dateOfBirth || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
        <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          🚗 {lang === 'fr' ? 'Véhicule' : 'المركبة'}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={reservation.car.images[0]}
              alt={`${reservation.car.brand} ${reservation.car.model}`}
              className="w-16 h-12 rounded-lg object-cover"
            />
            <div>
              <p className="font-bold text-lg">{reservation.car.brand} {reservation.car.model}</p>
              <p className="text-slate-600">🏷️ {reservation.car.registration}</p>
              <p className="text-slate-600">🎨 {reservation.car.color}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-bold text-slate-900">📅 {lang === 'fr' ? 'Année' : 'السنة'}</p>
              <p className="text-slate-600">{reservation.car.year}</p>
            </div>
            <div>
              <p className="font-bold text-slate-900">⛽ {lang === 'fr' ? 'Carburant' : 'الوقود'}</p>
              <p className="text-slate-600">{reservation.car.energy}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Inspections Tab Component
const InspectionsTab: React.FC<{ lang: Language; reservation: ReservationDetails }> = ({ lang, reservation }) => {
  const securityItems = reservation.departureInspection?.inspectionItems.filter(i => i.category === 'security') || [];
  const equipmentItems = reservation.departureInspection?.inspectionItems.filter(i => i.category === 'equipment') || [];
  const comfortItems = reservation.departureInspection?.inspectionItems.filter(i => i.category === 'comfort' || i.category === 'cleanliness') || [];

  const returnSecurityItems = (reservation.returnInspection?.inspectionItems || reservation.departureInspection?.inspectionItems || []).filter(i => i.category === 'security');
  const returnEquipmentItems = (reservation.returnInspection?.inspectionItems || reservation.departureInspection?.inspectionItems || []).filter(i => i.category === 'equipment');
  const returnComfortItems = (reservation.returnInspection?.inspectionItems || reservation.departureInspection?.inspectionItems || []).filter(i => i.category === 'comfort' || i.category === 'cleanliness');

  return (
  <div className="space-y-6">
    {/* Check-in */}
    <div className="glass-card p-6 border border-saas-border">
      <h3 className="text-xl font-black text-saas-text-main mb-4 flex items-center gap-2">
        ✅ {lang === 'fr' ? 'Check-in (Mise en Circulation)' : 'الدخول (التداول)'}
      </h3>
      {reservation.departureInspection ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="font-bold text-blue-900">⛽ {lang === 'fr' ? 'Kilométrage' : 'العداد'}</p>
              <p className="text-2xl font-black text-blue-700">{reservation.departureInspection.mileage.toLocaleString()} km</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="font-bold text-green-900">🛢️ {lang === 'fr' ? 'Carburant' : 'الوقود'}</p>
              <p className="text-2xl font-black text-green-700">
                {reservation.departureInspection.fuelLevel === 'full' ? 'PLEIN' :
                 reservation.departureInspection.fuelLevel === 'half' ? '1/2' :
                 reservation.departureInspection.fuelLevel === 'quarter' ? '1/4' :
                 reservation.departureInspection.fuelLevel === 'eighth' ? '1/8' : 'VIDE'}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="font-bold text-purple-900">📍 {lang === 'fr' ? 'Localisation' : 'الموقع'}</p>
              <p className="text-lg font-bold text-purple-700">{reservation.departureInspection.location}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="font-bold text-orange-900">📅 {lang === 'fr' ? 'Date & Heure' : 'التاريخ والوقت'}</p>
              <p className="text-lg font-bold text-orange-700">{reservation.departureInspection.date}</p>
              <p className="text-sm text-orange-600">{reservation.departureInspection.time}</p>
            </div>
          {reservation.departureInspection.signature && (
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="font-bold text-indigo-900">✍️ {lang === 'fr' ? 'Signature' : 'التوقيع'}</p>
              <div className="mt-2">
                <img src={reservation.departureInspection.signature} alt="Client Signature" className="w-full h-16 object-contain border border-indigo-300 rounded" />
              </div>
            </div>
          )}
          </div>

          {/* Photos Gallery */}
          <div className="space-y-4">
            {(reservation.departureInspection.exteriorPhotos && reservation.departureInspection.exteriorPhotos.length > 0) && (
              <div>
                <h4 className="font-bold text-saas-text-main mb-3">📸 {lang === 'fr' ? 'Photos Extérieures' : 'الصور الخارجية'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reservation.departureInspection.exteriorPhotos.map((photo, idx) => (
                    <div key={`exterior-${idx}`} className="rounded-lg overflow-hidden border border-saas-border shadow-md">
                      <img src={photo} alt={`Exterior ${idx + 1}`} className="w-full h-48 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {(reservation.departureInspection.interiorPhotos && reservation.departureInspection.interiorPhotos.length > 0) && (
              <div>
                <h4 className="font-bold text-saas-text-main mb-3">🏎️ {lang === 'fr' ? 'Photos Intérieures' : 'الصور الداخلية'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reservation.departureInspection.interiorPhotos.map((photo, idx) => (
                    <div key={`interior-${idx}`} className="rounded-lg overflow-hidden border border-saas-border shadow-md">
                      <img src={photo} alt={`Interior ${idx + 1}`} className="w-full h-48 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Inspection Items */}
          <div className="space-y-6">
            {/* Security Items */}
            <div>
              <h4 className="font-bold text-saas-text-main mb-3">🛡️ {lang === 'fr' ? 'Sécurité' : 'الأمان'}</h4>
              <div className="space-y-2">
                {securityItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-saas-border">
                    <span className="font-bold capitalize text-saas-text-main">
                      {item.name}
                    </span>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded font-bold text-sm ${item.checked ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {item.checked ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Items */}
            <div>
              <h4 className="font-bold text-saas-text-main mb-3">🔧 {lang === 'fr' ? 'Équipements' : 'المعدات'}</h4>
              <div className="space-y-2">
                {equipmentItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-saas-border">
                    <span className="font-bold capitalize text-saas-text-main">
                      {item.name}
                    </span>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded font-bold text-sm ${item.checked ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {item.checked ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comfort & Cleanliness Items */}
            <div>
              <h4 className="font-bold text-saas-text-main mb-3">✨ {lang === 'fr' ? 'Confort & Propreté' : 'الراحة والنظافة'}</h4>
              <div className="space-y-2">
                {comfortItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-saas-border">
                    <span className="font-bold capitalize text-saas-text-main">
                      {item.name}
                    </span>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded font-bold text-sm ${item.checked ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {item.checked ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-saas-text-muted italic">{lang === 'fr' ? 'Aucune inspection de départ enregistrée' : 'لم يتم تسجيل فحص المغادرة'}</p>
      )}
    </div>

    {/* Check-out */}
    <div className="glass-card p-6 border border-saas-border">
      <h3 className="text-xl font-black text-saas-text-main mb-4 flex items-center gap-2">
        🔒 {lang === 'fr' ? 'Check-out (Clôture)' : 'الخروج (الإغلاق)'}
      </h3>
      {reservation.returnInspection ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="font-bold text-blue-900">⛽ {lang === 'fr' ? 'Kilométrage' : 'العداد'}</p>
              <p className="text-2xl font-black text-blue-700">{reservation.returnInspection.mileage.toLocaleString()} km</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="font-bold text-green-900">📏 {lang === 'fr' ? 'Distance' : 'المسافة'}</p>
              <p className="text-2xl font-black text-green-700">
                {reservation.returnInspection.mileage - (reservation.departureInspection?.mileage || 0)} km
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="font-bold text-purple-900">🛢️ {lang === 'fr' ? 'Carburant' : 'الوقود'}</p>
              <p className="text-2xl font-black text-purple-700">
                {reservation.returnInspection.fuelLevel === 'full' ? 'PLEIN' :
                 reservation.returnInspection.fuelLevel === 'half' ? '1/2' :
                 reservation.returnInspection.fuelLevel === 'quarter' ? '1/4' :
                 reservation.returnInspection.fuelLevel === 'eighth' ? '1/8' : 'VIDE'}
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="font-bold text-orange-900">📍 {lang === 'fr' ? 'Localisation' : 'الموقع'}</p>
              <p className="text-lg font-bold text-orange-700">{reservation.returnInspection.location}</p>
            </div>
            {reservation.returnInspection.signature && (
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="font-bold text-indigo-900">✍️ {lang === 'fr' ? 'Signature' : 'التوقيع'}</p>
                <div className="mt-2">
                  <img src={reservation.returnInspection.signature} alt="Client Signature" className="w-full h-16 object-contain border border-indigo-300 rounded" />
                </div>
              </div>
            )}
          </div>

          {/* Photos Gallery */}
          <div className="space-y-4">
            {(reservation.returnInspection.exteriorPhotos && reservation.returnInspection.exteriorPhotos.length > 0) && (
              <div>
                <h4 className="font-bold text-saas-text-main mb-3">📸 {lang === 'fr' ? 'Photos Extérieures' : 'الصور الخارجية'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reservation.returnInspection.exteriorPhotos.map((photo, idx) => (
                    <div key={`return-exterior-${idx}`} className="rounded-lg overflow-hidden border border-saas-border shadow-md">
                      <img src={photo} alt={`Exterior ${idx + 1}`} className="w-full h-48 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {(reservation.returnInspection.interiorPhotos && reservation.returnInspection.interiorPhotos.length > 0) && (
              <div>
                <h4 className="font-bold text-saas-text-main mb-3">🏎️ {lang === 'fr' ? 'Photos Intérieures' : 'الصور الداخلية'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reservation.returnInspection.interiorPhotos.map((photo, idx) => (
                    <div key={`return-interior-${idx}`} className="rounded-lg overflow-hidden border border-saas-border shadow-md">
                      <img src={photo} alt={`Interior ${idx + 1}`} className="w-full h-48 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="font-bold text-indigo-900">📅 {lang === 'fr' ? 'Date & Heure' : 'التاريخ والوقت'}</p>
              <p className="text-lg font-bold text-indigo-700">{reservation.returnInspection.date}</p>
              <p className="text-sm text-indigo-600">{reservation.returnInspection.time}</p>
            </div>
          </div>

          {/* Inspection Items */}
          <div className="space-y-6">
            {/* Security Items */}
            <div>
              <h4 className="font-bold text-saas-text-main mb-3">🛡️ {lang === 'fr' ? 'Sécurité' : 'الأمان'}</h4>
              <div className="space-y-2">
                {returnSecurityItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-saas-border">
                    <span className="font-bold capitalize text-saas-text-main">
                      {item.name}
                    </span>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded font-bold text-sm ${item.checked ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {item.checked ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Items */}
            <div>
              <h4 className="font-bold text-saas-text-main mb-3">🔧 {lang === 'fr' ? 'Équipements' : 'المعدات'}</h4>
              <div className="space-y-2">
                {returnEquipmentItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-saas-border">
                    <span className="font-bold capitalize text-saas-text-main">
                      {item.name}
                    </span>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded font-bold text-sm ${item.checked ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {item.checked ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comfort & Cleanliness Items */}
            <div>
              <h4 className="font-bold text-saas-text-main mb-3">✨ {lang === 'fr' ? 'Confort & Propreté' : 'الراحة والنظافة'}</h4>
              <div className="space-y-2">
                {returnComfortItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-saas-border">
                    <span className="font-bold capitalize text-saas-text-main">
                      {item.name}
                    </span>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded font-bold text-sm ${item.checked ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {item.checked ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-saas-text-muted italic">{lang === 'fr' ? 'Aucune inspection de retour enregistrée' : 'لم يتم تسجيل فحص العودة'}</p>
      )}
    </div>
  </div>
);
};
// Payments Tab Component
const PaymentsTab: React.FC<{ lang: Language; reservation: ReservationDetails; onAddPayment: () => void; onDeletePayment: (id: string) => void; onPrintPayment: (payment: Payment) => void }> = ({ lang, reservation, onAddPayment, onDeletePayment, onPrintPayment }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Include initial advance payment if not already in payments
  const allPayments = [
    ...(reservation.advancePayment > 0 && !reservation.payments.some(p => p.amount === reservation.advancePayment) ? [{
      id: 'initial',
      amount: reservation.advancePayment,
      method: 'cash' as const,
      date: reservation.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      note: lang === 'fr' ? 'Paiement initial' : 'الدفعة الأولية'
    }] : []),
    ...reservation.payments
  ];

  const handleDeleteClick = (paymentId: string) => {
    setShowDeleteConfirm(paymentId);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      onDeletePayment(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  return (
  <div className="space-y-6">
    {/* Payment Summary */}
    <div className="glass-card p-6 border border-saas-border">
      <h3 className="text-xl font-black text-saas-text-main mb-4">
        💰 {lang === 'fr' ? 'Détails Financiers' : 'التفاصيل المالية'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 text-center border border-saas-border">
          <p className="text-sm text-saas-text-muted">{lang === 'fr' ? 'Montant Total' : 'المبلغ الإجمالي'}</p>
          <p className="text-2xl font-black text-saas-text-main">{reservation.totalPrice.toLocaleString()} DA</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
          <p className="text-sm text-green-700">{lang === 'fr' ? 'Montant Payé' : 'المبلغ المدفوع'}</p>
          <p className="text-2xl font-black text-green-700">{reservation.advancePayment.toLocaleString()} DA</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
          <p className="text-sm text-orange-700">{lang === 'fr' ? 'Reste à Payer' : 'المبلغ المتبقي'}</p>
          <p className="text-2xl font-black text-orange-700">{reservation.remainingPayment.toLocaleString()} DA</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
          {typeof reservation.cautionEnabled === 'undefined' || reservation.cautionEnabled ? (
            <>
              <p className="text-sm text-blue-700">{lang === 'fr' ? 'Caution' : 'الضمان'}</p>
              {/* Display caution in DZD */}
              <p className="text-2xl font-black text-blue-700">
                {((reservation as any).cautionAmountDzd || reservation.deposit).toLocaleString()} DA
              </p>
              {/* Display caution in EUR if currency is EUR */}
              {(reservation as any).cautionCurrency === 'EUR' && (reservation as any).euroRate && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-600 mb-1">
                    {lang === 'fr' ? '= ' : '= '} 
                    <span className="font-bold">
                      {(Math.round(((reservation as any).cautionAmountDzd || reservation.deposit) / (reservation as any).euroRate * 100) / 100).toFixed(2)}
                    </span> EUR
                  </p>
                  <p className="text-xs text-blue-500">
                    ({lang === 'fr' ? 'Taux' : 'السعر'}: {(reservation as any).euroRate} DA/€)
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
        {(reservation as any).assuranceEnabled && (
          <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
            <p className="text-sm text-purple-700">{lang === 'fr' ? 'Assurance' : 'التأمين'}</p>
            <p className="text-2xl font-black text-purple-700">
              {Math.round((reservation.totalPrice) * ((reservation as any).assurancePercentage || 0) / 100).toLocaleString()} DA
            </p>
            <p className="text-xs text-purple-600 mt-1">({(reservation as any).assurancePercentage}%)</p>
          </div>
        )}
      </div>
    </div>

    {/* Payment History */}
    <div className="glass-card border border-saas-border">
      <div className="p-6 border-b border-saas-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-saas-text-main">
            🧾 {lang === 'fr' ? 'Historique des Paiements' : 'سجل المدفوعات'}
          </h3>
          <button
            onClick={onAddPayment}
            className="btn-saas-primary"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            {lang === 'fr' ? 'Ajouter Paiement' : 'إضافة دفعة'}
          </button>
        </div>
      </div>
      <div className="p-6">
        {allPayments.length > 0 ? (
          <div className="space-y-4">
            {allPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 bg-saas-bg rounded-lg border border-saas-border">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 rounded-full p-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-saas-text-main">{payment.amount.toLocaleString()} DA</p>
                    <p className="text-sm text-saas-text-muted">{payment.date} • {payment.method === 'cash' ? (lang === 'fr' ? 'Espèces' : 'نقدي') : payment.method === 'card' ? (lang === 'fr' ? 'Carte' : 'بطاقة') : (lang === 'fr' ? 'Virement' : 'تحويل')}</p>
                    {payment.note && <p className="text-xs text-saas-text-muted">{payment.note}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onPrintPayment(payment)}
                    className="p-2 text-saas-primary-start hover:text-saas-primary-end transition-colors"
                    title={lang === 'fr' ? 'Imprimer' : 'طباعة'}
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  {payment.id !== 'initial' && (
                    <button
                      onClick={() => handleDeleteClick(payment.id)}
                      className="p-2 text-red-600 hover:text-red-800 transition-colors"
                      title={lang === 'fr' ? 'Supprimer' : 'حذف'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-saas-text-muted italic text-center py-8">
            {lang === 'fr' ? 'Aucun paiement enregistré' : 'لم يتم تسجيل أي دفعات'}
          </p>
        )}
      </div>
    </div>

    {/* Delete Confirmation Modal */}
    {showDeleteConfirm && (
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
          className="glass-card max-w-sm w-full p-6 border border-saas-border"
        >
          <h3 className="text-lg font-black text-saas-text-main mb-4">
            ⚠️ {lang === 'fr' ? 'Confirmer la Suppression' : 'تأكيد الحذف'}
          </h3>
          <p className="text-saas-text-muted mb-6">
            {lang === 'fr' ? 'Êtes-vous sûr de vouloir supprimer ce paiement ?' : 'هل أنت متأكد من حذف هذه الدفعة؟'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 bg-saas-bg hover:bg-saas-secondary-start/10 text-saas-text-muted font-bold py-2 px-4 rounded-lg border border-saas-border hover:border-saas-secondary-start/20 transition-all"
            >
              {lang === 'fr' ? 'Annuler' : 'إلغاء'}
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 btn-saas-danger"
            >
              🗑️ {lang === 'fr' ? 'Supprimer' : 'حذف'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </div>
);
};

// Financial Tab Component
const FinancialTab: React.FC<{ lang: Language; reservation: ReservationDetails }> = ({ lang, reservation }) => (
  <div className="space-y-6">
    {/* Pricing Breakdown */}
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
      <h3 className="text-xl font-black text-slate-900 mb-6">
        💰 {lang === 'fr' ? 'Décomposition du Tarif' : 'تفصيل الأسعار'}
      </h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center py-2 border-b border-slate-200">
          <span className="font-bold">{lang === 'fr' ? 'Location de base' : 'التأجير الأساسي'}</span>
          <span className="font-bold">{(reservation.totalPrice - reservation.additionalFees).toLocaleString()} DA</span>
        </div>
        {reservation.additionalServices.map((service: any) => (
          <div key={service.id} className="flex justify-between items-center py-2 border-b border-slate-200">
            <span>🛎️ {service.name || service.service_name}</span>
            <span>{Number(service.price).toLocaleString()} DA</span>
          </div>
        ))}
        {(reservation.protectionAssurance || reservation.protectionAssuranceName) && (
          <div className="flex justify-between items-center py-2 border-b border-slate-200">
            <span>🛡️ {reservation.protectionAssurance?.name || reservation.protectionAssuranceName}
              {reservation.protectionAssurancePrice != null && reservation.totalDays > 0 && (
                <span className="text-slate-400 text-sm ml-1">
                  ({(reservation.protectionAssurancePrice).toLocaleString()} DA/{lang === 'fr' ? 'j' : 'ي'} × {reservation.totalDays})
                </span>
              )}
            </span>
            <span>{Math.round((reservation.protectionAssurancePrice || 0) * (reservation.totalDays || 0)).toLocaleString()} DA</span>
          </div>
        )}
        {reservation.excessMileage > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-slate-200 text-red-600">
            <span>{lang === 'fr' ? 'Kilométrage excédentaire' : 'عداد الكيلومترات الزائد'}</span>
            <span>{reservation.excessMileage.toLocaleString()} DA</span>
          </div>
        )}
        {reservation.missingFuel > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-slate-200 text-red-600">
            <span>{lang === 'fr' ? 'Carburant manquant' : 'الوقود المفقود'}</span>
            <span>{reservation.missingFuel.toLocaleString()} DA</span>
          </div>
        )}
        <div className="flex justify-between items-center py-4 border-t-2 border-slate-300 text-lg font-black">
          <span>{lang === 'fr' ? 'TOTAL GÉNÉRAL' : 'المجموع الكلي'}</span>
          <span>{(reservation.totalPrice + reservation.additionalFees).toLocaleString()} DA</span>
        </div>
      </div>
    </div>

    {/* Caution & Assurance Information */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Caution */}
      {typeof reservation.cautionEnabled === 'undefined' || reservation.cautionEnabled ? (
        <div className="bg-blue-50 rounded-2xl shadow-lg p-6 border border-blue-200">
          <h3 className="text-lg font-black text-blue-900 mb-4">🔐 {lang === 'fr' ? 'Caution' : 'الضمان'}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-blue-200">
              <span className="text-blue-700 font-bold">{lang === 'fr' ? 'Montant (DA):' : 'المبلغ (DA):'}</span>
              <span className="font-black text-blue-900">{((reservation as any).cautionAmountDzd || reservation.deposit).toLocaleString()} DA</span>
            </div>
            {(reservation as any).cautionCurrency === 'EUR' && (reservation as any).euroRate && (
              <>
                <div className="flex justify-between items-center py-2 border-b border-blue-200">
                  <span className="text-blue-700 font-bold">{lang === 'fr' ? 'Montant (EUR):' : 'المبلغ (EUR):'}</span>
                  <span className="font-black text-blue-900">
                    {(Math.round(((reservation as any).cautionAmountDzd || reservation.deposit) / (reservation as any).euroRate * 100) / 100).toFixed(2)} €
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-blue-700 text-sm">{lang === 'fr' ? 'Taux de change:' : 'سعر الصرف:'}</span>
                  <span className="text-blue-900 text-sm font-bold">{(reservation as any).euroRate} DA/€</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Assurance Serenity */}
      {(reservation as any).assuranceEnabled && (
        <div className="bg-purple-50 rounded-2xl shadow-lg p-6 border border-purple-200">
          <h3 className="text-lg font-black text-purple-900 mb-4">🛡️ {lang === 'fr' ? 'Assurance Serenity' : 'تأمين Serenity'}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-purple-200">
              <span className="text-purple-700 font-bold">{lang === 'fr' ? 'Pourcentage:' : 'النسبة:'}</span>
              <span className="font-black text-purple-900">{(reservation as any).assurancePercentage || 0}%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-purple-700 font-bold">{lang === 'fr' ? 'Montant:' : 'المبلغ:'}</span>
              <span className="font-black text-purple-900">{Math.round((reservation.totalPrice) * ((reservation as any).assurancePercentage || 0) / 100).toLocaleString()} DA</span>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Assurance de protection sélectionnée (forfait + éléments) */}
    {(reservation.protectionAssurance || reservation.protectionAssuranceName) && (
      <div className="bg-red-50 rounded-2xl shadow-lg p-6 border border-red-200">
        <h3 className="text-lg font-black text-red-900 mb-4">🛡️ {lang === 'fr' ? 'Assurance de Protection' : 'تأمين الحماية'}</h3>
        <div className="flex justify-between items-center py-2 border-b border-red-200 mb-3">
          <span className="font-black text-slate-900">{reservation.protectionAssurance?.name || reservation.protectionAssuranceName}</span>
          <span className="font-black text-red-700">
            {(reservation.protectionAssurancePrice || reservation.protectionAssurance?.pricePerDay || 0).toLocaleString()} DA/{lang === 'fr' ? 'jour' : 'يوم'}
          </span>
        </div>
        {reservation.protectionAssurance && reservation.protectionAssurance.items.length > 0 ? (
          <ul className="space-y-1.5">
            {reservation.protectionAssurance.items.map((item) => (
              <li key={item.linkId || item.itemId} className="flex items-center gap-2 text-sm">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {item.status ? '✓' : '✕'}
                </span>
                <span className={item.status ? 'text-slate-700' : 'text-slate-400 line-through'}>{item.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm italic">{lang === 'fr' ? 'Détail des éléments indisponible' : 'تفاصيل العناصر غير متوفرة'}</p>
        )}
      </div>
    )}
  </div>
);

// Modal Components
const PaymentModal: React.FC<{ lang: Language; reservation: ReservationDetails; onClose: () => void; onAddPayment: (payment: Payment) => void }> = ({ lang, reservation, onClose, onAddPayment }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [note, setNote] = useState('');

  const paymentAmount = parseFloat(amount) || 0;
  const newRemaining = Math.max(0, reservation.remainingPayment - paymentAmount);

  const handleSave = () => {
    if (paymentAmount <= 0) return;
    
    const newPayment: Payment = {
      id: `payment-${Date.now()}`,
      reservationId: reservation.id,
      amount: paymentAmount,
      method,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      note: note || undefined
    };

    onAddPayment(newPayment);
    onClose();
  };

  return (
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
        className="glass-card max-w-md w-full p-6 border border-saas-border"
      >
        <h3 className="text-xl font-black text-saas-text-main mb-6">
          💳 {lang === 'fr' ? 'Ajouter un Paiement' : 'إضافة دفعة'}
        </h3>

        <div className="space-y-4">
          <div className="bg-gradient-to-r from-saas-primary-start/10 to-saas-primary-end/10 rounded-xl p-4 border border-saas-primary-start/20">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-saas-text-main">{lang === 'fr' ? 'Reste à payer:' : 'المبلغ المتبقي:'}</span>
              <span className="font-black text-saas-text-main">{reservation.remainingPayment.toLocaleString()} DA</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-saas-text-main">{lang === 'fr' ? 'Après paiement:' : 'بعد الدفع:'}</span>
              <span className={`font-black ${newRemaining === 0 ? 'text-green-600' : 'text-orange-600'}`}>{newRemaining.toLocaleString()} DA</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-saas-text-main mb-2">
              💰 {lang === 'fr' ? 'Montant' : 'المبلغ'}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border border-saas-border rounded-lg focus:ring-2 focus:ring-saas-primary-start focus:border-transparent"
              placeholder="0"
              min="0"
              max={reservation.remainingPayment}
            />
          </div>

          <div>
            <label className="block font-bold text-saas-text-main mb-2">
              💳 {lang === 'fr' ? 'Méthode de paiement' : 'طريقة الدفع'}
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full p-3 border border-saas-border rounded-lg focus:ring-2 focus:ring-saas-primary-start focus:border-transparent"
            >
              <option value="cash">{lang === 'fr' ? 'Espèces' : 'نقدي'}</option>
              <option value="card">{lang === 'fr' ? 'Carte' : 'بطاقة'}</option>
              <option value="transfer">{lang === 'fr' ? 'Virement' : 'تحويل'}</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-saas-text-main mb-2">
              📝 {lang === 'fr' ? 'Note (Optionnel)' : 'ملاحظة (اختياري)'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 border border-saas-border rounded-lg focus:ring-2 focus:ring-saas-primary-start focus:border-transparent"
              rows={2}
              placeholder={lang === 'fr' ? 'Détails supplémentaires...' : 'تفاصيل إضافية...'}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-saas-bg hover:bg-saas-secondary-start/10 text-saas-text-muted font-bold py-3 px-4 rounded-lg border border-saas-border hover:border-saas-secondary-start/20 transition-all"
          >
            {lang === 'fr' ? 'Annuler' : 'إلغاء'}
          </button>
          <button
            onClick={handleSave}
            disabled={paymentAmount <= 0}
            className="flex-1 btn-saas-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💾 {lang === 'fr' ? 'Enregistrer' : 'حفظ'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};


// reusable signature pad component
const SignaturePad: React.FC<{ lang: Language; onSignatureChange: (signature: string) => void }> = ({ lang, onSignatureChange }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasSignature, setHasSignature] = React.useState(false);

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

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-64 border border-indigo-300 rounded-lg cursor-crosshair bg-white"
          style={{ touchAction: 'none' }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-indigo-400">
              <FileText className="w-6 h-6 mx-auto mb-1" />
              <p className="text-xs font-bold">
                {lang === 'fr' ? 'Signez ici' : 'وقع هنا'}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-indigo-700 font-bold">
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

/* ══════════════════════════════════════════════════════════════════════════
   ACTIVER LA LOCATION
   Reprend exactement la check-list et les zones photo de l'étape
   « Inspection Départ » de la création de réservation (composants partagés).
   ══════════════════════════════════════════════════════════════════════════ */
export const ActivationModal: React.FC<{ lang: Language; reservation: ReservationDetails; onClose: () => void; onActivate?: (reservation: ReservationDetails) => void }> = ({ lang, reservation, onClose, onActivate }) => {
  const [mileage, setMileage] = useState(reservation.departureInspection?.mileage?.toString() || String(reservation.car?.mileage ?? ''));
  const [location, setLocation] = useState((reservation.step1 as any)?.departureLocation || '');
  const [fuelLevel, setFuelLevel] = useState<'full' | 'half' | 'quarter' | 'eighth' | 'empty'>(
    reservation.departureInspection?.fuelLevel || 'full'
  );
  const [notes, setNotes] = useState(reservation.departureInspection?.notes || '');
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>(
    reservation.departureInspection?.inspectionItems || []
  );
  const [checklistMaster, setChecklistMaster] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoadingAgencies, setIsLoadingAgencies] = useState(true);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(true);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setAgencies((await DatabaseService.getAgencies()) || []);
      } catch (err) {
        console.error('Error loading agencies:', err);
      } finally {
        setIsLoadingAgencies(false);
      }
    })();

    (async () => {
      try {
        const master = await DatabaseService.getInspectionChecklistItems();
        setChecklistMaster(master || []);
        // Pré-remplit avec l'inspection déjà saisie à la création, si elle existe
        const saved = reservation.departureInspection?.inspectionItems || [];
        const next: Record<string, boolean> = {};
        (master || []).forEach((m: any) => {
          const hit = saved.find((s: any) => s.id === m.id || s.name === m.item_name);
          next[m.id] = hit ? !!hit.checked : false;
        });
        setResponses(next);
      } catch (err) {
        console.error('Error loading checklist:', err);
      } finally {
        setIsLoadingChecklist(false);
      }
    })();
  }, [reservation.id]);

  // Photos déjà prises lors de l'inspection de départ (consultation)
  const existingPhotos: InspectionPhoto[] = [
    ...(reservation.departureInspection?.exteriorPhotos || []).map(url => ({ url, type: 'exterior_front' })),
    ...(reservation.departureInspection?.interiorPhotos || []).map(url => ({ url, type: 'interior' })),
  ];

  const toggleItem = (itemId: string) => setResponses(prev => ({ ...prev, [itemId]: !prev[itemId] }));

  const handlePhotoUpload = async (file: File, type: string) => {
    setUploadingType(type);
    try {
      const result = await uploadInspectionImage(file, reservation.id, type);
      if (result.success && result.url) {
        setPhotos(prev => [...prev, { url: result.url!, type }]);
      } else {
        setErrorMessage(result.error || (lang === 'fr' ? 'Erreur lors du téléchargement' : 'خطأ في التحميل'));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Upload error');
    } finally {
      setUploadingType(null);
    }
  };

  const handleActivate = async () => {
    if (!mileage || isNaN(parseInt(mileage))) {
      setErrorMessage(lang === 'fr' ? 'Le kilométrage de départ est obligatoire.' : 'عداد المغادرة مطلوب.');
      return;
    }
    setErrorMessage(null);
    setSaving(true);
    try {
      const items = checklistMaster.map((m: any) => ({
        id: m.id,
        name: m.item_name,
        checked: !!responses[m.id],
        category: m.category === 'securite' ? 'security'
          : m.category === 'equipements' ? 'equipment'
          : m.category === 'confort' ? 'comfort' : 'cleanliness',
      })) as InspectionItem[];

      await ReservationsService.activateReservationWithInspection({
        reservationId: reservation.id,
        carId: reservation.car.id,
        mileage: parseInt(mileage),
        fuelLevel,
        location,
        notes,
        inspectionItems: items.length > 0 ? items : inspectionItems,
        departureAgencyId: reservation.step1?.departureAgency,
      });

      await supabase.from('cars').update({ mileage: parseInt(mileage), fuel_level: fuelLevel }).eq('id', reservation.car.id);

      onActivate?.({
        ...reservation,
        status: 'active' as const,
        activatedAt: new Date().toISOString(),
        departureInspection: {
          id: `departure-${reservation.id}`,
          reservationId: reservation.id,
          type: 'departure' as const,
          mileage: parseInt(mileage),
          fuelLevel,
          location,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0],
          interiorPhotos: photos.filter(p => p.type === 'interior').map(p => p.url),
          exteriorPhotos: photos.filter(p => p.type !== 'interior').map(p => p.url),
          inspectionItems: items,
          notes,
          createdAt: new Date().toISOString(),
        },
      });
      onClose();
    } catch (error: any) {
      console.error('Error activating reservation:', error);
      setErrorMessage(error?.message || (lang === 'fr' ? "Erreur lors de l'activation" : 'خطأ في التفعيل'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto sm:py-8"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="bg-saas-bg rounded-3xl shadow-2xl max-w-5xl w-full max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden border border-saas-border"
      >
        {/* En-tête */}
        <div className="relative overflow-hidden bg-[#0F172A] text-white px-8 py-6 shrink-0">
          <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">
                  {lang === 'fr' ? 'Activer la location' : 'تفعيل التأجير'}
                </h3>
                <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.25em] mt-1">
                  {reservation.car.brand} {reservation.car.model} · {reservation.car.registration}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-7 space-y-6">
          {/* Véhicule + client */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-saas-border bg-white overflow-hidden lg:col-span-2">
              <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
                <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white flex items-center justify-center">
                    <CarIcon className="w-4 h-4" />
                  </span>
                  {lang === 'fr' ? 'Véhicule remis' : 'المركبة المسلمة'}
                </h4>
              </div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: lang === 'fr' ? 'Marque & modèle' : 'الماركة', v: `${reservation.car.brand} ${reservation.car.model}` },
                  { l: lang === 'fr' ? 'Immatriculation' : 'رقم التسجيل', v: reservation.car.registration },
                  { l: lang === 'fr' ? 'Couleur' : 'اللون', v: reservation.car.color || '—' },
                  { l: 'VIN', v: reservation.car.vin || '—' },
                ].map(f => (
                  <div key={f.l}>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-saas-text-muted">{f.l}</p>
                    <p className="font-bold text-saas-text-main mt-0.5 break-words">{f.v}</p>
                  </div>
                ))}
              </div>
              {reservation.car.images && reservation.car.images.length > 0 && (
                <div className="px-5 pb-5 grid grid-cols-4 gap-3">
                  {reservation.car.images.slice(0, 4).map((image, idx) => (
                    <img key={idx} src={image} alt={`Car ${idx + 1}`} className="w-full h-20 object-cover rounded-xl border border-saas-border" />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
                <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#0284C7] text-white flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </span>
                  {lang === 'fr' ? 'Client' : 'العميل'}
                </h4>
              </div>
              <div className="p-5 space-y-2 text-sm">
                <p className="font-black text-saas-text-main">
                  {reservation.client?.firstName} {reservation.client?.lastName}
                </p>
                <p className="text-saas-text-muted">{reservation.client?.phone || '—'}</p>
                <p className="text-saas-text-muted text-xs">
                  {reservation.step1?.departureDate} → {reservation.step1?.returnDate}
                </p>
              </div>
            </div>
          </div>

          {/* Relevés de départ */}
          <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
              <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                  <Fuel className="w-4 h-4" />
                </span>
                {lang === 'fr' ? 'Relevés au départ' : 'القراءات عند المغادرة'}
              </h4>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <label className="label-saas">{lang === 'fr' ? 'Kilométrage au départ' : 'عداد المغادرة'}</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      className="input-saas pr-12 font-bold"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-saas-text-muted pointer-events-none">km</span>
                  </div>
                </div>
                <div>
                  <label className="label-saas">{lang === 'fr' ? 'Lieu de prise en charge' : 'مكان الاستلام'}</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={isLoadingAgencies}
                    className="input-saas cursor-pointer"
                  >
                    <option value="">
                      {isLoadingAgencies
                        ? (lang === 'fr' ? 'Chargement…' : 'جاري التحميل…')
                        : (lang === 'fr' ? 'Sélectionner une agence…' : 'اختر وكالة…')}
                    </option>
                    {agencies.map(agency => (
                      <option key={agency.id} value={agency.name}>
                        {agency.name}{agency.city ? ` (${agency.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="label-saas">{lang === 'fr' ? 'Niveau de carburant' : 'مستوى الوقود'}</label>
                  <FuelLevelPicker value={fuelLevel} onChange={setFuelLevel} accent="#059669" />
                </div>
                <div>
                  <label className="label-saas">{lang === 'fr' ? 'Notes rapides' : 'ملاحظات سريعة'}</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="input-saas resize-none"
                    placeholder={lang === 'fr' ? 'Ex : petite éraflure sur portière droite' : 'مثال: خدش صغير على الباب الأيمن'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Check-list — rendu identique à l'étape d'inspection */}
          {isLoadingChecklist ? (
            <div className="h-40 rounded-2xl vel-skeleton" />
          ) : (
            <InspectionChecklist
              lang={lang}
              items={checklistMaster}
              responses={responses}
              onToggle={toggleItem}
              title={lang === 'fr' ? 'Vérification du véhicule' : 'فحص المركبة'}
            />
          )}

          {/* Photos existantes */}
          {existingPhotos.length > 0 && (
            <InspectionPhotoUploader
              lang={lang}
              photos={existingPhotos}
              onUpload={() => {}}
              onRemove={() => {}}
              readOnly
              title={lang === 'fr' ? "Photos de l'inspection de départ" : 'صور فحص المغادرة'}
            />
          )}

          {/* Nouvelles photos */}
          <InspectionPhotoUploader
            lang={lang}
            photos={photos}
            onUpload={handlePhotoUpload}
            onRemove={(i) => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
            uploadingType={uploadingType}
            title={lang === 'fr' ? 'Ajouter des photos à la remise' : 'إضافة صور عند التسليم'}
          />

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4"
            >
              <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-red-700">{errorMessage}</p>
            </motion.div>
          )}
        </div>

        {/* Pied */}
        <div className="shrink-0 px-7 py-5 bg-white border-t border-saas-border flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="btn-saas-outline px-8 cursor-pointer">
            {lang === 'fr' ? 'Annuler' : 'إلغاء'}
          </button>
          <button onClick={handleActivate} disabled={saving} className="btn-saas-success px-10 cursor-pointer">
            {saving
              ? <>⏳ {lang === 'fr' ? 'Activation…' : 'جاري التفعيل…'}</>
              : <><CheckCircle className="w-4 h-4" />{lang === 'fr' ? 'Confirmer et activer' : 'تأكيد وتفعيل'}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   TERMINER LA LOCATION
   • même rendu de check-list que l'inspection de départ
   • photos de l'inspection de départ affichées en consultation
   • limite de kilométrage globale (paramétrable, enregistrée en base)
   • alertes dépassement km et carburant inférieur au départ
   • bilan de paiement complet + encaissement de clôture
   • purge définitive des photos d'inspection à l'enregistrement
   ══════════════════════════════════════════════════════════════════════════ */
export const CompletionModal: React.FC<{ lang: Language; reservation: ReservationDetails; onClose: () => void; onComplete?: (reservation: ReservationDetails) => void }> = ({ lang, reservation, onClose, onComplete }) => {
  const [returnMileage, setReturnMileage] = useState('');
  const [returnFuelLevel, setReturnFuelLevel] = useState<'full' | 'half' | 'quarter' | 'eighth' | 'empty'>('full');
  const [returnDate, setReturnDate] = useState(reservation.step1.returnDate);
  const [returnTime, setReturnTime] = useState(reservation.step1.returnTime);
  const [excessMileage, setExcessMileage] = useState('');
  const [missingFuel, setMissingFuel] = useState('');
  const [documentsRecovered, setDocumentsRecovered] = useState(true);
  const [signature, setSignature] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check-list (référentiel commun, pré-rempli avec l'état de départ)
  const [checklistMaster, setChecklistMaster] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(true);

  // Paramétrage global de la limite de kilométrage
  const [settings, setSettings] = useState<RentalSettings>(DatabaseService.DEFAULT_RENTAL_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<RentalSettings>(DatabaseService.DEFAULT_RENTAL_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // Paiement de clôture
  const [paymentNow, setPaymentNow] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'check'>('cash');

  // Services obligatoires de la réservation. Par défaut cochés (prestation
  // fournie/facturée par l'agence). Les décocher = le client a assuré la
  // prestation lui-même (ex : rend la voiture déjà lavée) → l'agence lui
  // restitue le coût du service, déduit du total dû.
  const [mandatoryServices, setMandatoryServices] = useState<{ id: string; name: string; price: number }[]>([]);
  const [refundedServiceIds, setRefundedServiceIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const master = await DatabaseService.getInspectionChecklistItems();
        setChecklistMaster(master || []);
        const departure = reservation.departureInspection?.inspectionItems || [];
        const next: Record<string, boolean> = {};
        (master || []).forEach((m: any) => {
          const hit = departure.find((s: any) => s.id === m.id || s.name === m.item_name);
          next[m.id] = hit ? !!hit.checked : false;
        });
        setResponses(next);
      } catch (err) {
        console.error('Error loading checklist:', err);
      } finally {
        setIsLoadingChecklist(false);
      }
    })();

    (async () => {
      const s = await DatabaseService.getRentalSettings();
      setSettings(s);
      setSettingsDraft(s);
    })();

    // Détermine les services obligatoires présents sur cette réservation en
    // croisant les services facturés avec le référentiel (drapeau obligatoire).
    (async () => {
      try {
        const master = await DatabaseService.getServices();
        const reservationServices: any[] =
          (reservation as any).additionalServices || reservation.step5?.additionalServices || [];
        const mandatory = reservationServices
          .map((rs: any) => {
            const name = rs.service_name || rs.name || rs.serviceName || '';
            const price = Number(rs.price) || 0;
            const hit = master.find((m: any) => m.name === name);
            const isMandatory = rs.is_mandatory === true || rs.isMandatory === true || !!(hit && hit.isMandatory);
            return { id: String(rs.id || rs.service_id || name), name, price, isMandatory };
          })
          .filter((s: any) => s.isMandatory && s.price > 0)
          .map(({ id, name, price }: any) => ({ id, name, price }));
        setMandatoryServices(mandatory);
      } catch (err) {
        console.error('Error loading mandatory services:', err);
      }
    })();
  }, [reservation.id]);

  const toggleServiceRefund = (id: string) =>
    setRefundedServiceIds(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleItem = (itemId: string) => setResponses(prev => ({ ...prev, [itemId]: !prev[itemId] }));

  const departureMileage = Number(reservation.departureInspection?.mileage) || 0;
  const departureFuel = reservation.departureInspection?.fuelLevel || 'full';
  const totalDistance = returnMileage ? Math.max(0, parseInt(returnMileage) - departureMileage) : 0;

  // ── Alerte kilométrage ───────────────────────────────────────────────────
  const allowedKm = settings.mileageLimitPerDay > 0
    ? settings.mileageLimitPerDay * (Number(reservation.totalDays) || 0)
    : 0;
  const kmOver = allowedKm > 0 ? Math.max(0, totalDistance - allowedKm) : 0;
  const suggestedKmFee = kmOver > 0 ? Math.round(kmOver * (settings.excessMileageFeePerKm || 0)) : 0;

  // ── Alerte carburant (index plus grand = réservoir moins plein) ──────────
  const depIdx = FUEL_ORDER.indexOf(departureFuel as any);
  const retIdx = FUEL_ORDER.indexOf(returnFuelLevel);
  const fuelMissingLevels = retIdx > depIdx ? retIdx - depIdx : 0;
  const suggestedFuelFee = fuelMissingLevels > 0
    ? Math.round(fuelMissingLevels * (settings.fuelFeePerLevel || 0))
    : 0;

  const extraFees = (parseFloat(excessMileage) || 0) + (parseFloat(missingFuel) || 0);

  // ── Restitution des services obligatoires décochés ───────────────────────
  const servicesRefund = mandatoryServices.reduce(
    (s, sv) => s + (refundedServiceIds[sv.id] ? sv.price : 0), 0
  );

  // ── Bilan de paiement ────────────────────────────────────────────────────
  const baseTotal = Number(reservation.totalPrice) || 0;
  const alreadyPaid = (reservation.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
    || Math.max(0, baseTotal - (Number(reservation.remainingPayment) || 0));
  const totalWithFees = Math.max(0, baseTotal + extraFees - servicesRefund);
  const payNow = paymentNow === '' ? 0 : Math.max(0, Number(paymentNow));
  const paidAfter = alreadyPaid + payNow;
  const remainingAfter = Math.max(0, totalWithFees - paidAfter);

  const applySuggestedKmFee = () => setExcessMileage(String(suggestedKmFee));
  const applySuggestedFuelFee = () => setMissingFuel(String(suggestedFuelFee));

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const saved = await DatabaseService.saveRentalSettings(settingsDraft);
      setSettings(saved);
      setSettingsDraft(saved);
      setSettingsMessage(lang === 'fr'
        ? 'Paramètres enregistrés — appliqués à toutes les fins de location.'
        : 'تم حفظ الإعدادات — تُطبق على كل عمليات الإنهاء.');
    } catch (err: any) {
      setSettingsMessage(err?.message || 'Erreur');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleComplete = async () => {
    if (!returnMileage || returnMileage.trim() === '') {
      setErrorMessage(lang === 'fr' ? 'Le kilométrage de retour est obligatoire' : 'عداد العودة مطلوب');
      return;
    }
    if (isNaN(parseInt(returnMileage))) {
      setErrorMessage(lang === 'fr' ? 'Le kilométrage doit être un nombre valide' : 'العداد يجب أن يكون رقم صحيح');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const items = checklistMaster.map((m: any) => ({
        id: m.id,
        name: m.item_name,
        checked: !!responses[m.id],
        category: m.category === 'securite' ? 'security'
          : m.category === 'equipements' ? 'equipment'
          : m.category === 'confort' ? 'comfort' : 'cleanliness',
      })) as InspectionItem[];

      await ReservationsService.completeReservationWithInspection({
        reservationId: reservation.id,
        carId: reservation.carId,
        returnMileage: parseInt(returnMileage),
        returnFuelLevel,
        returnLocation: reservation.step1.returnAgency || reservation.step1.departureAgency,
        returnAgencyId: reservation.step1.returnAgency || reservation.step1.departureAgency,
        excessMileage: parseFloat(excessMileage) || 0,
        missingFuel: parseFloat(missingFuel) || 0,
        signatureDataUrl: signature,
        notes,
        inspectionItems: items,
        // Bilan financier de clôture
        paymentNow: payNow,
        paymentMethod,
        finalTotal: totalWithFees,
        totalPaid: paidAfter,
        remaining: remainingAfter,
        // Purge définitive des photos d'inspection de cette réservation
        purgeInspectionPhotos: true,
      });

      const { error: carError } = await supabase
        .from('cars')
        .update({ mileage: parseInt(returnMileage), fuel_level: returnFuelLevel })
        .eq('id', reservation.car.id);
      if (carError) throw new Error(`Car update failed: ${carError.message}`);

      onComplete?.({
        ...reservation,
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
        totalPrice: totalWithFees,
        advancePayment: paidAfter,
        remainingPayment: remainingAfter,
        returnInspection: {
          id: `return-${reservation.id}`,
          reservationId: reservation.id,
          type: 'return' as const,
          mileage: parseInt(returnMileage),
          fuelLevel: returnFuelLevel,
          location: reservation.step1.returnAgency || reservation.step1.departureAgency,
          date: returnDate,
          time: returnTime,
          interiorPhotos: [],
          exteriorPhotos: [],
          inspectionItems: items,
          notes,
          signature,
          createdAt: new Date().toISOString(),
        },
        excessMileage: parseFloat(excessMileage) || 0,
        missingFuel: parseFloat(missingFuel) || 0,
        additionalFees: extraFees,
        notes,
      });
      onClose();
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('❌ Error completing reservation:', error);
      let userMessage = lang === 'fr' ? 'Erreur lors de la finalisation de la location' : 'خطأ في إنهاء التأجير';
      if (errorMsg.includes('permission') || errorMsg.includes('Policy')) {
        userMessage = lang === 'fr'
          ? "Vous n'avez pas la permission d'effectuer cette action."
          : 'ليس لديك صلاحية لإجراء هذا الإجراء.';
      }
      setErrorMessage(`${userMessage}: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const departurePhotos: InspectionPhoto[] = [
    ...(reservation.departureInspection?.exteriorPhotos || []).map(url => ({ url, type: 'exterior_front' })),
    ...(reservation.departureInspection?.interiorPhotos || []).map(url => ({ url, type: 'interior' })),
  ];

  const money = (n: number) => `${Math.round(n || 0).toLocaleString('fr-DZ')} DA`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto sm:py-8"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="bg-saas-bg rounded-3xl shadow-2xl max-w-6xl w-full max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden border border-saas-border"
      >
        {/* En-tête */}
        <div className="relative overflow-hidden bg-[#0F172A] text-white px-8 py-6 shrink-0">
          <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-[#DC2626]/25 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-[#DC2626] flex items-center justify-center shadow-lg shadow-[#DC2626]/30">
                <FileText className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">
                  {lang === 'fr' ? 'Terminer la location' : 'إنهاء التأجير'}
                </h3>
                <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.25em] mt-1">
                  {reservation.car.brand} {reservation.car.model} · {reservation.car.registration}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-7 space-y-6">
          {/* Paramétrage de la limite de kilométrage (global) */}
          <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <button
              onClick={() => setShowSettings(v => !v)}
              className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-saas-bg transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 font-black text-sm uppercase tracking-tight text-saas-text-main">
                <span className="w-7 h-7 rounded-lg bg-[#0284C7] text-white flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </span>
                {lang === 'fr' ? 'Paramétrage limite de kilométrage' : 'إعداد حد الكيلومترات'}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs font-bold text-saas-text-muted">
                  {settings.mileageLimitPerDay > 0
                    ? `${settings.mileageLimitPerDay} km/${lang === 'fr' ? 'jour' : 'يوم'}`
                    : (lang === 'fr' ? 'Illimité' : 'غير محدود')}
                </span>
                <motion.span animate={{ rotate: showSettings ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <Edit className="w-4 h-4 text-saas-text-muted" />
                </motion.span>
              </span>
            </button>

            <AnimatePresence initial={false}>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-saas-border bg-saas-bg"
                >
                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label-saas">{lang === 'fr' ? 'Limite incluse (km / jour)' : 'الحد المسموح (كم/يوم)'}</label>
                      <input
                        type="number" min={0}
                        value={settingsDraft.mileageLimitPerDay}
                        onChange={e => setSettingsDraft(s => ({ ...s, mileageLimitPerDay: Number(e.target.value) || 0 }))}
                        className="input-saas"
                      />
                      <p className="text-[11px] text-saas-text-muted mt-1">
                        {lang === 'fr' ? '0 = kilométrage illimité' : '0 = بدون حد'}
                      </p>
                    </div>
                    <div>
                      <label className="label-saas">{lang === 'fr' ? 'Frais par km dépassé (DA)' : 'رسوم كل كم زائد (دج)'}</label>
                      <input
                        type="number" min={0} step="0.01"
                        value={settingsDraft.excessMileageFeePerKm}
                        onChange={e => setSettingsDraft(s => ({ ...s, excessMileageFeePerKm: Number(e.target.value) || 0 }))}
                        className="input-saas"
                      />
                    </div>
                    <div>
                      <label className="label-saas">{lang === 'fr' ? 'Frais par cran de carburant (DA)' : 'رسوم كل درجة وقود (دج)'}</label>
                      <input
                        type="number" min={0}
                        value={settingsDraft.fuelFeePerLevel}
                        onChange={e => setSettingsDraft(s => ({ ...s, fuelFeePerLevel: Number(e.target.value) || 0 }))}
                        className="input-saas"
                      />
                    </div>
                  </div>
                  <div className="px-5 pb-5 flex flex-wrap items-center gap-3">
                    <button onClick={saveSettings} disabled={savingSettings} className="btn-vel-blue px-6 py-2.5 text-xs">
                      {savingSettings ? '⏳' : <CheckCircle className="w-4 h-4" />}
                      {lang === 'fr' ? 'Enregistrer pour toutes les locations' : 'حفظ لجميع الإيجارات'}
                    </button>
                    {settingsMessage && <span className="text-xs font-semibold text-saas-text-muted">{settingsMessage}</span>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Kilométrage + alerte */}
          <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
              <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </span>
                {lang === 'fr' ? 'Kilométrage' : 'العداد'}
              </h4>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Départ' : 'المغادرة'}</label>
                <input value={departureMileage} readOnly className="input-saas bg-saas-bg font-bold" />
              </div>
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Retour (requis)' : 'العودة (مطلوب)'}</label>
                <input
                  type="number"
                  value={returnMileage}
                  onChange={(e) => setReturnMileage(e.target.value)}
                  className="input-saas font-bold"
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Distance parcourue' : 'المسافة المقطوعة'}</label>
                <input value={`${totalDistance.toLocaleString('fr-DZ')} km`} readOnly className="input-saas bg-saas-bg font-bold" />
              </div>
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Forfait inclus' : 'المسموح'}</label>
                <input
                  value={allowedKm > 0 ? `${allowedKm.toLocaleString('fr-DZ')} km` : (lang === 'fr' ? 'Illimité' : 'غير محدود')}
                  readOnly
                  className="input-saas bg-saas-bg font-bold"
                />
              </div>
            </div>

            <AnimatePresence>
              {kmOver > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mx-5 mb-5 rounded-2xl border-2 border-[#DC2626]/30 bg-[#DC2626]/5 p-4 flex flex-wrap items-center gap-4">
                    <AlertTriangle className="w-6 h-6 text-[#DC2626] shrink-0" />
                    <div className="flex-1 min-w-[220px]">
                      <p className="font-black text-[#DC2626]">
                        {lang === 'fr' ? 'Limite de kilométrage dépassée' : 'تم تجاوز حد الكيلومترات'}
                      </p>
                      <p className="text-sm text-saas-text-main mt-0.5">
                        {lang === 'fr'
                          ? `${kmOver.toLocaleString('fr-DZ')} km au-delà du forfait de ${allowedKm.toLocaleString('fr-DZ')} km.`
                          : `${kmOver.toLocaleString('fr-DZ')} كم فوق الحد ${allowedKm.toLocaleString('fr-DZ')} كم.`}
                        {settings.excessMileageFeePerKm > 0 && (
                          <> {lang === 'fr' ? 'Frais suggérés :' : 'الرسوم المقترحة:'} <strong>{money(suggestedKmFee)}</strong></>
                        )}
                      </p>
                    </div>
                    {settings.excessMileageFeePerKm > 0 && (
                      <button onClick={applySuggestedKmFee} className="btn-vel-cta px-5 py-2.5 text-xs">
                        {lang === 'fr' ? 'Appliquer les frais' : 'تطبيق الرسوم'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Carburant + alerte */}
          <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg flex items-center justify-between">
              <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                  <Fuel className="w-4 h-4" />
                </span>
                {lang === 'fr' ? 'Carburant' : 'الوقود'}
              </h4>
              <span className="text-xs font-bold text-saas-text-muted">
                {lang === 'fr' ? 'Départ' : 'المغادرة'} : <strong className="text-saas-text-main">{fuelLabel(departureFuel)}</strong>
              </span>
            </div>
            <div className="p-5">
              <label className="label-saas">{lang === 'fr' ? 'Niveau au retour' : 'المستوى عند العودة'}</label>
              <FuelLevelPicker value={returnFuelLevel} onChange={setReturnFuelLevel} accent="#059669" />

              <AnimatePresence>
                {fuelMissingLevels > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 flex flex-wrap items-center gap-4">
                      <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0" />
                      <div className="flex-1 min-w-[220px]">
                        <p className="font-black text-orange-800">
                          {lang === 'fr' ? 'Carburant inférieur au départ' : 'الوقود أقل من المغادرة'}
                        </p>
                        <p className="text-sm text-saas-text-main mt-0.5">
                          {lang === 'fr'
                            ? `Retour à ${fuelLabel(returnFuelLevel)} contre ${fuelLabel(departureFuel)} au départ (${fuelMissingLevels} cran(s) manquant(s)).`
                            : `العودة بـ ${fuelLabel(returnFuelLevel)} مقابل ${fuelLabel(departureFuel)} (${fuelMissingLevels} درجة ناقصة).`}
                          {settings.fuelFeePerLevel > 0 && (
                            <> {lang === 'fr' ? 'Frais suggérés :' : 'الرسوم المقترحة:'} <strong>{money(suggestedFuelFee)}</strong></>
                          )}
                        </p>
                      </div>
                      {settings.fuelFeePerLevel > 0 && (
                        <button onClick={applySuggestedFuelFee} className="btn-vel-cta px-5 py-2.5 text-xs">
                          {lang === 'fr' ? 'Appliquer les frais' : 'تطبيق الرسوم'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Frais supplémentaires */}
          <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
              <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#DC2626] text-white flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </span>
                {lang === 'fr' ? 'Frais supplémentaires' : 'الرسوم الإضافية'}
              </h4>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Kilométrage excédentaire (DA)' : 'الكيلومترات الزائدة (دج)'}</label>
                <input
                  type="number" min={0}
                  value={excessMileage}
                  onChange={(e) => setExcessMileage(e.target.value)}
                  className="input-saas"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Carburant manquant (DA)' : 'الوقود الناقص (دج)'}</label>
                <input
                  type="number" min={0}
                  value={missingFuel}
                  onChange={(e) => setMissingFuel(e.target.value)}
                  className="input-saas"
                  placeholder="0"
                />
              </div>
              <div className="rounded-xl bg-[#DC2626]/5 border border-[#DC2626]/25 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-saas-text-muted">
                  {lang === 'fr' ? 'Total des frais' : 'إجمالي الرسوم'}
                </p>
                <p className="text-xl font-black text-[#DC2626] mt-0.5">{money(extraFees)}</p>
              </div>
            </div>
          </div>

          {/* Services obligatoires — restitution au client */}
          {mandatoryServices.length > 0 && (
            <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
                <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  {lang === 'fr' ? 'Services obligatoires' : 'الخدمات الإلزامية'}
                </h4>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-saas-text-muted leading-relaxed">
                  {lang === 'fr'
                    ? "Décochez un service si le client l'a assuré lui-même (ex : rend le véhicule déjà lavé). Son coût lui est alors restitué et déduit du total."
                    : 'قم بإلغاء تحديد خدمة إذا قام العميل بها بنفسه (مثال: إعادة السيارة نظيفة). عندها تُعاد قيمتها وتُخصم من الإجمالي.'}
                </p>
                {mandatoryServices.map(sv => {
                  const refunded = !!refundedServiceIds[sv.id];
                  return (
                    <button
                      key={sv.id}
                      type="button"
                      onClick={() => toggleServiceRefund(sv.id)}
                      className={`w-full flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        refunded ? 'border-emerald-400 bg-emerald-50' : 'border-saas-border bg-saas-bg hover:border-saas-border-strong'
                      }`}
                    >
                      <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${refunded ? 'bg-slate-300' : 'bg-emerald-500'}`}>
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                          style={{ left: refunded ? 2 : 22 }}
                        />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-black text-saas-text-main truncate">{sv.name}</span>
                        <span className={`block text-xs font-bold mt-0.5 ${refunded ? 'text-emerald-700' : 'text-saas-text-muted'}`}>
                          {refunded
                            ? (lang === 'fr' ? `Restitué au client : −${money(sv.price)}` : `يُعاد للعميل: −${money(sv.price)}`)
                            : (lang === 'fr' ? `Facturé : ${money(sv.price)}` : `مفوتر: ${money(sv.price)}`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {servicesRefund > 0 && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      {lang === 'fr' ? 'Total restitué au client' : 'الإجمالي المُعاد للعميل'}
                    </p>
                    <p className="text-xl font-black text-emerald-700">−{money(servicesRefund)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bilan de paiement */}
          <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
              <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#0284C7] text-white flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </span>
                {lang === 'fr' ? 'Règlement' : 'التسوية'}
              </h4>
            </div>

            <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { l: lang === 'fr' ? 'Total location' : 'إجمالي التأجير', v: money(baseTotal), c: 'text-saas-text-main' },
                { l: lang === 'fr' ? 'Total + frais' : 'الإجمالي + الرسوم', v: money(totalWithFees), c: 'text-[#0F172A]' },
                { l: lang === 'fr' ? 'Déjà payé' : 'المدفوع سابقاً', v: money(alreadyPaid), c: 'text-emerald-600' },
                { l: lang === 'fr' ? 'Reste avant paiement' : 'المتبقي قبل الدفع', v: money(Math.max(0, totalWithFees - alreadyPaid)), c: 'text-[#DC2626]' },
              ].map(cell => (
                <div key={cell.l} className="rounded-xl border border-saas-border bg-saas-bg px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-saas-text-muted leading-tight">{cell.l}</p>
                  <p className={`text-lg font-black mt-1 ${cell.c}`}>{cell.v}</p>
                </div>
              ))}
            </div>

            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Montant encaissé maintenant' : 'المبلغ المحصل الآن'}</label>
                <input
                  type="number" min={0}
                  value={paymentNow}
                  onChange={(e) => setPaymentNow(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input-saas font-bold"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Mode de paiement' : 'طريقة الدفع'}</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="input-saas cursor-pointer"
                >
                  <option value="cash">{lang === 'fr' ? 'Espèces' : 'نقداً'}</option>
                  <option value="card">{lang === 'fr' ? 'Carte' : 'بطاقة'}</option>
                  <option value="transfer">{lang === 'fr' ? 'Virement' : 'تحويل'}</option>
                  <option value="check">{lang === 'fr' ? 'Chèque' : 'شيك'}</option>
                </select>
              </div>
              <div className={`rounded-xl px-4 py-3 border-2 ${
                remainingAfter > 0 ? 'border-[#DC2626]/30 bg-[#DC2626]/5' : 'border-emerald-400 bg-emerald-50'
              }`}>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-saas-text-muted">
                  {lang === 'fr' ? 'Reste après ce paiement' : 'المتبقي بعد الدفع'}
                </p>
                <p className={`text-xl font-black mt-0.5 ${remainingAfter > 0 ? 'text-[#DC2626]' : 'text-emerald-700'}`}>
                  {money(remainingAfter)}
                </p>
                <p className="text-[11px] font-bold mt-0.5 text-saas-text-muted">
                  {remainingAfter > 0
                    ? (lang === 'fr' ? 'Dette : non soldée' : 'الدين: غير مسدد')
                    : (lang === 'fr' ? 'Dette : soldée ✓' : 'الدين: مسدد ✓')}
                </p>
              </div>
            </div>
          </div>

          {/* Dates de retour */}
          <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
              <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </span>
                {lang === 'fr' ? 'Dates et heures' : 'التواريخ والأوقات'}
              </h4>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="label-saas">{lang === 'fr' ? 'Départ' : 'المغادرة'}</label>
                <p className="font-bold text-saas-text-main">
                  {reservation.step1.departureDate} · {reservation.step1.departureTime}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-saas">{lang === 'fr' ? 'Date de retour' : 'تاريخ العودة'}</label>
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="input-saas" />
                </div>
                <div>
                  <label className="label-saas">{lang === 'fr' ? 'Heure' : 'الساعة'}</label>
                  <input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className="input-saas" />
                </div>
              </div>
            </div>
          </div>

          {/* Photos de l'inspection de départ */}
          <InspectionPhotoUploader
            lang={lang}
            photos={departurePhotos}
            onUpload={() => {}}
            onRemove={() => {}}
            readOnly
            title={lang === 'fr' ? "Photos de l'inspection de départ" : 'صور فحص المغادرة'}
          />

          {/* Check-list retour — rendu identique à l'inspection de départ */}
          {isLoadingChecklist ? (
            <div className="h-40 rounded-2xl vel-skeleton" />
          ) : (
            <InspectionChecklist
              lang={lang}
              items={checklistMaster}
              responses={responses}
              onToggle={toggleItem}
              title={lang === 'fr' ? "Vérification de retour (état du véhicule)" : 'فحص العودة (حالة المركبة)'}
            />
          )}

          {/* Documents */}
          <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
              <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#0284C7] text-white flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </span>
                {lang === 'fr' ? 'Documents laissés par le client' : 'الوثائق المتروكة'}
              </h4>
            </div>
            <div className="p-5 flex flex-wrap items-center gap-4">
              {[
                { v: true, l: lang === 'fr' ? 'Client a récupéré' : 'العميل استلم' },
                { v: false, l: lang === 'fr' ? 'Notifier le client (non récupéré)' : 'إشعار العميل (غير مستلم)' },
              ].map(opt => (
                <label key={String(opt.v)} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                  documentsRecovered === opt.v ? 'border-[#0284C7] bg-[#0284C7]/8' : 'border-saas-border bg-saas-bg'
                }`}>
                  <input
                    type="radio"
                    name="documents"
                    checked={documentsRecovered === opt.v}
                    onChange={() => setDocumentsRecovered(opt.v)}
                    className="accent-[#0284C7] cursor-pointer"
                  />
                  <span className="font-bold text-sm text-saas-text-main">{opt.l}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Signature + notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-saas-border bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
                <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main">
                  ✍️ {lang === 'fr' ? 'Signature du client' : 'توقيع العميل'}
                </h4>
              </div>
              <div className="p-5 flex justify-center">
                <SignaturePad lang={lang} onSignatureChange={setSignature} />
              </div>
            </div>

            <div className="rounded-2xl border border-saas-border bg-white overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-saas-border bg-saas-bg">
                <h4 className="font-black text-sm uppercase tracking-tight text-saas-text-main">
                  📝 {lang === 'fr' ? 'Note de clôture' : 'ملاحظة الإنهاء'}
                </h4>
              </div>
              <div className="p-5 flex-1 flex">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-saas flex-1 resize-none min-h-[140px]"
                  placeholder={lang === 'fr' ? 'Observations supplémentaires…' : 'ملاحظات إضافية…'}
                />
              </div>
            </div>
          </div>

          {/* Avertissement purge */}
          <div className="flex items-start gap-3 rounded-2xl border border-orange-300 bg-orange-50 p-4">
            <Trash2 className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-orange-800">
              {lang === 'fr'
                ? "À l'enregistrement, toutes les photos d'inspection de cette réservation seront supprimées définitivement (stockage et base de données)."
                : 'عند الحفظ، سيتم حذف جميع صور الفحص لهذا الحجز نهائياً (التخزين وقاعدة البيانات).'}
            </p>
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-2xl p-4"
            >
              <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">{errorMessage}</p>
                <p className="text-xs text-red-600 mt-1">
                  {lang === 'fr'
                    ? 'Vérifiez la connexion et les données saisies.'
                    : 'تحقق من الاتصال والبيانات المدخلة.'}
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Pied */}
        <div className="shrink-0 px-7 py-5 bg-white border-t border-saas-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-saas-text-muted font-semibold">{lang === 'fr' ? 'À encaisser :' : 'المطلوب:'}</span>
            <span className="ml-2 font-black text-[#0F172A]">{money(totalWithFees)}</span>
            <span className="mx-2 text-saas-text-muted">·</span>
            <span className="text-saas-text-muted font-semibold">{lang === 'fr' ? 'Reste :' : 'المتبقي:'}</span>
            <span className={`ml-2 font-black ${remainingAfter > 0 ? 'text-[#DC2626]' : 'text-emerald-600'}`}>{money(remainingAfter)}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={isLoading} className="btn-saas-outline px-8 cursor-pointer">
              {lang === 'fr' ? 'Annuler' : 'إلغاء'}
            </button>
            <button onClick={handleComplete} disabled={isLoading} className="btn-saas-primary px-10 cursor-pointer">
              {isLoading
                ? <>⏳ {lang === 'fr' ? 'Traitement…' : 'جاري المعالجة…'}</>
                : <><CheckCircle className="w-4 h-4" />{lang === 'fr' ? 'Terminer la location' : 'إنهاء التأجير'}</>}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
