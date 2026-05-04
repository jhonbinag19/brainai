"use client";

import { ExternalLink, Play } from "lucide-react";
import type { ChatSource } from "@/lib/ybr-client";

interface Props {
  sources: ChatSource[];
}

export default function SourceCard({ sources }: Props) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Sources</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((src, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs border max-w-xs
              ${src.is_primary
                ? "bg-violet-950/40 border-violet-700/40 text-violet-300"
                : "bg-zinc-800/60 border-zinc-700/40 text-zinc-400"}`}
          >
            <Play className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{src.video_title || "Video"}</p>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] opacity-70">
                {src.channel_name && <span>{src.channel_name}</span>}
                {src.similarity !== undefined && (
                  <span>{Math.round(src.similarity * 100)}% match</span>
                )}
              </div>
            </div>
            {src.youtube_url && (
              <a
                href={src.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                title="Watch on YouTube"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
