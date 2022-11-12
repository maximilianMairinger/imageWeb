import imageWeb, {constrImageWeb} from "../../app/src/imageWeb"
import fss from "fs"


imageWeb("try", "test_out", {silent: false})


// if (fss.existsSync("try/temp.1e510502fd6f3f59.woo.png")) {
//   if (fss.existsSync("try/woo.png")) if (!fss.lstatSync("try/woo.png").isDirectory()) fss.unlinkSync("try/woo.png")
//   fss.renameSync("try/temp.1e510502fd6f3f59.woo.png", "try/woo.png")
// }


// constrImageWeb(["png"], [{name: "200p", displayName: ""}])("try/woo.png", "try/lel.png", {force: true, silent: false}).catch((e) => {throw e})


// const debug = false
// constrImageWeb(["avif"], ["UHD", "2UHD"])("try", "test_out", {force: true, silent: false, debug: debug, dryRun: false})


// constrImageWeb(["jpg"], ["4K"])("try/test3.jpg", "try/test3woo.jpg", {silent: false})
