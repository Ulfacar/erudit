'use client';

import { useRef, useState } from 'react';
import { Badge, Button, Card, Group, Loader, Paper, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { IconPhoto, IconWand, IconCheck, IconShieldLock } from '@tabler/icons-react';

interface TestResult { id: string; aiInterpretation: string | null; isHumanVerified: boolean; rawScores?: { methodology?: string } | null }

export function ProjectiveTest({ caseId, tests, onSaved }: { caseId: string; tests: TestResult[]; onSaved: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasImage, setHasImage] = useState(false);
  const [methodology, setMethodology] = useState('Несуществующее животное');
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState('');
  const [testId, setTestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [autoBlurred, setAutoBlurred] = useState(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const originalRef = useRef<string>(''); // оригинал (до блюра) — для цифрового сейфа

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const cv = canvasRef.current!;
      const maxW = 480;
      const scale = Math.min(1, maxW / img.width);
      cv.width = img.width * scale; cv.height = img.height * scale;
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      originalRef.current = cv.toDataURL('image/png'); // снимок оригинала ДО блюра
      setHasImage(true); setDraft(''); setTestId(null); setSource(''); setAutoBlurred(0);
      autoBlur(); // UC-3: авто-детект рукописного текста и блюр ДО любой отправки
    };
    img.src = URL.createObjectURL(file);
  }

  // UC-3 шаг 2: локальный OCR (tesseract.js, в браузере) находит текст/подписи → авто-пикселизация.
  // Ручное выделение остаётся для корректировки. Картинка в сеть не уходит на этом шаге.
  async function autoBlur() {
    const cv = canvasRef.current;
    if (!cv) return;
    setOcrBusy(true);
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(cv.toDataURL('image/png'), 'rus+eng');
      let n = 0;
      for (const w of data.words ?? []) {
        const txt = (w.text ?? '').trim();
        // блюрим уверенно распознанные «словесные» фрагменты (подписи/имена), пропуская шум
        if (w.confidence >= 55 && txt.length >= 2 && /[A-Za-zА-Яа-яЁё0-9]/.test(txt)) {
          const b = w.bbox;
          pixelate(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
          n++;
        }
      }
      setAutoBlurred(n);
    } catch (err) {
      console.error('[ocr] auto-blur failed:', err);
    } finally {
      setOcrBusy(false);
    }
  }

  // пиксселизация выделенной области (скрытие рукописной подписи ДО отправки)
  function pixelate(x: number, y: number, w: number, h: number) {
    const cv = canvasRef.current!; const ctx = cv.getContext('2d')!;
    if (w < 4 || h < 4) return;
    const sw = Math.max(1, Math.round(w / 12)), sh = Math.max(1, Math.round(h / 12));
    const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
    tmp.getContext('2d')!.drawImage(cv, x, y, w, h, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
  }

  function pos(e: React.MouseEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.MouseEvent) { drag.current = pos(e); }
  function up(e: React.MouseEvent) {
    if (!drag.current) return;
    const a = drag.current, b = pos(e);
    pixelate(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    drag.current = null;
  }

  async function analyze() {
    if (!hasImage) return;
    setBusy(true);
    const imageBase64 = canvasRef.current!.toDataURL('image/png'); // заблюренная — в облако
    const res = await fetch('/api/v1/psy/vision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // originalBase64 — оригинал в приватный сейф; imageBase64 (блюр) — в vision
      body: JSON.stringify({ caseId, imageBase64, originalBase64: originalRef.current, methodology }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.success) { setDraft(j.data.draft); setSource(j.data.source); setTestId(j.data.id); onSaved(); }
  }

  async function verify() {
    if (!testId) return;
    await fetch(`/api/v1/psy/tests/${testId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiInterpretation: draft, isHumanVerified: true }),
    });
    setTestId(null); setDraft(''); setHasImage(false); onSaved();
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" mb="sm"><IconPhoto size={20} color="#e8590c" /><Title order={5}>Проективный тест (рисунок)</Title></Group>

      {tests.length > 0 && (
        <Stack gap="xs" mb="md">
          {tests.map((t) => (
            <Card key={t.id} withBorder padding="xs" radius="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>{t.rawScores?.methodology ?? 'Методика'}</Text>
                {t.isHumanVerified ? <Badge color="green" leftSection={<IconCheck size={12} />}>Проверено</Badge> : <Badge color="orange">Черновик</Badge>}
              </Group>
              {t.aiInterpretation && <Text size="sm" c="dimmed" mt={4} lineClamp={3}>{t.aiInterpretation}</Text>}
            </Card>
          ))}
        </Stack>
      )}

      <Stack gap="sm">
        <TextInput label="Методика" value={methodology} onChange={(e) => setMethodology(e.currentTarget.value)} />
        <input type="file" accept="image/*" capture="environment" onChange={onFile} />
        <Text size="xs" c="dimmed">Загрузите/сфотографируйте рисунок. Подписи распознаются и размываются <b>автоматически</b> (локально, в браузере). Можно дополнительно выделить область мышью — она тоже будет размыта <b>до</b> отправки в AI.</Text>
        {ocrBusy && <Group gap={6}><Loader size="xs" /><Text size="xs" c="dimmed">Поиск и скрытие подписей (локально)…</Text></Group>}
        {!ocrBusy && hasImage && autoBlurred > 0 && (
          <Group gap={6}><IconShieldLock size={14} color="#2f9e44" /><Text size="xs" c="dimmed">Авто-скрыто текстовых фрагментов: <b>{autoBlurred}</b>. Проверьте и при необходимости размойте ещё мышью.</Text></Group>
        )}
        <canvas ref={canvasRef} onMouseDown={down} onMouseUp={up}
          style={{ border: '1px solid #dee2e6', borderRadius: 8, cursor: hasImage ? 'crosshair' : 'default', maxWidth: '100%', display: hasImage ? 'block' : 'none' }} />
        {hasImage && (
          <Group>
            <Button leftSection={<IconWand size={16} />} loading={busy} disabled={ocrBusy} onClick={analyze}>Анализировать</Button>
            <Button variant="light" leftSection={<IconShieldLock size={16} />} loading={ocrBusy} onClick={autoBlur}>Повторить авто-скрытие</Button>
          </Group>
        )}
        {draft && (
          <Stack gap="xs">
            <Group gap={6}><IconShieldLock size={14} color="#2f9e44" /><Text size="xs" c="dimmed">Источник: <b>{source === 'llm' ? 'Vision (облако)' : 'локальный черновик'}</b>. В облако ушёл рисунок с заблюренными подписями.</Text></Group>
            <Textarea label="Черновик заключения (проверьте и скорректируйте)" autosize minRows={3} value={draft} onChange={(e) => setDraft(e.currentTarget.value)} />
            <Group justify="flex-end"><Button color="green" leftSection={<IconCheck size={16} />} onClick={verify}>Подтвердить (я проверил)</Button></Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
