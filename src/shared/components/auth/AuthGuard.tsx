'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, Loader } from '@mantine/core';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Check if session has expired
  useEffect(() => {
    if (session?.expires) {
      const expiresAt = new Date(session.expires).getTime();
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= 0) {
        router.push('/login');
        return;
      }

      // Set a timer to redirect when the session expires
      const timer = setTimeout(() => {
        router.push('/login');
      }, timeUntilExpiry);

      return () => clearTimeout(timer);
    }
  }, [session?.expires, router]);

  if (status === 'loading') {
    return (
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--mantine-color-body)',
        }}
      >
        <Loader color="blue" />
      </Box>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
