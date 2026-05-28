import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryProvider } from '@/shared/providers/query-provider';
import { SessionProvider } from '@/shared/providers/session-provider';
import { eruditTheme } from '@/theme/erudit-theme';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Bilim OS - School ERP System',
  description: 'Bilim OS - Система управления образовательным процессом',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={inter.variable} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <SessionProvider>
          <QueryProvider>
            <MantineProvider theme={eruditTheme} defaultColorScheme="light">
              <Notifications position="top-right" />
              {children}
            </MantineProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
