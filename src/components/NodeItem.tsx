import { Button, HStack } from "@chakra-ui/react";
import * as React from "react";
import { MonoText } from "./MonoText";

export type NodeItemProps = {
  label: React.ReactNode;
  title?: string;
  onExclude?: () => void;
  onSelect?: () => void;
  onCancel?: () => void;
};

export function NodeItem({
  label,
  title = typeof label === "string" ? label : undefined,
  onExclude,
  onSelect,
  onCancel,
}: NodeItemProps) {
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
      <MonoText fontSize="sm" overflow="hidden" textOverflow="ellipsis" title={title}>
        {label}
      </MonoText>
    </HStack>
  );
}
