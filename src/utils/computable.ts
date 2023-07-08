export type ToCompute<T, S> = (source: S) => T;
export type Computable<T, S = unknown> = T | ToCompute<T, S>;

function isToCompute<T, S>(_: Computable<T, S>): _ is ToCompute<T, S> {
  return typeof _ === "function";
}

export function compute<T, S>(_: Computable<T, S>, s: S): T {
  return isToCompute(_) ? _(s) : _;
}
