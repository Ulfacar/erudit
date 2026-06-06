'use client';

import { useEffect, useState } from 'react';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBellPlus, IconBellCheck } from '@tabler/icons-react';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'unsupported' | 'unconfigured' | 'idle' | 'subscribed' | 'loading';

/** Кнопка «Включить уведомления»: permission → push-подписка → POST на сервер. */
export function EnablePushButton() {
  const [state, setState] = useState<State>('loading');
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    Promise.all([
      fetch('/api/v1/push/subscribe').then((r) => r.json()).catch(() => null),
      navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).catch(() => null),
    ]).then(([cfg, sub]) => {
      if (!cfg?.success || !cfg.data.configured) { setState('unconfigured'); return; }
      setPublicKey(cfg.data.publicKey);
      setState(sub ? 'subscribed' : 'idle');
    });
  }, []);

  async function subscribe() {
    if (!publicKey) return;
    setState('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка сервера');
      setState('subscribed');
      notifications.show({ color: 'green', title: 'Уведомления включены', message: 'Важные события будут приходить на это устройство.' });
    } catch (e) {
      setState('idle');
      notifications.show({ color: 'red', title: 'Не удалось включить уведомления', message: e instanceof Error ? e.message : 'Ошибка' });
    }
  }

  if (state === 'unsupported' || state === 'unconfigured') return null;
  if (state === 'subscribed') {
    return (
      <Button size="xs" variant="light" color="green" leftSection={<IconBellCheck size={16} />} style={{ pointerEvents: 'none' }}>
        Уведомления включены
      </Button>
    );
  }
  return (
    <Button size="xs" variant="light" loading={state === 'loading'} leftSection={<IconBellPlus size={16} />} onClick={subscribe}>
      Включить уведомления
    </Button>
  );
}
