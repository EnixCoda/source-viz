import { describe, it, expect } from "vitest";
import * as nodepath from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "../scanner";

const FIXTURE_DIR = nodepath.resolve(nodepath.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("scanner", () => {
  it("returns dependency entries for scanned files", async () => {
    const { entries } = await scan(FIXTURE_DIR, { silent: true });
    expect(entries.length).toBeGreaterThan(0);
  });

  it("builds depMap with correct relationships", async () => {
    const { depMap } = await scan(FIXTURE_DIR, { silent: true });
    // a.ts imports ./b
    expect(depMap.get("a.ts")?.has("b.ts")).toBe(true);
  });

  it("builds dependantMap (reverse index)", async () => {
    const { dependantMap } = await scan(FIXTURE_DIR, { silent: true });
    // b.ts is imported by a.ts
    expect(dependantMap.get("b.ts")?.has("a.ts")).toBe(true);
  });

  it("respects custom exclude patterns", async () => {
    const { entries } = await scan(FIXTURE_DIR, {
      exclude: [".*\\.ts$"],
      silent: true,
    });
    expect(entries.length).toBe(0);
  });
});
