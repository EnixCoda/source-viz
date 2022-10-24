import { Button, Center, Flex, Heading, Text } from "@chakra-ui/react";
import * as React from "react";
import { prepareData } from "../services/browser";
import { run } from "../utils/general";
import { PreparedData } from "../utils/getData";

export const defaultIncludes = ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"];
export const defaultExcludes = [
  ".git",
  ".cache",
  "**/.cache/**",
  "node_modules",
  "**/node_modules/**",
  "**/build/**",
  "**/dist/**",
  "**/packages/**",
];

export function Scan({ files, setPreparedData }: { files: File[]; setPreparedData: React.Dispatch<PreparedData> }) {
  // // for progress
  const [progress, setProgress] = React.useState(0);
  const [data, setData] = React.useState<PreparedData | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    run(async () => {
      try {
        setData(await prepareData(files, setProgress));
      } catch (err) {
        if (err instanceof Error) setError(err);
      }
    });
  }, [files]);

  return (
    <Center h="100vh">
      <Flex flexDirection="column" alignItems="stretch" gap={4}>
        {data ? (
          <>
            <Button colorScheme="green" onClick={() => setPreparedData(data)}>
              Visualization {">"}
            </Button>
            <Button
              onClick={() => {
                alert("Implement me!");
              }}
            >
              Save Scan Result
            </Button>
          </>
        ) : (
          <>{error ? <Text>{error.message}</Text> : <Heading>Scanning {progress}th file</Heading>}</>
        )}
      </Flex>
    </Center>
  );
}
