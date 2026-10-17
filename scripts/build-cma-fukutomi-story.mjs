// クリーブランド美術館の『福富草紙』（1953.358）を、1 枚の画像の中を場面ごとに移るストーリー
// （describing 注釈を順に読む）のマニフェストにする。
//
//   node scripts/build-cma-fukutomi-story.mjs
//
// 画像と美術館の解説は CC0（https://clevelandart.org/art/1953.358）。原寸の TIF（76716 × 2577）を
// vips dzsave で IIIF Image API 2 の静的タイル（level0）にして、nakamura196/iiif_image_repo に置いた。
// 「はじめに」は美術館の解説の訳。場面の区切りと解説はこちらで書いた（美術館の解説は作品全体の 1 段落だけのため）。
// 筋はコトバンク（日本大百科全書ほか）・兵庫県立歴史博物館の解説と、絵の読み取りによる。人名は二巻本の系統
// （成功するのが高向秀武、真似るのが福富。クリーブランド本もこれ）に従う。解説は AI（Claude）で下書きした。
// 経緯は docs/notes/storytelling.md
import { writeFile } from 'node:fs/promises';

const OUT = 'public/manifests/cma-fukutomi-story.json';
const SELF = 'https://kasane.ldas.jp/manifests/cma-fukutomi-story.json';
const SERVICE = 'https://nakamura196.github.io/iiif_image_repo/cleveland/cma-1953.358';
const OBJECT_URL = 'https://clevelandart.org/art/1953.358';
const KOTOBANK_URL = 'https://kotobank.jp/word/%E7%A6%8F%E5%AF%8C%E8%8D%89%E7%B4%99-1585606';
const HYOGO_URL = 'https://www.hyogo-c.ed.jp/~rekihaku-bo/historystation/rekihaku-meet/seminar/fukutomi/emaki/kou.html';
const OHTANI_URL = 'https://osaka-ohtani.repo.nii.ac.jp/record/384/files/%E8%8B%AB%E5%90%8D.pdf';
const W = 76716;
const H = 2577;
const CANVAS = `${SELF}/canvas/1`;

// 絵巻は右から左へ読む。x は場面の左端と右端（原寸のピクセル）。高さは全部
const SCENES = [
  {
    x: [67800, 76716],
    ja: ['秀武の豊かな家', '米をつく下人、衣桁に掛かった色とりどりの着物、寝所でくつろぐ夫婦。放屁の芸ひとつで手に入れた、高向秀武の暮らしの豊かさを見せる。'],
    en: ["Hidetake's prosperous house", 'Servants pound rice, colourful robes hang on a rack, and a couple relaxes in the bedroom. Takamuku Hidetake has grown rich on a single art: musical farting.'],
  },
  {
    x: [62490, 66420],
    ja: ['福富と妻', '一方、隣に住む福富の家は貧しい。妻は、秀武に芸を習ってこいと夫をせき立てる。'],
    en: ['Fukutomi and his wife', 'His neighbour Fukutomi is poor. His wife urges him to go and learn the art from Hidetake.'],
  },
  {
    x: [59290, 62230],
    ja: ['弟子入り', '福富は秀武を訪ね、芸の秘訣を乞う。秀武は、芸の前に朝顔の種を飲めと教える。じつは下剤で、師匠であり商売敵でもある男の罠だった。'],
    en: ['Becoming a pupil', 'Fukutomi visits Hidetake and begs for his secret. Hidetake tells him to take morning glory seeds before performing. They are a laxative: the mentor is also a rival.'],
  },
  {
    x: [51700, 57030],
    ja: ['中将の屋敷で', '福富は褒美を当て込んで貴人の屋敷へ行き、庭で芸を始める。縁の上から、主人や女房たちが見ている。'],
    en: ["At the nobleman's mansion", 'Hoping for a reward, Fukutomi goes to a nobleman’s mansion and begins his act in the garden, watched by the master and the ladies of the house.'],
  },
  {
    x: [47970, 51700],
    ja: ['大失敗', '薬が効き、福富は芸の最中に粗相してしまう。侍たちが打ちすえ、烏帽子や髪をつかんで追い出す。'],
    en: ['Disaster', 'The seeds take effect and Fukutomi soils himself mid-performance. The attendants beat him and drag him out by his cap and hair.'],
  },
  {
    x: [41970, 47970],
    ja: ['血まみれの帰り道', '打たれて血に染まった福富が、杖をついて帰る。子どもたちがはやし立て、近所の人が窓からのぞく。'],
    en: ['The bloody walk home', 'Beaten and bleeding, Fukutomi limps home on a stick. Children jeer, and neighbours peer out of their windows.'],
  },
  {
    x: [36110, 41970],
    ja: ['赤い袖', '遠くに夫の赤い袖を見た妻は、褒美に紅の衣をもらったのだと思い込み、駆け出していく。うれしさのあまり、古い着物を焼いてしまう。'],
    en: ['Red sleeves', 'Seeing red sleeves in the distance, the wife thinks her husband has been given crimson robes as a reward. She runs out and, in her joy, burns their old clothes.'],
  },
  {
    x: [31110, 36110],
    ja: ['着る物もない', '赤いのは血だった。着物は焼けてしまい、福富は裸でうずくまるしかない。'],
    en: ['Nothing to wear', 'The red was blood. With the old clothes burnt, Fukutomi can only crouch there naked.'],
  },
  {
    x: [25850, 28780],
    ja: ['腰を踏む妻', '福富は寝込んでしまう。妻は子を背負ったまま、痛む夫の腰を踏んでやる。子が椀を運び、かまどでは粥が煮える。'],
    en: ['The wife treads on his back', 'Fukutomi falls ill. With a baby on her back, his wife treads on his aching back, while a child carries a bowl and gruel simmers on the stove.'],
  },
  {
    x: [19190, 24520],
    ja: ['妻の祈り', '妻は神に祈る。そばには烏が舞い降りている。その左では、福富がまだ腹をくだして苦しんでいる。'],
    en: ["The wife's prayer", 'The wife prays to the gods as a crow alights nearby. To the left, Fukutomi is still suffering from diarrhoea.'],
  },
  {
    x: [12790, 17260],
    ja: ['薬を請う妻', '妻は屋敷を訪ね、縁の下にひざまずいて、夫のための薬を請う。'],
    en: ['The wife begs for medicine', 'The wife goes to a mansion and kneels below the veranda to beg for medicine for her husband.'],
  },
  {
    x: [6670, 9590],
    ja: ['妻、秀武にかみつく', '外へ出た秀武を妻が待ち伏せ、かみつく。周りの人々は逃げまどう。'],
    en: ['The wife bites Hidetake', 'When Hidetake goes out, the wife ambushes him and bites him. Bystanders flee.'],
  },
];

const INTRO = {
  ja: [
    '福富草紙（クリーブランド美術館）',
    'この絵巻は、手っ取り早く富を得ようとした男が、音を奏でる放屁の芸を習おうとする奇妙な話の後半を描いている。大事な芸の前に、師匠であり商売敵でもある男が、下剤である朝顔の種を飲むよう勧める。男は芸の最中に粗相し、恥辱のうちに生涯を終える。',
    '大胆な筋立てと、生き生きと描かれた人物のすぐ脇に台詞を書き込む描き方は、初期のグラフィック・ノベルといえる。この絵巻は、この話の現存する本のうち 2 番目に古い。',
    '室町時代・15 世紀半ば。紙本著色、画面 35.3 × 1028.8 cm。右から左へ、場面を順にたどる。',
    '出典：この「はじめに」の 3 段落は、クリーブランド美術館の作品ページの解説（英語、CC0、2026 年 10 月 16 日に同館の Open Access API から取得）を、AI（Claude）で日本語に訳したもの。次からの 12 場面の区切りと解説は、同館の解説には無いため、コトバンク（日本大百科全書ほか）と兵庫県立歴史博物館の解説で筋を確かめ、絵を見て新たに書いた（AI で下書き）。',
  ],
  en: [
    'The Story of Fukutomi (Cleveland Museum of Art)',
    'This handscroll shows the second half of an odd tale in which a ne’er-do-well seeks the path to quick fortune and learns the art of musical flatulence. Prior to a major performance, a mentor (and competitor) advises him to consume morning glory seeds, a laxative. Thus, while performing he fouls himself and ends his days in humiliation.',
    'The audacious nature of this story and its presentation—well-animated figures with dialogue adjacent to the appropriate moments of action—create a primitive graphic novel. This scroll is treasured as the second oldest surviving version of this story.',
    'Japan, Muromachi period, mid-1400s. Handscroll; ink and color on paper, image 35.3 × 1028.8 cm. Follow the scenes from right to left.',
    'Source: the first two paragraphs are the Cleveland Museum of Art’s object description (CC0, retrieved from its Open Access API on 16 October 2026), slightly shortened. The museum gives no scene-by-scene text, so the twelve scene divisions and texts that follow are new, drafted with AI (Claude) after checking the plot against Kotobank (Nihon Daihyakka Zensho and others) and the Hyogo Prefectural Museum of History.',
  ],
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = ([title, ...paras]) => `<h2>${esc(title)}</h2>${paras.map((p) => `<p>${esc(p)}</p>`).join('')}`;
const bodies = (ja, en) => [
  { type: 'TextualBody', value: html(ja), format: 'text/html', language: 'ja' },
  { type: 'TextualBody', value: html(en), format: 'text/html', language: 'en' },
];

const annos = [
  { id: `${SELF}/annotation/0`, type: 'Annotation', motivation: 'describing', body: bodies(INTRO.ja, INTRO.en), target: CANVAS },
  ...SCENES.map((s, i) => ({
    id: `${SELF}/annotation/${i + 1}`,
    type: 'Annotation',
    motivation: 'describing',
    body: bodies(s.ja, s.en),
    target: `${CANVAS}#xywh=${s.x[0]},0,${s.x[1] - s.x[0]},${H}`,
  })),
];

const manifest = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: SELF,
  type: 'Manifest',
  label: { ja: ['福富草紙（クリーブランド美術館）'], en: ['The Story of Fukutomi (Cleveland Museum of Art)'] },
  summary: {
    ja: ['放屁の芸をめぐる室町時代の滑稽な絵巻の後半を、1 枚の画像の中で場面ごとにたどるストーリー。'],
    en: ['A story that moves scene by scene through one image of a comic Muromachi-period handscroll about the art of farting.'],
  },
  metadata: [
    { label: { ja: ['所蔵'], en: ['Collection'] }, value: { ja: ['クリーブランド美術館（1953.358）'], en: ['The Cleveland Museum of Art (1953.358)'] } },
    { label: { ja: ['時代'], en: ['Date'] }, value: { ja: ['室町時代・15 世紀半ば'], en: ['Muromachi period, mid-1400s'] } },
    { label: { ja: ['法量'], en: ['Measurements'] }, value: { ja: ['画面 35.3 × 1028.8 cm'], en: ['Image: 35.3 × 1028.8 cm'] } },
  ],
  requiredStatement: {
    label: { ja: ['出典'], en: ['Source'] },
    value: {
      ja: [`画像・解説：クリーブランド美術館（CC0、${OBJECT_URL}）。「はじめに」は解説を AI（Claude）で訳したもの。場面の区切りと解説は中村 覚（東京大学）が AI（Claude）を用いて新たに作成。筋はコトバンク「福富草紙」（${KOTOBANK_URL}）と兵庫県立歴史博物館「福富草紙」（${HYOGO_URL}）のあらすじ（一巻本）、人名の割り振りは大阪大谷大学の論文（${OHTANI_URL}）による伝本の分け方を参考にした。場面の並び（腰を踏む妻・祈祷する妻・排便する翁・薬を請う妻）はコトバンク・兵庫県立歴史博物館の解説による`],
      en: [`Image and description: The Cleveland Museum of Art (CC0, ${OBJECT_URL}). Scene divisions and scene texts are new, by Satoru Nakamura (The University of Tokyo) with AI (Claude), with reference to Kotobank (${KOTOBANK_URL}) and the plot summary (one-scroll version) by the Hyogo Prefectural Museum of History (${HYOGO_URL}) and, for the names, the classification of versions in a paper from Osaka Ohtani University (${OHTANI_URL}). The order of scenes 9–11 follows Kotobank and the Hyogo museum’s commentary`],
    },
  },
  rights: 'http://creativecommons.org/publicdomain/zero/1.0/',
  homepage: [{ id: OBJECT_URL, type: 'Text', format: 'text/html', label: { ja: ['クリーブランド美術館の作品ページ'], en: ['The Cleveland Museum of Art object page'] } }],
  seeAlso: [
    { id: KOTOBANK_URL, type: 'Text', format: 'text/html', label: { ja: ['参考：コトバンク「福富草紙」'], en: ['Reference: Kotobank, “Fukutomi zōshi”'] } },
    { id: HYOGO_URL, type: 'Text', format: 'text/html', label: { ja: ['参考：兵庫県立歴史博物館「福富草紙」'], en: ['Reference: Hyogo Prefectural Museum of History, “Fukutomi zōshi”'] } },
    { id: OHTANI_URL, type: 'Text', format: 'application/pdf', label: { ja: ['参考：大阪大谷大学の論文（伝本の系統）'], en: ['Reference: Osaka Ohtani University paper (lineages of the versions)'] } },
  ],
  provider: [{ id: 'https://www.clevelandart.org/', type: 'Agent', label: { ja: ['クリーブランド美術館'], en: ['The Cleveland Museum of Art'] } }],
  items: [
    {
      id: CANVAS,
      type: 'Canvas',
      label: { ja: ['福富草紙'], en: ['The Story of Fukutomi'] },
      width: W,
      height: H,
      items: [
        {
          id: `${SELF}/page/1`,
          type: 'AnnotationPage',
          items: [
            {
              id: `${SELF}/painting/1`,
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: `${SERVICE}/full/2400,/0/default.jpg`,
                type: 'Image',
                format: 'image/jpeg',
                width: W,
                height: H,
                service: [{ id: SERVICE, type: 'ImageService2', profile: 'http://iiif.io/api/image/2/level0.json' }],
              },
              target: CANVAS,
            },
          ],
        },
      ],
      annotations: [{ id: `${SELF}/annotations/1`, type: 'AnnotationPage', items: annos }],
    },
  ],
};

await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${OUT}: ${annos.length} steps`);
