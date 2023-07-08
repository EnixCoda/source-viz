export type ReactStateIO<T> = [T, React.Dispatch<React.SetStateAction<T>>];
export type ReactStateProps<T> = {
  value: T;
  onChange: React.Dispatch<React.SetStateAction<T>>;
};

export type Order = "asc" | "desc";
