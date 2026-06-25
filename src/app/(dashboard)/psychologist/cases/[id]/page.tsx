'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ActionIcon, Anchor, Badge, Button, Card, Checkbox, Group, Loader, Modal, Paper, Select,
  Stack, Text, Textarea, Title, Divider, Tooltip,
} from '@mantine/core';
import { IconArrowLeft, IconBrain, IconCheck, IconPlus, IconMicrophone, IconWand, IconShieldLock } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useRole } from '@/shared/hooks/useRole';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { saveDraft, loadDraft, clearDraft, saveAudio, loadAudio, clearAudio } from '@/shared/lib/offline/draftStore';
import { transcribeLocally, isTranscribeSupported } from '@/shared/lib/psy/localTranscribe';
import { Dynamics } from './Dynamics';
import { ProjectiveTest } from './ProjectiveTest';
import { ScoreTest } from './ScoreTest';

const RISK = { green: { label: 'Зелёный', color: 'green' }, yellow: { label: 'Жёлтый', color: 'yellow' }, red: { label: 'Красный', color: 'red' } } as const;
const STATUS = { new: 'Новый', in_progress: 'В работе', paused: 'Приостановлен', closed: 'Закрыт' } as const;
const STYPE_LABELS: Record<string, string> = {
  primary_diagnosis: 'Первичная диагностика', planned: 'Плановая встреча', emergency: 'Экстренная интервенция',
  parent_meeting: 'Встреча с родителями', teacher_meeting: 'Встреча с учителями', group: 'Групповая работа',
};

interface Session {
  id: string; type: string; date: string; rawNote: string | null;
  dapData: string | null; dapAssessment: string | null; dapPlan: string | null; isHumanVerified: boolean;
}
interface TestResult { id: string; aiInterpretation: string | null; isHumanVerified: boolean; rawScores?: { methodology?: string } | null }
interface PsyCase {
  id: string; studentId: string | null; subjectType?: 'student' | 'parent' | 'teacher' | 'group'; subjectName?: string | null;
  title: string; reason: string | null;
  riskLevel: keyof typeof RISK; status: keyof typeof STATUS; summary: string | null;
  courseRound?: number; outcome?: string;
  sessions: Session[]; tests: TestResult[];
}

function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { role } = useRole();
  const isCoordinator = role === 'senior_psychologist' || role === 'super_admin';
  const [c, setC] = useState<PsyCase | null>(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // G5: назначение со-психолога координатором (старший психолог)
  const [candidates, setCandidates] = useState<{ id: string; login: string; role: string }[]>([]);
  const [collabUserIds, setCollabUserIds] = useState<string[]>([]);
  const [assignUser, setAssignUser] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);

  // форма сессии
  const [type, setType] = useState('planned');
  const [rawNote, setRawNote] = useState('');
  const [dapData, setDapData] = useState('');
  const [dapAssessment, setDapAssessment] = useState('');
  const [dapPlan, setDapPlan] = useState('');
  const [qualNote, setQualNote] = useState('');
  const [verify, setVerify] = useState(false);
  // завершение курса
  const [courseOpen, setCourseOpen] = useState(false);
  const [outcome, setOutcome] = useState('improved');
  const [courseSummary, setCourseSummary] = useState('');
  const [referralTarget, setReferralTarget] = useState('psychiatrist');
  const [referralNote, setReferralNote] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // M2: голос + AI. Запись через MediaRecorder → blob; транскрипция ЛОКАЛЬНО (Whisper в браузере),
  // аудио с реальными ФИО в сеть не уходит (UC-2). NER/DAP — уже над текстом.
  const [recording, setRecording] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [modelPct, setModelPct] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInfo, setAiInfo] = useState<{ source: string; masked: number; sent: string | null; mode?: string; signals?: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/v1/psy/cases/${id}`).then((r) => r.json()).catch(() => ({}));
    if (j.success) {
      setC(j.data);
      // Имя субъекта: для ученика тянем из карточки, для остальных — из subjectName кейса.
      if (j.data.studentId) {
        const s = await fetch(`/api/v1/students/${j.data.studentId}`).then((r) => r.json()).catch(() => ({}));
        if (s.success) setStudentName(`${s.data.lastName} ${s.data.firstName}`);
      } else {
        setStudentName(j.data.subjectName ?? '');
      }
    }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const loadCollab = useCallback(async () => {
    if (!isCoordinator) return;
    const j = await fetch(`/api/v1/psy/cases/${id}/collaborators`).then((r) => r.json()).catch(() => ({}));
    if (j.success) {
      setCandidates(j.data.candidates ?? []);
      setCollabUserIds((j.data.collaborators ?? []).filter((x: { status: string }) => x.status === 'accepted').map((x: { userId: string }) => x.userId));
    }
  }, [id, isCoordinator]);
  useEffect(() => { loadCollab(); }, [loadCollab]);

  async function assignCollaborator() {
    if (!assignUser) return;
    setAssignBusy(true);
    await fetch(`/api/v1/psy/cases/${id}/collaborators`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: assignUser }),
    });
    setAssignBusy(false); setAssignUser(null);
    loadCollab();
  }

  // офлайн-черновик: восстановить при открытии модалки
  async function openComposer() {
    const d = await loadDraft(id);
    if (d) { setType(d.type || 'planned'); setRawNote(d.rawNote); setDapData(d.dapData); setDapAssessment(d.dapAssessment); setDapPlan(d.dapPlan); }
    const audio = await loadAudio(id); // офлайн-патч: незавершённое аудио пережило перезагрузку/потерю сети
    setHasAudio(!!audio);
    setErr(''); setAiInfo(null); setVerify(false); setOpen(true);
  }
  // автосейв черновика (UC-2 офлайн-патч)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { saveDraft(id, { rawNote, dapData, dapAssessment, dapPlan, type }); }, 600);
    return () => clearTimeout(t);
  }, [open, id, rawNote, dapData, dapAssessment, dapPlan, type]);

  // Локальная транскрипция аудио-blob → дописываем в rawNote. Аудио в сеть не уходит.
  async function transcribeBlob(blob: Blob) {
    if (!isTranscribeSupported()) {
      setErr('Локальная расшифровка недоступна в этом браузере — впишите текст вручную.');
      return;
    }
    setErr(''); setTranscribing(true); setModelPct(0);
    try {
      const text = await transcribeLocally(blob, (p) => setModelPct(Math.round(p)));
      if (text) setRawNote((prev) => (prev ? prev + ' ' : '') + text);
      else setErr('Не удалось распознать речь — впишите текст вручную.');
    } catch (e) {
      console.error(e);
      setErr('Ошибка локальной расшифровки — впишите текст вручную.');
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleMic() {
    if (recording) { mrRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErr('Запись с микрофона не поддерживается этим браузером.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        await saveAudio(id, blob); // офлайн-патч: сохраняем до расшифровки
        setHasAudio(true);
        await transcribeBlob(blob);
      };
      mrRef.current = mr; mr.start(); setRecording(true); setErr('');
    } catch {
      setErr('Нет доступа к микрофону.');
    }
  }

  // Повторная локальная расшифровка из кэшированного аудио (после потери сети/перезагрузки).
  async function retranscribeCached() {
    const blob = await loadAudio(id);
    if (blob) await transcribeBlob(blob);
  }

  async function aiStructure() {
    if (!rawNote.trim()) { setErr('Сначала продиктуйте или введите текст сессии'); return; }
    setErr(''); setAiLoading(true); setAiInfo(null);
    const res = await fetch('/api/v1/psy/sessions/dap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: id, rawNote }),
    });
    const j = await res.json();
    setAiLoading(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка AI'); return; }
    setDapData(j.data.dap.data); setDapAssessment(j.data.dap.assessment); setDapPlan(j.data.dap.plan);
    setAiInfo({ source: j.data.source, masked: j.data.privacy.maskedEntities, sent: j.data.privacy.sentToCloud, mode: j.data.privacy.mode, signals: j.data.privacy.residualSignals });
    setVerify(false); // anti-hallucination: всегда требуем повторной проверки человеком
  }

  async function patchCase(data: Record<string, unknown>) {
    await fetch(`/api/v1/psy/cases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    load();
  }

  async function addSession() {
    setErr('');
    if (verify && !dapData.trim() && !dapAssessment.trim() && !dapPlan.trim()) { setErr('Нельзя завершить сессию без заполненного DAP'); return; }
    setSaving(true);
    const res = await fetch('/api/v1/psy/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: id, type, rawNote, dapData, dapAssessment, dapPlan, qualNote }),
    });
    const j = await res.json();
    if (j.success && verify) {
      await fetch(`/api/v1/psy/sessions/${j.data.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isHumanVerified: true }) });
    }
    setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    await clearDraft(id); await clearAudio(id);
    setOpen(false); setType('planned'); setRawNote(''); setDapData(''); setDapAssessment(''); setDapPlan(''); setQualNote(''); setVerify(false); setAiInfo(null); setHasAudio(false);
    load();
  }

  async function completeCourse() {
    setCourseSaving(true);
    const res = await fetch(`/api/v1/psy/cases/${id}/course`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, courseSummary, referralTarget, referralNote }),
    });
    setCourseSaving(false);
    if ((await res.json()).success) { setCourseOpen(false); load(); }
  }

  async function verifySession(sid: string) {
    await fetch(`/api/v1/psy/sessions/${sid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isHumanVerified: true }) });
    load();
  }

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;
  if (!c) return <Stack p="md"><Anchor component={Link} href="/psychologist">← К кейсам</Anchor><Text c="red">Кейс не найден или нет доступа.</Text></Stack>;

  return (
    <Stack gap="lg" p="md">
      <Anchor component={Link} href="/psychologist" size="sm"><Group gap={4}><IconArrowLeft size={14} />К кейсам</Group></Anchor>

      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <IconBrain size={26} color="#9c36b5" />
          <div>
            <Title order={2}>{c.title}</Title>
            <Text c="dimmed" size="sm">{({ student: 'Ученик', parent: 'Родитель', teacher: 'Учитель', group: 'Группа' }[c.subjectType ?? 'student'])}: {studentName || c.subjectName || '—'}</Text>
            {c.reason && <Text size="sm" mt={4}>{c.reason}</Text>}
          </div>
        </Group>
        <Group gap="xs">
          <Select w={150} value={c.riskLevel} data={Object.entries(RISK).map(([k, v]) => ({ value: k, label: v.label }))}
            onChange={(v) => v && (v === 'red' ? patchCase({ riskLevel: 'red', riskJustification: prompt('Обоснование критического риска:') || '' }) : patchCase({ riskLevel: v }))} />
          <Select w={170} value={c.status} data={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v }))}
            onChange={(v) => v && patchCase({ status: v })} />
        </Group>
      </Group>

      {isCoordinator && (
        <Paper withBorder p="md" radius="md" bg="grape.0">
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <div>
              <Text size="sm" fw={600}>Назначить со-психолога (консилиум)</Text>
              <Text size="xs" c="dimmed">Координатор подключает второго психолога к кейсу без согласия владельца.</Text>
              {collabUserIds.length > 0 && (
                <Group gap={4} mt={6}>
                  {collabUserIds.map((uid) => {
                    const u = candidates.find((x) => x.id === uid);
                    return <Badge key={uid} variant="light" color="grape">{u?.login ?? uid}</Badge>;
                  })}
                </Group>
              )}
            </div>
            <Group gap="xs" align="flex-end">
              <Select w={220} placeholder="Выберите психолога" searchable value={assignUser} onChange={setAssignUser}
                data={candidates.filter((u) => !collabUserIds.includes(u.id)).map((u) => ({ value: u.id, label: `${u.login} · ${u.role === 'senior_psychologist' ? 'старший' : u.role === 'specialist' ? 'специалист' : 'психолог'}` }))} />
              <Button variant="light" color="grape" disabled={!assignUser} loading={assignBusy} onClick={assignCollaborator}>Назначить</Button>
            </Group>
          </Group>
        </Paper>
      )}

      <Group justify="space-between">
        <Title order={4}>Сессии ({c.sessions.length}) · раунд {c.courseRound ?? 1}</Title>
        <Group gap="xs">
          {c.status !== 'closed' && <Button variant="light" color="teal" onClick={() => setCourseOpen(true)}>Завершить курс</Button>}
          <Button leftSection={<IconPlus size={16} />} onClick={openComposer}>Новая сессия</Button>
        </Group>
      </Group>

      {c.sessions.length === 0 ? (
        <Text c="dimmed">Сессий пока нет.</Text>
      ) : (
        <Stack gap="sm">
          {c.sessions.map((s) => (
            <Card key={s.id} withBorder radius="md">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Badge variant="light">{STYPE_LABELS[s.type] ?? s.type}</Badge>
                  <Text size="sm" c="dimmed">{fmtDate(s.date)}</Text>
                </Group>
                {s.isHumanVerified
                  ? <Badge color="green" leftSection={<IconCheck size={12} />}>Проверено психологом</Badge>
                  : <Button size="xs" variant="light" color="orange" onClick={() => verifySession(s.id)}>Подтвердить (я проверил)</Button>}
              </Group>
              {s.rawNote && <Text size="sm" c="dimmed" mb="xs"><b>Оригинал:</b> {s.rawNote}</Text>}
              <Group grow align="flex-start" wrap="nowrap">
                <DapCol title="Data — факты" text={s.dapData} />
                <DapCol title="Assessment — оценка" text={s.dapAssessment} />
                <DapCol title="Plan — план" text={s.dapPlan} />
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Divider my="sm" />
      <Dynamics caseId={id} />
      <ScoreTest caseId={id} onSaved={load} />
      <ProjectiveTest caseId={id} tests={c.tests ?? []} onSaved={load} />

      <Divider my="sm" />
      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="xs">Итоговое заключение по курсу</Title>
        <Textarea autosize minRows={3} placeholder="Резюме по итогам всех сессий (для завершения кейса)"
          defaultValue={c.summary ?? ''} onBlur={(e) => e.currentTarget.value !== (c.summary ?? '') && patchCase({ summary: e.currentTarget.value })} />
      </Paper>

      <Modal opened={open} onClose={() => setOpen(false)} title="Новая сессия" centered size="lg">
        <Stack gap="md">
          <Select label="Тип встречи" value={type} onChange={(v) => setType(v ?? 'planned')}
            data={Object.entries(STYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />

          <div>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>Запись сессии (оригинал)</Text>
              <Group gap={6}>
                <Tooltip label={recording ? 'Остановить запись' : 'Голосовой ввод (расшифровка локально)'}>
                  <ActionIcon variant={recording ? 'filled' : 'light'} color={recording ? 'red' : 'grape'} onClick={toggleMic} disabled={transcribing}>
                    <IconMicrophone size={16} />
                  </ActionIcon>
                </Tooltip>
                <Button size="xs" variant="light" leftSection={<IconWand size={14} />} loading={aiLoading} onClick={aiStructure}>
                  Структурировать DAP (AI)
                </Button>
              </Group>
            </Group>
            {recording && <Group gap={6} mb={4}><Loader size="xs" color="red" /><Text size="xs" c="red">Идёт запись… нажмите микрофон, чтобы остановить.</Text></Group>}
            {transcribing && (
              <Group gap={6} mb={4}><Loader size="xs" /><Text size="xs" c="dimmed">Локальная расшифровка{modelPct > 0 && modelPct < 100 ? ` (загрузка модели ${modelPct}%)` : '…'} — аудио не покидает устройство.</Text></Group>
            )}
            {!recording && !transcribing && hasAudio && (
              <Group gap={6} mb={4}><IconShieldLock size={14} color="#2f9e44" /><Text size="xs" c="dimmed">Аудио сохранено офлайн. <Anchor size="xs" component="button" type="button" onClick={retranscribeCached}>Расшифровать ещё раз</Anchor></Text></Group>
            )}
            <Textarea autosize minRows={2} placeholder="Продиктуйте (расшифровка локально) или впишите ход сессии своими словами" value={rawNote} onChange={(e) => setRawNote(e.currentTarget.value)} />
          </div>

          {aiInfo && (
            <Paper withBorder p="xs" radius="sm" bg={aiInfo.mode === 'local-only' ? 'orange.0' : 'gray.0'}>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <IconShieldLock size={14} color={aiInfo.mode === 'local-only' ? '#e8590c' : '#2f9e44'} style={{ marginTop: 2 }} />
                {aiInfo.mode === 'local-only' ? (
                  <Text size="xs" c="dimmed">
                    🔒 <b>Строгий режим приватности:</b> в тексте остался возможный идентификатор{aiInfo.signals?.length ? ` (${aiInfo.signals.join(', ')})` : ''} — данные <b>НЕ отправлены в облако</b>, структурировано локально. Подсказка может быть проще, но данные ребёнка не покинули сервер.
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    Источник: <b>{aiInfo.source === 'llm' ? 'Claude (облако)' : 'локальный сплиттер'}</b> · обезличено сущностей: <b>{aiInfo.masked}</b> · в облако ушёл текст с маркерами, не ФИО.
                  </Text>
                )}
              </Group>
            </Paper>
          )}

          <Textarea label="Data — факты, наблюдения" autosize minRows={2} value={dapData} onChange={(e) => setDapData(e.currentTarget.value)} />
          <Textarea label="Assessment — оценка психолога" autosize minRows={2} value={dapAssessment} onChange={(e) => setDapAssessment(e.currentTarget.value)} />
          <Textarea label="Plan — следующие шаги" autosize minRows={2} value={dapPlan} onChange={(e) => setDapPlan(e.currentTarget.value)} />
          <Textarea label="Наблюдение (качественно: «стал спокойнее» и т.п.)" autosize minRows={1} value={qualNote} onChange={(e) => setQualNote(e.currentTarget.value)} />
          <Checkbox label="Я проверил AI-интерпретацию и подтверждаю её корректность" checked={verify} onChange={(e) => setVerify(e.currentTarget.checked)} />
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={addSession} loading={saving}>Сохранить сессию</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={courseOpen} onClose={() => setCourseOpen(false)} title="Завершить курс (≈6 сессий)" centered>
        <Stack gap="md">
          <Select label="Исход курса" value={outcome} onChange={(v) => setOutcome(v ?? 'improved')}
            data={[
              { value: 'improved', label: 'Явные улучшения — закрыть кейс' },
              { value: 'repeat', label: 'Нет улучшений — новый раунд с другими методиками' },
              { value: 'referred', label: 'Направить к узкому специалисту' },
            ]} />
          <Textarea label="Итоговое заключение по курсу" autosize minRows={3} value={courseSummary} onChange={(e) => setCourseSummary(e.currentTarget.value)} />
          {outcome === 'referred' && (
            <>
              <Select label="Специалист" value={referralTarget} onChange={(v) => setReferralTarget(v ?? 'psychiatrist')}
                data={[{ value: 'psychiatrist', label: 'Психиатр' }, { value: 'speech', label: 'Логопед' }, { value: 'medical', label: 'Врач' }, { value: 'other', label: 'Другое' }]} />
              <Textarea label="Комментарий к направлению" autosize minRows={2} value={referralNote} onChange={(e) => setReferralNote(e.currentTarget.value)} />
            </>
          )}
          <Text size="xs" c="dimmed">«Повтор» и «направление» уведомят старшего психолога.</Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCourseOpen(false)}>Отмена</Button>
            <Button color="teal" onClick={completeCourse} loading={courseSaving}>Завершить</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function DapCol({ title, text }: { title: string; text: string | null }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={600} c="grape">{title}</Text>
      <Text size="sm">{text || <Text component="span" c="dimmed" size="sm">—</Text>}</Text>
    </Stack>
  );
}

export default function CaseDetailPage() {
  return (
    <RoleGate roles={['psychologist', 'senior_psychologist', 'specialist', 'super_admin']}>
      <CaseDetail />
    </RoleGate>
  );
}
