/**
 * @license
 * Copyright 2023 Gergely Csucs
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { WithParameters } from 'neuroglancer/chunk_manager/backend';
import { VolumeChunkSourceParameters } from 'neuroglancer/datasource/dzi/base';
import { VolumeChunk, VolumeChunkSource } from 'neuroglancer/sliceview/volume/backend';
import { CancellationToken } from 'neuroglancer/util/cancellation';
import { cancellableFetchOk } from 'neuroglancer/util/http_request';
import { registerSharedObject } from 'neuroglancer/worker_rpc';

declare var OffscreenCanvas: any; // shutting up some outdated compiler(?)

@registerSharedObject() export class DZITileSource extends
  (WithParameters(VolumeChunkSource, VolumeChunkSourceParameters)) {
  gridShape = (() => {
    const gridShape = new Uint32Array(3);
    const { upperVoxelBound, chunkDataSize } = this.spec;
    for (let i = 0; i < 3; ++i) {
      gridShape[i] = Math.ceil(upperVoxelBound[i] / chunkDataSize[i]);
    }
    return gridShape;
  })();

  async download(chunk: VolumeChunk, cancellationToken: CancellationToken): Promise<void> {
    const { parameters } = this;
    const { urlbase, format, tilesize, overlap } = parameters;

    const [x, y] = chunk.chunkGridPosition;
    const url: string = `${urlbase}${x}_${y}.${format}`;
    const response: Blob = await cancellableFetchOk(url, {}, response => response.blob(), cancellationToken);
    const tile = await createImageBitmap(response);
    const canvas = new OffscreenCanvas(tilesize, tilesize);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(tile, x === 0 ? 0 : -overlap, y === 0 ? 0 : -overlap);
    const id = ctx.getImageData(0, 0, tilesize, tilesize).data;
    const t2 = tilesize * tilesize;
    const d = chunk.data = new Uint8Array(t2 * 3);
    for (let i = 0; i < t2; i++) {
      d[i] = id[i * 4];
      d[i + t2] = id[i * 4 + 1];
      d[i + 2 * t2] = id[i * 4 + 2];
    }
  }
}
