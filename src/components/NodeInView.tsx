import { Button, ListItem } from "@chakra-ui/react";
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
    <ListItem display="flex" marginY={1} columnGap={1}>
      {onExclude && <Button size="xs" onClick={onExclude}>Exclude</Button>}
      {onCancel && <Button size="xs" onClick={onCancel}>Cancel</Button>}
      {onSelect && <Button size="xs" onClick={onSelect}>Select</Button>} <span>{label}</span>
    </ListItem>
  );
}
