/**
 * condensationService.js
 *
 * Condenses a raw meeting utterance into a short bullet point and classifies
 * the speaker's intent, with automatic per-speaker conversation history
 * managed by LangChain's RunnableWithMessageHistory + InMemoryChatMessageHistory.
 *
 * Performance Optimization (Single-Call Streaming):
 * Instead of making two parallel API calls (one for typewriter tokens, one for JSON),
 * this implementation performs a SINGLE streaming JSON call to Gemini.
 * It extracts in-flight text deltas via regex from the partial JSON stream and
 * yields them as tokens, then returns the parsed JSON block at the end.
 *
 * Exports:
 *   condenseTranscript(rawText, sessionId)         → structured result
 *   condenseTranscriptStream(rawText, sessionId)   → yields string tokens, returns final metadata
 *   clearSessionHistory(sessionId)                 → delete one session
 *   clearRoomHistory(roomId)                       → delete all sessions for a room
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { trimMessages } from "@langchain/core/messages";
import { z } from "zod";

// ── Config ───────────────────────────────────────────────────────────────────

const GEMINI_API_KEY_TEXT = process.env.GEMINI_API_KEY_TEXT;
const GEMINI_TEXT_MODEL   = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";

/**
 * Maximum "token budget" for history messages before trimming.
 * We use a char-based estimator (1 token ≈ 4 chars); 600 ≈ last 4-6 turns.
 */
const MAX_HISTORY_TOKENS = 600;

// ── In-memory history store ──────────────────────────────────────────────────
// sessionId → InMemoryChatMessageHistory (raw, full history)

const historyStore = new Map();

function getRawHistory(sessionId) {
  if (!historyStore.has(sessionId)) {
    historyStore.set(sessionId, new InMemoryChatMessageHistory());
  }
  return historyStore.get(sessionId);
}

/**
 * Returns a proxy history object whose getMessages() applies trimMessages
 * before the messages are injected into the prompt, capping prompt size.
 */
function getTrimmedHistory(sessionId) {
  const raw = getRawHistory(sessionId);
  return {
    getMessages: async () => {
      const msgs = await raw.getMessages();
      if (msgs.length === 0) return msgs;
      return trimMessages(msgs, {
        maxTokens: MAX_HISTORY_TOKENS,
        strategy: "last",
        tokenCounter: (m) =>
          m.reduce(
            (sum, msg) =>
              sum + Math.ceil((typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)).length / 4),
            0
          ),
        includeSystem: false,
        allowPartial: false,
        startOn: "human",
      });
    },
    addMessages: (msgs) => raw.addMessages(msgs),
    clear: () => raw.clear(),
  };
}

/** Remove history for one speaker in one room (e.g. on disconnect). */
export function clearSessionHistory(sessionId) {
  historyStore.delete(sessionId);
}

/** Remove ALL speaker histories for a room (e.g. on room:reset). */
export function clearRoomHistory(roomId) {
  for (const key of historyStore.keys()) {
    if (key.startsWith(`${roomId}:`)) {
      historyStore.delete(key);
    }
  }
}

// ── Prompt ───────────────────────────────────────────────────────────────────

const condensationPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a real-time meeting assistant. For each new utterance you produce a "condensed_point" and classify intent.

Rules for "condensed_point":
- Stay faithful to what was said — never invent facts, names, or numbers.
- If the utterance is SHORT (roughly 12 words or fewer), reproduce it EXACTLY as spoken. Do NOT rephrase.
- If the utterance is LONG (more than ~12 words), condense into ONE clear sentence (max 22 words) keeping key nouns/numbers.
- Never add interpretive labels like "Greeting", "Acknowledgement", or "Speaker expressed…".

You MUST respond strictly with a JSON object matching this schema:
{{
  "condensed_point": "string — the condensed or verbatim text as described above",
  "intent_category": "benign" | "aggressive" | "harassment" | "profanity" | "threat",
  "severity": "low" | "medium" | "high"
}}

Ensure "condensed_point" is the first key in the JSON object. Do not include markdown codeblocks or prefix with \`\`\`json. Output ONLY raw JSON.

Use the conversation history below to maintain continuity — avoid repeating the same bullet as a previous turn.`,
  ],
  new MessagesPlaceholder("history"),
  ["human", "{rawText}"],
]);

// ── Shared helpers ───────────────────────────────────────────────────────────

function buildModel() {
  if (!GEMINI_API_KEY_TEXT) throw new Error("GEMINI_API_KEY_TEXT is not set");
  return new ChatGoogleGenerativeAI({
    model: GEMINI_TEXT_MODEL,
    apiKey: GEMINI_API_KEY_TEXT,
    temperature: 0,
    json: true, // enforce JSON mode output
  });
}

function cleanPoint(text) {
  return String(text)
    .replace(/^bullet:?/i, "")
    .replace(/^["'\-•\s]+|["'\s]+$/g, "")
    .trim();
}

function extractPartialCondensedPoint(jsonStr) {
  const match = jsonStr.match(/"condensed_point"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
  const partialMatch = jsonStr.match(/"condensed_point"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)$/);
  if (partialMatch) {
    return partialMatch[1];
  }
  if (match) {
    return match[1];
  }
  return "";
}

// ── Single-Call Streaming Generator ──────────────────────────────────────────

/**
 * Async generator that performs a single streaming JSON call to Gemini.
 * Yields string tokens (text deltas) as they stream.
 * Returns the final metadata object on completion.
 */
export async function* condenseTranscriptStream(rawText, sessionId) {
  const model = buildModel();

  const chainWithHistory = new RunnableWithMessageHistory({
    runnable: condensationPrompt.pipe(model),
    getMessageHistory: (sid) => getTrimmedHistory(sid),
    inputMessagesKey: "rawText",
    historyMessagesKey: "history",
  });

  const stream = await chainWithHistory.stream(
    { rawText },
    { configurable: { sessionId } }
  );

  let accumulated = "";
  let lastExtracted = "";

  for await (const chunk of stream) {
    const text = typeof chunk.content === "string" ? chunk.content : "";
    if (!text) continue;

    accumulated += text;

    const current = extractPartialCondensedPoint(accumulated);
    if (current.length > lastExtracted.length) {
      const delta = current.slice(lastExtracted.length);
      yield delta;
      lastExtracted = current;
    }
  }

  // Parse the completed JSON object
  let finalResult = null;
  try {
    finalResult = JSON.parse(accumulated.trim());
  } catch (err) {
    // Fallback if model output is not valid JSON
    finalResult = {
      condensed_point: lastExtracted || rawText.split(/\s+/).slice(0, 12).join(" ").trim(),
      intent_category: "benign",
      severity: "low",
    };
  }

  if (finalResult.condensed_point) {
    finalResult.condensed_point = cleanPoint(finalResult.condensed_point);
  }

  return finalResult;
}

// ── Backwards Compatible Wrapper ─────────────────────────────────────────────

/**
 * Blocking call for backwards compatibility (e.g. testing, legacy hooks).
 * Consumes the streaming generator and returns the final metadata object.
 */
export async function condenseTranscript(rawText, sessionId) {
  const iterator = condenseTranscriptStream(rawText, sessionId);
  let next = await iterator.next();
  while (!next.done) {
    next = await iterator.next();
  }
  return next.value;
}
