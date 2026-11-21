// Sélecteur de langue (liste déroulante). Les noms de langues ne sont jamais traduits (translate="no").
import { useEffect, useState } from 'react';
import { LANGUAGES, getState, onChange, setLanguage } from './moteur.js';

const NOTE = { quota: 'Quota de traduction gratuit atteint : réessayez plus tard.', erreur: 'Traduction momentanément indisponible.' };

export function LangSelect({ className = '' }) {
  const [s, setS] = useState(getState());
  useEffect(() => onChange(setS), []);
  return (
    <select className={`lang-select ${className}`} translate="no" value={s.lang} onChange={(e) => setLanguage(e.target.value)}
      aria-label="Langue" title={NOTE[s.status] || 'Langue'}>
      {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  );
}
