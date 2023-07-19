import { Divider, HStack, Spinner, VStack } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { MonoText } from "../../MonoText";
import { OpenInVSCode } from "../../OpenInVSCode";
import { useAbortableEffect } from "../../abortable";

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
        getAsyncGenerator: async function* () {
          try {
            dispatch({ type: "loading" });
            if (item instanceof FileSystemFileHandle) {
              const file = (yield await item.getFile()) as File;
              const text = (yield await file.text()) as string;
              dispatch({ type: "loaded", payload: text });
            } else {
              dispatch({ type: "loaded", payload: "Not a file" });
            }
          } catch (e) {
            dispatch({ type: "loaded", payload: `${e}` });
          } finally {
          }
        },
      }),
      [item],
    ),
  );

  const filePath = useMemo(() => stack.map((f) => f.name).join("/"), [stack]);

  return (
    <VStack alignItems="flex-start" minWidth={400} height="100%">
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
        <MonoText as="pre" fontSize="xs">
          {content}
        </MonoText>
      )}
    </VStack>
  );
}
