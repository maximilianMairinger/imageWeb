import * as path from "path"
import * as fs from "fs"

export default function findNextDirname(pth: string) {
  while (!fs.lstatSync(pth).isDirectory()) {
    pth = path.join(pth, "..")
  }
  return path.basename(pth)
}