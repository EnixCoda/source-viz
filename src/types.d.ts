export type ReactState<T> = { value: T; setValue: React.Dispatch<React.SetStateAction<T>> };

export type ReactStateIO<T> = [T, React.Dispatch<React.SetStateAction<T>>];
export type ReactStateProps<T> = {
  value: T;
  onChange: React.Dispatch<React.SetStateAction<T>>;
};

export type Order = "asc" | "desc";
