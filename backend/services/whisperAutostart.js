/**
 * Ensures local faster-whisper is running and stays up across nodemon restarts.
 */
import { execFile } from "child_process";
import { existsSync, chmodSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_DIR = join(__dirname, "..", "python");
const START_SCRIPT = join(PYTHON_DIR, "start_whisper.sh");
const LOG_FILE = join(PYTHON_DIR, "logs", "whisper.log");

const WHISPER_URL = (process.env.WHISPER_URL || "http://127.0.0.1:9000").replace(/\/$/, "");
const WHISPER_BACKEND = (process.env.WHISPER_BACKEND || "auto").toLowerCase();
const AUTOSTART = (process.env.WHISPER_AUTOSTART || "true").toLowerCase() !== "false";
const READY_TIMEOUT_MS = parseInt(process.env.WHISPER_READY_TIMEOUT_MS || "180000", 10);

let startPromise = null;

async function isHealthy() {
  try {
    const res = await fetch(`${WHISPER_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitUntilHealthy(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await isHealthy()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function spawnWhisper() {
  if (!existsSync(START_SCRIPT)) {
    throw new Error(`missing ${START_SCRIPT}`);
  }
  try {
    chmodSync(START_SCRIPT, 0o755);
  } catch {
    /* ignore */
  }

  const env = {
    ...process.env,
    WHISPER_MODEL: process.env.WHISPER_MODEL || "base",
    WHISPER_DEVICE: process.env.WHISPER_DEVICE || "cpu",
    WHISPER_COMPUTE_TYPE: process.env.WHISPER_COMPUTE_TYPE || "int8",
  };

  console.log(`[whisper] launching via start_whisper.sh …`);
  const { stdout, stderr } = await execFileAsync("bash", [START_SCRIPT], {
    cwd: PYTHON_DIR,
    env,
    timeout: 15000,
  });
  if (stdout?.trim()) console.log(`[whisper] ${stdout.trim()}`);
  if (stderr?.trim()) console.warn(`[whisper] ${stderr.trim()}`);
}

/**
 * @returns {Promise<{ ok: boolean, started: boolean, url: string, detail?: string }>}
 */
export async function ensureWhisperRunning() {
  if (!AUTOSTART || WHISPER_BACKEND === "gemini") {
    return { ok: true, started: false, url: WHISPER_URL, detail: "autostart skipped" };
  }

  if (await isHealthy()) {
    return { ok: true, started: false, url: WHISPER_URL };
  }

  if (!startPromise) {
    startPromise = (async () => {
      try {
        await spawnWhisper();
      } catch (err) {
        startPromise = null;
        return {
          ok: false,
          started: false,
          url: WHISPER_URL,
          detail: `spawn failed: ${err.message}`,
        };
      }

      const ready = await waitUntilHealthy(READY_TIMEOUT_MS);
      if (!ready) {
        startPromise = null;
        return {
          ok: false,
          started: true,
          url: WHISPER_URL,
          detail: `timed out waiting for ${WHISPER_URL}/health (see ${LOG_FILE})`,
        };
      }

      console.log(`[whisper] ready at ${WHISPER_URL}`);
      return { ok: true, started: true, url: WHISPER_URL };
    })();
  }

  return startPromise;
}

/** Lazy ensure used before STT if the daemon died mid-session. */
export async function ensureWhisperHealthy() {
  if (WHISPER_BACKEND === "gemini") return false;
  if (await isHealthy()) return true;
  const result = await ensureWhisperRunning();
  return result.ok;
}
