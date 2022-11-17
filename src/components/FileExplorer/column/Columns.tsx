import { Box } from "@chakra-ui/react";
import * as React from "react";
import { MetaFilter } from "../../../services";
import { getPatternsFileNameMatcher, run } from "../../../utils/general";
import { ColumnDirectory } from "./Directory";
import { ColumnFile } from "./File";

export function RecursiveColumns({
  stack,
  setStack,
  filter,
}: {
  stack: FileSystemHandle[];
  setStack: React.Dispatch<React.SetStateAction<FileSystemHandle[]>>;
  filter: MetaFilter;
}) {
  return (
    <Box display="inline-flex" minHeight={400} height="100vh">
      <RecursiveColumn stack={stack} setStack={setStack} filter={filter} />
    </Box>
  );
}

function RecursiveColumn({
  stack,
  setStack,
  isExcluded,
  filter,
}: {
  stack: FileSystemHandle[];
  setStack: React.Dispatch<React.SetStateAction<FileSystemHandle[]>>;
  isExcluded?: boolean;
  filter: MetaFilter;
}) {
  const [first, second] = stack;
  const isItemExcluded = React.useMemo(
    () => (isExcluded ? () => true : filter.excludes && getPatternsFileNameMatcher(filter.excludes)),
    [isExcluded, filter.excludes]
  );
  const isFirstExcluded = isItemExcluded?.(first.name);
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
                  filter={filter}
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
          filter={filter}
        />
      )}
    </>
  );
}
