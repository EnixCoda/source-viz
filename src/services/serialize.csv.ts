type SerializablePrimitives = string | number | boolean;

// Simple CSV serializer — does not handle escaping (file paths rarely contain commas)
export const stringifyToCSV = (data: SerializablePrimitives[][], title?: string[]) =>
  ([] as SerializablePrimitives[][])
    .concat(title ? [title] : [])
    .concat(data)
    .map((cols) => cols.join(","))
    .join("\n");

export function parseCSV<T extends any[]>(
  csv: string,
  parseRecord: (record: string[]) => T,
  {
    skipFirstLine = false,
    lineSeparator = "\n",
    colSeparator = ",",
  }: {
    skipFirstLine?: boolean;
    lineSeparator?: string;
    colSeparator?: string;
  } = {},
): T[] {
  const lines = csv.split(lineSeparator);
  if (skipFirstLine) lines.shift();

  return lines.map((line) => parseRecord(line.split(colSeparator)));
}
