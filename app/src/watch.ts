import { ResablePromise } from "more-proms"
import { constrImageWeb, parseExcludeFunction } from "./imageWeb"
import chokidar from "chokidar"
import pth from "path"


export function watch(inputDir: string, outputDir: string, imageWebInstance: ReturnType<typeof constrImageWeb>, cb?: (path: string, override: boolean) => ResablePromise<void> | void) {
  async function imgChangeF(path: string, override: boolean) {
    let done: ResablePromise<void> | void
    if (cb) done = cb(path, override)
    if (!imageWebInstance.options.silent) console.log(`compressing${override ? " -f" : ""}`, path)
    await imageWebInstance(path, outputDir, { force: override })
    if (done) done.res()
  }
  imgChangeF(inputDir, false)

  const excludeF = parseExcludeFunction(imageWebInstance.options.exclude)

  function onTheFlyImageChange(path: string) {
    if (excludeF(path, inputDir)) return
    imgChangeF(path, true)
  }
  chokidar.watch(inputDir, { ignoreInitial: true }).on("change", onTheFlyImageChange)
  chokidar.watch(inputDir, { ignoreInitial: true }).on("add", onTheFlyImageChange)
}