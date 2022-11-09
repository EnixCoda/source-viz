import { Box, Button, Center, ChakraProvider, Flex } from "@chakra-ui/react";
import * as React from "react";
import { run } from "../utils/general";
import { PreparedData } from "../utils/getData";
import { LoadDataButton } from "./LoadDataButton";
import { LoadFilesButton } from "./LoadFilesButton";
import { Scan } from "./Scan";
import { Viz } from "./Viz";


export function App() {
  const [data, setData] = React.useState<PreparedData | null>(null);
  const [files, setFiles] = React.useState<File[] | null>(null);

  type State = "initial" | "scan" | "viz";
  const state: State = React.useMemo(() => (data && files ? "viz" : files ? "scan" : "initial"), [data, files]);

  return (
    <ChakraProvider>
      {run(() => {
        switch (state) {
          case "initial":
            return (
              <Center h="100vh">
                <Flex flexDirection="column" alignItems="stretch" gap={4}>
                  <LoadFilesButton multiple onLoad={setFiles}>
                    Scan local
                  </LoadFilesButton>
                  <LoadDataButton onLoad={setData} />
                </Flex>
              </Center>
            );
          case "scan":
            return files && <Scan files={files} setPreparedData={setData} />;
          case "viz":
            return (
              data && (
                <Box display="flex" flexDirection="column" maxHeight="100vh" overflow="auto">
                  <Box display="flex" flexDirection="row" justifyContent="space-between">
                    <Button
                      onClick={() => {
                        setFiles(null);
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
