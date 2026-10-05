import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

const SUMMARY_BACKEND = (process.env.SUMMARY_BACKEND || "gemini").toLowerCase();
const GEMINI_API_KEY_TEXT =
  process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY_VOICE;
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
const HF_SUMMARY_MODEL =
  process.env.HF_SUMMARY_MODEL || "meta-llama/Llama-3.1-8B-Instruct";
const HF_PROVIDER = process.env.HF_PROVIDER || "groq";
const HF_CHAT_URL =
  process.env.HF_CHAT_URL || "https://router.huggingface.co/v1/chat/completions";
const SUMMARY_TIMEOUT_MS = parseInt(process.env.SUMMARY_TIMEOUT_MS || "45000", 10);

const SUMMARY_SYSTEM = `You summarize meetings into 3-6 short bullet points.
Focus on decisions, topics, and action items. Be concise, no fluff.
Return ONLY the bullet points, one per line, each starting with "- ".
Do not wrap the answer in markdown code fences.`;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function buildTranscript(transcriptLines) {
  const lines = Array.isArray(transcriptLines)
    ? transcriptLines
    : transcriptLines?.newLines || [];
  if (!lines.length) return "";
  return lines
    .map((l) => `${l.speaker || "Speaker"}: ${String(l.text || "").trim()}`)
    .filter((l) => !l.endsWith(":"))
    .join("\n");
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        return "";
      })
      .join("");
  }
  if (content == null) return "";
  return String(content);
}

async function summarizeWithGemini(transcript) {
  if (!GEMINI_API_KEY_TEXT) throw new Error("GEMINI_API_KEY_TEXT is not set");

  const model = new ChatGoogleGenerativeAI({
    model: GEMINI_TEXT_MODEL,
    apiKey: GEMINI_API_KEY_TEXT,
    temperature: 0.3,
    maxRetries: 2,
  });

  // Gemini is unreliable with LangChain SystemMessage on some deploy models.
  const res = await model.invoke([
    new HumanMessage(`${SUMMARY_SYSTEM}\n\nTranscript:\n${transcript}`),
  ]);
  return contentToText(res?.content);
}

async function summarizeWithHuggingFace(transcript) {
  if (!HF_TOKEN) throw new Error("HF_TOKEN is not set");

  const headers = {
    Authorization: `Bearer ${HF_TOKEN}`,
    "Content-Type": "application/json",
  };
  if (HF_PROVIDER) headers["X-HF-Provider"] = HF_PROVIDER;

  const res = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: HF_SUMMARY_MODEL,
      temperature: 0.3,
      max_tokens: 400,
      messages: [
        { role: "system", content: SUMMARY_SYSTEM },
        { role: "user", content: `Transcript:\n${transcript}` },
      ],
    }),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(`Hugging Face summary failed (${res.status}): ${rawBody.slice(0, 280)}`);
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(`Hugging Face returned non-JSON: ${rawBody.slice(0, 280)}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Hugging Face summary missing content: ${rawBody.slice(0, 280)}`);
  }
  return content;
}

function extractiveBullets(transcriptLines) {
  const seen = new Set();
  const bullets = [];
  for (const line of transcriptLines.slice(-8)) {
    const text = String(line?.text || "").replace(/\s+/g, " ").trim();
    if (text.length < 8) continue;
    const item = `${line.speaker || "Speaker"}: ${text}`.slice(0, 160);
    if (seen.has(item)) continue;
    seen.add(item);
    bullets.push(item);
  }
  return bullets.slice(0, 6);
}

export async function summarizeMeeting(transcriptLines) {
  if (!transcriptLines || !transcriptLines.length) return [];

  const transcript = buildTranscript(transcriptLines);
  if (!transcript) return [];

  const preferHf = SUMMARY_BACKEND === "huggingface" || SUMMARY_BACKEND === "hf";
  const allowGeminiFallback =
    (process.env.SUMMARY_FALLBACK_GEMINI || "true").toLowerCase() !== "false";

  try {
    let raw;
    if (preferHf) {
      try {
        raw = await withTimeout(
          summarizeWithHuggingFace(transcript),
          SUMMARY_TIMEOUT_MS,
          "summary-hf"
        );
      } catch (err) {
        if (!allowGeminiFallback || !GEMINI_API_KEY_TEXT) throw err;
        console.warn(`[summary] HF failed (${err.message}); falling back to Gemini`);
        raw = await withTimeout(
          summarizeWithGemini(transcript),
          SUMMARY_TIMEOUT_MS,
          "summary-gemini"
        );
      }
    } else {
      raw = await withTimeout(
        summarizeWithGemini(transcript),
        SUMMARY_TIMEOUT_MS,
        "summary"
      );
    }

    const bullets = parseBullets(raw);
    if (!bullets.length && raw?.trim()) {
      const fallback = raw.replace(/\s+/g, " ").trim().slice(0, 180);
      return fallback ? [fallback] : extractiveBullets(transcriptLines);
    }
    return bullets.length ? bullets : extractiveBullets(transcriptLines);
  } catch (err) {
    console.error(`[summary] model failed (${err.message}); using extractive fallback`);
    return extractiveBullets(transcriptLines);
  }
}

function parseBullets(raw) {
  let text = String(raw || "").trim();
  if (!text) return [];

  // Strip markdown fences if the model ignored instructions.
  text = text.replace(/```(?:markdown|md|text)?\s*([\s\S]*?)```/gi, "$1").trim();

  const lines = text
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/^\s*(?:[-•*]|\d+[.)]|–|—)\s+/, "")
        .replace(/^\s*\*\*(.+?)\*\*\s*$/, "$1")
        .trim()
    )
    .filter((l) => l && !/^```/.test(l) && !/^here(?:'s| is) (?:a |the )?summary/i.test(l))
    .slice(0, 8);

  return lines;
}
