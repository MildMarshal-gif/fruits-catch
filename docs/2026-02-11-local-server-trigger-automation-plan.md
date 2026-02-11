# ローカルサーバ起動/停止の定型化プラン（実施版）

## ゴール

- セッション差を減らし、同じ指示で同じ起動/停止挙動を再現する。
- ローカル確認は `127.0.0.1` 固定をデフォルトにする。

## 実装済み成果物

- `scripts/start-local-server.ps1`
- `scripts/stop-local-server.ps1`
- `scripts/local-server-status.ps1`
- `.gitignore`（`.local/` 追加）
- `.codex/skills/local-server-control/SKILL.md`
- `docs/local-server-ops.md`

## 実装内容要約

1. 起動
- `python -m http.server` を実行
- 同一 `port + bind` が既に動いていれば重複起動せず `no-op`
- `./.local/local-server.json` に状態保存

2. 停止
- 状態ファイルの PID を最優先
- PID 無効時のみ `port + bind` 探索
- コマンドライン検証後に停止

3. 状態確認
- `running/stopped` を表示
- `running` 時に `pid/url/port/bind` 表示

## 実装依頼用プロンプト

```text
このリポジトリに、ローカル確認サーバ運用を定型化する仕組みを実装してください。

目的:
- どのセッションでも同じ依頼文で、同じ起動/停止挙動にする
- セキュリティは 127.0.0.1 バインドをデフォルト維持

実装内容:
1) scripts/start-local-server.ps1
- デフォルト Port=8080, BindAddress=127.0.0.1
- python -m http.server を起動
- 重複起動防止
- ./.local/local-server.json に PID/URL 等を書き出し

2) scripts/stop-local-server.ps1
- local-server.json の PID を優先停止
- PID無効時のみ port/bind で探索
- 想定外プロセス停止を防ぐ検証を実装
- 停止後に状態ファイル削除

3) scripts/local-server-status.ps1
- 稼働状態と PID/URL/Port/Bind を表示

4) .gitignore
- .local/ を追加

5) .codex/skills/local-server-control/SKILL.md
- 起動/停止/状態確認のトリガーワードを定義
- 実行時は必ず scripts/*.ps1 を呼ぶように記述

6) docs/local-server-ops.md
- 日次運用手順（起動、停止、トラブル時）を記載

検証:
- start で 200 応答
- start 連打で重複起動なし
- stop で停止
- status が実状態と一致
- デフォルトで外部公開バインドしない
```
