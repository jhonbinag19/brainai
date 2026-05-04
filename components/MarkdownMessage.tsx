"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-white mt-5 mb-3 pb-1.5 border-b border-zinc-700 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-violet-300 mt-4 mb-2 tracking-tight flex items-center gap-2">
      <span className="w-1 h-4 rounded-full bg-violet-500 inline-block flex-shrink-0" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-zinc-200 mt-3 mb-1.5">{children}</h3>
  ),

  // Paragraph
  p: ({ children }) => (
    <p className="text-sm text-zinc-100 leading-7 mb-3 last:mb-0">{children}</p>
  ),

  // Bold & italic
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-violet-200">{children}</em>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="mb-3 space-y-1.5 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 space-y-1.5 pl-1 list-none counter-reset-[item]">{children}</ol>
  ),
  li: ({ children, ...props }) => {
    const isOrdered = (props as { ordered?: boolean }).ordered;
    return (
      <li className="flex items-start gap-2.5 text-sm text-zinc-200 leading-6">
        {isOrdered ? (
          <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 text-[10px] font-bold flex items-center justify-center">
            {/* number handled by CSS counters via parent */}
          </span>
        ) : (
          <span className="mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-violet-500" />
        )}
        <span>{children}</span>
      </li>
    );
  },

  // Code
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="block bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-xs text-emerald-300 font-mono leading-6 overflow-x-auto">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-zinc-800 text-emerald-300 font-mono text-[12px] px-1.5 py-0.5 rounded border border-zinc-700">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-3 last:mb-0 rounded-lg overflow-hidden">{children}</pre>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-violet-500 pl-4 my-3 text-zinc-400 italic text-sm">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => <hr className="border-zinc-700 my-4" />,

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-violet-400 underline underline-offset-2 decoration-violet-400/40 hover:decoration-violet-400 transition-colors font-medium"
    >
      {children}
    </a>
  ),

  // Table
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 rounded-lg border border-zinc-700">
      <table className="w-full text-sm text-zinc-200">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-800 text-zinc-300 text-xs uppercase tracking-wider">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-t border-zinc-700">{children}</td>
  ),
};

interface Props {
  content: string;
}

export default function MarkdownMessage({ content }: Props) {
  return (
    <div className="min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
