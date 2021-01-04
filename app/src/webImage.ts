import sharp from "sharp"
import isImage from "is-image"
import fss, { promises as fs } from "fs"
import pth from "path"
import slash from "slash"
import xrray from "xrray"; xrray(Array)
import cliProgress, { SingleBar } from "cli-progress"
import logUpdate from "log-update"

class QuickPromise<T> extends Promise<T> {
  constructor(call: (resQuick: Function, resDone: Function) => void) {
    super((res) => {
      call((val) => {
        res(val)
      }, (val) => {
        this.dones.Call(val)
        this.done = (f) => {
          if (f === undefined) return Promise.resolve(val)
          else f(val)
          return this
        }
      })
    })
  }
  private dones = []
  done(then?: Function) {
    if (then === undefined) return new Promise((res) => {this.dones.add(res)})
    else this.dones.add(then)
    return this
  }
}

function constructGetImg(foundCb?: (url: string, pathWithoutExtension: string) => void) {
  return function getImg(dirs: string[], sub: string) {
    return new QuickPromise<{ path: string, fileName: string }[]>((resQuick, resDone) => {
      const proms: QuickPromise<any>[] = []
      const founds = []
      const promsDone = []
      const totaloPromo = []
      for (let dir of dirs) {
        totaloPromo.add((async () => {
          const subDir = pth.join(sub, dir)
        
          if ((await fs.lstat(subDir)).isDirectory()) {
            proms.add(getImg(await fs.readdir(subDir), subDir))
          }
          else if (isImage(subDir)) {
            const fileName = removeExtension(subDir)
            const path = subDir
            founds.add({path, fileName})
            if (foundCb) promsDone.add(foundCb(path, fileName))
          }
          
          
        })())
      }
      
      Promise.all(totaloPromo).then(() => {
        const quickDone = Promise.all(proms).then((found: any[]) => {
          const r = [...founds, ...(found as any).flat()]
          resQuick(r)
          return r
        })
        Promise.all([quickDone, ...promsDone, ...proms.Inner("done", [])]).then((e) => {
          resDone(e[0])
        })
      })
    })
  }
}

function removeExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "")
}



const compressionOffset = {
  png: 1,
  webp: 1.6,
  jpg: 1.4,
  tiff: 1.3,
  avif: 1.8
}

type ImageFormats = keyof typeof compressionOffset


type Pixels = number
const imageResolutions = {
  "4K": 8294400, // 2160p
  "3K": 3686400, // 1440p
  "FHD": 2073600, // 1080p
  "HD": 921600, // 720p
  "SD": 408960, // 480p
  "TINY": 36864, // 144p
  "PREV": 400 // 15p
}

type ImageResolutions = keyof typeof imageResolutions
type WidthHeight = {width?: number, height: number, name?: string} | {width: number, height?: number, name?: string}

const heightToWidthFactor = 16 / 9

function normalizeResolution(resolutions: (ImageResolutions | Pixels | {pixels: Pixels, name?: string} | WidthHeight)[]) {
  return resolutions.map((res) => {
    if (typeof res === "string") res = {pixels: imageResolutions[res.toUpperCase()], name: res}
    else if (typeof res === "number") res = {pixels: res, name: res.toString()}
    else {
      let pixels: number
      if ((res as any).pixels !== undefined) pixels = (res as any).pixels
      else {
        if ((res as any).width === undefined) (res as any).width = (res as any).height * heightToWidthFactor
        else if ((res as any).height === undefined) (res as any).height = (res as any).width / heightToWidthFactor
        pixels = (res as any).height * (res as any).width
      }
      
      res = {name: res.name !== undefined ? res.name : pixels.toString(), pixels}
    }

    return res
  })
}

function constrFactorize(factor: number) {
  return function factorize(length: number) {
    const q = Math.round(length / factor)
    return q < 1 ? 1 : q
  }
}


export function constrWebImage(formats: ImageFormats[], resolutions: (ImageResolutions | Pixels | {pixels: Pixels, name?: string} | WidthHeight)[], dynamicResolution = true) {
  const reses = normalizeResolution(resolutions)
  return async function (inputDir: string, outputDir: string) {
    console.log("")

    if (!(fss.existsSync(outputDir) && (await fs.lstat(outputDir)).isDirectory())) await fs.mkdir(outputDir)
    inputDir = slash(inputDir)
    outputDir = slash(outputDir)

    let iii = inputDir
    if (iii.endsWith("/")) iii = iii.slice(0, -1)
    const slashCount = iii.split("/").length

    const progress = new SingleBar({}, cliProgress.Presets.legacy)

    let done = 1
    const render = async (path: string, fileName: string) => {
      fileName = slash(fileName)
      fileName = fileName.split("/").slice(slashCount).join("/")

      const img = sharp(path) as ReturnType<typeof sharp> & {export: (format: string, name?: string) => Promise<void>}
      
      img.export = (format: string, name: string) => {
        const exportName = `${fileName}@${name}.${format.toLowerCase()}`
        const prom = img.toFile(pth.join(outputDir, `${exportName}`)) as any as Promise<void>
        prom.then(() => {
          progress.update(done++)
        })
        return prom
      }

      const meta = await img.metadata()
      const hasPixels = meta.width * meta.height

      const proms = []
      for (let res of reses) {
        const name = res.name
        function render(format: string) {
          return img.export(format, name)
        }

        if (hasPixels > res.pixels) {
          for (let format of formats) {
            const factorize = constrFactorize(Math.sqrt(hasPixels / (res.pixels * (dynamicResolution ? compressionOffset[format] : 1))))
            
            img.resize({
              width: factorize(meta.width),
              height: factorize(meta.height)
            })

            proms.add(render(format))
          }
        }
        else for (let format of formats) proms.add(render(format))

        await Promise.all(proms)
      }
    }

    console.log("Searching...")
    logUpdate("Found 0 files")
    let found = 1
    constructGetImg(async () => {
      logUpdate(`Found ${found++} files`)
    })([inputDir], "").done(async (todo) => {
      console.log("Rendering...")
      progress.start(todo.length * reses.length * formats.length, 0)

      const proms = []
      for (let e of todo) {
        proms.add(render(e.path, e.fileName))
      }

      await Promise.all(proms)

      progress.stop()
      console.log("done")
    })
  }
  
}


export const webImage = constrWebImage(["jpg", "webp", "png", "avif"], [
  // "4K",
  // "SD",
  // 408960,
  // 100,
  // {pixels: 200},
  {width: 10000, name: "width"},
  {height: 10000, name: "height"},
])

export default webImage
