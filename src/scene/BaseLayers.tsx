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
        attribution:
          "Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        attributionUrl:
          "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
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
        // Esri World Imagery. 키가 필요 없고 CORS가 열려 있다.
        // URL 순서가 {z}/{y}/{x}로, 흔한 {z}/{x}/{y}와 뒤바뀌어 있다.
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        minZoom: 2,
        // 서울 기준 z19까지 실제 영상이 오고, z20은 빈 타일이 온다.
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
