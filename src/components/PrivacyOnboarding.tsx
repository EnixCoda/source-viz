import {
  Box,
  Button,
  Code,
  Heading,
  HStack,
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

export const PRIVACY_ACK_KEY = "privacy-acknowledged";

interface PrivacyOnboardingProps {
  onAcknowledge: () => void;
}

export function PrivacyOnboarding({ onAcknowledge }: PrivacyOnboardingProps) {
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

  const handleAcknowledge = React.useCallback(() => {
    localStorage.setItem(PRIVACY_ACK_KEY, "1");
    onAcknowledge();
  }, [onAcknowledge]);

  const handleInstall = React.useCallback(async () => {
    if (installAvailable) {
      const result = await promptInstall();
      if (result === "accepted") {
        setInstalled(true);
      }
    } else if (isSafari()) {
      setShowSafariTip(true);
    }
  }, [installAvailable]);

  const canShowInstallButton = !installed && (installAvailable || isSafari());

  return (
    <Box
      flex={1}
      overflowY="auto"
      display="flex"
      alignItems="center"
      justifyContent="center"
      padding={6}
    >
      <VStack
        maxW="640px"
        w="100%"
        alignItems="stretch"
        spacing={6}
        bg="white"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.200"
        boxShadow="sm"
        padding={8}
      >
        <VStack alignItems="flex-start" spacing={2}>
          <Heading as="h2" size="lg">
            Your code never leaves your device
          </Heading>
          <Text color="gray.600">
            Source Viz scans and analyzes your project entirely in your browser.
            Read on so you know exactly what that means.
          </Text>
        </VStack>

        <List spacing={3}>
          <ListItem display="flex" alignItems="flex-start">
            <ListIcon as={MdCloudOff} color="blue.500" mt={1} boxSize={5} />
            <Box>
              <Text fontWeight="semibold">No server, no uploads</Text>
              <Text fontSize="sm" color="gray.600">
                There is no backend. File contents are read by your browser and
                processed by JavaScript and WebAssembly running locally.
              </Text>
            </Box>
          </ListItem>
          <ListItem display="flex" alignItems="flex-start">
            <ListIcon as={MdVerifiedUser} color="green.500" mt={1} boxSize={5} />
            <Box>
              <Text fontWeight="semibold">You stay in control</Text>
              <Text fontSize="sm" color="gray.600">
                The browser asks your permission before any folder is read.
                You can revoke access at any time.
              </Text>
            </Box>
          </ListItem>
          <ListItem display="flex" alignItems="flex-start">
            <ListIcon as={MdWifiOff} color="purple.500" mt={1} boxSize={5} />
            <Box>
              <Text fontWeight="semibold">Works fully offline once installed</Text>
              <Text fontSize="sm" color="gray.600">
                Install Source Viz as an app and it can run with your network
                disconnected — proof that nothing is being sent.
              </Text>
            </Box>
          </ListItem>
        </List>

        <Box bg="gray.50" borderRadius="md" padding={4} borderLeftWidth="4px" borderLeftColor="blue.400">
          <Text fontSize="sm" color="gray.700">
            <strong>Verify it yourself.</strong> Open your browser&apos;s
            DevTools, switch to the <Code fontSize="xs">Network</Code> tab,
            then start scanning. You will see no requests carrying your code.
          </Text>
        </Box>

        <HStack spacing={3} justifyContent="flex-end" flexWrap="wrap">
          {canShowInstallButton && (
            <Button
              variant="outline"
              colorScheme="blue"
              leftIcon={<DownloadIcon />}
              onClick={handleInstall}
            >
              Install for offline use
            </Button>
          )}
          <Button colorScheme="green" onClick={handleAcknowledge}>
            Got it, start scanning
          </Button>
        </HStack>

        {installed && (
          <Text fontSize="sm" color="green.600">
            ✓ Installed. You can disconnect from the network and Source Viz
            will keep working.
          </Text>
        )}

        {showSafariTip && !installed && (
          <Box bg="orange.50" borderRadius="md" padding={4} borderLeftWidth="4px" borderLeftColor="orange.400">
            <Text fontSize="sm" color="gray.800" fontWeight="semibold" mb={1}>
              To install on Safari
            </Text>
            <Text fontSize="sm" color="gray.700">
              Tap the <strong>Share</strong> button{" "}
              <Icon as={ExternalLinkIcon} boxSize={3} />, then choose{" "}
              <strong>Add to Home Screen</strong> (iOS) or{" "}
              <strong>Add to Dock</strong> (macOS Sonoma or later).
            </Text>
          </Box>
        )}

        <Text fontSize="xs" color="gray.500" textAlign="center">
          Source Viz is open source.{" "}
          <Link
            href="https://github.com/EnixCoda/source-viz"
            isExternal
            color="blue.500"
          >
            Read the code on GitHub
          </Link>{" "}
          to verify these claims.
        </Text>
      </VStack>
    </Box>
  );
}
