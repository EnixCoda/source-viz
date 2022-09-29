import { PreparedData, prepareGraphData } from "../utils/getData";
import { fileParsers } from "./App";
import { LoadFilesButton } from "./LoadFilesButton";

export function LoadDataButton({ onLoad }: { onLoad: (data: PreparedData) => void; }) {
  return (
    <LoadFilesButton
      buttonProps={{
        variant: "solid",
        colorScheme: "green",
      }}
      onLoad={async (files) => {
        if (files) {
          if (files.length !== 1)
            return;
          const file = files.item(0);
          if (!file)
            return;
          const ext = file.name.split(".").pop();
          if (!ext)
            return;
          const parser = fileParsers[ext];
          if (parser) {
            const content = await file.text();
            const parsed = parser(content);
            const prepared = prepareGraphData(parsed);
            onLoad(prepared);
          }
        }
      }}
    >
      Load Preset Data
    </LoadFilesButton>
  );
}
