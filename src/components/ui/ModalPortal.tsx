import React from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Monte une fenêtre modale directement sous `<body>`.
 *
 * POURQUOI : un ancêtre porteur d'un `transform`, d'un `filter` ou d'un
 * `backdrop-filter` devient le bloc conteneur de ses descendants en
 * `position: fixed`. La fenêtre s'ancre alors en haut du contenu de la page
 * plutôt qu'au centre de l'écran — après avoir fait défiler vers le bas, elle
 * s'ouvrait hors du champ de vision et il fallait remonter pour la voir.
 *
 * Le portail met la fenêtre hors d'atteinte de toute animation de page, donc
 * `position: fixed` retrouve le viewport comme référence, quel que soit
 * l'endroit d'où la fenêtre est ouverte.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};
