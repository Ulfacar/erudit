'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Paper, Select, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconSearch } from '@tabler/icons-react';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d';

/**
 * Нейро-визуализатор ядра. Школа — живой организм:
 *  - glow-узлы, пульсирующее ядро (autoPauseRedraw=false — рендер не засыпает);
 *  - фоновые импульсы-частицы по случайным связям (emitParticle);
 *  - клик/ховер — подсветка соседей, остальное затухает (как в graphify/GitNexus);
 *  - поиск с зумом к узлу;
 *  - «▶ Как это работает» — сюжетные импульсы рисуются вручную в
 *    onRenderFramePost (не зависят от существования/направления рёбер).
 */

export interface GraphNode {
  id: string;
  label: string;
  type: 'school' | 'domain' | 'class' | 'teacher' | 'student' | 'parent';
  val: number;
  count?: number;
  meta?: string;
  x?: number;
  y?: number;
}

export interface GraphLinkRaw {
  source: string;
  target: string;
}

export interface ScenarioStep {
  from: string;
  to: string;
  caption: string;
}

export const TYPE_COLORS: Record<GraphNode['type'], string> = {
  school: '#3b82f6',
  domain: '#a855f7',
  class: '#22d3ee',
  teacher: '#fbbf24',
  student: '#34d399',
  parent: '#f472b6',
};

export const TYPE_LABELS: Record<GraphNode['type'], string> = {
  school: 'Ядро',
  domain: 'Модуль',
  class: 'Класс',
  teacher: 'Педагог',
  student: 'Ученик',
  parent: 'Родитель',
};

const STEP_MS = 2100; // длительность шага сценария
const LIVE_SEG_MS = 900; // длительность сегмента живого импульса
const LIVE_POLL_MS = 6000; // период опроса живых событий

interface LivePulse {
  path: GraphNode[]; // уже резолвленные узлы (≥2)
  startedAt: number;
  color: string;
}

interface TickerItem {
  id: string;
  caption: string;
}

const EVENT_COLORS: Record<string, string> = {
  'grade.created': '#fbbf24',
  'attendance.marked': '#34d399',
  'admission.enrolled': '#2dd4bf',
  'test.completed': '#60a5fa',
};

function linkDistance(link: { source: GraphNode | string; target: GraphNode | string }): number {
  const s = typeof link.source === 'object' ? link.source.type : null;
  const t = typeof link.target === 'object' ? link.target.type : null;
  if (s === 'school' && t === 'domain') return 170;
  if (s === 'school' && t === 'class') return 320;
  if (t === 'parent') return 36;
  if (t === 'student') return 30;
  if (s === 'domain' && t === 'teacher') return 90;
  if (s === 'teacher' || t === 'teacher') return 110;
  return 120;
}

function endpointId(v: string | number | NodeObject): string {
  return typeof v === 'object' ? String(v.id) : String(v);
}

export default function CoreGraph(props: {
  width: number;
  height: number;
  nodes: GraphNode[];
  links: GraphLinkRaw[];
  scenario: ScenarioStep[];
  onNodeClick: (node: GraphNode) => void;
}) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  // подсветка читается из ref в каждом кадре — без ре-рендеров
  const focusRef = useRef<{ nodeId: string | null; neighbors: Set<string> }>({ nodeId: null, neighbors: new Set() });
  // состояние сценария (тоже per-frame)
  const scenarioRef = useRef<{ active: boolean; step: number; startedAt: number }>({ active: false, step: 0, startedAt: 0 });
  const [caption, setCaption] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // живые события ядра: очередь импульсов + лента
  const livePulsesRef = useRef<LivePulse[]>([]);
  const liveSinceRef = useRef<string>(new Date(Date.now() - 60_000).toISOString());
  const seenEventsRef = useRef<Set<string>>(new Set());
  const [ticker, setTicker] = useState<TickerItem[]>([]);

  const nodesById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    props.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [props.nodes]);

  // ядро организма — для волн-сердцебиения
  const coreNode = useMemo(() => props.nodes.find((n) => n.type === 'school') ?? null, [props.nodes]);

  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    props.links.forEach((l) => {
      add(l.source, l.target);
      add(l.target, l.source);
    });
    return m;
  }, [props.links]);

  const setFocus = useCallback(
    (nodeId: string | null) => {
      focusRef.current = {
        nodeId,
        neighbors: nodeId ? new Set([nodeId, ...(adjacency.get(nodeId) ?? [])]) : new Set(),
      };
    },
    [adjacency],
  );

  // физика: разводим домены/классы от ядра
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const linkForce = fg.d3Force('link') as { distance?: (fn: (l: never) => number) => void } | undefined;
    linkForce?.distance?.(linkDistance as never);
    const charge = fg.d3Force('charge') as { strength?: (n: number) => void } | undefined;
    charge?.strength?.(-95);
    fg.d3ReheatSimulation();
  }, [props.nodes.length]);

  // фоновые импульсы: ядро «дышит» данными
  useEffect(() => {
    const t = setInterval(() => {
      const fg = fgRef.current;
      if (!fg || document.hidden) return;
      for (let i = 0; i < 2; i++) {
        const link = props.links[Math.floor(Math.random() * props.links.length)];
        if (link) fg.emitParticle(link as unknown as LinkObject);
      }
    }, 420);
    return () => clearInterval(t);
  }, [props.links]);

  // ── Живые события: поллинг реальных AgentEvent → импульсы + лента ──
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/v1/core/events?since=${encodeURIComponent(liveSinceRef.current)}`);
        const j = await res.json();
        if (!active || !j?.success) return;
        liveSinceRef.current = j.data.now;
        const fresh: TickerItem[] = [];
        for (const ev of j.data.events as Array<{ id: string; type: string; path: string[]; caption: string }>) {
          if (seenEventsRef.current.has(ev.id)) continue;
          seenEventsRef.current.add(ev.id);
          const nodes = ev.path.map((id) => nodesById.get(id)).filter((n): n is GraphNode => !!n);
          if (nodes.length >= 2) {
            livePulsesRef.current.push({
              path: nodes,
              startedAt: performance.now(),
              color: EVENT_COLORS[ev.type] ?? '#7dd3fc',
            });
          }
          fresh.push({ id: ev.id, caption: ev.caption });
        }
        if (fresh.length) setTicker((prev) => [...fresh.reverse(), ...prev].slice(0, 4));
      } catch {
        /* живые события не критичны */
      }
    };
    poll();
    const t = setInterval(poll, LIVE_POLL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [nodesById]);

  // ── Сценарий ──
  const startScenario = useCallback(() => {
    if (!props.scenario.length) return;
    scenarioRef.current = { active: true, step: 0, startedAt: performance.now() };
    setPlaying(true);
    setCaption(props.scenario[0].caption);
    const first = nodesById.get(props.scenario[0].from);
    if (first && fgRef.current) {
      fgRef.current.centerAt(first.x ?? 0, first.y ?? 0, 700);
      fgRef.current.zoom(2.2, 700);
    }
  }, [props.scenario, nodesById]);

  const stopScenario = useCallback(() => {
    scenarioRef.current.active = false;
    setPlaying(false);
    setCaption(null);
    setFocus(null);
    fgRef.current?.zoomToFit(800, 60);
  }, [setFocus]);

  // продвижение шагов сценария (каптионы — через React, кадры — в render hook)
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const sc = scenarioRef.current;
      if (!sc.active) return;
      const elapsed = performance.now() - sc.startedAt;
      if (elapsed >= STEP_MS) {
        const next = sc.step + 1;
        if (next >= props.scenario.length) {
          stopScenario();
          return;
        }
        sc.step = next;
        sc.startedAt = performance.now();
        setCaption(props.scenario[next].caption);
        const target = nodesById.get(props.scenario[next].to);
        if (target && fgRef.current) fgRef.current.centerAt(target.x ?? 0, target.y ?? 0, 600);
      }
    }, 80);
    return () => clearInterval(t);
  }, [playing, props.scenario, nodesById, stopScenario]);

  // ── Отрисовка узла: glow-нейрон ──
  const drawNode = useCallback(
    (n: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = n as GraphNode & NodeObject;
      const color = TYPE_COLORS[node.type] ?? '#94a3b8';
      const focus = focusRef.current;
      const dimmed = focus.nodeId !== null && !focus.neighbors.has(node.id);
      const isFocus = focus.nodeId === node.id;

      let r = Math.sqrt(node.val) * 3.2;
      // ядро пульсирует
      if (node.type === 'school') r *= 1 + 0.1 * Math.sin(performance.now() / 320);

      ctx.save();
      ctx.globalAlpha = dimmed ? 0.13 : 1;

      // свечение — только у крупных узлов и в фокусе (canvas shadow дорогой)
      if (node.type === 'school' || node.type === 'domain' || node.type === 'class' || isFocus) {
        ctx.shadowColor = color;
        ctx.shadowBlur = isFocus ? 26 : node.type === 'school' ? 24 : 12;
      }
      // светящаяся сфера: блик смещён вверх-влево, как у освещённого шара
      const cx = node.x ?? 0;
      const cy = node.y ?? 0;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.42, color);
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;

      // подписи: крупным всегда, мелким — при зуме или в подсветке
      const showLabel =
        node.type === 'school' || node.type === 'domain' || node.type === 'class'
          ? true
          : globalScale > 2.2 || (focus.nodeId !== null && focus.neighbors.has(node.id));
      if (showLabel && !dimmed) {
        const fontSize = node.type === 'school' ? 16 / globalScale : 11.5 / globalScale;
        ctx.font = `${node.type === 'school' || node.type === 'domain' ? '600' : '400'} ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
        ctx.fillText(node.label, node.x ?? 0, (node.y ?? 0) + r + 2.5 / globalScale);
      }
      ctx.restore();
    },
    [],
  );

  // ── Сюжетный импульс: светящаяся точка от узла к узлу + нить ──
  const drawScenarioFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const sc = scenarioRef.current;
      if (!sc.active) return;
      const step = props.scenario[sc.step];
      if (!step) return;
      const from = nodesById.get(step.from);
      const to = nodesById.get(step.to);
      if (!from || !to) return;

      const p = Math.min((performance.now() - sc.startedAt) / (STEP_MS * 0.72), 1);
      const x = (from.x ?? 0) + ((to.x ?? 0) - (from.x ?? 0)) * p;
      const y = (from.y ?? 0) + ((to.y ?? 0) - (from.y ?? 0)) * p;

      ctx.save();
      // нить-синапс
      ctx.beginPath();
      ctx.moveTo(from.x ?? 0, from.y ?? 0);
      ctx.lineTo(to.x ?? 0, to.y ?? 0);
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // хвост импульса
      for (let i = 4; i >= 1; i--) {
        const tp = Math.max(p - i * 0.045, 0);
        const tx = (from.x ?? 0) + ((to.x ?? 0) - (from.x ?? 0)) * tp;
        const ty = (from.y ?? 0) + ((to.y ?? 0) - (from.y ?? 0)) * tp;
        ctx.beginPath();
        ctx.arc(tx, ty, 2.6 - i * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(125, 211, 252, ${0.5 - i * 0.1})`;
        ctx.fill();
      }
      // сам импульс
      ctx.shadowColor = '#7dd3fc';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, 2 * Math.PI);
      ctx.fillStyle = '#e0f2fe';
      ctx.fill();
      ctx.shadowBlur = 0;

      // вспышка на целевом узле в конце шага
      if (p >= 1) {
        const flash = 1 - Math.min((performance.now() - sc.startedAt - STEP_MS * 0.72) / (STEP_MS * 0.28), 1);
        ctx.beginPath();
        ctx.arc(to.x ?? 0, to.y ?? 0, Math.sqrt(to.val) * 3.2 + 7 * (1 - flash), 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(125, 211, 252, ${0.8 * flash})`;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      ctx.restore();
    },
    [props.scenario, nodesById],
  );

  // ── Живые импульсы: светящаяся точка бежит по реальному пути события ──
  const drawLivePulses = useCallback((ctx: CanvasRenderingContext2D) => {
    const now = performance.now();
    livePulsesRef.current = livePulsesRef.current.filter(
      (p) => now - p.startedAt < (p.path.length - 1) * LIVE_SEG_MS,
    );
    for (const pulse of livePulsesRef.current) {
      const elapsed = now - pulse.startedAt;
      const seg = Math.min(Math.floor(elapsed / LIVE_SEG_MS), pulse.path.length - 2);
      const t = Math.min((elapsed - seg * LIVE_SEG_MS) / LIVE_SEG_MS, 1);
      const from = pulse.path[seg];
      const to = pulse.path[seg + 1];
      if (!from || !to) continue;
      const x = (from.x ?? 0) + ((to.x ?? 0) - (from.x ?? 0)) * t;
      const y = (from.y ?? 0) + ((to.y ?? 0) - (from.y ?? 0)) * t;

      ctx.save();
      // тонкая нить текущего сегмента
      ctx.beginPath();
      ctx.moveTo(from.x ?? 0, from.y ?? 0);
      ctx.lineTo(to.x ?? 0, to.y ?? 0);
      ctx.strokeStyle = pulse.color + '55';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // хвост
      for (let i = 3; i >= 1; i--) {
        const tp = Math.max(t - i * 0.06, 0);
        ctx.beginPath();
        ctx.arc(
          (from.x ?? 0) + ((to.x ?? 0) - (from.x ?? 0)) * tp,
          (from.y ?? 0) + ((to.y ?? 0) - (from.y ?? 0)) * tp,
          2.2 - i * 0.45,
          0,
          2 * Math.PI,
        );
        ctx.fillStyle = pulse.color + ['66', '44', '22'][i - 1];
        ctx.fill();
      }
      // голова импульса
      ctx.shadowColor = pulse.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  }, []);

  // ── Сердцебиение ядра: концентрические волны расходятся от центра ──
  const drawCorePulse = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!coreNode) return;
      const cx = coreNode.x ?? 0;
      const cy = coreNode.y ?? 0;
      const baseR = Math.sqrt(coreNode.val) * 3.2;
      const period = 2800; // период «удара»
      const now = performance.now();
      for (let k = 0; k < 2; k++) {
        const phase = ((now + (k * period) / 2) % period) / period;
        const rr = baseR + phase * 110;
        const alpha = (1 - phase) * 0.3;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },
    [coreNode],
  );

  const drawOverlays = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      drawCorePulse(ctx);
      drawScenarioFrame(ctx);
      drawLivePulses(ctx);
    },
    [drawCorePulse, drawScenarioFrame, drawLivePulses],
  );

  const searchData = useMemo(
    () =>
      props.nodes.map((n) => ({
        value: n.id,
        label: `${n.label} · ${TYPE_LABELS[n.type]}`,
      })),
    [props.nodes],
  );

  const handleSearch = useCallback(
    (id: string | null) => {
      if (!id) return;
      const node = nodesById.get(id);
      const fg = fgRef.current;
      if (!node || !fg) return;
      setFocus(id);
      fg.centerAt(node.x ?? 0, node.y ?? 0, 800);
      fg.zoom(3.4, 800);
      // найденный ученик — сразу открываем карточку 360°
      if (node.type === 'student') props.onNodeClick(node);
    },
    [nodesById, setFocus, props],
  );

  return (
    <Box pos="relative">
      {/* панель управления поверх canvas */}
      <Box pos="absolute" top={12} left={12} style={{ zIndex: 5, display: 'flex', gap: 8 }}>
        <Select
          placeholder="Найти ученика, класс, модуль…"
          data={searchData}
          searchable
          clearable
          leftSection={<IconSearch size={15} />}
          onChange={handleSearch}
          w={280}
          size="sm"
          radius="md"
          styles={{ input: { backgroundColor: 'rgba(15, 23, 42, 0.85)', color: '#e2e8f0', borderColor: '#334155' } }}
        />
        {props.scenario.length > 0 && (
          <Button
            size="sm"
            radius="md"
            variant="gradient"
            gradient={{ from: '#2263eb', to: '#7c3aed', deg: 135 }}
            leftSection={playing ? <IconPlayerStop size={15} /> : <IconPlayerPlay size={15} />}
            onClick={playing ? stopScenario : startScenario}
          >
            {playing ? 'Стоп' : 'Как это работает'}
          </Button>
        )}
        <Box
          px={10}
          py={6}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid #334155',
            borderRadius: 8,
          }}
        >
          <Box
            w={8}
            h={8}
            style={{ borderRadius: '50%', backgroundColor: '#34d399', boxShadow: '0 0 8px #34d399' }}
          />
          <Text size="xs" c="#94e2c0" fw={600}>
            live
          </Text>
        </Box>
      </Box>

      {/* лента живых событий ядра */}
      {ticker.length > 0 && !playing && (
        <Box pos="absolute" bottom={14} left={14} style={{ zIndex: 5, maxWidth: 420 }}>
          {ticker.map((t, i) => (
            <Paper
              key={t.id}
              px="sm"
              py={5}
              radius="md"
              mb={4}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(51, 65, 85, 0.8)',
                opacity: 1 - i * 0.22,
              }}
            >
              <Text size="xs" c="#cbd5e1">
                {t.caption}
              </Text>
            </Paper>
          ))}
        </Box>
      )}

      {/* каптион сценария */}
      {caption && (
        <Paper
          pos="absolute"
          bottom={20}
          left="50%"
          px="lg"
          py="sm"
          radius="xl"
          style={{
            zIndex: 5,
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(125, 211, 252, 0.4)',
            maxWidth: '80%',
          }}
        >
          <Text c="#e0f2fe" size="md" fw={500} ta="center">
            {caption}
          </Text>
        </Paper>
      )}

      <ForceGraph2D
        ref={fgRef}
        width={props.width}
        height={props.height}
        graphData={{ nodes: props.nodes, links: props.links }}
        backgroundColor="rgba(0,0,0,0)"
        autoPauseRedraw={false}
        nodeVal={(n) => (n as GraphNode).val}
        nodeLabel={(n) => {
          const node = n as GraphNode;
          return `${TYPE_LABELS[node.type]}: ${node.label}${node.meta ? ` — ${node.meta}` : ''}`;
        }}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={drawNode}
        linkColor={(l) => {
          const focus = focusRef.current;
          if (!focus.nodeId) return 'rgba(124, 140, 184, 0.22)';
          const link = l as LinkObject;
          const touches = endpointId(link.source!) === focus.nodeId || endpointId(link.target!) === focus.nodeId;
          return touches ? 'rgba(125, 211, 252, 0.85)' : 'rgba(124, 140, 184, 0.06)';
        }}
        linkWidth={(l) => {
          const focus = focusRef.current;
          if (!focus.nodeId) return 0.6;
          const link = l as LinkObject;
          const touches = endpointId(link.source!) === focus.nodeId || endpointId(link.target!) === focus.nodeId;
          return touches ? 1.8 : 0.3;
        }}
        linkDirectionalParticleWidth={3.4}
        linkDirectionalParticleColor={(l) => {
          const t = (l as LinkObject).target;
          const type = typeof t === 'object' ? (t as GraphNode).type : 'student';
          return TYPE_COLORS[type] ?? '#7dd3fc';
        }}
        linkDirectionalParticleSpeed={0.012}
        onNodeClick={(n) => {
          const node = n as GraphNode;
          setFocus(node.id);
          props.onNodeClick(node);
        }}
        onNodeHover={(n) => {
          // ховер подсвечивает, но не сбрасывает клик-фокус
          if (n) setFocus(String((n as GraphNode).id));
        }}
        onBackgroundClick={() => setFocus(null)}
        onRenderFramePost={drawOverlays}
        cooldownTicks={250}
        d3VelocityDecay={0.22}
      />
    </Box>
  );
}
