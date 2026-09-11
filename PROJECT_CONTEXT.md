# HannoSHIFT — PROJECT_CONTEXT

Цель файла: чтобы в новом чате не пересылать много кода.

---

## 1) Главные решения проекта

- Репозиторий: **monorepo** (backend + frontend + report-service)
- **Единая сущность пользователя** (`com.shiftapp.users`) — и менеджеры, и персонал, и киоск.
  Роли: `STAFF`, `MANAGER`, `ADMIN`, `KIOSK`
- JWT-аутентификация: единый логин `/api/auth/login`
  - Обычные роли — токен на `access-token-minutes` (120 мин)
  - Роль `KIOSK` — отдельный долгоживущий токен (~10 лет) через `generateKioskToken()`
- Доступы: `/api/manager/**` → MANAGER, `/api/staff/**` → STAFF или MANAGER,
  `/api/kiosk/punch|status|staff` → требуют роль KIOSK
- Frontend: токен в `localStorage.accessToken`, роль в `localStorage.appRole`
- Навигация менеджера: `localStorage.managerView` — SHIFTS / PREFS / EMPLOYEES / SETTINGS / ATTENDANCE
- **Автологаут**: 30 минут бездействия (в `App.jsx`)
- Название приложения: **HannoSHIFT** (ホテル・ヘリテイジ / 飯能 sta.)
- **Dev-окружение полностью на Docker** (с 2026-09-01) — backend/report-service/frontend/postgres, единый `docker-compose.yml`. Прод пока НЕ на Docker (jar + systemd, план на будущее).

---

## 2) Структура репозитория

- `backend/` — Spring Boot (Java, Maven)
- `frontend/` — React (Vite)
- `report-service/` — Python FastAPI (Excel-отчёты)
- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `report-service/Dockerfile` — Docker-конфигурация (dev)
- `SERVER_INFO.md` (RU/JP) — отдельный документ с техническими параметрами прод-сервера, бэкапами, планом аварийного восстановления (не в этом чате, отдельно поддерживается)

---

## 3) Backend: ключевые модули

### 3.1 Auth / Security
- `JwtService.java` — claims: uid, rid, role, fullName
- `AuthController.java` — `POST /api/auth/login`
- `SecurityConfig.java` — CORS: localhost:5173, localhost:8888 (Docker frontend dev), 192.168.1.19:5173, hanno-shift.duckdns.org
- `CustomUserDetails.java` — `getUserId()`, `getRestaurantId()`, `getRole()`, `getFullName()` (НЕ `getId()`)
- `CurrentUser.java` (`com.shiftapp.common`) — `CurrentUser.require()` статически достаёт `CustomUserDetails` из `SecurityContextHolder`, работает и внутри сервисов, не только контроллеров

### 3.2 Users
- `User.java` — id, restaurant, login, passwordHash, role, fullName, fullNameKana,
  position, departments, active, lastName/firstName/Kana, email, phone, address, birthDate, gender
- `UserRole.java` — STAFF, MANAGER, ADMIN, KIOSK
- `UserService.java` — create/update/delete; при create/delete/password-change вызывает `NotificationMailService` (см. 3.12)

### 3.3 Preferences и ShiftSlots
- `Preference.java` — workDate, off, slots (OneToMany), version (@Version)
- `ShiftSlot.java` — slotOrder, startTime, endTime, last, workplace, nextDay, **breakOverrideMinutes**
- `nextDay=true` — смена переходит на следующий день
- `breakOverrideMinutes` — ручной override перерыва (null = автоматический по правилам)
- **START_TIME_OPTS** (ManagerTablePage.jsx) — с 2026-09-09: `03:00`–`23:30` (было `06:00`–`23:30`)

### 3.4 Weeks (менеджерское редактирование смен)
- `ManagerMonthController.java` — `GET /api/manager/month?month=YYYY-MM` или `?from=&to=` (7–50 дней)
- `ManagerStaffWeekController.java` — `GET/POST /api/manager/staff-week`
- `WeekService.java` — вся логика сохранения смен
- Показывает STAFF + MANAGER

### 3.5 Months (месячный статус и стафф-ввод)
Пакет `com.shiftapp.months`:
- `MonthStatus.java` — entity: restaurant, yearMonth, **half (1 или 2)**, status, updatedBy, updatedAt
- `MonthStatusRepository.java` — `findByRestaurant_IdAndYearMonthAndHalf(Long, String, int)`
- `MonthStatusController.java` — `GET/POST /api/manager/month-status?month=&status=&half=`
- `StaffMonthController.java` — `/api/staff/month` (GET) и `/api/staff/month/save` (POST)
- `SaveMonthRequest.java` — `{month, days: [{date, off, startTime, endTime}]}`

### 3.6 Break Rules (настройки перерывов)
Пакет `com.shiftapp.settings.breakrule`:
- `BreakRule.java` — name, thresholdMinutes, breakMinutes
- `BreakRuleController.java` — CRUD `/api/manager/settings/break-rules`
- Логика: из всех подходящих правил (`duration > thresholdMinutes`) выбирается с наибольшим порогом

### 3.7 Kiosk
- `KioskService.java` — статус, punch, фото; вызывает `checkAndNotify()` после каждой пробивки (遅刻/早退/シフトなし出勤)
- Смена открыта до явного 退勤, независимо от даты
- После 退勤 — новый 出勤 разрешён

### 3.8 Attendance
- `GET /api/manager/attendance?from=&to=`
- `PUT /api/manager/attendance/{id}`
- `ReportService.computeSessionOfficial()` — расчёт lateIn/earlyOut/officialClockIn/Out/officialBreakMinutes/workMinutes (общая логика для 勤怠管理 экрана и отчётов)

### 3.9 Settings
- workplaces, positions, departments, breakrules, **notification preferences/settings** — `/api/manager/settings/`, `/api/manager/notifications/`

### 3.10 Reports
- `ReportController.java` — прокси к Python FastAPI (порт 8001)
- Все отчёты (勤怠集計表・シフト表・打刻一覧) теперь имеют версии **`/range`** (по произвольному диапазону дат from/to), не только по `ym` — используются на страницах ManagerTablePage/AttendancePage вместо жёсткого месяца
- `勤怠リスト` (`attendance_sessions.py`) — динамические колонки через `visibleColumns` (соответствуют toggle-колонкам на экране リスト), включает **残業時間** (переработка = факт.чистое время − план.чистое время)

### 3.11 Login Security (段階的アカウントロック)
- `AuthController.login()` — при каждой неудачной попытке вызывает `registerFailedAttempt()`
- Эскалация: 5→10мин, 10→30мин, 15→3ч, 20→永久ロック (только менеджер снимает)
- Счётчик по логину, не по IP
- При достижении lockLevel=4 — отправляется email-уведомление `ACCOUNT_LOCKED` (см. 3.12)

### 3.12 Notifications (email, добавлено 2026-08-30)
Пакет `com.shiftapp.notifications`:
- `NotificationType.java` — enum: `LATE_ARRIVAL, EARLY_DEPARTURE, FORGOT_CLOCKOUT, UNSCHEDULED_ARRIVAL, ACCOUNT_LOCKED, EMPLOYEE_CREATED, EMPLOYEE_DELETED, PASSWORD_CHANGED`
- `NotificationPreference.java`/`Repository` — индивидуальные настройки на менеджера, **opt-out** (нет записи = включено)
- `NotificationSettings.java`/`Repository` — общая для ресторана настройка времени проверки забытых смен (по умолчанию 00:00)
- `NotificationMailService.java` — все методы `@Async`, дедупликация по email (`distinctByKey`), опционально исключает исполнителя действия (`excludeUserId`, используется для `PASSWORD_CHANGED`)
- `ForgotClockoutScheduler.java` — динамически перепланируемый `@Scheduled` через `SchedulingConfigurer`, читает время проверки из БД перед каждым запуском. Смотрит последние 2 дня записей (не жёстко "вчера"), берёт `workDate` из самой сессии, проверяет что плановое время окончания уже прошло. Ночные смены (`nextDay=true`) исключены из проверки намеренно.
- Email: Gmail SMTP, `hannoshift.notify@gmail.com`, App Password через `MAIL_APP_PASSWORD` env var
- `@EnableAsync` + `@EnableScheduling` в `ShiftAppApplication.java`

---

## 4) SQL миграции

```
V1__init.sql
V2__shift_unique_per_user_per_day.sql
V3〜V9  — workplaces, departments, lock, time_records, kana, kiosk, profile
V10__add_next_day_flag.sql      — next_day BOOLEAN на shift_slots
V11__add_break_rules.sql        — break_rules таблица
V12__add_break_override.sql     — break_override_minutes на shift_slots
V13__add_month_status.sql       — month_status таблица
V14__add_month_status_half.sql  — half INT + UNIQUE(restaurant_id, year_month, half)
V15__add_login_lock.sql         — failed_login_attempts, lock_level, locked_until, account_locked на users
V16__add_notifications.sql      — notification_preferences, notification_settings
                                   ⚠️ ПОСТГРЕС, не MySQL: GENERATED ALWAYS AS IDENTITY, не AUTO_INCREMENT
```

**Важно**: На dev Flyway отключён — миграции применяются вручную. На проде — `flyway.enabled: true`. **СУБД — PostgreSQL 16/17** (не MySQL) — при написании миграций использовать Postgres-синтаксис.

---

## 5) application.yml

Начиная с 2026-09-01 (Docker-переход) большинство значений вынесены в `${ПЕРЕМЕННАЯ:default}` — один файл работает и на dev, и в Docker, и на проде, разница только в переданных env-переменных при запуске:

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/shiftapp}
    username: ${SPRING_DATASOURCE_USERNAME:shiftuser}
    password: ${SPRING_DATASOURCE_PASSWORD:12qwasZX}
  jpa.hibernate.ddl-auto: ${SPRING_JPA_HIBERNATE_DDL_AUTO:update}
  flyway.enabled: ${SPRING_FLYWAY_ENABLED:false}
  web.resources.static-locations: ${STATIC_LOCATIONS:file:C:/shift-app/,classpath:/static/}
  mail:
    username: hannoshift.notify@gmail.com
    password: ${MAIL_APP_PASSWORD}
app.jwt.secret: "${APP_JWT_SECRET:local_dev_secret_not_used_in_prod}"
report.service.url: ${REPORT_SERVICE_URL:http://localhost:8001}
kiosk.photo-dir: ${KIOSK_PHOTO_DIR:C:/shift-app/photos/}
```

Прод продолжает передавать переменные через systemd `Environment=` (не Docker пока).

---

## 6) Frontend: ключевые файлы

### api.js — новые методы (после предыдущего снимка)
```js
// Notifications
notificationPreferencesGet(), notificationPreferencesSet(prefs)
notificationSettingsGet(), notificationSettingsSet(time)

// Attendance/Shift reports — range-версии (from/to вместо ym)
reportAttendanceTimesheetFiltered(from, to, userIds)
reportShiftAllRange(from, to), reportShiftDeptRange(from, to, dept)
reportTimesheetRange(from, to), reportShiftFilteredRange(from, to, userIds)
reportAttendanceSessions(from, to, userIds, visibleColumns)
```

### ManagerTablePage.jsx
- 📊レポート▼ теперь всегда шлёт `displayDates[0]`/`displayDates[last]` (текущий период на экране: 月/週/期間), а не жёстко `ym` — работает одинаково для всех 4 типов отчётов
- Sticky-заголовки таблицы: **обе строки `<thead>` должны иметь одинаковое количество ячеек** — если добавляешь колонку (напр. 公休数+勤務時間), нужно добавить соответствующие заглушки в первую строку (`thWeek`), иначе последняя колонка не будет sticky при скролле
- `START_TIME_OPTS`: `03:00`–`23:30` (с 09/09)

### AttendancePage.jsx
- Режим **リスト**: колонки динамические через `LIST_COLUMNS` + `visibleListCols` (toggle), передаются в Excel-отчёт как `visibleColumns`
  - Актуальный набор колонок (после 09/01): 出勤日付(予定/実際), 出勤時間(予定/実際), 退勤日付(予定/実際), 退勤時間(予定/実際), 休憩開始/終了, 休憩時間(予定/実際), 勤務時間(予定/実際), **残業時間**, シフト(予定)
  - Цвета: `実際`-колонки → `rgb(0,155,240)`, `予定`-колонки → `rgb(137,137,137)`, 残業時間 → красный(+)/синий(-)/серый(0) по знаку
  - Колонка 日付 (общая дата) убрана — заменена на отдельные 日付(予定)/(実際) для прихода и ухода
- Детальный попап дня (`detailPopup`): фото теперь **превью 130×100px** прямо в списке записей (было: кнопка 📷 → открыть), клик по превью открывает `photoPopup` (полноэкранный просмотр)
- 勤怠集計表（実績） и 表示中の勤怠集計表 (Excel): цветовая заливка 出勤/退勤 по факту опоздания/раннего ухода (зелёный/красный/жёлтый/серый), не весь блок целиком
- 📊レポート▼ содержит: 勤怠集計表（実績）, 打刻一覧, **表示中の勤怠集計表** (фильтрованный список сотрудников, любой период)

### EmployeesPage.jsx
- Поиск по 氏名/フリガナ/ログインID
- Сортировка по клику на заголовок (ID/氏名/Login), фильтрация чекбоксами (職種・役職/部署/ロール/状態) через dropdown в заголовке колонки
- Кнопка "更新" заменена на "表示中: N / M 人"

### SettingsPage.jsx
- Табы: 勤務場所 / 職種・役職 / 部署 / 休憩ルール / **通知設定** (новый, 2026-08-30)
- 通知設定: чекбоксы на 8 типов уведомлений (opt-out) + общее время проверки забытых смен

### KioskPage.jsx (`frontend/src/pages/kiosk/`)
- **Обработка обрыва сети** (2026-09-01): `useIsMobile()`-независимый механизм — `fetchWithTimeout()` (AbortController, 8с обычные запросы/10с пробивка), retry-логика (3 попытки × 5с), индикатор связи (WifiIcon в шапке, клик → попап статуса), auto-reload через 20с если восстановление не удалось, слушатель `window.addEventListener("online", ...)`
  - Сознательное решение: **НЕ** сохранять время пробивки локально при обрыве сети — при сбое пробивка просто не сохраняется, сотрудник сообщает вручную (чтобы не было рассинхрона данных)
- **Адаптивный дизайн для смартфонов** (начато 2026-09-06, продолжается): `useIsMobile()` хук (breakpoint 768px), тумблер стилей `isMobile ? {...} : {...}` везде, планшетная версия НЕ трогается
  - Шапка (mobile): grid 3 колонки (☰ / HannoSHIFT по центру / 📶), дата (26px) и время (18px) отдельными строками слева, кнопка ↻ скрыта, счётчик 出勤中 переехал в выпадающее меню ☰
  - Левый столбец (катакана-фильтр): `isMobile ? 48 : 68`px
  - Список сотрудников (mobile): `display: grid`, `repeat(auto-fill, minmax(100px, 1fr))`, gap 2px, `StaffCard` получил проп `isMobile` → фото 100×100, имя fontSize 12 (ellipsis, nowrap)
  - Бейдж времени прихода на карточке: только часы:минуты (`formatTimeShort`, без секунд), `top: 0` (было 5), fontSize `isMobile ? 12 : 14`
  - `PunchPopup` (mobile): модалка `calc(100vw-24px)` × `calc(100dvh-24px)`, камера `flex:1` (растягивается), кнопки 出勤/退勤/休憩/復帰 фиксированной высоты (пользователь вручную поставил 200px блок + доп. кнопка キャンセル 40px/14px под ним для закрытия — на смартфоне нет свободного места вне модалки для тап-закрытия)
  - Экран подтверждения (confirming) на mobile: кнопки в столбец (сначала цветная подтверждающая, потом キャンセル под ней — обратный порядок относительно планшета), `PopupClock` показывается на обеих версиях
  - ⚠️ Работа над адаптивом **не завершена**, продолжится в следующих сессиях

---

## 7) Инфраструктура / DevOps

### Docker (dev, с 2026-09-01)
- `docker-compose.yml` в корне — backend, report-service, postgres, frontend
- Backend/frontend — multi-stage build (Maven→JRE21, Node20→nginx:alpine)
- Postgres: `postgres:17`, named volume `hannoshift-pgdata` — **обязательно `external: true, name: hannoshift-pgdata`** в compose (иначе Compose создаёт новый volume с префиксом проекта и БД стартует пустой)
- Frontend nginx.conf: `/api/` и `/photos/` проксируются на `backend:8080` (по имени сервиса, не `localhost`)
- Три отдельные dev-базы перенесены с локального Windows-PostgreSQL в Docker: `shiftapp`(shiftuser), `hanno_banquets`(banquetsuser), `wordcards`(wordcardsuser) — локальная установка PostgreSQL на Windows удалена
- Известный баг: регистр букв в путях импортов (Windows нечувствителен, Linux-контейнер — чувствителен) — чинить через `git mv` в два шага
- Команды: см. `SERVER_INFO.md` §9 (up --build / stop / start / logs --tail / system prune)
- **Прод пока НЕ переведён на Docker** — план на будущее, деплой там всё ещё вручную (jar + systemd)

### Backup (прод, усилено 2026-09-01)
- `/opt/shift-app/backup.sh`, root crontab 03:00 ежедневно
- БД → `/mnt/backup-shift/` (сетевая шара на др. сервере 192.168.1.11) + Google Drive (`hannoshift-backups`, 90 дней)
- Фото → `/mnt/backup-shift/photo/` (rsync, только локально)
- Конфиги (application.yml, systemd юниты, nginx) → локально (10 версий) + Google Drive (`hannoshift-backups-config`, только последняя версия)
- Restore протестирован на тестовой базе — работает
- Полный план disaster recovery — в `SERVER_INFO.md` §7
- rclone remote: `gdrive` (настроен для `anadminsrv` и `root`)

---

## 8) Ловушки (актуальный список)

- `breakOverride` в state слота (фронт) → `breakOverrideMinutes` в JSON (бэк)
- `getAutoBreakMinutes()` должна быть ВНУТРИ `CellPopover`
- Flyway на dev отключён — все миграции применять вручную через SQL
- **PostgreSQL, не MySQL** — миграции и любой raw SQL писать под Postgres-синтаксис
- `toISOString()` в UTC+9 даёт неверную дату — использовать `currentMondayLocal()`, `addDays()`
- `getName()` → `localStorage.staffName` (не декодировать JWT)
- `RESTAURANT_ID = 1` захардкожен в KioskPage.jsx
- Удаление пользователя: shift_slots → preferences → time_records → users
- `ManagerUserController.unlock()` обязан быть `@Transactional`
- `ReportService.buildDay()`: `slot.endTime` передавать всегда реальным значением, даже при `last=true`
- `勤怠管理` リスト/Excel для `休憩時刻`: fallback на `officialBreakMinutes`, если нет реальной пробивки 休憩/復帰
- **`CustomUserDetails` не имеет `getId()`** — только `getUserId()`
- **Docker volume naming**: вручную созданный `docker volume create X` ≠ то же имя внутри compose без `external: true` — Compose добавляет префикс проекта и создаёт пустой volume молча
- **Git Bash на Windows** не наследует переменные окружения из `setx` — для тестовых команд с секретами использовать CMD/PowerShell либо вписывать значение прямо в команду
- **Google Drive API rate limit**: при частых последовательных `rclone copy` в тестах — `RATE_LIMIT_EXCEEDED`, нужна пауза `sleep 3` между вызовами в скриптах
- **ForgotClockoutScheduler**: не завязывать логику на "вчера" относительно текущей даты — если время проверки настроено близко к концу суток, "вчера" может быть неверным днём. Брать `workDate` из самой открытой сессии, проверять последние 2 дня
- **KioskPage.jsx мобильная вёрстка**: контейнеру модалки нужна **явная** высота (не только `maxHeight`), иначе flex-дети с `flex:1` могут схлопнуться в 0 на некоторых мобильных браузерах — использовать `calc(100dvh - Npx)`, не `min(640px, 92vh)` с неявной высотой
- Отчёты (Excel) — при добавлении новых visibleColumns-based колонок на фронте не забывать синхронно обновлять и `attendance_sessions.py` (COLUMN_DEFS/COLUMN_ORDER), и Java-сторону (payload)