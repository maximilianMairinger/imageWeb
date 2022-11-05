# Web image

Image optimization and compression for the web. Bulk resize and compress them for dynamic resource deployment. Intended for preload images, thumbnails, client dependent compression algorithms (avif for browsers that support it), end device dependent resolution (4K screen => 4K image)

## Installation

```shell
 $ npx image-web --help
```

## Usage

Take files from `src/res/img` compress them (as *avif, webp, jpg & png* in *4K, 3K, FHD, HD & PREV*) and pipes them to `dist/res/img` properly named (e.g. `image-name@4K.webp`).

### CLI

```shell
 $ image-web src/res/img dist/res/img
```

The options are analog the the ones available to the API. Please view `image-web --help` for a comprehensive list. Here an example with options:

```shell
 $ image-web src/res/img dist/res/img --algorithm avif,webp --resolution 4K,2K,PREV
 $ image-web src/res/img dist/res/img -a avif,webp -r 2160p,1080p,15p
```

Another example: Sanitize/recodec a single image (4K resolution, codec infered by output file type):

```shell
 $ image-web src/res/img/image-name.png dist/res/img/image-name.webp
```

### API

```ts
import imageWeb from "web-image"

imageWeb("src/res/img", "dist/res/img")
```

#### Options

By default, the compression algorithms generally produce images at different visual fidelity (avif looks, despite being much better, worse than jpg at the same resolution). Web image tries to mitigate this issue by scaling up the resolution dynamically, depending on the algorithm used. You may disable this behavior like this

```ts
import imageWeb from "web-image"

imageWeb("src/res/img", "dist/res/img", { silent: false, dynamicResolution: false })
```

The default export is a basic configured instance. For custom configurations: 

```ts
import { constrImageWeb } from "web-image"

const imageWeb = constrImageWeb(["avif", "webp", "jpg"], [
  "FHD",  // Common resolution (explained below)
  508960, // Total pixels (width * height)
  { pixels: 508960, name: "littleMoreThanSD" }, // name is used as suffix replacing the resolution (filename e.g. img@littleMoreThanSD.avif)
  { width: 2000 } // interpolates width or height in 16:9 ratio to pixels
])

imageWeb("src/res/img", "dist/res/img")
```

Options can be given here too. Those will be applied to all instance calls, when not overwritten.

```ts
import { constrImageWeb } from "web-image"

const imageWeb = constrImageWeb(["avif", "jpg"], [
  "FHD"
], { silent: false, dynamicResolution: true })
```

##### Supported algorithms

avif, webp, jpg, tiff & png are supported by the underling library [sharp](https://www.npmjs.com/package/sharp).

##### Common resolutions

Translation table for common resolutions to total pixels (width * height)

```ts
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
}
```

## Contribute

All feedback is appreciated. Create a pull request or write an issue.
