import { Badge, Box, IconButton, Tooltip, VStack } from "@chakra-ui/react";
import * as React from "react";

export type DockId = string;

export type DockDef = {
  id: DockId;
  label: string;
  icon: React.ReactElement;
  badge?: React.ReactNode;
};

export function DockRail({
  docks,
  activeId,
  onChange,
}: {
  docks: DockDef[];
  activeId: DockId | null;
  onChange: (id: DockId | null) => void;
}) {
  return (
    <VStack
      spacing={0.5}
      py={1}
      px={0.5}
      bg="gray.50"
      borderLeft="1px solid"
      borderColor="gray.200"
      height="100%"
      flexShrink={0}
      width="36px"
      alignItems="center"
    >
      {docks.map((d) => {
        const isActive = d.id === activeId;
        return (
          <Box key={d.id} position="relative">
            <Tooltip label={d.label} placement="left" hasArrow openDelay={300}>
              <IconButton
                aria-label={d.label}
                icon={d.icon}
                size="sm"
                variant={isActive ? "solid" : "ghost"}
                colorScheme={isActive ? "blue" : "gray"}
                onClick={() => onChange(isActive ? null : d.id)}
              />
            </Tooltip>
            {d.badge != null && d.badge !== 0 && d.badge !== "" && (
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
