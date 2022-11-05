#!/usr/bin/env node

import * as path from "path"
import imageWeb, { imageResolutions, compressionOffset, constrImageWeb, OutputIsFileError } from "../imageWeb"
import { program } from "commander"
import reqPackageJson from "req-package-json"
import findNextDirname from "./findNextDirname"
import * as fs from "fs"
const merge = require("deepmerge")
const config = reqPackageJson(__dirname)

program
  .version(config.version)
  .name(config.name)

program
  .option('-s, --silent', 'silence stdout')
  .option('-d, --no-dynamicResolution', 'Disable dynamic resolution mitigation')
  .option('-f, --force', 'force override files when one with the same name is found')
  .option('-a, --algorithms <algorithms>', 'comma seperated list of image compression algorithms. Availible are "avif webp jpg tiff png"')
  .option('-r, --resolutions <resolutions>', 'comma seperated list of requested resolutions. Pixels as number or resolution names (see https://github.com/maximilianMairinger/imageWeb#common-resolutions) are supported')
  .option('-t, --threads <number>', 'How many threads shall be spawned in parallel. Note that more threads consume more memory and dont improve performance if above cpu cores. Defaults to cpu core count. Leave this be for best performance.')
  .option('-d', '--debug', 'Enable debug logging. Defaults to false.')
.parse(process.argv)



const options = (() => {
  const end: any = {}
  if (program.silent !== undefined) end.silent = program.silent
  if (program.noDynamicResolution !== undefined) end.dynamicResolution = !program.noDynamicResolution
  if (program.force !== undefined) end.force = program.force
  if (program.threads !== undefined) end.threads = +program.threads
  if (program.debug !== undefined) end.debug = program.debug
  
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

let [ input, output ] = program.args
input = path.resolve("", input ? input : "")
output = path.resolve("", output ? output : path.join(config.name + "_output", findNextDirname(input)))

let render: typeof imageWeb
if (program.algorithms || program.resolutions) {
  let algs = program.algorithms.split(",")
  let reses = program.resolutions.split(",")

  algs = algs.map(alg => {
    if (commonAlgorithem.includes(alg)) return alg
    else throw new Error("Unknown algorithm " + alg)
  })

  reses = reses.map(res => {
    if (!isNaN(+res)) return +res
    else if (commonResolutions.includes(res)) return res
    else if (res.endsWith("p") && !isNaN(+res.substring(0, res.length-1))) return res
    else throw new Error("Unknown resolution " + res)
  })

  render = constrImageWeb(algs, reses)
}
else {
  let hasSpesificOutputWish: { alg: any, res: { pixels: number, name: string } }

  (() => {

    if (fs.existsSync(input) && fs.lstatSync(input).isDirectory()) return
    if (fs.existsSync(output) && !fs.lstatSync(output).isDirectory()) {
      if (!options.force) throw new Error("Output points to a existing file. Use -f to force override. Terminating here, before any changes.")
    }
    let outputCodec: any
    let inputCodec: any
    for (const codec of commonAlgorithem) {
      if (output.endsWith("." + codec)) outputCodec = codec
      if (input.endsWith("." + codec)) inputCodec = codec
    }
    if (inputCodec && outputCodec) {
      hasSpesificOutputWish = { alg: outputCodec, res: {pixels: imageResolutions.UHD, name: ""} }
    }
  })()

  if (hasSpesificOutputWish) {
    output = path.join(output, "..")
    render = constrImageWeb([hasSpesificOutputWish.alg], [hasSpesificOutputWish.res])
  }
  else {
    render = imageWeb
  }
}





render(input, output, merge({
  silent: false
}, options))
