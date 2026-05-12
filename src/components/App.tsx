import { Icon } from "@chakra-ui/icons";
import { Heading, HStack, Link, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { AiFillGithub } from "react-icons/ai";
import { MetaFilter } from "../services";
import { DependencyEntry } from "../services/serializers";
import { Home } from "./Home";
import { defaultExcludes, defaultIncludes } from "./Scan/filterDefaults";
import { Filter } from "./Scan/Filter";
import { Scanning } from "./Scan/Scanning";
import { FS } from "./fs";
import { Viz } from "./Viz";
import { detectCapabilities } from "../lib/browserCapabilities";
import { createDirectoryHandleFs, createMemoryFs, InvestigatorFs } from "../lib/usage-investigator";

function AppWithHeader({ children }: React.PropsWithChildren<object>) {
  return (
    <VStack w="100vw" h="100vh" alignItems="stretch" spacing={0}>
      <HStack paddingY={2} paddingX={6} background="ButtonFace" justifyContent="space-between" alignItems="center">
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
        sources?: Record<string, string>;
      };

  const [status, dispatch] = React.useReducer((_: State, newState: State): State => newState, {
    state: "initial",
  });

  const caps = React.useMemo(() => detectCapabilities(), []);

  const liveHandle = status.state === "viz" ? status.fs.handle : null;
  const memorySources = status.state === "restored-viz" ? status.sources ?? null : null;
  const investigatorFs = React.useMemo<InvestigatorFs | null>(() => {
    if (liveHandle) return createDirectoryHandleFs(liveHandle);
    if (memorySources) return createMemoryFs(memorySources);
    return null;
  }, [liveHandle, memorySources]);

  switch (status.state) {
    case "initial":
      return (
        <AppWithHeader>
          <Home
            caps={caps}
            onScanLocal={(fs) =>
              dispatch({
                state: "filtering",
                fs,
                filter: {
                  includes: defaultIncludes,
                  excludes: defaultExcludes,
                },
              })
            }
            onLoadData={(data) =>
              dispatch({
                state: "restored-viz",
                data,
              })
            }
            onLoadDemo={async () => {
              try {
                const resp = await fetch("demo-data.json");
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data: DependencyEntry[] = await resp.json();
                let sources: Record<string, string> | undefined;
                try {
                  const srcResp = await fetch("demo-sources.json");
                  if (srcResp.ok) sources = await srcResp.json();
                } catch {
                  // sources are optional — investigator just won't be available
                }
                dispatch({ state: "restored-viz", data, sources });
              } catch (err) {
                console.error("Failed to load demo data:", err);
                alert("Demo data is not available. Run `npm run generate-demo` first.");
              }
            }}
          />
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
        <Viz
          entries={status.data}
          investigatorFs={investigatorFs}
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
      );
    case "restored-viz":
      return (
        <Viz
          entries={status.data}
          investigatorFs={investigatorFs}
          setData={(data) =>
            dispatch({
              state: "restored-viz",
              data,
              sources: status.sources,
            })
          }
          onBack={() => {
            dispatch({ state: "initial" });
          }}
        />
      );
    default:
      throw new Error("Invalid state");
  }
}
