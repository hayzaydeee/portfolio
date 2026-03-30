"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Variant = "workshop" | "life-log";

type AskTerminalProps = {
  defaultQuery?: string;
  variant?: Variant;
  className?: string;
};

// ── Follow-up parser ───────────────────────────────────────────────────────────

function parseFollowUps(text: string): { body: string; followUps: string[] } {
  const lines = text.split("\n");
  const followUps: string[] = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("> ")) {
      followUps.push(trimmed.slice(2).trim());
    } else {
      bodyLines.push(line);
    }
  }

  return {
    body: bodyLines.join("\n").trimEnd(),
    followUps,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AskTerminal({
  defaultQuery = "what's the most interesting part of this?",
  variant = "workshop",
  className,
}: AskTerminalProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [output, setOutput] = useState("");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current && isStreaming) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, isStreaming]);

  const run = useCallback(
    async (q: string) => {
      if (isStreaming) {
        abortRef.current?.abort();
        return;
      }

      const trimmed = q.trim();
      if (!trimmed) return;

      setIsOpen(true);
      setIsStreaming(true);
      setOutput("");
      setFollowUps([]);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/workshop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, variant }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? `HTTP ${res.status}`
          );
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("no response stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            const payload = part.slice(6).trim();

            if (payload === "[DONE]") break;

            try {
              const parsed = JSON.parse(payload) as {
                text?: string;
                error?: string;
              };

              if (parsed.error) {
                throw new Error(parsed.error);
              }

              if (parsed.text) {
                accumulated += parsed.text;
                setOutput(accumulated);
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

        // Parse follow-ups from completed output
        const { body, followUps: suggestions } = parseFollowUps(accumulated);
        setOutput(body);
        setFollowUps(suggestions);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "something went wrong");
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, variant]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run(query);
    }
    if (e.key === "Escape" && isOpen) {
      setIsOpen(false);
    }
  }

  function handleFollowUp(suggestion: string) {
    setQuery(suggestion);
    run(suggestion);
  }

  const isLifeLog = variant === "life-log";
  const promptSymbol = isLifeLog ? "~" : "$";
  const accentClass = isLifeLog
    ? "text-(--workshop-syntax-dim)"
    : "text-(--workshop-syntax)";

  return (
    <div className={className}>
      {/* Input row */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-xs border border-(--workshop-tree-border) bg-(--workshop-base) group focus-within:border-(--workshop-syntax)"
        style={{ transition: "border-color 0.15s" }}
      >
        <span className={`shrink-0 select-none ${accentClass}`}>
          {promptSymbol} ask(
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          spellCheck={false}
          className="flex-1 bg-transparent outline-none min-w-0 text-(--workshop-text)"
          placeholder={defaultQuery}
          aria-label="ask a question about this project"
          disabled={isStreaming}
        />
        <span className={`shrink-0 select-none ${accentClass}`}>)</span>
        <button
          type="button"
          onClick={() => run(query)}
          disabled={isStreaming || !query.trim()}
          className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono transition-opacity ${
            isStreaming || !query.trim() ? "opacity-30 cursor-not-allowed" : "opacity-70 hover:opacity-100"
          } ${accentClass}`}
          aria-label={isStreaming ? "streaming…" : "run (⌘↵)"}
        >
          {isStreaming ? (
            <span className="animate-pulse">●</span>
          ) : (
            <>▶ run</>
          )}
        </button>
      </div>

      {/* Terminal panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="terminal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-lg border border-(--workshop-tree-border) bg-(--workshop-base) overflow-hidden"
            >
              {/* Terminal chrome */}
              <div
                className="flex items-center justify-between px-3 py-1.5 border-b border-(--workshop-tree-border)"
              >
                <span className="font-mono text-[10px] text-(--workshop-text-muted) select-none">
                  {isLifeLog ? ".debug/life.log › terminal" : "workshop › terminal"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="font-mono text-[10px] text-(--workshop-text-muted) hover:text-(--workshop-text) transition-colors"
                  aria-label="close terminal"
                >
                  ✕
                </button>
              </div>

              {/* Output */}
              <pre
                ref={outputRef}
                className={`p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto ${accentClass}`}
              >
                {error ? (
                  <span className="text-red-400/80">[ERROR] {error}</span>
                ) : output ? (
                  <>
                    {output}
                    {isStreaming && (
                      <span className="animate-pulse opacity-60">▋</span>
                    )}
                  </>
                ) : (
                  isStreaming && (
                    <span className="opacity-40 animate-pulse">
                      {promptSymbol} processing…
                    </span>
                  )
                )}
              </pre>

              {/* Follow-up suggestions */}
              {followUps.length > 0 && !isStreaming && (
                <div
                  className="px-4 pb-3 pt-1 border-t border-(--workshop-tree-border) flex flex-col gap-1"
                >
                  <span className="font-mono text-[10px] text-(--workshop-text-muted) mb-1 select-none">
                    // follow-up
                  </span>
                  {followUps.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleFollowUp(s)}
                      className={`text-left font-mono text-[11px] opacity-60 hover:opacity-100 transition-opacity hover:underline ${accentClass}`}
                    >
                      › {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
