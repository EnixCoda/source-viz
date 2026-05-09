import { describe, expect, it } from "vitest";
import { DependencyEntry, entrySerializers } from "../services/serializers";
import { getOrganizedEntries } from "./getOrganizedEntries";

describe("getOrganizedEntries", () => {
  it("should organize entries", () => {
    const entries: DependencyEntry[] = [
      [
        "file1",
        [
          ["dep3", true, "local"],
          ["dep3", true, "local"],
          ["dep2", false, "local"],
          ["dep3", false, "local"],
        ],
      ],
      [
        "file1",
        [
          ["dep2", true, "local"],
          ["dep1", false, "local"],
        ],
      ],
      ["file2", [["dep3", false, "external"]]],
    ];
    const organizedEntries = getOrganizedEntries(entries, "asc");
    expect(entrySerializers.csv(organizedEntries)).toMatchInlineSnapshot(`
      "File,Dependency,DynamicImport
      file1,dep1,false
      file1,dep2,false
      file1,dep2,true
      file1,dep3,false
      file1,dep3,true
      file2,dep3,false"
    `);
  });
});
