import { ButtonProps } from "@chakra-ui/react";
import { DependencyEntry, entryParsers } from "../services/serializers";
import { getOrganizedEntries } from "../utils/getOrganizedEntries";
import { LoadFilesButton } from "./LoadFilesButton";

export function LoadDataButton({
  onLoad,
  buttonProps,
}: {
  onLoad: (data: DependencyEntry[]) => void;
  buttonProps?: ButtonProps;
}) {
  return (
    <LoadFilesButton
      buttonProps={buttonProps}
      onLoad={async (files) => {
        if (files) {
          if (files.length !== 1) return;

          const [file] = files;
          if (!file) return;

          const ext = file.name.split(".").pop();
          if (!ext) return;

          const parser = entryParsers[ext as keyof typeof entryParsers];
          if (parser) {
            // TODO: handle error
            onLoad(getOrganizedEntries(parser(await file.text())));
          }
        }
      }}
    >
      Upload exported data
    </LoadFilesButton>
  );
}
