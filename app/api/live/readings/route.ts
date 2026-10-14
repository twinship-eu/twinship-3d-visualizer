import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { RECORDING_URL } from "@/features/live-data/live-data-recording-config";
import { isRecording, rowsBetween } from "@/features/live-data/lib/recording";
import type { Recording } from "@/features/live-data/live-data-types";

/** The recording on disk: public/ plus its URL. */
const RECORDING_PATH = path.join(process.cwd(), "public", RECORDING_URL);

/** The recording read, and the file's modification time it was read at: read again when the file changes. */
let cached: { modifiedAt: number; recording: Recording } | null = null;

async function readRecording(): Promise<Recording | null> {
  const file = await stat(RECORDING_PATH).catch(() => null);
  if (!file) return null;
  if (cached?.modifiedAt !== file.mtimeMs) {
    const data: unknown = JSON.parse(await readFile(RECORDING_PATH, "utf8"));
    if (!isRecording(data)) throw new Error(`Recording ${RECORDING_URL}: not the shape convert-timeseries.py writes`);
    cached = { modifiedAt: file.mtimeMs, recording: data };
  }
  return cached.recording;
}

const failure = (status: number, error: string) => Response.json({ error }, { status });

/**
 * The ship's readings over a stretch of its recording — `from` to `to`, ms
 * since the epoch — as its stream would send them: Live data asks every
 * LIVE_READINGS_INTERVAL_MS.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = Number(searchParams.get("from"));
  const to = Number(searchParams.get("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return failure(400, "from, to: moments of the recording, ms since the epoch, from the earlier");
  }
  const recording = await readRecording();
  if (!recording) return failure(404, `No recording at ${RECORDING_URL}`);
  return Response.json(rowsBetween(recording, from, to), { headers: { "Cache-Control": "no-store" } });
}
