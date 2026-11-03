import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ShieldCheck, Check, Loader2, AlertTriangle, ChevronDown, Lock, Eye,
} from 'lucide-react';
import { Language, Worker, WorkerPermissions } from '../types';
import { SIDEBAR_ITEMS, INTERFACE_ACTIONS } from '../constants';
import { DatabaseService } from '../services/DatabaseService';

/**
 * PERMISSIONS D'UN EMPLOYÉ
 *
 * Deux niveaux, exactement comme demandé :
 *   1. les interfaces visibles dans SA sidebar (liste complète de l'application) ;
 *   2. pour chaque interface cochée, les boutons d'action qu'il peut utiliser.
 *
 * Les actions sensibles (paiements, suppressions de paiements, suppressions
 * d'enregistrements) sont mises en évidence pour éviter tout octroi distrait.
 */
export const WorkerPermissionsModal: React.FC<{
  lang: Language;
  worker: Worker;
  onClose: () => void;
  onSaved: (permissions: WorkerPermissions) => void;
}> = ({ lang, worker, onClose, onSaved }) => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const [interfaces, setInterfaces] = useState<string[]>(worker.permissions?.interfaces || []);
  const [actions, setActions] = useState<Record<string, string[]>>(worker.permissions?.actions || {});
  const [expanded, setExpanded] = useState<string | null>(worker.permissions?.interfaces?.[0] || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalActions = useMemo(
    () => Object.values(INTERFACE_ACTIONS).reduce((s, list) => s + list.length, 0),
    []
  );
  const grantedActions = useMemo(
    () => Object.values(actions).reduce((s, list) => s + list.length, 0),
    [actions]
  );

  const toggleInterface = (id: string) => {
    setInterfaces(prev => {
      if (prev.includes(id)) {
        // Retirer l'interface retire aussi ses actions : pas de droit orphelin.
        setActions(a => {
          const next = { ...a };
          delete next[id];
          return next;
        });
        if (expanded === id) setExpanded(null);
        return prev.filter(x => x !== id);
      }
      setExpanded(id);
      return [...prev, id];
    });
  };

  const toggleAction = (interfaceId: string, actionId: string) => {
    setActions(prev => {
      const current = prev[interfaceId] || [];
      return {
        ...prev,
        [interfaceId]: current.includes(actionId)
          ? current.filter(a => a !== actionId)
          : [...current, actionId],
      };
    });
  };

  const selectAllActions = (interfaceId: string) => {
    const all = (INTERFACE_ACTIONS[interfaceId] || []).map(a => a.id);
    setActions(prev => ({
      ...prev,
      [interfaceId]: (prev[interfaceId] || []).length === all.length ? [] : all,
    }));
  };

  const selectAllInterfaces = () => {
    const allIds = SIDEBAR_ITEMS.map(i => i.id);
    if (interfaces.length === allIds.length) {
      setInterfaces([]);
      setActions({});
    } else {
      setInterfaces(allIds);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // On ne conserve que les actions des interfaces réellement autorisées.
      const cleanedActions: Record<string, string[]> = {};
      for (const id of interfaces) {
        if (actions[id]?.length) cleanedActions[id] = actions[id];
      }
      const permissions: WorkerPermissions = { interfaces, actions: cleanedActions };
      await DatabaseService.updateWorkerPermissions(worker.id, permissions);
      onSaved(permissions);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[75] bg-slate-900/55 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto sm:py-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="bg-saas-bg w-full max-w-4xl rounded-3xl shadow-2xl border border-saas-border overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]"
      >
        {/* En-tête */}
        <div className="relative overflow-hidden bg-[#0F172A] text-white px-8 py-6 shrink-0">
          <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-[#0284C7]/25 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-[#0284C7] flex items-center justify-center shadow-lg shadow-[#0284C7]/30">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {T('Permissions', 'الصلاحيات')}
                </h3>
                <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.25em] mt-1">
                  {worker.fullName}{worker.roleName ? ` · ${worker.roleName}` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative mt-5 flex flex-wrap items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[11px] font-black uppercase tracking-wider">
              {interfaces.length}/{SIDEBAR_ITEMS.length} {T('interfaces', 'واجهات')}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[11px] font-black uppercase tracking-wider">
              {grantedActions}/{totalActions} {T('actions', 'إجراءات')}
            </span>
            <button
              onClick={selectAllInterfaces}
              className="ml-auto px-4 py-1.5 rounded-lg bg-white/10 border border-white/20 text-[11px] font-black uppercase tracking-wider hover:bg-white/20 transition-colors cursor-pointer"
            >
              {interfaces.length === SIDEBAR_ITEMS.length ? T('Tout retirer', 'إزالة الكل') : T('Tout accorder', 'منح الكل')}
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
          <p className="flex items-start gap-2.5 text-xs text-saas-text-main leading-relaxed rounded-xl bg-[#0284C7]/8 border border-[#0284C7]/20 px-4 py-3">
            <Eye className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
            {T(
              "Cochez les interfaces visibles dans la barre latérale de cet employé, puis, dans chacune, les boutons d'action qu'il peut utiliser. Tout ce qui n'est pas coché lui est invisible.",
              'حدد الواجهات الظاهرة في الشريط الجانبي لهذا الموظف، ثم في كل واجهة الأزرار المسموح له باستخدامها. كل ما لم يُحدد يبقى مخفياً عنه.'
            )}
          </p>

          {SIDEBAR_ITEMS.map(item => {
            const enabled = interfaces.includes(item.id);
            const list = INTERFACE_ACTIONS[item.id] || [];
            const granted = actions[item.id] || [];
            const open = expanded === item.id && enabled;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border-2 overflow-hidden transition-all ${
                  enabled ? 'border-[#0284C7]/35 bg-white' : 'border-saas-border bg-white/60'
                }`}
              >
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleInterface(item.id)}
                    className={`relative w-11 h-6 rounded-full shrink-0 transition-colors cursor-pointer ${enabled ? 'bg-[#0284C7]' : 'bg-slate-300'}`}
                    aria-pressed={enabled}
                  >
                    <motion.span
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                      style={{ left: enabled ? 22 : 2 }}
                    />
                  </button>

                  <span className="text-lg shrink-0">{item.icon}</span>
                  <span className="font-black text-saas-text-main flex-1 truncate">{item.label[lang]}</span>

                  {enabled && list.length > 0 && (
                    <>
                      <span className="text-[11px] font-black text-saas-text-muted whitespace-nowrap">
                        {granted.length}/{list.length}
                      </span>
                      <button
                        onClick={() => setExpanded(open ? null : item.id)}
                        className="p-1.5 rounded-lg text-saas-text-muted hover:bg-saas-bg transition-colors cursor-pointer"
                      >
                        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
                          <ChevronDown className="w-4 h-4" />
                        </motion.span>
                      </button>
                    </>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden border-t border-saas-border bg-saas-bg"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-saas-text-muted">
                            {T('Boutons autorisés', 'الأزرار المسموحة')}
                          </span>
                          <button
                            onClick={() => selectAllActions(item.id)}
                            className="text-[11px] font-black uppercase tracking-wider text-[#0284C7] hover:underline cursor-pointer"
                          >
                            {granted.length === list.length ? T('Tout décocher', 'إلغاء الكل') : T('Tout cocher', 'تحديد الكل')}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {list.map(action => {
                            const on = granted.includes(action.id);
                            return (
                              <button
                                key={action.id}
                                onClick={() => toggleAction(item.id, action.id)}
                                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                  on
                                    ? action.sensitive
                                      ? 'border-[#DC2626] bg-[#DC2626]/8'
                                      : 'border-emerald-400 bg-emerald-50'
                                    : 'border-saas-border bg-white hover:border-saas-border-strong'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                                  on
                                    ? action.sensitive ? 'border-[#DC2626] bg-[#DC2626]' : 'border-emerald-500 bg-emerald-500'
                                    : 'border-slate-300 bg-white'
                                }`}>
                                  {on && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                                </span>
                                <span className="text-sm font-bold text-saas-text-main flex-1">
                                  {action.label[lang]}
                                </span>
                                {action.sensitive && (
                                  <Lock className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {list.some(a => a.sensitive) && (
                          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#DC2626]">
                            <Lock className="w-3 h-3" />
                            {T('Action sensible — paiements ou suppressions.', 'إجراء حساس — مدفوعات أو حذف.')}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
              <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="shrink-0 px-7 py-5 bg-white border-t border-saas-border flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="btn-saas-outline px-8 cursor-pointer">
            {T('Annuler', 'إلغاء')}
          </button>
          <button onClick={save} disabled={saving} className="btn-vel-blue px-10 py-3 text-xs">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {T('Enregistrer les permissions', 'حفظ الصلاحيات')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
