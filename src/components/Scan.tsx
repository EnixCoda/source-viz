import { Button, Center, Flex, Heading, Text } from "@chakra-ui/react";
import minimatch from "minimatch";
import * as React from "react";
import { deps, entriesToPreparedData, FSLike } from "../services";
import * as babelParser from "../services/parsers/babel";
import { run } from "../utils/general";
import { PreparedData, prepareGraphData } from "../utils/getData";

const defaultIncludes = ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"];
const defaultExcludes = [
  ".git",
  ".cache",
  "**/.cache/**",
  "node_modules",
  "**/node_modules/**",
  "**/build/**",
  "**/dist/**",
  "**/packages/**",
];

export function Scan({
  fileList,
  setPreparedData,
}: {
  fileList: FileList;
  setPreparedData: React.Dispatch<PreparedData>;
}) {
  // // for progress
  const [progress, setProgress] = React.useState(0);
  const [data, setData] = React.useState<PreparedData | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    run(async () => {
      try {
        const includes: string[] = defaultIncludes;
        const excludes: string[] = defaultExcludes;

        const createMatcher = (patterns: string[]) => (item: string) =>
          patterns.some((pattern) => minimatch(item, pattern));
        const isIncluded = createMatcher(includes);
        const isExcluded = createMatcher(excludes);
        const files: Map<string, File> = new Map();
        for (const file of fileList) {
          const relativePath = file.webkitRelativePath;
          if (isExcluded(relativePath)) continue;
          files.set(relativePath, file);
        }

        console.log(files.values());

        const fsLike: FSLike = {
          resolvePath: (...ps) => {
            const newVariable = new URL(ps.join("/").replace(/\/+/g, "/"), "http://localhost").pathname.replace(
              /^\//,
              ""
            );
            console.log(newVariable);
            return newVariable;
          },
          readFile: (relativePath) => {
            const file = files.get(relativePath);
            if (!file) throw new Error(`No file found for "${relativePath}"`);
            return file.text();
          },
        };

        const records = await deps(Array.from(files.keys()), babelParser.parse, fsLike, isIncluded, true, setProgress);

        console.log(records);

        const preparedData = prepareGraphData(entriesToPreparedData(records));
        setData(preparedData);
        console.log(preparedData);

        // const serializer = getSerializerByName(output);
        // await fs.writeFile(output, serializer(records), "utf-8");
      } catch (err) {
        debugger;
        setError(error);
      }
    });
  }, [fileList]);

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
