import { SmallCloseIcon } from "@chakra-ui/icons";
import { Box, IconButton, Input, InputGroup, InputRightElement, Tooltip, VStack, useCallbackRef } from "@chakra-ui/react";
import { IIFC } from "react-iifc";
import { safeRegExp } from "../../utils/general";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Entry = { value: string; isRegex: boolean };

/** Convert internal entry to the string pattern stored in MetaFilter */
function toPattern(entry: Entry): string {
  return entry.isRegex ? entry.value : escapeRegex(entry.value);
}

/** Guess whether a stored pattern was a plain string (escaped) or a raw regex */
function fromPattern(pattern: string): Entry {
  // Try un-escaping: if roundtrip matches, treat as plain string
  const unescaped = pattern.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");
  const isLikelyPlain = escapeRegex(unescaped) === pattern;
  return { value: isLikelyPlain ? unescaped : pattern, isRegex: !isLikelyPlain };
}

function FilterInput({
  entry,
  onChange,
  onRemove,
}: {
  entry: Entry;
  onChange(entry: Entry): void;
  onRemove(): void;
}) {
  const { value, isRegex } = entry;
  const isInvalid = isRegex && value !== "" && safeRegExp(value, "i") === false;

  return (
    <InputGroup size="sm">
      <Input
        value={value}
        onChange={(e) => onChange({ value: e.target.value, isRegex })}
        isInvalid={isInvalid}
        focusBorderColor={isInvalid ? "red.500" : undefined}
        placeholder={isRegex ? "Regular Expression" : "Plain text"}
        borderRadius="md"
        pr="4rem"
      />
      <InputRightElement width="4rem" gap={0.5} justifyContent="flex-end" pr={1}>
        <Tooltip label={isRegex ? "Regex mode — click for plain text" : "Plain text — click for regex"} fontSize="xs">
          <Box
            as="button"
            fontSize="10px"
            fontFamily="mono"
            borderRadius="sm"
            border="1px solid"
            lineHeight={1}
            w="18px"
            h="18px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            borderColor={isRegex ? "green.400" : "gray.300"}
            color={isRegex ? "green.600" : "gray.400"}
            bg={isRegex ? "green.50" : "transparent"}
            cursor="pointer"
            onClick={() => onChange({ value, isRegex: !isRegex })}
            aria-label="Toggle regex mode"
            flexShrink={0}
          >
            .*
          </Box>
        </Tooltip>
        <IconButton
          size="xs"
          variant="ghost"
          icon={<SmallCloseIcon />}
          aria-label="Remove"
          onClick={onRemove}
        />
      </InputRightElement>
    </InputGroup>
  );
}

export function FilterInputList({ values, onChange }: { values: string[]; onChange(values: string[]): void }) {
  // Convert stored patterns → internal entries (preserve regex toggle state via heuristic)
  const entries: Entry[] = values.map(fromPattern);

  const update = (newEntries: Entry[]) => onChange(newEntries.map(toPattern));

  return (
    <VStack alignItems="stretch" gap={1}>
      {entries.map((entry, index) => (
        <IIFC key={index}>
          {() => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const onChangeEntry = useCallbackRef((e: Entry) =>
              update(entries.map((cur, j) => (index === j ? e : cur)))
            );
            return (
              <FilterInput
                entry={entry}
                onChange={onChangeEntry}
                onRemove={() => update(entries.filter((_, j) => j !== index))}
              />
            );
          }}
        </IIFC>
      ))}
      <IconButton
        size="sm"
        variant="outline"
        icon={<>+</>}
        aria-label="Add pattern"
        onClick={() => update(entries.concat({ value: "", isRegex: false }))}
        alignSelf="flex-start"
      />
    </VStack>
  );
}
