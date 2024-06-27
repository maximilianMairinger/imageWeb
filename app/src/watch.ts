import { constrImageWeb } from "./imageWeb"
import chokidar from "chokidar"

export function watch(inputDir: string, outputDir: string, imageWebInstance: ReturnType<typeof constrImageWeb>) {
  async function imgChangeF(path: string, override: boolean) {
    console.log("compressing", path)
    await imageWebInstance(path, outputDir, { force: override })
  }

  imgChangeF(inputDir, false)
  // chokidar.watch(inputDir, { ignoreInitial: true }).on("change", (path) => imgChangeF(path, true))
  // chokidar.watch(inputDir, { ignoreInitial: true }).on("add", (path) => imgChangeF(path, false))
}