import type { LayerDescription } from "@navaramap/three";
import { Layer, useViewContext } from "@navaramap/three-react";
import { useEffect, useMemo } from "react";

import { INITIAL_CAMERA, TERRAIN_SOURCE_ID } from "../constants";
import { BASEMAP_LIST, BASEMAPS, type BasemapId } from "./basemaps";

const TERRAIN_ATTRIBUTION = {
  attributionHtml:
    'Terrain: <a href="https://terrain.reearth.land/">Re:Earth Terrain</a> ' +
    '(<a href="https://mapterhorn.com/">Mapterhorn</a>, EGM2008 / NGA)',
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
 * 지형은 Re:Earth Terrain(quantized-mesh)을 쓴다. **워터마스크를 제공하는 것이
 * 핵심** — 수면을 반사 재질로 처리하려면 이 확장이 필요하고, raster-dem 계열
 * (Terrarium/AWS)에는 없다. 렌더와 분석이 같은 지형을 봐야 하므로 소스는 하나만
 * 두고 `sampleTerrainMostDetailed`도 이것을 샘플링한다.
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
        type: "quantized-mesh",
        url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
        minZoom: 0,
        // layer.json이 알리는 실제 최대 줌.
        maxZoom: 14,
        requestVertexNormals: true,
        // 이것이 있어야 수면이 반사 재질로 처리된다.
        requestWaterMask: true,
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
