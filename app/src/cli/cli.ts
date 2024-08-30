#!/usr/bin/env node

import * as path from "path"
import imageWeb, { imageResolutions, compressionOffset, constrImageWeb, watch } from "../imageWeb"
import { Command } from "commander"
const program = new Command()
import reqPackageJson from "req-package-json"
import findNextDirname, { findNextCommonDirname } from "./findNextDirname"
import sani, { AND, OR, numberLikePattern, numericRange, ensure } from "sanitize-against"
import * as fs from "fs"
const merge = require("deepmerge")
const config = reqPackageJson(__dirname)

const commonResolutions = Object.keys(imageResolutions) as (keyof typeof imageResolutions)[]
const commonAlgorithms = Object.keys(compressionOffset) as (keyof typeof compressionOffset)[]


const saniCliSpecificOptions = sani({
  algorithms: new AND(
    sani(String, "Algorithms must be a string"),
    (a: string) => a.split(",").map(a => a.trim()), 
    ensure((a: typeof commonAlgorithms) => a.every(a => commonAlgorithms.includes(a)), "Unknown algorithm"),
    ensure((a: string[]) => a.length > 0, "At least one algorithm must be specified"),
    // no dups
    ensure((a: string[]) => {
      const set = new Set<string>()
      for (const alg of a) {
        if (set.has(alg)) return false
        set.add(alg)
      }
      return true
    }, "Duplicate algorithms specified") as (a: string[]) => []
  ) as any as (s: string) => typeof commonAlgorithms,
  resolutions: new AND(
    sani(String, "Resolutions must be a string"),
    a => a.split(",").map(a => a.trim()),     
    ensure(a => a.every(
      a => commonResolutions.includes(a) || 
      !isNaN(+a) || 
      (a.endsWith("p") && !isNaN(+a.substring(0, a.length-1)))
    ), "Resolution must be a number or a common resolution name or a number followed by a 'p'"),
    ensure((a: string[]) => a.length > 0, "At least one resolution must be specified"),
    // no dups
    ensure((a: string[]) => {
      const set = new Set<string>()
      for (const res of a) {
        if (set.has(res)) return false
        set.add(res)
      }
      return true
    }, "Duplicate resolutions specified") as (a: string[]) => []
  ) as any as (s: string) => typeof commonResolutions
}) as any

const renderOptionsSani = sani({
  silent: false,
  "exclude?": new AND(
    String, 
    a => a.split(",").map(a => a.trim())
  ),
  dryRun: false,
  dynamicResolution: true,
  force: false,
  threads: new AND(
    (a: number | string) => a === undefined ? 1 : a, 
    numberLikePattern, 
    numericRange(1, Infinity)
  ),
  debug: false,
  legacyLogs: false
})

const inputSani = sani(new AND(String, (inputt) => inputt.split(",").map((input) => path.resolve("", input ? input : "")))) as any as (a: string) => string[]
const _outputSani = sani(new OR(String))
const outputSani = (input: string[], output?: string) => {
  try {
    return _outputSani(output)
  }
  catch(e) {
    return path.join(config.name + "_output", findNextCommonDirname(input))
  }
}
// input = inputt.split(",").map((input) => path.resolve("", input ? input : ""))
// output = path.resolve("", output ? output : path.join(config.name + "_output", findNextCommonDirname(input)))


function makeImageWebInstanceFromCliOptions(_input: any, _output: any, ops: any) {
  const cliOptions = saniCliSpecificOptions(ops)
  const renderOptions = renderOptionsSani(ops)
  const input = inputSani(_input)
  const output = outputSani(input, _output)

  const { algorithms: alg, resolutions: res } = cliOptions

  let render: typeof imageWeb

  if (alg && res) render = constrImageWeb(alg, res, renderOptions)
  else {
    let hasSpecificOutputWish: { alg: any, res: { pixels: number, displayName: string } | { name: string, displayName?: string } }

    (() => {
      if (input.length !== 1) return
      const inp = input[0] 
      if (fs.existsSync(inp) && fs.lstatSync(inp).isDirectory()) return
      if (fs.existsSync(output)) {
        if (!fs.lstatSync(output).isDirectory()) {
          if (!renderOptions.force) throw new Error("Output points to a existing file. Use -f to force override. Terminating here, before any changes.")
        }
        else return
      }
      let outputCodec: any
      let inputCodec: any
      for (const codec of commonAlgorithms) {
        if (output.endsWith("." + codec)) outputCodec = codec
        if (inp.endsWith("." + codec)) inputCodec = codec
      }
      if (alg) {
        if (alg.length === 1) outputCodec = alg
        else return
      }
      if (res) {
        if (res.length !== 1) return
      }
      if (inputCodec && outputCodec) {
        hasSpecificOutputWish = { alg: outputCodec, res: res ? {name: res[0] + "", displayName: ""} : { pixels: imageResolutions.UHD, displayName: "" } }
      }
    })()
  
    
  
    render = hasSpecificOutputWish ? 
      constrImageWeb([hasSpecificOutputWish.alg], [hasSpecificOutputWish.res], renderOptions) : 
      constrImageWeb(alg ? alg : ["jpg", "webp", "avif"], res ? res : ["UHD", "FHD", "PREV"], renderOptions)
  }

  return {
    imageWeb: render,
    renderOptions,
    cliOptions,
    input,
    output
  }
}


// quick fix: When a root command is specified, a sub command cannot take options for some reasons. So only specify root command when sub command is not called

const usingSubCommand = process.argv.includes("watch")


program
  .version(config.version)
  .name(config.name)
  .description(config.description)


if (!usingSubCommand) program
  .argument('<input>', 'Input directory to (deeply) query files from. May also be a filename. May also be multiple directories or filenames separated by commas. Put your filenames in quotes if they are not safe.')
  .argument('<output>', 'Folder where to dump the output file(s). Or, if the input is a single file, you may also specify a file name here, with a valid extension as codec (e.g. webp or png), thus e.g. "myImg.jpg".')
  .option('-s, --silent', 'silence stdout')
  .option('--dryRun', 'Dry run, do not actually convert images, nothing will be written to disk')
  .option('-ndr, --no-dynamicResolution', 'Disable dynamic resolution mitigation')
  .option('-f, --force', 'force override files when one with the same name is found')
  .option('--exclude <path(s)>', 'Exclude the following (comma separated) paths from the input. Each should be a glob (see https://www.npmjs.com/package/picomatch for reference). IMPORTANT: wrap this argument in quotes if you use wildcards, as otherwise linux will resolve them!')
  .requiredOption('-a, --algorithms <algorithms>', 'comma separated list of image compression algorithms. Available are "avif webp jpg tiff png"')
  .requiredOption('-r, --resolutions <resolutions>', 'comma separated list of requested resolutions. Pixels as number or resolution names (see https://github.com/maximilianMairinger/imageWeb#common-resolutions) are supported')
  .option('-t, --threads <number>', 'How many threads shall be spawned in parallel. Note that more threads consume more memory and dont improve performance if above cpu cores. Defaults to cpu core count. Leave this be for best performance.')
  .option('-ll --legacyLogs', 'Enable legacy logs. Use this for environments that do not support log updates. Note that silent must be false for this to take effect.')
  .option('-d --debug', 'Enable debug logging. Defaults to false.')
  .action(async (_input, _output, ops: any) => {
    const { imageWeb, input, output, cliOptions, renderOptions } = makeImageWebInstanceFromCliOptions(_input, _output, ops)

    if (!renderOptions.silent) console.log(`Running version: v${config.version}`)
    await imageWeb(input, output)
  })


const saniString = sani(String)
const saniArrayOfOne = sani(new AND(Array, ensure((a) => a.length === 1), a => a[0])) as any as <T, R extends any[]>(a: T[]) => T

program.command("watch")
  .description("Starts service that listens to a directory for changes and automatically converts images")
  .argument('<input>', 'Input directory to (deeply) query files from.')
  .argument('<output>', 'Folder where to dump the output files.')
  .option('-s, --silent', 'silence stdout')
  .option('--dryRun', 'Dry run, do not actually convert images, nothing will be written to disk')
  .option('-ndr, --no-dynamicResolution', 'Disable dynamic resolution mitigation')
  .option('-f, --force', 'force override files when one with the same name is found')
  .option('--exclude <path(s)>', 'Exclude the following (comma separated) paths from the input. Each should be a glob (see https://www.npmjs.com/package/picomatch for reference). IMPORTANT: wrap this argument in quotes if you use wildcards, as otherwise linux will resolve them!')
  .requiredOption('-a, --algorithms <algorithms>', 'comma separated list of image compression algorithms. Available are "avif webp jpg tiff png"')
  .requiredOption('-r, --resolutions <resolutions>', 'comma separated list of requested resolutions. Pixels as number or resolution names (see https://github.com/maximilianMairinger/imageWeb#common-resolutions) are supported')
  .option('-t, --threads <number>', 'How many threads shall be spawned in parallel. Note that more threads consume more memory and dont improve performance if above cpu cores. Defaults to cpu core count. Leave this be for best performance.')
  .option('-ll --legacyLogs', 'Enable legacy logs. Use this for environments that do not support log updates. Note that silent must be false for this to take effect.')
  .option('-d --debug', 'Enable debug logging. Defaults to false.')
  .action((_input, _output, ops: any) => {
    saniString(_input, "Input must be a string, representing a path leading to a directory.")
    saniString(_output, "Output must be a string, representing a path leading to a directory.")

    const { imageWeb, input: __input, output, cliOptions, renderOptions } = makeImageWebInstanceFromCliOptions(_input, _output, ops)
    const input = saniArrayOfOne(__input)

    if (!renderOptions.silent) console.log(`Running version: v${config.version}. Watching ${input} for changes.`)
    watch(input, output, imageWeb)
  })

program.parse()


  