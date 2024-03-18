type ReactState<T> = { value: T; setValue: React.Dispatch<React.SetStateAction<T>> };

type ReactStateIO<T> = [T, React.Dispatch<React.SetStateAction<T>>];
type ReactStateProps<T> = {
  value: T;
  onChange: React.Dispatch<React.SetStateAction<T>>;
};

type Order = "asc" | "desc";

type KeyOfMap<M> = M extends Map<infer K, unknown> ? K : never;
type ValueOfMap<M> = M extends Map<unknown, infer V> ? V : never;
type ValueOf<X> = X[keyof X];
