import { describe, it, expect } from "vitest";
import { AdaptivePool, Budget, Pool } from "./pool";

describe("Pool", () => {
  it("respects capacity", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const pool = new Pool<number, number>(3, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n;
    });
    await Promise.all(Array.from({ length: 20 }, (_, i) => pool.submit(i)));
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(0);
  });

  it("preserves submit order via FIFO waiters", async () => {
    const completionOrder: number[] = [];
    const pool = new Pool<number, void>(1, async (n) => {
      await new Promise((r) => setTimeout(r, 1));
      completionOrder.push(n);
    });
    await Promise.all([1, 2, 3, 4].map((n) => pool.submit(n)));
    expect(completionOrder).toEqual([1, 2, 3, 4]);
  });

  it("returns the worker's result", async () => {
    const pool = new Pool<number, string>(2, async (n) => `n=${n}`);
    expect(await pool.submit(7)).toBe("n=7");
  });

  it("propagates errors and frees the slot", async () => {
    const pool = new Pool<number, number>(1, async (n) => {
      if (n === 0) throw new Error("boom");
      return n;
    });
    await expect(pool.submit(0)).rejects.toThrow("boom");
    // Slot must be freed so subsequent submits run
    expect(await pool.submit(2)).toBe(2);
  });

  it("rejects capacity < 1", () => {
    expect(() => new Pool(0, async (x: number) => x)).toThrow();
  });
});

describe("Budget", () => {
  it("caps total in-flight across acquirers", async () => {
    const budget = new Budget(3);
    let inFlight = 0;
    let maxInFlight = 0;
    const work = async () => {
      await budget.acquire();
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      budget.release();
    };
    await Promise.all(Array.from({ length: 20 }, work));
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("releases slots in FIFO order", async () => {
    const budget = new Budget(1);
    const completionOrder: number[] = [];
    await budget.acquire(); // hold
    const tasks = [1, 2, 3].map((n) =>
      (async () => {
        await budget.acquire();
        completionOrder.push(n);
        budget.release();
      })()
    );
    // Give time for all 3 to enqueue
    await new Promise((r) => setTimeout(r, 5));
    budget.release(); // unblock first
    await Promise.all(tasks);
    expect(completionOrder).toEqual([1, 2, 3]);
  });

  it("rejects capacity < 1", () => {
    expect(() => new Budget(0)).toThrow();
  });
});

describe("AdaptivePool", () => {
  it("respects shared budget across multiple pools", async () => {
    const budget = new Budget(2);
    let inFlight = 0;
    let maxInFlight = 0;
    const work = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 3));
      inFlight--;
    };
    const pool1 = new AdaptivePool<void, void>(budget, work, { initialCap: 8 });
    const pool2 = new AdaptivePool<void, void>(budget, work, { initialCap: 8 });

    await Promise.all([
      ...Array.from({ length: 10 }, () => pool1.submit()),
      ...Array.from({ length: 10 }, () => pool2.submit()),
    ]);
    // Even though each pool's local cap is 8, the shared budget = 2 dominates.
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("grows cap under low latency (AIMD additive increase)", async () => {
    const budget = new Budget(16);
    const pool = new AdaptivePool<void, void>(
      budget,
      async () => { await new Promise((r) => setTimeout(r, 1)); },
      { initialCap: 2, maxCap: 16, windowSize: 8 },
    );
    const startCap = pool.currentCap;
    // Submit enough work for several windows to elapse without contention
    await Promise.all(Array.from({ length: 80 }, () => pool.submit()));
    expect(pool.currentCap).toBeGreaterThan(startCap);
  });

  it("shrinks cap when latency rises sharply (AIMD multiplicative decrease)", async () => {
    const budget = new Budget(16);
    let slow = false;
    const pool = new AdaptivePool<void, void>(
      budget,
      async () => {
        // Latency is normally 1ms; switches to 50ms once `slow` flips.
        await new Promise((r) => setTimeout(r, slow ? 50 : 1));
      },
      { initialCap: 8, maxCap: 16, windowSize: 8, shrinkThreshold: 1.3 },
    );
    // Phase 1: establish baseline at low latency
    await Promise.all(Array.from({ length: 16 }, () => pool.submit()));
    const capAfterBaseline = pool.currentCap;

    // Phase 2: latency spikes — should shrink
    slow = true;
    await Promise.all(Array.from({ length: 16 }, () => pool.submit()));
    expect(pool.currentCap).toBeLessThan(capAfterBaseline);
  });

  it("never exceeds maxCap regardless of growth", async () => {
    const budget = new Budget(64);
    const pool = new AdaptivePool<void, void>(
      budget,
      async () => { await new Promise((r) => setTimeout(r, 1)); },
      { initialCap: 2, maxCap: 5, windowSize: 4 },
    );
    await Promise.all(Array.from({ length: 80 }, () => pool.submit()));
    expect(pool.currentCap).toBeLessThanOrEqual(5);
  });
});
