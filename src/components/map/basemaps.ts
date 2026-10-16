import type { StyleSpecification } from 'maplibre-gl';

// 地図と画像の画面（/georef）で選べる背景地図。geo.ldas.jp の 4 つに合わせた
// （geo の OpenStreetMap の画像タイルは、同じ OSM のデータを描く OpenFreeMap の「標準」で置き換える）。

export type BasemapId = 'standard' | 'gsiPale' | 'gsiPhoto' | 'rekichizu';

export interface Basemap {
  id: BasemapId;
  /** messages の GeoRef の中の名前。 */
  labelKey: string;
  /** 地図のスタイル（URL か中身）。標準だけ、暗い表示のときは暗い色の地図にする。 */
  style: (dark: boolean) => string | StyleSpecification;
  /** 地図に文字を足すときの字体。スタイルの glyphs が配っているものに限る。 */
  labelFont: string[];
  /** 地名の言語を画面の言語に切り替えるか（OpenMapTiles の name:ja などを持つ地図だけ）。 */
  localizeLabels: boolean;
  /** 出典が長いので、開いたときに畳んでおくか。 */
  collapseAttribution?: boolean;
}

// 画像タイルの地図には字が無いので、字体は OpenFreeMap から借りる
const OPENFREEMAP_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';

const rasterStyle = (tiles: string, minzoom: number): StyleSpecification => ({
  version: 8,
  glyphs: OPENFREEMAP_GLYPHS,
  sources: {
    basemap: { type: 'raster', tiles: [tiles], tileSize: 256, minzoom, maxzoom: 18, attribution: GSI_ATTRIBUTION },
  },
  layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
});

export const BASEMAPS: Basemap[] = [
  {
    id: 'standard',
    labelKey: 'basemapStandard',
    style: (dark) => `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'liberty'}`,
    labelFont: ['Noto Sans Regular'],
    localizeLabels: true,
  },
  {
    id: 'gsiPale',
    labelKey: 'basemapGsiPale',
    style: () => rasterStyle('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', 5),
    labelFont: ['Noto Sans Regular'],
    localizeLabels: false,
  },
  {
    id: 'gsiPhoto',
    labelKey: 'basemapGsiPhoto',
    style: () => rasterStyle('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', 2),
    labelFont: ['Noto Sans Regular'],
    localizeLabels: false,
  },
  {
    // 昔の地図の描き方で描いた現在の地図（MIERUNE）。字体は LINE Seed JP しか配っていない
    id: 'rekichizu',
    labelKey: 'basemapRekichizu',
    style: () => 'https://mierune.github.io/rekichizu-style/styles/street/style.json',
    labelFont: ['LINESeedJP_OTF_Rg'],
    localizeLabels: false,
    collapseAttribution: true,
  },
];

export const basemapOf = (id: BasemapId): Basemap => BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
