import { CloseIcon } from "@chakra-ui/icons";
import { Box, Button, HStack, Tag, TagCloseButton, TagLabel, Text, Tooltip } from "@chakra-ui/react";

export type ActiveFilter = {
  id: string;
  label: string;
  value: string;
  tooltip?: string;
  onRemove?: () => void;
};

export function ActiveFiltersBar({
  filters,
  onClearAll,
}: {
  filters: ActiveFilter[];
  onClearAll?: () => void;
}) {
  if (filters.length === 0) return null;

  return (
    <Box
      px={2}
      py={1}
      bg="blue.50"
      borderBottom="1px solid"
      borderColor="blue.100"
      flexShrink={0}
      overflowX="auto"
      whiteSpace="nowrap"
    >
      <HStack spacing={1.5} alignItems="center">
        <Text fontSize="xs" color="gray.600" flexShrink={0}>
          Filters:
        </Text>
        {filters.map((f) => (
          <Tooltip key={f.id} label={f.tooltip ?? `${f.label}: ${f.value}`} hasArrow openDelay={300}>
            <Tag size="sm" colorScheme="blue" borderRadius="full" flexShrink={0} maxW="280px">
              <TagLabel display="flex" gap={1} overflow="hidden" textOverflow="ellipsis">
                <Text as="span" color="blue.700" opacity={0.8}>
                  {f.label}:
                </Text>
                <Text as="span" fontFamily="mono" overflow="hidden" textOverflow="ellipsis">
                  {f.value}
                </Text>
              </TagLabel>
              {f.onRemove && <TagCloseButton onClick={f.onRemove} />}
            </Tag>
          </Tooltip>
        ))}
        {onClearAll && filters.some((f) => f.onRemove) && (
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<CloseIcon boxSize={2} />}
            onClick={onClearAll}
            flexShrink={0}
          >
            Clear
          </Button>
        )}
      </HStack>
    </Box>
  );
}
