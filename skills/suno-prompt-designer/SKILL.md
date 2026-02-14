---
name: suno-prompt-designer
description: "Suno向けの音楽プロンプトを設計、改善、比較するSkill。Use when asked to create or tune Suno prompts for Simple/Custom generation, lyrics+style design, cover/remix direction, upload-audio transformation, and Creative Sliders (Weirdness/Style Influence/Audio Influence). Trigger examples: 「Sunoのプロンプトを作って」「Sunoで歌詞あり/インストを作りたい」「Style Promptを改善したい」「Creative Slidersを調整したい」「Upload Audioで変換したい」「Coverを作りたい」。"
---

# Suno Prompt Designer

## 使うべき場面（trigger文言）
- 「Sunoのプロンプトを作って」
- 「Sunoで歌詞あり/インストを作りたい」
- 「Style Promptを改善したい」
- 「Creative Slidersを調整したい」
- 「Upload Audioで変換したい」
- 「Coverを作りたい」
- 「Sunoを自動化できるか確認したい」

## 実行手順
1. ユーザー要件を `simple-create` / `custom-create` / `upload-audio` / `remix-cover` / `automation-feasibility` に分類せよ。
2. すべての質問で `references/suno-core.md` を先に読み、公式UI仕様を確認せよ。
3. プロンプト設計・改善が主目的なら `references/suno-prompt-patterns.md` を読み、実例を抽出せよ。
4. 自動化可否やAPI相談がある場合は `references/suno-automation-risk.md` を必ず読み、公式可否を先に確認せよ。
5. 要件を次のスロットに分解せよ。
   - `Goal`
   - `Vocal/Instrumental`
   - `Genre/Era`
   - `Mood/Energy`
   - `Instrumentation`
   - `Mix adjectives`
   - `Structure hints`
   - `Language`
   - `Safety/negative constraints`
   - `Sliders (Weirdness/Style Influence/Audio Influence)`
   - `Upload usage`
   - `Cover intent`
6. `custom-create` では `Lyrics` と `Style Prompt` を分離設計し、両者の役割を明記せよ。
7. `upload-audio` では、入力音で維持する要素と変換したい要素を分離して指示せよ。
8. `remix-cover` では、原曲から変更したい意図（雰囲気/テンポ/編成）を1文で固定せよ。
9. 初回回答は必ず `案A（最短）` `案B（バランス）` `案C（高精度）` の3案を提示せよ。
10. 比較しやすくするため、案間で変更する軸は最大2つまでに制限せよ。
11. 主張は `事実` と `推論` に分離し、事実には必ずURLを付けよ。
12. 不明点は「不明」と明記し、追加ヒアリングは1-3個に限定せよ。
13. `automation-feasibility` では次の順序を強制すること。
    - 公式Docs/Termsで可否確認
    - 非公式ライブラリは `非公式` と明記して注意喚起
    - 公式代替として手動UIフローを提示

## reference読込ルール
- `simple-create`: `references/suno-core.md` -> `references/suno-prompt-patterns.md`
- `custom-create`: `references/suno-core.md` -> `references/suno-prompt-patterns.md`
- `upload-audio`: `references/suno-core.md` -> `references/suno-prompt-patterns.md`
- `remix-cover`: `references/suno-core.md` -> `references/suno-prompt-patterns.md`
- `automation-feasibility`: `references/suno-core.md` -> `references/suno-automation-risk.md`
- 複合質問: `references/suno-core.md` -> `references/suno-prompt-patterns.md` -> `references/suno-automation-risk.md`

## 出力フォーマット
以下の見出し順で出力せよ。

### 1) 要件整理
- 入力要件の要約
- ワークフロー選定（simple-create / custom-create / upload-audio / remix-cover / automation-feasibility）と理由

### 2) 提案プロンプト
- 案A（最短）
- 案B（バランス）
- 案C（高精度）

### 3) 推奨設定（Suno UI）
- mode（Simple / Custom）
- style prompt
- lyrics
- instrumental（on/off）
- weirdness
- style influence
- audio influence
- upload length
- cover/remix intent

### 4) A/B比較手順
- 固定する項目
- 変更する項目（最大2軸）
- 比較観点（音質/一貫性/狙いへの一致）

### 5) 根拠
- 事実: 箇条書き + URL
- 推論: 箇条書き（事実からの解釈を明示）

### 6) 不明点
- 不明または未確認事項
- 追加ヒアリング項目（必要時のみ）

## ガードレール
- 一次情報（公式Help/公式Terms）を優先せよ。
- `steps` `seed` `prompt strength` `input strength` などStable Audio固有パラメータを提案するな。
- 著名アーティストの模倣や権利侵害を誘発する提案を避ける注意を明記せよ。
- 自動化相談では、ToS上のリスクを必ず明記し、手動UI代替を同時提示せよ。
- URLが確認できない主張を事実として断定するな。
- 確認できない事項は「不明」と明記し、推測で補完するな。
- 日本語で説明し、プロンプト例は英語中心で提示せよ。
