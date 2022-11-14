import * as path from "path"
import * as fs from "fs"
import slash from "slash"

export default function findNextDirname(pth: string) {
  while (!fs.existsSync(pth) || !fs.lstatSync(pth).isDirectory()) {
    pth = path.join(pth, "..")
  }
  return path.basename(pth)
}


// find the next dirname that is a common folder of all the input filenames
export function findNextCommonDirname(pth: string[]) {
  pth = pth.map(pth => path.resolve(slash(pth)))
  const paths = pth.map(p => p.split(path.sep))
  const common = paths.reduce((a, b) => a.filter((c, i) => c === b[i]))
  return findNextDirname(common.join(path.sep))
}

