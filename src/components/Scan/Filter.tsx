import { ChevronLeftIcon, InfoIcon } from "@chakra-ui/icons";
import { Box, Button, Divider, Flex, Heading, HStack, IconButton, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { MetaFilter } from "../../services";
import { FS } from "../App";
import { FileExplorer } from "../FileExplorer";
import { FilterInputList } from "./FilterInputList";

export const defaultIncludes = [".*\\.jsx?$", ".*\\.tsx?$"];
export const defaultExcludes = [".*\\.d\\.ts$", "\\.git", "\\.cache", "node_modules", "build", "dist", "/\\."];

export function Filter({
  files,
  initialValue,
  onCancel,
  onChange,
}: {
  files: FS;
  initialValue: MetaFilter;
  onCancel(): void;
  onChange: React.Dispatch<MetaFilter>;
}) {
  const [includes, setIncludes] = React.useState(initialValue.includes);
  const [excludes, setExcludes] = React.useState(initialValue.excludes);
  const value = React.useMemo(() => ({ includes, excludes }), [includes, excludes]);

  return (
    <HStack alignItems="flex-start" flex={1} minH={0} padding={2}>
      <VStack width={240} flexShrink={0} alignItems="stretch" overflow="auto" minH={0} maxH="100%">
        <HStack>
          <IconButton icon={<ChevronLeftIcon />} onClick={() => onCancel()} aria-label="Back" />
          <Heading as="h2" size="lg">
            Filter files
          </Heading>
        </HStack>
        <Text fontSize="sm">
          Reduce scan scope with the filters below if scan takes too much time. You can preview include/exclude scope in
          the right-side file explorer.
        </Text>
        <VStack alignItems="stretch">
          <Button colorScheme="green" onClick={() => onChange({ includes, excludes })}>
            Next
          </Button>
        </VStack>

        <Divider />

        <VStack as="section" gap={1} minH={0} overflow="auto">
          <Box>
            <InfoIcon />{" "}
            <Text fontSize="sm" as="span">
              Inputs below accept regular expressions. The regular expressions will match against path instead of
              filename.
            </Text>
          </Box>
          <VStack alignItems="stretch">
            <Heading as="h3" size="md">
              Include
            </Heading>
            <Text fontSize="sm">
              Text files matching any of these patterns will be read and parsed. They will be
              <Text as="span" color="orange.500">
                {" "}
                highlighted{" "}
              </Text>
              in the list.
            </Text>
            <FilterInputList values={includes} onChange={setIncludes} />
          </VStack>
          <VStack alignItems="stretch">
            <Heading as="h3" size="md">
              Exclude
            </Heading>
            <Text fontSize="sm">
              Files, folders, and content inside matched folders will not be scanned. They are
              <Text as="span" color="gray.400">
                {" "}
                dimmed{" "}
              </Text>
              in the list.
            </Text>
            <FilterInputList values={excludes} onChange={setExcludes} />
          </VStack>
        </VStack>
      </VStack>
      <Divider orientation="vertical" />
      <Flex flex={1} overflow="auto" height="100%">
        <FileExplorer files={files} filter={value} />
      </Flex>
    </HStack>
  );
}
