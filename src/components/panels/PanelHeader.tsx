import { ChevronDownIcon, CloseIcon } from "@chakra-ui/icons";
import {
  HStack,
  Heading,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Tooltip,
} from "@chakra-ui/react";
import * as React from "react";
import { PanelDef, Placement } from "./types";

const PLACEMENT_LABEL: Record<Exclude<Placement, "closed">, string> = {
  primary: "Move to primary",
  secondary: "Move to secondary",
  sidebar: "Move to sidebar",
};

export function PanelHeader({
  def,
  placement,
  onMove,
  onClose,
  extra,
}: {
  def: PanelDef;
  placement: Placement;
  onMove: (to: Placement) => void;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const zones: Array<Exclude<Placement, "closed">> = ["primary", "secondary", "sidebar"];
  return (
    <HStack
      px={2}
      py={1}
      bg="gray.50"
      borderBottom="1px solid"
      borderColor="gray.200"
      flexShrink={0}
      justifyContent="space-between"
      spacing={1}
    >
      <Heading as="h2" size="xs" color="gray.700" isTruncated>
        {def.label}
      </Heading>
      <HStack spacing={0}>
        {extra}
        <Menu placement="bottom-end" isLazy>
          <Tooltip label="Move panel" hasArrow openDelay={300}>
            <MenuButton
              as={IconButton}
              aria-label="Move panel"
              icon={<ChevronDownIcon />}
              size="xs"
              variant="ghost"
            />
          </Tooltip>
          <MenuList minW="160px" fontSize="sm">
            {zones
              .filter(z => z !== placement)
              .map(z => (
                <MenuItem key={z} onClick={() => onMove(z)}>
                  {PLACEMENT_LABEL[z]}
                </MenuItem>
              ))}
            {!def.alwaysOpen && (
              <>
                <MenuDivider />
                <MenuItem onClick={onClose}>Close panel</MenuItem>
              </>
            )}
          </MenuList>
        </Menu>
        {!def.alwaysOpen && (
          <Tooltip label="Close panel" hasArrow openDelay={300}>
            <IconButton
              aria-label="Close panel"
              icon={<CloseIcon boxSize="0.6em" />}
              size="xs"
              variant="ghost"
              onClick={onClose}
            />
          </Tooltip>
        )}
      </HStack>
    </HStack>
  );
}
