import * as React from "react";
import { MetaFilter } from "../../services";
import { DependencyEntry } from "../../services/serializers";
import { FS } from "../App";
import { Filter, defaultExcludes, defaultIncludes } from "./Filter";
import { Scanning } from "./Scanning";

export function Scan({
  fileSystem,
  onDataPrepared,
  onCancel,
}: {
  fileSystem: FS;
  onDataPrepared: React.Dispatch<DependencyEntry[] | null>;
  onCancel(): void;
}) {
  const [status, setStatus] = React.useState<"filter" | "scan">("filter");
  const [filter, setFilter] = React.useState<MetaFilter>({
    includes: defaultIncludes,
    excludes: defaultExcludes,
  });

  // TODO: press back in Scanning would restore Filter page instead of homepage
  switch (status) {
    case "filter":
      return (
        <Filter
          onCancel={() => onCancel()}
          files={fileSystem}
          initialValue={filter}
          onChange={(filter) => {
            setFilter(filter);
            setStatus("scan");
          }}
        />
      );
    case "scan":
      return (
        <Scanning
          fs={fileSystem}
          onDataPrepared={onDataPrepared}
          filter={filter}
          onCancel={() => setStatus("filter")}
        />
      );
  }
}
