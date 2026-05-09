/**
 * Web Worker entry — runs the Babel parser off the main thread.
 *
 * Babel is heavy (loads many plugins) so we keep it isolated from the OXC worker.
 * This worker only spins up when the first parse failure triggers fallback loading.
 */
import * as babelParser from "./babel";

let parsePromise: Promise<(s: string) => [string, boolean][]> | null = null;

self.onmessage = async (event: MessageEvent<{ id: number; source: string }>) => {
  const { id, source } = event.data;
  try {
    if (!parsePromise) parsePromise = babelParser.prepare();
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
