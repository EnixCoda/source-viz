import minimatch from "minimatch";
import * as React from "react";
import { FS } from "../App";
import { MetaFilter } from "../Scan";
import { RecursiveColumns } from "./column/Columns";

interface FSItem {
  kind: string;
  name: string;
  path: string;
}

type $FSItem = FSItemDir | FSItemFile;

interface FSItemDir extends FSItem {
  kind: "dir";
  contents: $FSItem[];
}

interface FSItemFile extends FSItem {
  kind: "file";
  file: File;
}

export function FileExplorer({ files, filter }: { files: FS; filter?: MetaFilter }) {
  const [mode] = React.useState<"columns">("columns");
  const [stack, setStack] = React.useState<FileSystemHandle[]>(() => [files.handle]);

  const isItemExcluded = React.useCallback(
    (item: string) =>
      filter?.excludes
        .map((pattern) => pattern.replace(/^\*\*\/|\/\*\*$/g, ""))
        .some((pattern) => minimatch(item, pattern)) || false,
    [filter?.excludes]
  );

  switch (mode) {
    case "columns":
      return <RecursiveColumns stack={stack} setStack={setStack} isItemExcluded={isItemExcluded} />;
  }
}
