#!/usr/bin/env node

import * as path from "path"
import imageWeb, { imageResolutions, compressionOffset, constrImageWeb } from "../imageWeb"
import { program } from "commander"
import reqPackageJson from "req-package-json"
import findNextDirname, { findNextCommonDirname } from "./findNextDirname"
import * as fs from "fs"
const merge = require("deepmerge")
const config = reqPackageJson(__dirname)


program
  .version(config.version)
  .name(config.name)
  .argument('<input>', 'Input directory to (deeply) query files from. May also be a filename. May also be multiple directories or filenames separated by commas. Put your filenames in quotes if they are not safe.')
  .argument('[output]', 'May be a folder where to dump the output file(s). Defaults to "${input}_output". Or, if the input is a single file, you may also specify a file name here, with a valid extension as codec (e.g. webp or png), thus e.g. "myImg.jpg."')
  .option('-s, --silent', 'silence stdout')
  .option('-d, --no-dynamicResolution', 'Disable dynamic resolution mitigation')
  .option('-f, --force', 'force override files when one with the same name is found')
  .option('-a, --algorithms <algorithms>', 'comma seperated list of image compression algorithms. Availible are "avif webp jpg tiff png"')
  .option('-r, --resolutions <resolutions>', 'comma seperated list of requested resolutions. Pixels as number or resolution names (see https://github.com/maximilianMairinger/imageWeb#common-resolutions) are supported')
  .option('-t, --threads <number>', 'How many threads shall be spawned in parallel. Note that more threads consume more memory and dont improve performance if above cpu cores. Defaults to cpu core count. Leave this be for best performance.')
  .option('-ll --legacyLogs', 'Enable legacy logs. Use this for environments that do not support log updates. Note that silent must be false for this to take effect.')
  .option('-d --debug', 'Enable debug logging. Defaults to false.')


program.parse();

  



const ops = program.opts();

const options = (() => {
  const end = {} as any

  if (ops.silent !== undefined) end.silent = ops.silent
  if (ops.dynamicResolution !== undefined) end.dynamicResolution = ops.dynamicResolution
  if (ops.force !== undefined) end.force = ops.force
  if (ops.threads !== undefined) end.threads = +ops.threads
  if (ops.debug !== undefined) end.debug = ops.debug
  if (ops.legacyLogs !== undefined) end.legacyLogs = ops.legacyLogs
  
  return end
})() as {
  silent?: boolean,
  dynamicResolution?: boolean,
  force?: boolean,
  threads?: number,
  debug?: boolean
}


const commonResolutions = Object.keys(imageResolutions)
const commonAlgorithem = Object.keys(compressionOffset)

let [ inputt, output ] = program.args
let input: string[] | string
input = inputt.split(",").map((input) => path.resolve("", input ? input : ""))
output = path.resolve("", output ? output : path.join(config.name + "_output", findNextCommonDirname(input)))

let render: typeof imageWeb




const alg = !ops.algorithms ? undefined : ops.algorithms.split(",").map(alg => {
  if (commonAlgorithem.includes(alg)) return alg
  else throw new Error("Unknown algorithm " + alg)
}) as ("png" | "webp" | "jpg" | "tiff" | "avif")[]

const res = !ops.resolutions ? undefined : ops.resolutions.split(",").map(res => {
  if (!isNaN(+res)) return +res
  else if (commonResolutions.includes(res)) return res
  else if (res.endsWith("p") && !isNaN(+res.substring(0, res.length-1))) return res
  else throw new Error("Unknown resolution " + res)
}) 



if (alg && res) {
  render = constrImageWeb(alg, res)
}
else {
  let hasSpecificOutputWish: { alg: any, res: { pixels: number, displayName: string } | { name: string, displayName?: string } }

  (() => {
    if (input.length !== 1) return
    input = input[0]
    if (fs.existsSync(input) && fs.lstatSync(input).isDirectory()) return
    if (fs.existsSync(output)) {
      if (!fs.lstatSync(output).isDirectory()) {
        if (!options.force) throw new Error("Output points to a existing file. Use -f to force override. Terminating here, before any changes.")
      }
      else return
    }
    let outputCodec: any
    let inputCodec: any
    for (const codec of commonAlgorithem) {
      if (output.endsWith("." + codec)) outputCodec = codec
      if (input.endsWith("." + codec)) inputCodec = codec
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

  

  render = hasSpecificOutputWish ? constrImageWeb([hasSpecificOutputWish.alg], [hasSpecificOutputWish.res]) : 
                                   constrImageWeb(alg ? alg : ["jpg", "webp", "avif"], res ? res : ["UHD", "FHD", "PREV"])
}




console.log(`Running version: v${config.version}`)

render(input, output, merge({
  silent: false
}, options))
