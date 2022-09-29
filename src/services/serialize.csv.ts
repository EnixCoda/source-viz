export const stringifyToCSV = (data: string[][], title?: string[]) =>
  (title ? [title].concat(data) : data).map((cols) => cols.join(",")).join("\n");

export function parseCSV<T extends any[] = string[]>(
  csv: string,
  {
    parseRecord = (record) => record as T,
    skipFirstLine = false,
    lineSeparator = "\n",
    colSeparator = ",",
  }: {
    parseRecord?: (record: string[]) => T;
    skipFirstLine?: boolean;
    lineSeparator?: string;
    colSeparator?: string;
  } = {}
): T[] {
  const lines = csv.split(lineSeparator);

  if (skipFirstLine) lines.shift();
  return lines.map((line) => parseRecord(line.split(colSeparator)));
}
