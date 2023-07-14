import { HStack } from "@chakra-ui/react";
import * as React from "react";
import { MetaFilter } from "../../../services";
import { getPatternsMatcher, switchRender } from "../../../utils/general";
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
    <HStack alignItems="stretch" flex={1} overflow="auto" minH={0} maxH="100%" minW={0}>
      <RecursiveColumn stack={stack} setStack={setStack} filter={filter} />
    </HStack>
  );
}

function RecursiveColumn({
  stack,
  setStack,
  isExcluded,
  filter,
  depth = 0,
}: {
  stack: FileSystemHandle[];
  setStack: React.Dispatch<React.SetStateAction<FileSystemHandle[]>>;
  isExcluded?: boolean;
  filter: MetaFilter;
  depth?: number;
}) {
  const subStack = stack.slice(depth);
  const [first, second] = subStack;
  const isItemExcluded = React.useMemo(
    () => (isExcluded ? () => true : filter.excludes && getPatternsMatcher(filter.excludes)),
    [isExcluded, filter.excludes],
  );
  const isFirstExcluded = isItemExcluded?.(first.name);
  return (
    <>
      <HStack
        spacing={0}
        flexShrink={0}
        // height="100%"
        overflow="auto"
      >
        {switchRender(
          {
            directory: () => (
              <ColumnDirectory
                fs={first}
                selected={second}
                onSelect={(f) => setStack([first].concat(f))}
                isExcluded={isFirstExcluded}
                filter={filter}
                scrollIntoView
                stack={stack}
              />
            ),
            file: () => <ColumnFile item={first} stack={stack} />,
          },
          first.kind,
        )}
      </HStack>
      {second && (
        <RecursiveColumn
          depth={depth + 1}
          stack={stack}
          setStack={(subStack) =>
            typeof subStack === "function"
              ? setStack((stack) => [first].concat(subStack(stack.slice(depth))))
              : setStack([first].concat(subStack))
          }
          isExcluded={isExcluded}
          filter={filter}
        />
      )}
    </>
  );
}
