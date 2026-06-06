'use client';

import { useEffect } from 'react';

/** Регистрирует service worker (PWA + web-push). Рендерит ничего. */
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('[pwa] SW registration failed:', err);
    });
  }, []);
  return null;
}
