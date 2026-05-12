import {
  Box,
  Button,
  Code,
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { DownloadIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { MdCloudOff, MdLock, MdVerifiedUser, MdWifiOff } from "react-icons/md";
import * as React from "react";
import {
  canPromptInstall,
  isSafari,
  isStandalone,
  promptInstall,
  subscribeInstallAvailability,
} from "../lib/pwa-install";

type Claim = {
  icon: React.ComponentType;
  title: string;
  body: string;
};

const CLAIMS: Claim[] = [
  {
    icon: MdCloudOff,
    title: "No uploads. No server.",
    body: "There is no backend. Your files are read by JavaScript and WebAssembly running in this tab.",
  },
  {
    icon: MdLock,
    title: "You stay in control.",
    body: "The browser asks your permission before any folder is read. You can revoke it any time.",
  },
  {
    icon: MdWifiOff,
    title: "Works fully offline.",
    body: "Install Source Viz and run with your network disconnected — proof that nothing is being sent.",
  },
];

export function PrivacyPromise() {
  const [installAvailable, setInstallAvailable] = React.useState(canPromptInstall());
  const [installed, setInstalled] = React.useState(isStandalone());
  const [showSafariTip, setShowSafariTip] = React.useState(false);
  const safari = isSafari();

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
    } else if (safari) {
      setShowSafariTip(true);
    }
  }, [installAvailable, safari]);

  const canShowInstallButton = !installed && (installAvailable || safari);

  return (
    <Box
      borderWidth="1px"
      borderColor="green.100"
      borderRadius="xl"
      bg="white"
      overflow="hidden"
    >
      {/* Header band */}
      <HStack
        spacing={3}
        padding={5}
        borderBottomWidth="1px"
        borderColor="green.100"
        bg="green.50"
      >
        <Box as={MdVerifiedUser} fontSize="3xl" color="green.500" flexShrink={0} />
        <VStack alignItems="flex-start" spacing={0} flex={1}>
          <Heading as="h2" size="sm" color="green.800">
            Your code never leaves your device
          </Heading>
          <Text fontSize="sm" color="gray.700">
            Source Viz is a fully client-side app. We have no servers — and we
            cannot see your code even if we wanted to.
          </Text>
        </VStack>
      </HStack>

      {/* 3 claim columns */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={0}>
        {CLAIMS.map((c, i) => (
          <VStack
            key={c.title}
            alignItems="flex-start"
            spacing={2}
            padding={5}
            borderRightWidth={{ base: 0, md: i < CLAIMS.length - 1 ? "1px" : 0 }}
            borderBottomWidth={{ base: i < CLAIMS.length - 1 ? "1px" : 0, md: 0 }}
            borderColor="gray.100"
          >
            <Box as={c.icon} fontSize="xl" color="green.500" />
            <Text fontSize="sm" fontWeight="semibold" color="gray.800">
              {c.title}
            </Text>
            <Text fontSize="xs" color="gray.600">
              {c.body}
            </Text>
          </VStack>
        ))}
      </SimpleGrid>

      {/* Verify-it-yourself + install footer */}
      <VStack
        alignItems="stretch"
        spacing={3}
        padding={4}
        borderTopWidth="1px"
        borderColor="gray.100"
        bg="gray.50"
      >
        <HStack spacing={2} fontSize="xs" color="gray.600" flexWrap="wrap">
          <Text fontWeight="semibold">Verify it yourself:</Text>
          <Text>
            open DevTools → <Code fontSize="2xs">Network</Code> tab, then start
            scanning. You will see no requests carrying your code.
          </Text>
        </HStack>

        <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Text fontSize="xs" color="gray.600">
            Open source on GitHub.{" "}
            <Link href="https://github.com/EnixCoda/source-viz" isExternal color="blue.500">
              Read the code <ExternalLinkIcon mx="2px" />
            </Link>
          </Text>

          {canShowInstallButton && (
            <Button
              size="xs"
              variant="outline"
              colorScheme="green"
              leftIcon={<DownloadIcon />}
              onClick={handleInstall}
            >
              Install for offline use
            </Button>
          )}
          {installed && (
            <Text fontSize="xs" color="green.600" fontWeight="semibold">
              ✓ Installed — works without network.
            </Text>
          )}
        </HStack>

        {showSafariTip && !installed && (
          <Box
            bg="orange.50"
            borderLeftWidth="3px"
            borderColor="orange.300"
            padding={2}
          >
            <Text fontSize="xs" color="gray.600">
              <strong>Safari:</strong> tap <strong>Share</strong>, then{" "}
              <strong>Add to Home Screen</strong> (iOS) or{" "}
              <strong>Add to Dock</strong> (macOS Sonoma+).
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
