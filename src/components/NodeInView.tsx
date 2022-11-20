import { Button, HStack, Text } from "@chakra-ui/react";
import * as React from "react";

export function NodeInView({
  label,
  onExclude,
  onSelect,
  onCancel,
}: {
  label: React.ReactNode;
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
      <Text overflow="hidden" textOverflow="ellipsis" title={typeof label === "string" ? label : undefined}>
        {label}
      </Text>
    </HStack>
  );
}
