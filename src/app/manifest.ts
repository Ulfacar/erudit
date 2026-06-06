import type { MetadataRoute } from 'next';

// PWA-манифест: Bilim OS ставится на телефон как приложение.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bilim OS — система управления школой',
    short_name: 'Bilim OS',
    description: 'Журнал, дневник, финансы и AI-ассистент школы в одном приложении',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#228be6',
    lang: 'ru',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
