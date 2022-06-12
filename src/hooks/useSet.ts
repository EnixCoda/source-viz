import React from "react";

export function useSet<T>() {
  const [values, setValues] = React.useState<T[]>([]);
  const toggle = React.useCallback(function toggle(value: T) {
    setValues((values) => (values.includes(value) ? values.filter((n) => n !== value) : [...values, value]));
  }, []);

  return [values, toggle] as const;
}
