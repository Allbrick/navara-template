import {
  TERRARIUM_ELEVATION_DECODER,
  type LayerDescription,
} from "@navaramap/three";
import { Layer, useViewContext } from "@navaramap/three-react";
import { useEffect, useMemo } from "react";

import { INITIAL_CAMERA, TERRAIN_SOURCE_ID } from "../constants";

/**
 * 서울 기준 베이스맵 + 지형.
 *
 * 지형은 Terrarium 인코딩의 AWS Terrain Tiles를 사용한다. 일본 GSI DEM
 * (`JAPAN_GSI_ELEVATION_DECODER`)은 한국을 덮지 않으므로 쓸 수 없다.
 * castShadow/receiveShadow는 일출 분석의 지형 그림자 판정에 필요하다.
 */
export function BaseLayers() {
  const { view } = useViewContext();

  useEffect(() => {
    view.setCamera(INITIAL_CAMERA);

    view.attribution?.add([
      {
        attribution: "© OpenStreetMap contributors",
        attributionUrl: "https://www.openstreetmap.org/copyright",
      },
      {
        attribution: "Terrain: AWS Terrain Tiles / Mapzen",
        attributionUrl:
          "https://registry.opendata.aws/terrain-tiles/",
      },
    ]);
  }, [view]);

  const rasterSource = useMemo(
    () =>
      view.addSource({
        type: "raster-tile",
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        minZoom: 2,
        maxZoom: 19,
      }),
    [view],
  );

  const demSource = useMemo(
    () =>
      view.addSource({
        // 고정 id를 부여해 일출 차폐 분석이 문자열 SourceRef로 참조할 수 있게 한다.
        id: TERRAIN_SOURCE_ID,
        type: "raster-dem",
        url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
        elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
        minZoom: 2,
        maxZoom: 14,
      }),
    [view],
  );

  const basemap = useMemo<LayerDescription>(
    () => ({ type: "raster", source: rasterSource }),
    [rasterSource],
  );

  const terrain = useMemo<LayerDescription>(
    () => ({
      type: "terrain",
      source: demSource,
      terrain: { castShadow: true, receiveShadow: true },
    }),
    [demSource],
  );

  return (
    <>
      <Layer config={basemap} />
      <Layer config={terrain} />
    </>
  );
}
