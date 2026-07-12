"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2, BrainCircuit, User, AlertTriangle } from "lucide-react";
import SourceCard from "./SourceCard";
import MarkdownMessage from "./MarkdownMessage";
import type { Brain, ChatSource } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
}

interface Props {
  brain: Brain | null;
}

// Real SSE format: data: {"type":"sources"|"text"|"done", ...}
function parseSSELine(line: string): { text?: string; sources?: ChatSource[]; done?: boolean; error?: string } {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return {};
  const payload = trimmed.slice(5).trim();
  try {
    const parsed = JSON.parse(payload);
    if (parsed.type === "done") return { done: true };
    if (parsed.type === "sources") return { sources: parsed.sources };
    if (parsed.type === "text") return { text: parsed.text };
    if (parsed.type === "error") return { error: parsed.error ?? "Unknown error" };
    const text = parsed.text ?? parsed.delta ?? parsed.content ?? null;
    const sources = parsed.sources ?? null;
    return { text: text ?? undefined, sources: sources ?? undefined };
  } catch {
    return {};
  }
}

export default function ChatWindow({ brain }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [brain?.slug]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !brain) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, brain: brain.slug }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Request failed");
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: errText || "An error occurred.", error: true } : m)
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalSources: ChatSource[] | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const { text, sources, done: isDone, error } = parseSSELine(line);
          if (isDone) break;
          if (error) {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: error, error: true } : m)
            );
            return;
          }
          if (sources) finalSources = sources;
          if (text) {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: m.content + text } : m)
            );
          }
        }
      }

      // Flush any remaining line in buffer
      if (buffer.trim()) {
        const { text, sources } = parseSSELine(buffer);
        if (sources) finalSources = sources;
        if (text) {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + text } : m)
          );
        }
      }

      if (finalSources) {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, sources: finalSources } : m)
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Connection error. Please try again.", error: true }
            : m
        )
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, brain]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
        {brain ? (
          <>
            <div className="p-1.5 rounded-md bg-violet-600/20">
              <BrainCircuit className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{brain.name}</h2>
              <p className="text-[11px] text-zinc-500">
                {brain.total_videos !== undefined ? `${brain.total_videos} videos indexed` : "RAG knowledge base"}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Connecting…</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {isEmpty && brain && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="p-4 rounded-2xl bg-violet-600/10 border border-violet-600/20">
              <BrainCircuit className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Ask {brain.name}</h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                {brain.description || "Ask any question — answers come from real video transcripts, never hallucinated."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["What are the key concepts?", "Summarize the main topics", "What tools are covered?"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-full text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
              ${msg.role === "user" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>
              {msg.role === "user"
                ? <User className="w-3.5 h-3.5" />
                : <BrainCircuit className="w-3.5 h-3.5" />}
            </div>

            <div className={`flex flex-col ${msg.role === "user" ? "items-end max-w-[75%]" : "items-start w-full max-w-[85%]"}`}>
              {msg.role === "user" ? (
                // User bubble — plain pill
                <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-violet-600 text-white text-sm leading-relaxed">
                  {msg.content}
                </div>
              ) : msg.error ? (
                // Error bubble
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-rose-950/50 text-rose-300 border border-rose-800/50 text-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Error</span>
                  </div>
                  {msg.content}
                </div>
              ) : msg.content ? (
                // Assistant answer — rich markdown
                <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-zinc-800/60 border border-zinc-700/50 w-full">
                  <MarkdownMessage content={msg.content} />
                </div>
              ) : (
                // Thinking state
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-800/60 border border-zinc-700/50">
                  <span className="inline-flex gap-2 items-center text-zinc-400">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:300ms]" />
                    </span>
                    <span className="text-xs">Thinking…</span>
                  </span>
                </div>
              )}
              {msg.sources && <SourceCard sources={msg.sources} />}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-5 pt-3 border-t border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
        <div className="flex items-end gap-2 bg-zinc-800 rounded-2xl px-4 py-3 border border-zinc-700 focus-within:border-violet-600/60 transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={brain ? `Ask ${brain.name} anything…` : "Connecting…"}
            disabled={!brain || streaming}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 resize-none outline-none min-h-[24px] max-h-[120px] leading-6 disabled:opacity-40"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming || !brain}
            className="flex-shrink-0 p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {streaming
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 text-center mt-2">Shift+Enter for new line · Enter to send</p>
      </div>
    </div>
  );
}
