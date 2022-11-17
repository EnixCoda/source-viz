import * as React from "react";
import { MetaFilter } from "../../services";
import { FS } from "../App";
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

export function FileExplorer({ files, filter }: { files: FS; filter: MetaFilter }) {
  const [mode] = React.useState<"columns">("columns");
  const [stack, setStack] = React.useState<FileSystemHandle[]>(() => [files.handle]);

  switch (mode) {
    case "columns":
      return <RecursiveColumns stack={stack} setStack={setStack} filter={filter} />;
  }
}
