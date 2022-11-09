interface Window {
  showDirectoryPicker?(): Promise<FileSystemDirectoryHandle | null | undefined>;
}

interface FileSystemDirectoryHandle {
  entries(): IterableIterator<[string, string]>;
  values(): IterableIterator<FileSystemHandle>;
}
