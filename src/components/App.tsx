import { Box, Button, Center, ChakraProvider, Flex } from "@chakra-ui/react";
import * as React from "react";
import { run } from "../utils/general";
import { PreparedData } from "../utils/getData";
import { FSLoadFilesButton } from "./FSLoadFilesButton";
import { LoadDataButton } from "./LoadDataButton";
import { Scan } from "./Scan";
import { Viz } from "./Viz";

export interface FS {
  handle: FileSystemDirectoryHandle;
  pathMap: Map<File, string>;
}

export function App() {
  const [data, setData] = React.useState<PreparedData | null>(null);
  const [fs, setFS] = React.useState<FS | null>(null);

  type State = "initial" | "scan" | "viz";
  const state: State = React.useMemo(() => (data ? "viz" : fs ? "scan" : "initial"), [data, fs]);

  return (
    <ChakraProvider>
      {run(() => {
        switch (state) {
          case "initial":
            return (
              <Center h="100vh">
                <Flex flexDirection="column" alignItems="stretch" gap={4}>
                  <FSLoadFilesButton onLoad={setFS}>Scan local</FSLoadFilesButton>
                  <LoadDataButton onLoad={setData} />
                </Flex>
              </Center>
            );
          case "scan":
            return (
              fs && <Scan fileSystem={fs} onDataPrepared={setData} getFilePath={(file) => fs.pathMap.get(file) || ""} />
            );
          case "viz":
            return (
              data && (
                <Box display="flex" flexDirection="column" maxHeight="100vh" overflow="auto">
                  <Box display="flex" flexDirection="row" justifyContent="space-between">
                    <Button
                      onClick={() => {
                        setFS(null);
                        setData(null);
                      }}
                    >
                      {"<"}
                    </Button>
                    <Button>Save scan result</Button>
                  </Box>
                  <Viz data={data} setData={setData} />
                </Box>
              )
            );
          default:
            return null;
        }
      })}
    </ChakraProvider>
  );
}
