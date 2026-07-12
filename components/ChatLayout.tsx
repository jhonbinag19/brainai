"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/router";
import ChatWindow from "./ChatWindow";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { Brain } from "@/lib/types";

const NUNO_SLUG = "nuno-gohighlevel";
const DISPLAY_NAME = "Nuno's Brain";

export default function ChatLayout() {
  const router = useRouter();
  const [brain, setBrain] = useState<Brain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brains")
      .then((r) => r.json())
      .then((data) => {
        const list: Brain[] = Array.isArray(data) ? data : (data.brains ?? []);
        const nuno = list.find((b) => b.slug === NUNO_SLUG) ?? list[0] ?? null;
        if (nuno) setBrain({ ...nuno, name: DISPLAY_NAME });
        else setError("Brain not found.");
      })
      .catch((e) => setError(e.message));

    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setUserEmail(data.session?.user?.email ?? null));
  }, []);

  async function handleLogout() {
    await getSupabaseClient().auth.signOut();
    router.replace("/login");
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-rose-900/40 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-sm text-rose-400 font-medium">Connection failed</p>
          <p className="text-xs text-zinc-500 max-w-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!brain) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Connecting…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <aside className="flex flex-col items-center w-14 bg-zinc-900 border-r border-zinc-800 py-4 gap-4">
        {/* Logo */}
        <div
          className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/30"
          title="Nuno AI"
        >
          <span className="text-white text-xs font-bold">N</span>
        </div>

        {/* Active brain */}
        <div className="p-2 rounded-lg bg-violet-600/20 text-violet-400" title={brain.name}>
          <BrainCircuit className="w-4 h-4" />
        </div>

        <div className="flex-1" />

        {/* Video count */}
        {brain.total_videos !== undefined && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-semibold text-zinc-300">{brain.total_videos}</span>
            <span className="text-[9px] text-zinc-600 leading-none">vids</span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={userEmail ? `Sign out (${userEmail})` : "Sign out"}
          className="p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </aside>

      <ChatWindow brain={brain} />
    </div>
  );
}
