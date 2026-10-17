import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import ffmpegStatic from "ffmpeg-static";

const GEMINI_API_KEY_VOICE = process.env.GEMINI_API_KEY_VOICE;
const GEMINI_VOICE_MODEL = process.env.GEMINI_VOICE_MODEL || "gemini-3.1-flash-lite";

export function getFfmpegBin() {
  return process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
}

const STT_TIMEOUT_MS = parseInt(process.env.STT_TIMEOUT_MS || "20000", 10);

/** Keep in sync with client MIN_BLOB_BYTES (slightly lower to avoid silent drops). */
const MIN_AUDIO_BYTES = 2500;
/** Gemini rejects empty/corrupt inline audio with a generic 400. */
const MIN_WAV_BYTES = 8000;

let sttQueue = Promise.resolve();

/**
 * Returns true when the model output is noise / non-speech / filler.
 */
export function isNoiseTranscript(text) {
  if (!text) return true;
  const cleaned = text.trim();
  if (cleaned.length < 2) return true;

  const lower = cleaned.toLowerCase().replace(/\s+/g, " ");

  if (/^\s*[\[(].*[\])]\s*$/i.test(cleaned)) return true;
  if (/^(no speech|no audible|blank audio|empty audio|nothing to transcribe|no_speech)/i.test(lower)) {
    return true;
  }

  const NOISE_EXACT = new Set([
    "silence",
    "noise",
    "background noise",
    "inaudible",
    "unintelligible",
    "music",
    "applause",
    "laughter",
    "coughing",
    "cough",
    "typing",
    "keyboard",
    "static",
    "hum",
    "breathing",
    "sigh",
    "mmm",
    "mm",
    "uh",
    "um",
    "uhh",
    "umm",
    "...",
    "…",
  ]);
  if (NOISE_EXACT.has(lower)) return true;

  if (/^[\s.,…\-–—_*#~!?]+$/.test(cleaned)) return true;
  if (/^(uh+|um+|ah+|hmm+|mm+)\.?$/i.test(cleaned)) return true;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const alphaWords = words.filter((w) => /[a-zA-Z\u00C0-\u024F]{1,}/.test(w));
  if (alphaWords.length === 0) return true;

  return false;
}

function normalizeMime(mimeType = "") {
  return String(mimeType).split(";")[0].trim().toLowerCase() || "audio/webm";
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const bin = getFfmpegBin();
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      const fallbackBin = bin === ffmpegStatic ? "ffmpeg" : ffmpegStatic;
      if (fallbackBin && err.code === "ENOENT") {
        console.warn(`[stt] ffmpeg binary "${bin}" failed (${err.message}); trying fallback "${fallbackBin}"`);
        const fallbackChild = spawn(fallbackBin, args, { stdio: ["ignore", "ignore", "pipe"] });
        let fallbackStderr = "";
        fallbackChild.stderr.on("data", (c) => { fallbackStderr += c; });
        fallbackChild.on("error", (e) => reject(new Error(`ffmpeg not available (${e.message})`)));
        fallbackChild.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited ${code}: ${fallbackStderr.slice(-240)}`));
        });
        return;
      }
      reject(new Error(`ffmpeg not available at "${bin}" (${err.message})`));
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-240)}`));
    });
  });
}

function isValidWav(buf) {
  if (!buf || buf.length < MIN_WAV_BYTES) return false;
  // RIFF....WAVE
  return (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x41 &&
    buf[10] === 0x56 &&
    buf[11] === 0x45
  );
}

async function toWav(audioBuffer, sourceExt = ".webm") {
  const id = randomUUID();
  const inPath = join(tmpdir(), `meet-stt-${id}${sourceExt}`);
  const outPath = join(tmpdir(), `meet-stt-${id}.wav`);
  await writeFile(inPath, audioBuffer);
  try {
    await runFfmpeg([
      "-y",
      "-i",
      inPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      outPath,
    ]);
    const wav = await readFile(outPath);
    if (!isValidWav(wav)) {
      throw new Error(`wav too small or invalid (${wav?.length || 0} bytes)`);
    }
    return wav;
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

function extForMime(mime) {
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return ".m4a";
  return ".webm";
}

function isInvalidArgumentError(err) {
  const msg = err?.message || String(err);
  return /invalid argument|invalid value|base64 decoding|400 Bad Request/i.test(msg);
}

async function invokeWithTimeout(model, messages, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await model.invoke(messages, { signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError" || /aborted/i.test(err?.message || "")) {
      throw new Error(`Gemini STT timed out after ${ms}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeOnce(audioBuffer, mimeType = "audio/webm") {
  if (!GEMINI_API_KEY_VOICE) throw new Error("GEMINI_API_KEY_VOICE is not set");

  if (!audioBuffer || audioBuffer.length < MIN_AUDIO_BYTES) {
    return "";
  }

  const sourceMime = normalizeMime(mimeType);
  let payload = null;
  let sendMime = "audio/wav";

  // Always convert browser recordings to clean 16 kHz mono WAV.
  // Sending raw webm/opus (or mime with codecs=...) often yields Gemini 400.
  try {
    payload = sourceMime.includes("wav") && isValidWav(audioBuffer)
      ? audioBuffer
      : await toWav(audioBuffer, extForMime(sourceMime));
  } catch (err) {
    console.warn(`[stt] wav conversion failed (${err.message}); attempting direct audio transcription`);
    payload = audioBuffer;
    sendMime = sourceMime;
  }

  const minBytes = sendMime.includes("wav") ? MIN_WAV_BYTES : MIN_AUDIO_BYTES;
  if (!payload || payload.length < minBytes) {
    console.warn(`[stt] skip utterance — audio payload too small (${payload?.length || 0} bytes)`);
    return "";
  }

  const b64 = payload.toString("base64");
  if (!b64 || b64.length < 64) {
    console.warn("[stt] skip utterance — empty base64 payload");
    return "";
  }

  const model = new ChatGoogleGenerativeAI({
    model: GEMINI_VOICE_MODEL,
    apiKey: GEMINI_API_KEY_VOICE,
    temperature: 0,
  });

  const message = new HumanMessage({
    content: [
      {
        type: "text",
        text: `You are a high-accuracy speech-to-text engine for live meetings.

Rules:
1. Transcribe clear human speech ONLY. Prefer exact wording over paraphrasing.
2. Preserve names, numbers, acronyms, and technical terms carefully.
3. Keep punctuation light and natural. Do not add commentary.
4. If there is no clear speech (silence, noise, typing, breathing, music, coughs), reply with exactly: NO_SPEECH
5. Do not invent words from background noise.
6. Output plain transcript text only — no quotes, no markdown, no labels, no timestamps.
7. Keep the original spoken language.`,
      },
      {
        type: "media",
        mimeType: sendMime,
        data: b64,
      },
    ],
  });

  try {
    const response = await invokeWithTimeout(model, [message], STT_TIMEOUT_MS);
    let text = (response.content || "").trim();

    if (/^NO_SPEECH$/i.test(text)) return "";
    text = text.replace(/^(transcript\s*:|transcription\s*:)\s*/i, "").trim();

    if (isNoiseTranscript(text)) return "";
    return text;
  } catch (err) {
    // Bad/short clips must not surface as pipeline errors in the UI.
    if (isInvalidArgumentError(err)) {
      console.warn(`[stt] gemini rejected audio (treated as empty): ${err.message}`);
      return "";
    }
    throw err;
  }
}

export async function transcribeAudio(audioBuffer, mimeType = "audio/webm") {
  const run = sttQueue.then(() => transcribeOnce(audioBuffer, mimeType));
  sttQueue = run.then(
    () => {},
    () => {}
  );
  return run;
}
