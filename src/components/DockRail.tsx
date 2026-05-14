import { Badge, Box, IconButton, Tooltip, VStack } from "@chakra-ui/react";
import * as React from "react";

export type DockId = string;

/** Where a panel lives in the 4-zone layout. */
export type Zone = "left" | "right" | "bottom" | "closed";
/** @deprecated old 2-zone name, kept for migration code. */
export type DockPlacement = "primary" | "sidebar" | "closed";

export type DockDef = {
  id: DockId;
  label: string;
  icon: React.ReactElement;
  badge?: React.ReactNode;
  /** Default zone the panel opens into. Defaults to "right". */
  defaultZone?: Exclude<Zone, "closed">;
  /** When true, panel cannot be closed (e.g. the Visualization panel). */
  alwaysOpen?: boolean;
  /** Single letter shown as a Cmd/Ctrl shortcut hint. */
  shortcutKey?: string;
};

export function DockRail({
  docks,
  activeIds,
  onChange,
  side = "right",
  modifierHeld = false,
}: {
  docks: DockDef[];
  activeIds: ReadonlySet<DockId>;
  onChange: (id: DockId) => void;
  /** Which side this rail is rendered on — affects border + tooltip placement. */
  side?: "left" | "right";
  /** When true, show shortcutKey hints on icons that have one. */
  modifierHeld?: boolean;
}) {
  return (
    <VStack
      spacing={0.5}
      py={1}
      px={0.5}
      bg="gray.50"
      borderLeft={side === "right" ? "1px solid" : undefined}
      borderRight={side === "left" ? "1px solid" : undefined}
      borderColor="gray.200"
      height="100%"
      flexShrink={0}
      width="36px"
      alignItems="center"
    >
      {docks.map((d) => {
        const isActive = activeIds.has(d.id);
        const showHint = modifierHeld && !!d.shortcutKey;
        return (
          <Box key={d.id} position="relative">
            <Tooltip label={d.label} placement={side === "right" ? "left" : "right"} hasArrow openDelay={300}>
              <IconButton
                aria-label={d.label}
                icon={d.icon}
                size="sm"
                variant={isActive ? "solid" : "ghost"}
                colorScheme={isActive ? "blue" : "gray"}
                onClick={() => onChange(d.id)}
              />
            </Tooltip>
            {showHint && (
              <Badge
                position="absolute"
                bottom="-2px"
                right="-2px"
                fontSize="0.6em"
                fontFamily="mono"
                colorScheme="purple"
                borderRadius="sm"
                px={0.5}
                lineHeight="1.4"
                pointerEvents="none"
                textTransform="uppercase"
              >
                {d.shortcutKey}
              </Badge>
            )}
            {!showHint && d.badge != null && d.badge !== 0 && d.badge !== "" && (
              <Badge
                position="absolute"
                top="-2px"
                right="-2px"
                fontSize="0.55em"
                colorScheme="blue"
                borderRadius="full"
                px={1}
                pointerEvents="none"
              >
                {d.badge}
              </Badge>
            )}
          </Box>
        );
      })}
    </VStack>
  );
}
