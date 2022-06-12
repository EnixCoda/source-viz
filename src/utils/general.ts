export function safeRegExp(raw: string, flags: string = "") {
  try {
    return new RegExp(raw, flags);
  } catch (error) {
    return null;
  }
}

export function exclude<T>(sources: T[], targets: T[]): T[] {
  return sources.filter((source) => !targets.some((target) => source === target));
}
