import sharp from "sharp"
import isImage from "is-image"
import fss, { promises as fs } from "fs"
import pth from "path"
import slash from "slash"


function constructGetImg(foundCb: (url: string, pathWithoutExtension: string) => void) {
  return function getImg(dirs: string[], sub: string) {
    for (let dir of dirs) {
      (async () => {
        const subDir = pth.join(sub, dir)
        if ((await fs.lstat(subDir)).isDirectory())  {
          getImg(await fs.readdir(subDir), subDir)
        }
        else if (isImage(subDir)) foundCb(subDir, removeExtension(subDir))
      })()
    }
  }
}

function removeExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "")
}


type ImageFormats = "png" | "webp" | "jpg" | "avif" | "tiff"
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
    if (typeof res === "string") res = {pixels: imageResolutions[res], name: res}
    else if (typeof res === "number") res = {pixels: res, name: res.toString()}
    else {
      if ((res as any).width === undefined) (res as any).width = (res as any).height * heightToWidthFactor
      else if ((res as any).height === undefined) (res as any).height = (res as any).width / heightToWidthFactor
      const pixels = (res as any).height * (res as any).width
      res = {name: res.name !== undefined ? res.name : pixels.toString(), pixels}
    }

    return res
  })
}

export function constrWebImage(formats: ImageFormats[], resolutions: (ImageResolutions | Pixels | {pixels: Pixels, name?: string} | WidthHeight)[]) {
  const reses = normalizeResolution(resolutions)
  return async function (inputDir: string, outputDir: string) {
    if (!(fss.existsSync(outputDir) && (await fs.lstat(outputDir)).isDirectory())) await fs.mkdir(outputDir)
    inputDir = slash(inputDir)
    outputDir = slash(outputDir)

    let iii = inputDir
    if (iii.endsWith("/")) iii = iii.slice(0, -1)
    const slashCount = iii.split("/").length
    console.log("shalsh", slashCount)
    constructGetImg(async (path, fileName) => {
      fileName = slash(fileName)
      fileName = fileName.split("/").slice(slashCount).join("/")

      const img = sharp(path)
      const meta = await img.metadata()
      const hasPixels = meta.width * meta.height
      console.log("hasPixels", path, hasPixels)
      console.log("width", meta.width, "height", meta.height)
      for (let res of reses) {
        if (hasPixels > res.pixels) {
          const factor = Math.sqrt(hasPixels / res.pixels)
          console.log("resize", res.name, factor, {
            width: Math.round(meta.width / factor) || 1,
            height: Math.round(meta.height / factor) || 1
          })
          img.resize({
            width: Math.round(meta.width / factor) || 1,
            height: Math.round(meta.height / factor) || 1
          })
        }

        for (let format of formats) {
          img.toFile(pth.join(outputDir, `${fileName}@${res.name}.${format.toLowerCase()}`))
        }
      }
      
      
      
      
    })([inputDir], "")
  }
  
}


export const webImage = constrWebImage(["webp", "jpg", "png"], [
  "4K",
  100,
  {pixels: 200},
  {pixels: 200, name: "zweihundert"},
  {width: 200, name: "widthZweihundert"},
  {height: 200, name: "heightZweihundert"},
])

export default webImage
