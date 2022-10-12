import { entriesToPreparedData } from ".";
import { stringifyToCSV } from "./serialize.csv";

export type Entry = [string, [string, boolean][]];

export const mapSerializers = {
  csv: (titles: string[], map: Entry[]) => stringifyToCSV(entriesToPreparedData(map), titles),
  json: (records: Entry[]) => JSON.stringify(entriesToPreparedData(records)),
};

export function getSerializerByName(output: string) {
  const entriesSerializers: Record<string, (entries: Entry[]) => string> = {
    csv: (entries) => {
      const titles = ["File", "Dependency", "DynamicImport"];
      return mapSerializers.csv(titles, entries);
    },
    json: (entries) => mapSerializers.json(entries),
  };

  const ext = output.split(".").pop() || "";
  const serialize = entriesSerializers[ext];
  if (!serialize) throw new Error(`Unexpected output file extension, supported values are "csv" and "json".`);
  return serialize;
}
