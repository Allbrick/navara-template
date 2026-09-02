/** 배경지도 정의. 소스는 앱 시작 시 모두 등록해 두고 레이어의 참조만 바꾼다. */

export type BasemapId = "satellite" | "street";

export type Basemap = {
  id: BasemapId;
  name: string;
  /** addSource에 부여할 고정 id. 레이어는 이 문자열로 소스를 참조한다. */
  sourceId: string;
  url: string;
  minZoom: number;
  maxZoom: number;
  attribution: { attribution: string; attributionUrl: string };
};

export const BASEMAPS: Record<BasemapId, Basemap> = {
  satellite: {
    id: "satellite",
    name: "위성",
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
  street: {
    id: "street",
    name: "일반",
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

export const BASEMAP_LIST: Basemap[] = [BASEMAPS.satellite, BASEMAPS.street];
