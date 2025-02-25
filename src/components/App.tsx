import { Icon } from "@chakra-ui/icons";
import { ChakraProvider, Heading, HStack, Link, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { AiFillGithub } from "react-icons/ai";
import { MetaFilter } from "../services";
import { DependencyEntry } from "../services/serializers";
import { run } from "../utils/general";
import { FSLoadFilesButton } from "./FSLoadFilesButton";
import { LoadDataButton } from "./LoadDataButton";
import { LocalPathContextProvider } from "./LocalPathContext";
import { defaultExcludes, defaultIncludes, Filter } from "./Scan/Filter";
import { Scanning } from "./Scan/Scanning";
import { Viz } from "./Viz";

export interface FS {
  handle: FileSystemDirectoryHandle;
}

export function App() {
  type State =
    | {
        state: "initial";
      }
    | {
        state: "filtering";
        fs: FS;
        filter: MetaFilter;
      }
    | {
        state: "scanning";
        fs: FS;
        filter: MetaFilter;
      }
    | {
        state: "viz";
        fs: FS;
        filter: MetaFilter;
        data: DependencyEntry[];
      }
    | {
        state: "restored-viz";
        data: DependencyEntry[];
      };

  const [status, dispatch] = React.useReducer((_: State, newState: State): State => newState, {
    state: "initial",
  });

  let content = run(() => {
    switch (status.state) {
      case "initial":
        return (
          <VStack padding={2} gap={4} alignItems="flex-start">
            <Text>Source viz can help to analyze dependency relationship between JS files.</Text>
            <VStack alignItems="flex-start">
              <FSLoadFilesButton
                buttonProps={{ colorScheme: "green" }}
                onLoad={(fs) =>
                  dispatch({
                    state: "filtering",
                    fs,
                    filter: {
                      includes: defaultIncludes,
                      excludes: defaultExcludes,
                    },
                  })
                }
              >
                Scan local project
              </FSLoadFilesButton>
              <Text fontSize="sm">
                Please select the root folder of a project to ensure the best coverage, generally it is the directory
                where the package.json file is at.
              </Text>
            </VStack>
            <VStack alignItems="flex-start">
              <LoadDataButton
                buttonProps={{ variant: "solid" }}
                onLoad={(data) =>
                  dispatch({
                    state: "restored-viz",
                    data,
                  })
                }
              />
              <Text fontSize="sm">Or resume with the data you exported before.</Text>
            </VStack>
            <Text as="em" fontSize="sm">
              Note: either way, no files will be uploaded to remote server, all of them are processed locally.
            </Text>
          </VStack>
        );

      case "filtering":
        return (
          <Filter
            onCancel={() => dispatch({ state: "initial" })}
            files={status.fs}
            initialValue={status.filter}
            onChange={(filter) => {
              dispatch({
                state: "scanning",
                fs: status.fs,
                filter,
              });
            }}
          />
        );
      case "scanning": {
        return (
          <Scanning
            fs={status.fs}
            onDataPrepared={(data) =>
              dispatch({
                state: "viz",
                fs: status.fs,
                filter: status.filter,
                data,
              })
            }
            filter={status.filter}
            onCancel={() =>
              dispatch({
                state: "filtering",
                fs: status.fs,
                filter: status.filter,
              })
            }
          />
        );
      }
      case "viz": {
        return (
          <VStack alignItems="stretch" maxHeight="100vh" overflow="auto">
            <Viz
              entries={status.data}
              setData={(data) =>
                dispatch({
                  state: "viz",
                  fs: status.fs,
                  filter: status.filter,
                  data,
                })
              }
              onBack={() => {
                dispatch({
                  state: "filtering",
                  fs: status.fs,
                  filter: status.filter,
                });
              }}
              onRescan={() => {
                dispatch({
                  state: "scanning",
                  fs: status.fs,
                  filter: status.filter,
                });
              }}
            />
          </VStack>
        );
      }
      default:
        return null;
    }
  });

  switch (status.state) {
    case "initial":
    case "filtering":
    case "scanning":
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

  return (
    <ChakraProvider>
      <LocalPathContextProvider>{content}</LocalPathContextProvider>
    </ChakraProvider>
  );
}
