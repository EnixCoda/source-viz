import * as React from "react";

/**
 * Inline Immediately-Invoked Function Component.
 * Lets you use hooks inside a render expression without extracting a named component.
 */
export const IIFC: React.FC<{ children: () => React.ReactNode }> = ({ children }) => <>{children()}</>;
