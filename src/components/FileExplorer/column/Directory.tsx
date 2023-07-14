import { Button, HStack, List, ListItem, Spinner, Text } from "@chakra-ui/react";
import * as React from "react";
import { Size2D, useResizeHandler } from "../../../hooks/useResizeHandler";
import { MetaFilter } from "../../../services";
import { getPatternsMatcher, run } from "../../../utils/general";
import { HorizontalResizeHandler } from "../../HorizontalResizeHandler";

export function ColumnDirectory({
  fs,
  selected,
  onSelect,
  isExcluded,
  filter,
  scrollIntoView,
}: {
  fs: FileSystemHandle;
  selected?: FileSystemHandle;
  onSelect?(file: FileSystemHandle): void;
  isExcluded?: boolean;
  filter: MetaFilter;
  scrollIntoView?: boolean;
}) {
  const [size, setSize] = React.useState<Size2D>([200, 0]);
  const [width] = size;
  const { onPointerDown } = useResizeHandler(size, setSize);
  const [files, setFiles] = React.useState<FileSystemHandle[] | null>(null);
  const ref = React.useRef<HTMLOListElement | null>(null);

  React.useEffect(() => {
    if (files && ref.current && scrollIntoView) ref.current.scrollIntoView();
  }, [files, scrollIntoView]);

  const isItemExcluded = React.useMemo(
    () => (isExcluded ? () => true : filter.excludes && getPatternsMatcher(filter.excludes)),
    [isExcluded, filter.excludes],
  );

  const isItemIncluded = React.useMemo(
    () => (isExcluded ? () => false : filter.includes && getPatternsMatcher(filter.includes)),
    [isExcluded, filter.includes],
  );

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
        setFiles(files.sort((a, b) => (a.name > b.name ? 1 : -1)));
      }
    });
    return () => {
      stop = true;
    };
  }, [fs]);

  if (!files)
    return (
      <HStack width={width} justifyContent="center" paddingY={2}>
        <Spinner />
      </HStack>
    );

  return (
    <>
      <List ref={ref} width={width} height="100%" overflowY="auto">
        {files.map((file) => (
          <ListItem key={file.name} onClick={() => onSelect?.(file)} whiteSpace="nowrap">
            <Button
              width="100%"
              textOverflow="ellipsis"
              fontFamily="monospace"
              fontWeight="normal"
              fontSize={14}
              lineHeight={1.5}
              height={6}
              background={selected === file ? "Highlight" : undefined}
              variant="ghost"
              textAlign="left"
              justifyContent="flex-start"
              color={isItemExcluded?.(file.name) ? "gray.400" : isItemIncluded(file.name) ? "orange.500" : undefined}
            >
              <Text title={file.name} overflow="hidden" textOverflow="ellipsis">
                {file.kind === "directory" ? "📁" : "📄"} {file.name}
              </Text>
            </Button>
          </ListItem>
        ))}
      </List>
      <HorizontalResizeHandler onPointerDown={onPointerDown} />
    </>
  );
}
