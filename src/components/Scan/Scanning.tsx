import { ChevronLeftIcon, ChevronRightIcon, RepeatIcon } from "@chakra-ui/icons";
import { Accordion, Box, Button, Center, HStack, Heading, IconButton, Progress, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { useForgetableMemo } from "../../hooks/useForgetableMemo";
import { FSLike, MetaFilter, getDependencyEntries } from "../../services";
import { createWorkerParser, WorkerParser } from "../../services/parsers/worker-parser";
import { AdaptivePool, Budget } from "../../services/pool";
import { DependencyEntry } from "../../services/serializers";
import { getOrganizedEntries } from "../../utils/getOrganizedEntries";
import { resolvePath } from "../../utils/path";
import { getFilterMatchers } from "../../utils/pattern";
import { FS } from "../fs";
import { CollapsibleSection } from "../CollapsibleSection";
import { ExportButton } from "../ExportButton";
import { MonoText } from "../MonoText";
import { useAbortableEffect } from "../abortable";
import { ProgressTable } from "./ProgressTable";
import { useScanningStateReducer } from "./useScanningStateReducer";

export function Scanning({
  fs,
  onDataPrepared,
  filter,
  onCancel,
}: {
  fs: FS;
  onDataPrepared: React.Dispatch<DependencyEntry[]>;
  filter: MetaFilter;
  onCancel(): void;
}) {
  const [entries, setEntries] = React.useState<DependencyEntry[] | null>(null);
  const scanRunRef = React.useRef(0);

  const [{ phase, collectedCount, parsedCount, lastCollectedFile, errors, collectionComplete, hasError,
            scanDurationMs, fallbackCount, dependencyLinks }, dispatch] =
    useScanningStateReducer();

  const [abortableEffect, rescan] = useForgetableMemo(
    () => ({
      getAsyncGenerator: async function* (signal: AbortSignal) {
        const scanRun = ++scanRunRef.current;
        const isCurrentScan = () => scanRunRef.current === scanRun && !signal.aborted;
        const safeDispatch: typeof dispatch = (action) => {
          if (isCurrentScan()) dispatch(action);
        };

        safeDispatch({ type: "init" });

        const scanPromise = (async () => {
          let totalLinks = 0;
          try {
          // === Resource budgets ===
          // CPU budget = cores - 1 (leave one for UI). Shared by parser + fallback workers.
          // I/O budget = cores * 4, capped. Shared by dir scan + reader pools.
          // These are the only knobs; each pool's local cap is derived from them
          // and adjusted at runtime via AIMD where applicable.
          const cores = Math.max(2, navigator.hardwareConcurrency || 4);
          const cpuBudget = new Budget(Math.max(2, cores - 1));
          const ioBudget = new Budget(Math.min(64, cores * 4));
          const parserCap = Math.max(2, cpuBudget.capacity - 1);
          const fallbackCap = Math.max(1, Math.floor(cpuBudget.capacity / 4));
          const maxQueuedFiles = Math.min(2048, Math.max(128, ioBudget.capacity * 16));

          const [[isPathExcluded, isFileExcluded] = [], [, /* isPathIncluded */ isFileIncluded]] = filter
            ? getFilterMatchers(filter)
            : [];

          const reversePathMap: Map<string, FileSystemFileHandle> = new Map();

          // Try to read tsconfig.json for path alias resolution. Fire this in
          // parallel with directory scanning — it doesn't depend on collected files.
          const resolveAliasPromise = buildResolveAlias(fs.handle);

          // Streaming collection: a directory pool walks the tree in parallel
          // and pushes discovered file paths into a queue. The async generator
          // below yields paths as they arrive so getDependencyEntries can start
          // reading and parsing files while collection is still in progress.
          const collectFiles = (): AsyncGenerator<string> => {
            const queue: string[] = [];
            let wake: (() => void) | null = null;
            const roomWaiters: (() => void)[] = [];
            let scanError: unknown = null;
            const tryWake = () => {
              const fn = wake;
              wake = null;
              fn?.();
            };
            const notifyQueueRoom = () => {
              const waiters = roomWaiters.splice(0);
              for (const waiter of waiters) waiter();
            };
            signal.addEventListener("abort", () => {
              notifyQueueRoom();
              tryWake();
            }, { once: true });
            const waitForQueueRoom = async () => {
              while (!signal.aborted && queue.length >= maxQueuedFiles) {
                await new Promise<void>((resolve) => {
                  const onAbort = () => {
                    signal.removeEventListener("abort", onAbort);
                    resolve();
                  };
                  roomWaiters.push(() => {
                    signal.removeEventListener("abort", onAbort);
                    resolve();
                  });
                  signal.addEventListener("abort", onAbort, { once: true });
                });
              }
            };

            // Dir scan is I/O-bound — adaptive against the shared ioBudget.
            // Starts modest, grows under AIMD up to the budget ceiling.
            const dirPool = new AdaptivePool<{ handle: FileSystemDirectoryHandle; stack: string[] }, void>(
              ioBudget,
              async ({ handle, stack }) => {
                if (signal.aborted) return;
                for await (const item of handle.values()) {
                  if (signal.aborted) return;
                  if (isFileExcluded?.(item.name)) continue;
                  const path = stack.concat(item.name).join("/");
                  if (isPathExcluded?.(path)) continue;
                  if (item.kind === "file") {
                    const $item = item as FileSystemFileHandle;
                    if (isFileIncluded && !isFileIncluded($item.name)) continue;
                    await waitForQueueRoom();
                    if (signal.aborted) return;
                    reversePathMap.set(path, $item);
                    safeDispatch({ type: "collected", file: path });
                    queue.push(path);
                    tryWake();
                  } else {
                    // Recurse into subdirectory via the same pool — gives us
                    // bounded parallelism across siblings.
                    const $item = item as FileSystemDirectoryHandle;
                    pendingDirs.push(
                      dirPool.submit({ handle: $item, stack: stack.concat($item.name) }),
                    );
                  }
                }
              },
            );

            const pendingDirs: Promise<void>[] = [];
            pendingDirs.push(dirPool.submit({ handle: fs.handle, stack: [] }));

            // Wait for every dir scan (including those discovered mid-walk) to finish,
            // then signal completion to the generator below. We re-check the array
            // length because new submissions can be appended during iteration.
            const allDone = (async () => {
              try {
                for (let i = 0; i < pendingDirs.length; i++) {
                  await pendingDirs[i];
                }
              } catch (err) {
                scanError = err;
              } finally {
                safeDispatch({ type: "collection-complete" });
                tryWake();
              }
            })();

            return (async function* () {
              while (true) {
                while (queue.length > 0) {
                  const nextFile = queue.shift()!;
                  notifyQueueRoom();
                  yield nextFile;
                }
                if (scanError) throw scanError;
                // Check completion: if allDone has resolved AND queue is empty, stop.
                const settled = await Promise.race([
                  allDone.then(() => "done" as const),
                  new Promise<"woke">((r) => { wake = () => r("woke"); }),
                ]);
                if (signal.aborted) return;
                if (settled === "done" && queue.length === 0) return;
              }
            })();
          };

          // phase: read & parse files
          const [, [isIncluded] = []] = filter ? getFilterMatchers(filter) : [];

          const fsLike: FSLike = {
            resolvePath,
            resolveAlias: await resolveAliasPromise,
            readFile: async (path) => {
              if (signal.aborted) throw new Error("Scan aborted");
              const handle = reversePathMap.get(path);
              if (!handle) throw new Error(`No file found for "${path}"`);
              try {
                return await (await handle.getFile()).text();
              } finally {
                reversePathMap.delete(path);
              }
            },
          };

          // OXC is the fast primary parser; Babel workers are lazily loaded only
          // for files OXC cannot parse.
          const parserWorkers: WorkerParser[] = [];
          const disposeParserWorkers = () => {
            for (const worker of parserWorkers.splice(0)) worker.dispose();
          };
          signal.addEventListener("abort", disposeParserWorkers, { once: true });
          const oxcWorker = createWorkerParser(
            () => new Worker(new URL("../../services/parsers/oxc.worker.ts", import.meta.url), { type: "module" }),
            parserCap,
          );
          parserWorkers.push(oxcWorker);
          const parse = oxcWorker.parse;
          const fallbackParse = async () => {
            const babelWorker = createWorkerParser(
              () => new Worker(new URL("../../services/parsers/babel.worker.ts", import.meta.url), { type: "module" }),
              fallbackCap,
            );
            parserWorkers.push(babelWorker);
            return babelWorker.parse;
          };

          try {
            safeDispatch({ type: "scanning-started" });
            const entries = await getDependencyEntries(
              collectFiles(),
              parse,
              fsLike,
              isIncluded,
              {
                onFileError: (file, error) =>
                  safeDispatch({ type: "error", file, error: typeof error === "string" ? error : `${error}` }),
                onFileParsed(file) {
                  safeDispatch({ type: "parsed", file });
                },
                onFinalizing() {
                  safeDispatch({ type: "finalizing" });
                },
                onFallbackParsed() {
                  safeDispatch({ type: "fallback-parsed" });
                },
                fallbackParse,
                signal,
                limits: { ioBudget, cpuBudget, parserCap, fallbackCap },
              }
            );

            totalLinks = entries.reduce((sum, [, deps]) => sum + deps.length, 0);
            if (isCurrentScan()) setEntries(getOrganizedEntries(entries));
          } finally {
            signal.removeEventListener("abort", disposeParserWorkers);
            disposeParserWorkers();
          }
          } finally {
            safeDispatch({ type: "done", dependencyLinks: totalLinks });
          }
        })();

        const donePromise = scanPromise.then(() => true, () => true);
        while (!signal.aborted) {
          const finished = await Promise.race([
            donePromise,
            new Promise<false>((resolve) => setTimeout(() => resolve(false), 50)),
          ]);
          if (finished) break;
          yield;
        }

        if (signal.aborted) {
          scanPromise.catch(() => undefined);
          return;
        }
        await scanPromise;
      },
    }),
    [fs, filter, dispatch, setEntries]
  );
  const abortScan = useAbortableEffect(abortableEffect);
  const handleCancel = React.useCallback(() => {
    scanRunRef.current++;
    abortScan();
    onCancel?.();
  }, [abortScan, onCancel]);

  const problematicRecords = errors;

  const canVisualize = (entries?.length ?? 0) > 0;
  const isEmptyDone = phase === "done" && collectionComplete && collectedCount === 0;
  const showProgress = phase !== "done" || collectedCount > 0;
  const progressTitle =
    phase === "preparing"
      ? "Preparing scan"
      : phase === "finalizing"
        ? "Finalizing dependency graph"
        : phase === "done"
          ? "Scan progress"
          : collectionComplete
            ? "Parsing files"
            : "Scanning project";

  // Final stats (only shown in done phase)
  const durationSec = scanDurationMs != null ? (scanDurationMs / 1000).toFixed(1) : null;

  return (
    <VStack padding={2} alignItems="stretch" gap={2} flex={1} minH={0}>
      <VStack alignItems="stretch">
        <HStack justifyContent="space-between">
          <IconButton aria-label="Back" onClick={handleCancel} icon={<ChevronLeftIcon boxSize={6} />} />
        </HStack>

        {showProgress && (
          <Box>
            <HStack justifyContent="space-between" mb={1}>
              <Text fontSize="sm" fontWeight="bold">
                {progressTitle}
              </Text>
            </HStack>

            {phase === "preparing" ? (
              <Text fontSize="sm" color="gray.600">
                Initializing file scanner and parser workers…
              </Text>
            ) : (
              <>
                <HStack fontSize="sm" gap={2}>
                  <Text minWidth="80px" color="gray.600">
                    {collectionComplete ? "Found" : "Discovering"}
                  </Text>
                  <Text fontWeight="semibold">{collectedCount}</Text>
                  <Text color="gray.500">files</Text>
                  {!collectionComplete && (
                    <MonoText as="span" fontSize="xs" color="gray.500" isTruncated>
                      {lastCollectedFile}
                    </MonoText>
                  )}
                </HStack>

                <HStack fontSize="sm" gap={2} mt={1}>
                  <Text minWidth="80px" color="gray.600">Processed</Text>
                  <Text fontWeight="semibold">{parsedCount}</Text>
                  <Text color="gray.500">
                    / {collectionComplete ? collectedCount : `${collectedCount}+`}
                  </Text>
                </HStack>
              </>
            )}
            <Progress
              mt={1}
              value={collectionComplete && collectedCount > 0 ? (parsedCount / collectedCount) * 100 : 0}
              isIndeterminate={phase === "preparing" || phase === "finalizing" || !collectionComplete}
              size="sm"
            />
          </Box>
        )}

        {phase === "done" && (
          <Center>
            <VStack alignItems="stretch" width={280}>
              <Heading as="h2">
                {isEmptyDone ? "No matching files found" : hasError ? "Scan complete with issues" : "Scan complete"}
              </Heading>
              {isEmptyDone && (
                <Text fontSize="sm" color="gray.600">
                  Adjust the include/exclude filters or choose another folder.
                </Text>
              )}
              {!isEmptyDone && (
                <Box borderRadius="md" bg="gray.50" px={3} py={2}>
                  <VStack alignItems="stretch" gap={1} fontSize="sm" color="gray.700">
                    {durationSec != null && (
                      <HStack justifyContent="space-between">
                        <Text color="gray.500">Total time</Text>
                        <Text fontWeight="semibold">{durationSec}s</Text>
                      </HStack>
                    )}
                    <HStack justifyContent="space-between">
                      <Text color="gray.500">Files</Text>
                      <Text fontWeight="semibold">{collectedCount.toLocaleString()}</Text>
                    </HStack>
                    <HStack justifyContent="space-between">
                      <Text color="gray.500">Import links</Text>
                      <Text fontWeight="semibold">{dependencyLinks.toLocaleString()}</Text>
                    </HStack>
                    {fallbackCount > 0 && (
                      <HStack justifyContent="space-between">
                        <Text color="gray.500">Via Babel fallback</Text>
                        <Text fontWeight="semibold" color="orange.600">{fallbackCount.toLocaleString()}</Text>
                      </HStack>
                    )}
                  </VStack>
                </Box>
              )}
              <Button
                disabled={!canVisualize}
                colorScheme="green"
                onClick={() => entries && onDataPrepared(entries)}
                rightIcon={<ChevronRightIcon />}
              >
                Visualize
              </Button>

              {isEmptyDone && <Button onClick={handleCancel}>Back to filters</Button>}

              <Button onClick={() => rescan()} rightIcon={<RepeatIcon />}>
                Scan again
              </Button>

              {canVisualize && <ExportButton data={entries} />}

              {hasError && (
                <Text color="HighlightText" fontSize="sm">
                  {problematicRecords.length} file{problematicRecords.length === 1 ? "" : "s"} had errors. You can
                  proceed with the files that parsed successfully or rescan after fixing them.
                </Text>
              )}
            </VStack>
          </Center>
        )}
        <Accordion allowToggle>
          {problematicRecords.length > 0 && (
            <CollapsibleSection label={`Progress details (${problematicRecords.length} errors)`}>
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

/**
 * Try to read tsconfig.json from the project root and build a resolveAlias function
 * from compilerOptions.paths and baseUrl.
 *
 * Example tsconfig.json:
 *   { "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
 *
 * This maps `@/components/Foo` → `src/components/Foo`.
 */
async function buildResolveAlias(
  rootHandle: FileSystemDirectoryHandle,
): Promise<((importPath: string) => string | null) | undefined> {
  try {
    const tsconfigHandle = await rootHandle.getFileHandle("tsconfig.json");
    const text = await (await tsconfigHandle.getFile()).text();
    const tsconfig = JSON.parse(text);
    const paths: Record<string, string[]> | undefined = tsconfig?.compilerOptions?.paths;
    if (!paths || Object.keys(paths).length === 0) return undefined;

    const baseUrl: string = tsconfig?.compilerOptions?.baseUrl ?? ".";

    // Build prefix rules: { "@/*": ["src/*"] } → [{ prefix: "@/", targets: ["src/"] }]
    const rules = Object.entries(paths)
      .filter(([pattern, targets]) => pattern.endsWith("/*") && targets.length > 0)
      .map(([pattern, targets]) => ({
        prefix: pattern.slice(0, -1), // "@/*" → "@/"
        targets: targets
          .filter((t) => t.endsWith("/*"))
          .map((t) => {
            const dir = t.slice(0, -1); // "src/*" → "src/"
            return baseUrl === "." ? dir : baseUrl + "/" + dir;
          }),
      }))
      .filter((r) => r.targets.length > 0);

    if (rules.length === 0) return undefined;

    return (importPath: string): string | null => {
      for (const { prefix, targets } of rules) {
        if (importPath.startsWith(prefix)) {
          const rest = importPath.slice(prefix.length);
          // Return the first target mapping
          return targets[0] + rest;
        }
      }
      return null;
    };
  } catch {
    // No tsconfig.json or invalid — no alias resolution
    return undefined;
  }
}
