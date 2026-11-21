// Entrée de index.html : page d'accueil.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './Home.jsx';
import { startTranslation } from '../i18n/index.js';
import { TRANSLATE_EMAIL } from '../config.js';
import './site.css';

startTranslation({ email: TRANSLATE_EMAIL }); // avant le rendu : traduit aussi ce que React écrit ensuite
createRoot(document.getElementById('root')).render(<StrictMode><Home /></StrictMode>);
