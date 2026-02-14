# Suno Prompt Patterns

## 目的
Suno向けの実務プロンプトパターンを再利用可能な形で定義する。

## 事実（一次情報）
- SunoではSimple/Customの2系統で生成導線が提供される。  
  URL: https://help.suno.com/en/articles/2462273
- CustomではLyricsとStyle Promptの分離入力が可能である。  
  URL: https://help.suno.com/en/articles/2415873
- Style Promptは狙う音楽性を明示する主要入力として案内される。  
  URL: https://help.suno.com/en/articles/3726721
- Upload Audio導線とCover導線は別用途として提供されている。  
  URL: https://help.suno.com/en/articles/5782849
- Creative Slidersで生成結果の変化量を調整できる。  
  URL: https://help.suno.com/en/articles/6141569

## 推論（運用パターン）
- 初回はSimpleで方向性を掴み、再現性が必要な段階でCustomに移ると調整がしやすい。  
  根拠URL: https://help.suno.com/en/articles/2462273
- 比較時は変更軸を1-2個に制限すると、改善要因を切り分けやすい。  
  根拠URL: https://help.suno.com/en/articles/6141569

## 実用パターン

### Pattern A: Instrumental loop
テンプレート:
`Instrumental [genre] loop, [mood], [core instruments], [mix adjectives], seamless feel, no vocals`

例:
`Instrumental chill lo-fi loop, calm and focused, warm electric piano and soft drums, clean and low-noise mix, seamless feel, no vocals`

使いどころ:
- 作業用BGMや短尺ループの方向性を素早く作るとき。  
  根拠URL: https://help.suno.com/en/articles/2462273

### Pattern B: Vocal song
テンプレート:
- Lyrics:
  `Verse/Chorusの短い歌詞`
- Style Prompt:
  `[genre], [tempo feel], [vocal tone], [instrumentation], [mix adjectives]`

例:
- Lyrics:
  `City lights fade, we keep moving / ...`
- Style Prompt:
  `modern synth pop, mid-tempo, intimate female vocal, shimmering pads and punchy drums, polished mix`

使いどころ:
- 歌詞とサウンドデザインを分離して詰めたいとき。  
  根拠URL: https://help.suno.com/en/articles/2415873

### Pattern C: Upload transform
テンプレート:
`Use uploaded audio as base, keep [preserve elements], transform toward [target style], [mix target], avoid [undesired artifacts]`

例:
`Use uploaded audio as base, keep rhythm contour and phrasing, transform toward retro electronic pop, cleaner high-end and tighter low-end, avoid hiss and wind-like noise`

使いどころ:
- 入力素材の骨格を残しながら雰囲気だけ変えたいとき。  
  根拠URL: https://help.suno.com/en/articles/5782849

### Pattern D: Cover intent
テンプレート:
`Cover intent: keep [identity], change [mood/arrangement/energy], target [genre], keep lyrics core meaning`

例:
`Cover intent: keep hook melody identity, change to acoustic indie mood, lower energy arrangement, keep lyrics core meaning`

使いどころ:
- 原曲の核を残しつつ、別アレンジを狙うとき。  
  根拠URL: https://help.suno.com/en/articles/5782977

### Pattern E: A/B comparison
手順:
1. ベース案を固定する。  
2. 変更軸を1-2個に限定する（例: Style Prompt語彙のみ変更）。  
3. Slidersを1つだけ変更した派生案を作る。  
4. 比較観点を固定する（ノイズ量/一貫性/狙い一致）。

使いどころ:
- 生成ブレを抑えながら改善を進めたいとき。  
  根拠URL: https://help.suno.com/en/articles/6141569

## アンチパターン
- `曖昧な短文のみ`（例: "good song"）。  
  理由（推論）: 音楽性の制御軸が不足し比較も困難になる。  
  根拠URL: https://help.suno.com/en/articles/3726721
- `LyricsとStyle Promptを混在`させて意図を分けない。  
  理由（推論）: どちらの調整が効いたか判別しにくい。  
  根拠URL: https://help.suno.com/en/articles/2415873
- `Upload/Coverで保持要素を指定しない`。  
  理由（推論）: 保持すべき核が失われやすい。  
  根拠URL: https://help.suno.com/en/articles/5782849

## 不明点（断定しない）
- Slidersの内部アルゴリズムや重みの公開仕様は、Help記事だけでは確認できない。  
  参照URL: https://help.suno.com/en/articles/6141569
