import { parseCSV } from "../services/serialize.csv";
import { PreparedData, prepareGraphData } from "../utils/getData";
import { LoadFilesButton } from "./LoadFilesButton";

const fileParsers: Record<string, undefined | ((raw: string) => string[][])> = {
  json: JSON.parse,
  csv: parseCSV,
};

export function LoadDataButton({ onLoad }: { onLoad: (data: PreparedData) => void; }) {
  return (
    <LoadFilesButton
      buttonProps={{
        variant: "solid",
        colorScheme: "green",
      }}
      onLoad={async (files) => {
        if (files) {
          if (files.length !== 1) return;

          const [file] = files;
          if (!file) return;

          const ext = file.name.split(".").pop();
          if (!ext) return;

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
