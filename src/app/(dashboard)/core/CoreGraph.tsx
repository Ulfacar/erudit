'use client';

import { useEffect, useRef } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';

/**
 * Клиентский рендер графа ядра (canvas). Вынесен из page.tsx, чтобы
 * page мог сделать dynamic(ssr:false), а мы здесь свободно работали с ref
 * и настраивали физику d3 (next/dynamic не пробрасывает ref).
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

export const TYPE_COLORS: Record<GraphNode['type'], string> = {
  school: '#2263eb',
  domain: '#7c3aed',
  class: '#0ea5e9',
  teacher: '#f59e0b',
  student: '#10b981',
  parent: '#ec4899',
};

export const TYPE_LABELS: Record<GraphNode['type'], string> = {
  school: 'Ядро',
  domain: 'Модуль',
  class: 'Класс',
  teacher: 'Педагог',
  student: 'Ученик',
  parent: 'Родитель',
};

/** Желаемая длина связи в зависимости от типов узлов на концах. */
function linkDistance(link: { source: GraphNode | string; target: GraphNode | string }): number {
  const s = typeof link.source === 'object' ? link.source.type : null;
  const t = typeof link.target === 'object' ? link.target.type : null;
  if (s === 'school' && t === 'domain') return 170;
  if (s === 'school' && t === 'class') return 320;
  if (t === 'student') return 30;
  if (s === 'domain' && t === 'teacher') return 90;
  if (s === 'teacher' || t === 'teacher') return 110;
  return 120;
}

export default function CoreGraph(props: {
  width: number;
  height: number;
  nodes: GraphNode[];
  links: GraphLinkRaw[];
  onNodeClick: (node: GraphNode) => void;
}) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  // настраиваем силы после монтирования: разводим домены/классы от ядра
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const linkForce = fg.d3Force('link') as { distance?: (fn: (l: never) => number) => void } | undefined;
    linkForce?.distance?.(linkDistance as never);
    const charge = fg.d3Force('charge') as { strength?: (n: number) => void } | undefined;
    charge?.strength?.(-90);
    fg.d3ReheatSimulation();
  }, [props.nodes.length]);

  return (
    <ForceGraph2D
      ref={fgRef}
      width={props.width}
      height={props.height}
      graphData={{ nodes: props.nodes, links: props.links }}
      backgroundColor="#0b1220"
      nodeVal={(n) => (n as GraphNode).val}
      nodeColor={(n) => TYPE_COLORS[(n as GraphNode).type] ?? '#94a3b8'}
      nodeLabel={(n) => {
        const node = n as GraphNode;
        return `${TYPE_LABELS[node.type]}: ${node.label}${node.meta ? ` — ${node.meta}` : ''}`;
      }}
      linkColor={() => 'rgba(124, 140, 184, 0.25)'}
      linkWidth={0.6}
      nodeCanvasObjectMode={() => 'after'}
      nodeCanvasObject={(n, ctx, globalScale) => {
        const node = n as GraphNode;
        // подписи — ядру, доменам и классам (остальным при сильном зуме)
        if (node.type === 'student' || node.type === 'teacher') {
          if (globalScale < 2.2) return;
        }
        const fontSize = node.type === 'school' ? 16 / globalScale : 11.5 / globalScale;
        ctx.font = `${node.type === 'school' || node.type === 'domain' ? '600' : '400'} ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
        const r = Math.sqrt(node.val) * 4;
        ctx.fillText(node.label, node.x ?? 0, (node.y ?? 0) + r + 2 / globalScale);
      }}
      onNodeClick={(n) => props.onNodeClick(n as GraphNode)}
      cooldownTicks={250}
      d3VelocityDecay={0.22}
    />
  );
}
