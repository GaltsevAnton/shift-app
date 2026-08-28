# HannoSHIFT — CHANGELOG

Лог изменений по дням разработки.
# HannoSHIFT — CHANGELOG

ログ変更履歴。


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