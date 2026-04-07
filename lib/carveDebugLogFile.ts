/**
 * Server-only: writes [CarveMusic] flow lines to CARVEMUSIC_LOG_FILE when set
 * (every request: API steps, JioSaavn, Gemini start/done, strict vs soft mode).
 * File logging is unconditional when the path is set; console still follows
 * development / CARVEMUSIC_DEBUG. Do not import from client components.
 */

import fs from "fs";
import path from "path";
import {
  formatCarveDebugLine,
  formatCarveDebugLineAlways,
} from "@/lib/carveDebugLog";

function logFilePath(): string | null {
  const raw = process.env.CARVEMUSIC_LOG_FILE?.trim();
  if (!raw) return null;
  return path.isAbsolute(raw)
    ? raw
    : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
}

function appendLogFile(line: string): void {
  const file = logFilePath();
  if (!file) return;
  try {
    const dir = path.dirname(file);
    if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(file, `${line}\n`, { encoding: "utf8" });
  } catch {
    /* ignore */
  }
}

export function carveDebugServer(tag: string, data?: Record<string, unknown>): void {
  const file = logFilePath();
  if (file) {
    appendLogFile(formatCarveDebugLineAlways(tag, data));
  }
  const consoleLine = formatCarveDebugLine(tag, data);
  if (consoleLine) console.log(consoleLine);
}
