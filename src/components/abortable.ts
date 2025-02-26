import { useCallback, useEffect, useState } from "react";

/**
 * This effect makes it possible to run effects that can be aborted.
 */
export function useAbortableEffect<T, TReturn, TNext>({
  getAsyncGenerator,
  onCancel,
  onAbort,
}: {
  getAsyncGenerator: (signal: AbortSignal) => AsyncGenerator<T, TReturn, TNext>;
  onCancel?: () => void;
  onAbort?: () => void;
}) {
  useEffect(() => {
    const abortController = new AbortController();
    runAbortableAsyncGenerator(getAsyncGenerator, abortController.signal, onAbort);
    return () => {
      onCancel?.();
      abortController.abort();
    };
  }, [getAsyncGenerator, onCancel, onAbort]);
}

export async function runAbortableAsyncGenerator<T>(
  generate: (signal: AbortSignal) => AsyncGenerator<unknown, T, unknown>,
  signal: AbortSignal,
  onAbort?: () => void
) {
  const generator = generate(signal);
  let latestResult: IteratorResult<unknown> | undefined;
  do {
    if (signal.aborted) {
      onAbort?.();
      return;
    }
    latestResult = await generator.next(await latestResult?.value);
  } while (!latestResult.done);
  return latestResult.value;
}

function useAbortController() {
  const [abortController, setAbortController] = useState(() => new AbortController());
  const refreshAbortController = useCallback(() => {
    const newOne = new AbortController();
    setAbortController(newOne);
    return newOne;
  }, []);
  return [abortController, refreshAbortController] as const;
}

// When called, cancel the previous call
export function useAbortableCallback(generate: (signal: AbortSignal) => AsyncGenerator, onAbort?: () => void) {
  const [abortController, refreshAbortController] = useAbortController();

  return [
    useCallback(
      () => runAbortableAsyncGenerator(generate, abortController.signal, onAbort),
      [generate, abortController, onAbort]
    ),
    refreshAbortController,
  ] as const;
}
