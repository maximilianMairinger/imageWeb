#!/usr/bin/env node

import * as fs from "fs"
import * as path from "path"
import { removeExtension } from "./imageWeb"

import { program } from "commander"
program
  .version(fs.existsSync(path.join(__dirname, "../../package.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "../../package.json")).toString()).version : "0.0.1")
  .name(removeExtension(__filename))

program
  .option('-s, --silent', 'silence stdout')
.parse(process.argv)

console.log(program.args)

console.log(program.silent)


