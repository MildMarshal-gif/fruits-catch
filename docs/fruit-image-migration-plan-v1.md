# Fruit Catch 画像移行実装プラン v1

## 0. 入力正規化

### 0-1. 目的
- `index.html` の Canvas ベクタ描画を PNG 画像描画へ移行する。
- 対象はフルーツ・虫・星・バスケット・新規演出（`bug_hit` / `star_burst` / `fruit_pop`）。
- 既存のゲーム性（当たり判定、スコア、フィーバー挙動、パフォーマンス）を壊さない。

### 0-2. スコープ
- 対象ファイル: `index.html`（単一ファイル構成のため）。
- 対象アセット:
  - `assets/images/game-objects/*.png`
  - `assets/images/game-effects/*.png`

### 0-3. 非スコープ
- UIレイアウト変更（HUDやオーバーレイの大幅変更）。
- サウンドシステム変更（`sfx()` / BGMロジック）。
- 当たり判定アルゴリズム自体の変更（`intersectsObjBasket()` の式変更）。

### 0-4. 前提・仮定
- 各 PNG は透過付きで、中心基準描画に耐えるレイアウトとする。
- 回転は現行の `o.rot` を継続利用する。
- 描画失敗時は既存 Canvas 関数へフォールバックしてゲーム継続を優先する。

## 1. 完了条件（Definition of Done）
- オブジェクト描画が画像優先になっている。
- 画像ロード失敗時でも既存描画でプレイ継続できる。
- 星・虫・フルーツ取得イベントで演出画像が発火する。
- `intersectsObjBasket()`（`index.html:2009`）の結果に対する体感ヒット率が現行同等。
- 端末別（desktop/tablet/mobile）のプレイで進行不能がない。

## 2. 要件トレーサビリティ

| 要件ID | 要件 | v1内の対応セクション |
|---|---|---|
| R1 | フェーズ分割 | 4章 |
| R2 | 各フェーズに目的/変更対象/リスク/完了条件 | 4章 |
| R3 | データ構造変更 | 5章 |
| R4 | 読込失敗フォールバック | 6章 |
| R5 | 当たり判定に合わせるスケーリング | 7章 |
| R6 | 演出発火タイミングのマッピング | 8章 |
| R7 | バスケット画像基準/アンカー整合 | 9章 |
| R8 | パフォーマンス対策 | 10章 |
| R9 | テスト計画 | 11章 |
| R10 | 最小リリース案と段階移行案の比較 | 13章 |

## 3. マイルストーン（順序）
- M1: 画像ロード基盤を導入し、描画系から呼び出せる状態にする。
- M2: フルーツ・虫・星の描画を画像優先に変更する。
- M3: バスケット描画を画像化し、既存 `basket.w` / `basket.h` と整合させる。
- M4: `bug_hit` / `star_burst` / `fruit_pop` の画像演出レイヤーを追加する。
- M5: パフォーマンス最適化とQAを通して出荷判定する。

## 4. フェーズ詳細

### Phase 0: ベースライン固定
- 目的:
  - 変更前の基準を確定し、回帰判定可能にする。
- 変更対象関数/データ:
  - `drawObject()` (`index.html:2981`)
  - `drawBasket()` (`index.html:2910`)
  - 衝突処理 (`index.html:3207` 付近)
- リスク:
  - 測定指標が曖昧だと回帰に気付きにくい。
- 完了条件:
  - 基準ログ（1分プレイでスコア、ミス、FEVER発火回数）が保存済み。

### Phase 1: 画像ロード基盤
- 目的:
  - 画像アセットのキャッシュ・状態管理・取得APIを実装する。
- 変更対象関数/データ:
  - 新規: `IMAGE_MANIFEST`
  - 新規: `imageCache`
  - 新規: `loadGameAssets()`, `loadImageAsset()`, `getImageOrNull()`
  - 変更: `startGame()` (`index.html:1914`), `restartGame()` (`index.html:1924`)
- リスク:
  - 読込待ちで開始が遅延する。
  - 一部失敗時に描画が抜ける。
- 完了条件:
  - 読込中/成功/失敗を `imageCache` で判定可能。
  - 失敗時に既存 Canvas 描画へ分岐可能。

### Phase 2: オブジェクト画像描画
- 目的:
  - フルーツ・虫・星を画像描画に置換する。
- 変更対象関数/データ:
  - 変更: `drawObject()` (`index.html:2981`)
  - 新規: `getSpriteKeyForObject(o)`, `drawObjectSpriteOrFallback(o)`
  - 既存 fallback 利用: `drawApple()`, `drawBanana()`, `drawGrape()`, `drawWatermelon()`, `drawBug()`, `drawStarPath()`
- リスク:
  - 見た目サイズと当たり判定半径 `o.r` がズレる。
  - 画像の縦横比により回転時の視認性が変化する。
- 完了条件:
  - `kind=fruit/star/bug` の全分岐で画像優先描画できる。
  - 画像不在時に既存描画へ戻る。

### Phase 3: バスケット画像描画
- 目的:
  - バスケットを画像化しつつ、既存操作感とヒット感を維持する。
- 変更対象関数/データ:
  - 変更: `drawBasket()` (`index.html:2910`)
  - 新規: `drawBasketSpriteOrFallback()`
  - 参照維持: `basket` (`index.html:953`), `intersectsObjBasket()` (`index.html:2009`)
- リスク:
  - 視覚位置とヒットボックスのズレ。
  - `drawFixScaleY` (`index.html:1833`) による縦比変形で違和感が出る。
- 完了条件:
  - `basket.x/y/w/h` と見た目中心が一致する。
  - 既存移動ロジック (`index.html:3169` 付近) に変更不要。

### Phase 4: 演出画像導入
- 目的:
  - 取得/被弾イベントで画像演出を再生する。
- 変更対象関数/データ:
  - 新規: `impactFxQueue`, `spawnImpactFx()`, `updateImpactFx()`, `drawImpactFx()`
  - 変更: 衝突分岐 (`index.html:3210`, `index.html:3227`, `index.html:3242`)
- リスク:
  - 演出追加で描画コスト増。
  - 既存 `pop()` との重複で画面がうるさくなる。
- 完了条件:
  - `star_burst`, `bug_hit`, `fruit_pop` が既存イベントで発火する。
  - 画像失敗時は `pop()` 演出のみで継続。

### Phase 5: パフォーマンス調整
- 目的:
  - 描画負荷を抑え、モバイルでも操作遅延を抑止する。
- 変更対象関数/データ:
  - 新規: `spriteRasterCache`
  - 新規: `getSpriteRaster(spriteKey, bucket)`
  - 連携: `runtimeFxQuality` (`index.html:1029`)
- リスク:
  - キャッシュ肥大でメモリ圧迫。
  - 低品質時に演出が弱くなりすぎる。
- 完了条件:
  - 長時間プレイでフリーズ/急激なFPS低下がない。

### Phase 6: QA・出荷判定
- 目的:
  - 機能・視覚・実機・低速回線観点で合否判定する。
- 変更対象関数/データ:
  - テスト仕様書（本ドキュメント11章）
  - 必要時に軽微補正（`spriteMeta` 値）
- リスク:
  - 端末依存の見え方差異を見落とす。
- 完了条件:
  - 11章の合格条件を全て満たす。

## 5. データ構造変更

```js
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
// key -> { state: "idle"|"loading"|"ready"|"error", img:HTMLImageElement|null, w:number, h:number, error:any }

const spriteMeta = {
  fruit_apple: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.0 },
  fruit_banana: { collisionRadiusPx: 120, anchorX: 0.5, anchorY: 0.5, drawScale: 1.0 },
  // ...省略
  bonus_star: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.0 },
  hazard_bug: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.0 },
  basket_default: { anchorX: 0.5, anchorY: 0.5, drawScale: 1.0 }
};

const spriteRasterCache = new Map();
// key -> `${spriteKey}:${bucket}:${dpr}`

const impactFxQueue = [];
// item -> { fxKey, x, y, t, life, rot, scale, alpha }
```

## 6. 読込失敗フォールバック方針
- 原則:
  - 失敗した素材だけフォールバック。ゲーム全停止はしない。
- オブジェクト:
  - `drawObject()` 内で `img == null` の場合、既存 `drawXxx` を実行。
- バスケット:
  - `basket_default` 失敗時は既存 `drawBasket()` ベクタ描画を実行。
- 演出:
  - `fx_*` 失敗時は `pop()` + `addFloatText()` の現行演出で代替。

## 7. スケーリング方針（当たり判定維持）
- 基本:
  - 当たり判定は `o.r` を基準に維持し、式は変更しない。
- 描画スケール式:
  - `scale = (o.r / spriteMeta[key].collisionRadiusPx) * spriteMeta[key].drawScale`
  - `drawW = image.w * scale`
  - `drawH = image.h * scale`
- 描画座標:
  - `dx = -drawW * anchorX`
  - `dy = -drawH * anchorY`
- 既存縦補正:
  - `ctx.scale(1, drawFixScaleY)` を現行通り維持。

## 8. 演出素材の発火タイミングマッピング

| イベント | 既存コード位置 | 新規演出 |
|---|---|---|
| スター取得 | `index.html:3210` 分岐 | `spawnImpactFx("fx_star_burst", o.x, o.y, o.r)` |
| 虫被弾 | `index.html:3227` 分岐 | `spawnImpactFx("fx_bug_hit", o.x, o.y, o.r)` |
| フルーツ取得 | `index.html:3242` 分岐 | `spawnImpactFx("fx_fruit_pop", o.x, o.y, o.r)` |

擬似コード:

```js
if (o.kind === "star") {
  spawnImpactFx("fx_star_burst", o.x, o.y, o.r);
} else if (o.kind === "bug") {
  spawnImpactFx("fx_bug_hit", o.x, o.y, o.r);
} else {
  spawnImpactFx("fx_fruit_pop", o.x, o.y, o.r);
}
```

## 9. バスケット画像の描画基準
- 基準サイズ:
  - 衝突基準は `basket.w` / `basket.h` を唯一の真値として維持。
- アンカー:
  - `basket.x`, `basket.y` を画像中心アンカーに一致させる。
- 見え方:
  - 画像の縁（装飾）がはみ出す場合は `drawScale` で吸収し、ヒットボックスは不変。
- 整合:
  - `intersectsObjBasket()` の `insetX/insetTop/insetBottom` は現行値を維持する。

## 10. パフォーマンス対策
- 事前ロード:
  - 起動直後に `loadGameAssets()` を実行し、最初の遭遇時のデコード負荷を軽減。
- オフスクリーン活用:
  - 半径バケット単位でラスタ化結果をキャッシュ。
- 描画回数管理:
  - `impactFxQueue` の最大同時数を制限。
- 劣化制御:
  - `runtimeFxQuality` が低い端末で `impactFx` の寿命を短縮。

## 11. テスト計画

### 11-1. 機能テスト
- フルーツ取得でスコアが増える（通常/フィーバー）。
- 星取得で `fever=true` に遷移し、残り時間UIが更新される。
- 虫取得でミス増加、ライフ表示更新、ゲームオーバー遷移する。

### 11-2. 視覚テスト
- 各フルーツ・星・虫・バスケットの中心位置ずれがない。
- 回転時に画像が破綻しない。
- 演出画像がイベントに同期して表示される。

### 11-3. 実機テスト
- iOS Safari / Android Chrome で操作追従を確認。
- 画面回転・リサイズ後に描画崩れがない。

### 11-4. 低速回線テスト
- 読込遅延時にゲーム開始不能にならない。
- 一部画像失敗でもフォールバック描画で進行する。

### 11-5. 合格条件
- 進行不能バグがゼロ。
- 当たり判定の体感差が許容範囲。
- 演出発火漏れがゼロ。

## 12. WBS（見積・依存）

| ID | タスク | 目安 | 依存 | 完了条件 |
|---|---|---:|---|---|
| T1 | マニフェスト・画像ローダ実装 | 3h | - | `IMAGE_MANIFEST` と `imageCache` が動作 |
| T2 | オブジェクト画像描画分岐実装 | 4h | T1 | `drawObject()` が画像優先 |
| T3 | バスケット画像描画実装 | 3h | T1 | `drawBasket()` が画像優先 |
| T4 | 演出キュー/描画実装 | 4h | T1 | 3イベントで `fx_*` 発火 |
| T5 | フォールバック・異常系実装 | 3h | T2,T3,T4 | 失敗時もプレイ継続 |
| T6 | パフォーマンス最適化 | 4h | T2,T3,T4 | カクつきが実用範囲 |
| T7 | テスト実行と調整 | 4h | T5,T6 | 11章合格 |

合計: 25h（+ バッファ 20% = 30h）

## 13. リリース案比較

| 観点 | 最小リリース案 | 段階的移行案 |
|---|---|---|
| 内容 | 画像描画を一括導入し、最小限の確認で出荷 | Phaseごとに導入し、各段で回帰確認 |
| 速度 | 速い | 中程度 |
| 不具合切り分け | 難しい | 容易 |
| 既存ゲーム性保護 | 中 | 高 |
| 推奨度 | 低 | 高 |

## 14. 主要実装擬似コード

```js
async function loadGameAssets() {
  const entries = Object.entries(IMAGE_MANIFEST);
  await Promise.allSettled(entries.map(([key, src]) => loadImageAsset(key, src)));
}

function drawObjectSpriteOrFallback(o) {
  const key = getSpriteKeyForObject(o);
  const img = getImageOrNull(key);
  if (!img) return drawObjectFallback(o);

  const meta = spriteMeta[key];
  const scale = (o.r / meta.collisionRadiusPx) * meta.drawScale;
  const dw = img.w * scale;
  const dh = img.h * scale;

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(1, drawFixScaleY);
  ctx.rotate(o.rot);
  ctx.drawImage(img.img, -dw * meta.anchorX, -dh * meta.anchorY, dw, dh);
  ctx.restore();
}
```

