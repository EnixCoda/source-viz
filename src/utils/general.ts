export function safeRegExp(raw: string, flags: string = "") {
  try {
    return raw ? new RegExp(raw, flags) : null;
  } catch (error) {
    return false;
  }
}

export const safeMapGet = <K, V>(map: Map<K, V>, key: K, initialize: () => V) => {
  let value = map.get(key);
  if (!value) map.set(key, (value = initialize()));
  return value;
};

export const run = <R>(fn: () => R) => fn();

export const carry = <T, R>(t: T, f: (t: T) => R): R => f(t);

export const switchRender = <K extends string>(map: Partial<Record<K, () => React.ReactNode>>, state: K) =>
  map[state]?.();

export const isNotFalse = <T>(t: false | T): t is T => t !== false;
export const isNotFalsy = <T>(t: false | undefined | null | T): t is T => t !== false && t !== undefined && t !== null;

export function download(data: BlobPart, filename: string, type?: string) {
  const file = new Blob([data], { type: type });
  const url = URL.createObjectURL(file);
  const anchorElement = document.createElement("a");
  anchorElement.href = url;
  anchorElement.download = filename;
  document.body.appendChild(anchorElement);
  anchorElement.click();
  setTimeout(() => {
    document.body.removeChild(anchorElement);
    window.URL.revokeObjectURL(url);
  }, 0);
}

export const clamp = (value: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) =>
  Math.max(min, Math.min(value, max));

export const compareStrings = (a: string, b: string, order: Order = "asc") =>
  (order === "asc" ? 1 : -1) * (a === b ? 0 : a > b ? 1 : -1);

export async function checkIsTextFile(file: File) {
  const txtStream = new TextDecoderStream();
  // Thank you for this `any`, declaration merging!
  const stream = file.stream() as any as ReadableStream<Uint8Array>;
  stream.pipeTo(txtStream.writable);
  const reader = txtStream.readable.getReader();

  let threshold = 2 ** 10; // 1KB
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (value) {
      // not recognizable bytes will be turn into below symbol
      // write the symbol in unicode format to prevent this file itself
      // from being recognized as non-text file
      if (value.includes("\ufffd")) {
        return false;
      }
      threshold -= value.length;
      if (threshold <= 0) break;
    }
  }

  return true;
}
