# 2026-02-10 フォント差し替え・一元管理 実装計画

結論: フォントはローカル配布（`assets/fonts/` + `@font-face`）へ切り替え、役割ベースのトークンで一元管理する。
結論: `FRUIT CATCH` 専用フォントは `.title` の属性切替でピンポイント適用し、他見出しと本文を厳密に分離する。

## 1. 要件整理（確定事項 / 未確定事項）

### 確定事項
- 実装対象は `fruits-catch` のフォント差し替えと、今後の変更容易化を目的にした設定集約。
- タイトル文言は `FRUIT CATCH` に固定する。
- フォント割り当て:
  - 見出し（`FRUIT CATCH` のみ）: `poprumcute.zip`、太さは標準。
  - 見出し（その他）: `rounded-x-mplus-20150529.zip`、太さは `1p-BLACK`。
  - 本文（上記以外すべて）: `mgenplus-1p-20150602.zip`、太さは `1pp-medium`、行間はやや広め。
- ライセンス確認の一次参照元は次で固定する。
  - `https://moji-waku.com/mj_work_license/`
  - 各 ZIP 同梱の `readme` / `license`（最終正本）
- 参考リンク（補助参照）は次で固定する。
  - `https://moji-waku.com/kenq/kenq_trademark/`
  - `https://moji-waku.com/poprumcute/`
  - `http://jikasei.me/info/license.html`
- 3フォントのライセンス文書は個別同梱で運用する（`assets/fonts/licenses/`）。
- `poprumcute` は参照先の使用許諾範囲に従い、実装前に「Webフォント利用可」「無断2次配布禁止」を正本で再確認する。
- 候補ウェイトが複数ある場合は、`1p-BLACK` / `1pp-medium` の名称一致を最優先する（大文字小文字差は同一扱い）。
- 既存 UI を壊さない前提で影響範囲を洗い出す。
- 計画のみ作成し、コード実装は次フェーズ。

### 未確定事項
- ZIP 内の実ファイル名（`.ttf`/`.otf`/`.woff2`）と、スタイル名・ウェイト名の対応（`1p-BLACK` / `1pp-medium` が内部でどう表記されるか）。
- `poprumcute` の配布条件に基づく公開版での取り扱い（同梱可否 / Web フォント配信可否）の最終判断。

## 2. 実装方針（読み込み方法、font-family設計、セレクタ設計）

### 読み込み方法
- 外部 Web フォント読み込みをやめ、ローカル配布へ統一。
- 手順:
  1. 各 ZIP を展開し、採用するフォントファイルを `assets/fonts/` 配下へ配置。
  2. `@font-face` で 3系統を登録（ブランド見出し / その他見出し / 本文）。
  3. `font-display: swap;` を指定して初期表示の待ちを抑制。
- Google Fonts の `<link>` は最終的に撤去（不要依存を排除）。

### font-family設計
- フォント名ではなく「役割」単位の変数で運用。
- 変数例:
  - `--font-family-heading-brand`
  - `--font-family-heading-sub`
  - `--font-family-body`
  - `--font-weight-heading-brand`
  - `--font-weight-heading-sub`
  - `--font-weight-body`
  - `--line-height-body`
- フォールバックは各役割で明示（例: `sans-serif` を末尾固定）。

### セレクタ設計
- `FRUIT CATCH` 専用適用（ピンポイント）:
  - `.title` 要素へ `data-title-role` を導入。
  - スタート画面時のみ `data-title-role="brand"`。
  - ゲームオーバー時は `data-title-role="sub"` に切替。
- 見出し（その他）:
  - `.pause-title`
  - `.title[data-title-role="sub"]`
- 本文:
  - 上記見出し以外のテキスト要素すべて（HUD、ボタン、説明文、注記、バッジ、数値表示、Canvas 浮遊テキスト）。

### 見出し（その他）と本文の境界ルール（明文化）
- ルールA: `h1/h2` 相当の画面タイトル用途だけを「見出し」とする。
- ルールB: 操作説明、ラベル、ボタン文言、ステータス数値、補足文はすべて「本文」。
- ルールC: Canvas 上の浮遊スコア文字（`ctx.font`）も本文扱いとし、本文フォントへ統一。

## 3. フォント設定の集約案（どこにまとめるか、変数名/クラス名ルール、運用手順）

### おすすめ
- 集約先: 新規 `styles/font-system.css` を作成し、以下を全て集約。
  - `@font-face`
  - 役割トークン（family/weight/line-height）
  - 役割クラスまたは属性セレクタの基準定義
- `index.html` は `font-system.css` → `main.css` の順に読み込む。
- `main.css` 側は「変数参照のみ」に寄せ、実フォント名の直書きを禁止。
- 命名規則:
  - 変数: `--font-(category)-(role)` 形式（例: `--font-family-heading-sub`）
  - 属性: `data-title-role="brand|sub"`
- フォント変更時に触る場所を最小化:
  - 原則 `styles/font-system.css` だけ更新。
  - 例外は「新しい役割を増やす時」のみ `main.css` セレクタ追加。

### 代案
- `styles/main.css` 先頭に `/* Font System */` セクションを新設し、同内容を集約。
- ファイル追加が不要で差分は小さいが、将来の見通しは専用ファイル案より弱い。

### 運用手順
1. 差し替え時はまず `@font-face` の `src` とトークン値を更新。
2. 見た目調整は weight/line-height 変数だけで吸収。
3. 役割追加が必要な場合だけセレクタ層を変更。
4. 変更後に検証項目（本計画の第7章）を必ず実施。

## 4. 作業ステップ（時系列、各ステップの完了条件つき）

1. 事前確認（フォント実体と命名）
- 実施内容: 3 ZIP を展開し、採用ファイル名・内部スタイル名・対応ウェイトを確定。あわせて同梱 `readme` / `license` から配布条件を抽出。
- 完了条件: `poprumcute` / `rounded-x-mplus` / `mgenplus` それぞれで「採用ファイル名 + CSS上の `font-family` 名 + 使用ウェイト + 配布条件」が表で確定。

2. フォント資産配置
- 実施内容: 採用フォントファイルを `assets/fonts/` 配下へ配置、不要ファイルは除外。
- 完了条件: 実装で参照するパスが固定され、`assets/fonts/` の構成が確定。

3. フォントシステム集約ファイル作成
- 実施内容: `styles/font-system.css` に `@font-face` と役割トークンを実装。
- 完了条件: 3役割（brand/sub/body）の family/weight/line-height が1箇所で定義済み。

4. 既存 CSS の役割参照化
- 実施内容: `styles/main.css` の直書きフォント指定を役割トークン参照へ置換。
- 完了条件: `main.css` 内に実フォント名が残っていない（フォールバック名を除く）。

5. FRUIT CATCH 専用適用の導入
- 実施内容: `.title` の状態に応じて `data-title-role` を制御（スタート=brand、ゲームオーバー=sub）。
- 完了条件: スタート時のみブランド見出しフォントが当たり、ゲームオーバーでは当たらない。

6. 本文の統一適用（Canvas含む）
- 実施内容: 本文系要素と `scripts/game.js` の `ctx.font` を本文トークンへ合わせる。
- 完了条件: 画面上の非見出しテキストが全て本文フォント・本文ウェイト・本文行間基準に一致。

7. 不要依存の除去
- 実施内容: Google Fonts の preconnect/link を削除。
- 完了条件: 外部フォント依存がなく、ローカル資産だけで表示成立。

8. ドキュメント更新
- 実施内容: `docs/font-usage.md` に役割定義・変更手順・境界ルールを追記。
- 完了条件: 次回差し替え時に「触る場所」が文書で即特定できる。

## 5. 影響範囲（ファイル単位）
- `index.html`
  - フォント CSS 読み込み順の調整。
  - 外部 Google Fonts リンク削除。
- `styles/font-system.css`（新規）
  - `@font-face`、フォントトークン、役割ベース定義。
- `styles/main.css`
  - 既存 `font-family` / `font-weight` / `line-height` の役割トークン化。
  - `.title` / `.pause-title` と本文要素の境界反映。
- `scripts/ui.js`
  - `.title` の `data-title-role` 切替（スタート画面とゲームオーバー画面）。
- `scripts/game.js`
  - `ctx.font`（浮遊テキスト）の本文フォント化。
- `assets/fonts/*`（新規追加）
  - 展開済みフォントファイル配置。
- `docs/font-usage.md`
  - 運用ルールと変更手順の更新。

## 6. リスクと回避策（フォールバック含む）
- リスク: `poprumcute` の配布条件に合わない公開方法（フォントバイナリ同梱 / Web フォント配信）を選んでしまう。
  - 回避策: 実装前に配布条件を正本（ZIP同梱文書）で確定し、条件に合わない場合は公開版のみ代替フォントへ切替える。
- リスク: ZIP 内ウェイト名と CSS `font-weight` が一致せず、指定太さにならない。
  - 回避策: 事前確認で style 名を固定し、`@font-face` をファイル単位で分割定義。
- リスク: `.title` が画面状態で文言だけ変わるため、ブランドフォントがゲームオーバーへ漏れる。
  - 回避策: 文言判定でなく `data-title-role` で制御。
- リスク: 本文を medium 統一すると一部UIの視認性が低下。
  - 回避策: 境界ルールを維持しつつ、必要最小限の強調箇所のみ別トークン（例: `--font-weight-body-strong`）を定義する判断ゲートを設置。
- リスク: モバイルで行間拡大により要素がはみ出す。
  - 回避策: `line-height` を段階調整（例: 1.45 → 1.52）し、700px未満メディアクエリで再確認。
- リスク: フォント未読込時の表示劣化。
  - 回避策: 各役割にフォールバックを設定し、`font-display: swap` を採用。

## 7. 検証項目（表示崩れ、適用漏れ、weight反映、モバイル確認）
- 表示崩れ:
  - オーバーレイ、一時停止パネル、HUD、ボタンで文字切れ・折返し崩れがない。
- 適用漏れ:
  - `FRUIT CATCH` だけ brand、`一時停止`/`ゲームオーバー` は sub、それ以外は body になっている。
  - Canvas 浮遊テキストが body 指定へ切替済み。
- weight反映:
  - brand=標準、sub=`1p-BLACK`、body=`1pp-medium` が DevTools の Computed で確認できる。
- モバイル確認:
  - 幅 `700px` 以下でテキストの重なり・ボタン高さ不足がない。
  - iOS/Android 相当の表示倍率で可読性が維持される。
- 回帰確認:
  - スタート → プレイ中 → 一時停止 → 再開 → ゲームオーバー → 再スタートの一連フローでフォント状態が正しい。

## 8. 不足情報への質問（必要最小限）
1. `poprumcute` が公開版条件に合わない場合、公開版のみ代替フォントへ切替える方針でよいか？

## 実装依頼用プロンプト
```text
fruits-catch のフォント差し替えを実装して。
要件は以下を厳守:
- タイトル文言は `FRUIT CATCH` 固定。
- FRUIT CATCH 専用見出しは poprumcute（標準）をピンポイント適用。
- その他見出し（一時停止、ゲームオーバー等）は rounded-x-mplus の 1p-BLACK。
- それ以外の本文は mgenplus-1p の 1pp-medium、行間やや広め。
- 見出し境界ルール:
  - 見出し: 画面タイトル用途のみ（FRUIT CATCH / 一時停止 / ゲームオーバー）。
  - 本文: それ以外すべて（HUD、ボタン、説明文、数値、Canvas浮遊テキスト）。
- フォント設定は一元管理にする。
  - 推奨: styles/font-system.css を新規作成し、@font-face と fontトークン（family/weight/line-height）を集約。
  - main.css は実フォント名直書きをやめ、トークン参照だけにする。
- FRUIT CATCH 専用適用方法:
  - .title に data-title-role="brand|sub" を導入。
  - スタート時は brand、ゲームオーバー時は sub へ切替（scripts/ui.js）。
- Google Fonts の外部リンクは削除し、ローカルフォント配布へ統一。
- ZIP内の実ファイル名・ウェイト対応・配布条件は実装前に確認し、採用結果を docs/font-usage.md に記録。
- ライセンス確認の一次参照元は `https://moji-waku.com/mj_work_license/` と ZIP 同梱文書（`readme` / `license`）に固定する。
- `https://moji-waku.com/kenq/kenq_trademark/` は参考リンクとしてのみ扱う。
- ライセンス正本は ZIP 同梱文書を優先し、`assets/fonts/licenses/` へ同梱する。
- `poprumcute` が公開版条件に合わない場合は、公開版のみ代替フォントへ切替える。

変更対象:
- index.html
- styles/font-system.css（新規）
- styles/main.css
- scripts/ui.js
- scripts/game.js
- docs/font-usage.md
- assets/fonts/*（追加）

受け入れ条件:
- スタート画面のタイトルだけ brand フォント。
- ゲームオーバー/一時停止は sub フォント。
- その他テキストは body フォントで統一。
- weight と line-height が指定通り。
- モバイル幅（700px以下）で表示崩れなし。
- 外部フォント依存なし。
```

## フォント差し替え時チェックリスト
- ZIP 内の採用ファイル名とウェイト名を確定した
- `@font-face` と役割トークンを1箇所に定義した
- `.title` の `data-title-role` 切替が動作した
- 本文（Canvas含む）が body フォントに統一された
- モバイル表示とゲーム一連フローの回帰確認を完了した

