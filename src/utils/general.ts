export function safeRegExp(raw: string, flags: string = "") {
  try {
    return raw ? new RegExp(raw, flags) : null;
  } catch (error) {
    return null;
  }
}

export function exclude<T>(sources: T[], targets: T[]): T[] {
  return sources.filter((source) => !targets.some((target) => source === target));
}

export function run<R>(fn: () => R) {
  return fn();
}
