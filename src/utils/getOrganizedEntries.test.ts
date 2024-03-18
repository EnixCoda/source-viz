import { DependencyEntry, entrySerializers } from "../services/serializers";
import { getOrganizedEntries } from "./getOrganizedEntries";

describe("getOrganizedEntries", () => {
  it("should organize entries", () => {
    const entries: DependencyEntry[] = [
      [
        "file1",
        [
          ["dep3", true],
          ["dep3", true],
          ["dep2", false],
          ["dep3", false],
        ],
      ],
      [
        "file1",
        [
          ["dep2", true],
          ["dep1", false],
        ],
      ],
      ["file2", [["dep3", false]]],
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
