import z from "zod";
import { safeMapGet } from "../utils/general";
import { parseCSV, stringifyToCSV } from "./serialize.csv";
import { parseJSON, stringifyToJSON } from "./serialize.json";

export type DependencyMap = Map<string, [dependency: string, isAsync: boolean][]>;
type KeyOfMap<M> = M extends Map<infer K, unknown> ? K : never;
type ValueOfMap<M> = M extends Map<unknown, infer V> ? V : never;

export type ValueOf<X> = X[keyof X];

export type DependencyEntry = [KeyOfMap<DependencyMap>, ValueOfMap<DependencyMap>];
const jsonSchema = z.array(z.tuple([z.string(), z.array(z.tuple([z.string(), z.boolean()]))]));

type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type __check_type_of_json_schema = Expect<Equal<DependencyEntry[], z.infer<typeof jsonSchema>>>;

export type DependencyRecord = [file: string, dependency: string, isAsync: boolean];

function flatEntries(entires: DependencyEntry[]): DependencyRecord[] {
  return entires.flatMap(([file, dependencies]) =>
    dependencies.map(([dependency, isAsync]) => [file, dependency, isAsync] as DependencyRecord)
  );
}

type SupportExts = "csv" | "json";
export const entrySerializers: Record<SupportExts, (entires: DependencyEntry[]) => string> = {
  csv: (entires) => stringifyToCSV(flatEntries(entires), ["File", "Dependency", "DynamicImport"]),
  json: stringifyToJSON,
};

export const entryParsers: Record<SupportExts, (source: string) => DependencyEntry[]> = {
  csv: (source: string) => {
    const records = parseCSV<DependencyRecord>(source);

    const map: DependencyMap = new Map();
    for (const [file, dep, isAsync] of records) {
      const d = safeMapGet(map, file, () => []);
      d.push([dep, isAsync]);
    }

    const entries: DependencyEntry[] = Array.from(map.entries());
    return entries;
  },
  json: (source: string) => {
    try {
      const result = jsonSchema.safeParse(parseJSON(source));
      if (!result.success) throw new Error();
      return result.data;
    } catch (err) {
      throw new Error("Invalid JSON content for entries");
    }
  },
};

export const getEntrySerializerByFileName = (output: string): ValueOf<typeof entrySerializers> | null =>
  entrySerializers[(output.split(".").pop() || "") as SupportExts];
