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
- `ShiftSlot.java` — slotOrder, startTime, endTime, last, workplace (до 5 слотов)

### 3.4 Weeks
- `ManagerMonthController.java` — `GET /api/manager/month`
  - `?month=YYYY-MM` ИЛИ `?from=YYYY-MM-DD&to=YYYY-MM-DD` (7–35 дней)
  - 3 SQL запроса на весь диапазон

### 3.5 Kiosk (NEW)
`com.shiftapp.kiosk`
- `TimeRecord.java` — id, restaurant, user, recordType, recordedAt, workDate, photoPath, note, editedBy, editedAt
- `TimeRecordType.java` — CLOCK_IN / CLOCK_OUT / BREAK_START / BREAK_END
- `TimeRecordRepository.java` — JOIN FETCH t.user в findByRestaurantAndDateRange
- `KioskService.java`:
  - `getStatus(userId)` → StaffStatusResponse (NOT_STARTED/WORKING/ON_BREAK/FINISHED + lastPhotoPath)
  - `punch(req)` → снимок + запись в БД
  - Фото сохраняется в `kiosk.photo-dir/YYYY-MM-DD/userId_type_epoch.jpg`
- `KioskController.java` — `/api/kiosk/staff`, `/api/kiosk/status/{userId}`, `/api/kiosk/punch`
- `StaffStatusResponse.java` — status, clockInAt, breakStartAt, breakEndAt, clockOutAt, **lastPhotoPath**

### 3.6 Attendance (NEW)
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
V8__add_kiosk_role.sql      — CHECK constraint users_role_check + KIOSK (план, на деве сделано вручную)
V9__add_user_profile_fields.sql — lastName/firstName/kana, email, phone, адрес, birthDate, gender
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
- Маршруты: Login / StaffMonthPage / ManagerTablePage / EmployeesPage / SettingsPage / **AttendancePage**
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

**clearToken()** очищает: accessToken, appRole, staffName, managerView, staffSelectedMonth, staffSelectedWeek, managerSelectedMonth, mgrFilterPos, mgrFilterDept, mgrFilterWp, mgrColVisibility, managerViewMode, managerSelectedWeek, managerRangeFrom, managerRangeTo

### ManagerLayout.jsx
Sidebar: SHIFTS 📅 / **ATTENDANCE 🕐** / EMPLOYEES 👥 / SETTINGS ⚙️

### ManagerTablePage.jsx
- displayDates (useMemo) — единый источник столбцов
- Режимы: 月/週/期間
- attendanceMap — цветная точка в ячейке (посещаемость)
- Шапка: Row1=статусы недель (top:0), Row2=дни (top:34px)
- Sticky: №(28px), 職種(70px), 部署(90px), 氏名(140px)
- Хелперы: currentMondayLocal(), addDays(), weeksInMonth() — локальное время (не toISOString!)

### AttendancePage.jsx (NEW)
- Таблица: сотрудники × дни месяца
- Ячейка: точка + время прихода/ухода (с секундами)
- Попап: список записей + фото + ручная правка
- fmtTime показывает секунды

### KioskPage.jsx (NEW) — `/kiosk`
- Только для iPad, landscape, светлая тема (фон #f0f4f8, попап синий #1e3a5f)
- Отдельная точка входа PWA: `kiosk.html` + `kiosk-manifest.webmanifest` (start_url: /kiosk)
- Левая панель: кана фильтр — группировка по `toKatakana(fullNameKana || fullName)`
  - `toKatakana()` конвертирует хирагану в катакану (диапазон \u3041-\u3096)
  - Менеджер может вводить フリガナ хираганой или катаканой — сортировка одинакова
- Карточки 160px, 6 в ряд на iPad landscape:
  - Фото из `lastPhotoPath` только при WORKING/ON_BREAK
  - Заглушка (улыбающийся смайлик SVG) при NOT_STARTED/FINISHED
  - Имена чёрным текстом без тени
- Попап (780×480px, центр экрана):
  - Камера слева, автозапуск, пунктирный овал для лица
  - PopupClock справа: дата `06月16日（火）` + время с секундами
  - 4 кнопки действий, автоснимок при нажатии (без отдельной кнопки "снять")
  - Без кнопки キャンセル — закрытие тапом на затемнённый фон
- Дата всегда в формате `MM月DD日（曜日）`, время всегда с секундами
- RESTAURANT_ID = 1 (захардкожен)
- **Авторизация (реализовано)**: роль KIOSK, токен в `localStorage.kioskToken`
  (отдельно от `accessToken` основного приложения), без авто-логаута по таймауту —
  выход только явный через ☰ → 🚪 ログアウト. При 401/403 — автовозврат на экран логина.
- **PunchPopup финальный дизайн**: 900×610px, камера 560px слева (зеркалится через
  CSS scaleX(-1), сохранённое фото — не зеркальное), кнопки 260px прижаты к низу,
  история всех событий за день (множественные перерывы) вместо последних 4 полей

### EmployeesPage.jsx
- Поле フリガナ（カタカナ）для fullNameKana

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

**Проблема:** Safari при "Добавить на экран" берёт `start_url` только из общего
manifest.webmanifest (`/`), игнорируя текущий путь — поэтому ярлык всегда открывал
главную страницу, не `/kiosk`.

**Решение:**
- `vite.config.js` → `build.rollupOptions.input`: `{ main: "index.html", kiosk: "kiosk.html" }`
- `frontend/kiosk.html` — отдельный HTML entry point
- `frontend/public/kiosk-manifest.webmanifest` — свой манифест с `start_url: "/kiosk"`,
  `orientation: "landscape"`, `theme_color: "#1e3a5f"`
- nginx: `location = /kiosk { try_files /kiosk.html =404; }`

**Workbox navigateFallback fix:**
- VitePWA по умолчанию (`generateSW`) перехватывает navigation requests и подменяет
  на index.html — это ломало прямые ссылки на `/photos/*.jpg`
- Fix: `VitePWA({ workbox: { navigateFallbackDenylist: [/^\/photos\//, /^\/api\//] } })`
- После любого изменения SW — нужно Unregister + Clear storage в браузере на тесте

**Vite dev proxy (для фото на деве):**
```js
server: {
  proxy: {
    '/api':    'http://192.168.1.19:8080',
    '/photos': 'http://192.168.1.19:8080',
  },
},
```

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

## 9.5) EmployeesPage.jsx — модальная форма сотрудника

Список — компактная таблица (氏名 = 姓+名, フリガナ под ним мелким шрифтом).
Кнопка ＋新規作成 открывает модалку (720px) по центру, закрывается **только**
через キャンセル/保存 (НЕ по клику на фон — критично для iPad, чтобы переключение
между приложениями не сбрасывало форму).

Секции модалки (в этом порядке):
1. **名前** — 姓/名 + フリガナ×2 раздельно (обязательно)
2. **連絡先** (任意) — email, телефон
3. **住所** (任意) — 郵便番号, 都道府県 (select, все 47 префектур), 市区町村, 番地, 建物名
4. **基本情報** (任意) — 生年月日, 性別 (radio 男性/女性)
5. **アカウント** — login, パスワード (обязательно при создании)
6. **業務情報** — 職種・役職, ロール (STAFF/MANAGER/KIOSK), 部署 (чекбоксы)

Обязательные поля помечены красным бейджем 必須, опциональные секции — серым 任意.

---

## 10) Ловушки

- PostgreSQL: таблицы созданы от `postgres`, юзер `shiftuser` не владелец —
  `ALTER TABLE` миграции (V7+) падают с `must be owner of table`.
  **Fix once**: `ALTER TABLE <table> OWNER TO shiftuser;` для всех таблиц
- VitePWA Service Worker перехватывает navigation requests к `/photos/*` —
  нужен `navigateFallbackDenylist` в workbox конфиге
- Safari игнорирует путь при "Добавить на экран" — нужна отдельная точка входа
  (`kiosk.html` + свой manifest) для каждого раздела с собственным `start_url`
- IP allow/deny на `/kiosk` в nginx конфликтовало с доступом и фото — **откачено**,
  безопасность решена авторизацией (роль KIOSK) вместо сетевых ограничений
- На деве фото нужен `server.proxy` в vite.config.js для `/photos` → Spring Boot
- Добавление enum-значения (KIOSK в UserRole) требует обновления CHECK constraint
  `users_role_check` в БД вручную — Hibernate `ddl-auto:update` не трогает constraints
- Hibernate `ddl-auto: update` иногда не подхватывает новые поля Entity сразу —
  если ошибка "column does not exist" после добавления полей, выполнить ALTER TABLE
  вручную на деве (для прода — через Flyway миграцию, там это всегда надёжно)
- Модалки/попапы на iPad: НЕ закрывать по клику на затемнённый фон — переключение
  между приложениями (alt-tab эквивалент) может триггерить случайный клик и сбрасывать
  заполненную форму. Закрытие только через явные кнопки.


- `ManagerWeekResponse.rows` — не `staff`
- `ShiftSlotRepository` — в пакете `preferences`, не `weeks`
- `UserRepository` — `LEFT JOIN FETCH u.departments` обязателен
- `TimeRecordRepository.findByRestaurantAndDateRange` — нужен `JOIN FETCH t.user`
- `KioskController.getStaffList` — использовать `findAllByRestaurant_IdOrderByIdDesc` (с FETCH departments), не `findByRestaurant_IdAndRoleOrderByFullNameAsc`
- `toISOString()` в UTC+9 даёт неверную дату — использовать `currentMondayLocal()`, `addDays()`
- `thDay/thName/thPosition/thDepartment/thNumber` — `top: 34px` (не 0!)
- `hotelName` в ReportService — `static final`, не из yml
- Excel экспорт — `import * as XLSX from "xlsx-js-style"`
- venv не коммитить (`report-service/venv/` в `.gitignore`)
- `shift_all.py`: `last_data_col = 4 + total`
- `key={token}` на ManagerTablePage — сброс state при повторном логине
- Фото на деве — `spring.web.resources.static-locations: file:C:/shift-app/`
- Камера на HTTP — только localhost или включить chrome://flags/#unsafely-treat-insecure-origin-as-secure
- `RESTAURANT_ID = 1` захардкожен в KioskPage.jsx
- `fullNameKana` — для кана-фильтра в киоске, заполнять в EmployeesPage