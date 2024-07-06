import { BorrowMap } from "more-maps"
import isImage from "is-image"
import fss from "fs"
import * as pth from "path"
import slash from "slash"
import xrray from "xrray"; xrray(Array)
import * as cliProgress from "cli-progress"
import logUpdate from "log-update"
import { promises as fs } from "fs"
const { SingleBar } = cliProgress
import { makeDirectorySync } from "make-dir"
import { mergeKeysDeep } from "circ-clone"
import timoi from "timoi"
import * as os from "os"
import * as crypto from "crypto";
import keyIndex from "key-index"
import { ResablePromise } from "more-proms"
import sharp from "sharp"
import LinkedList from "fast-linked-list"
export { watch } from "./watch"
import glob from "picomatch"


type exclude = true
type keep = false

type Options = {
  silent?: boolean,
  dynamicResolution?: boolean,
  force?: boolean,
  threads?: number,
  debug?: boolean,
  dryRun?: boolean,
  onProgress?: (done: number, total: number) => void,
  legacyLogs?: boolean,
  exclude?: string | string[] | RegExp | ((path: string, pathWithoutExtension: string, fromInputDir: string) => (exclude | keep))
}

let _______threads = 1
try {
  _______threads = os.cpus().length
}
catch(e) {}


let manuallySetUV_THREADPOOL_SIZE = false
if (process.env.UV_THREADPOOL_SIZE === undefined) {
  process.env.UV_THREADPOOL_SIZE = _______threads + ""
}
else {
  console.log(`Found var env var UV_THREADPOOL_SIZE. Thus using ${process.env.UV_THREADPOOL_SIZE} concurrent image renders.`)
  if (typeof +process.env.UV_THREADPOOL_SIZE === "number") {
    manuallySetUV_THREADPOOL_SIZE = true
  }
  else {
    console.log(`But it is not a number. Thus using ${_______threads} concurrent image renders.`)
  }
}




const defaultOptions: Options = {
  silent: true,
  dynamicResolution: true,
  force: false,
  threads: manuallySetUV_THREADPOOL_SIZE ? +process.env.UV_THREADPOOL_SIZE : _______threads,
  debug: false,
  dryRun: false,
  onProgress: () => {},
  legacyLogs: false
}











function createHash(data, len) {
    return crypto.createHash("shake256", { outputLength: len })
      .update(data)
      .digest("hex");
}



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

function constructGetImg(excludeF?: (path: string, pathWithoutExtension: string, fromInputDir: string) => Promise<boolean | void> | boolean | void) {
  return function getImg(dirs: string[], sub: string, ogDir?: string) {
    return new QuickPromise<{ path: string, fileName: string }[]>((resQuick, resDone) => {
      const proms: QuickPromise<any>[] = []
      const founds = new LinkedList()
      const promsDone = []
      const totaloPromo = []
      for (let dir of dirs) {
        totaloPromo.add((async () => {
          const subDir = pth.join(sub, dir)
          const fromInputDir = ogDir !== undefined ? ogDir : dir
        
          if ((await fs.lstat(subDir)).isDirectory()) {
            proms.add(getImg(await fs.readdir(subDir), subDir, fromInputDir))
          }
          else if (isImage(subDir)) {
            const fileName = removeExtension(subDir)
            const path = subDir
            const didFind = {path, fileName, fromInputDir}
            const addToken = founds.push(didFind)
            if (excludeF) promsDone.add(new Promise<void>((res) => {
              let r = excludeF(path, fileName, fromInputDir)
              if (r instanceof Promise) r.then(go as any)
              else go(r as any)
              function go(exclude: boolean = false) {
                if (exclude) addToken.rm()
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
  "2UHD": 7680 * 4320, // 4320p
  "UHD": 3840 * 2160, // 2160p
  "QHD": 2560 * 1440, // 1440p
  "FHD": 1920 * 1080, // 1080p
  "HD": 1280 * 720, // 720p
  "SD": 640 * 480, // 480p
  "LD": 320 * 240, // 240p
  "TINY": 256 * 144, // 144p
  "PREV": 25 * 15 // 15p 
} as {
  "2UHD": Pixels,
  "8K": Pixels,
  "UHD": Pixels,
  "4K": Pixels,
  "QHD": Pixels,
  "3K": Pixels,
  "2K": Pixels,
  "FHD": Pixels,
  "HD": Pixels,
  "SD": Pixels,
  "LD": Pixels,
  "TINY": Pixels,
  "PREV": Pixels,
}

imageResolutions["8K"] = imageResolutions["2UHD"]
imageResolutions["4K"] = imageResolutions["UHD"]
imageResolutions["3K"] = imageResolutions["QHD"] // this is the same as 2K for legacy reasons
imageResolutions["2K"] = imageResolutions["QHD"]


const commonAlgorithem = Object.keys(compressionOffset)


type ImageResolutions = keyof typeof imageResolutions
type WidthHeight = {width?: number, height: number, displayName?: string} | {width: number, height?: number, displayName?: string}

const heightToWidthFactor = 16 / 9

function normalizeResolutionName(name: string) {
  if (typeof name === "string") {
    if (name.endsWith("p")) {
      const height = +name.substring(0, name.length - 1)
      if (!isNaN(height)) return {pixels: height * heightToWidthFactor * height, displayName: name}
    }
    let pixels = imageResolutions[name.toUpperCase()]
    if (pixels === undefined) {
      if (!isNaN(+name)) pixels = +name
      else throw new Error(`Invalid resolution: ${name}`)
    }
    return {pixels, displayName: name}
  }
  else throw new Error(`Invalid resolution: ${name}`)
}

function normalizeResolution(resolutions: (ImageResolutions | Pixels | `${number}p` | {pixels: Pixels, displayName?: string} | {name: string, displayName?: string} | WidthHeight)[]) {
  return resolutions.map((res) => {
    if (typeof res === "string") {
      res = normalizeResolutionName(res)
    }
    else if (typeof res === "number") res = {pixels: res, displayName: res.toString()}
    else {
      if ((res as any).name !== undefined) {
        const { displayName } = res
        res = normalizeResolutionName((res as any).name)
        if (displayName !== undefined) res.displayName = displayName
      }
      else {
        const initiallyHeightWasGiven = (res as any).height !== undefined
        const initiallyWidthWasGiven = (res as any).width !== undefined
        let pixels: number
        if ((res as any).pixels !== undefined) pixels = (res as any).pixels
        else {
          if ((res as any).width === undefined) (res as any).width = (res as any).height * heightToWidthFactor
          else if ((res as any).height === undefined) (res as any).height = (res as any).width / heightToWidthFactor
          pixels = (res as any).height * (res as any).width
        }
        res = {displayName: (res as any).displayName !== undefined ? (res as any).displayName : initiallyHeightWasGiven ? (res as any).height + "p" : initiallyWidthWasGiven ? (res as any).width + "w" : pixels.toString(), pixels}
      }

      
    }

    return res as any as {displayName: string, pixels: number}
  })
}

function constrFactorize(factor: number) {
  return function factorize(length: number) {
    const q = Math.round(length * factor)
    return q < 1 ? 1 : q
  }
}



// export function constrImageWeb(formats: ImageFormats[], resolutions: (ImageResolutions | Pixels | {pixels: Pixels, displayName?: string} | {name: string, displayName?: string} | WidthHeight)[], _options?: Options)
// export function constrImageWeb(formats: ImageFormats[], resolutions: (`${number}p`)[], _options?: Options)
export function constrImageWeb(formats: ImageFormats[], resolutions: (ImageResolutions | Pixels | `${number}p` | {pixels: Pixels, displayName?: string} | {name: string, displayName?: string} | WidthHeight)[], _options: Options = {}) {
  _options = mergeKeysDeep(defaultOptions, _options)
  const reses = normalizeResolution(resolutions)

  const doneIndex = keyIndex((codec: string) => keyIndex((pixels: number) => keyIndex((srcName: string) => false as false | ResablePromise<{path: string}>)))
  imageWeb.options = _options
  return imageWeb
  function imageWeb (input: string | string[], outputDir: string, options: Options = {}) {
    return new Promise<void>(async (res) => {

      const beforeProgramDoneCbs = [] as Function[]

      outputDir = slash(outputDir)

      input = input instanceof Array ? input : [input]
      input = input.map((input) => slash(input))
      
      input.forEach((input) => {
        if (!fss.existsSync(input)) throw new Error(`Input ${input} cannot be found`)
      })
      options = mergeKeysDeep(_options, options)

      if (options.debug || options.dryRun) options.legacyLogs = true // the progress bar swallows all logs during the process

        
  
  
      const progress = new SingleBar({}, cliProgress.Presets.legacy)

      function formatFileName(fileName: string, commonDir: string) {
        return pth.relative(commonDir, fileName)
      }

      const toOutFilname = (fileName: string, format: string, res: string) => {
        return `${fileName}${res !== "" ? (unionResWithNameSymbol + res) : ""}.${format.toLowerCase()}`
      }




      const sharpInstancesIndex = new BorrowMap((inputPath: string) => sharp(inputPath))

      function *getRenderTask(files: {path: string, fileName: string, fromInputDir: string, formattedFileName: string}[]) {

        for (const format of formats) {
          const formatDoneIndex = doneIndex(format)
          for (const res of reses) {
            for (const file of files) {
              const onlyFileName = toOutFilname(file.formattedFileName, format, res.displayName)
              const outFilename = pth.join(outputDir, onlyFileName)
              if (alreadyDone.includes(pth.resolve(outFilename))) continue
              yield async (processID: any) => {
                if (options.debug) console.log(processID, ">", pth.basename(outFilename))
                const {elem: img, done} = sharpInstancesIndex.borrow(file.path)
                try {
                  


                  if (fss.existsSync(outFilename)) {
                    if (!(await fs.lstat(outFilename)).isDirectory()) {
                      // this is only a secondary check, such a file shouldnt be in the todo queue anyway as they get filtered out by queryAlreadyExsistingFiles before
                      if (!options.force) throw new Error(`Output file ${outFilename} already exists and the force option flag is not enabled. This should'nt happen, as this file should have been filtered out beforehand (at the start of the program). Make sure that no other program is writing to this directory. It could also be that two input files write to the same output (if they only differ by extension). Terminating here. Be aware, some files may have been computed and written to disk already.`)
                    }
                    else throw new Error(`Output filename ${outFilename} already exists and is a dir! This shouldn't happen, as this should have been detected beforehand (at the start of the program). Make sure that no other program is writing to this directory. Terminating here. Be aware, some files may have been computed and written to disk already.`)
                  }


                  const wantedPixels = res.pixels * (options.dynamicResolution ? compressionOffset[format] : 1)
                  const meta = await img.metadata()
                  const hasPixels = meta.width * meta.height
                  const targetIsBiggerThanSrc = hasPixels < wantedPixels

                  const actualPixels = targetIsBiggerThanSrc ? hasPixels : wantedPixels

                  const resDoneIndex = formatDoneIndex(actualPixels)
                  const isDoneProm = resDoneIndex(file.formattedFileName)
                  if (isDoneProm) {
                    // dont block execution. The copying of the file can happen in parallel without worrying about cpu usage
                    isDoneProm.then(async (isDone) => {
                      // copy
                      if (options.debug) console.log(processID, "copy", pth.basename(outFilename))
                      if (options.dryRun) {
                        console.log(`Would copy ${isDone.path} to ${outFilename}`)
                        return onlyFileName
                      }
                      await fs.copyFile(isDone.path, outFilename)
                    })
                    
                    return onlyFileName
                  }


                  const resAbleProm = new ResablePromise<{path: string}>()
                  resDoneIndex(file.formattedFileName, resAbleProm)



                  const factorize = targetIsBiggerThanSrc ? (x: number) => x : constrFactorize(Math.sqrt(wantedPixels / hasPixels))

                  img.resize({
                    width: factorize(meta.width),
                    height: factorize(meta.height)
                  })


                  
        
                  if (options.dryRun) {
                    console.log(`Would render ${outFilename}`)
                    resAbleProm.res({path: outFilename})
                    return onlyFileName
                  }
                  await img.toFile(outFilename) as any as Promise<void>
                  resAbleProm.res({path: outFilename})
                  return onlyFileName
                }
                finally {
                  if (options.debug) console.log(processID, "<    ", pth.basename(outFilename))
                  done()
                } 
              }
            }
          }
        }
        
      }
      
  
  
      const queryAlreadyExsistingFiles = (name: string, fromInputDir: string) => {
        let fileName = formatFileName(name, fromInputDir)

        if (!options.force) {
          for (let res of reses) {
            for (let format of formats) {
              
              const outFilename = pth.resolve(pth.join(outputDir, toOutFilname(fileName, format, res.displayName)))
              if (fss.existsSync(outFilename)) {
                alreadyDone.add(pth.resolve(outFilename))
                if (fss.lstatSync(outFilename).isDirectory()) throw new Error(`Output filename: "${outFilename}" is a directory already. Terminating here before any changes are made.`)
              }
            }
          }
        }
      }

      let excludeF: undefined | ((path: string, pathWithoutExtension: string, fromInputDir: string) => boolean)
      if (options.exclude !== undefined) {
        if (typeof options.exclude === "string" || options.exclude instanceof Array) {
          const exclArr = options.exclude instanceof Array ? options.exclude : [options.exclude]
          const globs = exclArr.map((excl) => glob(excl))
          excludeF = (path: string, pathWithoutExtension: string, fromInputDir: string) => {
            return globs.some((glob) => glob(pth.relative(fromInputDir, path)))
          }
        }
        else if (options.exclude instanceof RegExp) {
          const excl = options.exclude
          if (excl.flags.includes("g")) throw new Error("The exclude regex should not have the global flag, as regex in js are stateful and this would lead to unexpected results, depending on previous matches.")
          excludeF = (path: string, pathWithoutExtension: string, fromInputDir: string) => excl.test(pth.relative(fromInputDir, path))
        }
        else excludeF = options.exclude
      }
      
      let alreadyDone = []
      if (!options.silent) console.log("Searching files...")
      const find = constructGetImg(!options.force ? (path, name, fromInputDir) => {
        if (excludeF !== undefined && excludeF(path, name, fromInputDir)) return true
        queryAlreadyExsistingFiles(name, fromInputDir)
      } : (path, name, fromInputDir) => {
        if (excludeF !== undefined && excludeF(path, name, fromInputDir)) return true
      })
      
      find(input, "").done(async (_files: {path: string, fileName: string, fromInputDir: string}[]) => {

        if (!options.silent) console.log(`Found ${_files.length} files. Rendering...`)

        let files = _files.map((file) => {
          return {...file, formattedFileName: formatFileName(file.fileName, file.fromInputDir)}
        })
        const totalNumberOfFilesPending = files.length * reses.length * formats.length
        if (totalNumberOfFilesPending === 1 && input.length === 1) {
          const fromInputDir = files[0].fromInputDir
          const formattedFileName = files[0].formattedFileName
          let hasSpesificOutputWish: any
          (() => {
            input = input[0]
            if (fss.existsSync(input) && fss.lstatSync(input).isDirectory()) return  
            if (fss.existsSync(outputDir)) {
              if (!fss.lstatSync(outputDir).isDirectory()) {
                if (!options.force) throw new Error(`Output ${outputDir} points to a existing file. Use -f to force override. Terminating here, before any changes.`)
              }
              else return
            }
            let outputCodec: any
            let inputCodec: any

            for (const codec of commonAlgorithem) {
              if (outputDir.endsWith("." + codec)) outputCodec = codec
              if (input.endsWith("." + codec)) inputCodec = codec
            }
            if (inputCodec && outputCodec) {
              if (outputCodec !== formats[0]) throw new Error(`Given extension "${outputCodec}" of output filename does not match the given format (algorithm) "${formats[0]}". Terminating here, before any changes.`)
              hasSpesificOutputWish = true
            }
          })()
      
          if (hasSpesificOutputWish) {
            const output = outputDir
            outputDir = pth.join(outputDir, "..")
            files = [{path: input, formattedFileName, fromInputDir, fileName: removeExtension(output) /* will be basenamed later, first line at scheduleRenders */}]
            alreadyDone = []
            if (fss.existsSync(output)) {
              if (fss.lstatSync(output).isDirectory()) throw new Error("Output points to a existing directory. Terminating here, before any changes.")
              else if (!options.force) throw new Error("Output points to a existing file. Use -f to force override. Terminating here, before any changes.")
              else {
                if (pth.resolve(output) === pth.resolve(input)) {
                  const newInputPath = `${outputDir}/temp.${createHash(output, 8)}.${pth.basename(output)}`
                  
                  files = [{path: newInputPath, formattedFileName, fromInputDir, fileName: removeExtension(output) /* will be basenamed later, first line at scheduleRenders */}]
                  await fs.rename(output, newInputPath)
                  beforeProgramDoneCbs.push(async () => {
                    await fs.unlink(newInputPath)
                  })
                }
              }
            }
            
          }
          
        }
        else if (fss.existsSync(outputDir) && !fss.lstatSync(outputDir).isDirectory()) throw new Error(`Output ${outputDir} points to an existing file. Expected a directory here. Terminating here, before any changes.`)

        for (const { formattedFileName } of files) {
          fs.mkdir(pth.dirname(pth.join(outputDir, formattedFileName)), { recursive: true });  
        }
        

       




        const todoCount = totalNumberOfFilesPending - alreadyDone.length
        if (!options.silent) console.log("Rendering on " + options.threads + " threads.")

        
        let startedOrderFilenames = []
        // let exitTryCount = 0
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
          console.log(`Rendering to "${outputDir}"...`)
          if (!options.legacyLogs) progress.start(todoCount, 0)
          else {
            console.log(`Rendering ${todoCount} files to "${outputDir}"...`)
            console.log(`Done count: 0/${todoCount} (0ms since last; 0ms total)`)
          }
        }

  

        const renderTasksGenerator = getRenderTask(files)

        let done = 1
        const startThread = (async (id: number) => {
          let timeSinceLast = timoi()
          for (const task of renderTasksGenerator) {
            const fileName = await task(id)
            if (!options.silent) {
              if (!options.legacyLogs) progress.update(done++)
              else {
                console.log(`Done count: ${done++}/${todoCount} (${timeSinceLast.str()} since last (on this thread); ${time.str()} total) - "${fileName}"`)
                timeSinceLast = timoi()
              }
            } 
            if (!options.onProgress) options.onProgress(done - 1, todoCount) 
          }
        })

        const threadsList = []
        if (!manuallySetUV_THREADPOOL_SIZE) sharp.concurrency(1)
        const maxThreads = Math.min(options.threads, todoCount)
        for (let i = 0; i < maxThreads; i++) {
          threadsList.add(startThread(i))
        }

        await Promise.all(threadsList)

        await Promise.all(beforeProgramDoneCbs.map(cb => cb()))

        if (!options.silent) {
          progress.stop()
          console.log(`Done. Took ${time.str()}`)
        }
        res()
      })
    })
  }
}




export const imageweb = constrImageWeb(["avif", "webp", "jpg"], ["UHD", "FHD", "PREV"])

export default imageweb
