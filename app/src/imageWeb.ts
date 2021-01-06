import * as sharp from "sharp"
const isImage = require("is-image")
import * as fss from "fs"
import * as pth from "path"
const slash = require("slash")
import xrray from "xrray"; xrray(Array)
import * as cliProgress from "cli-progress"
import * as logUpdate from "log-update"
const { promises: fs } = fss
const { SingleBar } = cliProgress
const mkDir = require("make-dir")
const merge = require("deepmerge")
import timoi from "timoi"

const unionResWithNameSymbol = "@"

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

function constructGetImg(foundCb?: (url: string, pathWithoutExtension: string) => Promise<boolean | void> | boolean | void) {
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
            const didFind = {path, fileName}
            founds.add(didFind)
            if (foundCb) promsDone.add(new Promise<void>((res) => {
              let r = foundCb(path, fileName)
              if (r instanceof Promise) r.then(go as any)
              else go(r as any)
              function go(accept: boolean = true) {
                if (!accept) founds.rmV(didFind)
                res()
              }
            }))
          }
          
          
        })())
      }
      
      Promise.all(totaloPromo).then(() => {
        const foundProm = Promise.all(proms).then((found: any[]) => {
          const r = [...founds, ...(found as any).flat()]
          resQuick(r)
          return r
        })
        Promise.all([proms, foundProm, ...promsDone, ...proms.Inner("done", [])]).then(([found]) => {
          resDone([...founds, ...(found as any).flat()])
        })
      })
    })
  }
}

export function removeExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "")
}



export const compressionOffset = {
  png: 1,
  webp: 1.6,
  jpg: 1.4,
  tiff: 1.3,
  avif: 1.8
}

type ImageFormats = keyof typeof compressionOffset


type Pixels = number
export const imageResolutions = {
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

type Options = {
  silent?: boolean,
  dynamicResolution?: boolean,
  override?: boolean
}
const defaultOptions: Options = {
  silent: true,
  dynamicResolution: true,
  override: true
}

export function constrImageWeb(formats: ImageFormats[], resolutions: (ImageResolutions | Pixels | {pixels: Pixels, name?: string} | WidthHeight)[], _options: Options = {}) {
  _options = merge(defaultOptions, _options)
  const reses = normalizeResolution(resolutions)
  return function (input: string, outputDir: string, options: Options = {}) {
    return new Promise<void>(async (res) => {
      input = slash(input)
      outputDir = slash(outputDir)
      const inputIsFile = fss.lstatSync(input).isFile()
      options = merge(_options, merge({override: isImage}, options))
      
  
      if (!fss.existsSync(input)) throw new Error("Input cannot be found")
      mkDir(outputDir)
  
      let iii = input
      if (iii.endsWith("/")) iii = iii.slice(0, -1)
      
      const slashCount = iii.split("/").length - (inputIsFile ? 1 : 0)
  
  
      const progress = new SingleBar({}, cliProgress.Presets.legacy)

      function formatFileName(fileName: string) {
        return slash(fileName).split("/").slice(slashCount).join("/")
      }

      function toOutFilname(fileName: string, format: string, res: string) {
        return `${fileName}${unionResWithNameSymbol}${res}.${format.toLowerCase()}`
      }
  
      let done = 1
      const render = async (path: string, fileName: string) => {
        fileName = formatFileName(fileName)
  
        const img = sharp(path) as ReturnType<typeof sharp> & {export: (format: string, name?: string) => Promise<void>}
        
        img.export = (format: string, name: string) => {
          const outFilname = pth.join(outputDir, `${toOutFilname(fileName, format, name)}`)
          if (alreadyDone.includes(outFilname)) return Promise.resolve()
          const prom = img.toFile(outFilname) as any as Promise<void>
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
              const factorize = constrFactorize(Math.sqrt(hasPixels / (res.pixels * (options.dynamicResolution ? compressionOffset[format] : 1))))
              
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
  
  
      
      let find: ReturnType<typeof constructGetImg>
      let alreadyDone = []
      if (!options.silent) {
        console.log("Searching...")
        logUpdate("Found 0 files")
        let found = 1
        find = constructGetImg(async (find, name) => {
          logUpdate(`Found ${found++} files`)
          let fileName = formatFileName(name)

          if (!options.override) {
            for (let res of reses) {
              for (let format of formats) {
                
                const outFilename = pth.join(outputDir, toOutFilname(fileName, format, res.name)) 
                if (fss.existsSync(outFilename)) {
                  alreadyDone.add(outFilename)
                }
              }
            }
          }
        })
      }
      else find = constructGetImg()
      
      find([input], "").done(async (files) => {
        
        let todoCount = files.length * reses.length * formats.length - alreadyDone.length

        let time = timoi()
        if (!options.silent) {
          console.log("Rendering... When exiting prematurely, some output images may be corrupted.")
          progress.start(todoCount, 0)
        }
  
        const proms = []
        for (let e of files) {
          proms.add(render(e.path, e.fileName))
        }
  
        await Promise.all(proms)
  
        if (!options.silent) {
          progress.stop()
          console.log(`Done. Took ${time.str()}`)
        }
        res()
      })
    })
  }
  
}


export const imageweb = constrImageWeb(["jpg", "webp", "png", "avif"], [
  "4K",
  "3K",
  "FHD",
  "HD",
  "PREV"
])

export default imageweb
