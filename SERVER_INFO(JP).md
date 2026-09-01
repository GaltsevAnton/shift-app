# HannoSHIFT — SERVER_INFO (JP)

技術情報・サーバー設定まとめ（2026-09-01 時点、最終更新済み）

---

## 1) サーバー概要

- **設置場所**: ホテル内の物理サーバー（クラウド/VPSではない）
  ⚠️ 単一障害点のリスクあり（火災・盗難・故障）。バックアップ先の一部が別サーバー（§4参照）＋クラウドにあるため、部分的にリスク軽減済み。ただし両サーバーとも同じ建物内にあるため、建物全体の火災・水害には対応できない。
- **ホスト名**: `hanno-web`
- **OS**: Linux（Ubuntu系、apt/systemd使用）
- **主要ユーザー**: `anadminsrv`（管理作業用アカウント、sudo権限あり）
- **ドメイン**: `hanno-shift.duckdns.org`（DuckDNS 無料ドメイン。crontabで5分ごとにIP更新: `*/5 * * * * ~/duckdns/duck.sh`）
  - 正式ドメインへの移行は現時点で急務ではないため保留（今後必要になれば再検討）

---

## 2) アプリケーション構成

### 2.1 Backend（Spring Boot）
- **場所**: `/opt/shift-app/backend-0.0.1-SNAPSHOT.jar`
- **systemdサービス名**: `shift-app.service`
- **ユニットファイル**: `/etc/systemd/system/shift-app.service`
- **起動ユーザー**: `anadminsrv`
- **外部設定ファイル**: `/opt/shift-app/application.yml`
  （`--spring.config.additional-location=file:/opt/shift-app/application.yml` で読み込み）
- **環境変数（Environment=、ユニットファイル内）**:
  - `APP_JWT_SECRET` — JWT署名用シークレット
  - `MAIL_APP_PASSWORD` — Gmail SMTPアプリパスワード（§5参照）
- **デプロイ手順**（現状の手動フロー）:
  1. ローカルで `mvn clean package`
  2. 生成された jar を `/opt/shift-app/backend-0.0.1-SNAPSHOT.jar` に上書き
  3. `sudo systemctl restart shift-app`
- **ログ確認**: `sudo journalctl -u shift-app -n 100 --no-pager`

### 2.2 Report Service（Python FastAPI）
- **場所**: `/opt/report-service/`
- **構成**: `main.py`, `models.py`, `builders/`（Excelレポートのビルダー群）, `routers/`
- **Python**: 3.12.3
- **仮想環境**: `/opt/report-service/venv`（標準の `venv` で作成）
- **依存パッケージ**（`/opt/report-service/requirements.txt`）:
  ```
  fastapi==0.111.0
  uvicorn[standard]==0.29.0
  openpyxl==3.1.2
  pydantic==2.7.1
  ```
- **systemdサービス名**: `shift-report.service`
- **ユニットファイル**: `/etc/systemd/system/shift-report.service`
  ```ini
  [Unit]
  Description=HannoSHIFT Report Service (FastAPI)
  After=network.target
  [Service]
  User=anadminsrv
  WorkingDirectory=/opt/report-service
  ExecStart=/opt/report-service/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001 --workers 2
  Restart=always
  RestartSec=5
  Environment=PYTHONUNBUFFERED=1
  [Install]
  WantedBy=multi-user.target
  ```
- **ポート**: 8001（`127.0.0.1` のみでリッスン、外部から直接アクセス不可 — backend経由のみ）
- **役割**: Excel レポート生成（勤怠集計表・シフト表・打刻一覧など）
- Spring Boot backend から `report.service.url`（デフォルト `http://localhost:8001`）経由でHTTP呼び出し
- **依存パッケージの更新手順**（必要な場合）:
  ```bash
  cd /opt/report-service
  source venv/bin/activate
  pip install -r requirements.txt --break-system-packages
  ```

### 2.3 Frontend（React / Vite）
- 静的ファイルは nginx 経由で配信（`spring.web.resources.static-locations: file:/var/www/shift-app/`）
- ビルド成果物を `/var/www/shift-app/` に配置する運用（詳細な配置コマンドは別途確認要）

### 2.4 リバースプロキシ（nginx）
- **サイト設定**: `/etc/nginx/sites-available/shift-app`（`/etc/nginx/sites-enabled/shift-app` へのシンボリックリンク）
- **フロントエンド静的ファイルのルート**: `/var/www/shift-app`（index.html + `try_files $uri /index.html` によるSPAルーティング）
- **ルーティング**:
  - `/` → React SPA（index.html）の配信
  - `= /kiosk` → 専用の `kiosk.html`（キオスク画面）
  - `/api/auth/` → `http://localhost:8080/auth/`（backend）へプロキシ。**1分あたり5リクエストのレート制限**（`limit_req zone=auth`）— ログインへの総当たり攻撃対策
  - `/api/` → `http://localhost:8080/`（backendのその他API）へプロキシ
  - `/photos/` → `/var/www/shift-app/photos/` へのalias、`no-cache, no-store` ヘッダー付き（ブラウザキャッシュ無効化）
  - `/manifest.webmanifest`, `/kiosk-manifest.webmanifest` → PWAマニフェスト
- **SSL**: **Certbot / Let's Encrypt** 経由
  - 証明書: `/etc/letsencrypt/live/hanno-shift.duckdns.org/`
  - 自動更新: `certbot renew --dry-run` にて動作確認済み（2026-09-01）
- **セキュリティヘッダー**: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- **HTTP→HTTPSリダイレクト**: ポート80用の別`server`ブロックでhttpsへリダイレクト（Certbotが管理）

---

## 3) データベース

- **DBMS**: PostgreSQL 16
- **DB名**: `shiftapp`
- **マイグレーション管理**: Flyway
  - **本番（prod）**: `flyway.enabled: true`, `baseline-on-migrate: true`, `baseline-version: 5`
    マイグレーションファイル: `classpath:db/migration`（jar内 `V*.sql`）
  - **開発（dev）**: `flyway.enabled: false` — マイグレーションは手動でSQLクライアント経由適用

### 主要マイグレーション履歴（抜粋）
```
V1〜V9   — 初期スキーマ、workplaces、departments、lock、time_records、kana、kiosk、profile
V10      — next_day フラグ（夜勤対応）
V11      — break_rules（休憩ルール）
V12      — break_override_minutes
V13〜V14 — month_status（月次ステータス、半月対応）
V15      — ログインセキュリティ（段階的アカウントロック）
V16      — notification_preferences, notification_settings（メール通知機能）
```

---

## 4) バックアップ

### 4.1 バックアップ（別サーバーのネットワーク共有先）
- **スクリプト**: `/opt/shift-app/backup.sh`
- **実行**: root の crontab、毎日 **03:00 JST**
  ```
  0 3 * * * bash /opt/shift-app/backup.sh >> /var/log/backup-shift.log 2>&1
  ```
- **保存先**: `/mnt/backup-shift/shiftapp_YYYYMMDD_HHMM.sql`（`pg_dump` によるSQLダンプ）
  ⚠️ **重要**: `/mnt/backup-shift/` は `hanno-web` とは**別の物理サーバー**（`\\192.168.1.11\backup_shift`）にマウントされたネットワーク共有です。つまり `hanno-web` 本体が故障・盗難にあっても、DBは失われません。ただし両サーバーとも同じ建物内にあるため、建物全体の火災・水害には対応できません（それには §4.2 のクラウドオフサイトバックアップが必要）。
- **保持期間**: 30日（`find ... -mtime +30 -delete`）
- **ログ**: `/var/log/backup-shift.log`

### 4.2 DBのクラウドオフサイトバックアップ（2026-09-01 追加）
- **方式**: `rclone` 経由で Google Drive にアップロード
- **rclone remote名**: `gdrive`（設定は `anadminsrv` および `root` の両方に配置済み — `~/.config/rclone/rclone.conf`）
- **アップロード先**: Google Drive（アカウント: `hannoshift.notify@gmail.com`）フォルダ `hannoshift-backups`
- **保持期間**: Google Drive側90日（`rclone delete ... --min-age 90d`）
- **実行タイミング**: DBバックアップ直後、同じ `backup.sh` 内で自動実行
- **動作確認**: 2026-09-01 に手動実行してアップロード成功を確認済み

### 4.3 写真データのバックアップ（2026-09-01 追加）
- **元データ**: `/var/www/shift-app/photos/`（キオスク打刻時のスタッフ写真）
- **保存先**: `/mnt/backup-shift/photo/`（DBと同じ `192.168.1.11` 上のネットワーク共有）
- **方式**: `rsync -a --delete` — 新規・変更ファイルのみ同期。本番で削除された写真はバックアップからも削除される（バックアップフォルダは常に最新状態を反映、履歴は残さない方針）
- **実行**: 同じ `backup.sh` 内、DBバックアップ直後
- **Google Driveへは非アップロード** — 意図的な判断。ローカル（ネットワーク共有）のみ

### 4.4 重要設定ファイルのバックアップ（2026-09-01 追加）
- **対象**: `/opt/shift-app/application.yml`, `/etc/systemd/system/shift-app.service`, `/etc/systemd/system/shift-report.service`, `/etc/nginx/sites-available/shift-app`
- **ローカル保存先**: `/mnt/backup-shift/config/`（同じネットワーク共有）、各ファイル最新**10世代**を保持
- **クラウド保存先**: Google Drive の専用プライベートフォルダ `hannoshift-backups-config`（SQLダンプ用フォルダとは分離 — シークレット情報を含むため）、各ファイルの**最新版のみ**保持（毎日上書き）
- **補足**: `application.yml` 自体にはパスワードが直接書かれていません（`${MAIL_APP_PASSWORD}` というプレースホルダーのみ）。実際の値はsystemdユニットの `Environment=` にあります。バックアップされるユニットファイルには実際のシークレット（`APP_JWT_SECRET`, `MAIL_APP_PASSWORD`）が含まれるため、`hannoshift-backups-config` フォルダの取り扱いには注意が必要
- **Google Driveへのアップロード間隔に `sleep 3` を挿入** — Google Drive APIの分間リクエスト制限（`RATE_LIMIT_EXCEEDED`）対策。手動テスト時に複数コマンドを連続実行して実際に遭遇したため対応済み
- **動作確認**: 2026-09-01、`backup.sh` の完全実行でエラーなし、ローカル・クラウド両方にファイル生成を確認

### 4.5 バックアップ対象外のもの
- **ソースコード**（フロントエンド/バックエンド）: Git で管理（GitHub等、開発者側で別途管理）。開発環境（ローカルPC）の `application.yml` はGit管理外 — 本番版のみ `backup.sh` でバックアップ対象
- **SSL証明書**（`/etc/letsencrypt/`）: 個別バックアップなし。サーバー喪失時はCertbotで再発行が必要（§7参照）

### 4.6 バックアップからの復元
✅ **2026-09-01、テスト環境で復元を実施し正常動作を確認済み**（DB・写真）。

```bash
# ローカルダンプからのDB復元
sudo -u postgres psql shiftapp < /mnt/backup-shift/shiftapp_YYYYMMDD_HHMM.sql

# 写真の復元
rsync -a /mnt/backup-shift/photo/ /var/www/shift-app/photos/

# 設定ファイルの復元
cp /mnt/backup-shift/config/application_YYYYMMDD_HHMM.yml /opt/shift-app/application.yml
cp /mnt/backup-shift/config/shift-app.service_YYYYMMDD_HHMM /etc/systemd/system/shift-app.service
cp /mnt/backup-shift/config/shift-report.service_YYYYMMDD_HHMM /etc/systemd/system/shift-report.service
cp /mnt/backup-shift/config/nginx-shift-app_YYYYMMDD_HHMM /etc/nginx/sites-available/shift-app
```

---

## 5) メール通知機能

- **プロバイダ**: Gmail SMTP
- **送信元アカウント**: `hannoshift.notify@gmail.com`（通知専用アカウント、2段階認証有効化済み）
- **認証方式**: アプリパスワード（App Password）
- **SMTP設定**（`application.yml` 共通、dev/prod両方）:
  ```yaml
  spring:
    mail:
      host: smtp.gmail.com
      port: 587
      username: hannoshift.notify@gmail.com
      password: ${MAIL_APP_PASSWORD}
      properties:
        mail:
          smtp:
            auth: true
            starttls:
              enable: true
  ```
- **送信方式**: 非同期（`@Async` + `@EnableAsync`）— キオスクの打刻処理をブロックしない
- **通知の種類**（8種、`NotificationType` enum）:
  1. `LATE_ARRIVAL` — 遅刻
  2. `EARLY_DEPARTURE` — 早退
  3. `FORGOT_CLOCKOUT` — 退勤忘れ（日次バッチ、時刻は設定可能・デフォルト00:00）
  4. `UNSCHEDULED_ARRIVAL` — シフトなし出勤
  5. `ACCOUNT_LOCKED` — アカウント永久ロック
  6. `EMPLOYEE_CREATED` — 新規従業員登録
  7. `EMPLOYEE_DELETED` — 従業員削除
  8. `PASSWORD_CHANGED` — パスワード変更（変更者以外に通知）
- **設定管理**: マネージャーごとに個別設定（`notification_preferences` テーブル、opt-out方式）
- **Gmail送信制限**: 500通/日（現状の使用量では十分な余裕あり）

### Google Drive（`hannoshift.notify@gmail.com` の兼用用途）
同一アカウントを以下でも使用:
- DBバックアップのオフサイト先（§4.2）
- 重要設定ファイルのバックアップ先（§4.4）
無料枠15GB、バックアップファイルは数百KB程度のため長期間問題なし。

---

## 6) セキュリティ

- **JWT認証**: `APP_JWT_SECRET`（systemd Environment変数）
  - 通常ロール: アクセストークン120分
  - KIOSKロール: 長期トークン（約10年、`generateKioskToken()`）
- **CORS許可オリジン**（`SecurityConfig.java`）:
  ```
  http://localhost:5173, http://localhost:4173
  http://192.168.1.19:5173, http://192.168.1.19:4173  （店舗内LAN用）
  https://hanno-shift.duckdns.org
  ```
- **ログイン試行制限**（アプリ層、V15マイグレーション）:
  - 5回失敗 → 10分ロック
  - 10回失敗 → 30分ロック
  - 15回失敗 → 3時間ロック
  - 20回失敗 → 永久ロック（管理者解除必須、メール通知あり）
- **ログイン試行制限**（nginx層）: `/api/auth/` に1分あたり5リクエストのレート制限（§2.4）
- **輸出管理等の外部規制**: 該当なし（内部業務システムのため）

---

## 7) 障害復旧計画（Disaster Recovery）— サーバー障害時の手順

**現状**: バックアップからのDB・写真の復元は **2026-09-01、テスト環境で実施・動作確認済み**。ゼロからサーバー全体を再構築する完全なシナリオ（OS/各サービスのインストール〜nginx〜DNS/SSL）は未実施 — 近日中に試行予定。以下の手順はこれまでのドキュメントに基づく計画。

### 事前に準備しておくべきもの
- [x] `application.yml`・systemdユニット・nginx設定の日次バックアップ — 2026-09-01 に設定完了（§4.4）
- [ ] `hannoshift.notify@gmail.com` アカウントへのアクセス（Google Drive上のDB/写真/設定バックアップ、SMTP送信用Gmail）
- [ ] DuckDNSアカウントへのアクセス（新サーバーのIPをドメインに反映するため）
- [ ] Gitリポジトリ（フロントエンド/バックエンド/report-service）が `hanno-web` に依存せずアクセス可能であること

### 新サーバーでの復旧手順

**1. 基本インストール（Ubuntu/Linux）**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y openjdk-21-jdk postgresql-16 nginx python3 python3-venv python3-pip rsync certbot python3-certbot-nginx
```

**2. データベースの復元**
```bash
sudo -u postgres createdb shiftapp
# /mnt/backup-shift/ が生きていればそこから、
# なければ Google Drive（hannoshift-backups）から最新の.sqlを取得
sudo -u postgres psql shiftapp < shiftapp_最新.sql
```

**3. Backendの復元**
```bash
sudo mkdir -p /opt/shift-app
# 最新のjarを配置（Gitから mvn clean package で再ビルド）
# application.yml をバックアップから復元（Google Drive: hannoshift-backups-config）
# /etc/systemd/system/shift-app.service を作成（内容は §2.1 参照）
# Environment=APP_JWT_SECRET=..., Environment=MAIL_APP_PASSWORD=... を設定
sudo systemctl daemon-reload
sudo systemctl enable --now shift-app
```

**4. Report Serviceの復元**
```bash
sudo mkdir -p /opt/report-service
# Gitからコードを取得
cd /opt/report-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt --break-system-packages
deactivate
# /etc/systemd/system/shift-report.service を作成（内容は §2.2 参照）
sudo systemctl daemon-reload
sudo systemctl enable --now shift-report
```

**5. フロントエンドの復元**
```bash
# Gitからフロントエンドをビルド（npm run build）し /var/www/shift-app に配置
sudo mkdir -p /var/www/shift-app
# 写真の復元（/mnt/backup-shift/photo/ が生きていれば）:
rsync -a /mnt/backup-shift/photo/ /var/www/shift-app/photos/
```

**6. nginxの復元**
```bash
# /etc/nginx/sites-available/shift-app をバックアップから復元（§2.4、§4.4参照）
sudo ln -s /etc/nginx/sites-available/shift-app /etc/nginx/sites-enabled/shift-app
sudo nginx -t
```

**7. DNSとSSL**
```bash
# DuckDNSを新サーバーのIPに更新（Web管理画面 or duck.shスクリプト経由）
sudo certbot --nginx -d hanno-shift.duckdns.org
sudo systemctl reload nginx
```

**8. バックアップ体制の復元**
```bash
# root の crontab に backup.sh + スケジュールを設定（§4.1参照）
# rclone を再設定（rclone config、remote名 "gdrive"、§4.2参照）—
# または ~/.config/rclone/rclone.conf をバックアップから復元
```
2026-09-01以降、`application.yml`・各ユニット・nginx設定の最新版は常に
Google Drive（`hannoshift-backups-config`）にあるため、手順3・4・6では
記憶に頼らずそこからダウンロードして復元可能。

**9. 最終確認**
- [ ] `https://hanno-shift.duckdns.org` が開けるか — フロントエンド確認
- [ ] マネージャーでログインできるか — backend/DB確認
- [ ] Excelレポートが生成できるか — report-service確認
- [ ] `/kiosk` を開き、テスト打刻ができるか — 写真保存確認
- [ ] テストメールが届くか（通知を意図的に発生させる）
- [ ] `backup.sh` が手動実行でエラーなく動くか

### 今後、この作業をもっと速くするために
- 手順1〜2を単一のbashスクリプト（`provision.sh`）にまとめ、手作業をなくす
- backend + report-service + nginx を Docker/docker-compose 化 —「新サーバーを立てる」作業を `docker compose up` 一発に近づける
- `application.yml`・ユニットファイル・nginx設定を、コードとは別のプライベートGitリポジトリでも管理（シークレットを含むため分離）— 単一ファイル・単一PCへの依存をなくす

---

## 8) 既知の課題・今後の対応事項

- [x] `application.yml`（本番）のバックアップ — 実装済み、`hanno-web` 以外（ローカル・Google Drive）に保存（§4.4）
- [x] バックアップからの復元 — **2026-09-01、テスト環境で確認済み**、DB・写真とも正常に復元可能
- [x] nginx / systemdユニット / application.yml の `hanno-web` 外への保存 — 実装済み（§4.4）
- [x] Certbot SSL証明書の自動更新確認（`certbot renew --dry-run`）— 正常動作確認済み
- [x] キオスクのネットワーク断対応 — 2026-09-01 実装・テスト済み（接続状態インジケーター、自動リトライ、自動リロード）、良好に動作
- [ ] 障害復旧計画（§7）の**完全な**通し試行 — DB/写真の復元は個別に確認済みだが、「ゼロから完全構築」のシナリオ全体（OS〜各サービス〜nginx〜DNS/SSL）はまだ通しで試していない。近日中に実施予定
- [ ] DuckDNS無料ドメインの制約 — 現時点で急ぎの課題ではないため保留、必要になれば再検討

---

*このファイルは会話ログをもとに作成した現状記録です。今後の変更（デプロイ方法変更、DB移行、新しいバックアップ先の追加など）は都度このファイルに追記してください。*