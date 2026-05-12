import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  CloseButton,
  Link,
  Text,
} from "@chakra-ui/react";
import * as React from "react";
import { BrowserCapabilities } from "../lib/browserCapabilities";

const DISMISS_KEY = "source-viz:browser-banner-dismissed";

export function BrowserSupportBanner({ caps }: { caps: BrowserCapabilities }) {
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (caps.fullySupported || dismissed) return null;

  const missing: string[] = [];
  if (!caps.fileSystemAccess) missing.push("File System Access (showDirectoryPicker)");
  if (!caps.indexedDB) missing.push("IndexedDB");
  if (!caps.workers) missing.push("Web Workers");
  if (!caps.wasm) missing.push("WebAssembly");

  const isCritical = !caps.canScanLocal;
  const status = isCritical ? "error" : "warning";
  const title = isCritical
    ? "Limited browser support"
    : "Some features may be unavailable";

  return (
    <Alert status={status} flexShrink={0} px={6}>
      <AlertIcon />
      <Box flex={1}>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <Text fontSize="sm">
            For the full experience, please use{" "}
            <Link
              href="https://www.google.com/chrome/"
              isExternal
              color="blue.600"
              textDecoration="underline"
            >
              Chrome
            </Link>{" "}
            or{" "}
            <Link
              href="https://www.microsoft.com/edge"
              isExternal
              color="blue.600"
              textDecoration="underline"
            >
              Edge
            </Link>
            . {isCritical ? "Local project scanning is unavailable in this browser." : "You can still load exported data and try the demo."}
            {" "}
            Missing: {missing.join(", ")}.
          </Text>
        </AlertDescription>
      </Box>
      <CloseButton
        onClick={() => {
          try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
          setDismissed(true);
        }}
      />
    </Alert>
  );
}
