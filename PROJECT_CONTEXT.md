# ShiftApp — PROJECT_CONTEXT

Цель файла: чтобы в новом чате не пересылать много кода.
Достаточно дать ссылку на этот файл + 1–3 ссылки на конкретные файлы задачи.

---

## 1) Главные решения проекта

- Репозиторий: **monorepo** (backend + frontend)
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

### 3.7 Restaurants
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
```

---

## 5) Frontend: ключевые файлы

### 5.1 `shared/api/api.js`

```js
login(login, password)
managerMonth(month)
managerStaffWeek(userId, weekStart)
managerStaffWeekSave(userId, weekStart, days)  // days: [{date, off, slots:[{startTime,endTime,last,workplace}]}]
managerEmployeesList/Create/Update/Delete
setWeekStatus(weekStart, status)
staffWeeks(month) / staffWeek(weekStart) / staffWeekSave(weekStart, days) / staffCopyPrev(weekStart)
settingsWorkplacesList/Create/Update/Delete
settingsPositionsList/Create/Update/Delete
settingsDepartmentsList/Create/Update/Delete
```

**`clearToken()`** очищает: accessToken, appRole, staffName, managerView, staffSelectedMonth, staffSelectedWeek, managerSelectedMonth

### 5.2 `app/App.jsx`

- Нет токена → `LoginPage`
- `STAFF` → `StaffMonthPage`
- `MANAGER/ADMIN` по `managerView`: `PREFS` / `EMPLOYEES` / `SETTINGS` / `SHIFTS` (default)
- **Автологаут** — `useEffect` слушает события мыши/клавиатуры/касания, сбрасывает таймер 30 мин:
```js
const TIMEOUT = 30 * 60 * 1000;
const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
```

### 5.3 Layouts

- **`ManagerLayout.jsx`** — sidebar: `SHIFTS` 📅, `EMPLOYEES` 👥, `SETTINGS` ⚙️
- **`AppShell.module.css`** — стили sidebar + `.centeredContent`
- Sidebar: `56px` → `220px` при hover, `position: fixed`, контент `margin-left: 56px`

### 5.4 Pages

- **`ManagerTablePage.jsx`**:
  - Sticky: **職種・役職** (`left:0`, 70px), **氏名** (`left:70px`, 140px)
  - `rowSpan` по `maxSlots`, workplace под временем серым текстом
  - Попап `CellPopover`: `position: fixed` + `getBoundingClientRect()`
  - Месяц в `localStorage.managerSelectedMonth`

- **`EmployeesPage.jsx`**: position → `<select>`, 部署 → чекбоксы (ManyToMany)
- **`SettingsPage.jsx`**: табы 勤務場所 / 職種・役職 / 部署
- **`LoginPage.jsx`**: лого + HannoSHIFT в шапке

### 5.5 Staff компоненты

- **`StaffMonth.jsx`**: месяц и неделя в localStorage, восстанавливаются после перезагрузки
- **`StaffWeek.jsx`**:
  - Видит earliest/latest (бэкенд), не может ставить L
  - Подсказки: при `RECEIVING` — серый текст, при `CONFIRMED` — предупреждение
  - `saving` и `copying` state — блокируют кнопки на время запроса
  - Валидация до `setSaving(true)` — при ошибке кнопка не блокируется

### 5.6 Mobile / UX

- `globals.css`: `font-size: max(16px, 1em)` — предотвращает автозум iOS
- `LoginForm.jsx`: `font-size: 16px`, сброс зума viewport после логина
- `StaffMonth/Week.module.css`: убран `min-height`, `table-layout: fixed`
- `main.jsx`: **StrictMode убран** — иначе двойной рендер = двойные запросы

---

## 6) Статусы смен

```
RECEIVING  受付中  #F0F0F0
DRAFTING   作成中  #F6EAB3
CONFIRMED  確定    #85A175
```

---

## 7) Функция L и мульти-слоты

- `last=true` = работает до конца, endTime=null
- Сотрудник видит L но не может ставить
- Копирование (`staffCopyPrevWeek`): если есть L → только earliest startTime, endTime=null; без L → всё как есть
- Менеджер: до 5 слотов на день, каждый со своим workplace/временем

---

## 8) Деплой и запуск

**Dev:**
```bash
cd backend && mvn spring-boot:run
cd frontend && npm run dev           # localhost
cd frontend && npm run dev -- --host  # + локальная сеть
```
`.env.local`: `VITE_API_BASE=http://192.168.1.19:8080` для тестов на телефоне

**Production:** nginx → `/var/www/shift-app/`, Spring Boot jar
- Мануал: `sudo cp manual.pdf /var/www/shift-app/manual.pdf` → `https://hanno-shift.duckdns.org/manual.pdf`

---

## 9) Ловушки

- `ManagerWeekResponse.rows` — не `staff`
- `ManagerStaffWeekController` и `ManagerWeekController./week/save` — оба используют `ManagerStaffWeekSaveRequest`
- `ShiftSlotRepository` — в пакете `preferences`, не `weeks`
- `Preference` — нет `startTime/endTime/isLast`, всё в `ShiftSlot`
- `UserRepository` — `LEFT JOIN FETCH u.departments` обязателен (LazyInitializationException)
- `ManagerMonthController` — 3 запроса на месяц, не N×3
- `StrictMode` убран из `main.jsx`
- Попап — `position: fixed` + `getBoundingClientRect()`
- iOS автозум — `font-size: max(16px, 1em)`
- Автологаут — 30 мин, в `App.jsx`, сбрасывается любым действием пользователя