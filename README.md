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

The same options as available to the API can be used. For a full list view `image-web --help`

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
const imageResolutions = {
  "4K": 8294400,   // 2160p
  "3K": 3686400,   // 1440p
  "FHD": 2073600,  // 1080p
  "HD": 921600,    // 720p
  "SD": 408960,    // 480p
  "TINY": 36864,   // 144p
  "PREV": 400      // 15p
}
```

## Contribute

All feedback is appreciated. Create a pull request or write an issue.
