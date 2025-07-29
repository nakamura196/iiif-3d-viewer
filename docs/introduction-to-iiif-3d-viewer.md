# IIIF 3D Viewer: デジタルヒューマニティーズにおける3D資料の新たな活用法

## はじめに

デジタルヒューマニティーズの分野において、文化財や歴史的資料の3Dデジタル化が急速に進んでいます。しかし、3Dモデルを単に閲覧するだけでなく、学術的な分析や教育に活用するためには、適切なツールが必要です。本記事では、IIIF（International Image Interoperability Framework）規格に準拠した3Dモデルビューア「IIIF 3D Viewer」について紹介します。

## IIIF 3D Viewerとは

IIIF 3D Viewerは、IIIF Manifestフォーマットに基づいて3Dモデルを表示し、アノテーション機能を提供するウェブアプリケーションです。東京大学の研究者によって開発され、オープンソースソフトウェアとして公開されています。

### 主な特徴

1. **標準規格への準拠**
   - IIIF Presentation API 3.0に準拠
   - 既存のIIIFエコシステムとの親和性

2. **インタラクティブな3D表示**
   - GLB/GLTFフォーマットのサポート
   - マウスやタッチ操作による直感的な操作
   - WebGLを活用した高速レンダリング

3. **アノテーション機能**
   - 3Dモデル上の任意の点にアノテーションを追加
   - 3DSelectorタイプによる空間座標の記録
   - 学術的な注釈や解説の付与が可能

4. **多言語対応**
   - 日本語・英語のインターフェース
   - 国際的な研究プロジェクトでの利用を想定

5. **静的サイト生成**
   - Next.jsの静的エクスポート機能を活用
   - GitHub PagesやNetlifyなどで簡単にホスティング可能

## 技術的な実装

### アーキテクチャ

本アプリケーションは、以下の技術スタックで構築されています：

- **フロントエンドフレームワーク**: Next.js 15（App Router）
- **3Dレンダリング**: React Three Fiber + Three.js
- **国際化**: next-intl
- **スタイリング**: Tailwind CSS
- **型安全性**: TypeScript

### IIIF Manifestの構造

3Dモデルを含むIIIF Manifestの例：

```json
{
  "@context": "http://iiif.io/api/presentation/3/context.json",
  "id": "https://example.com/manifest.json",
  "type": "Manifest",
  "label": { "ja": ["石淵家地球儀"] },
  "items": [
    {
      "id": "https://example.com/canvas/1",
      "type": "Canvas",
      "items": [
        {
          "id": "https://example.com/annotationpage/1",
          "type": "AnnotationPage",
          "items": [
            {
              "id": "https://example.com/annotation/1",
              "type": "Annotation",
              "motivation": "painting",
              "body": {
                "id": "https://example.com/model.glb",
                "type": "Model",
                "format": "model/gltf-binary"
              },
              "target": "https://example.com/canvas/1"
            }
          ]
        }
      ]
    }
  ]
}
```

### アノテーションの実装

3D空間におけるアノテーションは、以下のような構造で表現されます：

```json
{
  "type": "Annotation",
  "body": {
    "value": "この部分は18世紀の日本の地理認識を示しています",
    "label": "日本列島の描写"
  },
  "target": {
    "selector": {
      "type": "3DSelector",
      "value": [0.5, 1.2, -0.3],
      "area": [0.1, 0.1, 0.1],
      "camPos": [2.0, 1.5, 3.0]
    }
  }
}
```

## 活用事例

### 1. 文化財のデジタルアーカイブ

博物館や図書館が所蔵する立体的な文化財（地球儀、彫刻、建築模型など）のデジタル公開に活用できます。単なる3D表示だけでなく、研究者による詳細な解説をアノテーションとして付与することで、教育的価値を高めることができます。

### 2. 考古学研究

発掘された遺物の3Dモデルに対して、複数の研究者が協働でアノテーションを追加し、発見の詳細や解釈を共有することができます。

### 3. 建築史研究

歴史的建造物の3Dモデルに対して、建築様式の特徴や歴史的変遷をアノテーションとして記録し、バーチャルツアーとして活用できます。

## 今後の展望

IIIF 3D Viewerは、以下の方向性での発展が期待されます：

1. **機能拡張**
   - 複数の3Dモデルの比較表示
   - アノテーションの協働編集機能
   - VR/AR対応

2. **標準化への貢献**
   - IIIF 3D Technical Specification Groupへの参加
   - 3Dコンテンツに関するベストプラクティスの確立

3. **コミュニティ形成**
   - 利用機関間での知見共有
   - プラグイン・拡張機能の開発

## まとめ

IIIF 3D Viewerは、デジタルヒューマニティーズにおける3D資料の活用に新たな可能性をもたらすツールです。標準規格への準拠により、既存のデジタルアーカイブシステムとの連携が容易であり、研究・教育の両面で価値を発揮します。

オープンソースプロジェクトとして公開されているため、コミュニティからのフィードバックや貢献を歓迎しています。3D資料のデジタル活用に関心のある研究者・技術者の参加をお待ちしています。

## 参考リンク

- [IIIF 3D Viewer デモサイト](https://3d-iiif-viewer.vercel.app)
- [GitHubリポジトリ](https://github.com/nakamura196/iiif-3d-viewer)
- [IIIF公式サイト](https://iiif.io/)

---

*本記事は2025年1月時点の情報に基づいています。*