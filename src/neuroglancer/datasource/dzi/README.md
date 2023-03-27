# DeepZoom Image support

This directory implements a standard data source based on a representation of high resolution 2D images as static collections of files served directly over HTTP; it therefore can be used without any special serving infrastructure. In particular, it can be used with data hosted by a cloud storage provider like Google Cloud Storage or Amazon S3. Note that it is necessary, however, to either host the Neuroglancer client from the same server or enable CORS access to the data.

Each image is represented as a directory tree (served over HTTP) with the following contents:
- Descriptor file in `XML` format, `imagename.dzi` or `imagename.xml`. `JSON` variant is not implemented yet
- One subdirectory with matching name and ending with `_files` (and no extension), like `imagename_files`.
- Inside `imagename_files` numbered directories representing a pyramid level
  Each subdirectory contains a chunked representation of the data for a single resolution. Levels are numbered from `0` (smallest, 1x1 pixel level), the largest level storing image data for its full resolution

Within neuroglancer, a DZI data source is specified using a URL of the form:
`dzi://https://host/path/to/image/descriptor.dzi`. If the data is being served from Google Cloud
Storage (GCS), `dzi://gs://bucket/path/to/image/descriptor.dzi` may be used as an alias for
`dzi://https://storage.googleapis.com/bucket/path/to/image/descriptor.dzi`. Or the same with `.xml`.

# descriptor XML specification

The root element must be `<Image>` with the attributes and content:
- `tilesize`: An integer value specifying the edge-length of the tiles. All zoom levels are chunked into equally sized squares.
- `overlap`: Historically DeepZoom tiles are allowed to have overlap, described by a single integer number. DZI implementation in neuroglancer does not make use of the overlap, it's simply clipped from the tiles.
- `format`: A string value specifying actual extension of tiles (like `png` or `jpg`). Any image format supported by the browser is suitable, but `png` and `jpg` are the widely used ones, depending on preference for lossless or lossy compression.
  `<Size>`: required child element, specifying the resolution of the image.
The `<Size>` element must contain the following attributes:
- `width`: An integer value specifying the width of the image (at full resolution), expressed in pixels.
- `height`: An integer value specifying the height of the image (at full resolution), expressed in pixels.

To be continued...
