# アノテーション表示のパフォーマンス最適化

## 概要

3Dビューワーでアノテーションが多数ある場合、背面判定（Raycast）処理がパフォーマンスのボトルネックになります。本ドキュメントでは、採用した最適化手法について説明します。

## 問題

アノテーションの背面判定には、各アノテーションに対してRaycast（光線とメッシュの衝突判定）を実行する必要があります。この処理は以下の理由で重くなります：

- メッシュの全頂点との衝突判定が必要
- アノテーション数に比例して計算量が増加
- 毎フレーム実行すると60FPSの維持が困難

## 解決策: Idle時のみRaycast実行

**カメラが停止した時のみRaycast処理を実行**する方式を採用しました。

### 動作フロー

```
カメラ移動中 → Raycast処理をスキップ（軽量）
    ↓
カメラ停止検出
    ↓
10フレーム待機（安定化）
    ↓
1回だけRaycast実行
    ↓
次にカメラが動くまで再計算しない
```

### 実装詳細

```typescript
// パフォーマンス設定
const CAMERA_MOVE_THRESHOLD = 0.001; // カメラ移動の閾値
const IDLE_FRAMES_BEFORE_RAYCAST = 10; // 停止後このフレーム数待ってからRaycast

useFrame(() => {
  // カメラの移動量をチェック
  const cameraMoved = camera.position.distanceTo(prevCameraPosition) > CAMERA_MOVE_THRESHOLD;
  prevCameraPosition.copy(camera.position);

  if (cameraMoved) {
    // カメラが動いている間はカウンタをリセット
    idleFrameCountRef.current = 0;
    needsRaycastRef.current = true;
    return; // Raycast処理をスキップ
  }

  // カメラが停止している
  idleFrameCountRef.current++;

  // 停止後、一定フレーム待ってからRaycast実行（1回のみ）
  if (!needsRaycastRef.current) return;
  if (idleFrameCountRef.current < IDLE_FRAMES_BEFORE_RAYCAST) return;

  // Raycast実行（1回のみ）
  needsRaycastRef.current = false;

  // ... Raycast処理 ...
});
```

### 2段階の判定処理

Raycast処理自体も最適化しています：

1. **第1パス（軽量）**: Frustum判定 + カメラ前後判定
   - 視野外のアノテーションを早期に除外
   - 計算コストが低い

2. **第2パス（重い）**: Raycast判定
   - 第1パスを通過したアノテーションのみ対象
   - メッシュとの衝突判定を実行

## メリット

| 項目 | 従来方式 | 最適化後 |
|------|----------|----------|
| Raycast頻度 | 毎フレーム or 15フレームごと | カメラ停止時のみ |
| ドラッグ中の負荷 | 高い | ほぼゼロ |
| 背面判定の正確性 | 常に正確 | 停止後に正確 |

## 一般的な手法か？

はい。この「**Idle時の処理**」パターンは、以下のアプリケーションで広く使われています：

- **Google Maps**: ドラッグ中は低解像度、停止後に高解像度タイル読み込み
- **3Dビューワー**: 移動中は簡易表示、停止後に詳細計算
- **テキストエディタ**: 入力中はシンタックスハイライトを遅延

## 制限事項

- カメラ移動中は背面判定が更新されないため、一時的に不正確な表示になる可能性があります
- ただし、停止後すぐに更新されるため、実用上は問題ありません

## 関連ファイル

- `src/components/three/Annotations.tsx` - 背面判定ロジック
- `src/components/three/AnnotationMarker.tsx` - アノテーションマーカー表示
