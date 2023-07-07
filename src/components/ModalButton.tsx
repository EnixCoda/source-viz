import { Modal, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, useDisclosure } from "@chakra-ui/react";
import { ReactNode } from "react";
import { DisClosure } from "./type";

export function ModalButton({
  children,
  title,
  renderTrigger,
}: {
  title?: ReactNode;
  renderTrigger(disclosure: DisClosure): ReactNode;
  children: (disclosure: DisClosure) => ReactNode;
}) {
  const disclosure = useDisclosure();
  const { isOpen, onClose } = disclosure;

  return (
    <>
      {renderTrigger(disclosure)}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent minWidth="80vw">
          {title && <ModalHeader>{title}</ModalHeader>}
          <ModalCloseButton />
          {children(disclosure)}
        </ModalContent>
      </Modal>
    </>
  );
}
