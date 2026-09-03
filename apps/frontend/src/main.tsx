import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initTheme } from './hooks/useTheme';
import './index.css';

// Apply the stored theme before the first paint, so dark-mode users never see a
// flash of the light theme.
initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
