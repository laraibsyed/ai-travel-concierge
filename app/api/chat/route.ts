// source_handbook: week11-hackathon-preparation
// /app/api/chat/route.ts
// This is the core backend: retrieves city context (RAG) then calls Groq API.

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { traceable } from "langsmith/traceable";
import {
  retrieveRelevantCities,
  formatContextForPrompt,
  BudgetLevel,
  CityData,
} from "@/lib/retrieval";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Traced RAG retrieval step — visible in LangSmith as a child span
const tracedRetrieve = traceable(
  async (query: string, budget: BudgetLevel) => {
    const cities = retrieveRelevantCities(query, budget);
    const context = formatContextForPrompt(cities, budget);
    return { cities, context };
  },
  { name: "rag-retrieval", run_type: "retriever" }
);

// Traced LLM call — visible in LangSmith as a child span with prompt + response
const tracedLLMCall = traceable(
  async (systemPrompt: string, userMessage: string) => {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });
    return completion.choices[0]?.message?.content ?? "Sorry, I couldn't generate an itinerary.";
  },
  { name: "groq-llm-call", run_type: "llm" }
);

// Top-level traced pipeline — wraps the whole flow so LangSmith shows user input → output
const tracedPipeline = traceable(
  async (message: string, budget: BudgetLevel) => {
    // ── STEP 1: RAG RETRIEVAL ──────────────────────────────────────────────
    const { cities, context } = await tracedRetrieve(message, budget);

    // ── STEP 2: PROMPT CONSTRUCTION ───────────────────────────────────────
    const systemPrompt = `You are an expert AI Travel Concierge. Your job is to create detailed, practical travel itineraries.

IMPORTANT RULES:
- ONLY use the destination data provided below as your source of truth.
- Do NOT invent attractions, prices, or tips not mentioned in the context.
- Structure your itinerary clearly by day, with Morning / Afternoon / Evening sections.
- Be budget-aware and group nearby attractions together to minimise travel time.
- Keep the tone warm, helpful, and enthusiastic — like a knowledgeable friend.
- If the user asks about a city not in the context, politely say you only have data for: Dubai, Tokyo, Paris, London, New York, Madrid, and Baku.

OUTPUT FORMAT (always use this):
**Day 1: [Theme or Area]**
🌅 Morning: [activities]
☀️ Afternoon: [activities]
🌙 Evening: [activities + dinner suggestion]

**Day 2: [Theme or Area]**
...and so on.

End with a 💡 Quick Tips section (3-4 bullet points).

═══════════════════════════════
RETRIEVED DESTINATION DATA (RAG Context):
${context}
═══════════════════════════════`;

    // ── STEP 3: LLM GENERATION via GROQ ──────────────────────────────────
    const response = await tracedLLMCall(systemPrompt, message);

    return { response, citiesRetrieved: (cities as CityData[]).map((c) => c.city) };
  },
  { name: "travel-concierge-pipeline", run_type: "chain" }
);

export async function POST(req: NextRequest) {
  try {
    const { message, budget = "any" } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const { response, citiesRetrieved } = await tracedPipeline(message, budget as BudgetLevel);

    return NextResponse.json({
      response,
      debug: {
        citiesRetrieved,
        budget,
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate itinerary: ${message}` },
      { status: 500 }
    );
  }
}
