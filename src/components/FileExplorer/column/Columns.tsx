import { HStack } from "@chakra-ui/react";
import * as React from "react";
import { MetaFilter } from "../../../services";
import { ReactState } from "../../../types";
import { switchRender } from "../../../utils/general";
import { getPatternsMatcher } from "../../../utils/pattern";
import { ColumnDirectory } from "./Directory";
import { ColumnFile } from "./File";

export function RecursiveColumns({ $stack, filter }: { $stack: ReactState<FileSystemHandle[]>; filter: MetaFilter }) {
  return (
    <HStack alignItems="stretch" flex={1} overflow="auto" minH={0} maxH="100%" minW={0}>
      <RecursiveColumn $stack={$stack} filter={filter} />
    </HStack>
  );
}

function RecursiveColumn({
  $stack,
  isExcluded,
  filter,
  depth = 0,
}: {
  $stack: ReactState<FileSystemHandle[]>;
  isExcluded?: boolean;
  filter: MetaFilter;
  depth?: number;
}) {
  const { value: stack } = $stack;
  const subStack = stack.slice(depth);
  const [cur, next] = subStack;
  const isItemExcluded = React.useMemo(
    () => (isExcluded ? () => true : filter.excludes && getPatternsMatcher(filter.excludes)),
    [isExcluded, filter.excludes],
  );
  const path = React.useMemo(
    () =>
      subStack
        .concat(cur)
        .map(({ name }) => name)
        .join("/"),
    [subStack, cur],
  );
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
                fs={cur}
                selected={next}
                onSelect={(f) => $stack.setValue(stack.slice(0, depth + 1).concat(f))}
                isExcluded={isItemExcluded?.(path)}
                filter={filter}
                scrollIntoView
                stack={stack}
              />
            ),
            file: () => <ColumnFile item={cur} stack={stack} />,
          },
          cur.kind,
        )}
      </HStack>
      {next && <RecursiveColumn depth={depth + 1} $stack={$stack} isExcluded={isExcluded} filter={filter} />}
    </>
  );
}
