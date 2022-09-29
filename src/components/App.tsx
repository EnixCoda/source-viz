import { Center, ChakraProvider } from "@chakra-ui/react";
import * as React from "react";
import { parseCSV } from "../services/serialize.csv";
import { PreparedData } from "../utils/getData";
import { data } from "../warehouse";
import { LoadDataButton } from "./LoadDataButton";
import { Viz } from "./Viz";

export const fileParsers: Record<string, undefined | ((raw: string) => string[][])> = {
  json: JSON.parse,
  csv: parseCSV,
};

const defaultData: PreparedData | null = data || null;

export function App() {
  const [data, setData] = React.useState<PreparedData | null>(defaultData);
  return (
    <ChakraProvider>
      {data ? (
        <Viz data={data} setData={setData} />
      ) : (
        <Center h="100vh">
          <LoadDataButton onLoad={setData} />
        </Center>
      )}
    </ChakraProvider>
  );
}
