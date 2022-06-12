export const stringifyToCSV = (data: string[][]) => data.map((cols) => cols.join(",")).join("\n");

export function parseCSV<T extends any[] = string[]>(
  csv: string,
  {
    skipFirstLine = false,
    parseRecord = (record) => record as T,
  }: {
    parseRecord?: (record: string[]) => T;
    skipFirstLine?: boolean;
  }
): T[] {
  const lineSeparator = "\n";
  const colSeparator = ",";

  const lines = csv.split(lineSeparator);

  if (skipFirstLine) lines.shift();
  return lines.map((line) => parseRecord(line.split(colSeparator)));
}
