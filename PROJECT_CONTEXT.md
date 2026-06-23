# ShiftApp — PROJECT_CONTEXT

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
  `/api/kiosk/punch|status|staff` → требуют роль KIOSK (авторизация через `kioskToken` в localStorage)
- Frontend: токен в `localStorage.accessToken`, роль в `localStorage.appRole`
- Навигация менеджера: `localStorage.managerView` — SHIFTS / PREFS / EMPLOYEES / SETTINGS / ATTENDANCE
- Все ключи очищаются в `clearToken()` при логауте
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
  - permitAll: `/api/auth/**`, `/api/kiosk/**`, `/photos/**`, `/api/health`

### 3.2 Users
- `User.java` — id, restaurant, login, passwordHash, role, fullName, fullNameKana,
  position, departments, active, **+ полный профиль (V9)**:
  - `lastName`, `firstName`, `lastNameKana`, `firstNameKana` (раздельно)
  - `email`, `phone` (опционально)
  - `postalCode`, `region`, `municipality`, `blockNumber`, `building` (адрес, опц.)
  - `birthDate`, `gender` (опционально, `Gender` enum: MALE/FEMALE)
  - `fullName`/`fullNameKana` собираются автоматически в `UserService` из lastName+firstName
- `Gender.java` — enum MALE/FEMALE
- `UserResponse.java`, `UserCreateRequest/UpdateRequest.java` — все новые поля профиля
- `UserRole.java` — STAFF, MANAGER, ADMIN, **KIOSK**

### 3.3 Preferences и ShiftSlots
- `Preference.java` — workDate, off, slots (OneToMany), version (@Version)
- `ShiftSlot.java` — slotOrder, startTime, endTime, last, workplace, **nextDay** (до 5 слотов)
- `nextDay=true` — смена переходит на следующий день (endTime < startTime)

### 3.4 Weeks
- `ManagerMonthController.java` — `GET /api/manager/month`
  - `?month=YYYY-MM` ИЛИ `?from=YYYY-MM-DD&to=YYYY-MM-DD` (7–35 дней)
  - Показывает STAFF + MANAGER (`findByRestaurant_IdAndRoleInOrderByFullNameAsc`)

### 3.5 Kiosk
`com.shiftapp.kiosk`
- `TimeRecord.java` — id, restaurant, user, recordType, recordedAt, workDate, photoPath, note, editedBy, editedAt
- `TimeRecordType.java` — CLOCK_IN / CLOCK_OUT / BREAK_START / BREAK_END
- `KioskService.java`:
  - `getStatus(userId)` — ищет незакрытую смену **по всей истории** (не только за сегодня)
    Открытая смена висит пока явно не нажата 退勤, независимо от даты
  - После 退勤 — новый 出勤 разрешён (можно открыть вторую смену в тот же день)
  - `punch(req)` → снимок + запись в БД
- `KioskController.java` — показывает STAFF + MANAGER
- `StaffStatusResponse.java` — status, clockInAt, breakStartAt, breakEndAt, clockOutAt, lastPhotoPath, records[]

### 3.6 Attendance
`com.shiftapp.attendance`
- `AttendanceController.java`:
  - `GET /api/manager/attendance?from=&to=`
  - `PUT /api/manager/attendance/{id}`

### 3.7 Settings
- workplaces, positions, departments — `/api/manager/settings/`

### 3.8 Reports
- `ReportController.java` — прокси к Python FastAPI
- `report.service.url` из application.yml (default: localhost:8001)
- hotelName — static final (не из yml — кодировка Windows)

### 3.9 Users — удаление
- `UserService.delete()` — каскадное удаление:
  shift_slots → preferences → time_records → users
  (user_departments удаляется автоматически через JPA)

---

## 4) SQL миграции

```
V1__init_schema.sql         — рестораны, пользователи, preferences, week_status
V2__add_shift_slots.sql     — shift_slots
V3__add_workplaces_positions.sql
V4__add_departments.sql     — departments, user_departments
V5__add_optimistic_lock.sql — version на preferences
V6__add_time_records.sql    — time_records + индексы
V7__add_fullname_kana.sql   — full_name_kana в users
V8__add_kiosk_role.sql      — CHECK constraint users_role_check + KIOSK
V9__add_user_profile_fields.sql — lastName/firstName/kana, email, phone, адрес, birthDate, gender
V10__add_next_day_flag.sql  — next_day BOOLEAN на shift_slots (日またぎ勤務対応)
```

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

### Prod (/opt/shift-app/application.yml)
```yaml
spring:
  flyway:
    enabled: true
    baseline-on-migrate: true
    baseline-version: 5
  jpa.hibernate.ddl-auto: validate
  web.resources.static-locations: file:/var/www/shift-app/,classpath:/static/
kiosk:
  photo-dir: /var/www/shift-app/photos/
  photo-url-prefix: /photos/
```

---

## 6) Report Service (Python FastAPI)

```
report-service/
  main.py, models.py, requirements.txt
  routers/shift.py
  builders/shift_dept.py, shift_all.py, timesheet.py
  shift-report.service  (systemd)
```
- Порт 8001, только localhost
- `last_data_col = 4 + total` для рамки с 公休数
- venv: `/opt/report-service/venv/`

---

## 7) Frontend: ключевые файлы

### main.jsx
```js
const isKiosk = window.location.pathname.startsWith('/kiosk');
createRoot(...).render(isKiosk ? <KioskPage /> : <App />)
```

### App.jsx
- Маршруты: Login / StaffMonthPage / ManagerTablePage / EmployeesPage / SettingsPage / AttendancePage
- `<ManagerTablePage key={token} />` — сброс state при логине
- `InstallBanner` — подсказка PWA (ja/en)
- Автологаут 30 мин

### api.js — методы
```js
managerMonth(month)           // ?month=YYYY-MM
managerRange(from, to)        // ?from=...&to=...
attendanceRecords(from, to)   // GET /api/manager/attendance
attendanceEdit(id, payload)   // PUT /api/manager/attendance/{id}
reportShiftAll/Dept/Timesheet/Filtered
settingsWorkplaces/Positions/Departments CRUD
managerEmployees CRUD
```

**clearToken()** очищает: accessToken, appRole, staffName, managerView, staffSelectedMonth,
staffSelectedWeek, managerSelectedMonth, mgrFilterPos, mgrFilterDept, mgrFilterWp,
mgrColVisibility, managerViewMode, managerSelectedWeek, managerRangeFrom, managerRangeTo

### ManagerLayout.jsx
Sidebar: SHIFTS 📅 / ATTENDANCE 🕐 / EMPLOYEES 👥 / SETTINGS ⚙️

### ManagerTablePage.jsx
- displayDates (useMemo) — единый источник столбцов
- Режимы: 月/週/期間
- attendanceMap — цветная точка в ячейке (посещаемость)
- Шапка: Row1=статусы недель (top:0), Row2=дни (top:34px)
- Sticky: №(28px), 職種(70px), 部署(90px), 氏名(140px)
- **Ночные смены (nextDay)**:
  - `isNextDay(start, end)` — строковое сравнение HH:MM, если end < start → nextDay
  - Над 開始: подсказка `当日`, над 終了: `当日` или `翌日`（красный жирный）
  - В ячейке: время окончания фиолетовым, `L` рядом с временем
  - Фиолетовая полоска (3px) сверху ячейки D+1 если D имеет nextDay слот
  - В попапе D+1: блок `前日からの引き続き` — клик переходит на попап D
- **L（ラスト）**: флаг для сотрудника (видит только L), менеджер ОБЯЗАН указать 終了
- **保存ボタン**: disabled если у любого слота не заполнены ОБА поля 開始 И 終了
- Показывает STAFF + MANAGER
- `getName()` → `localStorage.staffName`

### AttendancePage.jsx
- Полный TopBar как ManagerTablePage (月/週/期間)
- Полный SortBar: 表示列▼, 職種・役職▼, 部署▼, 表示フィルター▼ (出勤中/休憩中/退勤済み/未出勤), リセット, 並び替え
-週区切り線 (cellWeekStart)
- Фото в попапе открываются в модальном окне (не в новой вкладке)
- Показывает STAFF + MANAGER
- localStorage ключи: attViewMode, attSelectedMonth, attSelectedWeek, attRangeFrom, attRangeTo,
  attFilterPos, attFilterDept, attFilterStatus, attColVisibility

### KioskPage.jsx (`/kiosk`)
- Только для iPad, landscape, светлая тема (фон #f0f4f8, попап синий #1e3a5f)
- Отдельная точка входа PWA: `kiosk.html` + `kiosk-manifest.webmanifest`
- Показывает STAFF + MANAGER
- Смена открыта до явного 退勤, независимо от даты
- После 退勤 можно открыть новую смену в тот же день
- RESTAURANT_ID = 1 (захардкожен)

### EmployeesPage.jsx
- Полная форма профиля сотрудника
- Удаление с подтверждающим попапом (警告: データが完全に削除されます)
- Деактивация через чекбокス アクティブ

---

## 8) Деплой

### Dev
```bash
cd backend && mvn spring-boot:run
cd frontend && npm run dev
cd report-service && source venv/Scripts/activate && uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### Production
- nginx → `/var/www/shift-app/`
- Spring Boot jar → `/opt/shift-app/`
- report-service → systemd `shift-report.service`, порт 8001
- systemd user: `anadminsrv`
- Фото: `/var/www/shift-app/photos/` (mkdir + chown anadminsrv)

### Деплой команды
```bash
# Локально
npm run build
mvn clean package -DskipTests
rsync -av --exclude='venv' --exclude='__pycache__' report-service/ anadminsrv@hanno-shift.duckdns.org:/opt/report-service/

# На сервере
sudo systemctl restart shift-app
sudo systemctl restart shift-report
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8.5) PWA — отдельная точка входа для /kiosk

- `vite.config.js` → `build.rollupOptions.input`: `{ main: "index.html", kiosk: "kiosk.html" }`
- `frontend/kiosk.html` — отдельный HTML entry point
- `frontend/public/kiosk-manifest.webmanifest` — `start_url: "/kiosk"`, `orientation: "landscape"`
- nginx: `location = /kiosk { try_files /kiosk.html =404; }`
- VitePWA: `navigateFallbackDenylist: [/^\/photos\//, /^\/api\//]`

---

## 9) nginx конфиг (ключевые location)

```nginx
location / { try_files $uri /index.html; }
location /api/ { proxy_pass http://localhost:8080/; }
location /photos/ { alias /var/www/shift-app/photos/; }
location /manifest.webmanifest { add_header Content-Type application/manifest+json; }
location ~* \.(png|jpg|ico|webmanifest|js|css|svg)$ { try_files $uri =404; }
```

---

## 10) Ловушки

- PostgreSQL: таблицы созданы от `postgres`, юзер `shiftuser` не владелец —
  `ALTER TABLE` миграции (V7+) падают с `must be owner of table`.
  **Fix once**: `ALTER TABLE <table> OWNER TO shiftuser;` для всех таблиц
- VitePWA Service Worker перехватывает navigation requests к `/photos/*` —
  нужен `navigateFallbackDenylist` в workbox конфиге
- Safari игнорирует путь при "Добавить на экран" — нужна отдельная точка входа
- `toISOString()` в UTC+9 даёт неверную дату — использовать `currentMondayLocal()`, `addDays()`
- `thDay/thName/thPosition/thDepartment/thNumber` — `top: 34px` (не 0!)
- `hotelName` в ReportService — `static final`, не из yml
- Excel экспорт — `import * as XLSX from "xlsx-js-style"`
- `shift_all.py`: `last_data_col = 4 + total`
- `key={token}` на ManagerTablePage — сброс state при повторном логине
- Камера на HTTP — только localhost или chrome://flags/#unsafely-treat-insecure-origin-as-secure
- `RESTAURANT_ID = 1` захардкожен в KioskPage.jsx
- `fullNameKana` — для кана-фильтра в киоске
- `getName()` в ManagerTablePage/AttendancePage → `localStorage.staffName` (не декодировать JWT — кракозябры)
- Удаление пользователя: сначала shift_slots → preferences → time_records, потом users
- `nextDay` флаг: `isNextDay(start, end)` = строковое сравнение, end < start → true
- `findByRestaurant_IdAndRoleInOrderByFullNameAsc` — для отображения STAFF+MANAGER в таблицах