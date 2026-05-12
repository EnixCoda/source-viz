// Browser capability detection for source-viz core features.

export type BrowserCapabilities = {
  fileSystemAccess: boolean;
  indexedDB: boolean;
  workers: boolean;
  wasm: boolean;
  /** True if the user can scan local projects (the primary intended flow). */
  canScanLocal: boolean;
  /** True if browser is fully supported (no visible warnings). */
  fullySupported: boolean;
};

export function detectCapabilities(): BrowserCapabilities {
  const fileSystemAccess =
    typeof window !== "undefined" && typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
  const indexedDB = typeof window !== "undefined" && "indexedDB" in window;
  const workers = typeof Worker !== "undefined";
  const wasm = typeof WebAssembly !== "undefined";

  return {
    fileSystemAccess,
    indexedDB,
    workers,
    wasm,
    canScanLocal: fileSystemAccess && workers && wasm,
    fullySupported: fileSystemAccess && indexedDB && workers && wasm,
  };
}
