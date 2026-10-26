"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div
      className={cn(
        "markdown-body space-y-3 text-[15px] leading-relaxed break-words",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold tracking-tight text-ink dark:text-zinc-50">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold tracking-tight text-ink dark:text-zinc-50">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-ink dark:text-zinc-50">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="whitespace-pre-wrap text-ink dark:text-zinc-100">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink dark:text-zinc-50">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5 text-ink dark:text-zinc-100">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5 text-ink dark:text-zinc-100">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-slate underline underline-offset-2 dark:text-gold"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClass, children }) => {
            const isBlock = Boolean(codeClass);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-xl bg-zinc-100 p-3 font-mono text-[13px] text-ink dark:bg-zinc-900 dark:text-zinc-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] text-ink dark:bg-zinc-800 dark:text-zinc-100">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-xl bg-zinc-100 p-0 dark:bg-zinc-900">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gold/70 pl-3 text-ink/80 dark:text-zinc-300">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-zinc-200 dark:border-zinc-700" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-left font-semibold dark:border-zinc-700 dark:bg-zinc-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-zinc-200 px-2 py-1 dark:border-zinc-700">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
