import * as React from "react";

export function NodeInView({
  label, onExclude, onSelect, onCancel,
}: {
  label: React.ReactNode;
  onExclude?: () => void;
  onSelect?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="node-item">
      {onExclude && <button onClick={onExclude}>Exclude</button>}
      {onCancel && <button onClick={onCancel}>Cancel</button>}
      {onSelect && <button onClick={onSelect}>Select</button>} <span>{label}</span>
    </div>
  );
}
