import type { AttributionItem } from "@navaramap/three";

/** 배경지도 정의. 소스는 앱 시작 시 모두 등록해 두고 레이어의 참조만 바꾼다. */

export type BasemapId = "satellite" | "sentinel2" | "street";

export type Basemap = {
  id: BasemapId;
  /** 버튼에 쓰는 짧은 이름 */
  label: string;
  /** 툴팁에 쓰는 설명 */
  description: string;
  /** addSource에 부여할 고정 id. 레이어는 이 문자열로 소스를 참조한다. */
  sourceId: string;
  url: string;
  minZoom: number;
  maxZoom: number;
  attribution: AttributionItem;
};

export const BASEMAPS: Record<BasemapId, Basemap> = {
  satellite: {
    id: "satellite",
    label: "위성",
    description: "Esri World Imagery — 고해상도 항공/위성 영상",
    sourceId: "basemap-satellite",
    // 키가 필요 없고 CORS가 열려 있다.
    // URL 순서가 {z}/{y}/{x}로, 흔한 {z}/{x}/{y}와 뒤바뀌어 있다.
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    minZoom: 2,
    // 서울 기준 z19까지 실제 영상이 오고, z20은 빈 타일이 온다.
    maxZoom: 19,
    attribution: {
      attribution:
        "Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      attributionUrl:
        "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
    },
  },
  sentinel2: {
    id: "sentinel2",
    label: "S2",
    description: "Sentinel-2 cloudless 2024 — 구름 없는 합성 영상",
    sourceId: "basemap-sentinel2",
    // EOX WMTS. 키 없이 쓸 수 있고 CORS가 열려 있다.
    url:
      "https://tiles.maps.eox.at/wmts?layer=s2cloudless-2024_3857&style=default" +
      "&tilematrixset=g&Service=WMTS&Request=GetTile" +
      "&Version=1.0.0&Format=image%2Fjpeg" +
      "&TileMatrix={z}&TileCol={x}&TileRow={y}",
    minZoom: 2,
    // Sentinel-2의 지상 해상도가 10m라 z15를 넘으면 확대만 될 뿐 정보가 없다.
    maxZoom: 15,
    attribution: {
      attributionHtml:
        '<a href="https://s2maps.eu">Sentinel-2 cloudless 2024</a> by ' +
        '<a href="https://eox.at">EOX IT Services GmbH</a> ' +
        "(contains modified Copernicus Sentinel data 2024)",
    },
  },
  street: {
    id: "street",
    label: "일반",
    description: "OpenStreetMap — 도로·지명이 있는 일반 지도",
    sourceId: "basemap-street",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 2,
    maxZoom: 19,
    attribution: {
      attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    },
  },
};

export const BASEMAP_LIST: Basemap[] = [
  BASEMAPS.satellite,
  BASEMAPS.sentinel2,
  BASEMAPS.street,
];
