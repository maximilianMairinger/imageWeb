import { ResablePromise } from "more-proms"
import { constrImageWeb } from "./imageWeb"
import chokidar from "chokidar"

export function watch(inputDir: string, outputDir: string, imageWebInstance: ReturnType<typeof constrImageWeb>, cb: (path: string, override: boolean) => ResablePromise<void>) {
  async function imgChangeF(path: string, override: boolean) {
    const done = cb(path, override)
    if (!imageWebInstance.options.silent) console.log(`compressing${override ? " -f" : ""}`, path)
    await imageWebInstance(path, outputDir, { force: override })
    done.res()
  }

  imgChangeF(inputDir, false)
  chokidar.watch(inputDir, { ignoreInitial: true }).on("change", (path) => imgChangeF(path, true))
  chokidar.watch(inputDir, { ignoreInitial: true }).on("add", (path) => imgChangeF(path, true))
}