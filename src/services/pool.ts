/**
 * Bounded-concurrency work pool with FIFO backpressure.
 *
 * `submit(input)` runs the worker function on `input`, but waits if the pool is full.
 * Callers experience natural backpressure: when downstream is saturated, `submit`
 * resolves only after a slot opens.
 *
 * This is the basic building block of the multi-stage parsing pipeline. Each stage
 * (file reader, primary parser, fallback parser) gets its own pool with its own
 * concurrency limit. Stages are wired together by chaining `submit` calls.
 *
 * Worker-friendly: the worker function is async, so it can post a message to a
 * Web Worker and await the response with no change to the pool itself.
 */
export class Pool<I, O> {
  private inFlight = 0;
  private waiters: (() => void)[] = [];

  constructor(
    private readonly capacity: number,
    private readonly work: (input: I) => Promise<O>,
  ) {
    if (capacity < 1) throw new Error(`Pool capacity must be >= 1, got ${capacity}`);
  }

  async submit(input: I): Promise<O> {
    while (this.inFlight >= this.capacity) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.inFlight++;
    try {
      return await this.work(input);
    } finally {
      this.inFlight--;
      this.waiters.shift()?.();
    }
  }
}

/**
 * Shared resource budget (semaphore). Multiple pools acquire from the same Budget
 * to enforce a global ceiling on a category of work — e.g. one Budget for I/O
 * (reader pool + dir scan pool) and one for CPU (parser + fallback worker pools).
 *
 * This guarantees the total live work in a category never exceeds the budget,
 * regardless of how individual pool caps are set. FIFO across all waiters.
 */
export class Budget {
  private inFlight = 0;
  private waiters: (() => void)[] = [];

  constructor(public readonly capacity: number) {
    if (capacity < 1) throw new Error(`Budget capacity must be >= 1, got ${capacity}`);
  }

  get used(): number { return this.inFlight; }

  async acquire(): Promise<void> {
    while (this.inFlight >= this.capacity) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.inFlight++;
  }

  release(): void {
    this.inFlight--;
    this.waiters.shift()?.();
  }
}

export interface AdaptiveOptions {
  /** Initial concurrency cap. Default: ceil(budget.capacity / 2), min 1. */
  initialCap?: number;
  /** Hard upper bound for the cap. Default: budget.capacity. */
  maxCap?: number;
  /** Hard lower bound for the cap. Default: 1. */
  minCap?: number;
  /** Number of completions per AIMD evaluation. Default: 32. */
  windowSize?: number;
  /** If p95 latency rises by this factor over baseline, halve the cap. Default: 1.5. */
  shrinkThreshold?: number;
}

/**
 * Bounded-concurrency pool with **shared budget** + **adaptive cap (AIMD)**.
 *
 * Two layers of throttling:
 * 1. The pool's own `cap` (adaptively tuned) — local concurrency.
 * 2. A shared {@link Budget} — global ceiling across pools that compete for the
 *    same resource (e.g. I/O bandwidth or CPU cores).
 *
 * AIMD: every `windowSize` completions, look at the p95 latency.
 * - First window establishes a baseline.
 * - Subsequent windows: if p95 grew by `shrinkThreshold`× (contention!), halve cap.
 * - Otherwise, additively grow cap by 1 (until maxCap is reached).
 *
 * Result: pools auto-converge near the optimum for the current workload + hardware,
 * without hand-tuning. Especially valuable for long scans (10k+ files) where the
 * convergence cost is amortized.
 */
export class AdaptivePool<I, O> {
  private cap: number;
  private readonly maxCap: number;
  private readonly minCap: number;
  private readonly windowSize: number;
  private readonly shrinkThreshold: number;
  private inFlight = 0;
  private waiters: (() => void)[] = [];
  private samples: number[] = [];
  private baseline: number | null = null;

  constructor(
    private readonly budget: Budget,
    private readonly work: (input: I) => Promise<O>,
    opts: AdaptiveOptions = {},
  ) {
    this.maxCap = opts.maxCap ?? budget.capacity;
    this.minCap = Math.max(1, opts.minCap ?? 1);
    this.cap = Math.min(
      this.maxCap,
      Math.max(this.minCap, opts.initialCap ?? Math.max(1, Math.ceil(budget.capacity / 2))),
    );
    this.windowSize = opts.windowSize ?? 32;
    this.shrinkThreshold = opts.shrinkThreshold ?? 1.5;
  }

  /** Current adaptive cap. Useful for tests / observability. */
  get currentCap(): number { return this.cap; }

  async submit(input: I): Promise<O> {
    while (this.inFlight >= this.cap) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.inFlight++;
    await this.budget.acquire();
    const t0 = nowMs();
    try {
      return await this.work(input);
    } finally {
      this.recordSample(nowMs() - t0);
      this.budget.release();
      this.inFlight--;
      this.waiters.shift()?.();
    }
  }

  private recordSample(latency: number): void {
    this.samples.push(latency);
    if (this.samples.length < this.windowSize) return;

    const sorted = this.samples.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    this.samples = [];

    if (this.baseline === null) {
      this.baseline = p95;
      return;
    }
    if (p95 > this.baseline * this.shrinkThreshold) {
      // Contention detected: multiplicative decrease.
      this.cap = Math.max(this.minCap, this.cap >> 1);
      this.baseline = p95;
    } else {
      // Headroom: additive increase (bounded by maxCap).
      if (this.cap < this.maxCap) this.cap++;
      // Slowly track the baseline so transient changes don't anchor it forever.
      this.baseline = (this.baseline + p95) / 2;
    }
  }
}

const nowMs: () => number =
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();
