import z from "zod";
import { safeMapGet } from "../utils/general";
import { parseCSV, stringifyToCSV } from "./serialize.csv";
import { parseJSON, stringifyToJSON } from "./serialize.json";

export type Dependency = [dependency: string, isAsync: boolean];
export type DependencyMap = Map<string, Dependency[]>;

export type DependencyEntry = [KeyOfMap<DependencyMap>, Dependency[]];
const zDependencyRecord = z.tuple([z.string(), z.string(), z.boolean()]);
export type DependencyRecord = [file: KeyOfMap<DependencyMap>, dependency: string, isAsync: boolean];
const zDependencyEntry = z.array(z.tuple([z.string(), z.array(z.tuple([z.string(), z.boolean()]))]));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type __check_type_of_json_schema = Expect<Equal<DependencyEntry[], z.infer<typeof zDependencyEntry>>>;

function flatEntries(entires: DependencyEntry[]): DependencyRecord[] {
  return entires.flatMap(([file, dependencies]) =>
    dependencies.map(([dependency, isAsync]) => [file, dependency, isAsync] as DependencyRecord),
  );
}

type SupportExts = "csv" | "json";
export const entrySerializers: Record<SupportExts, (entires: DependencyEntry[]) => string> = {
  csv: (entires) => stringifyToCSV(flatEntries(entires), ["File", "Dependency", "DynamicImport"]),
  json: stringifyToJSON,
};

export const entryParsers: Record<SupportExts, (source: string) => DependencyEntry[]> = {
  csv: (source: string) => {
    try {
      const records = parseCSV(source, zDependencyRecord.parse);

      const map: DependencyMap = new Map();
      for (const [file, dep, isAsync] of records) {
        const d = safeMapGet(map, file, () => []);
        d.push([dep, isAsync]);
      }

      const entries: DependencyEntry[] = Array.from(map.entries());
      return entries;
    } catch (err) {
      throw new Error("Invalid JSON content for entries", { cause: err });
    }
  },
  json: (source: string) => {
    try {
      const result = zDependencyEntry.safeParse(parseJSON(source));
      if (!result.success) throw new Error();
      return result.data;
    } catch (err) {
      throw new Error("Invalid JSON content for entries");
    }
  },
};

export const getEntrySerializerByFileName = (fileName: string): ValueOf<typeof entrySerializers> | null =>
  entrySerializers[(fileName.split(".").pop() || "") as SupportExts] ?? null;
