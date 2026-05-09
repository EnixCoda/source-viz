/**
 * Web Worker entry — runs the OXC parser off the main thread.
 *
 * Protocol: { id, source } in → { id, ok: true, deps } | { id, ok: false, error } out.
 * Messages are correlated by `id` so multiple in-flight parses don't collide.
 */
import * as oxcParser from "./oxc";

let parsePromise: Promise<(s: string) => [string, boolean][]> | null = null;

self.onmessage = async (event: MessageEvent<{ id: number; source: string }>) => {
  const { id, source } = event.data;
  try {
    if (!parsePromise) parsePromise = oxcParser.prepare();
    const parse = await parsePromise;
    const deps = parse(source);
    (self as unknown as Worker).postMessage({ id, ok: true, deps });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
