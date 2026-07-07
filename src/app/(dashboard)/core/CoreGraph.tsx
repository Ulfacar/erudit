'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Paper, Select, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconSearch } from '@tabler/icons-react';
import { forceCollide } from 'd3-force-3d';
import * as d3Force3d from 'd3-force-3d';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d';
import { CLUSTERS, ROLE_CLUSTER_TOTAL, getRoleCluster, getRoleLabel, getRoleMeta } from '@/shared/constants/role-clusters';
import { ROLE_INHERITS } from '@/shared/lib/role-access';
import type { AppRole } from '@/shared/constants/roles';

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
  type: 'school' | 'domain' | 'class' | 'teacher' | 'student' | 'parent' | 'hub' | 'role';
  val: number;
  count?: number;
  meta?: string;
  clusterId?: string;
  role?: AppRole;
  emoji?: string;
  color?: string;
  collapsedRoleCount?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLinkRaw {
  source: string;
  target: string;
  kind?: 'default' | 'core-hub' | 'hub-role' | 'inherit' | 'hub-domain';
  clusterId?: string;
  dist?: number;
  curve?: number;
}

export interface ScenarioStep {
  from: string;
  to: string;
  caption: string;
}

export const TYPE_COLORS: Record<GraphNode['type'], string> = {
  school: '#ffb454',
  hub: '#ffa94d',
  role: '#d6c0a8',
  domain: '#9775fa',
  class: '#22d3ee',
  teacher: '#fbbf24',
  student: '#34d399',
  parent: '#f472b6',
};

export const TYPE_LABELS: Record<GraphNode['type'], string> = {
  school: 'Ядро',
  hub: 'Кабинет',
  role: 'Роль',
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

interface ForcePosition<NodeDatum> {
  (alpha: number): void;
  initialize?: (nodes: NodeDatum[], ...args: unknown[]) => void;
  strength(strength: number | ((node: NodeDatum) => number)): ForcePosition<NodeDatum>;
}

const { forceX, forceY } = d3Force3d as unknown as {
  forceX: <NodeDatum = unknown>(x?: number | ((node: NodeDatum) => number)) => ForcePosition<NodeDatum>;
  forceY: <NodeDatum = unknown>(y?: number | ((node: NodeDatum) => number)) => ForcePosition<NodeDatum>;
};

const EVENT_COLORS: Record<string, string> = {
  'grade.created': '#ffd43b',
  'attendance.marked': '#51cf66',
  'invoice.overdue': '#ff922b',
  'psych.case.opened': '#b197fc',
  'admission.enrolled': '#38d9a9',
  'test.completed': '#74c0fc',
  'callcenter.promise': '#f783ac',
};

const AMBIENT_EVENT_TYPES = [
  'grade.created',
  'grade.created',
  'grade.created',
  'attendance.marked',
  'attendance.marked',
  'attendance.marked',
  'invoice.overdue',
  'psych.case.opened',
  'test.completed',
  'callcenter.promise',
  'admission.enrolled',
];

const AMBIENT_EVENT_ROUTES: Record<string, { hubId: string; domainId: string; parentChance: number }> = {
  'grade.created': { hubId: 'hub-pedagogi', domainId: 'd-journal', parentChance: 0.55 },
  'attendance.marked': { hubId: 'hub-pedagogi', domainId: 'd-journal', parentChance: 0.2 },
  'invoice.overdue': { hubId: 'hub-finansy', domainId: 'd-finance', parentChance: 0.65 },
  'psych.case.opened': { hubId: 'hub-psy', domainId: 'd-psych', parentChance: 0.25 },
  'test.completed': { hubId: 'hub-pedagogi', domainId: 'd-journal', parentChance: 0.35 },
  'admission.enrolled': { hubId: 'hub-spec', domainId: 'd-admission', parentChance: 0.15 },
  'callcenter.promise': { hubId: 'hub-finansy', domainId: 'd-callcenter', parentChance: 0.7 },
};

function linkDistance(link: { source: GraphNode | string; target: GraphNode | string; kind?: GraphLinkRaw['kind']; dist?: number }): number {
  if (link.kind === 'core-hub') return 240;
  if (link.kind === 'hub-role') {
    const sourceRole = typeof link.source === 'object' ? link.source.role : null;
    const targetRole = typeof link.target === 'object' ? link.target.role : null;
    return sourceRole === 'zavuch' || targetRole === 'zavuch' ? 38 : link.dist ?? 52;
  }
  if (link.kind === 'inherit') return 40;
  if (link.kind === 'hub-domain') return 200;
  const s = typeof link.source === 'object' ? link.source.type : null;
  const t = typeof link.target === 'object' ? link.target.type : null;
  if (s === 'school' && t === 'domain') return 190;
  if (s === 'school' && t === 'class') return 320;
  if (t === 'parent') return 36;
  if (t === 'student') return 30;
  if (s === 'domain' && t === 'teacher') return 90;
  if (s === 'teacher' || t === 'teacher') return 110;
  return 120;
}

function linkStrength(link: { source: GraphNode | string; target: GraphNode | string; kind?: GraphLinkRaw['kind'] }): number | undefined {
  if (link.kind === 'core-hub') return 0.05;
  if (link.kind === 'hub-role') {
    const sourceRole = typeof link.source === 'object' ? link.source.role : null;
    const targetRole = typeof link.target === 'object' ? link.target.role : null;
    return sourceRole === 'zavuch' || targetRole === 'zavuch' ? 0.5 : 0.45;
  }
  if (link.kind === 'inherit') return 0.2;
  if (link.kind === 'hub-domain') return 0.01;
  return undefined;
}

function defaultLinkStrength(
  link: { source: GraphNode | string; target: GraphNode | string },
  degreeByNodeId: Map<string, number>,
): number {
  const sourceDegree = degreeByNodeId.get(endpointId(link.source)) ?? 1;
  const targetDegree = degreeByNodeId.get(endpointId(link.target)) ?? 1;
  return 1 / Math.min(sourceDegree, targetDegree);
}

function endpointId(v: string | number | NodeObject): string {
  return typeof v === 'object' ? String(v.id) : String(v);
}

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHex(hex: string, factor: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized;
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(parseInt(value.slice(0, 2), 16) * factor)}${toHex(parseInt(value.slice(2, 4), 16) * factor)}${toHex(parseInt(value.slice(4, 6), 16) * factor)}`;
}

function randomCurve(min: number, max: number): number {
  const sign = Math.random() < 0.5 ? -1 : 1;
  return sign * (min + Math.random() * (max - min));
}

function randomItem<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function buildAmbientPulsePath(
  eventType: string,
  nodes: GraphNode[],
  nodesById: Map<string, GraphNode>,
  links: GraphLinkRaw[],
): GraphNode[] {
  const route = AMBIENT_EVENT_ROUTES[eventType];
  if (!route) return [];

  const studentsByClassId = new Map<string, string[]>();
  const parentsByStudentId = new Map<string, string[]>();

  for (const link of links) {
    const source = endpointId((link as unknown as { source: string | number | NodeObject }).source);
    const target = endpointId((link as unknown as { target: string | number | NodeObject }).target);
    const classId = source.startsWith('c-') ? source : target.startsWith('c-') ? target : null;
    const studentId = source.startsWith('s-') ? source : target.startsWith('s-') ? target : null;
    const parentId = source.startsWith('p-') ? source : target.startsWith('p-') ? target : null;

    if (classId && studentId) {
      const existing = studentsByClassId.get(classId) ?? [];
      existing.push(studentId);
      studentsByClassId.set(classId, existing);
    }
    if (studentId && parentId) {
      const existing = parentsByStudentId.get(studentId) ?? [];
      existing.push(parentId);
      parentsByStudentId.set(studentId, existing);
    }
  }

  const classNodes = nodes.filter((node) => node.id.startsWith('c-') && node.type === 'class');
  const classesWithStudents = classNodes.filter((node) => (studentsByClassId.get(node.id)?.length ?? 0) > 0);
  const classNode = randomItem(classesWithStudents.length ? classesWithStudents : classNodes);
  const studentId = classNode ? randomItem(studentsByClassId.get(classNode.id) ?? []) : null;
  const parentId = studentId && Math.random() < route.parentChance
    ? randomItem(parentsByStudentId.get(studentId) ?? [])
    : null;

  const pathIds = [
    route.hubId,
    route.domainId,
    'school',
    classNode?.id,
    studentId,
    parentId,
  ].filter((id): id is string => !!id && nodesById.has(id));

  return pathIds
    .filter((id, index) => index === 0 || id !== pathIds[index - 1])
    .map((id) => nodesById.get(id))
    .filter((node): node is GraphNode => !!node);
}

const HUB_DOMAIN_LINKS: Record<string, string[]> = {
  upravlenie: ['d-agent', 'd-knowledge', 'd-admission'],
  uchebka: ['d-journal'],
  pedagogi: ['d-people', 'd-journal'],
  finansy: ['d-finance', 'd-callcenter', 'd-contracts'],
  psy: ['d-psych', 'd-safeguard', 'd-specialists'],
  hoz: ['d-hr', 'd-library', 'd-kitchen', 'd-assets'],
  semya: ['d-journal'],
  spec: ['d-admission'],
};

export default function CoreGraph(props: {
  width: number;
  height: number;
  nodes: GraphNode[];
  links: GraphLinkRaw[];
  scenario: ScenarioStep[];
  usersByRole?: Partial<Record<AppRole, number>>;
  onNodeClick: (node: GraphNode) => void;
}) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  // подсветка читается из ref в каждом кадре — без ре-рендеров
  const focusRef = useRef<{ nodeId: string | null; neighbors: Set<string> }>({ nodeId: null, neighbors: new Set() });
  // состояние сценария (тоже per-frame)
  const scenarioRef = useRef<{ active: boolean; step: number; startedAt: number }>({ active: false, step: 0, startedAt: 0 });
  const [caption, setCaption] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const defaultExpandedHubIds = useMemo(
    () => new Set(ROLE_CLUSTER_TOTAL <= 32 ? CLUSTERS.map((cluster) => cluster.id) : []),
    [],
  );
  const [expandedHubs, setExpandedHubs] = useState<Set<string>>(defaultExpandedHubIds);
  // живые события ядра: очередь импульсов + лента
  const livePulsesRef = useRef<LivePulse[]>([]);
  const liveSinceRef = useRef<string>(new Date(Date.now() - 60_000).toISOString());
  const seenEventsRef = useRef<Set<string>>(new Set());
  const recentRealEventTypesRef = useRef<Map<string, number>>(new Map());
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = props.nodes.map((node) => (
      node.type === 'school'
        ? { ...node, ['f' + 'x']: 0, ['f' + 'y']: 0 } as GraphNode
        : { ...node }
    ));
    const links: GraphLinkRaw[] = props.links.map((link) => ({ ...link, kind: link.kind ?? 'default', curve: link.curve ?? 0 }));
    const existingNodeIds = new Set(nodes.map((node) => node.id));

    for (const cluster of CLUSTERS) {
      const azimuth = (cluster.azimuthDeg * Math.PI) / 180;
      const x = 230 * Math.cos(azimuth) + (Math.random() - 0.5) * 100;
      const y = -230 * Math.sin(azimuth) + (Math.random() - 0.5) * 100;
      const hubId = `hub-${cluster.id}`;
      const expanded = expandedHubs.has(cluster.id);
      nodes.push({
        id: hubId,
        label: cluster.shortLabel,
        type: 'hub',
        val: 13,
        clusterId: cluster.id,
        emoji: cluster.emoji,
        color: cluster.color,
        collapsedRoleCount: expanded ? undefined : cluster.roles.length,
        x,
        y,
        meta: cluster.label,
      });
      links.push({ source: 'school', target: hubId, kind: 'core-hub', clusterId: cluster.id, curve: randomCurve(0.12, 0.22) });

      for (const domainId of HUB_DOMAIN_LINKS[cluster.id] ?? []) {
        if (existingNodeIds.has(domainId)) {
          links.push({ source: hubId, target: domainId, kind: 'hub-domain', clusterId: cluster.id, curve: 0.1 });
        }
      }

      if (!expanded) continue;
      for (const item of cluster.roles) {
        const roleId = `role-${item.role}`;
        nodes.push({
          id: roleId,
          label: getRoleLabel(item.role),
          type: 'role',
          val: item.role === 'zavuch' ? 4.2 : 2.5,
          clusterId: cluster.id,
          role: item.role,
          emoji: item.emoji,
          color: item.color,
          count: props.usersByRole?.[item.role] ?? 0,
          meta: `${props.usersByRole?.[item.role] ?? 0} пользователей`,
          x: x + (Math.random() - 0.5) * 40,
          y: y + (Math.random() - 0.5) * 40,
        });
        links.push({
          source: roleId,
          target: hubId,
          kind: 'hub-role',
          clusterId: cluster.id,
          dist: 44 + Math.random() * 14,
          curve: randomCurve(0.2, 0.45),
        });
      }
    }

    for (const [child, parent] of Object.entries(ROLE_INHERITS) as Array<[AppRole, AppRole]>) {
      const childCluster = getRoleCluster(child);
      if (!expandedHubs.has(childCluster.id)) continue;
      links.push({ source: `role-${child}`, target: `role-${parent}`, kind: 'inherit', clusterId: childCluster.id, curve: 0.2 });
    }

    return { nodes, links };
  }, [expandedHubs, props.links, props.nodes, props.usersByRole]);

  const nodesById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    graphData.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graphData.nodes]);

  // ядро организма — для волн-сердцебиения
  const coreNode = useMemo(() => graphData.nodes.find((n) => n.type === 'school') ?? null, [graphData.nodes]);

  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    graphData.links.forEach((l) => {
      add(l.source, l.target);
      add(l.target, l.source);
    });
    return m;
  }, [graphData.links]);

  const setFocus = useCallback(
    (nodeId: string | null) => {
      focusRef.current = {
        nodeId,
        neighbors: nodeId ? new Set([nodeId, ...(adjacency.get(nodeId) ?? [])]) : new Set(),
      };
    },
    [adjacency],
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const syncVisibility = () => {
      const fg = fgRef.current;
      if (!fg) return;
      if (document.hidden) fg.pauseAnimation();
      else fg.resumeAnimation();
    };
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  // физика: живой организм вместо прибитой орбиты
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const linkForce = fg.d3Force('link') as {
      distance?: (fn: (l: GraphLinkRaw & { source: GraphNode | string; target: GraphNode | string }) => number) => void;
      strength?: (fn: (l: GraphLinkRaw & { source: GraphNode | string; target: GraphNode | string }) => number | undefined) => void;
    } | undefined;
    linkForce?.distance?.(linkDistance);
    const degreeByNodeId = new Map<string, number>();
    for (const link of graphData.links) {
      degreeByNodeId.set(link.source, (degreeByNodeId.get(link.source) ?? 0) + 1);
      degreeByNodeId.set(link.target, (degreeByNodeId.get(link.target) ?? 0) + 1);
    }
    linkForce?.strength?.((link) => linkStrength(link) ?? defaultLinkStrength(link, degreeByNodeId));

    const charge = fg.d3Force('charge') as {
      strength?: (fn: (n: GraphNode) => number) => void;
      distanceMax?: (distance: number) => void;
    } | undefined;
    charge?.strength?.((n: GraphNode) =>
      n.type === 'hub' ? -480
        : n.type === 'school' ? -500
          : n.type === 'class' ? -160
            : n.type === 'domain' ? -140
              : n.type === 'role' ? -45
                : n.type === 'teacher' ? -40
                  : -15);
    charge?.distanceMax?.(600);

    const collideForce = forceCollide<GraphNode>()
      .radius((n) =>
        n.type === 'hub' ? 32
          : n.type === 'school' ? 36
            : n.type === 'role' ? 9
              : n.type === 'domain' ? Math.sqrt(n.val) * 3.2 + 5
                : Math.sqrt(n.val) * 3.2 + 2)
      .strength(0.9)
      .iterations(2);
    fg.d3Force('collide', collideForce as never);

    const hubTargets = new Map(
      CLUSTERS.map((cluster) => {
        const azimuth = (cluster.azimuthDeg * Math.PI) / 180;
        return [`hub-${cluster.id}`, { x: 250 * Math.cos(azimuth), y: -250 * Math.sin(azimuth) }];
      }),
    );
    fg.d3Force(
      'hubAnchorX',
      forceX<GraphNode>((node) => hubTargets.get(node.id)?.x ?? node.x ?? 0)
        .strength((node) => (node.type === 'hub' ? 0.045 : 0)) as never,
    );
    fg.d3Force(
      'hubAnchorY',
      forceY<GraphNode>((node) => hubTargets.get(node.id)?.y ?? node.y ?? 0)
        .strength((node) => (node.type === 'hub' ? 0.045 : 0)) as never,
    );

    const roleNodes = graphData.nodes.filter((node) => node.type === 'role');
    const hubById = new Map(graphData.nodes.filter((node) => node.type === 'hub').map((node) => [node.clusterId, node]));
    const clusterForce = Object.assign(
      (alpha: number) => {
        const k = 0.18;
        for (const node of roleNodes) {
          const hub = hubById.get(node.clusterId);
          if (!hub || node.x == null || node.y == null || hub.x == null || hub.y == null) continue;
          node.vx = (node.vx ?? 0) + (hub.x - node.x) * k * alpha;
          node.vy = (node.vy ?? 0) + (hub.y - node.y) * k * alpha;
        }
      },
      { initialize: () => {} },
    );
    fg.d3Force('cluster', clusterForce);
    (fg as unknown as { d3AlphaTarget?: (alpha: number) => void }).d3AlphaTarget?.(reducedMotion ? 0 : 0.02);
    fg.d3ReheatSimulation();
  }, [graphData.links, graphData.nodes, reducedMotion]);

  useEffect(() => {
    fgRef.current?.d3ReheatSimulation();
  }, [expandedHubs]);

  // фоновые импульсы: ядро «дышит» данными
  useEffect(() => {
    const t = setInterval(() => {
      const fg = fgRef.current;
      if (!fg || document.hidden) return;
      for (let i = 0; i < 2; i++) {
        const link = graphData.links[Math.floor(Math.random() * graphData.links.length)];
        if (link) fg.emitParticle(link as unknown as LinkObject);
      }
    }, 420);
    return () => clearInterval(t);
  }, [graphData.links]);

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
          recentRealEventTypesRef.current.set(ev.type, performance.now());
          const nodes = ev.path.map((id) => nodesById.get(id)).filter((n): n is GraphNode => !!n);
          if (nodes.length >= 2) {
            livePulsesRef.current.push({
              path: nodes,
              startedAt: performance.now(),
              color: EVENT_COLORS[ev.type] ?? '#ffa94d',
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

  useEffect(() => {
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const minDelay = reducedMotion ? 9000 : 2200;
    const maxDelay = reducedMotion ? 14000 : 3200;

    function schedule() {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      timeout = setTimeout(tick, delay);
    }

    function tick() {
      if (disposed) return;
      if (!document.hidden) {
        const type = randomItem(AMBIENT_EVENT_TYPES);
        const now = performance.now();
        const recentRealAt = type ? recentRealEventTypesRef.current.get(type) : null;
        if (type && (!recentRealAt || now - recentRealAt > 3500)) {
          const path = buildAmbientPulsePath(type, graphData.nodes, nodesById, graphData.links);
          if (path.length >= 2) {
            livePulsesRef.current.push({
              path,
              startedAt: now,
              color: EVENT_COLORS[type] ?? '#ffa94d',
            });
          }
        }
      }
      schedule();
    }

    schedule();
    return () => {
      disposed = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [graphData.links, graphData.nodes, nodesById, reducedMotion]);

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

      if (node.type === 'hub') {
        const cluster = CLUSTERS.find((c) => c.id === node.clusterId);
        const clusterIndex = CLUSTERS.findIndex((c) => c.id === node.clusterId);
        const collapsed = typeof node.collapsedRoleCount === 'number';
        const phase = clusterIndex >= 0 ? clusterIndex * 0.73 : 0;
        const breath = Math.sin(performance.now() / 560 + phase);
        r = 11.5 * (1 + 0.03 * breath);
        const cx = node.x ?? 0;
        const cy = node.y ?? 0;
        const clusterColor = cluster?.color ?? node.color ?? '#ffa94d';

        ctx.shadowColor = clusterColor;
        ctx.shadowBlur = collapsed ? 25 + 5 * breath : 20;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.35, clusterColor);
        grad.addColorStop(1, darkenHex(clusterColor, 0.75));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.9, 0, 2 * Math.PI);
        ctx.strokeStyle = colorWithAlpha(clusterColor, 0.1);
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();

        if (collapsed) {
          const badgeX = cx + r * 0.82;
          const badgeY = cy - r * 0.82;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 5.5, 0, 2 * Math.PI);
          ctx.fillStyle = clusterColor;
          ctx.fill();
          ctx.font = `700 ${6.5 / globalScale}px Inter, sans-serif`;
          ctx.fillStyle = '#241512';
          ctx.fillText(String(node.collapsedRoleCount), badgeX, badgeY + 0.2 / globalScale);
        }

        if (globalScale > 0.55 && !dimmed) {
          const label = `${node.emoji ?? cluster?.emoji ?? ''} ${node.label}`.trim();
          ctx.font = `600 ${11 / globalScale}px Inter, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const metrics = ctx.measureText(label);
          const labelX = cx;
          const labelY = cy + r + 10 / globalScale;
          const padX = 6 / globalScale;
          const padY = 3 / globalScale;
          const pillW = metrics.width + padX * 2;
          const pillH = 15 / globalScale + padY * 2;
          const pillR = 6 / globalScale;
          const left = labelX - pillW / 2;
          const top = labelY - pillH / 2;
          ctx.beginPath();
          ctx.moveTo(left + pillR, top);
          ctx.lineTo(left + pillW - pillR, top);
          ctx.quadraticCurveTo(left + pillW, top, left + pillW, top + pillR);
          ctx.lineTo(left + pillW, top + pillH - pillR);
          ctx.quadraticCurveTo(left + pillW, top + pillH, left + pillW - pillR, top + pillH);
          ctx.lineTo(left + pillR, top + pillH);
          ctx.quadraticCurveTo(left, top + pillH, left, top + pillH - pillR);
          ctx.lineTo(left, top + pillR);
          ctx.quadraticCurveTo(left, top, left + pillR, top);
          ctx.closePath();
          ctx.fillStyle = 'rgba(18, 12, 16, 0.6)';
          ctx.fill();
          ctx.fillStyle = '#f7efe4';
          ctx.fillText(label, labelX, labelY + 0.5 / globalScale);
        }
        ctx.restore();
        return;
      }

      if (node.type === 'role') {
        const cluster = CLUSTERS.find((c) => c.id === node.clusterId);
        const roleColor = cluster?.color ?? node.color ?? (node.role ? getRoleMeta(node.role).color : '#d6c0a8');
        const cx = node.x ?? 0;
        const cy = node.y ?? 0;
        const isZavuch = node.role === 'zavuch';
        r = isZavuch ? 6.5 : 5;

        ctx.shadowColor = roleColor;
        ctx.shadowBlur = isFocus ? 18 : 8;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.35, roleColor);
        grad.addColorStop(1, darkenHex(roleColor, 0.75));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (isZavuch) {
          ctx.beginPath();
          ctx.arc(cx, cy, r + 2.5 / globalScale, 0, 2 * Math.PI);
          ctx.strokeStyle = colorWithAlpha(roleColor, 0.4);
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
        }

        const showLabel = globalScale > 1.8 || isFocus || focus.neighbors.has(node.id);
        if (showLabel && !dimmed) {
          ctx.font = `500 ${10 / globalScale}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#b7a795';
          ctx.fillText(node.label, cx, cy + r + 4 / globalScale);
        }
        ctx.restore();
        return;
      }

      // свечение — только у крупных узлов и в фокусе (canvas shadow дорогой)
      if (node.type === 'school' || node.type === 'domain' || node.type === 'class' || isFocus) {
        ctx.shadowColor = color;
        ctx.shadowBlur = isFocus ? 26 : node.type === 'school' ? 30 : 12;
      }
      // светящаяся сфера: блик смещён вверх-влево, как у освещённого шара
      const cx = node.x ?? 0;
      const cy = node.y ?? 0;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      if (node.type === 'school') {
        grad.addColorStop(0, '#fff7e6');
        grad.addColorStop(0.46, '#ffb454');
        grad.addColorStop(1, '#ff8f3d');
      } else {
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.42, color);
        grad.addColorStop(1, color);
      }
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
        ctx.fillStyle = node.type === 'school' || node.type === 'domain' ? '#f7efe4' : 'rgba(226, 232, 240, 0.95)';
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
      ctx.strokeStyle = 'rgba(255, 169, 77, 0.5)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // хвост импульса
      for (let i = 4; i >= 1; i--) {
        const tp = Math.max(p - i * 0.045, 0);
        const tx = (from.x ?? 0) + ((to.x ?? 0) - (from.x ?? 0)) * tp;
        const ty = (from.y ?? 0) + ((to.y ?? 0) - (from.y ?? 0)) * tp;
        ctx.beginPath();
        ctx.arc(tx, ty, 2.6 - i * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 216, 168, ${0.5 - i * 0.1})`;
        ctx.fill();
      }
      // сам импульс
      ctx.shadowColor = '#ffa94d';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffd8a8';
      ctx.fill();
      ctx.shadowBlur = 0;

      // вспышка на целевом узле в конце шага
      if (p >= 1) {
        const flash = 1 - Math.min((performance.now() - sc.startedAt - STEP_MS * 0.72) / (STEP_MS * 0.28), 1);
        ctx.beginPath();
        ctx.arc(to.x ?? 0, to.y ?? 0, Math.sqrt(to.val) * 3.2 + 7 * (1 - flash), 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255, 169, 77, ${0.8 * flash})`;
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
        ctx.strokeStyle = `rgba(255, 169, 77, ${alpha})`;
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
    () => {
      const visible = graphData.nodes.map((n) => ({
        value: n.id,
        label: `${n.label} · ${TYPE_LABELS[n.type]}`,
      }));
      const visibleIds = new Set(visible.map((item) => item.value));
      const roleItems = CLUSTERS.flatMap((cluster) =>
        cluster.roles.map((item) => ({
          value: `role-${item.role}`,
          label: `${getRoleLabel(item.role)} · Роль · ${cluster.shortLabel}`,
        })),
      ).filter((item) => !visibleIds.has(item.value));
      return [...visible, ...roleItems];
    },
    [graphData.nodes],
  );

  useEffect(() => {
    if (!pendingFocusId) return;
    const node = nodesById.get(pendingFocusId);
    const fg = fgRef.current;
    if (!node || !fg) return;
    setFocus(pendingFocusId);
    fg.centerAt(node.x ?? 0, node.y ?? 0, 800);
    fg.zoom(node.type === 'role' ? 2.7 : 3.4, 800);
    setPendingFocusId(null);
  }, [nodesById, pendingFocusId, setFocus]);

  const handleSearch = useCallback(
    (id: string | null) => {
      if (!id) return;
      const node = nodesById.get(id);
      const fg = fgRef.current;
      if (!node && id.startsWith('role-')) {
        const role = id.replace(/^role-/, '') as AppRole;
        const cluster = getRoleCluster(role);
        setExpandedHubs((prev) => new Set(prev).add(cluster.id));
        setPendingFocusId(id);
        return;
      }
      if (!node || !fg) return;
      if (node.type === 'role' && node.role) {
        setExpandedHubs((prev) => new Set(prev).add(getRoleCluster(node.role!).id));
      }
      setFocus(id);
      fg.centerAt(node.x ?? 0, node.y ?? 0, 800);
      fg.zoom(3.4, 800);
      // найденный ученик — сразу открываем карточку 360°
      if (node.type === 'student') props.onNodeClick(node);
    },
    [nodesById, setFocus, props],
  );

  const allRolesExpanded = expandedHubs.size === CLUSTERS.length;
  const toggleAllRoles = useCallback(() => {
    setExpandedHubs(allRolesExpanded ? new Set() : new Set(CLUSTERS.map((cluster) => cluster.id)));
  }, [allRolesExpanded]);
  const livePhysicsProps = useMemo(() => ({ d3AlphaTarget: reducedMotion ? 0 : 0.02 }), [reducedMotion]);

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
          styles={{ input: { backgroundColor: 'rgba(28, 20, 16, 0.82)', color: '#f7efe4', borderColor: 'rgba(255, 169, 77, 0.18)' } }}
        />
        <Button
          size="sm"
          radius="md"
          variant="light"
          onClick={toggleAllRoles}
          styles={{
            root: {
              backgroundColor: 'rgba(28, 20, 16, 0.82)',
              border: '1px solid rgba(255, 169, 77, 0.18)',
              color: '#f7efe4',
            },
          }}
        >
          Роли {allRolesExpanded ? '⌃' : '⌄'}
        </Button>
        {props.scenario.length > 0 && (
          <Button
            size="sm"
            radius="md"
            variant="gradient"
            gradient={{ from: '#f08c00', to: '#e8590c', deg: 135 }}
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
            backgroundColor: 'rgba(28, 20, 16, 0.82)',
            border: '1px solid rgba(255, 169, 77, 0.18)',
            borderRadius: 8,
          }}
        >
          <Box
            w={8}
            h={8}
            style={{ borderRadius: '50%', backgroundColor: '#51cf66', boxShadow: '0 0 8px #51cf66' }}
          />
          <Text size="xs" c="#d8f5a2" fw={600}>
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
                backgroundColor: 'rgba(28, 20, 16, 0.82)',
                border: '1px solid rgba(255, 169, 77, 0.18)',
                opacity: 1 - i * 0.22,
              }}
            >
              <Text size="xs" c="#f7efe4">
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
            backgroundColor: 'rgba(28, 20, 16, 0.92)',
            border: '1px solid rgba(255, 169, 77, 0.4)',
            maxWidth: '80%',
          }}
        >
          <Text c="#f7efe4" size="md" fw={500} ta="center">
            {caption}
          </Text>
        </Paper>
      )}

      <ForceGraph2D
        ref={fgRef}
        width={props.width}
        height={props.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        autoPauseRedraw={false}
        {...livePhysicsProps}
        nodeVal={(n) => (n as GraphNode).val}
        nodeLabel={(n) => {
          const node = n as GraphNode;
          return `${TYPE_LABELS[node.type]}: ${node.label}${node.meta ? ` — ${node.meta}` : ''}`;
        }}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={drawNode}
        linkColor={(l) => {
          const focus = focusRef.current;
          const link = l as LinkObject & GraphLinkRaw;
          const cluster = link.clusterId ? CLUSTERS.find((c) => c.id === link.clusterId) : undefined;
          const touches = endpointId(link.source!) === focus.nodeId || endpointId(link.target!) === focus.nodeId;
          if (link.kind === 'core-hub') {
            return colorWithAlpha(cluster?.color ?? '#ffa94d', focus.nodeId && !touches ? 0.1 : focus.nodeId ? 0.9 : 0.28);
          }
          if (link.kind === 'hub-role') return colorWithAlpha(cluster?.color ?? '#d6c0a8', focus.nodeId && !touches ? 0.05 : 0.22);
          if (link.kind === 'inherit') return focus.nodeId && !touches ? 'rgba(177, 151, 252, 0.08)' : 'rgba(177, 151, 252, 0.35)';
          if (link.kind === 'hub-domain') return focus.nodeId && touches ? 'rgba(214, 192, 168, 0.4)' : 'rgba(214, 192, 168, 0.08)';
          if (!focus.nodeId) return 'rgba(214, 192, 168, 0.16)';
          return touches ? 'rgba(255, 216, 168, 0.85)' : 'rgba(214, 192, 168, 0.06)';
        }}
        linkWidth={(l) => {
          const focus = focusRef.current;
          const link = l as LinkObject & GraphLinkRaw;
          const base = link.kind === 'core-hub' ? 1.4 : link.kind === 'inherit' ? 0.8 : link.kind === 'hub-role' ? 0.7 : 0.6;
          if (!focus.nodeId) return base;
          const touches = endpointId(link.source!) === focus.nodeId || endpointId(link.target!) === focus.nodeId;
          return touches ? Math.max(base, 1.8) : 0.3;
        }}
        linkLineDash={(l) => {
          const kind = (l as GraphLinkRaw).kind;
          if (kind === 'inherit') return [2, 4];
          if (kind === 'hub-domain') return [1, 4];
          return null;
        }}
        linkCurvature={(l) => (l as GraphLinkRaw).curve ?? 0}
        linkDirectionalParticles={(l) => {
          const link = l as LinkObject & GraphLinkRaw;
          if (link.kind === 'core-hub') return 2;
          if (link.kind === 'hub-role') {
            const focus = focusRef.current;
            const touches = endpointId(link.source!) === focus.nodeId || endpointId(link.target!) === focus.nodeId;
            return touches ? 1 : 0;
          }
          return 0;
        }}
        linkDirectionalParticleWidth={(l) => ((l as GraphLinkRaw).kind === 'hub-role' ? 1.8 : 3)}
        linkDirectionalParticleColor={(l) => {
          const link = l as LinkObject & GraphLinkRaw;
          if ((link.kind === 'core-hub' || link.kind === 'hub-role') && link.clusterId) {
            return CLUSTERS.find((cluster) => cluster.id === link.clusterId)?.color ?? '#ffa94d';
          }
          const t = link.target;
          const type = typeof t === 'object' ? (t as GraphNode).type : 'student';
          return TYPE_COLORS[type] ?? '#ffa94d';
        }}
        linkDirectionalParticleSpeed={(l) => ((l as GraphLinkRaw).kind === 'core-hub' ? 0.0035 : (l as GraphLinkRaw).kind === 'hub-role' ? 0.006 : 0.012)}
        onNodeClick={(n) => {
          const node = n as GraphNode;
          setFocus(node.id);
          if (node.type === 'hub' && node.clusterId) {
            const wasExpanded = expandedHubs.has(node.clusterId);
            if (!wasExpanded) {
              setExpandedHubs((prev) => new Set(prev).add(node.clusterId!));
            }
            fgRef.current?.centerAt(node.x ?? 0, node.y ?? 0, 600);
            fgRef.current?.zoom(wasExpanded ? 2 : 1.8, 600);
            return;
          }
          props.onNodeClick(node);
        }}
        onNodeHover={(n) => {
          // ховер подсвечивает, но не сбрасывает клик-фокус
          if (n) setFocus(String((n as GraphNode).id));
        }}
        onBackgroundClick={() => setFocus(null)}
        onRenderFramePost={drawOverlays}
        onNodeDragEnd={(n) => {
          const node = n as GraphNode;
          if (node.type !== 'school') {
            delete (node as unknown as Record<string, unknown>)['f' + 'x'];
            delete (node as unknown as Record<string, unknown>)['f' + 'y'];
          }
          (fgRef.current as unknown as { d3AlphaTarget?: (alpha: number) => void }).d3AlphaTarget?.(reducedMotion ? 0 : 0.02);
        }}
        cooldownTicks={Infinity}
        d3VelocityDecay={0.18}
        d3AlphaDecay={0.02}
      />
    </Box>
  );
}
