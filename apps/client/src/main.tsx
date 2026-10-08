import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { iniciarSonidos } from './audio/sonidos';
import './styles.css';

iniciarSonidos();

const root = document.getElementById('root');
if (!root) throw new Error('falta #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
