import { Button, HStack, Text } from "@chakra-ui/react";
import * as React from "react";

export function NodeInView({
  label,
  title = typeof label === "string" ? label : undefined,
  onExclude,
  onSelect,
  onCancel,
}: {
  label: React.ReactNode;
  title?: string;
  onExclude?: () => void;
  onSelect?: () => void;
  onCancel?: () => void;
}) {
  return (
    <HStack gap={1} whiteSpace="nowrap">
      {onExclude && (
        <Button size="xs" flexShrink={0} onClick={onExclude}>
          Exclude
        </Button>
      )}
      {onCancel && (
        <Button size="xs" flexShrink={0} onClick={onCancel}>
          Cancel
        </Button>
      )}
      {onSelect && (
        <Button size="xs" flexShrink={0} onClick={onSelect}>
          Select
        </Button>
      )}{" "}
      <Text fontSize="sm" overflow="hidden" textOverflow="ellipsis" fontFamily="Cascadia Code, monospace" title={title}>
        {label}
      </Text>
    </HStack>
  );
}
