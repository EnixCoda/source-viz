import { stringifyToCSV } from "./serialize.csv";

export type Entry = [string, [string, boolean][]];

export const mapSerializers = {
  csv: (titles: string[], map: Entry[]) =>
    stringifyToCSV(
      map
        .map(([key, value]) => value.map(([dependency, dynamicImport]) => [key, dependency, `${dynamicImport}`]))
        .flat(),
      titles
    ),
  json: (records: Entry[]) =>
    JSON.stringify(
      records
        .map(([key, value]) => value.map(([dependency, dynamicImport]) => [key, dependency, `${dynamicImport}`]))
        .flat()
    ),
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
