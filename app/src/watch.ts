import { ResablePromise } from "more-proms"
import { constrImageWeb } from "./imageWeb"
import chokidar from "chokidar"
import pth from "path"


export function watch(inputDir: string, outputDir: string, imageWebInstance: ReturnType<typeof constrImageWeb>, cb?: (path: string, override: boolean) => ResablePromise<void> | void) {
  async function imgChangeF(path: string, override: boolean) {
    let done: ResablePromise<void> | void
    if (cb) done = cb(path, override)
    
    const { effectedFiles } = await imageWebInstance(path, outputDir, { force: override, legacyLogs: true, silent: override, overrideInputSource: inputDir })
    if (!imageWebInstance.options.silent && effectedFiles > 0) console.log(`Compressed ${override ? " -f" : ""}`, pth.relative(inputDir, path))
    if (done) done.res()
  }
  imgChangeF(inputDir, false)

  

  function onTheFlyImageChange(path: string) {
    imgChangeF(path, true)
  }
  chokidar.watch(inputDir, { ignoreInitial: true }).on("change", onTheFlyImageChange)
  chokidar.watch(inputDir, { ignoreInitial: true }).on("add", onTheFlyImageChange)
}