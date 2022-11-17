import { Box, Button, List, ListItem, Spinner, Text } from "@chakra-ui/react";
import * as React from "react";
import { MetaFilter } from "../../../services";
import { getPatternsFileNameMatcher, run } from "../../../utils/general";

export function ColumnDirectory({
  fs,
  selected,
  onSelect,
  isExcluded,
  filter,
}: {
  fs: FileSystemHandle;
  selected?: FileSystemHandle;
  onSelect?(file: FileSystemHandle): void;
  isExcluded?: boolean;
  filter: MetaFilter;
}) {
  const [width] = React.useState(200);
  const [files, setFiles] = React.useState<FileSystemHandle[] | null>(null);

  const isItemExcluded = React.useMemo(
    () => (isExcluded ? () => true : filter.excludes && getPatternsFileNameMatcher(filter.excludes)),
    [isExcluded, filter.excludes]
  );

  const isItemIncluded = React.useMemo(
    () => (isExcluded ? () => false : filter.includes && getPatternsFileNameMatcher(filter.includes)),
    [isExcluded, filter.includes]
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
      <Box width={width} display="inline-flex" justifyContent="center" paddingY={2}>
        <Spinner />
      </Box>
    );

  return (
    <List width={width} height="100%" overflowY="auto">
      {files.map((file) => (
        <ListItem key={file.name} onClick={() => onSelect?.(file)} whiteSpace="nowrap" fontFamily="monospace">
          <Button
            width="100%"
            textOverflow="ellipsis"
            fontWeight={file.kind === "file" ? "normal" : "semibold"}
            fontSize={14}
            lineHeight={1.5}
            height={6}
            background={selected === file ? "Highlight" : undefined}
            variant="ghost"
            textAlign="left"
            justifyContent="flex-start"
            color={isItemExcluded?.(file.name) ? "gray.400" : isItemIncluded(file.name) ? "orange.500" : undefined}
          >
            <Text overflow="hidden" textOverflow="ellipsis">
              {file.kind === "directory" ? "📁" : "📄"} {file.name}
            </Text>
          </Button>
        </ListItem>
      ))}
    </List>
  );
}
