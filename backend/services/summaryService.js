import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

function getGeminiApiKey() {
  const key =
    process.env.GEMINI_API_KEY_TEXT ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY_VOICE ||
    "";
  return String(key).trim().replace(/^["']|["']$/g, "");
}

function getGeminiTextModels() {
  const configured = (process.env.GEMINI_TEXT_MODEL || "").trim();
  const candidates = [
    configured,
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function getHfToken() {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || "";
  return String(token).trim().replace(/^["']|["']$/g, "");
}

function getSummaryTimeoutMs() {
  return parseInt(process.env.SUMMARY_TIMEOUT_MS || "30000", 10);
}

function getSummaryBackend() {
  return (process.env.SUMMARY_BACKEND || "gemini").toLowerCase().trim();
}

const SUMMARY_SYSTEM = `You summarize meetings into 3-6 short bullet points.
Focus on decisions, topics, and action items. Be concise, no fluff.
Return ONLY the bullet points, one per line, each starting with "- ".
Do not wrap the answer in markdown code fences.`;

function buildTranscript(transcriptLines) {
  const lines = Array.isArray(transcriptLines)
    ? transcriptLines
    : transcriptLines?.newLines || [];
  if (!lines.length) return "";
  return lines
    .map((l) => {
      if (typeof l === "string") return l.trim();
      const speaker = l?.speaker || l?.name || "Speaker";
      const text = String(l?.text || l?.content || "").trim();
      return text ? `${speaker}: ${text}` : "";
    })
    .filter((l) => l && !l.endsWith(":"))
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const candidateModels = getGeminiTextModels();
  const timeoutMs = getSummaryTimeoutMs();
  let lastErr = null;

  for (const modelName of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const model = new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: apiKey,
        temperature: 0.3,
        maxRetries: 1,
      });

      const res = await model.invoke(
        [new HumanMessage(`${SUMMARY_SYSTEM}\n\nTranscript:\n${transcript}`)],
        { signal: controller.signal }
      );
      const text = contentToText(res?.content);
      if (text && text.trim()) {
        return text;
      }
    } catch (err) {
      if (err?.name === "AbortError" || /aborted/i.test(err?.message || "")) {
        lastErr = new Error(`Gemini model "${modelName}" timed out after ${timeoutMs}ms`);
      } else {
        lastErr = err;
      }
      console.warn(`[summary] Gemini model "${modelName}" failed (${lastErr.message}); trying fallback`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr || new Error("All Gemini summary models failed");
}

async function summarizeWithHuggingFace(transcript) {
  const token = getHfToken();
  if (!token) throw new Error("HF_TOKEN is not set");

  const model = process.env.HF_SUMMARY_MODEL || "meta-llama/Llama-3.1-8B-Instruct";
  const provider = process.env.HF_PROVIDER || "groq";
  const url = process.env.HF_CHAT_URL || "https://router.huggingface.co/v1/chat/completions";
  const timeoutMs = getSummaryTimeoutMs();

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (provider) headers["X-HF-Provider"] = provider;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
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
  } catch (err) {
    if (err?.name === "AbortError" || /aborted/i.test(err?.message || "")) {
      throw new Error(`Hugging Face summary timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function extractiveBullets(transcriptLines) {
  const lines = Array.isArray(transcriptLines)
    ? transcriptLines
    : transcriptLines?.newLines || [];
  const seen = new Set();
  const bullets = [];
  for (const line of lines.slice(-8)) {
    const raw = typeof line === "string" ? line : line?.text || "";
    const text = String(raw).replace(/\s+/g, " ").trim();
    if (text.length < 8) continue;
    const speaker = typeof line === "object" && line?.speaker ? `${line.speaker}: ` : "";
    const item = `${speaker}${text}`.slice(0, 160);
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

  const backend = getSummaryBackend();
  const preferHf = backend === "huggingface" || backend === "hf";
  const geminiApiKey = getGeminiApiKey();
  const hfToken = getHfToken();

  try {
    let raw = "";

    if (preferHf) {
      try {
        raw = await summarizeWithHuggingFace(transcript);
      } catch (err) {
        if (geminiApiKey) {
          console.warn(`[summary] HF failed (${err.message}); falling back to Gemini`);
          raw = await summarizeWithGemini(transcript);
        } else {
          throw err;
        }
      }
    } else {
      try {
        raw = await summarizeWithGemini(transcript);
      } catch (err) {
        if (hfToken) {
          console.warn(`[summary] Gemini failed (${err.message}); falling back to Hugging Face`);
          raw = await summarizeWithHuggingFace(transcript);
        } else {
          throw err;
        }
      }
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

export function parseBullets(raw) {
  let text = String(raw || "").trim();
  if (!text) return [];

  // Strip thinking tags if generated by reasoning models
  text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();

  // Strip markdown fences
  text = text.replace(/```(?:markdown|md|text|json)?\s*([\s\S]*?)```/gi, "$1").trim();

  const lines = text
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/^\s*(?:[-•*]|\d+[.)]|–|—)\s+/, "")
        .replace(/^\s*[*_#]+|[*_#]+$/g, "")
        .trim()
    )
    .filter((l) => {
      if (!l) return false;
      if (/^```/.test(l)) return false;
      if (/^(?:here(?:'s| is)|this is) (?:a |the )?(?:summary|notes|breakdown)/i.test(l)) return false;
      if (/^(?:meeting )?(?:summary|key takeaways|action items|decisions|topics|overview):?$/i.test(l)) return false;
      return true;
    })
    .slice(0, 8);

  return lines;
}
