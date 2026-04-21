"use client";

// source_handbook: week11-hackathon-preparation

import { useState, useRef, useEffect, KeyboardEvent } from "react";

type BudgetLevel = "any" | "low" | "mid" | "luxury";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citiesRetrieved?: string[];
}

const SUGGESTED_QUERIES = [
  "Plan 2 days in Dubai on a mid budget",
  "What should I do in Tokyo for 3 days?",
  "Plan a luxury weekend in Paris",
  "Budget trip to London for 2 days",
  "4 days in New York City",
];

const BUDGET_OPTIONS: { value: BudgetLevel; label: string; emoji: string }[] = [
  { value: "any", label: "Any budget", emoji: "✨" },
  { value: "low", label: "Budget", emoji: "🪙" },
  { value: "mid", label: "Mid-range", emoji: "💳" },
  { value: "luxury", label: "Luxury", emoji: "💎" },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [budget, setBudget] = useState<BudgetLevel>("any");
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, budget }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Request failed");

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        citiesRetrieved: data.debug?.citiesRetrieved,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Please check your API key and try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-display font-semibold text-ink text-base mt-3 mb-1">
              {line.replace(/\*\*/g, "")}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <p key={i} className="text-sm pl-3 border-l-2 border-sand-300 my-0.5 text-ink/80">
              {line.slice(2)}
            </p>
          );
        }
        if (line.trim() === "") return <br key={i} />;
        return (
          <p key={i} className="text-sm leading-relaxed">
            {line}
          </p>
        );
      });
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      {/* ── Header ── */}
      <header className="px-6 py-4 border-b border-sand-200 bg-parchment/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Concierge <span className="italic text-sand-600">AI</span>
            </h1>
            <p className="text-xs text-ink/50 font-body">
              RAG-powered travel planner · 7 cities available
            </p>
          </div>
          <button
            onClick={() => setShowDebug((d) => !d)}
            className="text-xs text-ink/30 hover:text-ink/60 transition-colors"
            title="Toggle RAG debug info"
          >
            {showDebug ? "hide debug" : "show debug"}
          </button>
        </div>

        {/* Budget selector */}
        <div className="flex gap-2 mt-3">
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setBudget(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-body transition-all ${
                budget === opt.value
                  ? "bg-sand-500 text-white shadow-sm"
                  : "bg-sand-100 text-ink/60 hover:bg-sand-200"
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="animate-fade-up">
            {/* Welcome state */}
            <div className="text-center py-8">
              <div className="text-5xl mb-3">✈️</div>
              <h2 className="font-display text-xl text-ink/70 mb-1">
                Where would you like to go?
              </h2>
              <p className="text-sm text-ink/40 mb-6">
                Ask for a travel itinerary and I'll plan it using real destination data.
              </p>

              {/* Suggested queries */}
              <div className="flex flex-col gap-2 max-w-sm mx-auto">
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left px-4 py-2.5 rounded-xl bg-white border border-sand-200 text-sm text-ink/70 hover:border-sand-400 hover:text-ink hover:bg-sand-50 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex animate-fade-up ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-sand-500 text-white rounded-br-sm"
                  : "bg-white border border-sand-200 text-ink rounded-bl-sm shadow-sm"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-sm">{msg.content}</p>
              ) : (
                <div className="message-content space-y-0.5">
                  {formatMessage(msg.content)}

                  {/* RAG debug badge */}
                  {showDebug && msg.citiesRetrieved && (
                    <div className="mt-3 pt-2 border-t border-sand-100">
                      <p className="text-xs text-ink/40 font-mono">
                        📦 RAG retrieved:{" "}
                        <span className="text-sand-600">
                          {msg.citiesRetrieved.join(", ")}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start animate-fade-up">
            <div className="bg-white border border-sand-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-sand-400 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-ink/40">Planning your itinerary…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Input area ── */}
      <footer className="px-4 pb-4 pt-2 border-t border-sand-200 bg-parchment/80 backdrop-blur-sm">
        <div className="flex gap-2 items-end bg-white rounded-2xl border border-sand-200 px-4 py-2 shadow-sm focus-within:border-sand-400 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for a travel plan… e.g. 3 days in Tokyo"
            rows={1}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink/30 outline-none resize-none max-h-32 py-1.5 font-body"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="mb-1 w-9 h-9 rounded-xl bg-sand-500 text-white flex items-center justify-center disabled:opacity-30 hover:bg-sand-600 active:scale-95 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-ink/25 mt-2">
          Cities: Dubai · Tokyo · Paris · London · New York · Madrid · Baku
        </p>
      </footer>
    </div>
  );
}
