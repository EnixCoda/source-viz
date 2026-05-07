import { Command } from "commander";
import { scanCmd } from "./commands/scan";
import { cyclesCmd } from "./commands/cycles";
import { depsCmd } from "./commands/deps";

const program = new Command("source-viz");

program.description("Analyze JS/TS dependency graphs from the command line").version("1.0.0");

program.addCommand(scanCmd());
program.addCommand(cyclesCmd());
program.addCommand(depsCmd());

program.parse();
