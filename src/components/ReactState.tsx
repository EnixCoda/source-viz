export type ReactState<T> = { value: T | undefined; setValue: React.Dispatch<React.SetStateAction<T | undefined>> };
