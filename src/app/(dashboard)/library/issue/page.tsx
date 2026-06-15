'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert, Badge, Button, Card, Group, Modal, Paper, Select, Stack, Tabs, Text, TextInput, Title,
} from '@mantine/core';
import { IconBook2, IconBarcode, IconCamera, IconPlus, IconSearch, IconUser } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Student { id: string; firstName: string; lastName: string; class?: { grade: number; letter: string } | null }
interface Loan { id: string; code: string | null; title: string | null; takenAt: string; studentId: string | null }
interface FoundLoan extends Loan { student: { firstName: string; lastName: string; class?: { grade: number; letter: string } | null } | null }

const barcodeSupported = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;

/** Модалка сканирования штрихкода камерой (прогрессивное улучшение, есть не везде). */
function ScannerModal({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        const detector = new (window as any).BarcodeDetector();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0 && codes[0].rawValue) { onCode(String(codes[0].rawValue)); return; }
          } catch { /* кадр не распознан — продолжаем */ }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setErr('Не удалось включить камеру. Введите код вручную.');
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);

  return (
    <Modal opened onClose={onClose} title="Сканирование штрихкода" centered>
      <Stack gap="sm">
        {err ? <Alert color="orange">{err}</Alert> : (
          <video ref={videoRef} style={{ width: '100%', borderRadius: 8, background: '#000' }} muted playsInline />
        )}
        <Text size="xs" c="dimmed">Наведите камеру на штрихкод учебника.</Text>
        <Group justify="flex-end"><Button variant="subtle" color="gray" onClick={onClose}>Закрыть</Button></Group>
      </Stack>
    </Modal>
  );
}

function LibraryIssue() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // выдача
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [issuing, setIssuing] = useState(false);

  // поиск
  const [findCode, setFindCode] = useState('');
  const [found, setFound] = useState<FoundLoan | null | 'none'>(null);
  const [finding, setFinding] = useState(false);

  // сканер
  const [scanFor, setScanFor] = useState<'issue' | 'find' | null>(null);

  useEffect(() => {
    fetch('/api/v1/students').then((r) => r.json()).then((j) => { setStudents(j.data ?? []); setLoadingStudents(false); }).catch(() => setLoadingStudents(false));
  }, []);

  async function loadLoans(sid: string) {
    const j = await fetch(`/api/v1/library/loans?studentId=${sid}`).then((r) => r.json()).catch(() => ({ data: [] }));
    setLoans(j.data ?? []);
  }
  useEffect(() => { if (studentId) loadLoans(studentId); else setLoans([]); }, [studentId]);

  const studentName = (s?: Student | null) => (s ? `${s.lastName} ${s.firstName}${s.class ? ` (${s.class.grade}${s.class.letter})` : ''}` : '');

  async function issue(scannedCode?: string) {
    const c = (scannedCode ?? code).trim();
    if (!studentId) { notifications.show({ color: 'red', title: 'Ошибка', message: 'Сначала выберите ученика' }); return; }
    if (!c) return;
    setIssuing(true);
    const res = await fetch('/api/v1/library/loans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: c, studentId, title: title || null }),
    });
    const j = await res.json(); setIssuing(false);
    if (!j.success) { notifications.show({ color: 'red', title: 'Не выдан', message: j.error?.message ?? 'Ошибка' }); return; }
    notifications.show({ color: 'green', title: 'Выдан', message: `Учебник ${c}${title ? ` («${title}»)` : ''} привязан` });
    setCode(''); setTitle(''); loadLoans(studentId);
  }

  async function returnLoan(id: string) {
    const res = await fetch('/api/v1/library/loans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok && studentId) { notifications.show({ color: 'green', title: 'Возвращён', message: 'Учебник снят с ученика' }); loadLoans(studentId); }
  }

  async function find(scannedCode?: string) {
    const c = (scannedCode ?? findCode).trim();
    if (!c) return;
    setFinding(true); setFound(null);
    const j = await fetch(`/api/v1/library/loans?code=${encodeURIComponent(c)}`).then((r) => r.json()).catch(() => ({ data: null }));
    setFinding(false);
    setFound(j.data ?? 'none');
  }

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconBook2 size={24} color="#1098ad" /><Title order={2}>Выдача учебников</Title></Group>

      <Tabs defaultValue="issue">
        <Tabs.List>
          <Tabs.Tab value="issue" leftSection={<IconUser size={15} />}>Выдать ученику</Tabs.Tab>
          <Tabs.Tab value="find" leftSection={<IconSearch size={15} />}>Найти учебник</Tabs.Tab>
        </Tabs.List>

        {/* Выдача */}
        <Tabs.Panel value="issue" pt="md">
          <Stack gap="md">
            <Select
              label="Ученик" placeholder={loadingStudents ? 'Загрузка…' : 'Найти ученика'} searchable
              data={students.map((s) => ({ value: s.id, label: studentName(s) }))}
              value={studentId} onChange={setStudentId}
            />
            {studentId && (
              <Paper withBorder radius="md" p="md">
                <Text fw={600} mb="sm">Сканировать / ввести учебники</Text>
                <Group align="flex-end" gap="sm">
                  <TextInput label="Штрихкод / номер" leftSection={<IconBarcode size={15} />} value={code} onChange={(e) => setCode(e.currentTarget.value)} style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') issue(); }} />
                  <TextInput label="Название (необязательно)" placeholder="Математика 5 кл." value={title} onChange={(e) => setTitle(e.currentTarget.value)} style={{ flex: 1 }} />
                  <Button leftSection={<IconPlus size={16} />} onClick={() => issue()} loading={issuing}>Выдать</Button>
                  {barcodeSupported() && <Button variant="light" leftSection={<IconCamera size={16} />} onClick={() => setScanFor('issue')}>Камера</Button>}
                </Group>

                <Text fw={600} mt="lg" mb="sm">На руках у ученика ({loans.length})</Text>
                {loans.length === 0 ? <Text c="dimmed" size="sm">Учебники не выданы.</Text> : (
                  <Stack gap={6}>
                    {loans.map((l) => (
                      <Card key={l.id} withBorder radius="sm" padding="sm">
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap">
                            <Badge variant="light" color="cyan" leftSection={<IconBarcode size={11} />}>{l.code}</Badge>
                            <Text>{l.title ?? 'Без названия'}</Text>
                            <Text size="xs" c="dimmed">{fmtDate(l.takenAt)}</Text>
                          </Group>
                          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => returnLoan(l.id)}>Вернуть</Button>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>

        {/* Поиск чей учебник */}
        <Tabs.Panel value="find" pt="md">
          <Stack gap="md">
            <Group align="flex-end" gap="sm">
              <TextInput label="Штрихкод найденного учебника" leftSection={<IconBarcode size={15} />} value={findCode} onChange={(e) => setFindCode(e.currentTarget.value)} style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') find(); }} />
              <Button leftSection={<IconSearch size={16} />} onClick={() => find()} loading={finding}>Найти</Button>
              {barcodeSupported() && <Button variant="light" leftSection={<IconCamera size={16} />} onClick={() => setScanFor('find')}>Камера</Button>}
            </Group>
            {found === 'none' && <Alert color="gray">Учебник с этим кодом не числится ни за кем.</Alert>}
            {found && found !== 'none' && (
              <Alert color="teal" icon={<IconUser size={16} />} title="Учебник числится за">
                <Text fw={600}>{found.student ? `${found.student.lastName} ${found.student.firstName}` : '—'}{found.student?.class ? ` · ${found.student.class.grade}${found.student.class.letter}` : ''}</Text>
                <Text size="sm" c="dimmed">{found.title ?? 'Без названия'} · код {found.code} · выдан {fmtDate(found.takenAt)}</Text>
              </Alert>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {scanFor && (
        <ScannerModal
          onClose={() => setScanFor(null)}
          onCode={(c) => { const mode = scanFor; setScanFor(null); if (mode === 'issue') { setCode(c); issue(c); } else { setFindCode(c); find(c); } }}
        />
      )}
    </Stack>
  );
}

export default function LibraryIssuePage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'librarian']}>
      <LibraryIssue />
    </RoleGate>
  );
}
