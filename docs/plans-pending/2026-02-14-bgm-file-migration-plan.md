# BGM実ファイル移行 実装計画

## 1. 要約
合成BGMシーケンサを廃止し、`assets/audio/bgm/*.mp3` を使うBGM管理層を `scripts/engine/audio.js` に新設する。
通常/feverは180msクロスフェード、ゲームオーバーは`lose`単発、SFXは現状維持、ロード失敗時は無音フォールバックで継続に統一する。

## 2. 変更対象ファイル
1. `assets/audio/bgm/normal.mp3`（新規コピー）
2. `assets/audio/bgm/fever.mp3`（新規コピー）
3. `assets/audio/bgm/lose.mp3`（新規コピー）
4. `assets/audio/README.md`（新規）
5. `scripts/engine/audio.js`（新規）
6. `scripts/game.js`（BGM関連置換）
7. `index.html`（`scripts/engine/audio.js` 読み込み追加）
8. `docs/audio-loop-notes.md`（必要時のみ新規）

## 3. 公開インターフェース/責務追加
1. `FC.createAudioEngine(options)` を `scripts/engine/audio.js` で公開する。
2. 返却オブジェクトAPIを以下で固定する。
`prime()`, `setEnabled(on)`, `startSession(mode)`, `setMode(mode, crossfadeMs?)`, `pause()`, `resume()`, `endGame()`, `setLoopPoints(trackId, { loopStart, loopEnd })`, `dispose()`
3. `scripts/game.js` はBGM制御をこのAPI経由に限定し、BGM生成コード（既存シーケンサ）を削除する。
4. SFX（`catch/miss/star`）は既存WebAudio実装を維持する。

## 4. 実装手順（順序固定）
1. 素材搬入。
`C:\Users\test-user\Desktop\素材\BGM_SE\*.mp3` をコピーで `assets/audio/bgm/*.mp3` へ配置する。移動（元削除）は最後にユーザー確認を取って提案に留める。
2. `assets/audio/README.md` を作成。
元ファイル名と配置先の対応表を明記する。
3. `scripts/engine/audio.js` を新規実装。
`AudioContext` + `AudioBuffer`ベースで3トラックをロードし、`normal`/`fever`ループ、`lose`ワンショットを管理する。
ロード失敗時は内部フラグで該当トラックを無効化し、例外を外に漏らさない。
4. ループ設計を実装。
`normal`/`fever`は `loopStart/loopEnd` 設定可能にし、初期値は `loopStart=0`, `loopEnd=buffer.duration`。
`setMode` 時は180ms（要件範囲120-250ms内）の等電力寄りクロスフェードで切替。
5. `scripts/game.js` を置換。
既存BGMシーケンサ定義と呼び出しを削除し、以下を `audioEngine` 呼び出しへ差し替える。
`soundBtn` ON/OFF、`startGame/restartGame`、`setPaused`、fever開始/終了、`endGame`、初期overlay状態、`beforeunload`。
6. `index.html` 更新。
`<script src="./scripts/engine/audio.js"></script>` を `game.js` より前に追加する。
7. ループ品質評価。
ローカル再生で継ぎ目が目立つ場合のみ `docs/audio-loop-notes.md` を作成し、推奨ループ点（秒）と根拠を記録する。
編集ツール未導入前提で、編集必要理由と推奨編集内容（ゼロクロス近傍、50-150ms等電力クロスフェード）を記載する。
8. 検証と報告。
指定チェックリストをOK/NGで結果化し、差分要約・フォールバック挙動・追加素材編集タスクを報告する。

## 5. `audio.js` 実装詳細（決定事項）
1. トラック定義。
`normal`, `fever`, `lose` に `src`, `loop`, `loopStart`, `loopEnd` を持たせる。
2. フェード実装。
`normalGain` と `feverGain` を分離し、`setMode` で両方を同時ランプ。デフォルト180ms。
3. 通常復帰方式。
要望確定どおり「位相維持復帰」を採用。`normal`はセッション中に再生維持し、fever終了時はnormalへクロスフェード復帰。
4. pause/resume。
`pause()` でBGM側を停止状態へ、`resume()` で現在モードに応じて復帰。ゲームロジックの `setPaused` と同期。
5. endGame。
`normal/fever` をフェードアウト停止後に`lose`を1回再生。
6. フォールバック。
`fetch/decode/play` の失敗を個別に握り、無音で継続。コンソールは`warn`止まり、例外未送出。

## 6. 検証シナリオ
1. 開始で通常BGM再生。
`start`後に`normal`有効、コンソールエラーなし。
2. スター取得でfever遷移。
`setMode('fever')` が呼ばれ、180ms前後で切替。
3. fever終了で通常復帰。
`setMode('normal')` で自然復帰し、破綻なし。
4. ゲームオーバーで`lose`再生。
ループ停止後に`lose`単発再生。
5. soundトグル即時反映。
ON/OFFで即時ミュート/再開、UI表示一致。
6. pause/resume整合。
一時停止中に破綻なし、再開後にモード維持。
7. ロード失敗フォールバック。
音声ロード不可時でもゲーム進行継続、クラッシュなし。
8. コンソール健全性。
致命エラーなし（`error`なし、必要なら`warn`のみ）。

## 7. 受け入れ基準
1. 合成BGMコードが `scripts/game.js` から除去されている。
2. BGM再生は `scripts/engine/audio.js` 管理層経由のみ。
3. 要件の状態遷移（start/restart/pause/resume/fever/endGame/soundBtn）すべて連動。
4. SFX（catch/miss/star）挙動が従来通り。
5. 素材マッピングドキュメントが存在。
6. ループ継ぎ目問題があれば `docs/audio-loop-notes.md` に改善指針が記録済み。

## 8. 前提・既定値
1. クロスフェード既定値は180ms（要件範囲内）。
2. ループ点既定値は全尺（`0`〜`duration`）。
3. ループ自然さの最終主観判定はユーザー耳確認を最終とする。
4. 元素材はまずコピーのみ。移動（削除）はユーザー確認後に別途実施提案。
