// Entrée de index.html : page d'accueil.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './Home.jsx';
import './site.css';

createRoot(document.getElementById('root')).render(<StrictMode><Home /></StrictMode>);
