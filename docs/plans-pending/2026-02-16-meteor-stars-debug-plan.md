# Fever Time 流れ星エフェクト デバッグ引き継ぎプラン

## Context

Fever Time時に表示する流れ星エフェクトを、既存のグラデーション版から画像ベース（3種類の表情豊かな星）に置き換える実装を完了したが、実際にブラウザで確認すると流れ星が表示されない問題が発生。

**ユーザー報告**:
- Chrome、Brave、スマホなど複数環境で確認したが、Fever Time中に流れ星が表示されない
- ブラウザキャッシュの問題ではない（複数ブラウザ・デバイスで同じ症状）

**実装状況**:
- 画像素材（3種類）は配置済み: `assets/images/game-effects/meteor_star_face[1-3]_v1.png`
- IMAGE_MANIFEST登録完了
- spawnShootingStar()、drawShootingStarsLayer()の書き換え完了
- コード実装自体は正しく見える
- サーバーは画像をHTTP 200で正常配信している

## 現在のコード状態

### 実装完了箇所

1. **画像アセット配置** (`assets/images/game-effects/`)
   - `meteor_star_face1_v1.png` (1.5MB, 1024x1024)
   - `meteor_star_face2_v1.png` (1.6MB, 1024x1024)
   - `meteor_star_face3_v1.png` (1.5MB, 1024x1024)

2. **IMAGE_MANIFEST登録** (`scripts/game.js` lines 283-285)
   ```javascript
   meteor_star_face1: withAssetVersion('assets/images/game-effects/meteor_star_face1_v1.png'),
   meteor_star_face2: withAssetVersion('assets/images/game-effects/meteor_star_face2_v1.png'),
   meteor_star_face3: withAssetVersion('assets/images/game-effects/meteor_star_face3_v1.png'),
   ```

3. **spawnShootingStar() 改修** (`scripts/game.js` lines 1043-1065)
   - imageKeyランダム選択実装
   - rotation, rotationSpeed追加
   - サイズランダム化（32-64px）

4. **回転更新追加** (`scripts/game.js` line 1225)
   ```javascript
   s.rotation += s.rotationSpeed * dt;
   ```

5. **spawn間隔調整** (`scripts/game.js` line 1191)
   ```javascript
   const interval = reducedMotionQuery.matches ? 0.28 : (0.12 - state.intensity * 0.05);
   ```

6. **drawShootingStarsLayer() 完全書き換え** (`scripts/game.js` lines 2572-2599)
   - 画像ベース描画に変更
   - 回転・フェード実装
   - getSpriteRaster()でキャッシュ活用

### デバッグ用の一時変更（⚠️ 元に戻す必要あり）

1. **Line 1188**: 常に流れ星を生成するよう強制変更
   ```javascript
   const meteorActive = true; // DEBUG: 常に流れ星を生成
   ```
   **元のコード**:
   ```javascript
   const meteorActive = fever || state.intensity > 0.06;
   ```

2. **Line 2583**: デバッグログ追加
   ```javascript
   console.log('[DEBUG] imageKey:', s.imageKey, 'entry:', entry ? { state: entry.state, hasImg: !!entry.img } : 'null');
   ```
   **削除する**: このログは不要

## 調査済み事項

### ✓ 確認済み（問題なし）

1. **画像ファイル存在**: 3ファイルすべて正しい場所に配置
2. **サーバー配信**: curl確認でHTTP 200、正常配信
3. **IMAGE_MANIFESTキー名**: spawnShootingStar()のimageVariantsと一致
4. **自動プリロード**: IMAGE_MANIFESTの全エントリは自動プリロードされる仕組み（line 773）
5. **描画関数呼び出し**: drawShootingStarsLayer()はメイン描画ループから呼ばれている（line 2662）
6. **JavaScriptエラー**: コンソールにエラーなし
7. **getSpriteRaster実装**: assets.jsの実装は正常

### ❌ 未確認・問題の可能性

1. **shootingStars配列が空**: デバッグログが一切出力されない → drawShootingStarsLayer()が実質スキップされている可能性
2. **imageCache取得失敗**: line 2582の`imageCache.get(s.imageKey)`が失敗している可能性
3. **画像読み込みタイミング**: プリロード完了前にFever Timeが発動している？
4. **Fever Time発動の問題**: JavaScriptでFC.state.feverをtrueにしても、内部のローカル変数`fever`と同期されない

## 次のステップ（優先度順）

### 1. Fever Timeを正式に発動させて確認 ⭐ **ユーザー希望**

**目的**: デバッグ用の強制設定ではなく、実際のゲームフローでFever Timeを発動させて流れ星の表示を確認する。

**手順**:
1. デバッグ用変更を元に戻す（line 1188, line 2583）
2. ローカルサーバー起動
3. ゲームプレイで星（bonus_star）を3個キャッチ
4. Fever Time発動を確認
5. 流れ星が表示されるか目視確認
6. もし表示されない場合、以下をブラウザコンソールで確認:
   ```javascript
   // Fever状態
   FC.state.fever

   // 画像キャッシュ（外部からアクセス不可の可能性あり）
   // game.js内部の変数なのでアクセスできないかも
   ```

### 2. コンソールログによる詳細調査

**もしFever Time発動でも表示されない場合**、以下のログを追加:

```javascript
// updateFeverEffects関数内（line 1192付近）
if (meteorActive) {
  console.log('[METEOR] Active, spawning...', { shootingStarSpawnTimer, interval });
  // ...
}

// spawnShootingStar関数の最初
function spawnShootingStar(intensity = 1) {
  console.log('[SPAWN] Creating shooting star');
  // ...
  console.log('[SPAWN] Added to array:', { imageKey, size, rotation });
}

// drawShootingStarsLayer関数
function drawShootingStarsLayer() {
  if (shootingStars.length > 0) {
    console.log('[DRAW] Drawing', shootingStars.length, 'stars');
  }
  // ...
}
```

### 3. 画像読み込み状態の確認

game.jsに一時的なデバッグ関数を追加:

```javascript
// グローバルに公開（initGame関数の最後あたり）
window.debugMeteorImages = function() {
  const keys = ['meteor_star_face1', 'meteor_star_face2', 'meteor_star_face3'];
  keys.forEach(key => {
    const entry = imageCache.get(key);
    console.log(key, entry ? { state: entry.state, hasImg: !!entry.img, width: entry.img?.width } : 'NOT FOUND');
  });
};
```

ブラウザコンソールで `debugMeteorImages()` を実行して確認。

### 4. 最小再現コードでの検証

drawShootingStarsLayer関数の最初に、強制的にテスト星を1つ描画してみる:

```javascript
function drawShootingStarsLayer() {
  // TEST: 強制的に1つ描画
  ctx.save();
  const testEntry = imageCache.get('meteor_star_face1');
  if (testEntry && testEntry.state === 'ready' && testEntry.img) {
    ctx.globalAlpha = 0.8;
    ctx.drawImage(testEntry.img, 100, 100, 64, 64);
    console.log('[TEST] Drew test star at 100,100');
  } else {
    console.log('[TEST] Cannot draw test star:', testEntry);
  }
  ctx.restore();

  // 元のコード
  if (!shootingStars.length) return;
  // ...
}
```

これで画像64x64pxが左上付近に常に表示されれば、画像読み込み自体は成功している。

## Critical Files

| ファイル | 変更箇所 | 状態 |
|---------|---------|------|
| `scripts/game.js` | line 283-285 | ✅ 完了 |
| `scripts/game.js` | line 1043-1065 | ✅ 完了 |
| `scripts/game.js` | line 1188 | ⚠️ デバッグ用変更（要復元） |
| `scripts/game.js` | line 1191 | ✅ 完了 |
| `scripts/game.js` | line 1225 | ✅ 完了 |
| `scripts/game.js` | line 2572-2599 | ✅ 完了 |
| `scripts/game.js` | line 2583 | ⚠️ デバッグログ（要削除） |
| `assets/images/game-effects/` | 3 PNG files | ✅ 配置済み |

## 考えられる原因仮説

### 仮説A: 画像キャッシュが内部スコープで取得できていない

**症状**: `imageCache.get(s.imageKey)` が null または state !== 'ready' を返す

**原因**:
- IMAGE_MANIFESTのキー名とspawnShootingStar内のimageVariants配列の不一致
  - → 確認済み、一致している
- プリロード失敗
  - → HTTP 200確認済み、失敗していない
- imageCacheがローカル変数で、drawShootingStarsLayer関数から正しくアクセスできていない
  - → スコープ的には同じクロージャ内なので問題ないはず

**検証方法**: 仮説4の最小再現コードを試す

### 仮説B: shootingStars配列が空（生成されていない）

**症状**: デバッグログが一切出力されない

**原因**:
- updateFeverEffects関数が呼ばれていない
  - → ゲームループから呼ばれているはず（line 3260）
- meteorActiveが常にfalseになっている
  - → デバッグで`meteorActive = true`に強制したが効果なし？
- spawnShootingStar関数内でエラーが発生して配列追加前に失敗
  - → コンソールエラーなし

**検証方法**: 仮説2のコンソールログを追加

### 仮説C: 描画されているが見えない

**症状**: 実は描画されているが、何らかの理由で視認できない

**原因**:
- 画像が透明
  - → 素材確認済み、問題なし
- サイズが0または極小
  - → 32-64pxで指定、問題なし
- 画面外に描画
  - → spawn位置はゲーム画面内に設定されている
- z-indexや描画順の問題
  - → drawShootingStarsLayer()は適切な位置で呼ばれている（line 2662）
- globalAlpha が 0 に近い
  - → `lifeK * 0.92` なので最大0.92、視認可能なはず

**検証方法**: 仮説4の最小再現コードで強制描画

## メモ・その他

- コミット済み（commit 353dcd9）: 初回実装
- ブラウザキャッシュクリア試行済み: 効果なし
- 複数環境（Chrome, Brave, スマホ）で同じ症状
- ユーザーは実際のFever Time発動での確認を希望

## 推奨される作業フロー

1. **デバッグコード削除**
   - Line 1188: `const meteorActive = true;` → `const meteorActive = fever || state.intensity > 0.06;`
   - Line 2583: console.logを削除

2. **実ゲームでFever Time発動**
   - ローカルサーバー起動
   - 星3個キャッチ
   - 流れ星確認

3. **もし表示されなければ**
   - 次のステップ2のログ追加
   - 次のステップ3のデバッグ関数追加
   - 次のステップ4の最小再現コード追加

4. **原因特定後**
   - 修正実装
   - テスト
   - デバッグコード削除
   - コミット

## Quick Start Commands

```powershell
# ローカルサーバー起動
powershell -ExecutionPolicy Bypass -File scripts/start-local-server.ps1

# ブラウザで確認
# http://localhost:8080/

# サーバー停止
powershell -ExecutionPolicy Bypass -File scripts/stop-local-server.ps1
```
