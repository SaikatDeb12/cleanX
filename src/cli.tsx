#!/usr/bin/env node

import { Command } from "commander";
import { render } from "ink";
import { App } from "./ui/App.js";
import path from "node:path";

const program = new Command();
program
    .name("cleanx")
    .description("scan and clean big files on-the-go")
    .argument("[path]", "directory path to scan", ".")
    .parse();

const inputPath = program.args[0] ?? ".";
const rootPath = path.resolve(inputPath);

render(<App rootPath={rootPath} />);
