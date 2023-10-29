import { merge } from "webpack-merge"
import commonMod from "./rollup.node.common.config.mjs"


export default merge(commonMod, {
  input: 'app/src/imageWeb.ts',
  output: {
    file: 'app/dist/cjs/imageWeb.js',
    format: 'cjs'
  },
})