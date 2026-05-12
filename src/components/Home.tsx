import {
  Box,
  Button,
  Heading,
  HStack,
  SimpleGrid,
  Tag,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  MdAccountTree,
  MdFolderOpen,
  MdInsertChart,
  MdOutlineRocketLaunch,
  MdPlayCircleFilled,
  MdSearch,
  MdUploadFile,
} from "react-icons/md";
import * as React from "react";
import { BrowserCapabilities } from "../lib/browserCapabilities";
import { rememberProject } from "../lib/recentProjects";
import { BrowserSupportBanner } from "./BrowserSupportBanner";
import { FSLoadFilesButton } from "./FSLoadFilesButton";
import { LoadDataButton } from "./LoadDataButton";
import { PrivacyPromise } from "./PrivacyPromise";
import { GraphBackdrop } from "./GraphBackdrop";
import { RecentProjects } from "./RecentProjects";
import { FS } from "./fs";

import { DependencyEntry } from "../services/serializers";

export type HomeProps = {
  caps: BrowserCapabilities;
  onScanLocal: (fs: FS) => void;
  onLoadData: (data: DependencyEntry[]) => void;
  onLoadDemo: () => Promise<void>;
};

const FEATURES: { icon: React.ComponentType; label: string }[] = [
  { icon: MdAccountTree, label: "Dependency graph" },
  { icon: MdInsertChart, label: "Hotspots & coupling" },
  { icon: MdSearch, label: "Usage investigation" },
  { icon: MdOutlineRocketLaunch, label: "Cycle reduction" },
];

const STEPS = ["Scan", "Filter", "Explore"];

function StepFlow() {
  return (
    <HStack spacing={2} fontSize="sm" color="gray.600">
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <HStack spacing={1.5}>
            <Box
              w="20px"
              h="20px"
              borderRadius="full"
              bg="blue.100"
              color="blue.700"
              fontSize="xs"
              fontWeight="bold"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {i + 1}
            </Box>
            <Text>{step}</Text>
          </HStack>
          {i < STEPS.length - 1 && (
            <Box color="gray.400" fontSize="xs">→</Box>
          )}
        </React.Fragment>
      ))}
    </HStack>
  );
}

type ActionCardProps = {
  icon: React.ComponentType;
  title: string;
  description: string;
  action: React.ReactNode;
  highlight?: boolean;
  disabled?: boolean;
  disabledHint?: string;
};

function ActionCard({ icon, title, description, action, highlight, disabled, disabledHint }: ActionCardProps) {
  return (
    <VStack
      alignItems="stretch"
      spacing={3}
      padding={5}
      borderWidth="1px"
      borderRadius="lg"
      borderColor={highlight ? "green.300" : "gray.200"}
      bg={highlight ? "green.50" : "white"}
      boxShadow={highlight ? "md" : "sm"}
      opacity={disabled ? 0.55 : 1}
      transition="all 0.15s"
      _hover={{ boxShadow: disabled ? undefined : "md", borderColor: disabled ? undefined : (highlight ? "green.400" : "blue.300") }}
      position="relative"
      minH="180px"
    >
      <HStack spacing={2}>
        <Box as={icon} fontSize="2xl" color={highlight ? "green.500" : "blue.500"} />
        <Heading as="h3" size="sm">{title}</Heading>
        {highlight && (
          <Tag size="sm" colorScheme="green" ml="auto">Recommended</Tag>
        )}
      </HStack>
      <Text fontSize="sm" color="gray.600" flex={1}>
        {description}
      </Text>
      <Box>{action}</Box>
      {disabled && disabledHint && (
        <Text fontSize="xs" color="orange.600">{disabledHint}</Text>
      )}
    </VStack>
  );
}

export function Home({ caps, onScanLocal, onLoadData, onLoadDemo }: HomeProps) {
  const [demoLoading, setDemoLoading] = React.useState(false);

  const handleScanLoad = React.useCallback(
    async (fs: FS) => {
      // Persist for "Recent projects".
      try { await rememberProject(fs.handle); } catch { /* ignore */ }
      onScanLocal(fs);
    },
    [onScanLocal]
  );

  const handleReopenRecent = React.useCallback(
    (handle: FileSystemDirectoryHandle) => {
      onScanLocal({ handle });
    },
    [onScanLocal]
  );

  const handleDemoClick = React.useCallback(async () => {
    setDemoLoading(true);
    try {
      await onLoadDemo();
    } finally {
      setDemoLoading(false);
    }
  }, [onLoadDemo]);

  return (
    <VStack alignItems="stretch" spacing={0} flex={1} overflow="hidden">
      <BrowserSupportBanner caps={caps} />
      <Box flex={1} overflowY="auto">
        <VStack
          maxW="1100px"
          mx="auto"
          padding={{ base: 4, md: 8 }}
          spacing={8}
          alignItems="stretch"
        >
          {/* Hero — centered with animated network backdrop */}
          <Box position="relative" pt={6} pb={4} mx={{ base: -4, md: -8 }} px={{ base: 4, md: 8 }} overflow="hidden">
            <GraphBackdrop />
            <VStack spacing={4} textAlign="center" alignItems="center" position="relative" zIndex={1}>
              <Heading as="h1" size="xl" maxW="720px">
                Source, visualized.
              </Heading>
              <Text fontSize="md" color="gray.600" maxW="560px">
                Source Viz maps JS/TS import relationships to surface architecture,
                hotspots, and import cycles — entirely in your browser.
              </Text>
              <StepFlow />
            </VStack>
          </Box>

          {/* Feature highlights */}
          <HStack spacing={2} justifyContent="center" flexWrap="wrap">
            {FEATURES.map((f) => (
              <Tag key={f.label} size="md" variant="subtle" colorScheme="blue">
                <Box as={f.icon} mr={1.5} />
                {f.label}
              </Tag>
            ))}
          </HStack>

          {/* Action cards */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <ActionCard
              icon={MdPlayCircleFilled}
              title="Try the demo"
              description="See Source Viz visualize its own source code. No setup needed."
              action={
                <Button
                  colorScheme="blue"
                  variant="outline"
                  onClick={handleDemoClick}
                  isLoading={demoLoading}
                  loadingText="Loading…"
                  width="100%"
                >
                  Launch demo
                </Button>
              }
            />
            <ActionCard
              icon={MdFolderOpen}
              title="Scan local project"
              description="Pick a project folder (where package.json lives) to scan its imports."
              disabled={!caps.canScanLocal}
              disabledHint={!caps.canScanLocal ? "Requires Chrome or Edge." : undefined}
              action={
                <FSLoadFilesButton
                  buttonProps={{ colorScheme: "blue", width: "100%", isDisabled: !caps.canScanLocal }}
                  onLoad={handleScanLoad}
                >
                  Choose folder…
                </FSLoadFilesButton>
              }
            />
            <ActionCard
              icon={MdUploadFile}
              title="Load exported data"
              description="Resume from a previously exported JSON snapshot of dependencies."
              action={
                <LoadDataButton
                  buttonProps={{ variant: "outline", width: "100%" }}
                  onLoad={onLoadData}
                />
              }
            />
          </SimpleGrid>

          {/* Recent projects */}
          <RecentProjects enabled={caps.canScanLocal && caps.indexedDB} onOpen={handleReopenRecent} />

          {/* Privacy promise — always visible, lower key */}
          <PrivacyPromise />

          {/* Footer */}
        </VStack>
      </Box>
    </VStack>
  );
}
