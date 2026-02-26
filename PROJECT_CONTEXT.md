# ShiftApp — PROJECT_CONTEXT

Цель файла: чтобы в новом чате не пересылать много кода.
Достаточно дать ссылку на этот файл + 1–3 ссылки на конкретные файлы задачи.

---

## 1) Главные решения проекта (фиксируем)

- Репозиторий: **monorepo** (backend + frontend)
- **Единая сущность пользователя** (`com.shiftapp.users`) — и менеджеры, и персонал.
  Роли различаются через `UserRole`: `STAFF`, `MANAGER`, `ADMIN`
- Пакет `com.shiftapp.employees` — **удалён полностью**
- JWT-аутентификация:
  - Единый логин для всех: `/api/auth/login`
  - Роль зашита в JWT claim `role`
- Доступы:
  - `/api/manager/**` → роль MANAGER
  - `/api/staff/**` → роль STAFF или MANAGER
- Frontend:
  - Токен хранится в `localStorage.accessToken`
  - Роль UI хранится в `localStorage.appRole` — читается из JWT payload (`atob`)
  - Навигация менеджера: `localStorage.managerView` — значения: `SHIFTS`, `PREFS`, `EMPLOYEES`

---

## 2) Структура репозитория

- `backend/` — Spring Boot (Java, Maven)
- `frontend/` — React (Vite)

---

## 3) Backend: ключевые модули и файлы

### 3.1 Auth / Security
Папка: `backend/src/main/java/com/shiftapp/auth`

- **`AuthController.java`** — `POST /api/auth/login`, возвращает JWT
- **`JwtService.java`** — создаёт/читает JWT (userId, restaurantId, role)
- **`JwtAuthFilter.java`** — фильтр, кладёт пользователя в SecurityContext
- **`dto/LoginRequest.java`** — `{ login, password }`
- **`dto/LoginResponse.java`** — `{ accessToken }`
- **`security/CustomUserDetails.java`** — обёртка над User для Spring Security
- **`security/CustomUserDetailsService.java`** — загружает пользователя по username

### 3.2 Common / App config
Папка: `backend/src/main/java/com/shiftapp/common`

- **`SecurityConfig.java`** — правила доступа, CORS (localhost:5173)
- **`CurrentUser.java`** — `require()` → `CustomUserDetails` (userId, restaurantId, role)
- **`HealthController.java`** — `GET /api/health` → "OK"
- **`SecurityBeans.java`** — BCrypt PasswordEncoder
- **`SeedData.java`** — тестовые данные при старте (`@Profile("!prod")`):
  - ресторан "Hanno Restaurant"
  - менеджер `manager / manager123`
  - сотрудник `anton / pass123`

### 3.3 Users
Папка: `backend/src/main/java/com/shiftapp/users`

- **`User.java`** — таблица `users`: id, restaurant, login, passwordHash, role, fullName, active, createdAt
- **`UserRepository.java`** — findByLogin, existsByLogin, findByIdAndRestaurant_Id, findAllByRestaurant_IdOrderByIdDesc, findByRestaurant_IdAndRoleOrderByFullNameAsc
- **`UserRole.java`** — enum: `STAFF`, `MANAGER`, `ADMIN`
- **`UserService.java`** — CRUD пользователей, BCrypt хэш
- **`ManagerUserController.java`** — `/api/manager/employees` (CRUD)
- **`dto/UserCreateRequest.java`** — `{ login, fullName, role, password }`
- **`dto/UserUpdateRequest.java`** — `{ login, fullName, role, active, password? }`
- **`dto/UserResponse.java`** — без passwordHash, статический метод `from(User u)`

### 3.4 Preferences
Папка: `backend/src/main/java/com/shiftapp/preferences`

- **`Preference.java`** — таблица `preferences`, колонка `employee_id` (`@JoinColumn(name="employee_id")`)
- **`PreferenceRepository.java`** — findByUser_IdAndWorkDate, findByUser_IdAndWorkDateBetween, findByRestaurant_IdAndWorkDateBetween
- **`PreferenceService.java`** — upsertForUser, получить за период
- **`StaffPreferenceController.java`** — `/api/staff/...`
- **`ManagerPreferenceController.java`** — `/api/manager/...`
- **`dto/UpsertPreferenceRequest.java`** — date, startTime, endTime, comment
- **`dto/PreferenceResponse.java`** — все поля + userId, userName
- **`PreferenceStatus.java`** — enum: DRAFT, SUBMITTED

### 3.5 Weeks
Папка: `backend/src/main/java/com/shiftapp/weeks`

- **`WeekService.java`** — вся бизнес-логика недель:
  - `staffWeeks(restaurantId, ym)` — список недель месяца
  - `staffWeek(restaurantId, userId, weekStart)` — детали недели для сотрудника
  - `staffSaveWeek(...)` — сохранить пожелания (только если статус RECEIVING)
  - `staffCopyPrevWeek(...)` — скопировать с прошлой недели
  - `managerWeeks(restaurantId, ym)` — список недель (= staffWeeks)
  - `managerWeek(restaurantId, weekStart)` — неделя со всеми сотрудниками → `ManagerWeekResponse`
  - `managerSaveStaffWeek(restaurantId, managerId, req)` — сохранить без проверки статуса
  - `managerSetWeekStatus(restaurantId, managerId, weekStart, status)` — сменить статус

- **`WeekStatus.java`** — таблица статусов недель
- **`WeekStatusRepository.java`** — findByRestaurant_IdAndWeekStart
- **`WeekStatusType.java`** — enum: `RECEIVING`, `DRAFTING`, `CONFIRMED`

- **Контроллеры:**
  - `StaffWeekController.java` — `/api/staff/weeks`, `/api/staff/week`, `/api/staff/week/save`, `/api/staff/week/copy-prev`
  - `ManagerWeekController.java` — `/api/manager/weeks`, `/api/manager/week`, `/api/manager/week/save`
  - `ManagerWeekStatusController.java` — `POST /api/manager/week-status?weekStart=&status=`
  - ~~`ManagerWeeksController.java`~~ — **удалён** (дублировал `/api/manager/weeks`)
  - `ManagerStaffWeekController.java` — `/api/manager/staff-week`, `/api/manager/staff-week/save`

- **DTO:**
  - `WeekRowResponse` — weekStart, weekEnd, status
  - `StaffWeekResponse` — status, List\<StaffWeekDay\>
  - `StaffWeekDay` — date, off, startTime, endTime
  - `StaffWeekSaveRequest` — weekStart, List\<DayInput\>
  - `ManagerWeekResponse` — status, List\<ManagerStaffWeekRow\>
  - `ManagerStaffWeekRow` — userId, userName, List\<StaffWeekDay\>
  - `ManagerWeekSaveRequest` — weekStart, userId, List\<DayInput\>

### 3.6 Shifts
Папка: `backend/src/main/java/com/shiftapp/shifts`

- **`Shift.java`** — таблица `shifts` (утверждённое расписание)
- **`ShiftRepository.java`**, **`ShiftService.java`**
- **`ManagerShiftController.java`** — bulk-сохранение, копирование недели
- **`dto/BulkShiftRequest.java`**, **`dto/BulkShiftItem.java`**, **`dto/CopyWeekRequest.java`**
- **`ShiftStatus.java`** — enum статуса смены

### 3.7 Restaurants
Папка: `backend/src/main/java/com/shiftapp/restaurants`

- **`Restaurant.java`** — таблица `restaurants`: id, name
- **`RestaurantRepository.java`**

---

## 4) Frontend: ключевые файлы

Папка: `frontend/src`

### 4.1 API client — `shared/api/api.js`

Все методы объекта `api`:

```js
// AUTH
login(login, password)

// MANAGER USERS
managerUsers()

// MANAGER SHIFTS
managerShifts(from, to)
bulkShifts(shifts)
copyWeek(fromWeekStart, toWeekStart, overwrite)

// MANAGER WEEKS
managerWeeks(month)           // GET /api/manager/weeks?month=
managerWeek(weekStart)        // GET /api/manager/week?weekStart=
managerWeekSave(weekStart, userId, days)  // POST /api/manager/week/save
setWeekStatus(weekStart, status)          // POST /api/manager/week-status?weekStart=&status=

// MANAGER STAFF WEEK
managerStaffWeek(userId, weekStart)
managerStaffWeekSave(userId, weekStart, days)

// MANAGER EMPLOYEES
managerEmployeesList()
managerEmployeesCreate(payload)
managerEmployeesUpdate(id, payload)
managerEmployeesDelete(id)

// STAFF
staffWeeks(month)             // GET /api/staff/weeks?month=
staffWeek(weekStart)          // GET /api/staff/week?weekStart=
staffWeekSave(weekStart, days)
staffCopyPrev(weekStart)
```

При 401 — `clearToken()` + `window.location.reload()`.

### 4.2 App shell — `app/App.jsx`

Логика:
- Нет токена → `LoginPage`
- `appRole === "STAFF"` → `StaffMonthPage` (без sidebar)
- `appRole === "MANAGER"` / `"ADMIN"` → менеджерский вид по `localStorage.managerView`:
  - `"PREFS"` → `StaffMonthPage` с пропсом `managerNav` (личные смены менеджера, с sidebar)
  - `"EMPLOYEES"` → `EmployeesPage`
  - `"SHIFTS"` (default) → `ManagerTablePage`

### 4.3 Layouts

- **`app/layouts/ManagerLayout.jsx`** — sidebar слева:
  - Вверху: лого ShiftApp
  - Меню: ⚙️ Manager, 👥 Employees
  - Внизу: кнопка с аватаром + именем + подписью "📅 希望シフト" (личные смены менеджера) → `PREFS`
  - Logout
  - Принимает пропсы: `name`, `view`, `onNavigate`, `onLogout`, `children`

- **`app/layouts/StaffLayout.jsx`** — обёртка для обычного сотрудника
- **`app/layouts/AppShell.module.css`** — все стили: `.managerShell`, `.sidebar`, `.sidebarItem`, `.sidebarItemActive`, `.sidebarItemPersonal`, `.sidebarPersonalInfo`, `.sidebarPersonalHint`, `.sidebarLogout` и т.д.
- **`app/layouts/AppHeader.jsx`** — шапка (используется в StaffLayout)

### 4.4 Pages

- **`pages/auth/LoginPage.jsx`** — страница логина
- **`pages/manager/ManagerTablePage.jsx`** — таблица смен, принимает `{ view, onNavigate, onLogout }`
- **`pages/manager/ManagerWeekPage.jsx`** — 希望シフト менеджера (редактирование смен всех сотрудников), принимает `{ view, onNavigate, onLogout }`
- **`pages/manager/EmployeesPage.jsx`** — CRUD аккаунтов, принимает `{ view, onNavigate, onLogout }`
- **`pages/staff/StaffMonthPage.jsx`** — месячный вид, принимает `{ onLogout, managerNav? }`. Если `managerNav` передан — оборачивается в `ManagerLayout` (личные смены менеджера)
- **`pages/staff/StaffWeekPage.jsx`** — редактирование пожеланий на неделю

### 4.5 Feature components

- **`features/auth/components/LoginForm.jsx`** — роль определяется из JWT (`atob`), переключатель удалён
- **`features/managerShift/components/*`** — таблица смен менеджера
- **`features/managerWeek/components/ManagerWeekEditor.jsx`** — редактор недели (выбор сотрудника, смена статуса, редактирование дней)
- **`features/staffShift/components/StaffMonth.jsx`** — месячный список недель
- **`features/staffShift/components/StaffWeek.jsx`** — редактор недели сотрудника

---

## 5) Запуск (dev)

Backend:
```
cd backend
mvn spring-boot:run
```
- health: `GET http://localhost:8080/api/health`
- `application.yml`: `ddl-auto: create-drop` (база пересоздаётся при каждом запуске)

Frontend:
```
cd frontend
npm install
npm run dev
```
- `http://localhost:5173`

---

## 6) Важные детали / ловушки

- **`Preference.employee_id`** — колонка в БД `employee_id`, Java-поле `user`. `@JoinColumn(name = "employee_id")` явно указан. Не менять.
- **`SeedData`** не запускается в prod (`@Profile("!prod")`).
- **`CurrentUser.require()`** — используется во всех контроллерах. Возвращает `CustomUserDetails` → `getUserId()`, `getRestaurantId()`, `getRole()`.
- **`ddl-auto: create-drop`** — в prod менять на `validate` + Flyway.
- **`/api/manager/employees`** — URL намеренно оставлен (не `/users`), чтобы не менять фронт.
- **`ManagerWeeksController.java` удалён** — дублировал `GET /api/manager/weeks` из `ManagerWeekController`.
- **Менеджер редактирует свои смены** через стафф-эндпоинты (`/api/staff/...`) — доступ разрешён для MANAGER роли в `SecurityConfig`.
- **`managerSaveStaffWeek`** — не проверяет статус недели (менеджер может редактировать всегда).