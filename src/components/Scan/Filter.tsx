import { ChevronLeftIcon } from "@chakra-ui/icons";
import { Button, Divider, Flex, Heading, HStack, IconButton, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { MetaFilter } from "../../services";
import { FS } from "../fs";
import { FileExplorer } from "../FileExplorer";
import { FilterInputList } from "./FilterInputList";

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
          <IconButton icon={<ChevronLeftIcon boxSize={6} />} onClick={() => onCancel()} aria-label="Back" />
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

        <VStack as="section" gap={2} minH={0} overflow="auto">
          <VStack alignItems="stretch" gap={1}>
            <Heading as="h3" size="sm">Include</Heading>
            <Text fontSize="xs" color="gray.500">Matched files will be read and parsed.</Text>
            <FilterInputList values={includes} onChange={setIncludes} />
          </VStack>
          <Divider />
          <VStack alignItems="stretch" gap={1}>
            <Heading as="h3" size="sm">Exclude</Heading>
            <Text fontSize="xs" color="gray.500">Matched files and folders will not be scanned.</Text>
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
