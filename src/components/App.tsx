import * as React from "react";
import { data } from "../warehouse";
import { Viz } from "./Viz";

export function App() {
  return (
    <Viz data={data} />
  );
}
