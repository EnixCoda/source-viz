import { useDisclosure } from "@chakra-ui/react";

export type ReactState<T> = { value: T | undefined; setValue: React.Dispatch<React.SetStateAction<T | undefined>> };

export type DisClosure = ReturnType<typeof useDisclosure>;
