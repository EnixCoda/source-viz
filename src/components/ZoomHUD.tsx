import { AddIcon, MinusIcon, RepeatIcon } from "@chakra-ui/icons";
import { ButtonGroup, HStack, IconButton, Text, Tooltip } from "@chakra-ui/react";

export function ZoomHUD({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onScreenshot,
  onRebuildLayout,
  layoutStale,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onScreenshot?: () => void;
  onRebuildLayout?: () => void;
  layoutStale?: boolean;
}) {
  return (
    <HStack
      position="absolute"
      bottom={2}
      left={2}
      zIndex={5}
      bg="whiteAlpha.900"
      backdropFilter="blur(4px)"
      borderRadius="md"
      shadow="sm"
      border="1px solid"
      borderColor="gray.200"
      px={1}
      py={0.5}
      spacing={0.5}
    >
      <ButtonGroup size="xs" variant="ghost" spacing={0}>
        <Tooltip label="Zoom out" hasArrow openDelay={300}>
          <IconButton aria-label="Zoom out" icon={<MinusIcon />} onClick={onZoomOut} />
        </Tooltip>
        <Text px={1} fontSize="xs" minW="46px" textAlign="center" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {Math.round(zoom * 100)}%
        </Text>
        <Tooltip label="Zoom in" hasArrow openDelay={300}>
          <IconButton aria-label="Zoom in" icon={<AddIcon />} onClick={onZoomIn} />
        </Tooltip>
        <Tooltip label="Fit to view" hasArrow openDelay={300}>
          <IconButton aria-label="Fit" icon={<FitIcon />} onClick={onFit} />
        </Tooltip>
        <Tooltip label="Reset zoom (1:1)" hasArrow openDelay={300}>
          <IconButton aria-label="Reset" icon={<ResetIcon />} onClick={onReset} />
        </Tooltip>
        {onScreenshot && (
          <Tooltip label="Save PNG" hasArrow openDelay={300}>
            <IconButton aria-label="Screenshot" icon={<CameraIcon />} onClick={onScreenshot} />
          </Tooltip>
        )}
        {onRebuildLayout && (
          <Tooltip label={layoutStale ? "Layout stale — rebuild" : "Rebuild layout"} hasArrow openDelay={300}>
            <IconButton
              aria-label="Rebuild layout"
              icon={<RepeatIcon />}
              colorScheme={layoutStale ? "blue" : undefined}
              variant={layoutStale ? "solid" : "ghost"}
              onClick={onRebuildLayout}
            />
          </Tooltip>
        )}
      </ButtonGroup>
    </HStack>
  );
}

function FitIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="10" height="10" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M2 5h2l1-1h6l1 1h2v8H2z" />
      <circle cx="8" cy="9" r="2.5" />
    </svg>
  );
}
