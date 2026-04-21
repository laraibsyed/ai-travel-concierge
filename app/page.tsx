"use client";

// source_handbook: week11-hackathon-preparation

import { useState, useRef, useEffect, KeyboardEvent } from "react";

type BudgetLevel = "any" | "low" | "mid" | "luxury";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citiesRetrieved?: string[];
  isRefinement?: boolean;
}

interface SavedChat {
  id: string;
  title: string;
  messages: Message[];
  budget: BudgetLevel;
  createdAt: number;
}

const STORAGE_KEY = "travel-concierge-chats";

const SUGGESTED_QUERIES = [
  "Plan 2 days in Dubai on a mid budget",
  "What should I do in Tokyo for 3 days?",
  "Plan a luxury weekend in Paris",
  "Budget trip to London for 2 days",
  "4 days in New York City",
];

const REFINEMENT_CHIPS = [
  "Make it cheaper",
  "Add more nightlife",
  "More food spots",
  "Replace a museum with something outdoors",
  "Add one more day",
];

const BUDGET_OPTIONS: { value: BudgetLevel; label: string; emoji: string }[] = [
  { value: "any", label: "Any budget", emoji: "✨" },
  { value: "low", label: "Budget", emoji: "🪙" },
  { value: "mid", label: "Mid-range", emoji: "💳" },
  { value: "luxury", label: "Luxury", emoji: "💎" },
];

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [budget, setBudget] = useState<BudgetLevel>("any");
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSavedChats(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const persistChats = (chats: SavedChat[]) => {
    setSavedChats(chats);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  };

  const startNewChat = () => {
    if (messages.length > 0) {
      const title =
        messages.find((m) => m.role === "user")?.content.slice(0, 50) || "New chat";
      const chat: SavedChat = {
        id: Date.now().toString(),
        title,
        messages,
        budget,
        createdAt: Date.now(),
      };
      // Prepend new chat, keep last 30
      persistChats([chat, ...savedChats].slice(0, 30));
    }
    setMessages([]);
    setInput("");
    setShowHistory(false);
  };

  const loadChat = (chat: SavedChat) => {
    // Auto-save the current chat before switching if it has messages
    if (messages.length > 0) {
      const title =
        messages.find((m) => m.role === "user")?.content.slice(0, 50) || "New chat";
      const current: SavedChat = {
        id: Date.now().toString(),
        title,
        messages,
        budget,
        createdAt: Date.now(),
      };
      persistChats([current, ...savedChats.filter((c) => c.id !== chat.id)].slice(0, 30));
    }
    setMessages(chat.messages);
    setBudget(chat.budget);
    setShowHistory(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedChats.filter((c) => c.id !== id);
    persistChats(updated);
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Send last 8 messages as conversation history for follow-up memory
      const conversationHistory = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, budget, conversationHistory }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        citiesRetrieved: data.debug?.citiesRetrieved,
        isRefinement: data.debug?.isRefinement,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, something went wrong. Please check your API key and try again.",
        },
      ]);
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
    return content.split("\n").map((line, i) => {
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

  const hasConversation = messages.some((m) => m.role === "assistant");

  return (
    <div className="relative h-screen overflow-hidden flex">
      {/* ── History Sidebar ── */}
      <aside
        className={`absolute inset-y-0 left-0 z-30 w-72 bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          showHistory ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-sand-100 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Past Chats</h2>
          <button
            onClick={() => setShowHistory(false)}
            className="text-ink/30 hover:text-ink/70 transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-sand-500 text-white text-sm font-body hover:bg-sand-600 active:scale-95 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {savedChats.length === 0 ? (
            <p className="text-xs text-ink/30 text-center mt-6">
              No saved chats yet. Start a conversation!
            </p>
          ) : (
            savedChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => loadChat(chat)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-sand-50 border border-transparent hover:border-sand-200 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-ink/80 font-body leading-snug line-clamp-2 flex-1">
                    {chat.title}
                  </p>
                  <button
                    onClick={(e) => deleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-ink/20 hover:text-red-400 transition-all shrink-0 mt-0.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-ink/30">{formatDate(chat.createdAt)}</span>
                  {chat.budget !== "any" && (
                    <span className="text-xs text-sand-500 bg-sand-50 px-1.5 py-0.5 rounded-full">
                      {chat.budget}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Sidebar backdrop */}
      {showHistory && (
        <div
          className="absolute inset-0 z-20 bg-black/20 backdrop-blur-sm"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* ── Main chat ── */}
      <div className="flex flex-col h-screen max-w-3xl mx-auto w-full">
        {/* ── Header ── */}
        <header className="px-6 py-4 border-b border-sand-200 bg-parchment/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* History toggle */}
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="text-ink/40 hover:text-ink/70 transition-colors"
                title="Chat history"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">
                  Concierge <span className="italic text-sand-600">AI</span>
                </h1>
                <p className="text-xs text-ink/50 font-body">
                  RAG-powered travel planner · 7 cities available
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* New Chat button — only show when there are messages */}
              {messages.length > 0 && (
                <button
                  onClick={startNewChat}
                  className="text-xs px-3 py-1.5 rounded-lg bg-sand-100 text-ink/60 hover:bg-sand-200 hover:text-ink transition-all font-body"
                >
                  + New Chat
                </button>
              )}
              <button
                onClick={() => setShowDebug((d) => !d)}
                className="text-xs text-ink/30 hover:text-ink/60 transition-colors"
                title="Toggle RAG debug info"
              >
                {showDebug ? "hide debug" : "show debug"}
              </button>
            </div>
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
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✈️</div>
                <h2 className="font-display text-xl text-ink/70 mb-1">
                  Where would you like to go?
                </h2>
                <p className="text-sm text-ink/40 mb-6">
                  Ask for a travel itinerary and I'll plan it using real destination data.
                </p>

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
                    {msg.isRefinement && (
                      <p className="text-xs text-sand-500 mb-2 font-body">
                        ✏️ Refined itinerary
                      </p>
                    )}
                    {formatMessage(msg.content)}

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
                  <span className="text-xs text-ink/40">
                    {hasConversation ? "Refining your itinerary…" : "Planning your itinerary…"}
                  </span>
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
              placeholder={
                hasConversation
                  ? "Refine your itinerary… e.g. Make it cheaper"
                  : "Ask for a travel plan… e.g. 3 days in Tokyo"
              }
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

          {/* Refinement chips — shown only after first AI response */}
          {hasConversation && !loading && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-xs text-ink/25 shrink-0">Refine:</span>
              {REFINEMENT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="text-xs px-2.5 py-1 rounded-full bg-sand-100 text-ink/55 hover:bg-sand-200 hover:text-ink transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {!hasConversation && (
            <p className="text-center text-xs text-ink/25 mt-2">
              Cities: Dubai · Tokyo · Paris · London · New York · Madrid · Baku
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
