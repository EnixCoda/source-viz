import { ChevronLeftIcon, ChevronRightIcon, RepeatIcon } from "@chakra-ui/icons";
import { Accordion, Box, Button, Center, HStack, Heading, IconButton, Progress, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { FSLike, MetaFilter, getDependencyEntries } from "../../services";
import * as babelParser from "../../services/parsers/babel";
import { DependencyEntry } from "../../services/serializers";
import { switchRender } from "../../utils/general";
import { getOrganizedEntries } from "../../utils/getOrganizedEntries";
import { resolvePath } from "../../utils/path";
import { getFilterMatchers } from "../../utils/pattern";
import { FS } from "../App";
import { CollapsibleSection } from "../CollapsibleSection";
import { ExportButton } from "../ExportButton";
import { MonoText } from "../MonoText";
import { useAbortableFunction } from "../abortable";
import { EntriesTable } from "./EntriesTable";
import { ProgressTable } from "./ProgressTable";
import { useScanningStateReducer } from "./useScanningStateReducer";

export function Scanning({
  fs,
  onDataPrepared,
  filter,
  onCancel,
}: {
  fs: FS;
  onDataPrepared: React.Dispatch<DependencyEntry[] | null>;
  filter: MetaFilter;
  onCancel(): void;
}) {
  const [entries, setEntries] = React.useState<DependencyEntry[] | null>(null);

  const [{ phase, progress, hasError }, dispatch] = useScanningStateReducer();

  const scan = useAbortableFunction(
    React.useCallback(
      async function* (signal: AbortSignal) {
        try {
          dispatch({ type: "init" });

          const [[isPathExcluded, isFileExcluded] = [], [, /* isPathIncluded */ isFileIncluded]] = filter
            ? getFilterMatchers(filter)
            : [];

          // phase: collect files
          const traverse = async function (
            handle: FileSystemDirectoryHandle,
            onFile: (handle: FileSystemFileHandle, stack: string[]) => void | Promise<void>,
            stack: string[] = [],
          ) {
            for await (const item of handle.values()) {
              if (signal.aborted) return;
              if (isFileExcluded(item.name)) continue;
              if (isPathExcluded(stack.concat(item.name).join("/"))) continue;
              if (item.kind === "file") {
                const $item = item as FileSystemFileHandle;
                if (isFileIncluded($item.name)) await onFile($item, stack.concat(item.name));
              } else {
                const $item = item as FileSystemDirectoryHandle;
                await traverse($item, onFile, stack.concat($item.name));
              }
            }
          };

          const reversePathMap: Map<string, FileSystemFileHandle> = new Map();
          const pathMap: Map<FileSystemFileHandle, string> = new Map();
          const handles: FileSystemFileHandle[] = [];
          yield await traverse(fs.handle, (handle, stack) => {
            handles.push(handle);
            const path = stack.join("/");
            pathMap.set(handle, path);
            reversePathMap.set(path, handle);
            dispatch({ type: "collecting", file: path });
          });

          // phase: read & parse files
          const [, [isIncluded] = []] = filter ? getFilterMatchers(filter) : [];
          const fsLike: FSLike = {
            resolvePath,
            readFile: async (path) => {
              const handle = reversePathMap.get(path);
              if (!handle) throw new Error(`No file found for "${path}"`);
              return (await handle.getFile()).text();
            },
          };
          const entries = await getDependencyEntries(
            new Set(pathMap.values()),
            await babelParser.prepare(),
            fsLike,
            isIncluded,
            {
              onFileError: (file, error) =>
                dispatch({ type: "error", file, error: typeof error === "string" ? error : `${error}` }),
              onFileParsed(file) {
                dispatch({ type: "parsing", file });
              },
            },
          );

          setEntries(getOrganizedEntries(entries));
        } finally {
          dispatch({ type: "done" });
        }
      },
      [fs, filter, dispatch],
    ),
  );

  React.useEffect(() => {
    scan();
  }, [scan]);

  const parsedRecords = React.useMemo(() => progress.filter(([, parsed, error]) => parsed || error), [progress]);
  const problematicRecords = React.useMemo(() => progress.filter(([, , error]) => error), [progress]);

  return (
    <VStack padding={2} alignItems="stretch" gap={2} flex={1} minH={0}>
      <VStack alignItems="stretch">
        <HStack justifyContent="space-between">
          <IconButton aria-label="Back" onClick={() => onCancel?.()} icon={<ChevronLeftIcon />} />
          {phase === "done" && <ExportButton data={entries} />}
        </HStack>
        <Box>
          {switchRender(
            {
              collecting: () => (
                <>
                  <Text>Collected {progress.length} files, the last one is</Text>
                  <MonoText as="span">{progress.at(-1)?.[0]}</MonoText>
                </>
              ),
              parsing: () => (
                <>
                  <Text>Parsed {parsedRecords.length} files, the last one is</Text>
                  <MonoText as="span">{parsedRecords.at(-1)?.[0]}</MonoText>
                </>
              ),
            },
            phase,
          )}
        </Box>
        {phase === "parsing" && <Progress value={(parsedRecords.length / progress.length) * 100} />}
        {phase === "done" && (
          <Center>
            <VStack alignItems="stretch" width={280}>
              <Heading as="h2">Scan complete</Heading>
              <Button
                disabled={!entries}
                colorScheme="green"
                onClick={() => entries && onDataPrepared(entries)}
                rightIcon={<ChevronRightIcon />}
              >
                Visualize
              </Button>

              <Button onClick={() => scan()} rightIcon={<RepeatIcon />}>
                Scan again
              </Button>

              {hasError && (
                <Text color="HighlightText">
                  However, there are some errors found during the progress. You can either proceed on or rerun scan
                  after fixing them.
                </Text>
              )}
            </VStack>
          </Center>
        )}
        <Accordion allowToggle>
          {phase === "done" && entries && (
            <CollapsibleSection label="Dependency records">
              <Box maxHeight="50vh" overflowY="auto">
                <EntriesTable entries={entries} showImportType />
              </Box>
            </CollapsibleSection>
          )}
          {problematicRecords.length > 0 && (
            <CollapsibleSection label="Progress details (errors)">
              <Box maxHeight="50vh" overflowY="auto">
                <ProgressTable progress={problematicRecords} />
              </Box>
            </CollapsibleSection>
          )}
        </Accordion>
      </VStack>
    </VStack>
  );
}
