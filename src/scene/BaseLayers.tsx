import {
  TERRARIUM_ELEVATION_DECODER,
  type LayerDescription,
} from "@navaramap/three";
import { Layer, useViewContext } from "@navaramap/three-react";
import { useEffect, useMemo } from "react";

import { INITIAL_CAMERA, TERRAIN_SOURCE_ID } from "../constants";
import { BASEMAP_LIST, BASEMAPS, type BasemapId } from "./basemaps";

const TERRAIN_ATTRIBUTION = {
  attribution: "Terrain: AWS Terrain Tiles / Mapzen",
  attributionUrl: "https://registry.opendata.aws/terrain-tiles/",
};

type Props = {
  basemap: BasemapId;
};

/**
 * 서울 기준 베이스맵 + 지형.
 *
 * 배경지도 소스는 전부 미리 등록하고 레이어가 참조하는 **소스 id만 바꾼다**.
 * 소스는 등록만으로 타일을 받지 않고 레이어가 참조할 때 받으므로, 전환할 때마다
 * addSource를 다시 호출해 쓰지 않는 소스를 쌓을 이유가 없다.
 *
 * 지형은 Terrarium 인코딩의 AWS Terrain Tiles를 사용한다. 일본 GSI DEM
 * (`JAPAN_GSI_ELEVATION_DECODER`)은 한국을 덮지 않으므로 쓸 수 없다.
 * castShadow/receiveShadow는 일출 분석의 지형 그림자 판정에 필요하다.
 */
export function BaseLayers({ basemap }: Props) {
  const { view } = useViewContext();

  useEffect(() => {
    view.setCamera(INITIAL_CAMERA);
    view.attribution?.add([TERRAIN_ATTRIBUTION]);
  }, [view]);

  // 선택된 배경지도의 출처만 표시한다. 전환 시 cleanup이 이전 것을 걷어낸다.
  useEffect(() => {
    const item = BASEMAPS[basemap].attribution;
    view.attribution?.add([item]);
    return () => view.attribution?.remove([item]);
  }, [view, basemap]);

  // 배경지도 소스는 한 번에 모두 등록한다.
  useMemo(
    () =>
      BASEMAP_LIST.map((map) =>
        view.addSource({
          id: map.sourceId,
          type: "raster-tile",
          url: map.url,
          minZoom: map.minZoom,
          maxZoom: map.maxZoom,
        }),
      ),
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

  const basemapLayer = useMemo<LayerDescription>(
    () => ({ type: "raster", source: BASEMAPS[basemap].sourceId }),
    [basemap],
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
      <Layer config={basemapLayer} />
      <Layer config={terrain} />
    </>
  );
}
