import React, { useState, useEffect } from 'react';
import { Worker, Language } from '../types';
import { WorkerCard } from './WorkerCard';
import { WorkerModal } from './WorkerModal';
import { WorkerDetailsModal } from './WorkerDetailsModal';
import { WorkerPaymentModal } from './WorkerPaymentModal';
import { WorkerAdvanceModal } from './WorkerAdvanceModal';
import { WorkerAbsenceModal } from './WorkerAbsenceModal';
import { WorkerHistoryModal } from './WorkerHistoryModal';
import { WorkerPermissionsModal } from './WorkerPermissionsModal';
import { ConfirmModal } from './ConfirmModal';
import { Plus, Search, Loader2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DatabaseService } from '../services/DatabaseService';
import { usePermissions } from '../utils/permissions';
import { useCompany } from '../utils/companyProvider';
import { companyContext } from '../utils/companyContext';
import { Company } from '../types';

interface EquipePageProps {
  lang: Language;
}

const INITIAL_WORKERS: Worker[] = [
  {
    id: '1',
    fullName: 'Ahmed Boudjellal',
    dateOfBirth: '1990-05-15',
    phone: '+213 5 1234 5678',
    email: 'ahmed.boudjellal@email.com',
    address: 'Alger, Algeria',
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    type: 'driver',
    paymentType: 'daily',
    baseSalary: 3500,
    username: 'ahmed.boudj',
    password: 'SecurePass123',
    advances: [
      { id: '1', amount: 500, date: '2026-02-15', note: 'Emergency' },
      { id: '2', amount: 300, date: '2026-02-28', note: '' },
    ],
    absences: [
      { id: '1', cost: 350, date: '2026-03-01', note: 'Sick leave' },
      { id: '2', cost: 350, date: '2026-03-02', note: '' },
    ],
    payments: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    fullName: 'Fatima Zahra',
    dateOfBirth: '1988-03-20',
    phone: '+213 5 9876 5432',
    email: 'fatima.zahra@email.com',
    address: 'Oran, Algeria',
    profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    type: 'admin',
    paymentType: 'monthly',
    baseSalary: 45000,
    username: 'fatima.zahra',
    password: 'Admin@Pass456',
    advances: [
      { id: '1', amount: 2000, date: '2026-02-01', note: 'Salary advance' },
    ],
    absences: [],
    payments: [],
    createdAt: new Date().toISOString(),
  },
];

export const EquipePage: React.FC<EquipePageProps> = ({ lang }) => {
  const { can } = usePermissions();
  // Multi-agences : le super-admin choisit l'agence de rattachement de l'employé.
  const { isSuperAdmin } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  useEffect(() => {
    if (!isSuperAdmin) return;
    DatabaseService.getCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, [isSuperAdmin]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [activeModal, setActiveModal] = useState<'details' | 'payment' | 'advance' | 'absence' | 'history' | 'permissions' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; workerId: string | null }>({ isOpen: false, workerId: null });

  // Load workers on component mount
  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const data = await DatabaseService.getWorkers();
      setWorkers(data);
    } catch (err) {
      console.error('Error loading workers:', err);
      setError('Erreur lors du chargement des travailleurs');
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = workers.filter(w =>
    w.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveWorker = async (workerData: Partial<Worker>): Promise<void> => {
    // Compte de connexion : créé/mis à jour dans l'authentification Supabase
    // AVANT l'enregistrement en base, pour ne jamais laisser un employé
    // « compte activé » sans identifiants réellement utilisables.
    let authUserId: string | null = workerData.authUserId || null;

    if (workerData.accountEnabled && workerData.email) {
      if (workerData.password?.trim()) {
        authUserId = await DatabaseService.upsertWorkerAuthUser(
          workerData.email,
          workerData.password.trim(),
          workerData.fullName || '',
          workerData.type || 'worker'
        );
      }
    } else if (!workerData.accountEnabled && editingWorker?.accountEnabled && editingWorker.email) {
      // Compte désactivé : on retire son accès de connexion.
      try {
        await DatabaseService.deleteWorkerAuthUser(editingWorker.email);
      } catch (err) {
        console.warn('Could not remove auth user:', err);
      }
      authUserId = null;
    }

    const payload: Partial<Worker> = { ...workerData, authUserId: authUserId || undefined };
    // Mot de passe vide en édition = inchangé : on ne l'écrase pas en base.
    if (editingWorker && !workerData.password?.trim()) delete (payload as any).password;

    if (editingWorker) {
      const updated = await DatabaseService.updateWorker(editingWorker.id, payload);
      setWorkers(workers.map(w => w.id === updated.id
        ? { ...updated, advances: w.advances, absences: w.absences, payments: w.payments }
        : w));
    } else {
      const created = await DatabaseService.createWorker(
        payload as Omit<Worker, 'id' | 'createdAt' | 'advances' | 'absences' | 'payments'>
      );
      setWorkers(prev => [...prev, created]);
    }
    setIsModalOpen(false);
    setEditingWorker(null);
  };

  const handleDeleteWorker = (workerId: string) => {
    setDeleteConfirm({ isOpen: true, workerId });
  };

  // Open various modals for a selected worker
  const handleOpenModal = (
    worker: Worker,
    modal: 'details' | 'payment' | 'advance' | 'absence' | 'history' | 'permissions'
  ) => {
    setSelectedWorker(worker);
    setActiveModal(modal);
  };

  const confirmDelete = async () => {
    if (deleteConfirm.workerId) {
      try {
        await DatabaseService.deleteWorker(deleteConfirm.workerId);
        setWorkers(workers.filter(w => w.id !== deleteConfirm.workerId));
        setDeleteConfirm({ isOpen: false, workerId: null });
      } catch (err) {
        console.error('Error deleting worker:', err);
        setError('Erreur lors de la suppression');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-saas-bg via-saas-bg-light to-saas-bg p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-black uppercase tracking-tighter text-saas-text-main mb-2 flex items-center gap-3">
            👥 {lang === 'fr' ? 'Équipe' : 'الفريق'}
          </h1>
          <p className="text-saas-text-muted text-sm font-bold uppercase tracking-widest">
            {lang === 'fr' ? 'Gestion des travailleurs' : 'إدارة العمال'}
          </p>
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="text-red-500">⚠️</div>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
            {error.includes('Session expirée') && (
              <button
                onClick={() => window.location.reload()}
                className="btn-saas-primary text-sm px-4 py-2"
              >
                {lang === 'fr' ? 'Se reconnecter' : 'إعادة الاتصال'}
              </button>
            )}
          </motion.div>
        )}

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 flex flex-col sm:flex-row gap-4"
        >
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-saas-text-muted" />
            <input
              type="text"
              placeholder={lang === 'fr' ? 'Rechercher un travailleur...' : 'ابحث عن عامل...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-saas-border focus:outline-none focus:border-saas-primary-via focus:ring-2 focus:ring-saas-primary-via/20 transition-all"
            />
          </div>
          <button
            onClick={() => {
              setEditingWorker(null);
              setIsModalOpen(true);
            }}
            className="btn-saas-primary px-6 py-3 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={20} />
            {lang === 'fr' ? 'Ajouter' : 'إضافة'}
          </button>
        </motion.div>

        {/* Workers Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-saas-primary-via" />
            <span className="ml-3 text-saas-text-muted">
              {lang === 'fr' ? 'Chargement des travailleurs...' : 'جاري تحميل العمال...'}
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 font-medium mb-4">⚠️ {error}</p>
            <button
              onClick={loadWorkers}
              className="btn-saas-primary"
            >
              {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              <AnimatePresence>
                {filteredWorkers.map((worker, index) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    index={index}
                    lang={lang}
                    onDetails={() => handleOpenModal(worker, 'details')}
                    onPayment={() => handleOpenModal(worker, 'payment')}
                    onAdvance={() => handleOpenModal(worker, 'advance')}
                    onAbsence={() => handleOpenModal(worker, 'absence')}
                    onHistory={() => handleOpenModal(worker, 'history')}
                    onEdit={() => {
                      setEditingWorker(worker);
                      setIsModalOpen(true);
                    }}
                    onDelete={() => handleDeleteWorker(worker.id)}
                    onPermissions={can('team', 'permissions') ? () => handleOpenModal(worker, 'permissions') : undefined}
                  />
                ))}
              </AnimatePresence>
            </div>

            {filteredWorkers.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className="text-saas-text-muted text-lg">
                  {lang === 'fr' ? 'Aucun travailleur trouvé' : 'لم يتم العثور على عامل'}
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <WorkerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWorker(null);
        }}
        onSave={handleSaveWorker}
        worker={editingWorker || undefined}
        lang={lang}
        companies={isSuperAdmin ? companies : []}
        defaultCompanyId={companyContext.getWriteCompanyId() || undefined}
      />

      {selectedWorker && (
        <>
          <WorkerDetailsModal
            isOpen={activeModal === 'details'}
            onClose={() => setActiveModal(null)}
            worker={selectedWorker}
            lang={lang}
          />

          <WorkerPaymentModal
            isOpen={activeModal === 'payment'}
            onClose={() => setActiveModal(null)}
            worker={selectedWorker}
            lang={lang}
            onCreatePayment={async () => {
              // Recharge depuis la base : les périodes payées et les acomptes
              // soldés doivent disparaître des prochains calculs.
              await loadWorkers();
              setActiveModal(null);
            }}
          />

          {activeModal === 'permissions' && (
            <WorkerPermissionsModal
              lang={lang}
              worker={selectedWorker}
              onClose={() => setActiveModal(null)}
              onSaved={(permissions) => {
                setWorkers(prev => prev.map(w => w.id === selectedWorker.id ? { ...w, permissions } : w));
                setSelectedWorker(prev => prev ? { ...prev, permissions } : prev);
              }}
            />
          )}

          <WorkerAdvanceModal
            isOpen={activeModal === 'advance'}
            onClose={() => setActiveModal(null)}
            worker={selectedWorker}
            onAddAdvance={async (advance) => {
              // Enregistre l'acompte en base (auparavant seulement en mémoire).
              const saved = await DatabaseService.createWorkerAdvance(selectedWorker.id, {
                amount: advance.amount, date: advance.date, note: advance.note,
              } as any);
              const refreshed = await DatabaseService.getWorkers();
              setWorkers(refreshed);
              setSelectedWorker(refreshed.find(w => w.id === selectedWorker.id) || null);
              setActiveModal(null);
              return saved;
            }}
            lang={lang}
          />

          <WorkerAbsenceModal
            isOpen={activeModal === 'absence'}
            onClose={() => setActiveModal(null)}
            worker={selectedWorker}
            onAddAbsence={async (absence) => {
              await DatabaseService.createWorkerAbsence(selectedWorker.id, {
                cost: absence.cost, date: absence.date, note: absence.note,
              } as any);
              const refreshed = await DatabaseService.getWorkers();
              setWorkers(refreshed);
              setSelectedWorker(refreshed.find(w => w.id === selectedWorker.id) || null);
              setActiveModal(null);
            }}
            lang={lang}
          />

          <WorkerHistoryModal
            isOpen={activeModal === 'history'}
            onClose={() => setActiveModal(null)}
            worker={selectedWorker}
            lang={lang}
          />
        </>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={lang === 'fr' ? 'Supprimer le travailleur' : 'حذف العامل'}
        message={
          deleteConfirm.workerId
            ? `${lang === 'fr' ? 'Êtes-vous sûr de vouloir supprimer' : 'هل أنت متأكد من حذف'} ${workers.find(w => w.id === deleteConfirm.workerId)?.fullName} ? ${lang === 'fr' ? 'Cette action est irréversible.' : 'هذا الإجراء لا يمكن التراجع عنه.'}`
            : lang === 'fr'
            ? 'Êtes-vous sûr de vouloir supprimer ce travailleur ? Cette action est irréversible.'
            : 'هل أنت متأكد من حذف هذا العامل؟ هذا الإجراء لا يمكن التراجع عنه.'
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, workerId: null })}
        lang={lang}
      />
    </div>
  );
};
