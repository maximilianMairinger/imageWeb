#!/usr/bin/env node

import * as path from "path"
import imageWeb from "../imageWeb"
import { program } from "commander"
import config from "req-package-json"


program
  .version(config.version)
  .name(config.name)

program
  .option('-s, --silent', 'silence stdout')
.parse(process.argv)

let [ input, output ] = program.args
input = path.resolve("", input ? input : "")
output = path.resolve("", output ? output : config.name + "_output")
program.silent

console.log("inp", input)
console.log("out", output)
// imageWeb(input, output)

