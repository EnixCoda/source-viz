import { ArrowBackIcon, Icon } from "@chakra-ui/icons";
import { Button, ChakraProvider, HStack, Heading, Link, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { AiFillGithub } from "react-icons/ai";
import { DependencyEntry } from "../services/serializers";
import { run } from "../utils/general";
import { FSLoadFilesButton } from "./FSLoadFilesButton";
import { LoadDataButton } from "./LoadDataButton";
import { Scan } from "./Scan";
import { Viz } from "./Viz";

export interface FS {
  handle: FileSystemDirectoryHandle;
}

export function App() {
  const [data, setData] = React.useState<DependencyEntry[] | null>(null);
  const [fs, setFS] = React.useState<FS | null>(null);

  type State = "initial" | "scan" | "viz";
  const state: State = React.useMemo(() => (data ? "viz" : fs ? "scan" : "initial"), [data, fs]);

  let content = run(() => {
    switch (state) {
      case "initial":
        return (
          <VStack padding={2} gap={4} alignItems="flex-start">
            <Text>Source viz can help to analyze dependency relationship between JS files.</Text>
            <VStack alignItems="flex-start">
              <FSLoadFilesButton buttonProps={{ colorScheme: "green" }} onLoad={setFS}>
                Scan local project
              </FSLoadFilesButton>
              <Text fontSize="sm">
                Please select the root folder of a project to ensure the best coverage, generally it is the directory
                where the package.json file is at.
              </Text>
            </VStack>
            <VStack alignItems="flex-start">
              <LoadDataButton buttonProps={{ variant: "solid" }} onLoad={setData} />
              <Text fontSize="sm">Or resume with the data you exported before.</Text>
            </VStack>
            <Text as="em" fontSize="sm">
              Note: either way, no files will be uploaded to remote server, all of them are processed locally.
            </Text>
          </VStack>
        );
      case "scan":
        return fs && <Scan fileSystem={fs} onDataPrepared={setData} onCancel={() => setFS(null)} />;
      case "viz": {
        return (
          data && (
            <VStack alignItems="stretch" maxHeight="100vh" overflow="auto">
              <Viz
                entries={data}
                setData={setData}
                backButton={
                  <Button
                    onClick={() => {
                      setFS(null);
                      setData(null);
                    }}
                    aria-label={"Back"}
                  >
                    <ArrowBackIcon />
                  </Button>
                }
              />
            </VStack>
          )
        );
      }
      default:
        return null;
    }
  });

  switch (state) {
    case "initial":
    case "scan":
      content = (
        <VStack w="100vw" h="100vh" alignItems="stretch" spacing={0}>
          <HStack paddingY={2} paddingX={2} background="ButtonFace" justifyContent="space-between" alignItems="center">
            <Heading as="h1">Source Viz</Heading>
            <HStack alignItems="center" gap={1}>
              <Text>Made by EnixCoda</Text>
              <Link href="https://github.com/EnixCoda" target="_blank">
                <Icon w={6} h={6} as={AiFillGithub} />
              </Link>
            </HStack>
          </HStack>
          {content}
        </VStack>
      );
      break;
  }

  return <ChakraProvider>{content}</ChakraProvider>;
}
