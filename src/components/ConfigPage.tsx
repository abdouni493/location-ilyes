import React, { useState, useEffect } from 'react';
import { Language, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings, Building2, UserRound, ShieldCheck, Database, Layers,
  Camera, Save, Download, Upload, KeyRound, Mail, Phone, MapPin, Landmark,
  ChevronRight, RotateCcw, Trash2, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Type,
} from 'lucide-react';
import { DatabaseService } from '../services/DatabaseService';
import { ReservationsService } from '../services/ReservationsService';
import { supabase } from '../supabase';
import { useCompany } from '../utils/companyProvider';
import { sessionService } from '../utils/sessionService';
import { CompaniesManager } from './CompaniesManager';

interface ConfigPageProps {
  lang: Language;
  user: User;
}

type TabId = 'general' | 'profile' | 'database' | 'agencies';

export const ConfigPage: React.FC<ConfigPageProps> = ({ lang, user }) => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);
  // Multi-agences : la gestion des agences est réservée au super-admin.
  const { isSuperAdmin } = useCompany();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // General Settings - Load from website settings
  const [generalData, setGeneralData] = useState({
    agencyName: '',
    slogan: '',
    address: '',
    phone: '',
    phoneNumber2: '',
    bankNumber: '',
    logo: '',
  });

  // Profile Settings - Load from workers table
  const [profileData, setProfileData] = useState({
    name: user.name,
    profilePhoto: user.avatar,
  });

  // Security Settings - Load from workers table
  const [securityData, setSecurityData] = useState({
    username: '',
    email: user.email,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  // E-mail réellement enregistré : sert de clé pour retrouver le compte même
  // après que l'utilisateur a modifié le champ « E-mail » à l'écran.
  const [accountEmail, setAccountEmail] = useState(user.email);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Database
  const [lastBackup] = useState('Aujourd\'hui à 10:45');

  // Corbeille des réservations (suppression réversible)
  const [deletedReservations, setDeletedReservations] = useState<Array<{
    id: string; clientName: string; carLabel: string; departureDate: string;
    returnDate: string; status: string; totalPrice: number; deletedAt: string | null; createdAt: string;
  }>>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [trashActionId, setTrashActionId] = useState<string | null>(null);
  const [pendingHardDelete, setPendingHardDelete] = useState<{ id: string; label: string } | null>(null);

  const loadTrash = async () => {
    try {
      setLoadingTrash(true);
      const list = await ReservationsService.getDeletedReservations();
      setDeletedReservations(list);
    } catch (err) {
      console.error('Error loading reservations trash:', err);
      setNotification({ type: 'error', message: lang === 'fr' ? 'Erreur de chargement de la corbeille' : 'خطأ في تحميل سلة المهملات' });
    } finally {
      setLoadingTrash(false);
    }
  };

  const handleRestoreReservation = async (id: string) => {
    try {
      setTrashActionId(id);
      await ReservationsService.restoreReservation(id);
      setDeletedReservations(prev => prev.filter(r => r.id !== id));
      setNotification({ type: 'success', message: lang === 'fr' ? 'Réservation restaurée avec succès' : 'تمت استعادة الحجز بنجاح' });
    } catch (err) {
      console.error('Error restoring reservation:', err);
      setNotification({ type: 'error', message: lang === 'fr' ? 'Échec de la restauration' : 'فشل الاستعادة' });
    } finally {
      setTrashActionId(null);
    }
  };

  const confirmHardDelete = async () => {
    if (!pendingHardDelete) return;
    const id = pendingHardDelete.id;
    try {
      setTrashActionId(id);
      await ReservationsService.hardDeleteReservation(id);
      setDeletedReservations(prev => prev.filter(r => r.id !== id));
      setNotification({ type: 'success', message: lang === 'fr' ? 'Réservation supprimée définitivement' : 'تم حذف الحجز نهائياً' });
    } catch (err) {
      console.error('Error permanently deleting reservation:', err);
      setNotification({ type: 'error', message: lang === 'fr' ? 'Échec de la suppression définitive' : 'فشل الحذف النهائي' });
    } finally {
      setTrashActionId(null);
      setPendingHardDelete(null);
    }
  };

  const formatTrashDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'ar', { dateStyle: 'medium', timeStyle: 'short' });
  };

  // Charge la corbeille dès l'ouverture de l'onglet Base de données.
  useEffect(() => {
    if (activeTab === 'database') loadTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Load data from database
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load website settings for general tab
        const websiteSettings = await DatabaseService.getWebsiteSettings();
        setGeneralData({
          agencyName: websiteSettings.name || 'Luxdrive Premium',
          slogan: websiteSettings.description || 'Votre partenaire de confiance en location de véhicules',
          address: websiteSettings.address || 'Alger, Algeria',
          phone: websiteSettings.phone || '+213 5 1234 5678',
          phoneNumber2: websiteSettings.phone_number_2 || '',
          bankNumber: websiteSettings.bank_number || '',
          logo: websiteSettings.logo || 'https://picsum.photos/seed/logo/200/200',
        });

        // Load worker data for profile and security
        if (user.email) {
          try {
            const { data: workerData, error } = await supabase
              .from('workers')
              .select('full_name, profile_photo, username, email')
              .eq('email', user.email)
              .maybeSingle();

            if (!error && workerData) {
              setProfileData({
                name: workerData.full_name,
                profilePhoto: workerData.profile_photo || '',
              });

              setSecurityData(prev => ({
                ...prev,
                username: workerData.username || '',
                email: workerData.email || user.email,
              }));
              if (workerData.email) setAccountEmail(workerData.email);
            }
          } catch (workerError) {
            console.warn('Could not load worker data:', workerError);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading config data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [user.email]);

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGeneralData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleSecurityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSecurityData(prev => ({ ...prev, [name]: value }));
  };

  const notify = (type: 'success' | 'error', message: string, ms = 5000) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), ms);
  };

  /** Enregistre le nom complet du compte connecté. */
  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = profileData.name.trim();
    if (!name) {
      notify('error', T('Le nom complet est obligatoire.', 'الاسم الكامل مطلوب.'));
      return;
    }
    try {
      setSavingProfile(true);
      await DatabaseService.updateOwnProfileName(accountEmail, name);
      notify('success', T('Profil mis à jour avec succès !', 'تم تحديث الملف الشخصي بنجاح!'));
    } catch (error: any) {
      console.error('Error updating profile:', error);
      notify('error', error?.message || T('Erreur lors de la mise à jour du profil', 'خطأ في تحديث الملف الشخصي'));
    } finally {
      setSavingProfile(false);
    }
  };

  /**
   * Enregistre les identifiants de connexion (identifiant, e-mail, mot de
   * passe). Un changement d'e-mail ou de mot de passe invalide la session en
   * cours : on déconnecte donc l'utilisateur pour qu'il se reconnecte avec ses
   * nouveaux identifiants.
   */
  const handleSaveSecurity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newEmail = securityData.email.trim();
    const username = securityData.username.trim();
    const { currentPassword, newPassword, confirmPassword } = securityData;

    const emailChanged = newEmail.toLowerCase() !== accountEmail.trim().toLowerCase();
    const wantsPassword = newPassword.length > 0 || confirmPassword.length > 0;

    if (!newEmail) {
      notify('error', T("L'e-mail est obligatoire.", 'البريد الإلكتروني مطلوب.'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      notify('error', T("Format d'e-mail invalide.", 'صيغة البريد الإلكتروني غير صحيحة.'));
      return;
    }
    if (wantsPassword && newPassword !== confirmPassword) {
      notify('error', T('Les mots de passe ne correspondent pas.', 'كلمتا المرور غير متطابقتين.'));
      return;
    }
    if (wantsPassword && newPassword.length < 6) {
      notify('error', T('Le mot de passe doit contenir au moins 6 caractères.', 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.'));
      return;
    }
    if (!currentPassword) {
      notify('error', T('Saisissez votre mot de passe actuel pour confirmer.', 'أدخل كلمة المرور الحالية للتأكيد.'));
      return;
    }

    try {
      setSavingSecurity(true);
      const result = await DatabaseService.updateOwnCredentials({
        currentEmail: accountEmail,
        currentPassword,
        newEmail: emailChanged ? newEmail : undefined,
        newUsername: username || undefined,
        newPassword: wantsPassword ? newPassword : undefined,
      });

      setAccountEmail(result.email);
      setSecurityData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));

      if (result.emailChanged || result.passwordChanged) {
        notify('success', T(
          'Identifiants mis à jour. Reconnectez-vous avec vos nouveaux identifiants…',
          'تم تحديث بيانات الدخول. يرجى إعادة تسجيل الدخول…'
        ), 3000);
        setTimeout(async () => {
          try {
            await sessionService.invalidateSession();
            await supabase.auth.signOut();
          } catch (signOutError) {
            console.warn('Sign out after credentials change failed:', signOutError);
          }
          window.location.href = '/login';
        }, 2500);
      } else {
        notify('success', T('Identifiants mis à jour avec succès !', 'تم تحديث بيانات الدخول بنجاح!'));
      }
    } catch (error: any) {
      console.error('Error updating credentials:', error);
      const code = error?.message || '';
      const message =
        code === 'INVALID_CURRENT_PASSWORD' ? T('Mot de passe actuel incorrect.', 'كلمة المرور الحالية غير صحيحة.')
        : code === 'EMAIL_ALREADY_USED' ? T('Cet e-mail est déjà utilisé par un autre compte.', 'هذا البريد الإلكتروني مستخدم بالفعل.')
        : code === 'USERNAME_ALREADY_USED' ? T("Ce nom d'utilisateur est déjà pris.", 'اسم المستخدم هذا مستخدم بالفعل.')
        : code === 'PASSWORD_TOO_SHORT' ? T('Le mot de passe doit contenir au moins 6 caractères.', 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.')
        : code || T('Erreur lors de la mise à jour des identifiants', 'خطأ في تحديث بيانات الدخول');
      notify('error', message);
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleSaveAgencyInfo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      // Save to website settings
      await DatabaseService.updateWebsiteSettings({
        name: generalData.agencyName,
        description: generalData.slogan,
        logo: generalData.logo,
        phone_number_2: generalData.phoneNumber2,
        bank_number: generalData.bankNumber,
        address: generalData.address,
        phone: generalData.phone,
      });

      setNotification({ type: 'success', message: lang === 'fr' ? 'Informations de l\'agence mises à jour avec succès!' : 'تم تحديث معلومات الوكالة بنجاح!' });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      console.error('Error updating agency info:', error);
      setNotification({ type: 'error', message: lang === 'fr' ? 'Erreur lors de la mise à jour des informations' : 'خطأ في تحديث المعلومات' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setNotification({ type: 'error', message: lang === 'fr' ? 'Veuillez sélectionner une image valide' : 'يرجى تحديد صورة صحيحة' });
        setTimeout(() => setNotification(null), 4000);
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setNotification({ type: 'error', message: lang === 'fr' ? 'La taille du fichier ne doit pas dépasser 5MB' : 'حجم الملف لا يجب أن يتجاوز 5MB' });
        setTimeout(() => setNotification(null), 4000);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageData = event.target?.result as string;

        try {
          // Update local state
          setGeneralData(prev => ({
            ...prev,
            logo: imageData,
          }));

          // Save to website settings
          await DatabaseService.updateWebsiteSettings({
            name: generalData.agencyName,
            description: generalData.slogan,
            logo: imageData,
          });

          setNotification({ type: 'success', message: lang === 'fr' ? 'Logo mis à jour avec succès!' : 'تم تحديث الشعار بنجاح!' });
          setTimeout(() => setNotification(null), 4000);
        } catch (error) {
          console.error('Error updating logo:', error);
          setNotification({ type: 'error', message: lang === 'fr' ? 'Erreur lors de la mise à jour du logo' : 'خطأ في تحديث الشعار' });
          setTimeout(() => setNotification(null), 4000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setNotification({ type: 'error', message: lang === 'fr' ? 'Veuillez sélectionner une image valide' : 'يرجى تحديد صورة صحيحة' });
        setTimeout(() => setNotification(null), 4000);
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setNotification({ type: 'error', message: lang === 'fr' ? 'La taille du fichier ne doit pas dépasser 5MB' : 'حجم الملف لا يجب أن يتجاوز 5MB' });
        setTimeout(() => setNotification(null), 4000);
        return;
      }

      try {
        // Upload to Supabase storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.email}_profile.${fileExt}`;
        const filePath = `workers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('workers')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('workers')
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Update local state
        setProfileData(prev => ({
          ...prev,
          profilePhoto: publicUrl,
        }));

        // Update worker profile in database
        const { error: updateError } = await supabase
          .from('workers')
          .update({ profile_photo: publicUrl })
          .eq('email', user.email);

        if (updateError) throw updateError;

        setNotification({ type: 'success', message: lang === 'fr' ? 'Photo de profil mise à jour avec succès!' : 'تم تحديث صورة الملف بنجاح!' });
        setTimeout(() => setNotification(null), 4000);
      } catch (error) {
        console.error('Error updating profile photo:', error);
        setNotification({ type: 'error', message: lang === 'fr' ? 'Erreur lors de la mise à jour de la photo' : 'خطأ في تحديث الصورة' });
        setTimeout(() => setNotification(null), 4000);
      }
    }
  };

  const handleExportDatabase = async () => {
    try {
      setNotification({ type: 'success', message: lang === 'fr' ? 'Exportation en cours...' : 'جاري التصدير...' });
      setTimeout(() => setNotification(null), 2000);

      // Export all data from main tables
      const [
        cars,
        clients,
        agencies,
        workers,
        specialOffers,
        storeExpenses,
        vehicleExpenses,
        websiteContacts,
        websiteSettings
      ] = await Promise.all([
        DatabaseService.getCars(),
        DatabaseService.getClients(),
        DatabaseService.getAgencies(),
        DatabaseService.getWorkers(),
        DatabaseService.getSpecialOffers(),
        DatabaseService.getStoreExpenses(),
        DatabaseService.getVehicleExpenses(),
        DatabaseService.getWebsiteContacts(),
        DatabaseService.getWebsiteSettings(),
      ]);

      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
          cars,
          clients,
          agencies,
          workers,
          specialOffers,
          storeExpenses,
          vehicleExpenses,
          websiteContacts,
          websiteSettings,
        }
      };

      // Create and download JSON file
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

      const exportFileDefaultName = `luxdrive_backup_${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      setNotification({ type: 'success', message: lang === 'fr' ? 'Sauvegarde téléchargée avec succès!' : 'تم تنزيل النسخة الاحتياطية بنجاح!' });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      console.error('Error exporting database:', error);
      setNotification({ type: 'error', message: lang === 'fr' ? 'Erreur lors de l\'exportation' : 'خطأ في التصدير' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleRestoreDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupData = JSON.parse(event.target?.result as string);

          if (!backupData.data) {
            throw new Error('Invalid backup file format');
          }

          setNotification({ type: 'success', message: lang === 'fr' ? 'Restauration en cours...' : 'جاري الاستعادة...' });
          setTimeout(() => setNotification(null), 2000);

          // Restore data in order (respecting foreign key constraints)
          const { data } = backupData;

          // Clear existing data first (optional - uncomment if you want to replace all data)
          // await clearAllData();

          // Restore agencies first (no dependencies)
          if (data.agencies?.length > 0) {
            for (const agency of data.agencies) {
              await DatabaseService.createAgency(agency);
            }
          }

          // Restore workers (no dependencies)
          if (data.workers?.length > 0) {
            for (const worker of data.workers) {
              await DatabaseService.createWorker(worker);
            }
          }

          // Restore cars (no dependencies)
          if (data.cars?.length > 0) {
            for (const car of data.cars) {
              await DatabaseService.createCar(car);
            }
          }

          // Restore clients (depends on agencies)
          if (data.clients?.length > 0) {
            for (const client of data.clients) {
              await DatabaseService.createClient(client);
            }
          }

          // Les "offres ordinaires" (data.offers) des anciennes sauvegardes sont
          // dépréciées : les voitures s'affichent automatiquement sur le site,
          // il n'y a donc plus rien à restaurer pour elles.

          // Restore special offers (depends on cars)
          if (data.specialOffers?.length > 0) {
            for (const specialOffer of data.specialOffers) {
              await DatabaseService.createSpecialOffer(specialOffer);
            }
          }

          // Restore store expenses (no dependencies)
          if (data.storeExpenses?.length > 0) {
            for (const expense of data.storeExpenses) {
              await DatabaseService.createStoreExpense(expense);
            }
          }

          // Restore vehicle expenses (depends on cars)
          if (data.vehicleExpenses?.length > 0) {
            for (const expense of data.vehicleExpenses) {
              await DatabaseService.createVehicleExpense(expense);
            }
          }

          // Restore website settings
          if (data.websiteSettings) {
            await DatabaseService.updateWebsiteSettings(data.websiteSettings);
          }

          // Restore website contacts
          if (data.websiteContacts) {
            await DatabaseService.updateWebsiteContacts(data.websiteContacts);
          }

          setNotification({ type: 'success', message: lang === 'fr' ? 'Restauration terminée avec succès!' : 'تمت الاستعادة بنجاح!' });
          setTimeout(() => setNotification(null), 4000);

          // Reload page to reflect changes
          setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
          console.error('Error restoring database:', error);
          setNotification({ type: 'error', message: lang === 'fr' ? 'Erreur lors de la restauration' : 'خطأ في الاستعادة' });
          setTimeout(() => setNotification(null), 4000);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error reading backup file:', error);
      setNotification({ type: 'error', message: lang === 'fr' ? 'Fichier de sauvegarde invalide' : 'ملف نسخة احتياطية غير صالح' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // ── Métadonnées du menu latéral ────────────────────────────────────────────
  const tabs: { id: TabId; icon: typeof Settings; label: string; desc: string; accent: string }[] = [
    { id: 'general', icon: Building2, label: T('Agence', 'الوكالة'), desc: T('Nom, logo, coordonnées', 'الاسم، الشعار، التواصل'), accent: '#0284C7' },
    { id: 'profile', icon: UserRound, label: T('Profil & Sécurité', 'الملف والأمان'), desc: T('Compte et connexion', 'الحساب والدخول'), accent: '#DC2626' },
    { id: 'database', icon: Database, label: T('Données', 'البيانات'), desc: T('Sauvegarde & corbeille', 'النسخ والسلة'), accent: '#16A34A' },
    ...(isSuperAdmin ? [{ id: 'agencies' as TabId, icon: Layers, label: T('Agences', 'الوكالات'), desc: T('Multi-agences', 'تعدد الوكالات'), accent: '#0F172A' }] : []),
  ];

  // Petit entête de carte réutilisable
  const CardHead = ({ icon, title, subtitle, accent }: { icon: React.ReactNode; title: string; subtitle?: string; accent: string }) => (
    <div className="flex items-center gap-3.5 px-6 py-5 border-b border-saas-border">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: accent }}>
        {icon}
      </span>
      <div>
        <h2 className="text-lg font-black text-saas-text-main tracking-tight">{title}</h2>
        {subtitle && <p className="text-[11px] font-bold uppercase tracking-widest text-saas-text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  const panelAnim = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#334155] text-white flex items-center justify-center shadow-lg shadow-slate-900/20 shrink-0">
          <Settings size={26} />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-saas-text-main">
            {T('Settings', 'الإعدادات')}
          </h1>
          <p className="text-saas-text-muted text-xs font-bold uppercase tracking-[0.2em] mt-0.5">
            {T("Paramètres de l'application", 'إعدادات التطبيق')}
          </p>
        </div>
      </motion.div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 border rounded-2xl p-4 flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            {notification.type === 'success'
              ? <CheckCircle2 className="text-green-600 shrink-0" size={20} />
              : <AlertTriangle className="text-red-600 shrink-0" size={20} />}
            <p className={`font-bold text-sm ${notification.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {notification.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-24 bg-white rounded-[2rem] border border-saas-border">
          <div className="text-center">
            <Loader2 className="w-11 h-11 text-saas-primary-via animate-spin mx-auto mb-4" />
            <p className="text-saas-text-muted font-bold">{T('Chargement des paramètres...', 'جاري تحميل الإعدادات...')}</p>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[264px_minmax(0,1fr)] gap-6 items-start">
          {/* ── Menu latéral ──────────────────────────────────────────────── */}
          <nav className="bg-white rounded-2xl border border-saas-border shadow-sm p-2 lg:sticky lg:top-24">
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible">
              {tabs.map(tab => {
                const active = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all shrink-0 lg:w-full cursor-pointer ${
                      active ? 'bg-saas-bg' : 'hover:bg-saas-bg/60'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="settings-active"
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
                        style={{ background: tab.accent }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      style={active
                        ? { background: tab.accent, color: '#fff' }
                        : { background: 'var(--color-saas-bg, #F1F5F9)', color: tab.accent }}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 hidden sm:block">
                      <span className={`block text-sm font-black tracking-tight ${active ? 'text-saas-text-main' : 'text-saas-text-main/80'}`}>
                        {tab.label}
                      </span>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-saas-text-muted truncate">
                        {tab.desc}
                      </span>
                    </span>
                    <span className="sm:hidden text-sm font-black text-saas-text-main">{tab.label}</span>
                    {active && <ChevronRight size={16} className="ml-auto text-saas-text-muted hidden lg:block" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* ── Contenu ────────────────────────────────────────────────────── */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {/* ═══════════════ AGENCE ═══════════════ */}
              {activeTab === 'general' && (
                <motion.div key="general" {...panelAnim} className="bg-white rounded-[2rem] border border-saas-border shadow-sm overflow-hidden">
                  <CardHead icon={<Building2 size={20} />} title={T("Informations de l'agence", 'معلومات الوكالة')} subtitle={T('Affichées sur les documents et le site', 'تظهر على الوثائق والموقع')} accent="#0284C7" />
                  <form className="p-6 sm:p-8 space-y-7" onSubmit={handleSaveAgencyInfo}>
                    {/* Logo */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-5 rounded-2xl bg-saas-bg border border-saas-border">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border border-saas-border bg-white flex items-center justify-center shrink-0 shadow-sm">
                        {generalData.logo
                          ? <img src={generalData.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          : <Building2 className="text-saas-text-muted" size={30} />}
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-saas-text-main mb-1">{T("Logo de l'agence", 'شعار الوكالة')}</p>
                        <p className="text-xs text-saas-text-muted mb-3">{T('PNG ou JPG · recommandé 500×500px', 'PNG أو JPG · يُفضّل 500×500')}</p>
                        <label className="inline-flex">
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                          <span className="btn-saas-secondary px-5 py-2.5 inline-flex items-center gap-2 cursor-pointer text-sm">
                            <Camera size={16} /> {T('Changer le logo', 'تغيير الشعار')}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 space-y-2">
                        <label className="label-saas flex items-center gap-1.5"><Type size={12} />{T("Nom de l'enseigne", 'اسم الإشارة')} *</label>
                        <input type="text" name="agencyName" value={generalData.agencyName} onChange={handleGeneralChange} className="input-saas" />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="label-saas">{T('Slogan commercial', 'الشعار التجاري')}</label>
                        <textarea name="slogan" value={generalData.slogan} onChange={handleGeneralChange} rows={2} className="input-saas resize-none" />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="label-saas flex items-center gap-1.5"><MapPin size={12} />{T('Adresse du siège', 'عنوان المقر')}</label>
                        <input type="text" name="address" value={generalData.address} onChange={handleGeneralChange} className="input-saas" />
                      </div>
                      <div className="space-y-2">
                        <label className="label-saas flex items-center gap-1.5"><Phone size={12} />{T('Téléphone', 'الهاتف')}</label>
                        <input type="tel" name="phone" value={generalData.phone} onChange={handleGeneralChange} className="input-saas" />
                      </div>
                      <div className="space-y-2">
                        <label className="label-saas flex items-center gap-1.5"><Phone size={12} />{T('Téléphone 2', 'الهاتف الثاني')}</label>
                        <input type="tel" name="phoneNumber2" value={generalData.phoneNumber2} onChange={handleGeneralChange} className="input-saas" />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="label-saas flex items-center gap-1.5"><Landmark size={12} />{T('Numéro de compte bancaire', 'رقم الحساب البنكي')}</label>
                        <input type="text" name="bankNumber" value={generalData.bankNumber} onChange={handleGeneralChange} className="input-saas" />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-saas-border">
                      <button type="submit" className="btn-saas-primary px-8 py-3 flex items-center gap-2 mt-6">
                        <Save size={17} /> {T('Enregistrer les modifications', 'حفظ التغييرات')}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ═══════════════ PROFIL & SÉCURITÉ ═══════════════ */}
              {activeTab === 'profile' && (
                <motion.div key="profile" {...panelAnim} className="space-y-6">
                  <div className="bg-white rounded-[2rem] border border-saas-border shadow-sm overflow-hidden">
                    <CardHead icon={<UserRound size={20} />} title={T('Mon profil', 'ملفي الشخصي')} accent="#0284C7" />
                    <form onSubmit={handleSaveProfile} className="p-6 sm:p-8 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-5 rounded-2xl bg-saas-bg border border-saas-border">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-saas-primary-via shadow-md flex items-center justify-center shrink-0 bg-white">
                          {profileData.profilePhoto
                            ? <img src={profileData.profilePhoto} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            : <UserRound className="text-saas-text-muted" size={34} />}
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-saas-text-main mb-1">{T('Photo de profil', 'صورة الملف')}</p>
                          <label className="inline-flex">
                            <input type="file" accept="image/*" onChange={handleProfilePhotoUpload} className="hidden" />
                            <span className="btn-saas-secondary px-5 py-2.5 inline-flex items-center gap-2 cursor-pointer text-sm">
                              <Camera size={16} /> {T('Changer la photo', 'تغيير الصورة')}
                            </span>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="label-saas flex items-center gap-1.5"><UserRound size={12} />{T('Nom complet', 'الاسم الكامل')}</label>
                        <input type="text" name="name" value={profileData.name} onChange={handleProfileChange} className="input-saas" />
                      </div>
                      <div className="flex justify-end pt-2 border-t border-saas-border">
                        <button type="submit" disabled={savingProfile} className="btn-saas-primary px-8 py-3 flex items-center gap-2 mt-6 disabled:opacity-60">
                          {savingProfile ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                          {T('Enregistrer le profil', 'حفظ الملف الشخصي')}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="bg-white rounded-[2rem] border border-saas-border shadow-sm overflow-hidden">
                    <CardHead icon={<ShieldCheck size={20} />} title={T('Informations de connexion', 'معلومات تسجيل الدخول')} accent="#DC2626" />
                    <form onSubmit={handleSaveSecurity} className="p-6 sm:p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="label-saas flex items-center gap-1.5"><UserRound size={12} />{T("Nom d'utilisateur", 'اسم المستخدم')}</label>
                          <input type="text" name="username" value={securityData.username} onChange={handleSecurityChange} className="input-saas" />
                        </div>
                        <div className="space-y-2">
                          <label className="label-saas flex items-center gap-1.5"><Mail size={12} />{T('E-mail de récupération', 'بريد الاستعادة')}</label>
                          <input type="email" name="email" value={securityData.email} onChange={handleSecurityChange} className="input-saas" />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label className="label-saas flex items-center gap-1.5"><KeyRound size={12} />{T('Mot de passe actuel', 'كلمة المرور الحالية')} *</label>
                          <input type="password" name="currentPassword" value={securityData.currentPassword} onChange={handleSecurityChange} placeholder="••••••••" autoComplete="current-password" className="input-saas" />
                          <p className="text-[11px] font-semibold text-saas-text-muted">
                            {T('Obligatoire pour confirmer toute modification de vos identifiants.', 'مطلوبة لتأكيد أي تعديل على بيانات الدخول.')}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="label-saas flex items-center gap-1.5"><KeyRound size={12} />{T('Nouveau mot de passe', 'كلمة المرور الجديدة')}</label>
                          <input type="password" name="newPassword" value={securityData.newPassword} onChange={handleSecurityChange} placeholder={T('Laisser vide pour ne pas changer', 'اتركها فارغة لعدم التغيير')} autoComplete="new-password" className="input-saas" />
                        </div>
                        <div className="space-y-2">
                          <label className="label-saas flex items-center gap-1.5"><KeyRound size={12} />{T('Confirmer le mot de passe', 'تأكيد كلمة المرور')}</label>
                          <input type="password" name="confirmPassword" value={securityData.confirmPassword} onChange={handleSecurityChange} placeholder="••••••••" autoComplete="new-password" className="input-saas" />
                        </div>
                      </div>
                      <div className="flex justify-end pt-2 border-t border-saas-border">
                        <button type="submit" disabled={savingSecurity} className="btn-saas-primary px-8 py-3 flex items-center gap-2 mt-6 disabled:opacity-60">
                          {savingSecurity ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                          {T('Mettre à jour', 'تحديث')}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* ═══════════════ DONNÉES ═══════════════ */}
              {activeTab === 'database' && (
                <motion.div key="database" {...panelAnim} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Export */}
                    <div className="bg-white rounded-[2rem] border border-saas-border shadow-sm p-6 flex flex-col">
                      <span className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-4"><Download size={22} /></span>
                      <h3 className="text-lg font-black text-saas-text-main">{T('Sauvegarder', 'نسخ احتياطي')}</h3>
                      <p className="text-sm text-saas-text-muted mt-1 mb-1">{T('Dernière : ', 'الأخيرة: ')}<span className="font-bold">{lastBackup}</span></p>
                      <p className="text-sm text-saas-text-muted flex-1">{T('Téléchargez une copie complète de vos données (JSON).', 'حمّل نسخة كاملة من بياناتك (JSON).')}</p>
                      <button onClick={handleExportDatabase} className="btn-saas-primary py-3 px-6 mt-5 flex items-center justify-center gap-2">
                        <Download size={17} /> {T("Lancer l'exportation", 'ابدأ التصدير')}
                      </button>
                    </div>

                    {/* Restore */}
                    <div className="bg-white rounded-[2rem] border border-saas-border shadow-sm p-6 flex flex-col">
                      <span className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4"><Upload size={22} /></span>
                      <h3 className="text-lg font-black text-saas-text-main">{T('Restaurer', 'استعادة')}</h3>
                      <p className="text-sm text-saas-text-muted mt-1 flex-1">{T('Importez un fichier de sauvegarde pour restaurer vos informations.', 'استورد ملف نسخة احتياطية لاستعادة معلوماتك.')}</p>
                      <label className="mt-5">
                        <input type="file" accept=".json,.sql" onChange={handleRestoreDatabase} className="hidden" />
                        <span className="btn-saas-secondary py-3 px-6 flex items-center justify-center gap-2 cursor-pointer w-full">
                          <Upload size={17} /> {T('Choisir un fichier', 'اختر ملف')}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Corbeille */}
                  <div className="bg-white rounded-[2rem] border border-saas-border shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-saas-border">
                      <div className="flex items-center gap-3.5">
                        <span className="w-11 h-11 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm"><Trash2 size={19} /></span>
                        <div>
                          <h2 className="text-lg font-black text-saas-text-main tracking-tight">{T('Corbeille des réservations', 'سلة حذف الحجوزات')}</h2>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-saas-text-muted mt-0.5">{T('Restaurer ou supprimer définitivement', 'استعادة أو حذف نهائي')}</p>
                        </div>
                      </div>
                      <button onClick={loadTrash} disabled={loadingTrash} className="btn-saas-secondary py-2 px-4 text-xs shrink-0 flex items-center gap-2 disabled:opacity-60">
                        <RefreshCw size={15} className={loadingTrash ? 'animate-spin' : ''} /> {T('Actualiser', 'تحديث')}
                      </button>
                    </div>
                    <div className="p-6">
                      {loadingTrash ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-red-500" size={28} /></div>
                      ) : deletedReservations.length === 0 ? (
                        <div className="text-center py-10">
                          <div className="w-14 h-14 rounded-2xl bg-saas-bg flex items-center justify-center mx-auto mb-3 text-2xl">🗑️</div>
                          <p className="text-sm text-saas-text-muted font-medium">{T('La corbeille est vide.', 'السلة فارغة.')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {deletedReservations.map(r => (
                            <div key={r.id} className="bg-saas-bg rounded-2xl border border-saas-border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-saas-text-main truncate">
                                  {r.clientName} <span className="text-saas-text-muted font-bold">· {r.carLabel}</span>
                                </p>
                                <p className="text-xs text-saas-text-muted mt-0.5">
                                  {r.departureDate} → {r.returnDate} · {r.totalPrice.toLocaleString('fr-DZ')} DA
                                  {' · '}{T('Supprimée le', 'حُذفت في')} {formatTrashDate(r.deletedAt)}
                                </p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button onClick={() => handleRestoreReservation(r.id)} disabled={trashActionId === r.id}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors disabled:opacity-60">
                                  {trashActionId === r.id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} {T('Restaurer', 'استعادة')}
                                </button>
                                <button onClick={() => setPendingHardDelete({ id: r.id, label: `${r.clientName} · ${r.carLabel}` })} disabled={trashActionId === r.id}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-60">
                                  <Trash2 size={15} /> {T('Supprimer', 'حذف')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══════════════ AGENCES (super-admin) ═══════════════ */}
              {activeTab === 'agencies' && isSuperAdmin && (
                <motion.div key="agencies" {...panelAnim}>
                  <CompaniesManager lang={lang} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Confirmation de suppression définitive */}
      <AnimatePresence>
        {pendingHardDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-start justify-center z-[60] p-4 overflow-y-auto sm:py-8"
            onClick={() => setPendingHardDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-red-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 text-center mb-2">{T('Suppression définitive', 'حذف نهائي')}</h3>
              <p className="text-slate-600 text-center text-sm mb-1">
                {T('Cette réservation sera supprimée définitivement et ne pourra plus être restaurée.', 'سيتم حذف هذا الحجز نهائياً ولا يمكن استعادته.')}
              </p>
              <p className="text-slate-900 font-bold text-center text-sm mb-6 truncate">{pendingHardDelete.label}</p>
              <div className="flex gap-3">
                <button onClick={() => setPendingHardDelete(null)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors">
                  {T('Annuler', 'إلغاء')}
                </button>
                <button onClick={confirmHardDelete} disabled={!!trashActionId}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {trashActionId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {T('Supprimer', 'حذف')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
