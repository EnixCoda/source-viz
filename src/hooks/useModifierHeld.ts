import * as React from "react";

/**
 * Returns true while the platform modifier key (Cmd on Mac, Ctrl elsewhere) is held down.
 * Resets to false on blur (e.g. user alt-tabs away while holding the key).
 */
export function useModifierHeld(): boolean {
  const [held, setHeld] = React.useState(false);

  React.useEffect(() => {
    const isModifier = (e: KeyboardEvent) => e.key === "Meta" || e.key === "Control";

    const onDown = (e: KeyboardEvent) => {
      if (isModifier(e)) setHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (isModifier(e)) setHeld(false);
    };
    const onBlur = () => setHeld(false);

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return held;
}
