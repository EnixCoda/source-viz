import rawData from "../out.json";
import { prepareGraphData } from "./utils/getData";

const simpleTestData = [
  ["a", "b"],
  ["d", "b"],
  ["b", "c"],
  ["b", "e"],
];

export const data = prepareGraphData(simpleTestData && rawData);
