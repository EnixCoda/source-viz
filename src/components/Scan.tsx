import { Box, Button, Center, Flex, Heading, Input, List, ListItem, Text } from "@chakra-ui/react";
import * as React from "react";
import { prepareData } from "../services/browser";
import { run } from "../utils/general";
import { PreparedData } from "../utils/getData";
import { FS } from "./App";
import { FileExplorer } from "./FileExplorer";

export const defaultIncludes = ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"];
export const defaultExcludes = [
  "**/.git/**",
  "**/.cache/**",
  "**/node_modules/**",
  "**/build/**",
  "**/dist/**",
  "**/packages/**",
];

export type MetaFilter = {
  includes: string[];
  excludes: string[];
};

export function Filter({ files, setFilter }: { files: FS; setFilter: React.Dispatch<MetaFilter> }) {
  const [includes, setIncludes] = React.useState(defaultIncludes);
  const [excludes, setExcludes] = React.useState(defaultExcludes);

  const filter = React.useMemo(() => ({ includes, excludes }), [includes, excludes]);

  return (
    <Box display="flex" width="100%" overflow="auto" maxHeight="100%">
      <Box flex={1}>
        <FileExplorer files={files} filter={filter} />
      </Box>
      <Box width={240} flexShrink={0}>
        <Box display="flex" justifyContent="flex-end">
          <Button colorScheme="green" onClick={() => setFilter({ includes, excludes })}>
            Start
          </Button>
        </Box>
        <Heading as="h2" size="lg">
          Includes
        </Heading>
        <InputList values={includes} onChange={setIncludes} />
        <Heading as="h2" size="lg">
          Excludes
        </Heading>
        <InputList values={excludes} onChange={setExcludes} />
      </Box>
    </Box>
  );
}

function InputList({ values, onChange }: { values: string[]; onChange(values: string[]): void }) {
  return (
    <Box display="inline-flex" flexDirection="column" gap={2}>
      <List display="inline-flex" flexDirection="column" gap={2} maxHeight={600}>
        {values.map((value, index) => (
          <ListItem key={index} display="inline-flex" gap={1}>
            <Input
              value={value}
              placeholder="glob pattern, like **/folder/**"
              onChange={(e) => onChange(values.map((value, j) => (index === j ? e.target.value : value)))}
            />
            <Button onClick={() => onChange(values.filter((_, j) => j !== index))}>Remove</Button>
          </ListItem>
        ))}
      </List>
      <Button onClick={() => onChange(values.concat(""))}>Add</Button>
    </Box>
  );
}

function Scanning({
  fs,
  setData,
  getFilePath,
}: {
  fs: FS;
  setData: React.Dispatch<PreparedData>;
  getFilePath(file: File): string;
}) {
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);
  React.useEffect(() => {
    run(async () => {
      try {
        setData(await prepareData(Array.from(fs.pathMap.keys()), setProgress, getFilePath));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(`${err}` || `Unknown error`));
      }
    });
  }, [fs.pathMap, setProgress, getFilePath, setData]);

  return <>{error ? <Text>{error.message}</Text> : <Heading>Scanning {progress}th file</Heading>}</>;
}

export function Scan({
  fileSystem,
  setPreparedData,
  getFilePath,
}: {
  fileSystem: FS;
  setPreparedData: React.Dispatch<PreparedData>;
  getFilePath(file: File): string;
}) {
  const [data, setData] = React.useState<PreparedData | null>(null);
  const [filter, setFilter] = React.useState<MetaFilter | null>(null);

  return (
    <Center h="100vh">
      {data ? (
        <Flex flexDirection="column" alignItems="stretch" gap={4}>
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
        </Flex>
      ) : filter ? (
        <Scanning fs={fileSystem} setData={setData} getFilePath={getFilePath} />
      ) : (
        <Filter files={fileSystem} setFilter={setFilter} />
      )}
    </Center>
  );
}
