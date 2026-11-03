/**
 * Adresse d'envoi des documents (contrats, factures, reçus, contrats de
 * continuité…).
 *
 * L'expéditeur réel est d'abord lu dans `website_contacts.email` (paramétrable
 * depuis l'interface). Cette constante est le REPLI utilisé quand rien n'est
 * configuré, et l'adresse qui reçoit la copie interne de chaque envoi.
 */
export const DEFAULT_SENDER_EMAIL = 'mhdauto16@gmail.com';

/** Copie interne systématique de tout document envoyé à un client. */
export const INTERNAL_COPY_EMAIL = DEFAULT_SENDER_EMAIL;
