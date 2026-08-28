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

---

## 2) Структура репозитория

- `backend/` — Spring Boot (Java, Maven)
- `frontend/` — React (Vite)
- `report-service/` — Python FastAPI (Excel-отчёты)

---

## 3) Backend: ключевые модули

### 3.1 Auth / Security
- `JwtService.java` — claims: uid, rid, role, fullName
- `AuthController.java` — `POST /api/auth/login`
- `SecurityConfig.java` — CORS: localhost:5173, 192.168.1.19:5173, hanno-shift.duckdns.org

### 3.2 Users
- `User.java` — id, restaurant, login, passwordHash, role, fullName, fullNameKana,
  position, departments, active, lastName/firstName/Kana, email, phone, address, birthDate, gender
- `UserRole.java` — STAFF, MANAGER, ADMIN, KIOSK

### 3.3 Preferences и ShiftSlots
- `Preference.java` — workDate, off, slots (OneToMany), version (@Version)
- `ShiftSlot.java` — slotOrder, startTime, endTime, last, workplace, nextDay, **breakOverrideMinutes**
- `nextDay=true` — смена переходит на следующий день
- `breakOverrideMinutes` — ручной override перерыва (null = автоматический по правилам)

### 3.4 Weeks (менеджерское редактирование смен)
- `ManagerMonthController.java` — `GET /api/manager/month?month=YYYY-MM` или `?from=&to=` (7–50 дней)
- `ManagerStaffWeekController.java` — `GET/POST /api/manager/staff-week`
- `WeekService.java` — вся логика сохранения смен
- Показывает STAFF + MANAGER

### 3.5 Months (новый — месячный статус и стафф-ввод)
Пакет `com.shiftapp.months`:
- `MonthStatus.java` — entity: restaurant, yearMonth, **half (1 или 2)**, status, updatedBy, updatedAt
- `MonthStatusRepository.java` — `findByRestaurant_IdAndYearMonthAndHalf(Long, String, int)`
- `MonthStatusController.java` — `GET/POST /api/manager/month-status?month=&status=&half=`
  - GET возвращает `{status1, status2}`
  - POST меняет статус конкретной половины месяца
- `StaffMonthController.java` — `/api/staff/month` (GET) и `/api/staff/month/save` (POST)
  - GET возвращает `{status1, status2, days[]}`
  - POST сохраняет только дни где статус половины = RECEIVING
- `SaveMonthRequest.java` — `{month, days: [{date, off, startTime, endTime}]}`

### 3.6 Break Rules (настройки перерывов)
Пакет `com.shiftapp.settings.breakrule`:
- `BreakRule.java` — name, thresholdMinutes, breakMinutes
- `BreakRuleController.java` — CRUD `/api/manager/settings/break-rules`
- Логика: из всех подходящих правил (`duration > thresholdMinutes`) выбирается с наибольшим порогом

### 3.7 Kiosk
- `KioskService.java` — статус, punch, фото
- Смена открыта до явного 退勤, независимо от даты
- После 退勤 — новый 出勤 разрешён

### 3.8 Attendance
- `GET /api/manager/attendance?from=&to=`
- `PUT /api/manager/attendance/{id}`

### 3.9 Settings
- workplaces, positions, departments, **breakrules** — `/api/manager/settings/`

### 3.10 Reports
- `ReportController.java` — прокси к Python FastAPI (порт 8001)

### 3.11 Login Security (段階的アカウントロック)
 
- `AuthController.login()` — при каждой неудачной попытке вызывает `registerFailedAttempt()`
- Эскалация по **суммарному числу неудачных попыток** (не сбрасывается временем, только успешным входом):
  - 5 → `lockLevel=1`, `lockedUntil = now+10мин`
  - 10 → `lockLevel=2`, `lockedUntil = now+30мин`
  - 15 → `lockLevel=3`, `lockedUntil = now+3ч`
  - 20 → `lockLevel=4`, `accountLocked=true` (навсегда, снимается только менеджером)
- Счётчик **по логину**, без привязки к IP (осознанное упрощение — данные некритичные, риск намеренной блокировки чужого аккаунта принят как допустимый)
- Пока `lockedUntil` не истёк — **любая** попытка (даже с верным паролем) отклоняется, счётчик/таймер не трогается (иначе можно продлевать блокировку бесконечно)
- Успешный вход → полный сброс (`failedLoginAttempts=0`, `lockLevel=0`, `lockedUntil=null`)
- Разблокировка менеджером — `POST /api/manager/employees/{id}/unlock`, встроена в `EmployeesPage.jsx` как чекбокс `🔓 ロックを解除する` под `アクティブ` в модалке редактирования (не отдельная кнопка в таблице)
---

## 4) SQL миграции (применены вручную — Flyway отключён на dev)

```
V1__init.sql
V2__shift_unique_per_user_per_day.sql
V3〜V9  — workplaces, departments, lock, time_records, kana, kiosk, profile
V10__add_next_day_flag.sql      — next_day BOOLEAN на shift_slots
V11__add_break_rules.sql        — break_rules таблица
V12__add_break_override.sql     — break_override_minutes на shift_slots
V13__add_month_status.sql       — month_status таблица
V14__add_month_status_half.sql  — half INT + UNIQUE(restaurant_id, year_month, half)
V15__add_login_lock.sql — failed_login_attempts, lock_level, locked_until, account_locked на users
```

**Важно**: Flyway на dev отключён (`flyway.enabled: false`), миграции применяются вручную через SQL-клиент.

---

## 5) application.yml

### Dev
```yaml
spring:
  jpa.hibernate.ddl-auto: update
  flyway.enabled: false
  web.resources.static-locations: file:C:/shift-app/,classpath:/static/
kiosk:
  photo-dir: C:/shift-app/photos/
  photo-url-prefix: /photos/
```

### Prod
```yaml
spring:
  flyway:
    enabled: true
    baseline-on-migrate: true
    baseline-version: 5
  jpa.hibernate.ddl-auto: validate
```

---

## 6) Frontend: ключевые файлы

### api.js — методы
```js
// Staff month
staffMonth(month), staffMonthSave(month, days)

// Manager month status
managerMonthStatus(month)              // GET → {status1, status2}
managerMonthStatusSet(month, status, half)  // POST

// Break rules
settingsBreakRulesList()
settingsBreakRulesCreate(payload)
settingsBreakRulesUpdate(id, payload)
settingsBreakRulesDelete(id)

// Attendance
attendanceRecords(from, to), attendanceEdit(id, payload)

// Shifts
managerMonth(month), managerRange(from, to)
managerStaffWeekSave(userId, weekStart, days)

// Settings
settingsWorkplaces/Positions/Departments CRUD
managerEmployees CRUD
```

### StaffMonth.jsx (`features/staffShift/components/`)
- Использует `StaffWeek.module.css`
- Месячный вид вместо недельного
- Два блока: 1〜15日 и 16〜末日
- Каждый блок: заголовок + дедлайн + toolbar (время + 3 кнопки) + статус + таблица
- Одна кнопка 更新 внизу
- `editable1 = status1 === "RECEIVING"`, `editable2 = status2 === "RECEIVING"`
- L флаг: показывается вместо времени окончания если менеджер поставил Last

### ManagerTablePage.jsx
- Режимы: 月/週/期間 (максимум 50 дней для 期間)
- TopBar: два статуса месяца `1〜15日:[▼]` `16〜末日:[▼]` (только в режиме 月)
- Колонки в конце: 公休数 + 勤務時間 (фон #f8faff, заголовок #f0f4ff)
- `calcWorkMinutes(userId)` — суммирует слоты за день, применяет правило перерыва
  - Если `breakOverrideMinutes` задан — использует его вместо автоматического
- `CellPopover` — подсказки 🕐合計 / ⏱休憩（кликабельный дропдаун）/ ⏰実働
  - `getAutoBreakMinutes()` — ВНУТРИ CellPopover (доступ к breakRules и toMinutesLocal)
  - `breakOverride` в state слота инициализируется из `s.breakOverrideMinutes`
  - При сохранении передаётся как `breakOverrideMinutes` в JSON

### AttendancePage.jsx
- Время отображается с секундами (убрано `.slice(0,5)`)
- Фильтр по цвету статуса: 🟢/🔴/🟡/🔵/⚪

### SettingsPage.jsx
- Табы: 勤務場所 / 職種・役職 / 部署 / **休憩ルール**
- 休憩ルール: название + порог (мин) + время перерыва (мин)

---

## 7) Ловушки

- `breakOverride` в state слота (фронт) → `breakOverrideMinutes` в JSON (бэк)
- `getAutoBreakMinutes()` должна быть ВНУТРИ `CellPopover`
- При инициализации слотов: `breakOverride: s.breakOverrideMinutes ?? null`
- `month_status` UNIQUE(restaurant_id, year_month, half) — старый метод `findByRestaurant_IdAndYearMonth` удалён
- `staffMonth` GET возвращает `{status1, status2, days}` — не `{status, days}`
- `saveMonth` пропускает дни заблокированной половины
- Flyway на dev отключён — все миграции применять вручную через SQL
- `toISOString()` в UTC+9 даёт неверную дату — использовать `currentMondayLocal()`, `addDays()`
- `getName()` → `localStorage.staffName` (не декодировать JWT)
- CSS `border-bottom` на `<tr>` не работает — только на `<td>`
- `RESTAURANT_ID = 1` захардкожен в KioskPage.jsx
- Удаление пользователя: shift_slots → preferences → time_records → users
- `ManagerUserController.unlock()` обязан быть `@Transactional` — `UserResponse.from()` трогает `user.getDepartments()` (lazy), без транзакции падает `LazyInitializationException`
- В `ReportService.buildDay()` поле `slot.endTime` нужно передавать **всегда** реальным значением, даже если `last=true` — иначе питон-стороне (`shift_dept.py`/`shift_all.py`) нечем считать длительность/休憩 для L-слотов. Флаг `last` использовать только для решения "показать L вместо времени", не для сокрытия самого времени
- `勤怠管理` リスト/Excel-отчёт (`attendance_sessions.py`) для `休憩時刻`: если нет реальной пробивки `休憩`/`復帰`, нужен fallback на `officialBreakMinutes` (авторасчёт из `computeSessionOfficial()`) — иначе リスト расходится с `カレンダー`, где этот фолбэк уже был