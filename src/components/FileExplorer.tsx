import { Box, Button, List, ListItem } from "@chakra-ui/react";
import minimatch from "minimatch";
import * as React from "react";
import { run } from "../utils/general";
import { FS } from "./App";
import { MetaFilter } from "./Scan";

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
  return <FileExplorerColumns files={files.handle} />;
}

function FileExplorerColumns({ files, filter }: { files: FileSystemHandle; filter?: MetaFilter }) {
  const [stack, setStack] = React.useState<FileSystemHandle[]>([files]);

  return (
    <Box display="inline-flex">
      {stack.map((item, depth) => (
        <div key={item.name}>
          {item.kind === "directory" ? (
            <FileExplorerDirectory
              fs={item}
              onSelect={(f) => {
                setStack((stack) => stack.slice(0, depth + 1).concat(f));
              }}
            />
          ) : (
            "1"
          )}
        </div>
      ))}
    </Box>
  );
}

function FileExplorerDirectory({
  fs,
  filter,
  onSelect,
}: {
  fs: FileSystemHandle;
  filter?: MetaFilter;
  onSelect?(file: FileSystemHandle): void;
}) {
  const isExcluded = React.useCallback(
    (item: string) => filter?.excludes?.some((pattern) => minimatch(item, pattern)) || false,
    [filter?.excludes]
  );

  const [files, setFiles] = React.useState<FileSystemHandle[]>([]);
  React.useEffect(() => {
    let stop = false;
    run(async () => {
      if (fs instanceof FileSystemDirectoryHandle) {
        const items = fs.values();
        const files: FileSystemHandle[] = [];
        for await (const item of items) {
          if (stop) return;
          files.push(item);
        }
        setFiles(files);
      }
    });
    return () => {
      stop = true;
    };
  }, [fs]);

  return (
    <List>
      {files.map((file) => (
        <ListItem key={file.name} onClick={() => onSelect?.(file)} whiteSpace="nowrap" fontFamily="monospace">
          <Button
            width="100%"
            // fontWeight="normal"
            variant="ghost"
            textAlign="left"
            justifyContent="flex-start"
            colorScheme={isExcluded?.(file.name) ? "gray" : undefined}
          >
            {file.name}
          </Button>
        </ListItem>
      ))}
    </List>
  );
}
