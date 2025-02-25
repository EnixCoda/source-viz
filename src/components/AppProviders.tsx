import { ChakraProvider } from "@chakra-ui/react";
import { LocalPathContextProvider } from "./LocalPathContext";

export const AppProviders: React.FC<React.PropsWithChildren<object>> = ({ children }) => {
  return (
    <ChakraProvider>
      <LocalPathContextProvider>{children}</LocalPathContextProvider>
    </ChakraProvider>
  );
};
