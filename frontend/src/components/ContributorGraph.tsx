"use client";

import { useEffect, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { ContributorGraphData } from "@/lib/types";

type GraphNode = SimulationNodeDatum & {
  id: string;
  kind: "repo" | "contributor";
  label: string;
  baseRadius: number;
  repoCount: number; // contributor nodes only — >1 means a "bridge" across repos
  color: string;
};

type GraphLink = SimulationLinkDatum<GraphNode>;

const WIDTH = 720;
const HEIGHT = 520;

const COLOR_REPO = "#e8e9ec";
const COLOR_BRIDGE = "#3ecf8e";
const COLOR_CONTRIBUTOR = "#8b95a3";
const COLOR_BACKGROUND = "#0a0b0d";

function shortRepoName(repo: string): string {
  return repo.split("/")[1] ?? repo;
}

function buildGraph(data: ContributorGraphData): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const contributorRepoCount = new Map<string, number>();

  data.repos.forEach((r) => {
    r.contributors.forEach((c) => {
      contributorRepoCount.set(c.login, (contributorRepoCount.get(c.login) ?? 0) + 1);
    });
  });

  data.repos.forEach((r) => {
    nodes.push({
      id: `repo:${r.repo}`,
      kind: "repo",
      label: shortRepoName(r.repo),
      baseRadius: 20,
      repoCount: 0,
      color: COLOR_REPO,
    });
  });

  const seenContributors = new Set<string>();
  data.repos.forEach((r) => {
    r.contributors.forEach((c) => {
      const repoCount = contributorRepoCount.get(c.login) ?? 1;
      if (!seenContributors.has(c.login)) {
        seenContributors.add(c.login);
        const scaledRadius = 3 + Math.min(6, Math.log10(c.contributions + 1) * 2);
        nodes.push({
          id: `dev:${c.login}`,
          kind: "contributor",
          label: c.login,
          baseRadius: repoCount > 1 ? scaledRadius + 2 : scaledRadius,
          repoCount,
          color: repoCount > 1 ? COLOR_BRIDGE : COLOR_CONTRIBUTOR,
        });
      }
      links.push({ source: `dev:${c.login}`, target: `repo:${r.repo}` });
    });
  });

  return { nodes, links };
}

// Force defaults chosen to look like Obsidian's out-of-the-box graph view —
// exposed as live sliders below rather than hardcoded, since "flesh out the
// mechanics" was the actual ask here.
const DEFAULTS = {
  nodeSize: 1,
  linkThickness: 1,
  showArrows: true,
  textFadeThreshold: 10,
  centerForce: 0.3,
  repelForce: 40,
  linkForce: 0.5,
  linkDistance: 50,
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-foreground-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1 accent-accent"
      />
    </label>
  );
}

export function ContributorGraph({ data }: { data: ContributorGraphData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const hoveredRef = useRef<GraphNode | null>(null);
  const draggingRef = useRef<GraphNode | null>(null);

  // Display params live in refs so the persistent draw loop always reads
  // the latest value without needing to rebuild the simulation.
  const displayRef = useRef({
    nodeSize: DEFAULTS.nodeSize,
    linkThickness: DEFAULTS.linkThickness,
    showArrows: DEFAULTS.showArrows,
    textFadeThreshold: DEFAULTS.textFadeThreshold,
    filter: "",
  });

  const [totalContributors, setTotalContributors] = useState(0);
  const [nodeSize, setNodeSize] = useState(DEFAULTS.nodeSize);
  const [linkThickness, setLinkThickness] = useState(DEFAULTS.linkThickness);
  const [showArrows, setShowArrows] = useState(DEFAULTS.showArrows);
  const [textFadeThreshold, setTextFadeThreshold] = useState(DEFAULTS.textFadeThreshold);
  const [filter, setFilter] = useState("");
  const [centerForce, setCenterForce] = useState(DEFAULTS.centerForce);
  const [repelForce, setRepelForce] = useState(DEFAULTS.repelForce);
  const [linkForce, setLinkForce] = useState(DEFAULTS.linkForce);
  const [linkDistance, setLinkDistance] = useState(DEFAULTS.linkDistance);

  // Keep refs in sync with display-only state, and redraw immediately —
  // these don't need physics to re-settle, just a repaint.
  useEffect(() => {
    displayRef.current = { nodeSize, linkThickness, showArrows, textFadeThreshold, filter };
    drawRef.current();
  }, [nodeSize, linkThickness, showArrows, textFadeThreshold, filter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;
    ctx.scale(dpr, dpr);

    const { nodes, links } = buildGraph(data);
    setTotalContributors(nodes.filter((n) => n.kind === "contributor").length);

    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(DEFAULTS.linkDistance)
          .strength(DEFAULTS.linkForce)
      )
      .force("charge", forceManyBody().strength(-DEFAULTS.repelForce))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2).strength(DEFAULTS.centerForce))
      .force(
        "collide",
        forceCollide<GraphNode>((d) => d.baseRadius + 3)
      );
    simulationRef.current = simulation;

    function connectedNodeIds(node: GraphNode): Set<string> {
      const ids = new Set<string>([node.id]);
      links.forEach((l) => {
        const source = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
        const target = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
        if (source === node.id) ids.add(target as string);
        if (target === node.id) ids.add(source as string);
      });
      return ids;
    }

    function draw() {
      if (!ctx) return;
      const { nodeSize, linkThickness, showArrows, textFadeThreshold, filter } =
        displayRef.current;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const hovered = hoveredRef.current;
      const highlighted = hovered ? connectedNodeIds(hovered) : null;
      const q = filter.trim().toLowerCase();
      const matchesFilter = (n: GraphNode) => !q || n.label.toLowerCase().includes(q);

      links.forEach((l) => {
        const source = l.source as GraphNode;
        const target = l.target as GraphNode;
        if (typeof source.x !== "number" || typeof target.x !== "number") return;
        const dim =
          (highlighted && !(highlighted.has(source.id) && highlighted.has(target.id))) ||
          (q && !(matchesFilter(source) && matchesFilter(target)));
        ctx.strokeStyle = dim ? "rgba(139,143,152,0.06)" : "rgba(139,143,152,0.4)";
        ctx.lineWidth = linkThickness;

        const dx = target.x! - source.x!;
        const dy = target.y! - source.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetRadius = target.baseRadius * nodeSize;
        const endX = target.x! - (dx / dist) * targetRadius;
        const endY = target.y! - (dy / dist) * targetRadius;

        ctx.beginPath();
        ctx.moveTo(source.x!, source.y!);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (showArrows && !dim) {
          const angle = Math.atan2(dy, dx);
          const arrowSize = 4 + linkThickness;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowSize * Math.cos(angle - Math.PI / 7),
            endY - arrowSize * Math.sin(angle - Math.PI / 7)
          );
          ctx.lineTo(
            endX - arrowSize * Math.cos(angle + Math.PI / 7),
            endY - arrowSize * Math.sin(angle + Math.PI / 7)
          );
          ctx.closePath();
          ctx.fillStyle = "rgba(139,143,152,0.5)";
          ctx.fill();
        }
      });

      nodes.forEach((n) => {
        if (typeof n.x !== "number" || typeof n.y !== "number") return;
        const radius = n.baseRadius * nodeSize;
        const dim = (highlighted && !highlighted.has(n.id)) || (q && !matchesFilter(n));
        ctx.globalAlpha = dim ? 0.2 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        if (n.kind === "repo") {
          ctx.strokeStyle = COLOR_BACKGROUND;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const showLabel =
          n.kind === "repo" || radius >= textFadeThreshold || hovered?.id === n.id;
        if (showLabel) {
          ctx.fillStyle = dim ? "rgba(232,233,236,0.25)" : "#e8e9ec";
          ctx.font = n.kind === "repo" ? "600 12px sans-serif" : "10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(n.label, n.x, n.y - radius - 4);
        }
      });
    }

    drawRef.current = draw;
    simulation.on("tick", draw);

    function toLocalCoords(e: MouseEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function nodeAt(x: number, y: number): GraphNode | null {
      const { nodeSize } = displayRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (typeof n.x !== "number" || typeof n.y !== "number") continue;
        const r = n.baseRadius * nodeSize;
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy <= r * r) return n;
      }
      return null;
    }

    function onMouseMove(e: MouseEvent) {
      const { x, y } = toLocalCoords(e);
      if (draggingRef.current) {
        draggingRef.current.fx = x;
        draggingRef.current.fy = y;
        simulation.alpha(0.3).restart();
        return;
      }
      const hit = nodeAt(x, y);
      if (hit !== hoveredRef.current) {
        hoveredRef.current = hit;
        canvas!.style.cursor = hit ? "pointer" : "default";
        draw();
      }
    }

    function onMouseDown(e: MouseEvent) {
      const { x, y } = toLocalCoords(e);
      const hit = nodeAt(x, y);
      if (hit) {
        draggingRef.current = hit;
        hit.fx = hit.x;
        hit.fy = hit.y;
      }
    }

    function onMouseUp() {
      if (draggingRef.current) {
        draggingRef.current.fx = null;
        draggingRef.current.fy = null;
        draggingRef.current = null;
        simulation.alphaTarget(0);
      }
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      simulation.stop();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [data]);

  // Force-affecting sliders reconfigure the live simulation and reheat it
  // so nodes visibly settle into the new layout, rather than snapping.
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    sim.force("charge", forceManyBody().strength(-repelForce));
    sim.alpha(0.5).restart();
  }, [repelForce]);

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    (sim.force("center") as ReturnType<typeof forceCenter>)?.strength(centerForce);
    sim.alpha(0.5).restart();
  }, [centerForce]);

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    const link = sim.force("link") as ReturnType<typeof forceLink<GraphNode, GraphLink>>;
    link?.strength(linkForce);
    sim.alpha(0.5).restart();
  }, [linkForce]);

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    const link = sim.force("link") as ReturnType<typeof forceLink<GraphNode, GraphLink>>;
    link?.distance(linkDistance);
    sim.alpha(0.5).restart();
  }, [linkDistance]);

  function animate() {
    simulationRef.current?.alpha(1).restart();
  }

  return (
    <div className="graph-panel flex gap-4 flex-wrap lg:flex-nowrap">
      <div>
        <canvas ref={canvasRef} className="rounded-sm border border-border bg-background" />
        <p className="mt-2 text-xs text-foreground-muted max-w-[720px]">
          {totalContributors} contributors across {data.repos.length} repo
          {data.repos.length === 1 ? "" : "s"}. Green nodes contribute to more
          than one of this company&apos;s tracked repos. Drag nodes, hover to
          highlight connections. Clustering is by shared repo, not verified
          real-world collaboration.
        </p>
      </div>

      <div className="w-full lg:w-56 shrink-0 rounded-sm border border-border bg-surface p-4 space-y-5">
        <div>
          <h3 className="text-xs font-medium text-foreground-muted uppercase tracking-wide mb-2">
            Filter
          </h3>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name…"
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <h3 className="text-xs font-medium text-foreground-muted uppercase tracking-wide mb-2">
            Groups
          </h3>
          <div className="space-y-1.5 text-xs text-foreground-muted">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLOR_REPO }}
              />
              Repos
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLOR_BRIDGE }}
              />
              Bridge contributors
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLOR_CONTRIBUTOR }}
              />
              Contributors
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-foreground-muted uppercase tracking-wide mb-2">
            Display
          </h3>
          <label className="flex items-center gap-2 text-xs text-foreground-muted mb-3">
            <input
              type="checkbox"
              checked={showArrows}
              onChange={(e) => setShowArrows(e.target.checked)}
              className="accent-accent"
            />
            Arrows
          </label>
          <div className="space-y-3">
            <Slider label="Node size" value={nodeSize} min={0.5} max={2.5} step={0.1} onChange={setNodeSize} />
            <Slider
              label="Link thickness"
              value={linkThickness}
              min={0.5}
              max={4}
              step={0.5}
              onChange={setLinkThickness}
            />
            <Slider
              label="Text fade threshold"
              value={textFadeThreshold}
              min={0}
              max={15}
              step={1}
              onChange={setTextFadeThreshold}
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-foreground-muted uppercase tracking-wide mb-2">
            Forces
          </h3>
          <div className="space-y-3">
            <Slider
              label="Center force"
              value={centerForce}
              min={0}
              max={1}
              step={0.05}
              onChange={setCenterForce}
            />
            <Slider
              label="Repel force"
              value={repelForce}
              min={0}
              max={150}
              step={5}
              onChange={setRepelForce}
            />
            <Slider
              label="Link force"
              value={linkForce}
              min={0}
              max={1}
              step={0.05}
              onChange={setLinkForce}
            />
            <Slider
              label="Link distance"
              value={linkDistance}
              min={10}
              max={150}
              step={5}
              onChange={setLinkDistance}
            />
          </div>
        </div>

        <button
          onClick={animate}
          className="w-full rounded bg-accent/20 text-accent text-sm py-1.5 hover:bg-accent/30 transition-colors"
        >
          Animate
        </button>
      </div>
    </div>
  );
}
