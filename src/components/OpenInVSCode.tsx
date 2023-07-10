import { ExternalLinkIcon } from "@chakra-ui/icons";
import {
  Button,
  Divider,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useContext, useEffect } from "react";
import { useInputView } from "../hooks/view/useInputView";
import { LocalPathContext } from "./LocalPathContext";
import { MonoText } from "./MonoText";

function useOpenInVSCodeSettingsModal({ example }: { example?: string } = {}) {
  const disclosure = useDisclosure();

  const view = (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Setup opening file in VSCode</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <OpenInVSCodeSettingsContent example={example} />
        </ModalBody>
        <ModalFooter>
          <Button onClick={disclosure.onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  return [view, disclosure] as const;
}

export function SettingsOfOpenInVSCode({ example }: { example?: string }) {
  const [view, disclosure] = useOpenInVSCodeSettingsModal({ example });

  return (
    <>
      <Button onClick={disclosure.onOpen}>Settings of Open in VSCode</Button>
      {view}
    </>
  );
}

function OpenInVSCodeOrSetup({ path, layout = "icon" }: { layout: "icon" | "text"; path: string }) {
  const ctx = useContext(LocalPathContext);
  const localPath = ctx?.value;

  const [view, disclosure] = useOpenInVSCodeSettingsModal({ example: path });

  return (
    <>
      <OpenInVSCodeButton
        onTrigger={() => {
          if (localPath) window.open(resolveVSCodeURL(localPath, path));
          else disclosure.onOpen();
        }}
        path={path}
        layout={layout}
      />
      {view}
    </>
  );
}

export const OpenInVSCode = OpenInVSCodeOrSetup;

function OpenInVSCodeSettingsContent({ example }: { example?: string }) {
  const ctx = useContext(LocalPathContext);
  const setValue = ctx?.setValue;
  const [view, input] = useInputView({
    defaultValue: ctx?.value || "",
    inputProps: {
      placeholder: "/local/absolute/path/to/root/dir/",
    },
  });
  useEffect(() => {
    setValue?.(input);
  }, [input, setValue]);

  return (
    <VStack alignItems="flex-start" gap={1}>
      <Text>Please provide path of scan root, then you can open files in VSCode by one click.</Text>
      {view}
      <Text>Settings will be saved immediately as you type.</Text>
      {example && input && (
        <>
          <Divider />
          <Text>To test the path, please click the button below.</Text>
          <OpenInVSCodeButton layout="text" path={resolveVSCodeURL(input, example)} />
          <Text>
            It will try to open <MonoText as="span">{joinPath(input, example)}</MonoText> in VSCode.
          </Text>
          <Text>
            Make sure that VSCode can open the file before closing this dialog. Remember, this dialog won't appear again
            when you try to open a file in VSCode. You can reopen it from the General Settings section.
          </Text>
        </>
      )}
    </VStack>
  );
}

function OpenInVSCodeButton({
  path,
  layout = "icon",
  onTrigger = () => window.open(path),
}: {
  layout: "icon" | "text";
  path: string;
  onTrigger?: () => void;
}) {
  switch (layout) {
    case "icon":
      return <IconButton aria-label="Open in VSCode" icon={<ExternalLinkIcon />} onClick={onTrigger} />;
    case "text":
      return <Button onClick={onTrigger}>Open in VS Code</Button>;
  }
}

const joinPath = (parent: string, sub: string) => (parent + "/" + sub).replace(/\/\/+/g, "/");
const resolveVSCodeURL = (localPath: string, path: string) => `vscode://file/${joinPath(localPath, path)}`;
