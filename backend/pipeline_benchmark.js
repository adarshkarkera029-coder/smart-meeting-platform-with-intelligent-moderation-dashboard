/**
 * pipeline_benchmark.js
 *
 * End-to-end benchmark for the AI pipeline services:
 *   1. condensationService  — structured output, streaming, history, trim
 *   2. summaryService       — bullet-point summarisation
 *
 * Run from backend/:
 *   node pipeline_benchmark.js
 *
 * Does NOT require the server to be running.
 * Requires GEMINI_API_KEY_TEXT to be set in .env.
 */

import "dotenv/config";
import {
  condenseTranscript,
  condenseTranscriptStream,
  clearRoomHistory,
  clearSessionHistory,
} from "./services/condensationService.js";
import { summarizeMeeting } from "./services/summaryService.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const PASS = "✅";
const FAIL = "❌";
const INFO = "ℹ️ ";

function ms(start) {
  return `${(Date.now() - start)}ms`;
}

let passCount = 0;
let failCount = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ${PASS} ${label}${detail ? " — " + detail : ""}`);
    passCount++;
  } else {
    console.error(`  ${FAIL} ${label}${detail ? " — " + detail : ""}`);
    failCount++;
  }
}

// ── Test fixtures ────────────────────────────────────────────────────────────

const ROOM_ID   = "benchmark-room";
const SPEAKER_A = "Alice";
const SPEAKER_B = "Bob";
const SESSION_A = `${ROOM_ID}:${SPEAKER_A}`;
const SESSION_B = `${ROOM_ID}:${SPEAKER_B}`;

const UTTERANCES_A = [
  "We should move the Q3 launch date earlier to beat the competitor release.",
  "The marketing team has confirmed they can support a two-week earlier timeline.",
  "Engineering says three features will need to be cut to hit that date.",
];

const UTTERANCES_B = [
  "I disagree strongly. Cutting features will hurt our reputation with enterprise clients.",
  "We need to prioritise quality over speed, especially for the API integrations.",
];

const TRANSCRIPT_FOR_SUMMARY = [
  ...UTTERANCES_A.map((text, i) => ({ speaker: SPEAKER_A, text, id: `a${i}`, ts: Date.now() })),
  ...UTTERANCES_B.map((text, i) => ({ speaker: SPEAKER_B, text, id: `b${i}`, ts: Date.now() })),
];

// ── Test 1: Structured condensation + schema validation ──────────────────────

async function testStructuredCondensation() {
  console.log("\n── Test 1: Structured condensation (single turn) ──────────────────");
  clearSessionHistory(SESSION_A);

  const t = Date.now();
  const result = await condenseTranscript(UTTERANCES_A[0], SESSION_A);
  const latency = ms(t);

  console.log(`  ${INFO} latency: ${latency}`);
  console.log(`  ${INFO} result:`, JSON.stringify(result, null, 2));

  assert("returns condensed_point string", typeof result.condensed_point === "string" && result.condensed_point.length > 0, result.condensed_point);
  assert("condensed_point ≤ 20 words", result.condensed_point.split(/\s+/).length <= 20);
  assert("returns intent_category", ["benign","aggressive","harassment","profanity","threat"].includes(result.intent_category));
  assert("returns severity", ["low","medium","high"].includes(result.severity));
  assert("no leading bullet/quote chars", !/^["'\-•]/.test(result.condensed_point));
}

// ── Test 2: Multi-turn history continuity ────────────────────────────────────

async function testHistoryContinuity() {
  console.log("\n── Test 2: Multi-turn history continuity (3 turns) ────────────────");
  clearSessionHistory(SESSION_A);

  const results = [];
  for (const [i, utterance] of UTTERANCES_A.entries()) {
    const t = Date.now();
    const r = await condenseTranscript(utterance, SESSION_A);
    results.push(r);
    console.log(`  ${INFO} turn ${i + 1} [${ms(t)}]: "${r.condensed_point}"`);
  }

  // Each result must be structurally valid
  for (const [i, r] of results.entries()) {
    assert(`turn ${i+1} has condensed_point`, typeof r.condensed_point === "string" && r.condensed_point.length > 0);
    assert(`turn ${i+1} has intent_category`, !!r.intent_category);
  }

  // Points should not all be identical (history provides diversity)
  const unique = new Set(results.map(r => r.condensed_point));
  assert("points are not all identical across turns", unique.size > 1, `${unique.size} unique out of ${results.length}`);
}

// ── Test 3: Streaming ────────────────────────────────────────────────────────

async function testStreaming() {
  console.log("\n── Test 3: Streaming token generator ──────────────────────────────");
  clearSessionHistory(SESSION_A);

  const tokens = [];
  const t = Date.now();

  for await (const token of condenseTranscriptStream(UTTERANCES_A[0], SESSION_A)) {
    tokens.push(token);
  }
  const latency = ms(t);

  const assembled = tokens.join("");
  console.log(`  ${INFO} latency: ${latency}`);
  console.log(`  ${INFO} tokens received: ${tokens.length}`);
  console.log(`  ${INFO} assembled text: "${assembled.slice(0, 120)}${assembled.length > 120 ? "…" : ""}"`);

  assert("received > 0 tokens", tokens.length > 0, `${tokens.length} tokens`);
  assert("assembled text is non-empty", assembled.trim().length > 0);
  assert("all tokens are strings", tokens.every(t => typeof t === "string"));
}

// ── Test 4: Parallel streaming + structured (simulates server.js pattern) ────

async function testParallelPipeline() {
  console.log("\n── Test 4: Parallel stream + structured (server.js pattern) ────────");
  clearSessionHistory(SESSION_B);

  const utterance = UTTERANCES_B[0];
  const t = Date.now();

  const streamedTokens = [];
  const streamPromise = (async () => {
    for await (const token of condenseTranscriptStream(utterance, SESSION_B)) {
      streamedTokens.push(token);
    }
  })();

  const [structuredResult] = await Promise.all([
    condenseTranscript(utterance, SESSION_B),
    streamPromise,
  ]);

  const latency = ms(t);
  console.log(`  ${INFO} total latency (both parallel): ${latency}`);
  console.log(`  ${INFO} structured: "${structuredResult.condensed_point}" | intent: ${structuredResult.intent_category}`);
  console.log(`  ${INFO} streamed tokens: ${streamedTokens.length}`);

  assert("structured result valid", typeof structuredResult.condensed_point === "string" && structuredResult.condensed_point.length > 0);
  assert("stream received tokens", streamedTokens.length > 0);
}

// ── Test 5: clearSessionHistory / clearRoomHistory ────────────────────────────

async function testHistoryClearing() {
  console.log("\n── Test 5: History lifecycle (clear session + room) ────────────────");

  // Seed both sessions
  await condenseTranscript(UTTERANCES_A[0], SESSION_A);
  await condenseTranscript(UTTERANCES_B[0], SESSION_B);

  clearSessionHistory(SESSION_A);
  // After clearing, next call should work fine (fresh history)
  const r = await condenseTranscript(UTTERANCES_A[1], SESSION_A);
  assert("condenseTranscript works after clearSessionHistory", typeof r.condensed_point === "string" && r.condensed_point.length > 0);

  clearRoomHistory(ROOM_ID);
  // After room clear, next call should also work fine
  const r2 = await condenseTranscript(UTTERANCES_B[1], SESSION_B);
  assert("condenseTranscript works after clearRoomHistory", typeof r2.condensed_point === "string" && r2.condensed_point.length > 0);

  console.log(`  ${INFO} history cleared and re-seeded without error`);
}

// ── Test 6: Summary service ───────────────────────────────────────────────────

async function testSummary() {
  console.log("\n── Test 6: Summary service ─────────────────────────────────────────");

  const t = Date.now();
  const bullets = await summarizeMeeting(TRANSCRIPT_FOR_SUMMARY);
  const latency = ms(t);

  console.log(`  ${INFO} latency: ${latency}`);
  console.log(`  ${INFO} bullets:`, bullets);

  assert("returns array", Array.isArray(bullets), `length=${bullets.length}`);
  assert("at least 1 bullet", bullets.length >= 1);
  assert("bullets are non-empty strings", bullets.every(b => typeof b === "string" && b.trim().length > 0));
}

// ── Test 7: Moderation — aggressive utterance ────────────────────────────────

async function testModerationFlag() {
  console.log("\n── Test 7: Intent classification — aggressive utterance ────────────");
  const SESSION_C = `${ROOM_ID}:Charlie`;
  clearSessionHistory(SESSION_C);

  const aggressiveUtterance = "This is completely unacceptable! I'm furious and I want heads to roll now!";
  const t = Date.now();
  const result = await condenseTranscript(aggressiveUtterance, SESSION_C);
  const latency = ms(t);

  console.log(`  ${INFO} latency: ${latency}`);
  console.log(`  ${INFO} intent: ${result.intent_category} | severity: ${result.severity}`);
  console.log(`  ${INFO} point: "${result.condensed_point}"`);

  assert("has intent_category", !!result.intent_category);
  // The model should detect non-benign intent (aggressive/threat)
  const flagged = result.intent_category !== "benign";
  assert("flags non-benign intent", flagged, `got: ${result.intent_category}`);
  assert("severity not low for aggressive", result.severity !== "low", `got: ${result.severity}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  Meet App — AI Pipeline Benchmark");
  console.log("  Model:", process.env.GEMINI_TEXT_MODEL || "gemini-1.5-flash");
  console.log("═══════════════════════════════════════════════════════════════════");

  const total_t = Date.now();

  try {
    await testStructuredCondensation();
    await testHistoryContinuity();
    await testStreaming();
    await testParallelPipeline();
    await testHistoryClearing();
    await testSummary();
    await testModerationFlag();
  } catch (err) {
    console.error(`\n${FAIL} Unhandled error during benchmark:`, err.message);
    failCount++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(`  Total time: ${ms(total_t)}`);
  console.log(`  Results: ${PASS} ${passCount} passed   ${FAIL} ${failCount} failed`);
  console.log("═══════════════════════════════════════════════════════════════════");

  process.exit(failCount > 0 ? 1 : 0);
})();
