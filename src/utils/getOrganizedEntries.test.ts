import { DependencyEntry } from "../services/serializers";
import { getOrganizedEntries } from "./getOrganizedEntries";

describe("getOrganizedEntries", () => {
  it("should organize entries", () => {
    const entries: DependencyEntry[] = [
      [
        "file1",
        [
          ["dep1", false],
          ["dep2", true],
        ],
      ],
      [
        "file1",
        [
          ["dep2", false],
          ["dep3", true],
          ["dep3", true],
          ["dep3", false],
        ],
      ],
      ["file2", [["dep3", false]]],
    ];
    const organizedEntries = getOrganizedEntries(entries, "asc");
    expect(organizedEntries).toEqual([
      [
        "file1",
        [
          ["dep1", false],
          ["dep2", true],
          ["dep2", false],
          ["dep3", true],
          ["dep3", false],
        ],
      ],
      ["file2", [["dep3", false]]],
    ]);
  });
});
