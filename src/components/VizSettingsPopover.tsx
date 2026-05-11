import { SettingsIcon } from "@chakra-ui/icons";
import {
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import * as React from "react";

export function VizSettingsPopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover placement="top-start" isLazy>
      <Tooltip label="Viz settings" hasArrow openDelay={300}>
        <PopoverTrigger>
          <IconButton
            aria-label="Viz settings"
            icon={<SettingsIcon />}
            size="sm"
            position="absolute"
            top={2}
            right={2}
            zIndex={5}
            bg="whiteAlpha.900"
            backdropFilter="blur(4px)"
            shadow="sm"
            border="1px solid"
            borderColor="gray.200"
            _hover={{ bg: "white" }}
          />
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent width="280px">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontSize="xs" fontWeight="semibold" textTransform="uppercase" color="gray.600">
          Viz settings
        </PopoverHeader>
        <PopoverBody maxHeight="60vh" overflowY="auto">
          <VStack alignItems="stretch" spacing={2}>
            {children}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
