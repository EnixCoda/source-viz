import { Icon } from "@chakra-ui/icons";
import { Heading, HStack, Link, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { AiFillGithub } from "react-icons/ai";
import { MetaFilter } from "../services";
import { DependencyEntry } from "../services/serializers";
import { FSLoadFilesButton } from "./FSLoadFilesButton";
import { LoadDataButton } from "./LoadDataButton";
import { defaultExcludes, defaultIncludes, Filter } from "./Scan/Filter";
import { Scanning } from "./Scan/Scanning";
import { Viz } from "./Viz";

export interface FS {
  handle: FileSystemDirectoryHandle;
}

function AppWithHeader({ children }: React.PropsWithChildren<object>) {
  return (
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
      {children}
    </VStack>
  );
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

  switch (status.state) {
    case "initial":
      return (
        <AppWithHeader>
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
        </AppWithHeader>
      );

    case "filtering":
      return (
        <AppWithHeader>
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
        </AppWithHeader>
      );
    case "scanning":
      return (
        <AppWithHeader>
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
        </AppWithHeader>
      );
    case "viz":
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
    default:
      throw new Error("Invalid state");
  }
}
