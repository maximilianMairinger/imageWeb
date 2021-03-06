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
import * as os from "os"
import * as del from "del"

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
        Promise.all([Promise.all(proms), foundProm, ...promsDone, ...proms.Inner("done", [])]).then(([found]) => {
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
  force?: boolean,
  threads?: number,
  debug?: boolean
}

let _______threads = 1
try {
  _______threads = os.cpus().length
}
catch(e) {}
const defaultOptions: Options = {
  silent: true,
  dynamicResolution: true,
  force: false,
  threads: _______threads,
  debug: false
}

export function constrImageWeb(formats: ImageFormats[], resolutions: (ImageResolutions | Pixels | {pixels: Pixels, name?: string} | WidthHeight)[], _options: Options = {}) {
  _options = merge(defaultOptions, _options)
  const reses = normalizeResolution(resolutions)
  return function (input: string, outputDir: string, options: Options = {}) {
    return new Promise<void>(async (res) => {
      input = slash(input)
      outputDir = slash(outputDir)
      const inputIsFile = fss.lstatSync(input).isFile()
      options = merge(_options, options)
  
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



      
  
      const scheduleRenders = (path: string, fileName: string) => {
        fileName = formatFileName(fileName)
  
        const img = sharp(path)

        let lastPrepImg: any

        
        
        const exportImg = (outFilename: string) => {
          return img.toFile(outFilename) as any as Promise<void>
        }
        
  
        const meta = img.metadata()
        const hasPixels = meta.then((meta) => meta.width * meta.height)
  
        const scheduledRenders: { (): Promise<void>, outFilename: string }[] = []
        for (let res of reses) {
          
          const { name: resName } = res

          


          function scheduleRender(format: string, prepImg?: () => (void | Promise<void>)) {
            const outFilename = pth.join(outputDir, `${toOutFilname(fileName, format, resName)}`)
            if (!alreadyDone.includes(outFilename)) {
              const f = async (id) => {
                if (options.debug) console.log(id, ">", pth.basename(outFilename))
                if (prepImg) {
                  if (prepImg !== lastPrepImg) {
                    lastPrepImg = prepImg
                    await prepImg()
                  }
                }
                
                await exportImg(outFilename)
                if (options.debug) console.log(id, "<    ", pth.basename(outFilename))
              }
              f.outFilename = outFilename
              scheduledRenders.add(f as any)
            }
          }



          const srcIsBiggerThanWanted = hasPixels.then((hasPixels) => hasPixels > res.pixels)

          const basicPrepImg = async () => {
            img.resize({
              width: (await meta).width,
              height: (await meta).height
            })
          }

          for (let format of formats) {
            scheduleRender(format, async () => {
          
              if (await srcIsBiggerThanWanted) {
                const factorize = constrFactorize(Math.sqrt((await hasPixels) / (res.pixels * (options.dynamicResolution ? compressionOffset[format] : 1))))

                img.resize({
                  width: factorize((await meta).width),
                  height: factorize((await meta).height)
                })
              }
              else {
                scheduleRender(format, basicPrepImg)
              }
            })
          }        
        }
        return scheduledRenders
      }
  
  
      const queryAlreadyExsistingFiles = (name: string) => {
        let fileName = formatFileName(name)

        if (!options.force) {
          for (let res of reses) {
            for (let format of formats) {
              
              const outFilename = pth.join(outputDir, toOutFilname(fileName, format, res.name)) 
              if (fss.existsSync(outFilename)) {
                alreadyDone.add(outFilename)
              }
            }
          }
        }
      }
      
      let find: ReturnType<typeof constructGetImg>
      let alreadyDone = []
      if (!options.silent) {
        console.log("Searching...")
        let found = 0
        logUpdate(`Found ${found++} files`)
        find = constructGetImg(!options.force ? (find, name) => {
          logUpdate(`Found ${found++} files`)
          queryAlreadyExsistingFiles(name)
        } : () => {
          logUpdate(`Found ${found++} files`)
        })
      }
      else find = constructGetImg(!options.force ? (find, name) => {
        queryAlreadyExsistingFiles(name)
      } : undefined)
      
      find([input], "").done(async (files: {path: string, fileName: string}[]) => {
        let todoCount = files.length * reses.length * formats.length - alreadyDone.length
        
        if (!options.silent) console.log("Rendering on " + options.threads + " threads.")
        let startedOrderFilenames = []
        let exitTryCount = 0
        // process.on('SIGINT', async () => {
        //   const maybeCorruptedCount = (files.length - startedOrderFilenames.length) > options.threads ? files.length - startedOrderFilenames.length : options.threads
        //   if (exitTryCount === 0) {
        //     exitTryCount++
        //     console.log(`Exiting... Removing ${maybeCorruptedCount} corrupted files first...`)
        //     const maybeCorruptedFilenames = startedOrderFilenames.slice(startedOrderFilenames.length - maybeCorruptedCount)
        //     setTimeout(() => {
        //       console.log(`This is taking unexpectedly long... Interrupt again to cancel`)
        //     }, 500)
            
        //     await del(maybeCorruptedFilenames)
        //     console.log("Done cleaning up. Now exiting!")
        //     process.exit(130)
        //   }
        //   else {
        //     console.log(`Exiting prematurely. The last ${maybeCorruptedCount} could be corrupted. Now exiting!`)
        //     process.exit(130)
        //   }
        // });

        let time = timoi()
        if (!options.silent) {
          progress.start(todoCount, 0)
        }
  

        const render = (() => {
          const list = []
          let i = 0
          let fileIndex = 0

          return (id: number) => {
            return new Promise<void>((res, rej) => {
              if (list[i] === undefined) {
                for (; (fileIndex < files.length) && (list[i] === undefined); ) {
                  const file = files[fileIndex]
                  fileIndex++
                  list.add(...scheduleRenders(file.path, file.fileName).map((render) => (...a) => {
                    startedOrderFilenames.add(render.outFilename)
                    //@ts-ignore
                    return render(...a)
                  }))
                }
  
                if (list[i] !== undefined) list[i++](id).then(res)
                else rej()
              }
              else {
                list[i++](id).then(res)
              }
            })
          }
        })()


        let done = 1
        const startThread = (async (id: number) => {
          let failed = false
          try {await render(id)}
          catch(e) {failed = true}
          if (!failed) {
            if (!options.silent) progress.update(done++)
            await startThread(id)
          }
        })

        const threadsList = []
        for (let i = 0; i < options.threads; i++) {
          threadsList.add(startThread(i))
        }

        await Promise.all(threadsList)

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
