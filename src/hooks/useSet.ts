import React from "react";

export function useSet<T>(initialValue: T[] = []) {
  const [values, setValues] = React.useState<T[]>(initialValue);
  const toggle = React.useCallback(function toggle(value: T) {
    setValues((values) => (values.includes(value) ? values.filter((n) => n !== value) : values.concat(value)));
  }, []);
  const remove = React.useCallback(function remove(value: T) {
    setValues((values) => values.filter((n) => n !== value));
  }, []);
  const clear = React.useCallback(() => setValues([]), []);

  return [values, toggle, remove, clear] as const;
}
