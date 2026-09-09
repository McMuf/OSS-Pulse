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
  radius: number;
  repoCount: number; // contributor nodes only — >1 means a "bridge" across repos
  color: string;
};

type GraphLink = SimulationLinkDatum<GraphNode>;

const WIDTH = 720;
const HEIGHT = 520;
const REPO_HUE_STEP = 47; // spread hues apart for a handful of repo nodes

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

  data.repos.forEach((r, i) => {
    nodes.push({
      id: `repo:${r.repo}`,
      kind: "repo",
      label: shortRepoName(r.repo),
      radius: 22,
      repoCount: 0,
      color: `hsl(${(i * REPO_HUE_STEP) % 360}, 45%, 45%)`,
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
          radius: repoCount > 1 ? scaledRadius + 2 : scaledRadius,
          repoCount,
          color: repoCount > 1 ? "#3ecf8e" : "#5b6270",
        });
      }
      links.push({ source: `dev:${c.login}`, target: `repo:${r.repo}` });
    });
  });

  return { nodes, links };
}

export function ContributorGraph({ data }: { data: ContributorGraphData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const hoveredRef = useRef<GraphNode | null>(null);
  const draggingRef = useRef<GraphNode | null>(null);
  const [totalContributors, setTotalContributors] = useState(0);

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
    nodesRef.current = nodes;
    linksRef.current = links;
    setTotalContributors(nodes.filter((n) => n.kind === "contributor").length);

    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(50)
      )
      .force("charge", forceManyBody().strength(-40))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collide",
        forceCollide<GraphNode>((d) => d.radius + 3)
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
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const hovered = hoveredRef.current;
      const highlighted = hovered ? connectedNodeIds(hovered) : null;

      ctx.lineWidth = 1;
      links.forEach((l) => {
        const source = l.source as GraphNode;
        const target = l.target as GraphNode;
        if (typeof source.x !== "number" || typeof target.x !== "number") return;
        const dim = highlighted && !(highlighted.has(source.id) && highlighted.has(target.id));
        ctx.strokeStyle = dim ? "rgba(139,143,152,0.08)" : "rgba(139,143,152,0.35)";
        ctx.beginPath();
        ctx.moveTo(source.x, source.y!);
        ctx.lineTo(target.x, target.y!);
        ctx.stroke();
      });

      nodes.forEach((n) => {
        if (typeof n.x !== "number" || typeof n.y !== "number") return;
        const dim = highlighted && !highlighted.has(n.id);
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        if (n.kind === "repo") {
          ctx.strokeStyle = "#0a0b0d";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const showLabel = n.kind === "repo" || n.repoCount > 1 || hovered?.id === n.id;
        if (showLabel) {
          ctx.fillStyle = dim ? "rgba(232,233,236,0.3)" : "#e8e9ec";
          ctx.font = n.kind === "repo" ? "600 12px sans-serif" : "10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(n.label, n.x, n.y - n.radius - 4);
        }
      });
    }

    simulation.on("tick", draw);

    function toLocalCoords(e: MouseEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function nodeAt(x: number, y: number): GraphNode | null {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (typeof n.x !== "number" || typeof n.y !== "number") continue;
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy <= n.radius * n.radius) return n;
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

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="rounded-lg border border-border bg-background"
      />
      <p className="mt-2 text-xs text-foreground-muted">
        {totalContributors} contributors across {data.repos.length} repo
        {data.repos.length === 1 ? "" : "s"}. Green nodes contribute to more
        than one of this company&apos;s tracked repos. Drag nodes, hover to
        highlight connections — clustering is by shared repo, not verified
        real-world collaboration.
      </p>
    </div>
  );
}
