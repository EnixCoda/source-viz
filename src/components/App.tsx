import { ChakraProvider } from "@chakra-ui/react";
import * as React from "react";
import { data } from "../warehouse";
import { Viz } from "./Viz";

export function App() {
  return (
    <ChakraProvider>
      <Viz data={data} />
    </ChakraProvider>
  );
}
