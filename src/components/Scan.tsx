import { ChevronLeftIcon, ChevronRightIcon, RepeatIcon, SmallCloseIcon, InfoIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Center,
  Divider,
  Flex,
  Heading,
  HStack,
  IconButton,
  Input,
  List,
  ListItem,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import * as React from "react";
import { getDependencyEntries, MetaFilter } from "../services";
import * as babelParser from "../services/parsers/babel";
import { DependencyEntry } from "../services/serializers";
import { getFilterMatchers, resolvePath } from "../utils/general";
import { FS } from "./App";
import { ExportButton } from "./ExportButton";
import { FileExplorer } from "./FileExplorer";

export const defaultIncludes = ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"];

export const defaultExcludes = [
  "**/*.d.ts",
  "**/.git",
  "**/.cache",
  "**/node_modules",
  "**/build",
  "**/dist",
  "**/packages",
];

export function Filter({
  files,
  onCancel,
  setFilter,
}: {
  files: FS;
  onCancel(): void;
  setFilter: React.Dispatch<MetaFilter>;
}) {
  const [includes, setIncludes] = React.useState(defaultIncludes);
  const [excludes, setExcludes] = React.useState(defaultExcludes);

  const filter = React.useMemo(() => ({ includes, excludes }), [includes, excludes]);

  return (
    <HStack alignItems="flex-start" flex={1} minH={0} padding={2}>
      <VStack width={240} flexShrink={0} alignItems="stretch" overflow="auto" minH={0} maxH="100%">
        <HStack>
          <IconButton icon={<ChevronLeftIcon />} onClick={() => onCancel()} aria-label="Back" />
          <Heading as="h2" size="lg">
            Filter files
          </Heading>
        </HStack>
        <Text fontSize="sm">
          Reduce scan scope with the filters below if scan takes too much time. You can preview include/exclude scope in
          the right-side file explorer.
        </Text>
        <VStack alignItems="stretch">
          <Button colorScheme="green" onClick={() => setFilter({ includes, excludes })}>
            Next
          </Button>
        </VStack>

        <Divider />

        <Box>
          <InfoIcon />

          <Text fontSize="sm">
            Note: filters below accept glob patterns. Use <code>**</code> to match any amount of folders, use{" "}
            <code>*</code> to match filename of any length.
          </Text>
        </Box>

        <VStack as="section" gap={1} minH={0} overflow="auto">
          <VStack alignItems="stretch">
            <Heading as="h3" size="md">
              Entry files
            </Heading>
            <Text fontSize="sm">
              Files match these patterns will be read and parsed. They are
              <Text as="span" color="orange.500">
                {" "}
                highlighted{" "}
              </Text>
              in the list.
            </Text>
            <InputList values={includes} onChange={setIncludes} />
          </VStack>
          <VStack alignItems="stretch">
            <Heading as="h3" size="md">
              Exclude files
            </Heading>
            <Text fontSize="sm">
              Files, folders, and content inside matched folders will not be scanned. They are
              <Text as="span" color="gray.400">
                {" "}
                dimmed{" "}
              </Text>
              in the list.
            </Text>
            <InputList values={excludes} onChange={setExcludes} />
          </VStack>
        </VStack>
      </VStack>
      <Flex flex={1} overflow="auto" minH={0} maxH="100%">
        <FileExplorer files={files} filter={filter} />
      </Flex>
    </HStack>
  );
}

function InputList({ values, onChange }: { values: string[]; onChange(values: string[]): void }) {
  return (
    <VStack direction="column">
      <List display="inline-flex" flexDirection="column" maxHeight={600} gap={1}>
        {values.map((value, index) => (
          <ListItem key={index} display="inline-flex" gap={1}>
            <Input
              value={value}
              placeholder="glob pattern, like **/folder/**"
              onChange={(e) => onChange(values.map((value, j) => (index === j ? e.target.value : value)))}
            />
            <IconButton
              onClick={() => onChange(values.filter((_, j) => j !== index))}
              icon={<SmallCloseIcon />}
              aria-label="Remove"
            />
          </ListItem>
        ))}
      </List>
      <Button onClick={() => onChange(values.concat(""))}>Add</Button>
    </VStack>
  );
}

function Scanning({
  fs,
  onDataPrepared,
  filter,
  onCancel,
}: {
  fs: FS;
  onDataPrepared: React.Dispatch<DependencyEntry[] | null>;
  filter: MetaFilter;
  onCancel?(): void;
}) {
  const [inProgress, setInProgress] = React.useState(true);
  const [[processingFile, progress], setProgress] = React.useState<[file: string, count: number]>(["", 0]);
  const [data, setData] = React.useState<DependencyEntry[] | null>(null);
  const [errors, setErrors] = React.useState<[file: string, error: unknown][]>([]);

  const scan = React.useCallback(async () => {
    try {
      setInProgress(true);
      setProgress(["", 0]);
      setErrors([]);
      setData(null);

      let count = 0;
      const updateCollectingProgress = () => setProgress(["Collecting files", count]);
      updateCollectingProgress();

      const [
        [isPathExcluded, isFileExcluded] = [],
        // [isPathIncluded, isFileIncluded],
      ] = filter ? getFilterMatchers(filter) : [];

      const traverse = async (
        handle: FileSystemDirectoryHandle,
        onFile: (handle: FileSystemFileHandle, stack: string[]) => void | Promise<void>,
        stack: string[] = []
      ) => {
        for await (const item of handle.values()) {
          if (isFileExcluded(item.name)) continue;
          if (isPathExcluded(stack.concat(item.name).join("/"))) continue;
          if (item.kind === "file") {
            ++count;
            updateCollectingProgress();
            const $item = item as FileSystemFileHandle;
            // if (isPathIncluded(stack.concat(item.name).join("/")) || isFileIncluded(item.name))
            await onFile($item, stack.concat(item.name));
          } else {
            const $item = item as FileSystemDirectoryHandle;
            await traverse($item, onFile, stack.concat($item.name));
          }
        }
      };

      const reversePathMap: Map<string, FileSystemFileHandle> = new Map();

      const handles: FileSystemFileHandle[] = [];
      await traverse(fs.handle, async (handle, stack) => {
        handles.push(handle);
        const path = stack.join("/");
        fs.pathMap.set(handle, path);
        reversePathMap.set(path, handle);
      });

      setProgress(["", 0]);

      const [, [isIncluded] = []] = filter ? getFilterMatchers(filter) : [];
      const entries = await getDependencyEntries(
        Array.from(fs.pathMap.values()),
        await babelParser.prepare(),
        {
          resolvePath,
          readFile: async (path) => {
            const handle = reversePathMap.get(path);
            if (!handle) throw new Error(`No file found for "${path}"`);
            return (await handle.getFile()).text();
          },
        },
        isIncluded,
        {
          onError: (file, error) => setErrors((errors) => errors.concat([[file, error]])),
          reportProgress(file, count) {
            setProgress([file, count]);
          },
        }
      );

      setData(entries);
    } catch (err) {
      setErrors((errors) => errors.concat([["", err instanceof Error ? err : new Error(`${err}` || `Unknown error`)]]));
    } finally {
      setInProgress(false);
    }
  }, [fs, setProgress, filter]);

  React.useEffect(() => {
    scan();
  }, [scan]);

  const hasError = errors.length > 0;

  return (
    <VStack padding={2} alignItems="stretch" gap={2} flex={1} minH={0}>
      {inProgress ? (
        <Box>
          <Text>Scanning {progress}th file</Text>
          <Text>{processingFile}</Text>
        </Box>
      ) : (
        <VStack alignItems="stretch">
          <HStack justifyContent="space-between">
            {onCancel && <IconButton aria-label="Back" onClick={() => onCancel?.()} icon={<ChevronLeftIcon />} />}
            <ExportButton data={data} />
          </HStack>
          <Center>
            <VStack alignItems="stretch" maxWidth={240}>
              {hasError ? (
                <>
                  <Text color="HighlightText">Scan has completed.</Text>
                  <Text color="HighlightText">
                    However, there are some errors found during the progress. You can either proceed on or rerun scan
                    after fixing them.
                  </Text>
                </>
              ) : (
                <Text>Scan has completed successfully.</Text>
              )}

              <Button
                disabled={!data}
                colorScheme="green"
                onClick={() => data && onDataPrepared(data)}
                rightIcon={<ChevronRightIcon />}
              >
                Visualize
              </Button>

              <Button onClick={() => scan()} rightIcon={<RepeatIcon />}>
                Scan again
              </Button>
            </VStack>
          </Center>
        </VStack>
      )}
      {hasError && (
        <VStack alignItems="stretch" minH={0}>
          <Heading as="h2">Errors</Heading>
          <VStack alignItems="stretch" minH={0} overflow="auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>File</Th>
                  <Th>Error</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {errors.map(([file, error], index) => (
                  <Tr key={index}>
                    <Td>{file}</Td>
                    <Td>{error instanceof Error ? error.message : `${error}`}</Td>
                    <Td></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </VStack>
        </VStack>
      )}
    </VStack>
  );
}

export function Scan({
  fileSystem,
  onDataPrepared,
  onCancel,
}: {
  fileSystem: FS;
  onDataPrepared: React.Dispatch<DependencyEntry[] | null>;
  onCancel?(): void;
}) {
  const [filter, setFilter] = React.useState<MetaFilter | null>(null);

  return filter ? (
    <Scanning fs={fileSystem} onDataPrepared={onDataPrepared} filter={filter} onCancel={onCancel} />
  ) : (
    <Filter onCancel={() => onCancel?.()} files={fileSystem} setFilter={setFilter} />
  );
}
