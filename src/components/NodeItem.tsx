import { Button, HStack } from "@chakra-ui/react";
import * as React from "react";
import { MonoText } from "./MonoText";

export type NodeItemProps = {
  label: React.ReactNode;
  badge?: React.ReactNode;
  title?: string;
  onExclude?: () => void;
  onSelect?: () => void;
  onCancel?: () => void;
  onInvestigate?: () => void;
};

export function NodeItem({
  label,
  badge,
  title = typeof label === "string" ? label : undefined,
  onExclude,
  onSelect,
  onCancel,
  onInvestigate,
}: NodeItemProps) {
  return (
    <HStack gap={1} whiteSpace="nowrap">
      {onSelect && (
        <Button size="xs" flexShrink={0} onClick={onSelect}>
          Select
        </Button>
      )}
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
      {onInvestigate && (
        <Button size="xs" flexShrink={0} onClick={onInvestigate} title="Investigate exports">
          🔍
        </Button>
      )}
      <MonoText fontSize="sm" overflow="hidden" textOverflow="ellipsis" title={title}>
        {label}
      </MonoText>
      {badge}
    </HStack>
  );
}
