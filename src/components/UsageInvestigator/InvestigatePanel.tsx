import {
  Badge,
  Box,
  Button,
  CloseButton,
  Heading,
  HStack,
  IconButton,
  Select,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import * as React from "react";
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    for (const h of hits) set.add(h.file);
    onHighlightedFilesChange(set);
  }, [isOpen, highlight, hits, onHighlightedFilesChange]);

  const hopGroups = React.useMemo(() => {
    const groups = new Map<number, UsageHit[]>();
    for (const h of hits) {
      let g = groups.get(h.hop);
      if (!g) { g = []; groups.set(h.hop, g); }
      g.push(h);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [hits]);

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
              <Text fontSize="xs" color="gray.500">{hits.length} hits</Text>
            </HStack>

            <Box>
              {hopGroups.length === 0 && !running && (
                <Text fontSize="sm" color="gray.500">No usages found.</Text>
              )}
              {hopGroups.map(([hop, group]) => (
                <Box key={hop} mb={3}>
                  <Text fontSize="xs" color="gray.600" mb={1}>
                    Hop {hop} {hop === 0 ? "(origin)" : `· ${group.length} hit${group.length === 1 ? "" : "s"}`}
                  </Text>
                  <VStack alignItems="stretch" spacing={1}>
                    {group.map((h, i) => (
                      <HStack
                        key={`${h.file}::${h.symbol}::${i}`}
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
                    ))}
                  </VStack>
                </Box>
              ))}
            </Box>
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
