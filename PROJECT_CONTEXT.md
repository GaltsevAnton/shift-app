# ShiftApp — PROJECT_CONTEXT

Цель файла: чтобы в новом чате не пересылать много кода.
Достаточно дать ссылку на этот файл + 1–3 ссылки на конкретные файлы задачи.

---

## 1) Главные решения проекта

- Репозиторий: **monorepo** (backend + frontend + report-service)
- **Единая сущность пользователя** (`com.shiftapp.users`) — и менеджеры, и персонал.
  Роли: `STAFF`, `MANAGER`, `ADMIN`
- JWT-аутентификация: единый логин `/api/auth/login`, роль в claim `role`, имя в claim `fullName`
- Доступы: `/api/manager/**` → MANAGER, `/api/staff/**` → STAFF или MANAGER
- Frontend: токен в `localStorage.accessToken`, роль в `localStorage.appRole`, имя в `localStorage.staffName`
- Навигация менеджера: `localStorage.managerView` — значения: `SHIFTS`, `PREFS`, `EMPLOYEES`, `SETTINGS`
- Сохранение состояния: `staffSelectedMonth`, `staffSelectedWeek`, `managerSelectedMonth` в localStorage
- Все эти ключи очищаются в `clearToken()` при логауте
- **Автологаут**: 30 минут бездействия → автоматический выход (в `App.jsx`)
- Название приложения: **HannoSHIFT** (ホテル・ヘリテイジ / 飯能 sta.)

---

## 2) Структура репозитория

- `backend/` — Spring Boot (Java, Maven)
- `frontend/` — React (Vite)
- `report-service/` — Python FastAPI (Excel-отчёты)

---

## 3) Backend: ключевые модули и файлы

### 3.1 Auth / Security
`backend/src/main/java/com/shiftapp/auth`

- **`JwtService.java`** — создаёт JWT с claims: `uid`, `rid`, `role`, `fullName`
- **`AuthController.java`** — `POST /api/auth/login`
  - Ошибки на японском: `ログインIDまたはパスワードが正しくありません`, `このアカウントは無効です`
  - `LoginRequest.java` — `@NotBlank` с японскими сообщениями валидации
- **`security/CustomUserDetails.java`** — методы: `getUserId()`, `getRestaurantId()`, `getRole()`, `getFullName()`

### 3.2 Common
`backend/src/main/java/com/shiftapp/common`

- **`GlobalExceptionHandler.java`** — `@RestControllerAdvice`, обрабатывает `RuntimeException` и `MethodArgumentNotValidException`, возвращает `{"message": "..."}` с HTTP 400/403
- **`SecurityConfig.java`** — CORS разрешён для `localhost:5173`, `192.168.1.19:5173`, `hanno-shift.duckdns.org`

### 3.3 Users
`backend/src/main/java/com/shiftapp/users`

- **`User.java`** — поля: id, restaurant, login, passwordHash, role, fullName, **position** (nullable), **departments** (ManyToMany → `user_departments`), active, createdAt
- **`UserResponse.java`** — включает `position` и `departments: [{id, name}]`
- **`UserCreateRequest.java`** — login, fullName, position, **departmentIds: List\<Long\>**, role, password
- **`UserUpdateRequest.java`** — login, fullName, position, **departmentIds: List\<Long\>**, role, active, password
- **`UserRepository.java`** — `findAllByRestaurant_IdOrderByIdDesc` с `LEFT JOIN FETCH u.departments`
- **`ManagerUserController.java`** — `/api/manager/employees` (CRUD)

### 3.4 Preferences и ShiftSlots
`backend/src/main/java/com/shiftapp/preferences`

- **`Preference.java`** — id, restaurant, user, workDate, **off** (`is_off`), slots (OneToMany), status, comment
  - `startTime`, `endTime`, `is_last` удалены → переехали в `shift_slots`
- **`ShiftSlot.java`** — id, preference, slotOrder, startTime, endTime, **last** (`is_last`), **workplace**
  - До **5 слотов** на день
- **`PreferenceRepository.java`** — методы с и без `WithSlots` (JOIN FETCH)
- **`ShiftSlotRepository.java`** — пакет `com.shiftapp.preferences`

### 3.5 Weeks
`backend/src/main/java/com/shiftapp/weeks`

- **`WeekService.java`**:
  - `buildDayForStaff` — earliest start, latest end (или last=true)
  - `buildDayForManager` — flat + slots
  - `staffSaveWeek` — валидация времён, один слот
  - `staffCopyPrevWeek` — если есть L: копирует только earliest startTime, endTime=null; если нет L: всё как есть
  - `managerSaveStaffWeek` — массив слотов с workplace и isLast

- **`ManagerMonthController.java`** — оптимизирован: **3 SQL запроса** на весь месяц
- **`WeekStatusRepository.java`** — `findByRestaurant_IdAndWeekStartBetween`
- **`ManagerStaffWeekController.java`** — POST принимает `ManagerStaffWeekSaveRequest`

### 3.6 Settings
`backend/src/main/java/com/shiftapp/settings`

- **`workplace/`** — `/api/manager/settings/workplaces`
- **`position/`** — `/api/manager/settings/positions`
- **`department/`** — `/api/manager/settings/departments`

### 3.7 Reports
`backend/src/main/java/com/shiftapp/reports`

- **`ReportController.java`** — прокси к Python-сервису, эндпоинты:
  - `GET /api/manager/reports/shift/all?ym=` — сводный шифт всех сотрудников
  - `GET /api/manager/reports/shift/dept?ym=&department=` — шифт по отделу
  - `GET /api/manager/reports/timesheet?ym=` — табель учёта рабочего времени
  - `POST /api/manager/reports/shift/filtered?ym=` — шифт по выбранным userId (body: `List<Long>`)
- **`ReportService.java`** — собирает данные из БД, вызывает FastAPI через `RestTemplate`
  - Важно: `objectMapper.writeValueAsBytes(payload)` — UTF-8 без системной кодировки Windows
  - `report.service.url` из `application.yml` (default: `http://localhost:8001`)
  - hotelName захардкожен как `static final` (не из yml — проблема кодировки Windows)

### 3.8 Restaurants
- **`Restaurant.java`** — id, name

---

## 4) SQL миграции (выполнены вручную)

```sql
ALTER TABLE users ADD COLUMN position VARCHAR(100);

CREATE TABLE shift_slots (
    id BIGSERIAL PRIMARY KEY,
    preference_id BIGINT NOT NULL REFERENCES preferences(id) ON DELETE CASCADE,
    slot_order INT NOT NULL DEFAULT 0,
    start_time TIME, end_time TIME,
    is_last BOOLEAN NOT NULL DEFAULT FALSE,
    workplace VARCHAR(100)
);
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS is_off BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE preferences DROP COLUMN IF EXISTS start_time;
ALTER TABLE preferences DROP COLUMN IF EXISTS end_time;
ALTER TABLE preferences DROP COLUMN IF EXISTS is_last;
CREATE INDEX idx_shift_slots_preference_id ON shift_slots(preference_id);

CREATE TABLE workplaces (id BIGSERIAL PRIMARY KEY, restaurant_id BIGINT NOT NULL REFERENCES restaurants(id), name VARCHAR(100) NOT NULL);
CREATE TABLE positions  (id BIGSERIAL PRIMARY KEY, restaurant_id BIGINT NOT NULL REFERENCES restaurants(id), name VARCHAR(100) NOT NULL);
CREATE TABLE departments(id BIGSERIAL PRIMARY KEY, restaurant_id BIGINT NOT NULL REFERENCES restaurants(id), name VARCHAR(100) NOT NULL);

ALTER TABLE users DROP COLUMN IF EXISTS department;
CREATE TABLE user_departments (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, department_id)
);

ALTER TABLE preferences ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
```

---

## 5) Report Service (Python FastAPI)

### 5.1 Структура
```
report-service/
  main.py               # FastAPI app, port 8001
  models.py             # Pydantic: ReportRequest, StaffModel, DayModel, SlotModel
  requirements.txt      # fastapi, uvicorn, openpyxl, pydantic
  routers/shift.py      # POST /generate/shift/dept|all, /generate/timesheet
  builders/
    shift_dept.py       # Шифт по отделу (4-строчный формат: 出勤/退勤/職場)
    shift_all.py        # Сводный шифт всех сотрудников
    timesheet.py        # Табель учёта рабочего времени
  shift-report.service  # systemd unit для прода
```

### 5.2 Запуск (Windows dev)
```bash
cd report-service
source venv/Scripts/activate
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
Или через `start.bat` в папке `report-service`.

### 5.3 Настройки печати в builders
- `landscape`, A4, fitToPage, узкие поля — настраивается в каждом builder перед `buf = io.BytesIO()`

### 5.4 Ловушки report-service
- `hotelName` в `ReportService.java` — `static final String`, не из yml (кодировка Windows)
- Spring Boot → FastAPI: использовать `RestTemplate` + `objectMapper.writeValueAsBytes()`, не `HttpClient`
- `Content-Type: application/json` без `; charset=utf-8` — FastAPI не принимает с charset
- venv не коммитить в git (`.gitignore`: `report-service/venv/`)

---

## 6) Frontend: ключевые файлы

### 6.1 `shared/api/api.js`

```js
login(login, password)
managerMonth(month)
managerStaffWeek(userId, weekStart)
managerStaffWeekSave(userId, weekStart, days)
managerEmployeesList/Create/Update/Delete
setWeekStatus(weekStart, status)
staffWeeks(month) / staffWeek(weekStart) / staffWeekSave(weekStart, days) / staffCopyPrev(weekStart)
settingsWorkplacesList/Create/Update/Delete
settingsPositionsList/Create/Update/Delete
settingsDepartmentsList/Create/Update/Delete
// Reports (через fetchBlob):
reportShiftAll(ym)
reportShiftDept(ym, department)
reportTimesheet(ym)
reportShiftFiltered(ym, userIds)  // POST с body: JSON.stringify(userIds)
```

**`fetchBlob(path, options)`** — скачивает файл, читает `Content-Disposition` для имени файла.

**`clearToken()`** очищает: accessToken, appRole, staffName, managerView, staffSelectedMonth, staffSelectedWeek, managerSelectedMonth, mgrFilterPos, mgrFilterDept, mgrFilterWp, mgrColVisibility

### 6.2 `app/App.jsx`

- Нет токена → `LoginPage`
- `STAFF` → `StaffMonthPage`
- `MANAGER/ADMIN` по `managerView`: `PREFS` / `EMPLOYEES` / `SETTINGS` / `SHIFTS` (default)
- **Автологаут** — 30 мин бездействия

### 6.3 Layouts

- **`ManagerLayout.jsx`** — sidebar: `SHIFTS` 📅, `EMPLOYEES` 👥, `SETTINGS` ⚙️
- Sidebar: `56px` → `220px` при hover, `position: fixed`, контент `margin-left: 56px`

### 6.4 Pages

- **`ManagerTablePage.jsx`**:
  - Sticky колонки: **職種・役職** (70px), **部署** (90px), **氏名** (140px)
  - 部署 отображается в колонку (через `<div>` на каждый отдел)
  - **SortBar** — фильтры, сортировка, управление столбцами
  - **Кнопка 📥 Excel** — `xlsx-js-style`, стилизованный экспорт (`import * as XLSX from "xlsx-js-style"`)
  - **Кнопка 📊 レポート▼** — дропдаун с 4 типами отчётов:
    - 📋 全員シフト表
    - 🏢 部署別シフト表 (требует ровно 1 выбранный отдел)
    - 🕐 勤怠集計表
    - 🔍 選択中スタッフのシフト表
  - **AlertModal** — красивый попап вместо `alert()`
  - **Shift+клик** — выделение нескольких ячеек одного сотрудника (`selectedCells`)
    - Панель внизу: `N日選択中` + `✏️ 一括編集` + `✕ 選択解除`
    - `BulkPopover` — попап массового редактирования (стиль как CellPopover)
    - `saveBulkCells(patch)` — группирует по неделям, сохраняет через `managerStaffWeekSave`
  - **Правая кнопка мыши** — контекстное меню (`ContextMenu`):
    - ✏️ 編集 — открыть CellPopover
    - 📋 このパターンをコピー — копирует `{off, slots}` в `copiedPattern`
    - 📅 コピーを適用 / `N日に適用` — вставляет в одну ячейку или все выделенные
  - `user-select: none` на `.table` — предотвращает выделение текста при Shift+клик

- **`EmployeesPage.jsx`**: position → `<select>`, 部署 → чекбоксы (ManyToMany)
- **`SettingsPage.jsx`**: табы 勤務場所 / 職種・役職 / 部署
- **`LoginPage.jsx`**: лого + HannoSHIFT в шапке

### 6.5 Staff компоненты

- **`StaffMonth.jsx`**: месяц и неделя в localStorage
- **`StaffWeek.jsx`**: видит earliest/latest, не может ставить L

### 6.6 Mobile / UX

- `globals.css`: `font-size: max(16px, 1em)` — предотвращает автозум iOS
- `main.jsx`: **StrictMode убран**

---

## 7) Статусы смен

```
RECEIVING  受付中  #F0F0F0
DRAFTING   作成中  #F6EAB3
CONFIRMED  確定    #85A175
```

---

## 8) Функция L и мульти-слоты

- `last=true` = работает до конца, endTime=null
- Сотрудник видит L но не может ставить
- Менеджер: до 5 слотов на день, каждый со своим workplace/временем

---

## 9) Деплой и запуск

**Dev:**
```bash
cd backend && mvn spring-boot:run
cd frontend && npm run dev
cd report-service && source venv/Scripts/activate && uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

**Production:**
- nginx → `/var/www/shift-app/`, Spring Boot jar
- report-service → systemd `shift-report.service`, порт 8001 (только localhost)
- Spring Boot проксирует `/api/manager/reports/**` → `http://localhost:8001`

---

## 10) Ловушки

- `ManagerWeekResponse.rows` — не `staff`
- `ShiftSlotRepository` — в пакете `preferences`, не `weeks`
- `Preference` — нет `startTime/endTime/isLast`, всё в `ShiftSlot`
- `UserRepository` — `LEFT JOIN FETCH u.departments` обязателен (LazyInitializationException)
- `ManagerMonthController` — 3 запроса на месяц, не N×3
- `StrictMode` убран из `main.jsx`
- Попап — `position: fixed` + `getBoundingClientRect()`
- iOS автозум — `font-size: max(16px, 1em)`
- Автологаут — 30 мин, в `App.jsx`
- Excel экспорт — `import * as XLSX from "xlsx-js-style"` (не xlsx!)
- Фильтры localStorage очищать в `clearToken()`: `mgrFilterPos`, `mgrFilterDept`, `mgrFilterWp`, `mgrColVisibility`
- ReportService: `hotelName` — `static final`, не из yml
- ReportService: `RestTemplate` + `writeValueAsBytes()`, не `HttpClient`
- ContextMenu: НЕ сбрасывать `selectedCells` при правом клике (иначе теряется выделение)
- venv не коммитить (`report-service/venv/` в `.gitignore`)