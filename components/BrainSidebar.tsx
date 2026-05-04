"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, ChevronRight, Loader2, Zap } from "lucide-react";
import type { Brain } from "@/lib/ybr-client";

interface Props {
  selectedBrain: Brain | null;
  onSelect: (brain: Brain) => void;
}

function qualityColor(score?: number) {
  if (score === undefined || score === null) return "bg-zinc-600";
  if (score >= 0.75) return "bg-emerald-500";
  if (score >= 0.5) return "bg-amber-400";
  return "bg-rose-500";
}

export default function BrainSidebar({ selectedBrain, onSelect }: Props) {
  const [brains, setBrains] = useState<Brain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brains")
      .then((r) => r.json())
      .then((data) => {
        // API may return array directly or wrapped in { brains: [] }
        const list: Brain[] = Array.isArray(data) ? data : data.brains ?? [];
        setBrains(list);
        if (list.length > 0 && !selectedBrain) onSelect(list[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside className="flex flex-col w-64 min-w-[15rem] bg-zinc-900 border-r border-zinc-800 h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-zinc-800">
        <div className="p-1.5 rounded-lg bg-violet-600">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white text-sm tracking-tight">YouTube Brain</span>
      </div>

      {/* Brain list */}
      <div className="flex-1 overflow-y-auto py-3">
        <p className="px-4 pb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Brains</p>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
          </div>
        )}

        {error && (
          <p className="px-4 py-3 text-xs text-rose-400">
            Could not load brains: {error}
          </p>
        )}

        {!loading && !error && brains.length === 0 && (
          <p className="px-4 py-3 text-xs text-zinc-500">No brains found.</p>
        )}

        {brains.map((brain) => {
          const active = selectedBrain?.slug === brain.slug;
          return (
            <button
              key={brain.slug}
              onClick={() => onSelect(brain)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group
                ${active ? "bg-violet-600/20 text-violet-300" : "hover:bg-zinc-800 text-zinc-300"}`}
            >
              <div className="p-1.5 rounded-md bg-zinc-800 group-hover:bg-zinc-700 flex-shrink-0">
                <BrainCircuit className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{brain.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {brain.total_videos !== undefined && (
                    <span className="text-[11px] text-zinc-500">{brain.total_videos} videos</span>
                  )}
                  {brain.avg_chunk_quality != null && (
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${qualityColor(brain.avg_chunk_quality)}`} />
                  )}
                </div>
              </div>
              {active && <ChevronRight className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <p className="text-[11px] text-zinc-600">Powered by YouTube Brain RAG</p>
      </div>
    </aside>
  );
}
