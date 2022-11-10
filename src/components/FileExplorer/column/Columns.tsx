import { Box } from "@chakra-ui/react";
import * as React from "react";
import { run } from "../../../utils/general";
import { ColumnDirectory } from "./Directory";
import { ColumnFile } from "./File";

export function RecursiveColumns({
  stack,
  setStack,
  isItemExcluded,
}: {
  stack: FileSystemHandle[];
  setStack: React.Dispatch<React.SetStateAction<FileSystemHandle[]>>;
  isItemExcluded?: (item: string) => boolean;
}) {
  return (
    <Box display="inline-flex" minHeight={400} height="100vh">
      <RecursiveColumn stack={stack} setStack={setStack} isItemExcluded={isItemExcluded} />
    </Box>
  );
}

function RecursiveColumn({
  stack,
  setStack,
  isExcluded,
  isItemExcluded,
}: {
  stack: FileSystemHandle[];
  setStack: React.Dispatch<React.SetStateAction<FileSystemHandle[]>>;
  isExcluded?: boolean;
  isItemExcluded?: (item: string) => boolean;
}) {
  const [first, second] = stack;
  const isFirstExcluded = isExcluded || isItemExcluded?.(first.name);
  return (
    <>
      <Box height="100%">
        {run(() => {
          switch (first.kind) {
            case "directory":
              return (
                <ColumnDirectory
                  fs={first}
                  selected={second}
                  onSelect={(f) => setStack([first].concat(f))}
                  isExcluded={isFirstExcluded}
                  isItemExcluded={isFirstExcluded ? () => true : isItemExcluded}
                />
              );
            case "file":
              return <ColumnFile item={first} />;
            default:
              return null;
          }
        })}
      </Box>
      {second && (
        <RecursiveColumn
          stack={stack.slice(1)}
          setStack={(subStack) =>
            typeof subStack === "function"
              ? setStack((stack) => [first].concat(subStack(stack.slice(1))))
              : setStack([first].concat(subStack))
          }
          isExcluded={isExcluded}
          isItemExcluded={isItemExcluded}
        />
      )}
    </>
  );
}
