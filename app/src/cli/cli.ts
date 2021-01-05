#!/usr/bin/env node

import * as path from "path"
import imageWeb, { imageResolutions, compressionOffset, constrWebImage } from "../imageWeb"
import { program } from "commander"
import config from "req-package-json"


const commonResolutions = Object.keys(imageResolutions)
const commonAlgorithem = Object.keys(compressionOffset)

program
  .version(config.version)
  .name(config.name)

program
  .option('-s, --silent', 'silence stdout')
  .option('-d, --no-dynamicResolution', 'Disable dynamic resolution mitigation')
  .option('-a, --algorithms <algorithms>', 'space seperated list of image compression algorithms. Availible are "avif webp jpg tiff png"')
  .option('-a, --resolutions <resolutions>', 'space seperated list of requested resolutions. Pixels as number or resolution names (see https://github.com/maximilianMairinger/imageWeb#common-resolutions) are supported')
.parse(process.argv)

let [ input, output ] = program.args
input = path.resolve("", input ? input : "")
output = path.resolve("", output ? output : config.name + "_output")

let render: typeof imageWeb
if (program.algorithms || program.resolutions) {
  const algs = program.algorithms.split(" ")
  const reses = program.resolutions.split(" ")

  algs.map(a => {
    if (commonAlgorithem.includes(a)) return a
    else throw new Error("Unknown algorithm " + a)
  })

  reses.map(a => {
    if (!isNaN(+a)) return +a
    else if (commonResolutions.includes(a)) return a
    else throw new Error("Unknown algorithm " + a)
  })

  render = constrWebImage(algs, reses)
}

render(input, output, {
  silent: program.silent,
  dynamicResolution: program.noDynamicResolution
})

