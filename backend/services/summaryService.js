import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const GEMINI_API_KEY_TEXT = process.env.GEMINI_API_KEY_TEXT;
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";

const summaryPrompt = PromptTemplate.fromTemplate(`Summarize this meeting transcript so far into 3-6 short bullet points.
Focus on decisions, topics, and action items. Be concise, no fluff.

Transcript:
{transcript}

Return ONLY the bullet points, one per line, each starting with "- ".`);

export async function summarizeMeeting(transcriptLines) {
  if (!transcriptLines.length) return [];
  if (!GEMINI_API_KEY_TEXT) throw new Error("GEMINI_API_KEY_TEXT is not set");

  const transcript = transcriptLines
    .map((l) => `${l.speaker}: ${l.text}`)
    .join("\n");

  const model = new ChatGoogleGenerativeAI({
    model: GEMINI_TEXT_MODEL,
    apiKey: GEMINI_API_KEY_TEXT,
    temperature: 0.3,
  });

  const chain = summaryPrompt.pipe(model).pipe(new StringOutputParser());

  const raw = await chain.invoke({ transcript });
  return parseBullets(raw);
}

function parseBullets(raw) {
  return raw
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}
