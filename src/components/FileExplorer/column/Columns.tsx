import { Box, HStack } from "@chakra-ui/react";
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
    <HStack alignItems="start" flex={1} overflow="auto" minH={0} maxH="100%" minW={0}>
      <RecursiveColumn stack={stack} setStack={setStack} filter={filter} />
    </HStack>
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
      <Box flexShrink={0} maxHeight="100%" overflow="auto">
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
                  scrollIntoView
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
