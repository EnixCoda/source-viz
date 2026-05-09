/**
 * Wraps a pool of Web Workers behind a `Parse`-compatible function.
 *
 * Round-robins requests across workers and correlates responses by message id, so
 * many in-flight parses can multiplex over a small fixed worker pool. Used to run
 * OXC and Babel parsers off the main thread.
 */

type ParseResult = [string, boolean][];
type Pending = {
  resolve: (deps: ParseResult) => void;
  reject: (err: Error) => void;
};

export interface WorkerParser {
  parse: (source: string) => Promise<ParseResult>;
  /** Terminate all workers — call when done with the pipeline. */
  dispose: () => void;
}

export function createWorkerParser(
  workerFactory: () => Worker,
  poolSize: number,
): WorkerParser {
  const workers: Worker[] = [];
  const pending = new Map<number, Pending>();
  let nextId = 0;
  let nextWorker = 0;
  let disposed = false;

  for (let i = 0; i < poolSize; i++) {
    const w = workerFactory();
    w.onmessage = (event: MessageEvent<{ id: number; ok: boolean; deps?: ParseResult; error?: string }>) => {
      const { id, ok, deps, error } = event.data;
      const handler = pending.get(id);
      if (!handler) return;
      pending.delete(id);
      if (ok && deps) handler.resolve(deps);
      else handler.reject(new Error(error ?? "worker parse failed"));
    };
    w.onerror = (event) => {
      // Surface uncaught worker errors to all in-flight callers — they're likely all broken
      const err = new Error(event.message || "worker error");
      for (const [id, h] of pending) {
        h.reject(err);
        pending.delete(id);
      }
    };
    workers.push(w);
  }

  return {
    parse(source: string) {
      if (disposed) return Promise.reject(new Error("worker pool disposed"));
      const id = nextId++;
      const worker = workers[nextWorker];
      nextWorker = (nextWorker + 1) % workers.length;
      return new Promise<ParseResult>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, source });
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const w of workers) w.terminate();
      workers.length = 0;
      for (const [, h] of pending) h.reject(new Error("worker pool disposed"));
      pending.clear();
    },
  };
}
