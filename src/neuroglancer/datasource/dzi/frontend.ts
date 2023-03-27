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

import { ChunkManager, WithParameters } from 'neuroglancer/chunk_manager/frontend';
import { DataSource } from 'neuroglancer/datasource';
import { VolumeChunkSourceParameters } from 'neuroglancer/datasource/dzi/base';
import { DataType, VolumeChunkSpecification, VolumeSourceOptions, VolumeType } from 'neuroglancer/sliceview/volume/base';
import { MultiscaleVolumeChunkSource as GenericMultiscaleVolumeChunkSource, VolumeChunkSource } from 'neuroglancer/sliceview/volume/frontend';
import { mat4, vec3 } from 'neuroglancer/util/geom';
import { fetchOk, parseSpecialUrl } from 'neuroglancer/util/http_request';
import { verifyInt, verifyObject, verifyPositiveInt, verifyString } from 'neuroglancer/util/json';

class LevelInfo {
  level: number;
  width: number;
  height: number;
  resolution: number;
  constructor(level: number, width: number, height: number, resolution: number) {
    this.level = level;
    this.width = width;
    this.height = height;
    this.resolution = resolution;
  }
}

class DZITileSource extends
  (WithParameters(VolumeChunkSource, VolumeChunkSourceParameters)) { }

class PyramidTileSource implements GenericMultiscaleVolumeChunkSource {
  dataType: DataType;
  numChannels: number;
  volumeType: VolumeType;

  width: number;
  height: number;
  tilesize: number;
  overlap: number;
  format: string;

  levels: LevelInfo[];

  getMeshSource() { return null; }

  constructor(public chunkManager: ChunkManager, public urlbase: string, obj: any) {
    verifyObject(obj);
    this.dataType = DataType.UINT8;
    this.numChannels = 3;
    this.volumeType = VolumeType.IMAGE;

    let w = this.width = verifyPositiveInt(obj.width);
    let h = this.height = verifyPositiveInt(obj.height);
    this.tilesize = verifyPositiveInt(obj.tilesize);
    this.overlap = verifyInt(obj.overlap);
    this.format = verifyString(obj.format);

    let max = Math.max(w, h);
    let maxlevel = 0;
    while (max > 1) {
      maxlevel++;
      max = (max + 1) >> 1;
    }

    this.levels = [];
    for (let i = 0; i <= maxlevel; i++) {
      this.levels.push(new LevelInfo(maxlevel - i, w, h, 1 << this.levels.length));
      w = (w + 1) >> 1;
      h = (h + 1) >> 1;
    }
  }

  getSources(volumeSourceOptions: VolumeSourceOptions) {
    return this.levels.map(levelInfo => {
      return VolumeChunkSpecification
        .getDefaults({
          voxelSize: vec3.fromValues(levelInfo.resolution, levelInfo.resolution, levelInfo.resolution),
          dataType: this.dataType,
          numChannels: this.numChannels,
          transform: mat4.fromTranslation(
            mat4.create(),
            vec3.multiply(vec3.create(), vec3.fromValues(levelInfo.resolution, levelInfo.resolution, levelInfo.resolution), vec3.create())),
          upperVoxelBound: vec3.fromValues(levelInfo.width, levelInfo.height, 1),
          volumeType: this.volumeType,
          chunkDataSizes: [vec3.fromValues(this.tilesize, this.tilesize, 1)],
          volumeSourceOptions,
        })
        .map(spec => this.chunkManager.getChunkSource(DZITileSource, {
          spec,
          parameters: {
            urlbase: this.urlbase + "/" + levelInfo.level + "/",
            tilesize: this.tilesize,
            overlap: this.overlap,
            format: this.format
          }
        }));
    });
  }
}

function getVolume(chunkManager: ChunkManager, url: string) {
  url = parseSpecialUrl(url);
  if (url.endsWith(".json"))
    throw new Error("DZI-JSON: Todo.");
  return chunkManager.memoize.getUncounted(
    { 'type': 'dzi:PyramidTileSource', url },
    () => fetchOk(`${url}`)
      .then(response => response.text())
      .then(text => {
        const xml = new DOMParser().parseFromString(text, "text/xml");
        const image = xml.documentElement;
        const size = verifyObject(image.getElementsByTagName("Size").item(0));
        const descriptor = {
          width: parseInt(size.getAttribute("Width")),
          height: parseInt(size.getAttribute("Height")),
          tilesize: parseInt(verifyString(image.getAttribute("TileSize"))),
          overlap: parseInt(verifyString(image.getAttribute("Overlap"))),
          format: image.getAttribute("Format")
        };
        return new PyramidTileSource(chunkManager, url.substring(0, url.lastIndexOf(".")) + "_files", descriptor);
      }));
}

export class DZIDataSource extends DataSource {
  get description() {
    return 'DeepZoom Image, file-backed 2D data source';
  }
  getVolume(chunkManager: ChunkManager, url: string) {
    return getVolume(chunkManager, url);
  }
}
