# HannoSHIFT — CHANGELOG

Лог изменений по дням разработки.
# HannoSHIFT — CHANGELOG

ログ変更履歴。

## 2026-09-26 (продолжение) — RBAC: кастомные роли и точечные права доступа

> ⚠️ Часть этой функции (V18 sort_order на users, V19 audit_log, и, возможно, начало V20) была сделана в параллельном чате и попала в проект без подробностей — здесь зафиксировано то, что делалось непосредственно в этом чате (User.customRole → SecurityConfig → @PreAuthorize по контроллерам → RoleController/PermissionController), плюс то, что удалось восстановить по коду для V18/V19. См. `PROJECT_CONTEXT.md` §3.13/§3.14/§4 для полной картины и списка открытых задач.

### Миграция `V20__add_roles.sql`
- `roles(id, restaurant_id, name, created_at)`, UNIQUE(restaurant_id, name)
- `role_permissions(role_id, permission)` — составной PK, ON DELETE CASCADE
- `users.custom_role_id` → `roles(id)` ON DELETE SET NULL
- Бэкфилл: на каждый ресторан создаётся роль "フルアクセス" со всеми `Permission`, назначается всем существующим `MANAGER` (без этого шага после миграции все менеджеры остались бы без единого точечного права)

### Backend — новый пакет `com.shiftapp.roles`
- `Role.java` (entity), `Permission.java` (enum: `SHIFT_VIEW`, `ATTENDANCE_VIEW/EDIT/DELETE`, `EMPLOYEE_VIEW/CREATE/EDIT/DELETE`, `WORKPLACE_VIEW/CREATE/EDIT/DELETE`, `POSITION_VIEW/CREATE/EDIT/DELETE`, `DEPARTMENT_VIEW/CREATE/EDIT/DELETE`, `BREAK_RULE_VIEW/CREATE/EDIT/DELETE`, `NOTIFICATION_VIEW/EDIT`, `LOGGING_VIEW`)
- `RoleRepository`, `RoleService`, `RoleController` (`/api/manager/settings/roles`, полный CRUD)
- `PermissionController` (`/api/manager/settings/permissions`, `GET` → список всех значений enum, для построения чекбоксов на фронте)
- Оба контроллера — `@PreAuthorize("hasRole('ADMIN')")` на уровне класса. Осознанно НЕ через `Permission`: иначе пользователь с правом «редактировать роли» мог бы сам себе выдать любые права

### Backend — привязка роли к пользователю
- `User.java` — новое поле `customRole` (`@ManyToOne(LAZY)`, `custom_role_id`, nullable)
- `UserRepository.findByLoginWithCustomRole(login)` — `LEFT JOIN FETCH customRole LEFT JOIN FETCH customRole.permissions`, чтобы не ловить `LazyInitializationException` при чтении прав сразу после логина
- `CustomUserDetailsService.loadUserByUsername()` — переключён на `findByLoginWithCustomRole`
- `CustomUserDetails.getAuthorities()` — теперь возвращает:
  - `ROLE_<UserRole>` всегда (для `hasRole`/`hasAnyRole`, как раньше)
  - плюс: `ADMIN` → все `Permission.values()`; иначе, если назначена `customRole` → её `permissions`; если `customRole == null` — точечных прав нет вовсе (осознанное решение, не fallback на «всё разрешено»)

### SecurityConfig.java
- `/api/manager/**`: `hasRole("MANAGER")` → `hasAnyRole("MANAGER", "ADMIN")` (роли в Spring Security не наследуются — без этой правки `ADMIN` не проходил бы вообще)
- Решение по архитектуре: базовый периметр остаётся на уровне URL (грубо, по роли), а точечные права — только на уровне методов контроллеров через `@PreAuthorize("hasAuthority('...')")` (`@EnableMethodSecurity` был включён и раньше)

### `@PreAuthorize` расставлены по всем manager-контроллерам
- `AttendanceController` → `ATTENDANCE_VIEW`/`EDIT`/`DELETE`
- `AuditLogController` → `LOGGING_VIEW`
- `MonthStatusController`, `ManagerShiftController` (bulk/list/copy-week/delete), `ManagerWeekStatusController`, `ManagerPreferenceController` → все на `SHIFT_VIEW` (в `Permission` нет отдельных `SHIFT_EDIT/CREATE/DELETE` — решение объединить их под одним правом, а не заводить новые значения enum)
- `NotificationPreferenceController`, `NotificationSettingsController` → `NOTIFICATION_VIEW`/`NOTIFICATION_EDIT` (было `hasAnyRole('MANAGER','ADMIN')`)
- `BreakRuleController` → `BREAK_RULE_VIEW`/`CREATE`/`EDIT`/`DELETE`
- `DepartmentController` → `DEPARTMENT_VIEW`/`CREATE`/`EDIT`/`DELETE` (`reorder` → `EDIT`)
- `PositionController` → `POSITION_VIEW`/`CREATE`/`EDIT`/`DELETE`
- `WorkplaceController` → `WORKPLACE_VIEW`/`CREATE`/`EDIT`/`DELETE`
- `ManagerUserController` (employees) → `EMPLOYEE_VIEW`/`CREATE`/`EDIT`/`DELETE` (`unlock` → `EDIT`)
- `ReportController` — не тронут, остался `hasAnyRole('MANAGER','ADMIN')` (в `Permission` нет отдельного права под отчёты)

### Открытые задачи (следующий шаг, ещё не сделано)
1. `UserCreateRequest`/`UserUpdateRequest`/`UserResponse`/`UserService` — добавить `customRoleId`, сейчас через API роль сотруднику не назначить
2. Frontend: страница **設定 → 権限** (видна только `ADMIN`) — CRUD ролей, чекбоксы по `Permission`, сгруппированные по категориям
3. Frontend: `EmployeesPage.jsx` — select `customRoleId` в форме сотрудника
4. `api.js` — `settingsRolesList/Create/Update/Delete`, `settingsPermissionsList`

---

## 2026-09-26 — Audit Log (миграция `V19__add_audit_log.sql`)

> Сделано до начала этого чата (в параллельном чате) — здесь зафиксировано по факту наличия в коде, полные детали `AuditAction`/`AuditEntityType`/`AuditLogService` не были получены в этом чате, см. `PROJECT_CONTEXT.md` §3.14.

- Таблица `audit_log` — универсальный лог действий менеджеров/админов: кто (`actor_user_id`/`actor_name`), что сделал (`action`, `entity_type`, `entity_id`), над кем (`target_user_id`/`target_user_name`), человекочитаемое `summary` + технические `details`
- Индексы: `(restaurant_id, created_at DESC)` — для выборки по периоду, `target_user_id`, `entity_type`
- `AuditLogController.search()` — `GET /api/manager/audit-log?from=&to=&targetUserId=&entityType=`
- Используется, например, из `MonthStatusController.setStatus()` — пишет запись при каждой фактической смене статуса месяца/половины месяца (сравнивает old/new, no-op не логирует)

## 2026-09-26 — Сортировка сотрудников (миграция `V18`)

> Также сделано до начала этого чата — зафиксировано по коду (`User.sortOrder`, `UserRepository.existsByRestaurant_IdAndSortOrder(...)`), точный SQL и имя файла в этом чате не были получены.

- `sort_order` INT на `users` — аналогично `V17` (departments), задаёт порядок отображения сотрудников

---

## 2026-09-24 〜 2026-09-26

### キオスク — 新デザイン（スマートフォン・タブレット・モニター）

- **スマートフォン**
  - ヘッダー刷新: ☰ / HannoSHIFT（中央）/ Wi-Fi の細線SVGアイコン、日付と時刻を中央1行表示（秒なし）
  - 左の縦カタカナ列を廃止 → ヘッダー直下に横スクロールの文字バー（`MobileKanaBar`、スクロール時も固定、右端に `›`）
  - スタッフ一覧: 4列グリッド、隙間2px、写真の高さは固定（CSS変数 `--kiosk-photo-h`、`.mGrid`）
  - 出勤時刻バッジ: 写真左上に半透明の小さなバッジ（● + 時:分、勤務中=緑、休憩中=オレンジ）
  - Wi-Fiアイコンをタップ → 「接続あり/接続なし」の小さなツールチップ（2秒で消える。旧OKボタン付きモーダルは廃止）
  - ☰メニューを新スタイルに（ユーザーアイコン＋出勤中N人、ログアウトアイコン）
- **打刻ポップアップ（スマホ・タブレット共通の新デザイン）**
  - カメラ: 角丸、点線の楕円、左下に氏名、右上に✕、出勤済みなら左上に出勤時刻バッジ
  - 日付・時刻（左寄せ）、本日の打刻一覧、2×2のアイコン付きボタン、枠線のみの「× キャンセル」
  - タブレットはカメラ左・パネル右の横並び、確認画面は中央1カラム（写真4:3）
  - 確認画面: カメラアイコン＋「写真を確認してください」、写真、時刻、✓付きの大きな確定ボタン
  - ボタン色変更: 出勤=緑 `#17935f`、復帰=青 `#3b6fd4`（退勤=赤、休憩=オレンジは変更なし）
  - 撮影写真を左右反転して保存（カメラのプレビューと同じ向き）
- **タブレット**: ヘッダー刷新（細線アイコン、時刻は大きく秒は小さく、「出勤中 N人」はテキストのみ）、スタッフ一覧は5列、縦向きではヘッダーをコンパクト表示（`@media (max-width: 1100px)`）
- **モニター**: 1920px以上で8列、2560px以上で10列
- **スタイルを `KioskPage.module.css` に分離**（CSS Modules、インラインスタイルを廃止）。接頭辞: `t*`=タブレット、`m*`=スマホ、`p*`=ポップアップ共通、`s*`=スタッフカード

### キオスク — パフォーマンス最適化

- **Backend**
  - 新エンドポイント `GET /api/kiosk/statuses?restaurantId=` — 全スタッフのステータスを1リクエストで返す（`{ userId: StaffStatusResponse }`）。従来は1人1リクエスト（48人で49リクエスト／30秒）
  - `KioskService.getStatus()` — 従来はスタッフの**全履歴**を読み込んでいた（`findByUser_IdOrderByRecordedAtAsc`）。軽量クエリに置き換え（最後のCLOCK_IN/CLOCK_OUT時刻の集計＋開いているシフトの記録／本日の記録のみ）。判定ロジックは従来と完全に同一（ランダムデータ2880件＋打刻300シナリオで一致を確認）
  - `punch()` — 全履歴の読み込み3回（ステータス確認・`workDate`・`checkAndNotify`）を軽量クエリに置き換え
  - `getStaffList()` — 部署を一括取得（`UserRepository.findAllWithDepartmentsByRestaurantId`、`@EntityGraph`）、1人ごとの追加クエリを解消
  - 新規 `KioskRecordRow.java`（record）— ステータス計算用の軽量な行（userId, recordType, recordedAt, workDate, photoPath）
  - `TimeRecordRepository` に追加: `findLastRecordedAtByUserIds`, `findRowsSince`, `findRowsByUserIdsAndWorkDate`, `findFirstByUser_IdAndRecordTypeOrderByRecordedAtDesc`
  - `SecurityConfig` — `/api/kiosk/statuses` をKIOSKロールに追加
- **Frontend**
  - ステータス取得を1リクエストに（サーバーが未対応の場合は自動的に旧方式へフォールバック）。一部リクエスト失敗時は前回のステータスを保持（「未出勤」に誤表示されない）
  - 画面が非表示の間はポーリング停止、復帰時に即時更新
  - 打刻成功後、ポップアップを即座に閉じ、カードを即時更新（サーバーのステータスはバックグラウンドで取得、写真はプリロードしてちらつき防止）
  - カメラ: アプリ全体で1つのストリームを共有、ポップアップを閉じても60秒間は起動したまま（次の人はすぐに撮影可能）、画面非表示で即停止、スリープ復帰時に自動再起動。**不具合修正**: カメラ起動前にポップアップを閉じるとカメラが起動したままになっていた
  - 毎秒の全画面再描画を廃止: 時計を独立コンポーネントに（スマホは1分ごと）、`React.memo`/`useMemo`、変化のないデータは再利用
  - JPEGエンコードを非同期化（`toBlob`）、カード写真に `loading="lazy"`
  - ポップアップ背景の `backdrop-filter: blur` を廃止（低性能端末で重いため、代わりに背景を少し暗く）
  - `main.jsx` — `React.lazy` でコード分割（キオスクはマネージャー画面のコードを読み込まない）。`globals.css` は従来どおり最後に読み込み、CSSの順序を維持
- **計測結果**: 更新1回あたりのリクエスト 49→2、DB読み込み行数 約6250→約230（従来は日数に比例して増加）、アイドル時のCPU（低性能端末想定）スマホ 256ms→0ms／タブレット 258ms→68ms（10秒あたり）、打刻後にポップアップが閉じるまで 約950ms→約150ms（低速回線）

---

## 2026-09-23

### 勤怠管理 — Excelレポートを1つに統合

- 従来の3種類（勤怠集計表（実績）、打刻一覧、表示中の勤怠集計表）のドロップダウンメニューを廃止
- 画面に表示中のデータ（フィルター・期間を反映）をそのまま出力する「📥 Excel」ボタン1つに統合
- 対象範囲・対象スタッフは常に画面上でフィルタリング中のもの — 旧「表示中の勤怠集計表」と同じロジックを継続使用
- 目的: 複数の似た名前のレポートでスタッフが混乱していたため、シンプルに一本化

### 勤怠管理 — Excel/カレンダーの出退勤丸めロジックを統一

- **不具合**: Excelレポート（勤怠集計表・打刻一覧・表示中の勤怠集計表）では、出退勤時刻が予定に「吸着」される古いロジックのままだった（例: 予定10:00、実際7:45の出勤でも「10:00」と表示）。カレンダー・リスト画面（09/11対応）は実際の打刻を丸めて表示するよう既に修正済みだったが、Excel側の`ReportService.computeSessionOfficial()`だけ未修正だった
- **修正**: `officialClockIn`/`officialClockOut`を、予定との比較で分岐せず常に実際の打刻の丸め値（出勤は30分単位で切り上げ、退勤は切り下げ）を使うよう変更。`lateIn`/`earlyOut`（色分け判定用フラグ）は引き続き予定との比較で算出 — 表示する時刻の計算と、遅刻/早退の判定ロジックを分離
- これにより`実働時間`（`workMinutes`）も自動的に実際の値になる（`officialOut − officialIn`から算出されるため）

### 勤怠管理 — 打刻記録の編集不具合を2件修正

- **タイムゾーンのバグ**: `編集`フォームを開く際に`toISOString()`でUTC時刻を表示していたため、実際は09:30の打刻でも「00:30」と表示されてしまい、時刻を直接保存すると9時間ズレる不具合があった（種別→時刻→保存を繰り返し試すことで結果的に補正されていたため発覚が遅れていた）
  - `toJstDatetimeLocal(iso)` / `fromJstDatetimeLocal(value)` を新設 — JST基準で明示的に変換（ブラウザのタイムゾーン設定に依存しない、`+09:00`固定）
- **保存後にモーダルへ反映されない不具合**: `編集`で時刻や種別を保存しても、開いたままの詳細ポップアップの表示は更新されず、閉じて開き直す必要があった
  - 保存APIのレスポンスを`detailPopup.dayRecords`へ即時反映するよう修正（削除機能と同じパターン）

---

## 2026-09-11

### キオスク — 部署の表示順を設定可能に

- **背景**: スタッフ一覧で「全員（All）」を選択した際に、部署がバラバラに混在して表示されていた
- `departments`テーブルに`sort_order`カラムを追加（`V17__add_department_sort_order.sql`、初期値は既存の`id`）
- **Backend**
  - `Department.java` — `sortOrder`フィールド追加
  - `DepartmentRepository` — `findAllByRestaurant_IdOrderBySortOrderAsc`、`countByRestaurant_Id`を追加
  - `DepartmentService` — `list()`は`sortOrder`順に変更、`create()`で新規部署は末尾（`countByRestaurant_Id`の位置）に自動配置、新規`reorder(restaurantId, orderedIds)`で並び替え保存
  - `DepartmentController` — `PUT /api/manager/settings/departments/reorder`エンドポイント追加
  - `KioskService.getStaffList()`新設 — スタッフ一覧の取得・並び替えをコントローラからサービス層に移動（`departments`が遅延ロードのため、トランザクション内で読む必要がある）
    - 複数部署に所属するスタッフは、所属部署のうち`sortOrder`が最も小さい（優先順位が最も高い）部署のグループに表示される
    - 部署なしのスタッフは末尾グループに表示（除外はされない）
  - `KioskController` — `getStaffList()`を`KioskService`に委譲するだけに簡素化
- **Frontend**
  - `api.js` — `settingsDepartmentsReorder(orderedIds)`を追加
  - `SettingsPage.jsx`「部署」タブに↑↓ボタンを追加、クリックで即座にサーバーへ並び替えを保存（オプティミスティック更新、失敗時はロールバック）。`MasterPanel`に`onMove`propを追加（他の設定タブには影響なし）
  - `KioskPage.jsx`は変更なし — `.filter()`は配列の順序を保持するため、バックエンド側で順序を制御するだけでキオスク画面（全員／カタカナ絞り込みいずれも）に自動反映される設計

### 勤怠管理（リスト）— 列の全面見直し・4列追加

- 新規列: **出勤時刻**（実際の出勤打刻を30分単位で切り上げ）、**出勤前残業時間**（予定出勤−出勤時刻）、**退勤時刻**（実際の退勤打刻を30分単位で切り下げ）、**退勤後残業時間**（退勤時刻−予定退勤）
- **残業時間（合計）** = 出勤前残業時間 + 退勤後残業時間（両方0の場合は「-」表示）。予定（シフト）がない日はこれら3列とも「-」表示
- 列名をより自然な日本語表現に変更: `出勤日付（予定/実際）`→`出勤日（予定/実際）`、`出勤時間（予定/実際）`→`出勤時刻（予定/実際）`、`退勤`側も同様、`休憩開始/終了`→`休憩開始時刻/休憩終了時刻`
- `勤務時間（実際）`→**`拘束時間`**、`勤務時間（予定）`→**`実働時間`**、`残業時間`→**`残業時間（合計）`**に変更
  - `拘束時間` = 出勤時刻（丸め後）〜退勤時刻（丸め後）の総時間（休憩を含む、差し引かない）
  - `実働時間` = 拘束時間 − 休憩時間（実績）（実打刻優先、なければ`officialBreakMinutes`にフォールバック）
  - 一般的な労務用語の定義（拘束時間 ≥ 実働時間、差分＝休憩）に統一
- 列の並び順を「出勤日→出勤時刻→出勤前残業時間→退勤日→退勤時刻→退勤後残業時間→拘束時間→休憩→実働時間→残業時間（合計）→シフト」の流れに整理
- Excel（`attendance_sessions.py`）・画面（`AttendancePage.jsx`）の両方に同じ列構成・計算式を反映（`ReportService`側に`roundedClockIn`/`roundedClockOut`/`inOvertimeMinutes`/`outOvertimeMinutes`を追加）

### 勤怠管理（カレンダー）— 出退勤時刻の表示不具合修正

- **不具合**: 実際より早く出勤した場合、実際の時刻ではなく予定時刻がそのまま表示されていた（例: 予定10:00、実際7:45でも「10:00」と表示）
- 各セルの出勤/退勤表示を、リストと同じ丸めロジック（実打刻ベース、出勤は切り上げ・退勤は切り下げ）に統一
- 各日のマスに「拘束」の行を追加（表示順: 出勤→退勤→拘束→休憩→実働）
- 合計時間列・セル内の時間表記フォーマットを統一

### 勤怠管理 — 打刻記録の削除・種別変更機能を追加

- スタッフの取り違え等で重複した打刻記録が発生するケース（例: 他のスタッフが誤って退勤打刻し、本人が来て再度出退勤し直した結果、記録が4件に増える）に対応
- 詳細ポップアップの各打刻記録に「削除」ボタンを追加（`DELETE /api/manager/attendance/{id}`、`AttendanceController`に新設）。写真ファイル自体は削除しない（実害が小さいため対象外と判断）
- `編集`フォームに「種別」セレクトを追加 — 時刻だけでなく出勤／退勤／休憩開始／休憩終了の種別自体も修正可能に（`AttendanceEditRequest.recordType`追加）

### 勤怠管理（リスト）— 並び替え・検索・期間選択の改善

- リスト画面で機能していなかった旧・並び替えバー（氏名/職種・役職/部署、カレンダー用の`sortConfig`を誤って共用していた）を削除
- 各列見出しをクリックすることでその列を基準にソートできるように変更（対応列: 申請者、出勤日（予定/実績）、出勤前残業時間、退勤日（予定/実績）、退勤後残業時間、残業時間（合計）のみ — 意味のある列に限定）
- 「申請者」の絞り込みメニューを拡大（250×500px）、氏名検索欄を追加（`CheckDropdown`に`searchable`/`panelWidth`/`panelHeight`propを追加、他タブには影響なし）
- 期間選択に「日」単位を追加（`月|週|日|期間`） — 特定の1日だけを選んでスタッフ全員の打刻状況を素早く確認可能に（リスト専用、カレンダー側の月/週/期間には影響なし）
- 「申請者」で選択したスタッフの状態がページ再読み込み後もリセットされないよう`localStorage`（`attListFilterStaff`）に保存

---

## 2026-09-09
 
### キオスク — スマートフォン対応の続き（スタッフ一覧・打刻画面）
 
- **左サイドバー（カタカナフィルター）** — 幅を`isMobile ? 48 : 68`pxに（タブレットは変更なし）
- **スタッフ一覧グリッド** — `display: flex` → `display: grid`（mobile時）、`repeat(auto-fill, minmax(100px, 1fr))`、gap 2px（縦横とも）
  - `StaffCard`に`isMobile`propを追加：写真100×100px、氏名フォント12px（`white-space: nowrap` + `text-overflow: ellipsis`で1行固定）
- **出勤時刻バッジ**（カードの写真上部）
  - 秒を非表示に（`formatTimeShort()`新設、`hour/minute`のみ）
  - `top: 5px` → `top: 0`（上端に密着）
  - フォントサイズ`isMobile ? 12 : 14`
- **PunchPopup（打刻画面）モーダル**
  - サイズを`calc(100vw - 24px)` × `calc(100dvh - 24px)`に（ほぼ全画面、上下左右に小さい余白）
  - カメラエリアを`flex: 1`に変更し、モーダルが大きくなった分の余白を自動でカメラ表示に充てるように
  - 出勤/退勤/休憩/復帰ボタンの高さは変更なし（200px）
  - スマートフォンでは画面外タップで閉じられないため、ボタン群の下に高さ40px・フォント14pxの「キャンセル」バーを追加（ユーザー自身で微調整）
- **確認画面（写真＋確定/キャンセル）**
  - 日付・時刻表示（`PopupClock`）を再度表示するよう修正（誤って削除していたものを復元）
  - ボタンをスマートフォンでは縦並びに変更、確定ボタンを上・キャンセルを下に配置
  - モーダルの高さいっぱいに引き伸ばさず、内容に応じて中央表示に調整
- 上記対応はすべてタブレット表示に影響なし（`useIsMobile()`フック、breakpoint 768px、常に条件分岐で分離）
- ⚠️ スマートフォン対応は継続中、今後も細部の調整予定
---
 
## 2026-09-06
 
### キオスク — スマートフォン対応デザインの開始
 
- **背景**: 出張中・退勤時間帯に事務所へ戻れないマネージャー等が、スマートフォンから出退勤を打刻できるようにするため。タブレット表示はこれまで通り変更なし。
- `useIsMobile()`フック新設（`window.innerWidth <= 768`で判定、リサイズ監視）
- **ヘッダー**（mobile）: 3カラムgrid（☰ 左 / HannoSHIFT 中央 / 📶 右）、日付（26px）・時刻（18px）を別行で左寄せ表示、更新ボタン非表示、出勤中カウントを☰メニュー内に移動
- **スタッフ一覧**: カードを中央揃えに（`justifyContent: center`）
- （このコミット時点でのバグ：後日09/09にサイドバー幅の条件分岐漏れを修正）
---
 
## 2026-09-01
 
### 退勤忘れ通知 — タイミングのずれを修正
 
- **不具合**: `ForgotClockoutScheduler`が常に「昨日」のレコードのみを対象にしていたため、チェック時刻の設定によっては通知が1日遅れて届く場合があった
- **修正**: 直近2日分のレコードから未クローズのセッションを検索し、`workDate`はそのセッション自体から取得。予定終了時刻をまだ過ぎていない場合は通知しないよう判定を追加
- ナイトシフト（`nextDay=true`）は引き続き対象外（意図的な仕様）
### キオスク — ネットワーク断への対応強化
 
- `fetchWithTimeout()` — AbortController + タイムアウト（通常8秒、打刻10秒）、cache-busting
- 接続リトライ: 3回×5秒間隔、`window.addEventListener("online")`で復旧検知時に即再試行
- 待機画面に接続状態インジケーター（WifiIcon、シンプルな白アイコン、タップで「接続あり/なし」ポップアップ）
- リトライ上限到達時：「接続に問題があります」画面表示
- 復旧しない場合、20秒後に自動で`window.location.reload()`（ブラウザの内部ネットワークスタックのリセット目的）
- 打刻時のエラーメッセージを日本語の分かりやすい文言に変更（`friendlyPunchError()`）
- **設計判断**: ネットワーク切断時に打刻時刻を端末側に一時保存する方式は採用せず。データの信頼性を優先し、切断時は保存しない（スタッフからの申告で対応）
### メール通知 — 4種類追加
 
- `NotificationType`に追加: `UNSCHEDULED_ARRIVAL`（シフトなし出勤）, `ACCOUNT_LOCKED`（永久ロック）, `EMPLOYEE_CREATED`, `EMPLOYEE_DELETED`
- `KioskService.checkAndNotify()` — プランがない日の出勤打刻を検知して通知
- `AuthController.registerFailedAttempt()` — lockLevel=4到達時に通知
- `UserService.create()`/`delete()` — `CurrentUser.require()`で実行者名を取得して通知
### サーバー — バックアップ体制の強化
 
- 既存の日次バックアップ（`/opt/shift-app/backup.sh`、毎日03:00）を調査・確認 — DB dumpは`/mnt/backup-shift/`（別サーバー192.168.1.11のネットワーク共有）に正常保存されていたことを確認
- **オフサイトバックアップ追加**: `rclone` + Google Drive（`hannoshift.notify@gmail.com`）
  - DB dump → `hannoshift-backups`フォルダ、90日保持
  - 写真（`/var/www/shift-app/photos/`）→ ローカルのみ`rsync -a --delete`で`/mnt/backup-shift/photo/`に同期
  - 設定ファイル（application.yml, systemdユニット, nginx設定）→ ローカル10世代 + Google Drive最新版のみ（`hannoshift-backups-config`）
- Google Drive APIのレート制限（`RATE_LIMIT_EXCEEDED`）に対応 — `sleep 3`をアップロード間に挿入
- テスト環境でDB・写真の復元を実施、正常動作を確認
- `SERVER_INFO.md`（RU/JP）新規作成 — サーバー構成・バックアップ・障害復旧手順を文書化
### 開発環境 — Docker移行
 
- report-service, backend（multi-stage: Maven→JRE21）, frontend（multi-stage: Node20→nginx）をDocker化
- PostgreSQL 17をDockerコンテナに移行、既存3データベース（shiftapp, hanno_banquets, wordcards）を個別ユーザーで再構築、ローカルWindows版PostgreSQLは削除
- `docker-compose.yml`で4サービスを統合、内部ネットワークでサービス名により相互通信（`postgres`, `backend`, `report-service`）
- `application.yml`を`${VAR:default}`形式に統一 — dev/Docker/本番で同一ファイルを使用可能に
- 開発環境のみ完了。本番サーバーは今後の対応予定
### シフト管理 — 開始時刻の選択範囲拡大
 
- `START_TIME_OPTS`: `06:00`〜 → `03:00`〜（早朝勤務に対応）
---
 
## 2026-08-30
 
### メール通知機能 — 新規実装（LATE_ARRIVAL / EARLY_DEPARTURE / FORGOT_CLOCKOUT / PASSWORD_CHANGED）
 
- 新規パッケージ`com.shiftapp.notifications`
  - `NotificationType`, `NotificationPreference`(+Repository), `NotificationSettings`(+Repository)
  - `NotificationMailService` — `@Async`、Gmail SMTP、マネージャーごとのopt-out設定、同一メールアドレスへの重複送信防止（`distinctByKey`）
  - `ForgotClockoutScheduler` — `SchedulingConfigurer`で動的に再スケジュール、DBから毎回チェック時刻を読み込み
  - `V16__add_notifications.sql`（PostgreSQL構文：`GENERATED ALWAYS AS IDENTITY`）
- `KioskService.checkAndNotify()` — 出勤/退勤打刻時に遅刻・早退を判定
- `AuthController` — アカウントロック時の通知
- `UserService` — パスワード変更時の通知（変更者以外に送信、`excludeUserId`）
- `application.yml`にGmail SMTP設定追加、`MAIL_APP_PASSWORD`環境変数
- `SettingsPage.jsx` — 新タブ「通知設定」（8種類の通知タイプのON/OFF + 退勤忘れチェック時刻設定）
- `ShiftAppApplication.java` — `@EnableAsync`, `@EnableScheduling`追加
### 勤怠管理リスト — 残業時間列を追加
 
- 出退勤の実績・予定を比較し、休憩時間（実打刻優先、なければ自動計算）を差し引いた超過/不足時間を算出
- 画面（`AttendancePage.jsx`）とExcelレポート（`attendance_sessions.py`）の両方に反映
- Excelレポートの列を`visibleColumns`パラメータで動的化 — 画面の「表示列」設定がそのままレポートに反映されるように変更
### 従業員管理画面 — 検索・ソート・フィルター機能追加
 
- 氏名・フリガナ・ログインIDでの検索欄を追加
- 列見出し（ID/氏名/Login）クリックでソート
- 列見出し（職種・役職/部署/ロール/状態）クリックでチェックボックス絞り込みドロップダウン
- 使用されていなかった「更新」ボタンを廃止、「表示中：N/M人」の件数表示に変更
---
 
## 2026-08-28
 
### シフト管理・勤怠管理 — レポートを期間指定に対応
 
- これまで月単位（`ym`）固定だった各種Excelレポート（全員シフト表・部署別シフト表・勤怠集計表・選択中スタッフ）を、画面で選択中の期間（月/週/期間モード）に応じて出力できるよう変更
- Python側（`shift_all.py`, `shift_dept.py`, `timesheet.py`）に`build_range()`関数を追加（既存の`build()`は温存、月次レポートは従来通り動作）
- Java側（`ReportService`/`ReportController`）に`*Range`系メソッド・エンドポイントを追加
### シフト管理 — 勤務時間列のsticky表示不具合修正
 
- テーブルヘッダーの1行目（週ステータス行）と2行目（列見出し行）でセル数が一致しておらず、最後列（勤務時間）がスクロール時にsticky固定されない不具合を修正
- 1行目に不足していたダミーセルを追加
---
 
## 2026-08-23
 
### 勤怠管理 — フィルター中のスタッフの勤怠集計表エクスポート機能を追加
 
- 「表示中の勤怠集計表」— 画面上でフィルタリングされているスタッフのみを対象に、任意の期間でExcel出力（月/週/期間モードいずれにも対応）
- Python側に`attendance_timesheet.py`の`build_range()`関数を新設（日付範囲ベース、月単位に依存しない構造）
- Java側に`generateAttendanceTimesheetFiltered()`, `buildAttendancePayloadRange()`を追加
### 勤怠管理レポート — 遅刻/早退の色分け表示
 
- `勤怠集計表（実績）`・`表示中の勤怠集計表`のExcelで、出勤・退勤セルを画面と同じ色分けで表示（緑=時間通り、赤=遅刻、黄=早退、灰=シフトなし）
- 従来は「ブロック全体」を赤くしていたのを、出勤行・退勤行それぞれ個別に判定して色分けするよう変更
### 勤怠管理 — 打刻詳細ポップアップの写真表示改善
 
- 「写真を見る」ボタン（📷アイコン）を廃止し、130×100pxの写真プレビューをその場に表示するよう変更
- プレビューをクリックすると従来通り拡大表示（`photoPopup`）
- ポップアップ全体の幅も拡大（maxWidth 440→480）
---

## 2026-08-19

### HannoSHIFT — 勤怠管理リスト: 休憩時刻の表示不具合修正

- 予定（シフト）がない日で、休憩ルールにより自動計算された休憩時間が **カレンダー表示** には出るのに **リスト表示** の`休憩時刻`列には出ない不具合を修正
  - 原因: リスト側は実打刻（`休憩`/`復帰`ボタン）のみを参照しており、自動計算値（`computeSessionOfficial()`の`officialBreakMinutes`）にフォールバックしていなかった
  - `AttendancePage.jsx`: `休憩時刻`列のレンダリングで実打刻がなければ`s.info.officialBreakMinutes`を表示するよう修正
- 同様のロジックを Excel レポート（`attendance_sessions.py`）にも適用（`_raw_break_minutes()`が`None`の場合は`s.officialBreakMinutes`にフォールバック）

### HannoSHIFT — ログインセキュリティ: 段階的アカウントロック機能を追加

- **背景**: これまでログイン試行回数に制限がなく、パスワードを無制限に試行できる状態だった
- **仕様**:
  - 5回連続失敗 → 10分間ロック
  - 10回連続失敗 → 30分間ロック
  - 15回連続失敗 → 3時間ロック
  - 20回連続失敗 → 永久ロック（管理者による解除が必要）
  - ログイン成功時は試行回数・ロックレベルを完全リセット
  - カウントは IP ではなく **ログインID単位**（悪意ある第三者による意図的なロックのリスクは、現状のデータの重要度から許容範囲と判断。将来的に必要であれば IP+ログインID単位に変更予定）
  - ロック中の再ログイン試行はカウンター・タイマーに影響を与えない（無限にロック延長される脆弱性を回避）

- **Backend**
  - `V15__add_login_lock.sql`（新規）— `users`テーブルに`failed_login_attempts`, `lock_level`, `locked_until`, `account_locked`を追加
  - `User.java` — 上記4フィールド + getter/setter追加
  - `AuthController.java`
    - `login()`にロック判定ロジックを追加（`accountLocked`→即拒否、`lockedUntil`未経過→拒否、パスワード不一致→`registerFailedAttempt()`）
    - ロック中のメッセージに具体的な時間を明示（例:「ログイン試行回数が上限に達しました。10分間ロックされます。時間をおいて再度お試しください。」）
    - `LOCK_THRESHOLDS = {5,10,15,20}`, `LOCK_MINUTES = {10,30,180}`（レベル4は永久ロック）
  - `ManagerUserController.java`
    - `POST /api/manager/employees/{id}/unlock`エンドポイント追加
    - `@Transactional`必須（`departments`の遅延ロード例外に注意 — `UserResponse.from()`がトランザクション外で呼ばれると`LazyInitializationException`が発生する）
  - `UserResponse.java` — `accountLocked`, `lockLevel`, `lockedUntil`を追加

- **Frontend**
  - `api.js` — `managerEmployeesUnlock(id)`を追加
  - `EmployeesPage.jsx`
    - スタッフ一覧の状態列に`🔒 ロック中`（永久）/`⚠ 一時ロック（10分/30分/3時間）`バッジを追加
    - 編集モーダル内、`アクティブ`チェックボックスの下に`🔓 ロックを解除する`チェックボックスを追加（ロック中の場合のみ表示、現在のロック状態を表示）
    - 保存時、チェックが入っていれば通常の更新後に`unlock` APIを呼び出す（一括操作、専用ボタンは廃止）

---

## 2026-07-30

### シフト管理 — 部署別シフト表（shift_dept.py）フォーマット改善

- **職場→休憩に変更**: 3行目のラベルを`職場`から`休憩`に変更し、`休憩ルール`に基づき各スロットの実働時間から自動計算した休憩時間を表示（形式:「1:30」の時:分表記）
  - `ReportService.java`: `buildPayload()`/`buildPayloadForUsers()`に`breakRules`をpayloadへ追加（`buildBreakRulesPayload()`新設）
  - `models.py`: `BreakRuleModel`, `ReportRequest.breakRules`を追加
  - `shift_dept.py`: `_slot_duration_minutes()`, `_auto_break_minutes()`, `_fmt_break()`を追加
  - **重要な不具合修正**: `ReportService.buildDay()`が`last`（L）スロットの`endTime`を常に`null`で送っていたため、Lが立っているシフトの休憩時間が計算できなかった。`endTime`は`last`に関わらず常に実値を送るよう修正（`last`はPython側で表示上の分岐にのみ使用）
- **視認性向上**
  - 日付・曜日の文字サイズを拡大（日: 8→10, 曜日: 8→9）
  - 出勤/退勤/休憩の行の高さを拡大（14→20）— テキストの詰まりを解消
  - `役職`セルを縦書き表示に変更（`textRotation=255`）、列幅を5.25→7に拡大
  - `氏名`の文字サイズを拡大（9→11、太字）
- **テーブル下部にヘッダー行を複製**（フッター）
  - 最終行の直後に、シート上部と同じ日付・曜日・`役職`/`氏名`ラベル・`公休数`見出しを再表示
  - スクロールして上に戻らなくても、下端で日付を参照できるように改善
  - 外枠の太罫線をフッターまで拡張

---

## 2026-07-14

### スタッフ画面 — 週別から月別へ完全移行

#### Backend — 新パッケージ `com.shiftapp.months`
- **`V13__add_month_status.sql`** — `month_status`テーブル作成
  `(id, restaurant_id, year_month, status, updated_by, updated_at, UNIQUE(restaurant_id, year_month))`
- **`V14__add_month_status_half.sql`** — `half`カラム追加、UNIQUE制約を`(restaurant_id, year_month, half)`に変更
- **`MonthStatus.java`** — entity: restaurant, yearMonth, status, half, updatedBy, updatedAt
- **`MonthStatusRepository.java`** — `findByRestaurant_IdAndYearMonthAndHalf(Long, String, int)`
- **`MonthStatusController.java`** — `GET/POST /api/manager/month-status?month=&status=&half=`
  - GET: `{status1, status2}` (half=1と2を別々に返す)
  - POST: 指定した半月のステータスを変更
- **`StaffMonthController.java`** — `GET /api/staff/month?month=` / `POST /api/staff/month/save`
  - GET: `{status1, status2, days[]}` — 月全体のデータを返す
  - POST: ステータスがRECEIVINGの半月のみ保存（ブロック済みはスキップ）
- **`SaveMonthRequest.java`** — `{month, days: [{date, off, startTime, endTime}]}`

#### Frontend — `api.js`
```js
staffMonth(month), staffMonthSave(month, days),
managerMonthStatus(month), managerMonthStatusSet(month, status, half)
```

#### Frontend — `StaffMonth.jsx` (完全リライト、`StaffWeek.module.css`使用)
- 月選択セレクト（5ヶ月分）
- 前半（1〜15日）と後半（16〜末日）の2ブロック表示
- 各ブロック: タイトル + 締切警告 + 一括入力ツールバー + ステータスバッジ + テーブル
- 一括入力: `[開始▼]〜[終了▼] [全日程] [平日のみ] [全て休み]`
  - 各ボタンは対応する半月のみ更新
  - 保存は「更新」ボタンを押すまでローカルstate内
- ステータスがRECEIVING以外の半月は編集不可
- Lフラグ対応: マネージャーがLastを設定した場合、終了時間の代わりにLを表示
- 締切案内:
  - 1〜15日: 「前月20日までに提出してください」
  - 16〜末日: 「当月5日までに提出してください」

#### Frontend — `ManagerTablePage.jsx`
- TopBarに月別ステータスを2つ追加（月モード時のみ表示）
  - `1〜15日: [受付中▼]` と `16〜末日: [受付中▼]`
- 週ステータスのセレクトは引き続き表示（週/期間モード対応のため残留）
- `monthStatus1`, `monthStatus2` state追加
- `changeMonthStatus(newStatus, half)` — half指定でAPIコール

---

### 休憩ルール機能追加

#### Backend
- **`V11__add_break_rules.sql`** — `break_rules(id, restaurant_id, name, threshold_minutes, break_minutes)`
- **`V12__add_break_override.sql`** — `shift_slots`に`break_override_minutes INT NULL`追加
- **`BreakRule.java`**, **`BreakRuleRepository.java`**, **`BreakRuleController.java`**
  - `GET/POST/PUT/DELETE /api/manager/settings/break-rules`
- **`ShiftSlot.java`** — `breakOverrideMinutes`フィールド追加
- **`SlotDto.java`** — 6引数コンストラクタ（`breakOverrideMinutes`追加）
- **`ManagerStaffWeekSaveRequest.SlotInput`** — `breakOverrideMinutes`フィールド追加（getter/setter）
- **`WeekService.managerSaveStaffWeek()`** — `slot.setBreakOverrideMinutes(si.getBreakOverrideMinutes())`
- **`ManagerMonthController.buildDayForManager()`** / **`ManagerStaffWeekController`** — `new SlotDto(..., s.getBreakOverrideMinutes())`

#### Frontend — `SettingsPage.jsx`
- 新タブ「休憩ルール」追加
- テーブル形式でルール一覧（名前 / しきい値（分以上） / 休憩時間（分））
- 追加・編集・削除対応

#### Frontend — `CellPopover`（`ManagerTablePage.jsx`内）
- 終了時間の下に3つのヒントを表示:
  - 🕐 合計: X時間Y分
  - ⏱ 休憩: Xmin（クリックでドロップダウン、手動選択可）
  - ⏰ 実働: X時間Y分
- 休憩ドロップダウン: `なし（0分）` + 登録済みルール一覧
- 手動選択は`breakOverride`としてDBに保存・復元
- `getAutoBreakMinutes()`, `getBreakHint()`, `getWorkHint()`, `getTotalHint()` — CellPopover内の関数

#### Frontend — `ManagerTablePage.jsx`
- `breakRules` stateを追加、`load()`でAPIから取得
- `calcWorkMinutes(userId)` — 日ごとに全スロットを合計し、最適な休憩ルールを適用
  - `breakOverrideMinutes`がある場合はそちらを優先
- `勤務時間`列追加（公休数の隣）: 時間と分を別行で表示
- 公休数・勤務時間列に背景色`#f8faff`、ヘッダーに`#f0f4ff`

---

### その他の修正（07/14）
- **勤怠管理画面** — 時刻表示に秒を復活（`.slice(0,5)`を削除）
- **シフト管理画面** — 出退勤インジケーターの色付きドットを削除
- **期間モード** — 最大日数を35日→50日に拡張（フロント・バック両方）

---

## 2026-07-13

### 勤怠管理 — 状態フィルター追加
- 5種類の色でフィルタリング: 🟢時間通り / 🔴遅刻 / 🟡早退 / 🔵シフト予定あり / ⚪シフトなし出勤あり
- `getRowColorStatus(userId, date)` — シフトと打刻を比較して自動判定
- `CheckDropdown`で状態フィルターUIを追加

### シフト管理 — 氏名検索
- SortBarに「氏名で検索...」テキスト入力を追加

### 勤怠管理画面のフォント拡大
- 打刻時刻のfontSizeを10→12に変更

---

## 2026-06-22 〜 2026-07-12 (以前のエントリーは省略)

※ 詳細は旧CHANGELOGを参照

---
 
## 2026-06-22
 
### ナイトシフト（日またぎ勤務）対応
 
#### Backend
- **`V10__add_next_day_flag.sql`** — `shift_slots`に`next_day BOOLEAN`カラム追加
- **`ShiftSlot.java`** — `nextDay`フィールド追加
- **`SlotDto.java`** — `nextDay`フィールド追加（コンストラクタ更新）
- **`ManagerStaffWeekSaveRequest.SlotInput`** — `nextDay`フィールド追加
- **`WeekService.java`** — `buildDayForManager`と`managerSaveStaffWeek`で`nextDay`を処理
- **`ManagerMonthController.java`** — `findByRestaurant_IdAndRoleInOrderByFullNameAsc`使用（STAFF+MANAGER両方表示）
- **`UserRepository.java`** — `findByRestaurant_IdAndRoleInOrderByFullNameAsc`追加
- **`KioskController.java`** — STAFF+MANAGERをキオスクに表示
- **`KioskService.getStatus()`** — 日付に関係なく未退勤の勤務を継続表示（翌日以降も退勤可能）
- **`KioskService.validatePunch()`** — FINISHED状態でも新たに出勤可能
- **`TimeRecordRepository`** — `findByUser_IdOrderByRecordedAtAsc`、`deleteByUserId`追加
- **`UserService.delete()`** — カスケード削除実装（preferences→shift_slots→time_records→users）
#### Frontend — `ManagerTablePage.jsx`
- **シフト番号** — スロットヘッダーに`2026/06/22 №1`形式で表示
- **当日/翌日ヒント** — 開始の上に`当日`、終了の上に`当日`/`翌日`を動的表示
- **前日からの引き続きブロック** — D+1のポップアップに前日ナイトシフト情報を表示、クリックで前日に遷移
- **紫ストライプ** — ナイトシフトが引き継ぐ日のセル上部に紫ライン表示
- **終了時間の色** — `nextDay=true`のスロットは終了時間を紫で表示
- **L（ラスト）動作変更** — Lチェックボックスは目印のみ。終了時間は常に必須
- **保存ボタン無効化** — 開始・終了両方未入力の場合は保存不可
- **＋シフトを追加** — ボタン名を`勤務場所を追加`から変更
- **START_TIME_OPTS/END_TIME_OPTS** — 開始は06:00〜23:30、終了は00:00〜23:30に分離
- **MANAGERロール表示** — シフト管理テーブルにMANAGERも表示
- **getName()修正** — UTF-8日本語文字のデコード修正→`localStorage.staffName`から取得
#### Frontend — `AttendancePage.jsx`
- **完全リデザイン** — `ManagerTablePage`と同一の TopBar/SortBar を実装
  - 月/週/期間 表示モード
  - 表示列▼（№/職種・役職/部署）
  - 職種・役職▼フィルター
  - 部署▼フィルター（カスケード）
  - 表示フィルター▼（出勤中/休憩中/退勤済み/未出勤）
  - リセットボタン
  - 並び替え（氏名/職種・役職/部署）
- **週区切り表示** — 週ごとの境界線（`cellWeekStart`）を追加
- **写真ポップアップ** — 📷クリックでモーダル内に写真を拡大表示
- **MANAGERロール表示** — 勤怠管理テーブルにMANAGERも表示
- **フィルター設定保存** — `attFilterPos`/`attFilterDept`/`attFilterStatus`/`attColVisibility` をlocalStorageに保存
#### Frontend — `EmployeesPage.jsx`
- **削除確認ポップアップ** — `window.confirm`→専用モーダルに変更
  - 「すべてのシフトデータと打刻記録も完全に削除されます」警告表示
  - キャンセル / 完全に削除する の2ボタン

---
 
## 2026-06-16
 
### 勤怠管理 (打刻システム) — полная реализация
 
#### Backend — новый пакет `com.shiftapp.kiosk`
- **`TimeRecord.java`** — entity таблицы `time_records`
- **`TimeRecordType.java`** — enum: CLOCK_IN / CLOCK_OUT / BREAK_START / BREAK_END
- **`TimeRecordRepository.java`** — `findByUser_IdAndWorkDateOrderByRecordedAtAsc`, `findByRestaurantAndDateRange` (с JOIN FETCH t.user)
- **`KioskService.java`** — логика статуса, punch, сохранение фото
  - `kiosk.photo-dir` из `application.yml`
  - `lastPhotoPath` — последнее фото сотрудника за день
- **`KioskController.java`** — без JWT:
  - `GET /api/kiosk/staff?restaurantId=1`
  - `GET /api/kiosk/status/{userId}`
  - `POST /api/kiosk/punch`
- **`StaffStatusResponse.java`** — status, clockInAt, breakStartAt, breakEndAt, clockOutAt, lastPhotoPath
#### Backend — новый пакет `com.shiftapp.attendance`
- `GET /api/manager/attendance?from=&to=`
- `PUT /api/manager/attendance/{id}` — ручная правка
#### SecurityConfig.java
- permitAll: `/api/kiosk/**`, `/photos/**`
#### application.yml
- `kiosk.photo-dir` (dev: `C:/shift-app/photos/`, prod: `/var/www/shift-app/photos/`)
- `spring.web.resources.static-locations` — отдача фото через Spring Boot
#### SQL
- `V6__add_time_records.sql` — таблица `time_records` + индексы
- `V7__add_fullname_kana.sql` — `ALTER TABLE users ADD COLUMN full_name_kana VARCHAR(200)`
#### Frontend — `KioskPage.jsx` (`/kiosk`)
- Роутинг в `main.jsx`: `window.location.pathname.startsWith('/kiosk')`
- Дизайн под iPad 10 landscape, синяя тема (#2F5496 / #1e3a5f)
- Header: дата/время с секундами, счётчик 出勤中, кнопка обновления
- Левая панель: катакана фильтр (ア/カ/サ...) — группировка по `fullNameKana`
- Сетка карточек: фото из lastPhotoPath (WORKING/ON_BREAK), заглушка (NOT_STARTED/FINISHED)
- Попап (780×480px): камера слева (автозапуск) + время/кнопки справа
  - 4 кнопки: 出勤(синий)/退勤(красный)/休憩(оранжевый)/復帰(зелёный)
  - Автоснимок при нажатии кнопки, экран успеха 3 сек
  - Закрытие тапом на фон (キャンセル убран)
- Автообновление каждые 30 сек, `RESTAURANT_ID = 1`
#### Frontend — `AttendancePage.jsx`
- Sidebar: 🕐 勤怠管理 (между SHIFTS и EMPLOYEES)
- Таблица: сотрудники × дни, точка + время прихода/ухода
- Попап: детали записей + фото + ручная правка менеджером
- `fmtTime` показывает секунды: `09:23:47`
#### Frontend — `ManagerTablePage.jsx`
- `attendanceMap` — цветная точка в ячейке (зелёный/синий/оранжевый)
#### Users — フリガナ
- `User.java`, `UserResponse.java`, `UserCreateRequest/UpdateRequest.java` — поле `fullNameKana`
- `EmployeesPage.jsx` — поле フリガナ（カタカナ）
- `KioskPage.jsx` — `getKanaGroup(staff)` использует `fullNameKana`
#### api.js
- `attendanceRecords(from, to)`, `attendanceEdit(id, payload)`
#### nginx (прод)
- `location /photos/ { alias /var/www/shift-app/photos/; }`
---
 
## 2026-06-09
 
### PWA
- Иконки, manifest.webmanifest, vite-plugin-pwa
- theme_color: "#2F5496"
- InstallBanner (ja/en) в App.jsx
- nginx: location /manifest.webmanifest
### LoginPage
- Кнопка показа пароля (SVG)
- Safari password save: `window.location.href = "/"`
---

## 2026-06-02

### ManagerTablePage — режимы просмотра (月/週/期間)

#### Топбар — новые контролы
- Один `<select>` месяца заменён на два: **Year `[年▼]`** + **Month `[月▼]`**
- Диапазон Year: ~3 года (±12 месяцев от текущего)
- Добавлены табы режима: **`[月 | 週 | 期間]`**

#### Режим 月 (месяц)
- Работает как раньше, запрос `?month=YYYY-MM`

#### Режим 週 (неделя)
- Выпадающий список недель выбранного месяца (пн〜вс)
- Запрос через `api.managerRange(weekStart, weekEnd)`
- `selectedWeek` сохраняется в localStorage

#### Режим 期間 (период)
- Два `<input type="date">` — от/до
- Валидация: минимум 7 дней, максимум 35 дней
- Счётчик дней с цветовой индикацией (зелёный/красный)
- При невалидном диапазоне — жёлтый баннер с подсказкой
- Запрос через `api.managerRange(from, to)`
- `managerRangeFrom`, `managerRangeTo` сохраняются в localStorage

#### Backend — `ManagerMonthController.java`
- Метод `getMonth` теперь принимает либо `?month=YYYY-MM` либо `?from=...&to=...`
- При `from/to`: валидация 7–35 дней (`IllegalArgumentException` → HTTP 400)
- Цикл по неделям до `rangeTo` (не до конца месяца) — корректно захватывает недели на стыке месяцев

#### Frontend — `displayDates`
- Центральный `useMemo` — массив строк `YYYY-MM-DD` для отображения столбцов
- Все функции таблицы (`maxSlotsForStaff`, `countOffDays`, фильтры, Excel) работают через `displayDates`
- Убраны `dayNums` и `dateStr(ym, d)` — заменены на прямые строки дат

#### Исправление UTC+9 проблемы
- `toISOString()` в Японии (UTC+9) давал неверную дату (сдвиг на день назад)
- Добавлены хелперы: `currentMondayLocal()`, `addDays(date, n)`, `weeksInMonth(ymStr)` — все используют локальное время через `getFullYear/getMonth/getDate`
- `weeksInMonth` исправлен: недели теперь начинаются с понедельника корректно

#### Шапка таблицы — перестановка строк
- Row 1: статусы недель (`thWeek`) — перенесён наверх
- Row 2: заголовки дней (`thDay` и sticky колонки)
- CSS: `thDay`, `thName`, `thPosition`, `thDepartment`, `thNumber` получили `top: 34px`
- `thWeek` и `thNameSub` — `top: 0`

#### Узкие недели (1–2 дня в видимом диапазоне)
- `statusSelect` при `count <= 2`: `color: transparent`, `width: 28px` — виден только цветной фон со стрелкой
- `thWeek`: добавлен `overflow: hidden` — диапазон не растягивает ячейку
- Диапазон недели (`thWeekRange`) всегда отображается

#### `api.js`
- Добавлен `managerRange(from, to)` → `GET /api/manager/month?from=...&to=...`
- `clearToken()` дополнен: `managerViewMode`, `managerSelectedWeek`, `managerRangeFrom`, `managerRangeTo`

#### `App.jsx`
- `<ManagerTablePage key={token} .../>` — гарантирует полный сброс state при повторном логине

---

## 2026-05-31

### ManagerTablePage — столбец № и 公休数

#### Столбец № (порядковый номер)
- Первый столбец таблицы перед 職種・役職
- Показывает порядковый номер в текущем отфильтрованном списке
- Управляется через `表示列▼` дропдаун (ключ `number` в `colVisibility`)
- Отдельный CSS класс `.tdNumber` / `.thNumber` — width 28px (не использовать `.tdPosition`!)
- `colVisibility` default обновлён: `{ number: true, position: true, department: true }`

#### Столбец 公休数 (количество выходных)
- Последний столбец после всех дней месяца
- Автоматически считает количество выходных дней через `countOffDays(userId)`
- Добавлен в обоих строках `<thead>` (первая — заголовок, вторая — пустая `<th>`)
- Добавлен в `<tbody>` с `rowSpan={maxSlots}` только при `subIdx === 0`

#### ReportLoader — прелоадер генерации отчёта
- Компонент `ReportLoader` — оверлей с анимированным спиннером
- Показывается сразу при нажатии на любой пункт меню レポート▼
- Блокирует случайные клики во время загрузки (`rgba(0,0,0,0.45)`)
- Исчезает когда `fetchBlob` завершился (файл скачан или ошибка)
- Исправлены early return в `handleReport` для dept-отчёта: добавлен `setReportLoading(false)` перед `return`

#### Отчёты — 公休数 добавлен в Excel
- `shift_dept.py` — колонка 公休数 в конце, заголовок merged строки 5-6
- `shift_all.py` — полностью переписан под формат shift_dept (3 строки на сотрудника)
  - Колонки: A=職種, B=部署, C=氏名, D=メタ, E..=дни, последняя=公休数
  - freeze_panes = "E6"
- Важно: `last_data_col = 4 + total` для рамки (иначе 公休数 вне рамки)

---

## 2026-05-29

### Деплой report-service на прод

- Python3 уже был на сервере (3.12.3)
- Установлены `python3-pip`, `python3-venv`
- Создана папка `/opt/report-service/`, скопированы файлы (без venv и __pycache__)
- Создан venv, установлены зависимости через `requirements.txt`
- systemd: `shift-report.service` скопирован в `/etc/systemd/system/`
- Исправлен `User=` в service файле: `ubuntu` → `anadminsrv`
- Сервис запущен и включён в автозапуск

---

## 2026-05-25

### Report Service — Python FastAPI для генерации Excel-отчётов

#### Архитектура
- Новый микросервис `report-service/` (Python FastAPI, порт 8001)
- Spring Boot проксирует `/api/manager/reports/**` → FastAPI через `RestTemplate`
- FastAPI генерирует `.xlsx` через `openpyxl` и возвращает байты
- Новый пакет `com.shiftapp.reports`: `ReportController.java`, `ReportService.java`

#### Типы отчётов
- **部署別シフト表** — 3 строки на сотрудника (出勤/退勤/職場), объединённые ячейки, рамки
- **全員シフト表** — тот же формат что 部署別, колонки: 職種・役職 | 部署 | 氏名 | メタ | дни | 公休数
- **勤怠集計表** — табель с автоматическим подсчётом дней и часов
- **選択中スタッフ** — тот же формат что 全員, но только по выбранным userId

#### Стилизация Excel (openpyxl)
- Цветовое оформление: заголовки, 休, чётные строки
- Рамки: `_thin()`, `_medium()`, `_apply_outer_border()` для merged cells
- Настройки печати: landscape, A4, fitToPage, узкие поля
- Freeze panes: первые колонки + строка заголовка зафиксированы

#### Frontend интеграция
- Кнопка **📊 レポート▼** в topBar с дропдауном 4 типов отчётов
- `fetchBlob()` в `api.js` — скачивает файл, читает имя из `Content-Disposition`
- `AlertModal` вместо `alert()` — красивый попап с ⚠️
- Предупреждение при выборе 部署別 если выбрано ≠ 1 отдел

#### Технические решения
- `objectMapper.writeValueAsBytes()` вместо `writeValueAsString()` — обход кодировки Windows
- `hotelName` — `static final` в Java, не из yml (кодировка)
- `Content-Type: application/json` без charset — FastAPI требует именно так

---

### ManagerTablePage — массовое редактирование ячеек

#### Shift+клик (выделение нескольких дней)
- Зажать Shift и кликать по дням одного сотрудника → выделение синей рамкой (`.cellSelected`)
- Клик на другого сотрудника → выделение сбрасывается, начинается новое
- Повторный Shift+клик на выделенную ячейку → снимает выделение
- `user-select: none` на `.table` — предотвращает выделение текста при Shift+клик

#### Панель массового редактирования
- При выделении появляется фиксированная панель внизу экрана: `N日選択中`
- **✏️ 一括編集** — открывает `BulkPopover` (стиль идентичен `CellPopover`, центрирован)
- **✕ 選択解除** — сбрасывает выделение
- `saveBulkCells(patch)` — группирует выделенные дни по неделям, сохраняет параллельно

#### Контекстное меню (правая кнопка мыши)
- Правый клик на ячейке → `ContextMenu` с пунктами:
  - ✏️ 編集 — открыть обычный попап редактирования
  - 📋 このパターンをコピー — копирует `{off, slots}` в state
  - 📅 コピーを適用 / `N日に適用` — вставляет в ячейку или все выделенные
- Комбо: Shift+клик нескольких дней → правый клик → `N日に適用`
- Важно: правый клик НЕ сбрасывает `selectedCells`

#### Прочие улучшения
- Колонка 部署 отображает отделы в колонку (`<div>` на каждый), не через запятую
- Excel экспорт переведён на `xlsx-js-style` для поддержки стилей

---

## 2026-05-23

### シフト管理 — фильтры, сортировка, экспорт

#### SortBar — постоянная полоса управления под topBar
- `表示列▼` — дропдаун скрытия/показа столбцов № / 職種・役職 / 部署
- `職種・役職▼` — каскадный фильтр уровень 1
- `部署▼` — каскадный фильтр уровень 2
- `表示フィルター▼` — фильтр по 場所 + 場所なし + 休み
- `リセット` — сброс всех фильтров
- Сортировка по 氏名 / 職種・役職 / 部署

#### Каскадный фильтр
- Прямой каскад: 職種 → 部署 → 場所
- Состояние фильтров в localStorage: `mgrFilterPos`, `mgrFilterDept`, `mgrFilterWp`

#### Экспорт в Excel
- Кнопка 📥 Excel, зависимость `xlsx-js-style`

---

## 2026-05-19

### Конкурентное редактирование
- `@Version` на `Preference`, HTTP 409 при конфликте
- Автообновление таблицы каждые 60 сек

### Инфраструктура
- Flyway на проде, внешний конфиг `/opt/shift-app/application.yml`

### Новые функции
- Отделы (部署) — справочник + ManyToMany
- Лого и HannoSHIFT на странице логина
- Мануал `/manual.pdf`

### Оптимизация
- `ManagerMonthController` — 3 SQL запроса на месяц
- Убран `StrictMode`

---

## 2026-05-15

### Новые функции
- Справочники 設定: 勤務場所 / 職種・役職 / 部署
- Мульти-слоты — до 5 рабочих зон в один день
- Попап редактирования ячейки `CellPopover`

---

## 2026-05-14

### Архитектура
- `shift_slots` вместо полей в `preferences`
- Функция L (ラスト)

---

## 2026-05-10

### Основа проекта
- Monorepo: Spring Boot + React/Vite
- JWT аутентификация, роли STAFF/MANAGER/ADMIN
- Деплой: nginx + Spring Boot jar, `https://hanno-shift.duckdns.org`