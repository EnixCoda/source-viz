import {
  Badge,
  Box,
  Button,
  CloseButton,
  Heading,
  HStack,
  IconButton,
  Input,
  Select,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  createInvestigator,
  Investigator,
  InvestigatorFs,
  UsageHit,
} from "../../lib/usage-investigator";
import { MonoText } from "../MonoText";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** File whose exports we'll investigate. */
  file: string | null;
  /** Optional pre-selected export name (skip the picker). */
  initialSymbol?: string | null;
  fs: InvestigatorFs | null;
  knownFiles: Set<string>;
  dependencyMap: Map<string, Set<string>>;
  resolveAlias?: (spec: string) => string | null;
  /** Fired when the user toggles "highlight on graph". */
  onHighlightedFilesChange: (files: Set<string> | null) => void;
  /** Fired when the user clicks a result row to focus it. */
  onFocusFile: (file: string) => void;
  /** Navigate the panel to investigate a different file (chained exploration). */
  onNavigate: (file: string, symbol?: string) => void;
};

const KIND_BADGE: Record<UsageHit["kind"], { color: string; label: string }> = {
  origin: { color: "purple", label: "origin" },
  "re-export": { color: "blue", label: "re-export" },
  wrapper: { color: "orange", label: "wrapper" },
  caller: { color: "gray", label: "caller" },
};

export function InvestigatePanel(props: Props) {
  const { isOpen, onClose, file, initialSymbol, fs, knownFiles, dependencyMap, resolveAlias,
          onHighlightedFilesChange, onFocusFile, onNavigate } = props;

  const [investigator, setInvestigator] = React.useState<Investigator | null>(null);
  const [parserError, setParserError] = React.useState<string | null>(null);
  const [exports, setExports] = React.useState<string[] | null>(null);
  const [symbol, setSymbol] = React.useState<string | null>(initialSymbol ?? null);
  const [hits, setHits] = React.useState<UsageHit[]>([]);
  const [running, setRunning] = React.useState(false);
  const [highlight, setHighlight] = React.useState(true);
  const [pathFilter, setPathFilter] = React.useState("");

  const matchPath = React.useCallback((path: string) => {
    const f = pathFilter.trim();
    if (!f) return true;
    if (f.includes("*")) {
      const re = new RegExp(
        "^" + f.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$"
      );
      return re.test(path);
    }
    return path.toLowerCase().includes(f.toLowerCase());
  }, [pathFilter]);

  const filteredHits = React.useMemo(
    () => (pathFilter.trim() ? hits.filter((h) => matchPath(h.file)) : hits),
    [hits, pathFilter, matchPath]
  );

  React.useEffect(() => {
    if (!isOpen || !fs) return;
    let alive = true;
    (async () => {
      try {
        // @ts-expect-error — oxc-parser doesn't expose wasm.js in types
        const oxc = (await import("oxc-parser/src-js/wasm.js")) as typeof import("oxc-parser");
        if (!alive) return;
        const parse = (filename: string, source: string) => {
          const r = oxc.parseSync(filename, source, { sourceType: "unambiguous" });
          return { program: r.program as any, module: r.module as any };
        };
        const inv = createInvestigator({ fs, knownFiles, dependencyMap, resolveAlias, parse });
        setInvestigator(inv);
      } catch (err) {
        setParserError(`${err}`);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, fs, knownFiles, dependencyMap, resolveAlias]);

  React.useEffect(() => {
    if (!isOpen || !investigator || !file) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExports(null);
    investigator.listExports(file).then((list) => {
      if (!alive) return;
      setExports(list);
      if (initialSymbol && list.includes(initialSymbol)) {
        setSymbol(initialSymbol);
      } else if (list.length > 0) {
        setSymbol(list[0]);
      } else {
        setSymbol(null);
      }
    });
    return () => { alive = false; };
  }, [isOpen, investigator, file, initialSymbol]);

  React.useEffect(() => {
    if (!isOpen || !investigator || !file || !symbol) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([]);
      return;
    }
    let alive = true;
    setRunning(true);
    setHits([]);
    const collected: UsageHit[] = [];
    investigator
      .investigate({
        file,
        symbol,
        onHit: (h) => {
          if (!alive) return;
          collected.push(h);
          if (collected.length % 25 === 0) setHits([...collected]);
        },
      })
      .then((finalHits) => {
        if (!alive) return;
        setHits(finalHits);
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[investigate]", err);
      })
      .finally(() => {
        if (alive) setRunning(false);
      });
    return () => { alive = false; };
  }, [isOpen, investigator, file, symbol]);

  React.useEffect(() => {
    if (!isOpen || !highlight) {
      onHighlightedFilesChange(null);
      return;
    }
    const set = new Set<string>();
    for (const h of filteredHits) set.add(h.file);
    onHighlightedFilesChange(set);
  }, [isOpen, highlight, filteredHits, onHighlightedFilesChange]);

  const hopGroups = React.useMemo(() => {
    const groups = new Map<number, UsageHit[]>();
    for (const h of filteredHits) {
      let g = groups.get(h.hop);
      if (!g) { g = []; groups.set(h.hop, g); }
      g.push(h);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [filteredHits]);

  if (!isOpen) return null;

  return (
    <VStack
      alignItems="stretch"
      height="100vh"
      width={360}
      spacing={0}
      borderLeft="1px solid"
      borderColor="gray.200"
      bg="white"
    >
      <HStack justifyContent="space-between" px={4} py={3} borderBottom="1px solid" borderColor="gray.200">
        <Box minW={0} flex={1}>
          <Heading as="h2" size="sm">Investigate Usage</Heading>
          {file && <MonoText fontSize="xs" color="gray.500" mt={1} isTruncated>{file}</MonoText>}
        </Box>
        <CloseButton onClick={onClose} />
      </HStack>
      <Box flex={1} overflowY="auto" px={4} py={3}>
        {!fs ? (
          <Text color="orange.600">
            Investigation requires access to the source files. This dataset
            was loaded without source access (e.g. imported from CSV, or a
            demo dataset without bundled sources). Re-scan a local project
            folder to enable investigation.
          </Text>
        ) : parserError ? (
          <Text color="red.600">Failed to load parser: {parserError}</Text>
        ) : !investigator ? (
          <HStack><Spinner size="sm" /><Text>Loading parser…</Text></HStack>
        ) : exports === null ? (
          <HStack><Spinner size="sm" /><Text>Parsing file…</Text></HStack>
        ) : exports.length === 0 ? (
          <Text color="gray.500">This file has no investigable named exports.</Text>
        ) : (
          <VStack alignItems="stretch" spacing={3}>
            <Box>
              <Text fontSize="sm" fontWeight="bold" mb={1}>Export</Text>
              <Select
                value={symbol ?? ""}
                onChange={(e) => setSymbol(e.target.value || null)}
                size="sm"
              >
                {exports.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </Select>
            </Box>

            <HStack>
              <Button size="xs" variant={highlight ? "solid" : "outline"} colorScheme="yellow"
                onClick={() => setHighlight((v) => !v)}>
                {highlight ? "Hide highlight" : "Show on graph"}
              </Button>
              {running && <Spinner size="xs" />}
              <Text fontSize="xs" color="gray.500">
                {hits.length} hits{pathFilter.trim() ? ` (${filteredHits.length} matching filter)` : ""}
              </Text>
            </HStack>

            <Box>
              <Input
                size="xs"
                placeholder="Filter results by path (e.g. /pages/ or *.page.tsx)"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
              />
            </Box>

            <Box>
              {hopGroups.length === 0 && !running && (
                <Text fontSize="sm" color="gray.500">No usages found.</Text>
              )}
              <VirtualHitList
                hopGroups={hopGroups}
                onFocusFile={onFocusFile}
                onNavigate={onNavigate}
                originFile={file}
                dependencyMap={dependencyMap}
              />
            </Box>
          </VStack>
        )}
      </Box>
    </VStack>
  );
}

type FlatHitRow =
  | { type: "header"; hop: number; count: number }
  | { type: "hit"; hit: UsageHit };

const HIT_ROW_HEIGHT = 48;
const HEADER_ROW_HEIGHT = 24;

function VirtualHitList({
  hopGroups,
  onFocusFile,
  onNavigate,
  originFile,
  dependencyMap,
}: {
  hopGroups: [number, UsageHit[]][];
  onFocusFile: (file: string) => void;
  onNavigate: (file: string, symbol?: string) => void;
  originFile: string | null;
  dependencyMap: Map<string, Set<string>>;
}) {
  const [chainFor, setChainFor] = React.useState<string | null>(null);

  const chain = React.useMemo(() => {
    if (!chainFor || !originFile) return null;
    if (chainFor === originFile) return [chainFor];
    const queue: string[] = [chainFor];
    const visited = new Set<string>([chainFor]);
    const parent = new Map<string, string>();
    while (queue.length) {
      const cur = queue.shift()!;
      const next = dependencyMap.get(cur);
      if (!next) continue;
      for (const n of next) {
        if (visited.has(n)) continue;
        visited.add(n);
        parent.set(n, cur);
        if (n === originFile) {
          const path: string[] = [n];
          let p: string | undefined = cur;
          while (p) {
            path.unshift(p);
            p = parent.get(p);
          }
          return path.reverse();
        }
        queue.push(n);
      }
    }
    return null;
  }, [chainFor, originFile, dependencyMap]);
  const flatRows = React.useMemo<FlatHitRow[]>(() => {
    const rows: FlatHitRow[] = [];
    for (const [hop, group] of hopGroups) {
      rows.push({ type: "header", hop, count: group.length });
      for (const hit of group) rows.push({ type: "hit", hit });
    }
    return rows;
  }, [hopGroups]);

  const parentRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => flatRows[i].type === "header" ? HEADER_ROW_HEIGHT : HIT_ROW_HEIGHT,
    overscan: 10,
  });

  if (flatRows.length === 0) return null;

  return (
    <Box ref={parentRef} overflow="auto" maxHeight="60vh">
      <Box style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const row = flatRows[vItem.index];
          if (row.type === "header") {
            return (
              <Box
                key={vItem.key}
                position="absolute"
                top={0}
                left={0}
                width="100%"
                style={{ height: vItem.size, transform: `translateY(${vItem.start}px)` }}
              >
                <Text fontSize="xs" color="gray.600" mt={2}>
                  Hop {row.hop} {row.hop === 0 ? "(origin)" : `· ${row.count} hit${row.count === 1 ? "" : "s"}`}
                </Text>
              </Box>
            );
          }
          const h = row.hit;
          const isChainOpen = chainFor === h.file;
          return (
            <Box
              key={vItem.key}
              position="absolute"
              top={0}
              left={0}
              width="100%"
              style={{ height: vItem.size, transform: `translateY(${vItem.start}px)` }}
            >
              <HStack
                spacing={2}
                px={2}
                py={1}
                borderRadius="sm"
                _hover={{ bg: "gray.100", cursor: "pointer" }}
                onClick={() => onFocusFile(h.file)}
              >
                <Badge colorScheme={KIND_BADGE[h.kind].color} fontSize="0.6em">
                  {KIND_BADGE[h.kind].label}
                </Badge>
                <Box minW={0} flex={1}>
                  <Text fontSize="sm" fontWeight="medium" isTruncated>{h.symbol}</Text>
                  <MonoText fontSize="xs" color="gray.500" isTruncated>{h.file}</MonoText>
                </Box>
                <IconButton
                  aria-label="Show import chain"
                  icon={<Text fontSize="xs">⛓</Text>}
                  size="xs"
                  variant={isChainOpen ? "solid" : "ghost"}
                  title="Show import chain to origin"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChainFor(isChainOpen ? null : h.file);
                  }}
                />
                {(h.kind === "re-export" || h.kind === "wrapper") && (
                  <IconButton
                    aria-label={`Investigate ${h.file}`}
                    icon={<Text fontSize="xs">🔍</Text>}
                    size="xs"
                    variant="ghost"
                    title="Investigate this file's exports"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(h.file, h.symbol);
                    }}
                  />
                )}
              </HStack>
              {isChainOpen && (
                <Box pl={6} pr={2} pb={1} bg="gray.50">
                  {chain ? (
                    chain.map((p, i) => (
                      <MonoText
                        key={`${p}-${i}`}
                        fontSize="xs"
                        color={p === originFile ? "purple.600" : "gray.700"}
                        cursor="pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusFile(p);
                        }}
                      >
                        {i === 0 ? "" : "→ "}{p}
                      </MonoText>
                    ))
                  ) : (
                    <Text fontSize="xs" color="gray.500">No import path found.</Text>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
