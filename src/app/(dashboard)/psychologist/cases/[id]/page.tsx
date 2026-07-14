'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ActionIcon, Anchor, Badge, Button, Card, Checkbox, Group, Loader, Modal, Paper, Rating, Select,
  Stack, TagsInput, Text, Textarea, Title, Divider, Tooltip, NumberInput,
} from '@mantine/core';
import { IconArrowLeft, IconBrain, IconCheck, IconPlus, IconMicrophone, IconWand, IconShieldLock, IconPlayerPlay, IconTrash } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
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
const CASE_STAGES = ['assessment', 'diagnosis', 'ips', 'intervention', 'review', 'closed'] as const;
type CaseStage = (typeof CASE_STAGES)[number];
const STAGE_LABELS: Record<CaseStage, string> = {
  assessment: 'Оценка',
  diagnosis: 'Диагностика',
  ips: 'ИПС',
  intervention: 'Интервенция',
  review: 'Обзор',
  closed: 'Закрытие',
};
const IPS_STATUS_LABELS: Record<string, string> = { draft: 'черновик', approved: 'утверждён', superseded: 'заменён' };
const IPS_GOAL_DEADLINE_LABELS = {
  '2w': '2 недели',
  '3w': '3 недели',
  '4w': '4 недели',
  '3m': '3 месяца',
  '6m': '6 месяцев',
} as const;
type IpsGoalDeadline = keyof typeof IPS_GOAL_DEADLINE_LABELS;
const INTERVENTION_OUTCOMES = [
  { value: 'improved', label: 'Явные улучшения' },
  { value: 'referred', label: 'Направить к специалисту' },
  { value: 'continue', label: 'Продолжить (нужна новая интервенция)' },
];

interface Session {
  id: string; type: string; date: string; rawNote: string | null;
  dapData: string | null; dapAssessment: string | null; dapPlan: string | null; isHumanVerified: boolean; audioKey: string | null;
}
interface TestResult { id: string; aiInterpretation: string | null; isHumanVerified: boolean; rawScores?: { methodology?: string } | null }
interface PsyCase {
  id: string; studentId: string | null; subjectType?: 'student' | 'parent' | 'teacher' | 'group'; subjectName?: string | null;
  subjectDisplay?: string;
  title: string; reason: string | null;
  riskLevel: keyof typeof RISK; status: keyof typeof STATUS; summary: string | null;
  stage: CaseStage | string; outcome?: string;
  sessions: Session[]; tests: TestResult[];
}
interface PsyIps { id: string; version: number; status: string; approvedAt?: string | null }
interface PsyIpsGoal {
  id: string; specific: string; measurable?: string | null; achievable?: string | null;
  relevant?: string | null; timeBound?: string | null; deadline: IpsGoalDeadline | string;
  directions: string[]; achieved: boolean; achievedAt?: string | null;
}
interface IpsGoalForm {
  specific: string; measurable: string; achievable: string; relevant: string;
  timeBound: string; deadline: IpsGoalDeadline | null; directions: string[];
}
interface PsyIntervention {
  id: string; ipsId: string; plannedMeetings: number; status: string;
  startedAt?: string; completedAt?: string | null; _count?: { sessions: number };
}

function emptyIpsGoalForm(): IpsGoalForm {
  return { specific: '', measurable: '', achievable: '', relevant: '', timeBound: '', deadline: null, directions: [] };
}

function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<PsyCase | null>(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // форма сессии
  const [type, setType] = useState('planned');
  const [rawNote, setRawNote] = useState('');
  const [dapData, setDapData] = useState('');
  const [dapAssessment, setDapAssessment] = useState('');
  const [dapPlan, setDapPlan] = useState('');
  const [qualNote, setQualNote] = useState('');
  const [verify, setVerify] = useState(false);
  const [ipsList, setIpsList] = useState<PsyIps[]>([]);
  const [ipsGoals, setIpsGoals] = useState<Record<string, PsyIpsGoal[]>>({});
  const [ipsGoalForms, setIpsGoalForms] = useState<Record<string, IpsGoalForm>>({});
  const [goalSaving, setGoalSaving] = useState<Record<string, boolean>>({});
  const [interventions, setInterventions] = useState<PsyIntervention[]>([]);
  const [plannedMeetings, setPlannedMeetings] = useState('5');
  const [plannedMeetingsPreset, setPlannedMeetingsPreset] = useState('5');
  const [interventionDoneOpen, setInterventionDoneOpen] = useState(false);
  const [outcome, setOutcome] = useState('improved');
  const [interventionSummary, setInterventionSummary] = useState('');
  const [referralTarget, setReferralTarget] = useState('psychiatrist');
  const [referralNote, setReferralNote] = useState('');
  const [interventionSaving, setInterventionSaving] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenStage, setReopenStage] = useState('ips');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // M2: голос + AI. Запись через MediaRecorder → blob; транскрипция ЛОКАЛЬНО (Whisper в браузере).
  // CR-019: после создания сессии исходное аудио сохраняется в приватный MinIO.
  const [recording, setRecording] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [modelPct, setModelPct] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const sessionMrRef = useRef<MediaRecorder | null>(null);
  const sessionChunksRef = useRef<Blob[]>([]);
  const [audioBusy, setAudioBusy] = useState<Record<string, boolean>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInfo, setAiInfo] = useState<{ source: string; masked: number; sent: string | null; mode?: string; signals?: string[]; manualReview?: boolean } | null>(null);
  const [aiRating, setAiRating] = useState(0);
  const [aiComment, setAiComment] = useState('');
  const [aiRated, setAiRated] = useState(false);
  const activeIntervention = interventions.find((item) => item.status === 'active') ?? null;
  const latestApprovedIps = ipsList.find((item) => item.status === 'approved') ?? null;
  const stageIndex = Math.max(0, CASE_STAGES.indexOf((c?.stage ?? 'assessment') as CaseStage));

  const load = useCallback(async () => {
    setLoading(true);
    const [j, ips, interventionItems] = await Promise.all([
      fetch(`/api/v1/psy/cases/${id}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/v1/psy/cases/${id}/ips`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/v1/psy/cases/${id}/interventions`).then((r) => r.json()).catch(() => ({})),
    ]);
    if (ips.success) setIpsList(ips.data ?? []);
    if (interventionItems.success) setInterventions(interventionItems.data ?? []);
    if (j.success) {
      setC(j.data);
      setStudentName(j.data.subjectDisplay ?? j.data.subjectName ?? '');
    }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const loadIpsGoals = useCallback(async (ipsId: string) => {
    const j = await fetch(`/api/v1/psy/ips/${ipsId}/goals`).then((r) => r.json()).catch(() => ({}));
    if (Array.isArray(j)) {
      setIpsGoals((prev) => ({ ...prev, [ipsId]: j }));
      return;
    }
    if (j.success) setIpsGoals((prev) => ({ ...prev, [ipsId]: j.data ?? [] }));
  }, []);

  useEffect(() => {
    ipsList.forEach((ips) => { loadIpsGoals(ips.id); });
  }, [ipsList, loadIpsGoals]);

  function updateIpsGoalForm(ipsId: string, patch: Partial<IpsGoalForm>) {
    setIpsGoalForms((prev) => ({
      ...prev,
      [ipsId]: { ...emptyIpsGoalForm(), ...prev[ipsId], ...patch },
    }));
  }

  async function addIpsGoal(ipsId: string) {
    const form = { ...emptyIpsGoalForm(), ...ipsGoalForms[ipsId] };
    const directions = form.directions.map((item) => item.trim()).filter(Boolean);
    if (!form.specific.trim()) { setErr('Укажите конкретную цель'); return; }
    if (!form.deadline) { setErr('Выберите срок цели'); return; }
    if (directions.length < 1 || directions.length > 3) { setErr('Укажите от 1 до 3 направлений'); return; }
    setGoalSaving((prev) => ({ ...prev, [ipsId]: true }));
    const res = await fetch(`/api/v1/psy/ips/${ipsId}/goals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specific: form.specific.trim(),
        measurable: form.measurable.trim(),
        achievable: form.achievable.trim(),
        relevant: form.relevant.trim(),
        timeBound: form.timeBound.trim(),
        deadline: form.deadline,
        directions,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setGoalSaving((prev) => ({ ...prev, [ipsId]: false }));
    if (!j.success) { setErr(j.error?.message ?? 'Не удалось добавить цель'); return; }
    setErr('');
    setIpsGoalForms((prev) => ({ ...prev, [ipsId]: emptyIpsGoalForm() }));
    loadIpsGoals(ipsId);
  }

  async function toggleIpsGoal(goalId: string, ipsId: string, achieved: boolean) {
    const res = await fetch(`/api/v1/psy/goals/${goalId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achieved }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) { setErr(j.error?.message ?? 'Не удалось обновить цель'); return; }
    setErr('');
    loadIpsGoals(ipsId);
  }

  // офлайн-черновик: восстановить при открытии модалки
  async function openComposer() {
    const d = await loadDraft(id);
    if (d) { setType(d.type || 'planned'); setRawNote(d.rawNote); setDapData(d.dapData); setDapAssessment(d.dapAssessment); setDapPlan(d.dapPlan); }
    const audio = await loadAudio(id); // офлайн-патч: незавершённое аудио пережило перезагрузку/потерю сети
    setHasAudio(!!audio);
    setAiRating(0); setAiComment(''); setAiRated(false);
    setErr(''); setAiInfo(null); setVerify(false); setOpen(true);
  }

  async function cancelComposer() {
    await clearAudio(id);
    setHasAudio(false);
    setOpen(false);
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

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function uploadSessionAudio(sessionId: string, blob: Blob) {
    const audioBase64 = await blobToDataUrl(blob);
    const res = await fetch(`/api/v1/psy/sessions/${sessionId}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64 }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) throw new Error(j.error?.message ?? 'Не удалось сохранить аудио');
  }

  async function toggleSessionAudioRecord(sessionId: string) {
    if (recordingSessionId === sessionId) { sessionMrRef.current?.stop(); return; }
    if (recordingSessionId) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErr('Запись с микрофона не поддерживается этим браузером.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = MediaRecorder.isTypeSupported('audio/webm') ? new MediaRecorder(stream, { mimeType: 'audio/webm' }) : new MediaRecorder(stream);
      sessionChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) sessionChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecordingSessionId(null);
        const blob = new Blob(sessionChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        setAudioBusy((prev) => ({ ...prev, [sessionId]: true }));
        try {
          await uploadSessionAudio(sessionId, blob);
          setErr('');
          load();
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Не удалось сохранить аудио');
        } finally {
          setAudioBusy((prev) => ({ ...prev, [sessionId]: false }));
        }
      };
      sessionMrRef.current = mr; mr.start(); setRecordingSessionId(sessionId); setErr('');
    } catch {
      setErr('Нет доступа к микрофону.');
    }
  }

  async function playSessionAudio(sessionId: string) {
    setAudioBusy((prev) => ({ ...prev, [sessionId]: true }));
    try {
      const res = await fetch(`/api/v1/psy/sessions/${sessionId}/audio`);
      const j = await res.json().catch(() => ({}));
      if (!j.success) throw new Error(j.error?.message ?? 'Аудио не найдено');
      await new Audio(j.data.url).play();
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось воспроизвести аудио');
    } finally {
      setAudioBusy((prev) => ({ ...prev, [sessionId]: false }));
    }
  }

  async function deleteSessionAudio(sessionId: string) {
    if (!window.confirm('Удалить аудиозапись этой сессии?')) return;
    setAudioBusy((prev) => ({ ...prev, [sessionId]: true }));
    try {
      const res = await fetch(`/api/v1/psy/sessions/${sessionId}/audio`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!j.success) throw new Error(j.error?.message ?? 'Не удалось удалить аудио');
      setErr('');
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось удалить аудио');
    } finally {
      setAudioBusy((prev) => ({ ...prev, [sessionId]: false }));
    }
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
    setAiInfo({ source: j.data.source, masked: j.data.privacy.maskedEntities, sent: j.data.privacy.sentToCloud, mode: j.data.privacy.mode, signals: j.data.privacy.residualSignals, manualReview: j.data.privacy.requiresManualReview });
    setAiRating(0); setAiComment(''); setAiRated(false);
    setVerify(false); // anti-hallucination: всегда требуем повторной проверки человеком
  }

  async function patchCase(data: Record<string, unknown>) {
    await fetch(`/api/v1/psy/cases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    load();
  }

  async function patchStage(stage: CaseStage) {
    const res = await fetch(`/api/v1/psy/cases/${id}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) { setErr(j.error?.message ?? 'Не удалось сменить этап'); return; }
    setErr('');
    load();
  }

  function moveStage(delta: -1 | 1) {
    const target = CASE_STAGES[stageIndex + delta];
    if (target) patchStage(target);
  }

  async function reopenCase() {
    const res = await fetch(`/api/v1/psy/cases/${id}/reopen`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: reopenStage }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) { setErr(j.error?.message ?? 'Не удалось переоткрыть кейс'); return; }
    setErr('');
    setReopenOpen(false);
    load();
  }

  async function createIps() {
    const res = await fetch(`/api/v1/psy/cases/${id}/ips`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) { setErr(j.error?.message ?? 'Не удалось создать ИПС'); return; }
    setErr('');
    load();
  }

  async function approveIps(ipsId: string) {
    const res = await fetch(`/api/v1/psy/ips/${ipsId}/approve`, { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (!j.success) { setErr(j.error?.message ?? 'Не удалось утвердить ИПС'); return; }
    setErr('');
    load();
  }

  async function startIntervention() {
    if (!latestApprovedIps) return;
    const res = await fetch(`/api/v1/psy/cases/${id}/interventions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipsId: latestApprovedIps.id, plannedMeetings: Number(plannedMeetings) }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) { setErr(j.error?.message ?? 'Не удалось начать интервенцию'); return; }
    setErr('');
    load();
  }

  async function addSession() {
    setErr('');
    if (!dapData.trim()) { setErr('Поле D (Data) обязательно'); return; }
    setSaving(true);
    const res = await fetch('/api/v1/psy/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: id, type, rawNote, dapData, dapAssessment, dapPlan, qualNote, ...(activeIntervention ? { interventionId: activeIntervention.id } : {}) }),
    });
    const j = await res.json();
    if (j.success && verify) {
      await fetch(`/api/v1/psy/sessions/${j.data.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isHumanVerified: true }) });
    }
    setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    try {
      const audio = await loadAudio(id);
      if (audio) await uploadSessionAudio(j.data.id, audio);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить аудио');
      setOpen(false);
      load();
      return;
    }
    await clearDraft(id); await clearAudio(id);
    setOpen(false); setType('planned'); setRawNote(''); setDapData(''); setDapAssessment(''); setDapPlan(''); setQualNote(''); setVerify(false); setAiInfo(null); setHasAudio(false);
    load();
  }

  async function completeIntervention() {
    if (!activeIntervention) return;
    setInterventionSaving(true);
    const res = await fetch(`/api/v1/psy/interventions/${activeIntervention.id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, summary: interventionSummary, referralTarget, referralNote }),
    });
    const j = await res.json().catch(() => ({}));
    setInterventionSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Не удалось завершить интервенцию'); return; }
    setInterventionDoneOpen(false); setInterventionSummary(''); setReferralNote(''); setOutcome('improved'); setErr('');
    load();
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

      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="xs" wrap="wrap">
            {CASE_STAGES.map((stage, index) => (
              <Badge key={stage} color={index === stageIndex ? 'grape' : index < stageIndex ? 'green' : 'gray'} variant={index === stageIndex ? 'filled' : 'light'}>
                {index + 1}. {STAGE_LABELS[stage]}
              </Badge>
            ))}
          </Group>
          <Group gap="xs">
            <Button variant="light" disabled={stageIndex <= 0} onClick={() => moveStage(-1)}>← Назад</Button>
            <Button disabled={stageIndex >= CASE_STAGES.length - 1} onClick={() => moveStage(1)}>→ Следующий этап</Button>
            {c.status === 'closed' && (
              <Button variant="light" color="blue" onClick={() => { setErr(''); setReopenOpen(true); }}>Переоткрыть</Button>
            )}
          </Group>
        </Group>
        {err && <Text c="red" size="sm" mt="xs">{err}</Text>}
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={4}>Сопровождение</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={createIps}>Создать ИПС</Button>
          </Group>
          <Stack gap="xs">
            <Text size="sm" fw={600}>ИПС</Text>
            {ipsList.length === 0 ? <Text size="sm" c="dimmed">ИПС пока нет.</Text> : (
              <Stack gap={6}>
                {ipsList.map((ips) => {
                  const form = { ...emptyIpsGoalForm(), ...ipsGoalForms[ips.id] };
                  const goals = ipsGoals[ips.id] ?? [];
                  return (
                    <Paper key={ips.id} withBorder p="sm" radius="sm">
                      <Stack gap="sm">
                        <Group justify="space-between" gap="xs" wrap="wrap">
                          <Group gap="xs">
                            <Text size="sm" fw={500}>v{ips.version}</Text>
                            <Badge variant="light" color={ips.status === 'approved' ? 'green' : ips.status === 'draft' ? 'yellow' : 'gray'}>{IPS_STATUS_LABELS[ips.status] ?? ips.status}</Badge>
                          </Group>
                          {ips.status === 'draft' && <Button size="xs" variant="light" onClick={() => approveIps(ips.id)}>Утвердить</Button>}
                        </Group>

                        <Stack gap="xs">
                          <Text size="sm" fw={600}>Цели (SMART)</Text>
                          {goals.length === 0 ? (
                            <Text size="sm" c="dimmed">Целей пока нет.</Text>
                          ) : (
                            <Stack gap="xs">
                              {goals.map((goal) => (
                                <Paper key={goal.id} withBorder p="xs" radius="sm" bg="gray.0">
                                  <Group justify="space-between" align="flex-start" gap="xs" wrap="wrap">
                                    <Stack gap={4} style={{ flex: 1 }}>
                                      <Text size="sm" fw={600}>{goal.specific}</Text>
                                      <Group gap={4} wrap="wrap">
                                        {goal.directions.map((direction) => <Badge key={direction} variant="light">{direction}</Badge>)}
                                        <Badge variant="light" color="blue">{IPS_GOAL_DEADLINE_LABELS[goal.deadline as IpsGoalDeadline] ?? goal.deadline}</Badge>
                                        {c.stage !== 'review' && (
                                          <Badge color={goal.achieved ? 'green' : 'gray'} variant="light">{goal.achieved ? 'достигнута' : 'в работе'}</Badge>
                                        )}
                                      </Group>
                                    </Stack>
                                    {c.stage === 'review' && (
                                      <Checkbox
                                        label="Достигнута"
                                        checked={goal.achieved}
                                        onChange={(e) => toggleIpsGoal(goal.id, ips.id, e.currentTarget.checked)}
                                      />
                                    )}
                                  </Group>
                                </Paper>
                              ))}
                            </Stack>
                          )}
                        </Stack>

                        {ips.status === 'draft' && (
                          <Stack gap="xs">
                            <Textarea
                              label="Цель (Specific — конкретно)"
                              autosize
                              minRows={2}
                              value={form.specific}
                              onChange={(e) => updateIpsGoalForm(ips.id, { specific: e.currentTarget.value })}
                              required
                            />
                            <Group grow align="flex-start">
                              <Textarea label="Measurable — как измерим" autosize minRows={1} value={form.measurable} onChange={(e) => updateIpsGoalForm(ips.id, { measurable: e.currentTarget.value })} />
                              <Textarea label="Achievable — реалистичность" autosize minRows={1} value={form.achievable} onChange={(e) => updateIpsGoalForm(ips.id, { achievable: e.currentTarget.value })} />
                            </Group>
                            <Group grow align="flex-start">
                              <Textarea label="Relevant — актуальность" autosize minRows={1} value={form.relevant} onChange={(e) => updateIpsGoalForm(ips.id, { relevant: e.currentTarget.value })} />
                              <Textarea label="Time-bound — привязка ко времени" autosize minRows={1} value={form.timeBound} onChange={(e) => updateIpsGoalForm(ips.id, { timeBound: e.currentTarget.value })} />
                            </Group>
                            <Group grow align="flex-end">
                              <Select
                                label="Срок"
                                value={form.deadline}
                                onChange={(v) => updateIpsGoalForm(ips.id, { deadline: v as IpsGoalDeadline | null })}
                                data={Object.entries(IPS_GOAL_DEADLINE_LABELS).map(([value, label]) => ({ value, label }))}
                              />
                              <TagsInput
                                label="Направления (1–3)"
                                maxTags={3}
                                value={form.directions}
                                onChange={(directions) => updateIpsGoalForm(ips.id, { directions })}
                                data={form.directions}
                              />
                            </Group>
                            <Group justify="flex-end">
                              <Button size="xs" onClick={() => addIpsGoal(ips.id)} loading={!!goalSaving[ips.id]}>Добавить цель</Button>
                            </Group>
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Stack>
          <Divider />
          <Stack gap="xs">
            <Text size="sm" fw={600}>Интервенция</Text>
            {activeIntervention ? (
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text size="sm">План: {activeIntervention.plannedMeetings} встреч</Text>
                  <Text size="sm" c="dimmed">Проведено сессий: {activeIntervention._count?.sessions ?? 0}</Text>
                </div>
                <Button color="teal" variant="light" onClick={() => setInterventionDoneOpen(true)}>Завершить интервенцию</Button>
              </Group>
            ) : latestApprovedIps ? (
              <Group align="flex-end" gap="xs" wrap="wrap">
                <Select label="План встреч" w={140} value={plannedMeetingsPreset} onChange={(v) => { const next = v ?? '5'; setPlannedMeetingsPreset(next); if (next !== 'custom') setPlannedMeetings(next); }}
                  data={[{ value: '3', label: '3' }, { value: '5', label: '5' }, { value: '7', label: '7' }, { value: 'custom', label: 'Другое' }]} />
                {plannedMeetingsPreset === 'custom' && (
                  <NumberInput label="Количество" w={140} min={1} value={Number(plannedMeetings)} onChange={(v) => setPlannedMeetings(String(v || 1))} />
                )}
                <Button onClick={startIntervention}>Начать</Button>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">Для начала интервенции нужен утверждённый ИПС.</Text>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Group justify="space-between">
        <Title order={4}>Сессии ({c.sessions.length})</Title>
        <Group gap="xs">
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
                <Group gap="xs">
                  <Tooltip label={recordingSessionId === s.id ? 'Остановить запись' : 'Записать аудио'}>
                    <ActionIcon
                      variant={recordingSessionId === s.id ? 'filled' : 'light'}
                      color={recordingSessionId === s.id ? 'red' : 'grape'}
                      onClick={() => toggleSessionAudioRecord(s.id)}
                      loading={!!audioBusy[s.id]}
                      disabled={!!recordingSessionId && recordingSessionId !== s.id}
                    >
                      <IconMicrophone size={16} />
                    </ActionIcon>
                  </Tooltip>
                  {s.audioKey && (
                    <>
                      <Button size="xs" variant="light" leftSection={<IconPlayerPlay size={14} />} onClick={() => playSessionAudio(s.id)} loading={!!audioBusy[s.id]}>
                        Прослушать
                      </Button>
                      <Tooltip label="Удалить аудио">
                        <ActionIcon variant="light" color="red" onClick={() => deleteSessionAudio(s.id)} loading={!!audioBusy[s.id]}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </>
                  )}
                  {s.isHumanVerified
                    ? <Badge color="green" leftSection={<IconCheck size={12} />}>Проверено психологом</Badge>
                    : <Button size="xs" variant="light" color="orange" onClick={() => verifySession(s.id)}>Подтвердить (я проверил)</Button>}
                </Group>
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
        <Title order={5} mb="xs">Итоговое заключение</Title>
        <Textarea autosize minRows={3} placeholder="Резюме по итогам всех сессий (для завершения кейса)"
          defaultValue={c.summary ?? ''} onBlur={(e) => e.currentTarget.value !== (c.summary ?? '') && patchCase({ summary: e.currentTarget.value })} />
      </Paper>

      <Modal opened={open} onClose={cancelComposer} title="Новая сессия" centered size="lg">
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
              <Group gap={6} mb={4}><IconShieldLock size={14} color="#2f9e44" /><Text size="xs" c="dimmed">Аудио готово к сохранению в защищённое хранилище после создания сессии. <Anchor size="xs" component="button" type="button" onClick={retranscribeCached}>Расшифровать ещё раз</Anchor></Text></Group>
            )}
            <Textarea autosize minRows={2} placeholder="Продиктуйте (расшифровка локально) или впишите ход сессии своими словами" value={rawNote} onChange={(e) => setRawNote(e.currentTarget.value)} />
          </div>

          {aiInfo && (
            <>
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

              {aiInfo.manualReview && (
                <Paper withBorder p="xs" radius="sm" bg="red.0" mt={6}>
                  <Group gap={8} align="flex-start" wrap="nowrap">
                    <IconShieldLock size={14} color="#e03131" style={{ marginTop: 2 }} />
                    <Text size="xs" c="red.9">
                      ⚠️ <b>Красный кейс:</b> ИИ-подсказка носит вспомогательный характер и <b>требует обязательной ручной проверки психолога</b> перед использованием.
                    </Text>
                  </Group>
                </Paper>
              )}

              <Paper withBorder p="xs" radius="sm">
                <Stack gap="xs">
                  <Text size="sm" fw={500}>Оцените качество ИИ-черновика (черновик до вашего подтверждения)</Text>
                  <Rating value={aiRating} onChange={setAiRating} />
                  <Textarea
                    label="Комментарий (необязательно)"
                    autosize
                    minRows={1}
                    value={aiComment}
                    onChange={(e) => setAiComment(e.currentTarget.value)}
                  />
                  {aiRated ? (
                    <Stack gap={2}>
                      <Text size="sm" c="green">✓ Оценка сохранена</Text>
                      <Text size="xs" c="dimmed">Спасибо, оценка сохранена</Text>
                    </Stack>
                  ) : (
                    <Group justify="flex-start">
                      <Button
                        size="xs"
                        disabled={aiRating === 0 || aiRated}
                        onClick={async () => {
                          const res = await fetch('/api/v1/psy/ai-feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              caseId: id,
                              rating: aiRating,
                              source: aiInfo.source === 'llm' ? 'llm' : 'local',
                              comment: aiComment || undefined,
                            }),
                          });
                          const j = await res.json().catch(() => ({}));
                          if (!res.ok || j.success === false) {
                            setErr(j.error?.message ?? 'Не удалось сохранить оценку');
                            return;
                          }
                          setErr('');
                          setAiRated(true);
                        }}
                      >
                        Оценить черновик
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Paper>
            </>
          )}

          <Textarea label="Data — факты, наблюдения" autosize minRows={2} value={dapData} onChange={(e) => setDapData(e.currentTarget.value)} />
          <Textarea label="Assessment — оценка психолога" autosize minRows={2} value={dapAssessment} onChange={(e) => setDapAssessment(e.currentTarget.value)} />
          <Textarea label="Plan — следующие шаги" autosize minRows={2} value={dapPlan} onChange={(e) => setDapPlan(e.currentTarget.value)} />
          <Textarea label="Наблюдение (качественно: «стал спокойнее» и т.п.)" autosize minRows={1} value={qualNote} onChange={(e) => setQualNote(e.currentTarget.value)} />
          <Checkbox label="Я проверил AI-интерпретацию и подтверждаю её корректность" checked={verify} onChange={(e) => setVerify(e.currentTarget.checked)} />
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={cancelComposer}>Отмена</Button>
            <Button onClick={addSession} loading={saving}>Сохранить сессию</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={reopenOpen} onClose={() => setReopenOpen(false)} title="Переоткрыть кейс" centered>
        <Stack gap="md">
          <Text size="sm">Кейс вернётся в сопровождение с выбранного этапа. История сохраняется, создаётся новая версия ИПС.</Text>
          <Select
            label="Возобновить с этапа"
            value={reopenStage}
            onChange={(v) => setReopenStage(v ?? 'ips')}
            data={[
              { value: 'diagnosis', label: 'Комплексная диагностика (этап 2)' },
              { value: 'ips', label: 'Индивидуальный план — ИПС (этап 3)' },
            ]}
          />
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setReopenOpen(false)}>Отмена</Button>
            <Button color="blue" onClick={reopenCase}>Переоткрыть</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={interventionDoneOpen} onClose={() => setInterventionDoneOpen(false)} title="Завершить интервенцию" centered>
        <Stack gap="md">
          <Select label="Исход" value={outcome} onChange={(v) => setOutcome(v ?? 'improved')} data={INTERVENTION_OUTCOMES} />
          <Textarea label="Итоговое заключение" autosize minRows={3} value={interventionSummary} onChange={(e) => setInterventionSummary(e.currentTarget.value)} />
          {outcome === 'referred' && (
            <>
              <Select label="Специалист" value={referralTarget} onChange={(v) => setReferralTarget(v ?? 'psychiatrist')}
                data={[{ value: 'psychiatrist', label: 'Психиатр' }, { value: 'speech', label: 'Логопед' }, { value: 'medical', label: 'Врач' }, { value: 'other', label: 'Другое' }]} />
              <Textarea label="Комментарий" autosize minRows={2} value={referralNote} onChange={(e) => setReferralNote(e.currentTarget.value)} />
            </>
          )}
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setInterventionDoneOpen(false)}>Отмена</Button>
            <Button color="teal" onClick={completeIntervention} loading={interventionSaving}>Завершить</Button>
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
