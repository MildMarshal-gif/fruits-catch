# Opus 4.6 vs Sonnet 4.5 - 性能比較データ

このファイルは、Opus推奨の判定に使用するベンチマークデータと実例を整理したものだ ☆

## ベンチマーク比較

### SWE-bench Verified（ソフトウェアエンジニアリング）

| モデル | スコア | 差 |
|---|---|---|
| Opus 4.6 | 80.9% | - |
| Sonnet 4.5 | 77.2% | -3.7pt |

**分析**: わずか3.7ポイントの差。通常のコーディングタスクではSonnetで十分。

### ARC-AGI-2（新規問題への推論）

| モデル | スコア | 差 |
|---|---|---|
| Opus 4.6 | 37.6% | - |
| Sonnet 4.5 | 13.6% | **-24pt（約3倍）** |

**分析**: Opusが圧倒的に優位。未知の問題、前例のないアルゴリズム、独自の設計が必要なタスクでOpusの真価が発揮される。

### Terminal-Bench 2.0

| モデル | スコア |
|---|---|
| Opus 4.6 | **トップ** |
| Sonnet 4.5 | - |

### Humanity's Last Exam

| モデル | スコア |
|---|---|
| Opus 4.6 | **トップ** |
| Sonnet 4.5 | - |

## 速度とコスト

### 処理速度

| モデル | トークン/秒 | 相対速度 |
|---|---|---|
| Sonnet 4.5 | 54.84 | - |
| Opus 4.6 | 38.93 | **-41%遅い** |

### 料金（2026年2月時点）

| モデル | 入力（$/MTok） | 出力（$/MTok） | 相対コスト |
|---|---|---|---|
| Sonnet 4.5 | $3 | $15 | - |
| Opus 4.6 | $5 | $25 | **入力1.7倍、出力1.7倍** |

**結論**: Opusは遅くて高い。本当に必要な時だけ使うべき。

## 実例

### Opus 4.6で作成されたもの

#### 1. Claude's C Compiler (CCC)

- **内容**: Rustで書かれた完全なCコンパイラ
- **コード量**: 100%がOpus 4.6によって生成
- **特徴**:
  - 4つのアーキテクチャ対応（x86-64, i686, AArch64, RISC-V 64）
  - ELFバイナリ生成、依存関係なし
  - **Linuxカーネルをコンパイル可能**
  - PostgreSQL、SQLite、Redis、DOOM等150+プロジェクトをコンパイル成功
- **スター数**: 2.1k
- **なぜOpus?**:
  - 複雑なコンパイラアーキテクチャ設計
  - マルチターゲット対応
  - 最適化パス実装
  - 前例のない大規模システム設計

**出典**: [GitHub - anthropics/claudes-c-compiler](https://github.com/anthropics/claudes-c-compiler)

### Sonnet 4.5で作成されたもの

#### 1. Slack風チャットアプリ

- **内容**: Slack/Teams風のチャットアプリ
- **コード量**: 11,000行
- **稼働時間**: 30時間連続自律稼働
- **特徴**:
  - リアルタイム通信
  - ユーザー認証
  - チャンネル管理
  - データベース統合
  - デプロイ設定
- **なぜSonnet?**:
  - 長時間の安定稼働が必要
  - 定型的な機能実装中心
  - コスト効率重視

**出典**: [Anthropic's Claude Sonnet 4.5 codes for 30 hours straight](https://www.techbuzz.ai/articles/anthropic-s-claude-sonnet-4-5-codes-for-30-hours-straight)

#### 2. Mancalaゲーム

- **内容**: 完全に機能するMancalaウェブアプリ
- **開発時間**: 25秒
- **特徴**: Claude Artifacts使用、ワンテイクで完成

**出典**: X (Twitter) - [@mikeyk](https://x.com/mikeyk/status/1803828547309466038)

## ハイブリッド戦略（参考）

### Claude Router

- **アプローチ**: クエリの複雑度に応じてHaiku/Sonnet/Opusを自動選択
- **振り分け基準**:
  - **Haiku**: "What is JSON?" "Fix this typo"
  - **Sonnet**: "Run all tests"
  - **Opus**: "Design architecture"
- **コスト削減**: 最大80%

**出典**: [GitHub - 0xrdan/claude-router](https://github.com/0xrdan/claude-router)

### opusplan（廃止済み）

- **アプローチ**: プランモードでOpus、実行モードでSonnet
- **状態**: Claude Code v2.0.0で削除
- **問題**: GitHub Issue #8358で79人が復活を要望中

**出典**: [GitHub Issue #8358](https://github.com/anthropics/claude-code/issues/8358)

## エンタープライズ事例

| 企業/プロジェクト | モデル | タスク | 成果 |
|---|---|---|---|
| **TELUS** | Claude | Fuel iXプラットフォーム | 57,000従業員が利用 |
| **Tech Debt削減** | Claude Code | 200ファイルのリファクタリング | Docker画像サイズ削減 |
| **IoT + AWS** | Claude Code | セルラーIoT + データレイク | 1週間で完成 |

## 結論

### Opusを使うべき時

- **新規問題への推論が必要**: ARC-AGI-2で3倍の性能差
- **前例のない設計**: Cコンパイラのような大規模システム
- **複雑なアルゴリズム**: 既存パターンに当てはまらない独自実装
- **セキュリティ監査**: 高度な推論と多角的な視点が必要

### Sonnetで十分な時

- **通常のコーディング**: SWE-benchで3.7ptしか差がない
- **定型的な実装**: 既存パターンの踏襲
- **長時間稼働**: 30時間連続でも安定
- **コスト重視**: 約40%安い

### 判定の原則

**疑わしい場合はSonnetを使え。Opusは本当に必要な時だけだ ♡**
