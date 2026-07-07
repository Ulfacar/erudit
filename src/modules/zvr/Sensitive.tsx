'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

const ZVR_BLUR_KEY = 'zvr-blur';

function readBlurState() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(ZVR_BLUR_KEY) === '1';
}

export function useZvrBlur() {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    setBlurred(readBlurState());

    function onStorage(event: StorageEvent) {
      if (event.key === ZVR_BLUR_KEY) setBlurred(event.newValue === '1');
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setValue = useCallback((value: boolean) => {
    setBlurred(value);
    window.localStorage.setItem(ZVR_BLUR_KEY, value ? '1' : '0');
  }, []);

  const toggle = useCallback(() => {
    setBlurred((current) => {
      const next = !current;
      window.localStorage.setItem(ZVR_BLUR_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return { blurred, setBlurred: setValue, toggleBlur: toggle };
}

export function Sensitive({ blurred, children }: { blurred: boolean; children: ReactNode }) {
  return (
    <span
      style={blurred ? {
        display: 'inline-block',
        filter: 'blur(6px)',
        userSelect: 'none',
      } : undefined}
    >
      {children}
    </span>
  );
}
