import {
  Box,
  Button,
  Code,
  Heading,
  Icon,
  Link,
  List,
  ListIcon,
  ListItem,
  Text,
  VStack,
} from "@chakra-ui/react";
import { DownloadIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { MdCloudOff, MdVerifiedUser, MdWifiOff } from "react-icons/md";
import * as React from "react";
import {
  canPromptInstall,
  isSafari,
  isStandalone,
  promptInstall,
  subscribeInstallAvailability,
} from "../lib/pwa-install";

export function PrivacyPanel() {
  const [installAvailable, setInstallAvailable] = React.useState(canPromptInstall());
  const [installed, setInstalled] = React.useState(isStandalone());
  const [showSafariTip, setShowSafariTip] = React.useState(false);

  React.useEffect(() => {
    const unsub = subscribeInstallAvailability(() => {
      setInstallAvailable(canPromptInstall());
      setInstalled(isStandalone());
    });
    return unsub;
  }, []);

  const handleInstall = React.useCallback(async () => {
    if (installAvailable) {
      const result = await promptInstall();
      if (result === "accepted") setInstalled(true);
    } else if (isSafari()) {
      setShowSafariTip(true);
    }
  }, [installAvailable]);

  const canShowInstallButton = !installed && (installAvailable || isSafari());

  return (
    <VStack
      maxW="640px"
      w="100%"
      alignItems="stretch"
      spacing={5}
      bg="white"
      borderRadius="lg"
      borderWidth="1px"
      borderColor="gray.200"
      boxShadow="sm"
      padding={6}
    >
      <VStack alignItems="flex-start" spacing={1}>
        <Heading as="h2" size="md">
          Your code never leaves your device
        </Heading>
        <Text fontSize="sm" color="gray.600">
          Source Viz scans and analyzes your project entirely in your browser.
        </Text>
      </VStack>

      <List spacing={3}>
        <ListItem display="flex" alignItems="flex-start">
          <ListIcon as={MdCloudOff} color="blue.500" mt={1} boxSize={5} />
          <Box>
            <Text fontWeight="semibold" fontSize="sm">No server, no uploads</Text>
            <Text fontSize="xs" color="gray.600">
              There is no backend. File contents are processed by JavaScript and
              WebAssembly running locally.
            </Text>
          </Box>
        </ListItem>
        <ListItem display="flex" alignItems="flex-start">
          <ListIcon as={MdVerifiedUser} color="green.500" mt={1} boxSize={5} />
          <Box>
            <Text fontWeight="semibold" fontSize="sm">You stay in control</Text>
            <Text fontSize="xs" color="gray.600">
              The browser asks your permission before any folder is read. You
              can revoke access at any time.
            </Text>
          </Box>
        </ListItem>
        <ListItem display="flex" alignItems="flex-start">
          <ListIcon as={MdWifiOff} color="purple.500" mt={1} boxSize={5} />
          <Box>
            <Text fontWeight="semibold" fontSize="sm">Works fully offline once installed</Text>
            <Text fontSize="xs" color="gray.600">
              Install Source Viz as an app and it can run with your network
              disconnected — proof that nothing is being sent.
            </Text>
          </Box>
        </ListItem>
      </List>

      <Box bg="gray.50" borderRadius="md" padding={3} borderLeftWidth="4px" borderLeftColor="blue.400">
        <Text fontSize="xs" color="gray.700">
          <strong>Verify it yourself.</strong> Open your browser&apos;s DevTools,
          switch to the <Code fontSize="2xs">Network</Code> tab, then start
          scanning. You will see no requests carrying your code.
        </Text>
      </Box>

      {canShowInstallButton && (
        <Button
          variant="outline"
          colorScheme="blue"
          leftIcon={<DownloadIcon />}
          onClick={handleInstall}
          alignSelf="flex-start"
          size="sm"
        >
          Install for offline use
        </Button>
      )}

      {installed && (
        <Text fontSize="xs" color="green.600">
          ✓ Installed. You can disconnect from the network and Source Viz will
          keep working.
        </Text>
      )}

      {showSafariTip && !installed && (
        <Box bg="orange.50" borderRadius="md" padding={3} borderLeftWidth="4px" borderLeftColor="orange.400">
          <Text fontSize="xs" color="gray.800" fontWeight="semibold" mb={1}>
            To install on Safari
          </Text>
          <Text fontSize="xs" color="gray.700">
            Tap the <strong>Share</strong> button{" "}
            <Icon as={ExternalLinkIcon} boxSize={3} />, then choose{" "}
            <strong>Add to Home Screen</strong> (iOS) or{" "}
            <strong>Add to Dock</strong> (macOS Sonoma or later).
          </Text>
        </Box>
      )}

      <Text fontSize="xs" color="gray.500">
        Source Viz is open source.{" "}
        <Link href="https://github.com/EnixCoda/source-viz" isExternal color="blue.500">
          Read the code on GitHub
        </Link>{" "}
        to verify these claims.
      </Text>
    </VStack>
  );
}
