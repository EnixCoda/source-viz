import { Box, Divider, HStack, Spinner, VStack } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { checkIsTextFile } from "../../../utils/general";
import { useAbortableEffect } from "../../abortable";
import { MonoText } from "../../MonoText";
import { OpenInVSCode } from "../../OpenInVSCode";

export function ColumnFile({ item, stack }: { item: FileSystemHandle; stack: FileSystemHandle[] }) {
  type State =
    | {
        loading: true;
        content: null;
      }
    | {
        loading: false;
        content: string;
      };
  type Action =
    | {
        type: "loading";
      }
    | {
        type: "loaded";
        payload: string;
      };

  const [{ loading, content }, dispatch] = React.useReducer(
    (state: State, action: Action): State => {
      switch (action.type) {
        case "loading":
          return { loading: true, content: null };
        case "loaded":
          return { loading: false, content: action.payload };
        default:
          throw new Error();
      }
    },
    { loading: true, content: null },
  );

  useAbortableEffect(
    useCallback(
      () => ({
        async *getAsyncGenerator() {
          try {
            dispatch({ type: "loading" });
            if (item instanceof FileSystemFileHandle) {
              const file: File = yield await item.getFile();
              const sizeLimit = 2 ** 24; // 16MB
              if (file.size > sizeLimit) throw new Error(`This file is too large to load`);

              const isTextFile = await checkIsTextFile(file);
              if (!isTextFile) throw new Error("Not a text file");

              const text = await file.text();
              dispatch({ type: "loaded", payload: text });
            } else {
              throw new Error("Not a file");
            }
          } catch (e) {
            dispatch({ type: "loaded", payload: `${e}` });
          }
        },
      }),
      [item],
    ),
  );

  const filePath = useMemo(() => stack.map((f) => f.name).join("/"), [stack]);

  return (
    <VStack alignItems="stretch" minWidth={400} maxWidth="100%" height="100%">
      <HStack>
        <OpenInVSCode layout="icon" path={filePath} />
        <MonoText as="h3" fontSize="md">
          {filePath}
        </MonoText>
      </HStack>

      <Divider />

      {loading ? (
        <Spinner />
      ) : (
        <Box overflow="auto">
          <MonoText as="pre" fontSize="xs">
            {content}
          </MonoText>
        </Box>
      )}
    </VStack>
  );
}
