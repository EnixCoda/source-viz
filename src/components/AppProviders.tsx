import { ChakraProvider } from "@chakra-ui/react";
import { LocalPathContextProvider } from "./LocalPathContext";
import { theme } from "../theme";

export const AppProviders: React.FC<React.PropsWithChildren<object>> = ({ children }) => {
  return (
    <ChakraProvider theme={theme}>
      <LocalPathContextProvider>{children}</LocalPathContextProvider>
    </ChakraProvider>
  );
};
