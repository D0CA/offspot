// src/ui/LoadingScreen.jsx
import React, { useEffect, useState } from 'react';
import './LoadingScreen.css';

export default function LoadingScreen({ loading }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!loading) {
      // quand loading passe à false, on déclenche le fade-out
      const timer = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (!visible) return null;

  return (
    <div className={`loading-overlay ${loading ? '' : 'fade-out'}`}>
      <div className="spinner" />
      <p className="loading-text">Chargement en cours…</p>
    </div>
  );
}
