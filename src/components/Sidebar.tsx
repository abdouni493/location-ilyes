import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, X } from 'lucide-react';
import { SIDEBAR_ITEMS } from '../constants';
import { Language } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { usePermissions } from '../utils/permissions';
import { useCompany } from '../utils/companyProvider';

interface SidebarProps {
  lang: Language;
  isVisible: boolean;
  setIsVisible: (val: boolean) => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  alertsCount?: number;
  webOrdersCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  lang, isVisible, setIsVisible, onLogout, activeTab, setActiveTab, alertsCount = 0, webOrdersCount = 0
}) => {
  const isRtl = lang === 'ar';
  // Un employé ne voit que les interfaces autorisées par l'admin.
  const { canSeeInterface } = usePermissions();
  // Multi-agences : « Website commandes » (triage des commandes non attribuées)
  // est réservé au super-admin.
  const { isSuperAdmin } = useCompany();
  const visibleItems = SIDEBAR_ITEMS.filter(item =>
    canSeeInterface(item.id) && !(item.id === 'web-orders' && !isSuperAdmin)
  );
  const [agencyData, setAgencyData] = useState({
    name: 'MHD AUTO',
    logo: '',
  });

  // Load agency data from database
  useEffect(() => {
    const loadAgencyData = async () => {
      try {
        const websiteSettings = await DatabaseService.getWebsiteSettings();
        setAgencyData({
          name: websiteSettings.name || 'MHD AUTO',
          logo: websiteSettings.logo || '',
        });
      } catch (error) {
        console.error('Error loading agency data:', error);
        // Fallback to default values
        setAgencyData({
          name: 'MHD AUTO',
          logo: '',
        });
      }
    };

    loadAgencyData();
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          initial={{ x: isRtl ? '100%' : '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isRtl ? '100%' : '-100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-72 bg-white text-saas-text-main flex flex-col shadow-xl ltr:left-0 rtl:right-0 border-r border-saas-border overflow-y-auto lg:static lg:w-72 lg:h-screen lg:sticky lg:top-0 lg:shadow-none"
          style={{ [isRtl ? 'right' : 'left']: 0 }}
        >
          <div className="p-5 lg:p-8 flex items-center justify-between border-b border-saas-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-saas-border shadow-md shadow-saas-primary-start/15 flex items-center justify-center flex-shrink-0">
                {agencyData.logo ? (
                  <img
                    src={agencyData.logo}
                    alt="Agency Logo"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-white font-black text-xl italic bg-linear-to-br from-[#DC2626] to-[#B91C1C] w-full h-full flex items-center justify-center">
                    M
                  </span>
                )}
              </div>
              <span className="text-xl font-black tracking-tighter uppercase">
                {agencyData.name.split(' ').slice(0, 3).join(' ').split(' ')[0]}<span className="text-saas-primary-via">{agencyData.name.split(' ').slice(0, 3).join(' ').split(' ').slice(1).join(' ')}</span>
              </span>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 rounded-lg hover:bg-saas-bg text-saas-text-muted transition-colors lg:hidden cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-1.5 custom-scrollbar">
            {visibleItems.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: isRtl ? 12 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * index, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 1024) {
                    setIsVisible(false);
                  }
                }}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer
                  ${activeTab === item.id
                    ? 'bg-saas-primary-via/8 text-saas-primary-via shadow-sm border border-saas-primary-via/25'
                    : 'text-saas-text-muted hover:bg-saas-bg hover:text-saas-text-main border border-transparent'}`}
              >
                {/* Liseré actif rouge logo */}
                {activeTab === item.id && (
                  <motion.span
                    layoutId="sidebar-active-bar"
                    className="absolute ltr:left-0 rtl:right-0 top-2 bottom-2 w-1 rounded-full bg-linear-to-b from-[#DC2626] to-[#B91C1C]"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className={`text-xl shrink-0 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <span className={`text-xs font-bold uppercase tracking-widest ${activeTab === item.id ? 'text-saas-text-main' : ''}`}>
                  {item.label[lang]}
                </span>

                {/* Compteur d'alertes de maintenance (onglet Tableau de bord) */}
                {item.id === 'dashboard' && alertsCount > 0 && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                    title={lang === 'fr' ? `${alertsCount} alerte(s) de maintenance` : `${alertsCount} تنبيه صيانة`}
                  >
                    {/* Halo pulsant */}
                    <motion.span
                      className="absolute inline-flex h-6 w-6 rounded-full bg-red-500/40"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    {/* Pastille avec le nombre */}
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="relative min-w-[22px] h-[22px] px-1.5 flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-500 text-white text-[11px] font-black rounded-full shadow-lg shadow-red-500/50 ring-2 ring-white"
                    >
                      {alertsCount > 99 ? '99+' : alertsCount}
                    </motion.span>
                  </span>
                )}

                {/* Compteur des nouvelles commandes du site (onglet Website commandes) */}
                {item.id === 'web-orders' && webOrdersCount > 0 && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                    title={lang === 'fr' ? 'Nouvelles commandes du site en attente' : 'طلبات جديدة من الموقع في الانتظار'}
                  >
                    {/* Halo pulsant */}
                    <motion.span
                      className="absolute inline-flex h-6 w-6 rounded-full bg-indigo-500/40"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    {/* Pastille avec le nombre */}
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="relative min-w-[22px] h-[22px] px-1.5 flex items-center justify-center bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white text-[11px] font-black rounded-full shadow-lg shadow-[#0284C7]/40 ring-2 ring-white"
                    >
                      {webOrdersCount > 99 ? '99+' : webOrdersCount}
                    </motion.span>
                  </span>
                )}
              </motion.button>
            ))}
          </nav>

          <div className="p-6 border-t border-saas-border bg-saas-bg/50">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl text-saas-danger-start hover:bg-saas-danger-start/8 transition-all font-bold uppercase tracking-widest text-xs border border-transparent hover:border-saas-danger-start/20 cursor-pointer"
            >
              <LogOut size={18} />
              <span>
                {lang === 'fr' ? 'Déconnexion' : 'تسجيل الخروج'}
              </span>
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
