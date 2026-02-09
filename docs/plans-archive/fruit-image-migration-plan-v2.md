# Fruit Catch 画像移行実装プラン v2

## 0. 入力正規化

### 0-1. 目的
- `index.html` 内の Canvas ベクタ描画（フルーツ・虫・星・バスケット）を PNG 画像描画へ移行する。
- 新規演出素材 `fx_bug_hit_v1.png` / `fx_star_burst_v1.png` / `fx_fruit_pop_v1.png` を既存イベントに接続する。
- 当たり判定・スコア・フィーバー・入力追従・パフォーマンスを維持する。

### 0-2. スコープ
- 対象ファイル: `index.html`
- 対象アセット:
  - `assets/images/game-objects/*`
  - `assets/images/game-effects/*`

### 0-3. 非スコープ
- サウンド仕様変更（`sfx()`、BGMモード切替）。
- UI/レイアウト刷新（HUD構造の変更）。
- 当たり判定ロジック式の変更（`intersectsObjBasket()` 自体は維持）。

### 0-4. 明示仮定
- 画像に欠損があってもプレイ継続を最優先にする。
- 画像と当たり判定の差は `spriteMeta` の係数で吸収する。
- 既存の端末適応ロジック（`applyResponsiveProfile()`）は維持し、描画層のみ置換する。

## 1. 完了条件（DoD）
- 画像描画が `drawObject()` / `drawBasket()` で優先される。
- 画像読込失敗時に既存Canvas描画へ自動フォールバックする。
- 演出画像がスター取得・虫被弾・フルーツ取得で必ず発火する。
- `intersectsObjBasket()`（`index.html:2009`）との体感整合が取れている。
- QA定量基準（11章）を満たす。
- 機能フラグで即時切戻し可能である。

## 2. 要件トレーサビリティ

| 要件ID | 要件 | 対応セクション |
|---|---|---|
| R1 | フェーズ分割 | 4章 |
| R2 | 目的/変更対象/リスク/完了条件 | 4章 |
| R3 | データ構造変更 | 5章 |
| R4 | 読込失敗フォールバック | 6章 |
| R5 | スケーリング方針 | 7章 |
| R6 | 演出発火マッピング | 8章 |
| R7 | バスケット描画基準 | 9章 |
| R8 | パフォーマンス対策 | 10章 |
| R9 | テスト計画 | 11章 |
| R10 | 最小リリース案/段階移行案比較 | 13章 |

## 3. マイルストーン
- M1: 安全なロード基盤と切戻しフラグを導入。
- M2: オブジェクト画像化（fruit/star/bug）を完了。
- M3: バスケット画像化とヒット整合を完了。
- M4: 演出画像化を完了。
- M5: 最適化・QA・出荷判定を完了。

## 4. フェーズ詳細

### Phase 0: ベースライン固定
- 目的:
  - 回帰判定の比較基準を確立する。
- 変更対象関数/データ:
  - 計測対象: `drawObject()` (`index.html:2981`), `drawBasket()` (`index.html:2910`)
  - 衝突処理: `intersectsObjBasket()` 呼出点 (`index.html:3207`)
- リスク:
  - 基準不足により「体感悪化」を定量化できない。
- 完了条件:
  - 1分プレイの基準値（スコア、ミス、FEVER発火数、平均FPS）を記録済み。

### Phase 1: 画像ロード基盤 + ロールバック機構
- 目的:
  - 画像ロード、状態管理、障害時切戻しを追加する。
- 変更対象関数/データ:
  - 新規データ: `IMAGE_MANIFEST`, `imageCache`, `assetLoadMetrics`
  - 新規関数: `loadGameAssets()`, `loadImageAsset()`, `getImageOrNull()`
  - 新規定数:
    - `ASSET_PRELOAD_TIMEOUT_MS = 1800`
    - `ASSET_RETRY_MAX = 1`
    - `ASSET_START_REQUIRED_RATIO = 0.0`（0=ロード未完了でも開始許可）
  - 新規フラグ:
    - `USE_IMAGE_SPRITES = true`
    - `USE_IMAGE_BASKET = true`
    - `USE_IMAGE_FX = true`
  - 変更: `startGame()` (`index.html:1914`), `restartGame()` (`index.html:1924`)
- リスク:
  - ローダ不備で開始時に固まる。
  - フラグ管理が散らばると運用事故になる。
- 完了条件:
  - タイムアウト後でも開始可能。
  - フラグOFFで既存描画に100%復帰可能。

### Phase 2: フルーツ/星/虫の画像描画移行
- 目的:
  - `drawObject()` を画像優先化し、既存描画はフォールバックとして残す。
- 変更対象関数/データ:
  - 変更: `drawObject()`
  - 新規: `drawObjectSpriteOrFallback(o)`, `getSpriteKeyForObject(o)`
  - 既存流用: `drawApple()`, `drawBanana()`, `drawOrange()`, `drawPeach()`, `drawStrawberry()`, `drawGrape()`, `drawWatermelon()`, `drawBug()`, `drawStarPath()`
- リスク:
  - 半径 `o.r` と見た目サイズのズレ。
  - 画像回転時の視認性低下。
- 完了条件:
  - `kind=fruit/star/bug` の全パスで画像優先描画し、失敗時のみフォールバックする。

### Phase 3: バスケット画像移行
- 目的:
  - バスケット見た目を画像に置換し、既存操作感を維持する。
- 変更対象関数/データ:
  - 変更: `drawBasket()`
  - 新規: `drawBasketSpriteOrFallback()`
  - 参照: `basket` (`index.html:953`), `intersectsObjBasket()` (`index.html:2009`)
- リスク:
  - 画像中心と判定矩形のズレ。
  - `drawFixScaleY` 適用時の歪み。
- 完了条件:
  - `basket.x/y` を中心アンカーとして一致。
  - `basket.w/h` は判定の真値として維持。

### Phase 4: 演出画像移行
- 目的:
  - 既存イベントに `fx_*` を接続し、演出を画像ベースで再生する。
- 変更対象関数/データ:
  - 新規: `impactFxQueue`, `spawnImpactFx()`, `updateImpactFx()`, `drawImpactFx()`
  - 発火点:
    - `index.html:3210`（スター取得）
    - `index.html:3227`（虫被弾）
    - `index.html:3242`（フルーツ取得）
- リスク:
  - `pop()` と併用時に過密表示。
  - 演出でフレーム落ち。
- 完了条件:
  - 3イベントで演出発火率100%。
  - 失敗時に `pop()` へ退避できる。

### Phase 5: パフォーマンス最適化
- 目的:
  - 低スペック端末での描画安定性を確保する。
- 変更対象関数/データ:
  - 新規: `spriteRasterCache`, `getSpriteRaster()`
  - 連携: `runtimeFxQuality` (`index.html:1029`)
  - 新規上限:
    - `FX_MAX_ACTIVE_DESKTOP = 36`
    - `FX_MAX_ACTIVE_TABLET = 24`
    - `FX_MAX_ACTIVE_MOBILE = 16`
- リスク:
  - キャッシュ増大によるGC増。
- 完了条件:
  - 連続5分プレイで操作不能/クラッシュがない。

### Phase 6: QA・出荷判定
- 目的:
  - 定量指標を満たすか判定して出荷可否を決める。
- 変更対象関数/データ:
  - QAチェックリスト（11章）
  - 必要に応じて `spriteMeta` の微調整
- リスク:
  - 端末差を見落とすと本番回帰の原因になる。
- 完了条件:
  - 11章のPass条件を全達成。

## 5. データ構造変更

```js
const FEATURE_FLAGS = {
  USE_IMAGE_SPRITES: true,
  USE_IMAGE_BASKET: true,
  USE_IMAGE_FX: true
};

const ASSET_PRELOAD_TIMEOUT_MS = 1800;
const ASSET_RETRY_MAX = 1;
const ASSET_START_REQUIRED_RATIO = 0.0;

const IMAGE_MANIFEST = {
  fruit_apple: "assets/images/game-objects/fruit_apple_v2.png",
  fruit_banana: "assets/images/game-objects/fruit_banana_v2.png",
  fruit_orange: "assets/images/game-objects/fruit_orange_v2.png",
  fruit_peach: "assets/images/game-objects/fruit_peach_v2.png",
  fruit_strawberry: "assets/images/game-objects/fruit_strawberry_v2.png",
  fruit_grape: "assets/images/game-objects/fruit_grape_v2.png",
  fruit_watermelon: "assets/images/game-objects/fruit_watermelon_v2.png",
  hazard_bug: "assets/images/game-objects/hazard_bug_v2.png",
  bonus_star: "assets/images/game-objects/bonus_star_v2.png",
  basket_default: "assets/images/game-objects/basket_default_v1.png",
  fx_bug_hit: "assets/images/game-effects/fx_bug_hit_v1.png",
  fx_star_burst: "assets/images/game-effects/fx_star_burst_v1.png",
  fx_fruit_pop: "assets/images/game-effects/fx_fruit_pop_v1.png"
};

const imageCache = new Map();
// key -> { state:"idle"|"loading"|"ready"|"error", img, w, h, error, retryCount, lastTriedAt }

const spriteMeta = {
  fruit_apple: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  fruit_banana: { collisionRadiusPx: 120, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  fruit_orange: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  fruit_peach: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  fruit_strawberry: { collisionRadiusPx: 124, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  fruit_grape: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  fruit_watermelon: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  hazard_bug: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  bonus_star: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
  basket_default: { anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 }
};

const spriteRasterCache = new Map();
// `${spriteKey}:${sizeBucket}:${dpr}` -> HTMLCanvasElement or ImageBitmap

const impactFxQueue = [];
// { fxKey, x, y, r, rot, life, t, alpha, scale }

const assetLoadMetrics = {
  total: 0,
  ready: 0,
  error: 0,
  timeout: false,
  preloadElapsedMs: 0
};
```

## 6. 画像読込失敗時フォールバック方針

### 6-1. 開始方針
- `startGame()` は `ASSET_PRELOAD_TIMEOUT_MS` 経過で待機を打ち切り、ゲーム開始を許可する。
- 画像はバックグラウンドでロード継続。

### 6-2. オブジェクト描画
- `FEATURE_FLAGS.USE_IMAGE_SPRITES === false` の場合は常に既存描画を使う。
- フラグONでも `imageCache[key].state !== "ready"` なら既存描画へフォールバック。

### 6-3. バスケット描画
- `USE_IMAGE_BASKET === false` または `basket_default` 未読込ならベクタ描画を使う。

### 6-4. 演出描画
- `USE_IMAGE_FX === false` または `fx_*` 未読込なら `pop()` + `addFloatText()` を使う。

### 6-5. リトライ
- `state="error"` のアセットは `ASSET_RETRY_MAX` 回だけ再試行する。
- 再試行後も失敗なら固定でフォールバック継続。

## 7. スケーリング方針（当たり判定維持）
- 当たり判定は既存の `o.r` と `intersectsObjBasket()` のまま固定。
- 描画のみ次式で変換:
  - `scale = (o.r / collisionRadiusPx) * drawScale`
  - `drawW = naturalWidth * scale`
  - `drawH = naturalHeight * scale`
- 回転・縦補正:
  - `ctx.translate(o.x, o.y)` → `ctx.scale(1, drawFixScaleY)` → `ctx.rotate(o.rot)`
- 視覚ズレ補正:
  - 種別ごとに `anchorX`, `anchorY`, `drawScale` を `spriteMeta` で調整。

## 8. 演出素材発火タイミング

| イベント | 既存箇所 | 追加処理 |
|---|---|---|
| スター取得 | `index.html:3210` | `spawnImpactFx("fx_star_burst", o.x, o.y, o.r)` |
| 虫被弾 | `index.html:3227` | `spawnImpactFx("fx_bug_hit", o.x, o.y, o.r)` |
| フルーツ取得 | `index.html:3242` | `spawnImpactFx("fx_fruit_pop", o.x, o.y, o.r)` |

擬似コード:

```js
function onObjectCaught(o) {
  if (o.kind === "star") {
    spawnImpactFx("fx_star_burst", o.x, o.y, o.r);
  } else if (o.kind === "bug") {
    spawnImpactFx("fx_bug_hit", o.x, o.y, o.r);
  } else {
    spawnImpactFx("fx_fruit_pop", o.x, o.y, o.r);
  }
}
```

## 9. バスケット画像描画基準
- 基準サイズ:
  - 判定サイズは `basket.w` / `basket.h` を唯一の基準とする。
- アンカー:
  - `basket.x`, `basket.y` を画像中心アンカーに一致させる。
- 既存との整合:
  - `intersectsObjBasket()` の inset パラメータは変更しない。
  - `applyResponsiveProfile()` が更新する `basket.w/h` をそのまま描画スケールに反映。
- 移動時見え方:
  - 既存の `targetX` 補間挙動（`index.html:3169`）を維持し、ちらつき防止でサブピクセル描画を許可。

## 10. パフォーマンス対策
- 事前ロード:
  - `Promise.allSettled()` + タイムアウト制御で初期待機を制限。
- ラスタキャッシュ:
  - 半径を8pxバケット化し、同一サイズ描画を再利用。
- 描画回数制限:
  - `impactFxQueue` の同時数をデバイス別上限で制御。
- 品質連動:
  - `runtimeFxQuality` が低い場合、`impactFx.life` を短縮し、alphaを下げる。
- メモリ保護:
  - `spriteRasterCache` は LRU で古いエントリを破棄（上限64）。

## 11. テスト計画（定量基準つき）

### 11-1. 機能テスト
- 星取得:
  - `fever === true` へ遷移、`feverEnd` が延長される。
  - 合格条件: 50回試行で遷移失敗0回。
- 虫被弾:
  - `misses` が加算される。
  - 合格条件: 50回試行で加算漏れ0回。
- フルーツ取得:
  - `score` 加算が正しい。
  - 合格条件: 通常時/フィーバー時とも計算差異0件。

### 11-2. 視覚テスト
- 画像中心と当たり判定整合:
  - 合格条件: 主要種別で体感ズレ報告なし（3人レビュー）。
- 回転描画:
  - 合格条件: 1000フレーム連続で破綻なし。

### 11-3. パフォーマンステスト
- Desktop:
  - 合格条件: 平均55fps以上、1% low 45fps以上。
- Mobile:
  - 合格条件: 平均45fps以上、入力遅延体感が許容内。
- 連続プレイ:
  - 合格条件: 5分連続でクラッシュ/ハング0件。

### 11-4. 低速回線/失敗系
- Slow 3G相当:
  - 合格条件: 1.8秒以内にプレイ開始可能（素材未完了可）。
- 画像404を意図発生:
  - 合格条件: 該当素材のみフォールバックし、進行不能なし。

### 11-5. 実機テスト
- iOS Safari / Android Chrome / PC Chrome で実施。
- 合格条件: 主要操作（左右移動・取得・被弾・再開/再スタート）に不具合なし。

## 12. WBS（見積・依存）

| ID | タスク | 工数 | 依存 | 完了条件 |
|---|---|---:|---|---|
| T1 | ロード基盤 + 機能フラグ実装 | 4h | - | フラグ切替で描画経路を制御可能 |
| T2 | オブジェクト画像描画実装 | 4h | T1 | fruit/star/bug が画像化 |
| T3 | バスケット画像描画実装 | 3h | T1 | basket が画像化 |
| T4 | 演出画像キュー実装 | 4h | T1 | 3イベントで演出発火 |
| T5 | フォールバック/リトライ実装 | 3h | T2,T3,T4 | 未読込/失敗でも進行可能 |
| T6 | キャッシュ/上限調整実装 | 3h | T2,T3,T4 | FPS安定化確認 |
| T7 | QA（機能/視覚/低速回線/実機） | 5h | T5,T6 | 11章の定量基準達成 |
| T8 | リリース判定・ロールバック手順確認 | 2h | T7 | 切戻し運用を確認 |

合計: 28h  
バッファ20%込み: 34h

## 13. リリース方式比較

| 観点 | 最小リリース案 | 段階的移行案 |
|---|---|---|
| 方針 | 一括で画像導入 | PhaseごとにON範囲を拡大 |
| 速度 | 速い | 中速 |
| 安全性 | 低〜中 | 高 |
| 切戻し | 粗い（全OFF中心） | 細かい（Sprites/Basket/FX個別OFF） |
| 不具合切り分け | 難しい | 容易 |
| 推奨 | 代案 | おすすめ |

## 14. 実装擬似コード

```js
async function warmupAssetsWithTimeout() {
  const task = loadGameAssets();
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve("timeout"), ASSET_PRELOAD_TIMEOUT_MS);
  });
  await Promise.race([task, timeout]);
}

function drawObject(o) {
  if (!FEATURE_FLAGS.USE_IMAGE_SPRITES) return drawObjectFallback(o);
  return drawObjectSpriteOrFallback(o);
}

function drawBasket() {
  if (!FEATURE_FLAGS.USE_IMAGE_BASKET) return drawBasketFallback();
  return drawBasketSpriteOrFallback();
}

function spawnImpactByEvent(o) {
  if (!FEATURE_FLAGS.USE_IMAGE_FX) return spawnLegacyPopFx(o);
  if (o.kind === "star") return spawnImpactFx("fx_star_burst", o.x, o.y, o.r);
  if (o.kind === "bug") return spawnImpactFx("fx_bug_hit", o.x, o.y, o.r);
  return spawnImpactFx("fx_fruit_pop", o.x, o.y, o.r);
}
```

