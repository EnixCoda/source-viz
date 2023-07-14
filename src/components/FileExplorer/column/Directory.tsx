import { Button, HStack, List, ListItem, Spinner, Text } from "@chakra-ui/react";
import * as React from "react";
import { IIFC } from "react-iifc";
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
  stack,
}: {
  fs: FileSystemHandle;
  selected?: FileSystemHandle;
  onSelect?(file: FileSystemHandle): void;
  isExcluded?: boolean;
  filter: MetaFilter;
  scrollIntoView?: boolean;
  stack: FileSystemHandle[];
}) {
  const [size, setSize] = React.useState<Size2D>([200, 0]);
  const [width] = size;
  const { onPointerDown } = useResizeHandler(size, setSize);
  const [files, setFiles] = React.useState<FileSystemHandle[] | null>(null);
  const ref = React.useRef<HTMLOListElement | null>(null);

  const registryRef = React.useRef(new Set<() => Size2D[0]>());
  const makeAllItemsVisible = React.useCallback(() => {
    if (!ref.current) return;
    let maxGrowth = 0;
    for (const getWidthToGrow of registryRef.current) {
      const growth = getWidthToGrow();
      if (growth > maxGrowth) maxGrowth = growth;
    }
    // the extra 1px for fixing edge cases that text still truncated after resizing
    setSize(([width, height]) => [Math.ceil(width + maxGrowth) + 1, height]);
  }, []);

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
              color={
                isItemExcluded(file.name)
                  ? "gray.500"
                  : isItemIncluded(file.name)
                  ? "green.500"
                  : file.kind === "file"
                  ? "gray.500"
                  : undefined
              }
            >
              <IIFC>
                {() => {
                  // eslint-disable-next-line react-hooks/rules-of-hooks
                  const textRef = React.useRef<HTMLSpanElement>(null);
                  // eslint-disable-next-line react-hooks/rules-of-hooks
                  React.useEffect(() => {
                    // register
                    const measure = () => {
                      if (!textRef.current) return 0;
                      return textRef.current.scrollWidth - textRef.current.clientWidth;
                    };
                    registryRef.current.add(measure);

                    // unregister
                    return () => {
                      registryRef.current.delete(measure);
                    };
                  }, []);
                  return (
                    <Text ref={textRef} as="span" title={file.name} overflow="hidden" textOverflow="ellipsis">
                      {file.kind === "directory" ? "📁" : "📄"} {file.name}
                    </Text>
                  );
                }}
              </IIFC>
            </Button>
          </ListItem>
        ))}
      </List>
      <HorizontalResizeHandler onPointerDown={onPointerDown} onDoubleClick={makeAllItemsVisible} />
    </>
  );
}
