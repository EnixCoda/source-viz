import { SearchIcon } from "@chakra-ui/icons";
import {
  Box,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Kbd,
  Modal,
  ModalContent,
  ModalOverlay,
  Text,
  VStack,
} from "@chakra-ui/react";
import * as React from "react";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  group: "action" | "node";
  run: () => void;
  keywords?: string;
};

const MAX_RESULTS = 50;

function score(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  const idx = h.indexOf(n);
  if (idx === -1) {
    // Subsequence match for fuzzy
    let i = 0, j = 0, hits = 0;
    while (i < h.length && j < n.length) {
      if (h[i] === n[j]) { j++; hits++; }
      i++;
    }
    if (j < n.length) return 0;
    return 0.3 + (hits / h.length) * 0.4;
  }
  // Exact match bonus
  return idx === 0 ? 1 : 0.7 + (1 / (idx + 1)) * 0.2;
}

export function CommandPalette({
  isOpen,
  onClose,
  actions,
}: {
  isOpen: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}) {
  const [query, setQuery] = React.useState("");
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setActiveIdx(0);
      // Focus after the modal animation
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) {
      // Show actions first when no query
      return actions.filter((a) => a.group === "action").slice(0, MAX_RESULTS);
    }
    return actions
      .map((a) => ({ a, s: score(a.label + " " + (a.keywords ?? ""), query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_RESULTS)
      .map((x) => x.a);
  }, [actions, query]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered, activeIdx]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = filtered[activeIdx];
      if (sel) {
        sel.run();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(2px)" />
      <ModalContent shadow="2xl" mt="10vh" maxH="70vh">
        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search nodes or actions…"
            border="none"
            fontSize="md"
            _focusVisible={{ boxShadow: "none" }}
          />
        </InputGroup>
        <Box borderTop="1px solid" borderColor="gray.100" overflowY="auto" maxH="55vh">
          <VStack spacing={0} alignItems="stretch">
            {filtered.length === 0 && (
              <Text px={4} py={3} color="gray.400" fontSize="sm">
                No matches
              </Text>
            )}
            {filtered.map((a, i) => {
              const active = i === activeIdx;
              return (
                <HStack
                  key={a.id}
                  px={3}
                  py={2}
                  spacing={2}
                  bg={active ? "blue.50" : undefined}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    a.run();
                    onClose();
                  }}
                  cursor="pointer"
                  justifyContent="space-between"
                >
                  <HStack spacing={2} minW={0} flex={1}>
                    <Text
                      fontSize="0.65em"
                      color={a.group === "action" ? "purple.500" : "gray.500"}
                      textTransform="uppercase"
                      letterSpacing="wider"
                      flexShrink={0}
                      w="40px"
                    >
                      {a.group === "action" ? "Cmd" : "Node"}
                    </Text>
                    <Text
                      fontSize="sm"
                      fontFamily={a.group === "node" ? "mono" : undefined}
                      noOfLines={1}
                      flex={1}
                    >
                      {a.label}
                    </Text>
                  </HStack>
                  {a.hint && (
                    <Text fontSize="xs" color="gray.400" flexShrink={0}>
                      {a.hint}
                    </Text>
                  )}
                </HStack>
              );
            })}
          </VStack>
        </Box>
        <HStack borderTop="1px solid" borderColor="gray.100" px={3} py={1.5} fontSize="xs" color="gray.500" spacing={3}>
          <HStack spacing={1}><Kbd fontSize="0.6em">↑↓</Kbd><Text>navigate</Text></HStack>
          <HStack spacing={1}><Kbd fontSize="0.6em">↵</Kbd><Text>select</Text></HStack>
          <HStack spacing={1}><Kbd fontSize="0.6em">Esc</Kbd><Text>close</Text></HStack>
        </HStack>
      </ModalContent>
    </Modal>
  );
}
