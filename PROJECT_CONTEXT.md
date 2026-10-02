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
- Доступы: `/api/manager/**` → `hasAnyRole("MANAGER","ADMIN")` (с 2026-09-26, было только MANAGER — см. 3.13),
  `/api/staff/**` → STAFF или MANAGER, `/api/kiosk/punch|status|staff|statuses` → требуют роль KIOSK
  - Внутри `/api/manager/**` дополнительно точечные права через `@PreAuthorize("hasAuthority('...')")` — см. 3.13
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
  - `/api/manager/**` — `hasAnyRole("MANAGER","ADMIN")` (изменено 2026-09-26, см. 3.13)
- `CustomUserDetails.java` — `getUserId()`, `getRestaurantId()`, `getRole()`, `getFullName()` (НЕ `getId()`)
  - `getAuthorities()` (изменено 2026-09-26) — отдаёт и `ROLE_*` (для `hasRole`/`hasAnyRole`), и точечные `Permission` (для `hasAuthority`): `ADMIN` получает все существующие `Permission`, остальные роли — `permissions` из своей `customRole` (если назначена; если `customRole == null` — точечных прав нет вообще, только базовый `ROLE_*`)
- `CustomUserDetailsService.java` — `loadUserByUsername()` использует `UserRepository.findByLoginWithCustomRole()` (JOIN FETCH `customRole` + `customRole.permissions`, иначе `LazyInitializationException`)
- `CurrentUser.java` (`com.shiftapp.common`) — `CurrentUser.require()` статически достаёт `CustomUserDetails` из `SecurityContextHolder`, работает и внутри сервисов, не только контроллеров

### 3.2 Users
- `User.java` — id, restaurant, login, passwordHash, role, fullName, fullNameKana,
  position, departments, active, lastName/firstName/Kana, email, phone, address, birthDate, gender,
  **sortOrder** (int, `V18`, порядок отображения сотрудников), **customRole** (`ManyToOne` → `Role`, `custom_role_id`, nullable, `V20`, см. 3.13)
- `UserRole.java` — STAFF, MANAGER, ADMIN, KIOSK
- `UserRepository.java` — `findByLoginWithCustomRole()` (JOIN FETCH customRole + permissions, используется при логине), `existsByRestaurant_IdAndSortOrder(...)` / `...AndIdNot(...)` (уникальность sortOrder)
- `UserService.java` — create/update/delete; при create/delete/password-change вызывает `NotificationMailService` (см. 3.12)
- ⚠️ **Ещё не сделано (следующий шаг)**: `UserCreateRequest`/`UserUpdateRequest`/`UserResponse`/`UserService` пока НЕ принимают/не отдают `customRoleId` — сотрудника пока нельзя привязать к кастомной роли через API. Нужно добавить `customRoleId` во все четыре места + `EmployeesPage.jsx` (select роли в форме).

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
- `ManagerShiftController.java` (`/api/manager/shifts` — bulk/list/copy-week/delete) — доступ через `@PreAuthorize("hasAuthority('SHIFT_VIEW')")` на всех методах (единственное shift-право в `Permission`, нет отдельных edit/delete — см. 3.13)

### 3.5 Months (месячный статус и стафф-ввод)
Пакет `com.shiftapp.months`:
- `MonthStatus.java` — entity: restaurant, yearMonth, **half (1 или 2)**, status, updatedBy, updatedAt
- `MonthStatusRepository.java` — `findByRestaurant_IdAndYearMonthAndHalf(Long, String, int)`
- `MonthStatusController.java` — `GET/POST /api/manager/month-status?month=&status=&half=`, `@PreAuthorize("hasAuthority('SHIFT_VIEW')")`; при смене статуса пишет запись в `audit_log` через `AuditLogService.log(...)` (см. 3.14)
- `StaffMonthController.java` — `/api/staff/month` (GET) и `/api/staff/month/save` (POST)
- `SaveMonthRequest.java` — `{month, days: [{date, off, startTime, endTime}]}`

### 3.6 Break Rules (настройки перерывов)
Пакет `com.shiftapp.settings.breakrule`:
- `BreakRule.java` — name, thresholdMinutes, breakMinutes
- `BreakRuleController.java` — CRUD `/api/manager/settings/break-rules`, `@PreAuthorize` по `BREAK_RULE_VIEW/CREATE/EDIT/DELETE`
- Логика: из всех подходящих правил (`duration > thresholdMinutes`) выбирается с наибольшим порогом

### 3.6.1 Departments (порядок отображения, добавлено 2026-09-11)
Пакет `com.shiftapp.settings.department`:
- `Department.java` — добавлено поле `sortOrder` (int)
- `DepartmentRepository` — `findAllByRestaurant_IdOrderBySortOrderAsc`, `countByRestaurant_Id`
- `DepartmentService.list()` — сортирует по `sortOrder`, а не по `id`; `create()` ставит новый отдел в конец (`sortOrder = count`); новый метод `reorder(restaurantId, orderedIds)` — переприсваивает `sortOrder` по позиции в переданном списке id
- `DepartmentController` — `PUT /api/manager/settings/departments/reorder` (body: `List<Long>` — id в нужном порядке), `@PreAuthorize` по `DEPARTMENT_VIEW/CREATE/EDIT/DELETE` (reorder → `DEPARTMENT_EDIT`)
- Используется и в киоске (группировка сотрудников по порядку отделов), и во всех дропдаунах/фильтрах по отделам на менеджерских экранах — единый источник порядка (см. 3.7)

### 3.7 Kiosk
- `KioskService.java` — статус, punch, фото; вызывает `checkAndNotify()` после каждой пробивки (遅刻/早退/シフトなし出勤)
- `KioskService.getStaffList(restaurantId)` (добавлено 2026-09-11) — список сотрудников для киоска, отсортированный по минимальному `sortOrder` среди отделов сотрудника (сотрудник с несколькими отделами группируется по самому приоритетному); сотрудники без отдела — в конец списка, но не скрываются. Метод намеренно вынесен из контроллера в сервис — обращение к `user.getDepartments()` требует открытой транзакции (ленивая ManyToMany)
- `KioskController.getStaffList()` — теперь просто делегирует в `KioskService`
- Смена открыта до явного 退勤, независимо от даты
- После 退勤 — новый 出勤 разрешён
- **⚠️ После 退勤 сервер возвращает `NOT_STARTED`, а не `FINISHED`** (смена закрыта → «не начата» + записи за сегодня). Статус `FINISHED` сервер фактически никогда не отдаёт — фронтовая ветка для FINISHED (затемнение карточки, 本日の退勤打刻は完了しています) не срабатывает. Так было всегда, не баг новой версии
- **Оптимизация (2026-09-26)**:
  - `GET /api/kiosk/statuses?restaurantId=` → `Map<Long, StaffStatusResponse>` — статусы всех сотрудников киоска одним запросом (`KioskService.getStatuses()`)
  - `getStatus()` и `getStatuses()` используют общий `buildStatuses(userIds)`: 2 агрегата «время последнего CLOCK_IN / CLOCK_OUT» на всех (`findLastRecordedAtByUserIds`), для открытых смен — записи с последнего CLOCK_IN (`findRowsSince`), для остальных — записи за сегодня одним запросом (`findRowsByUserIdsAndWorkDate`). Логика та же, что раньше, но **без загрузки всей истории** сотрудника
  - `KioskRecordRow` (record, `com.shiftapp.kiosk`) — лёгкая строка (userId, recordType, recordedAt, workDate, photoPath), читается через `SELECT new com.shiftapp.kiosk.KioskRecordRow(...)` — полное имя класса в JPQL, пакет менять нельзя
  - `punch()`: `workDate` для не-CLOCK_IN — `findFirstByUser_IdAndRecordTypeOrderByRecordedAtDesc`, `checkAndNotify` — `findByUser_IdAndWorkDateOrderByRecordedAtAsc`
  - `getStaffList()` — `UserRepository.findAllWithDepartmentsByRestaurantId` (`@EntityGraph("departments")`) + `.distinct()`, без отдельного запроса на отделы каждого сотрудника
  - `findByUser_IdOrderByRecordedAtAsc` (вся история) для киоска больше не используется

### 3.8 Attendance
- `GET /api/manager/attendance?from=&to=` — `@PreAuthorize("hasAuthority('ATTENDANCE_VIEW')")`
- `PUT /api/manager/attendance/{id}` — `@PreAuthorize("hasAuthority('ATTENDANCE_EDIT')")`; правка времени/типа/комментария; `AttendanceEditRequest.recordType` (добавлено 2026-09-23) позволяет также менять тип записи (CLOCK_IN/CLOCK_OUT/BREAK_START/BREAK_END), не только время
- `DELETE /api/manager/attendance/{id}` — `@PreAuthorize("hasAuthority('ATTENDANCE_DELETE')")` (добавлено 2026-09-11) — удаляет одну запись пробивки (для случаев дублирования/ошибочного закрытия чужой смены); фото на диске не удаляется (осознанно, не критично)
- `ReportService.computeSessionOfficial()` — расчёт lateIn/earlyOut/officialClockIn/Out/officialBreakMinutes/workMinutes (общая логика для 勤怠管理 экрана и Excel-отчётов)
  - **⚠️ Важное изменение 2026-09-23**: `officialClockIn`/`officialClockOut` больше НЕ "прилипают" к плану. Раньше при приходе раньше плана в ячейке показывалось время плана, а не факт (баг). Теперь всегда возвращается фактическое время, округлённое (приход — вверх до получаса, уход — вниз), независимо от наличия/значения плана. `lateIn`/`earlyOut` по-прежнему считаются сравнением факта с планом — используются только для цвета ячеек (зелёный/красный/жёлтый), не влияют на отображаемое значение
  - Для リスト (`attendance_sessions.py`) эта проблема была исправлена раньше отдельными полями `roundedClockIn`/`roundedClockOut` — правка 09-23 привела Excel-отчёты и カレンダー к тому же поведению, единая логика теперь везде

### 3.9 Settings
- workplaces, positions, departments (см. 3.6.1), breakrules, **notification preferences/settings** — `/api/manager/settings/`, `/api/manager/notifications/`
- workplaces/positions — `@PreAuthorize` по `WORKPLACE_*`/`POSITION_*` (см. 3.13)
- notifications — `@PreAuthorize` по `NOTIFICATION_VIEW`/`NOTIFICATION_EDIT` (изменено 2026-09-26, было `hasAnyRole('MANAGER','ADMIN')`)
- **roles/permissions** (`/api/manager/settings/roles`, `/api/manager/settings/permissions`) — новое, см. 3.13

### 3.10 Reports
- `ReportController.java` — прокси к Python FastAPI (порт 8001)
- Все отчёты (勤怠集計表・シフト表・打刻一覧) теперь имеют версии **`/range`** (по произвольному диапазону дат from/to), не только по `ym` — используются на страницах ManagerTablePage/AttendancePage вместо жёсткого месяца
- **勤怠管理画面のExcel出力は2026-09-23より1本化**: 画面の「📥 Excel」ボタンは常に `generateAttendanceTimesheetFiltered` (`表示中の勤怠集計表`と同じロジック — 画面上でフィルタリング中のスタッフ・期間をそのまま出力) を呼び出す。旧「勤怠集計表（実績）」「打刻一覧」へのUI導線は削除（バックエンドの`generateAttendanceTimesheet`/`generateAttendanceList`メソッドとPythonファイル自体は未使用のまま残置、削除はしていない）
- `勤怠リスト` (`attendance_sessions.py`) — 動的な列構成が2026-09-11に大きく見直された。詳細は6) AttendancePage.jsxを参照
- Все методы `@PreAuthorize("hasAnyRole('MANAGER','ADMIN')")` — **не** переведены на `Permission` (в `Permission` enum нет своего значения под "отчёты"; если понадобится точечное право — обсудить отдельно, самый вероятный кандидат `SHIFT_VIEW`/`ATTENDANCE_VIEW` по типу отчёта)

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
- `NotificationPreferenceController`/`NotificationSettingsController` — `@PreAuthorize` по `NOTIFICATION_VIEW`/`NOTIFICATION_EDIT` (изменено 2026-09-26)

### 3.13 Roles & Permissions — RBAC (добавлено 2026-09-26)

Цель: заменить грубое разделение STAFF/MANAGER/ADMIN на точечные права, которые супер-админ (`ADMIN`) сам настраивает через UI, без участия разработчика.

**Миграция**: `V20__add_roles.sql`
- `roles(id, restaurant_id, name, created_at)`, UNIQUE(restaurant_id, name)
- `role_permissions(role_id, permission)` — PK составной, `ON DELETE CASCADE`
- `users.custom_role_id` → `roles(id)`, `ON DELETE SET NULL` (nullable)
- Бэкфилл: каждому ресторану создаётся роль "フルアクセス" со всеми `Permission`, назначается всем существующим `MANAGER` (иначе после миграции менеджеры без `customRole` не проходили бы `@PreAuthorize` проверки — см. ниже)

**Backend, пакет `com.shiftapp.roles`**:
- `Role.java` — entity: id, restaurant, name, `permissions` (`Set<Permission>`, `@ElementCollection(fetch = EAGER)` через `role_permissions`), createdAt
- `Permission.java` — enum, полный список:
  `SHIFT_VIEW`, `ATTENDANCE_VIEW/EDIT/DELETE`, `EMPLOYEE_VIEW/CREATE/EDIT/DELETE`,
  `WORKPLACE_VIEW/CREATE/EDIT/DELETE`, `POSITION_VIEW/CREATE/EDIT/DELETE`, `DEPARTMENT_VIEW/CREATE/EDIT/DELETE`,
  `BREAK_RULE_VIEW/CREATE/EDIT/DELETE`, `NOTIFICATION_VIEW/EDIT`, `LOGGING_VIEW`
  - ⚠️ Нет отдельных `SHIFT_EDIT/CREATE/DELETE` — по решению 2026-09-26 все write-операции по сменам (`ManagerShiftController` bulk/copy-week/delete), `MonthStatusController`, `ManagerWeekStatusController`, `ManagerPreferenceController` завешены на **тот же `SHIFT_VIEW`** (единственное shift-право). Если в будущем понадобится разделить — добавить новые значения в enum и пройтись по этим 4 контроллерам
- `RoleRepository.java`, `RoleService.java`, `RoleController.java` (`/api/manager/settings/roles`, CRUD), `PermissionController.java` (`/api/manager/settings/permissions`, `GET` → список всех значений enum для фронта)
  - **Оба контроллера — `@PreAuthorize("hasRole('ADMIN')")` на уровне класса, НЕ через `Permission`** — принципиально: иначе STAFF/MANAGER с правом "редактировать роли" мог бы выдать сам себе любые права (privilege escalation)
- `User.java` — `customRole` (`@ManyToOne(FetchType.LAZY)`, `@JoinColumn(name = "custom_role_id")`, nullable)
- `UserRepository.findByLoginWithCustomRole(login)` — `LEFT JOIN FETCH customRole LEFT JOIN FETCH customRole.permissions`, используется в `CustomUserDetailsService` вместо `findByLogin`
- `CustomUserDetails.getAuthorities()`:
  - всегда добавляет `ROLE_<UserRole>` (для `hasRole`/`hasAnyRole`)
  - `role == ADMIN` → плюс ВСЕ `Permission.values()`
  - иначе, если `customRole != null` → плюс `customRole.getPermissions()`
  - если `customRole == null` и роль не ADMIN → **никаких точечных прав**, только базовый `ROLE_*` (осознанное решение — см. ниже)

**SecurityConfig.java**:
- `/api/manager/**`: `hasRole("MANAGER")` → **`hasAnyRole("MANAGER", "ADMIN")`** (иначе ADMIN не проходил вообще, роли в Spring Security не наследуются)
- Точечные права — не на уровне URL, а через `@PreAuthorize` на каждом методе контроллера (`@EnableMethodSecurity` уже был включён)

**Маппинг `@PreAuthorize` по контроллерам** (простановка завершена 2026-09-26):
| Контроллер | Permission |
|---|---|
| `AttendanceController` | `ATTENDANCE_VIEW`/`EDIT`/`DELETE` |
| `AuditLogController` | `LOGGING_VIEW` |
| `MonthStatusController` | `SHIFT_VIEW` (все методы) |
| `NotificationPreferenceController`, `NotificationSettingsController` | `NOTIFICATION_VIEW`/`NOTIFICATION_EDIT` |
| `ManagerPreferenceController` | `SHIFT_VIEW` |
| `BreakRuleController` | `BREAK_RULE_VIEW`/`CREATE`/`EDIT`/`DELETE` |
| `DepartmentController` | `DEPARTMENT_VIEW`/`CREATE`/`EDIT`/`DELETE` (reorder → `EDIT`) |
| `PositionController` | `POSITION_VIEW`/`CREATE`/`EDIT`/`DELETE` |
| `WorkplaceController` | `WORKPLACE_VIEW`/`CREATE`/`EDIT`/`DELETE` |
| `ManagerShiftController` | `SHIFT_VIEW` (все методы, включая bulk/copy-week/delete) |
| `ManagerUserController` (employees) | `EMPLOYEE_VIEW`/`CREATE`/`EDIT`/`DELETE` (unlock → `EDIT`) |
| `ManagerWeekStatusController` | `SHIFT_VIEW` |
| `RoleController`, `PermissionController` | `hasRole('ADMIN')` (не Permission, см. выше) |
| `ReportController` | не тронут, остался `hasAnyRole('MANAGER','ADMIN')` |

**⚠️ Открытые задачи (следующий шаг, ещё НЕ сделано)**:
1. `UserCreateRequest`/`UserUpdateRequest`/`UserResponse`/`UserService` — добавить `customRoleId` (принимать при создании/редактировании, отдавать в ответе). Пока customRole нельзя назначить через API вообще.
2. Frontend: новая страница **設定 → 権限**, видна только при `role === "ADMIN"` — список ролей, создание/редактирование/удаление, чекбоксы по `Permission` (сгруппировать по категориям для читаемости: シフト/勤怠/従業員/職場・職種・部署・休憩ルール/通知/ログ). Тянет список permission-значений с `GET /api/manager/settings/permissions`, роли — `/api/manager/settings/roles`.
3. Frontend: `EmployeesPage.jsx` — добавить select `customRoleId` в форму сотрудника (создание/редактирование), подгружать список ролей ресторана.
4. `api.js` — методы `settingsRolesList/Create/Update/Delete`, `settingsPermissionsList`.

### 3.14 Audit Log (добавлено, миграция `V19`)
Пакет `com.shiftapp.audit`:
- Таблица `audit_log`: `id, restaurant_id, actor_user_id (SET NULL), actor_name, action, entity_type, entity_id, target_user_id (SET NULL), target_user_name, summary, details, created_at`; индексы по `(restaurant_id, created_at DESC)`, `target_user_id`, `entity_type`
- `AuditAction` (enum, минимум содержит `UPDATE`), `AuditEntityType` (enum, минимум содержит `MONTH_STATUS`) — точный полный список значений в этом чате не запрашивался, см. сами файлы при необходимости
- `AuditLogService.log(restaurantId, actorUserId, actorName, action, entityType, entityId, targetUserId, targetUserName, summary, details)` — сигнатура выведена из вызова в `MonthStatusController.setStatus()`, пишет запись при каждом фактическом изменении (сравнивает old/new перед записью, не логирует no-op)
- `AuditLogController.search()` — `GET /api/manager/audit-log?from=&to=&targetUserId=&entityType=`, `@PreAuthorize("hasAuthority('LOGGING_VIEW')")`, фильтрует по `restaurantId` из `CurrentUser`
- Известный вызывающий: `MonthStatusController.setStatus()` — логирует смену статуса месяца/половины месяца с человекочитаемым summary на японском

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
V17__add_department_sort_order.sql — sort_order INT на departments (default 0, начальное значение = id)
V18__*                          — sort_order INT на users (порядок отображения сотрудников; точное имя файла
                                   и полный SQL в этом чате не запрашивались — видно только по коду:
                                   User.sortOrder, UserRepository.existsByRestaurant_IdAndSortOrder(...))
V19__add_audit_log.sql          — audit_log таблица (лог действий менеджеров/админов, см. 3.14)
V20__add_roles.sql              — roles, role_permissions, users.custom_role_id (RBAC, см. 3.13).
                                   Содержит бэкфилл: роль "フルアクセス" на ресторан со всеми Permission,
                                   назначается всем существующим MANAGER
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

// Departments — порядок отображения (2026-09-11)
settingsDepartmentsReorder(orderedIds)

// Attendance — удаление записи (2026-09-11)
attendanceDelete(id)

// ⚠️ ЕЩЁ НЕ ДОБАВЛЕНО (roles, см. 3.13): settingsRolesList/Create/Update/Delete, settingsPermissionsList
```

### ManagerTablePage.jsx
- 📊レポート▼ теперь всегда шлёт `displayDates[0]`/`displayDates[last]` (текущий период на экране: 月/週/期間), а не жёстко `ym` — работает одинаково для всех 4 типов отчётов
- Sticky-заголовки таблицы: **обе строки `<thead>` должны иметь одинаковое количество ячеек** — если добавляешь колонку (напр. 公休数+勤務時間), нужно добавить соответствующие заглушки в первую строку (`thWeek`), иначе последняя колонка не будет sticky при скролле
- `START_TIME_OPTS`: `03:00`–`23:30` (с 09/09)

### AttendancePage.jsx

**カレンダー**
- Ячейка дня показывает 4 строки-блока (вместо прежних `出勤/退勤/実働/休憩`, с 2026-09-11 добавлена ещё одна): **出勤 → 退勤 → 拘束 → 休憩 → 実働**
- 出勤/退勤 в ячейках — с 2026-09-11 показывают факт, округлённый (приход вверх, уход вниз), **не** прижатый к плану, как было раньше (был баг: приход раньше плана показывал время плана)
- Итоговый столбец `勤務時間` тоже пересчитан по фактическим значениям (拘束 минус реальный перерыв), не по прежней "прижатой к плану" логике
- Формат времени в ячейках и итоговом столбце — `時間/分` (был короткий эксперимент с `h/m`, откатили обратно по просьбе)

**リスト** — состав и порядок `LIST_COLUMNS` полностью пересмотрен 2026-09-11:
```
申請者, 出勤日（予定）, 出勤日（実績）, 出勤時刻（予定）, 出勤時刻（実績）, 出勤時刻, 出勤前残業時間,
退勤日（予定）, 退勤日（実績）, 退勤時刻（予定）, 退勤時刻（実績）, 退勤時刻, 退勤後残業時間,
拘束時間,
休憩開始時刻, 休憩終了時刻, 休憩時間（予定）, 休憩時間（実績）,
実働時間,
残業時間（合計）, シフト（予定）
```
  - `出勤時刻`/`退勤時刻` —実際の打刻を30分単位で丸めた値（出勤=切り上げ、退勤=切り下げ）。`roundUpHalfHour`/`roundDownHalfHour`はカレンダー側と共通のロジック
  - `出勤前残業時間` = 予定出勤 − 出勤時刻（丸め後）、`退勤後残業時間` = 退勤時刻（丸め後） − 予定退勤。各々「-」（0またはplanなし）、正なら赤、負なら青
  - `残業時間（合計）` = 出勤前残業時間 + 退勤後残業時間。予定がない日は常に「-」
  - `拘束時間`（旧`勤務時間（実際）`）= 出勤時刻〜退勤時刻の総時間（丸め後、休憩を含む、差し引かない）
  - `実働時間`（旧`勤務時間（予定）`）= 拘束時間 − 休憩時間（実績）（実打刻優先、なければ`officialBreakMinutes`にフォールバック）。**一般的な労務用語の定義に合わせた**（拘束時間 ≥ 実働時間、差分＝休憩）
  - フォーマットは`時間/分`（h/mへの変更→差し戻し済み）
  - `ReportService.buildAttendanceSessionsPayload()`に対応フィールド追加: `roundedClockIn`, `roundedClockOut`, `inOvertimeMinutes`, `outOvertimeMinutes`（Java）／`models.py`の`SessionModel`にも同名フィールド追加
  - `attendance_sessions.py`のCOLUMN_DEFS/COLUMN_ORDERを同期して更新（列名・並び順とも画面と一致させること — 今後列を追加する際も両方揃えて修正する）
- **並び替え**: リスト画面専用だった旧・並び替えバー（カレンダー用`sortConfig`の誤流用）を削除。代わりに主要列の見出しクリックでソート可能（対応列は`SORTABLE_LIST_KEYS`定数で限定: 申請者、出勤日（予定/実績）、出勤前残業時間、退勤日（予定/実績）、退勤後残業時間、残業時間（合計））
- **申請者ドロップダウン**: `CheckDropdown`に`searchable`/`panelWidth`/`panelHeight`propを追加（他の呼び出し元には影響なし）。氏名検索欄付き、250×500px
- **期間選択**: リスト専用に`LIST_VIEW_MODES = [月, 週, 日, 期間]`を新設（カレンダー側の`VIEW_MODES`は変更なし、"日"は存在しない）。`listDay` stateと`listRange`の`day`分岐を追加
- **選択スタッフの永続化**: `listSelectedStaff`を`localStorage`（`attListFilterStaff`）に保存・復元。他のフィルター（職種・役職/部署等）と同じ`saveFilterSet`/`loadFilterSet`パターン
- **詳細ポップアップ（`detailPopup`）**:
  - 各打刻記録に「削除」ボタン追加（2026-09-11、`api.attendanceDelete`）。削除後は`dayRecords`から即座に除去、`load(true)`で背景のカレンダーも更新
  - `編集`フォームに「種別」セレクトを追加（2026-09-23、`recordType`）— 出勤/退勤/休憩開始/休憩終了を直接変更可能
  - **⚠️ タイムゾーンのバグ修正（2026-09-23）**: `編集`を開く際に旧コードは`toISOString()`でUTC時刻を表示していたため、実際09:30の打刻が「00:30」と表示される不具合があった。`toJstDatetimeLocal()`/`fromJstDatetimeLocal()`（JST固定、`+09:00`）に置き換え済み
  - **保存後にモーダルが更新されない不具合を修正（2026-09-23）**: `handleEditSave()`は保存APIのレスポンスを`detailPopup.dayRecords`へ即時マージするよう変更（以前は`load(true)`で背景のみ更新、開いたままのポップアップは古い値のまま）

**Excelレポート**
- 2026-09-23より、旧3種類（勤怠集計表（実績）/打刻一覧/表示中の勤怠集計表）のドロップダウンを廃止し、「📥 Excel」ボタン1つに統合。常に画面表示中のフィルター・期間を反映（旧「表示中の勤怠集計表」と同じロジック、`api.reportAttendanceTimesheetFiltered`）

### EmployeesPage.jsx
- Поиск по 氏名/フリガナ/ログインID
- Сортировка по клику на заголовок (ID/氏名/Login), фильтрация чекбоксами (職種・役職/部署/ロール/状態) через dropdown в заголовке колонки
- Кнопка "更新" заменена на "表示中: N / M 人"
- ⚠️ **Ещё не сделано**: выбор `customRoleId` в форме создания/редактирования сотрудника (см. 3.13, открытые задачи)

### SettingsPage.jsx
- Табы: 勤務場所 / 職種・役職 / 部署 / 休憩ルール / **通知設定** (новый, 2026-08-30)
- 通知設定: чекбоксы на 8 типов уведомлений (opt-out) + общее время проверки забытых смен
- **部署タブ**（2026-09-11）: ↑↓ボタンで表示順を並び替え可能に（`onMove` prop、クリックごとに即保存、失敗時はロールバック）。他のタブ（勤務場所/職種・役職）には影響なし — `MasterPanel`の`onMove`は任意propとして追加
- ⚠️ **Ещё не сделано**: таб/страница **権限** (только для ADMIN) — CRUD ролей с чекбоксами по Permission (см. 3.13, открытые задачи)

### main.jsx (2026-09-26)
- `React.lazy` + `Suspense`: киоск (`/kiosk`) и менеджерский `App` грузятся отдельными чанками
- Каждый `import()` — в своей функции (`loadKiosk` / `loadApp`), **не** через `isKiosk ? import(A) : import(B)` — см. ловушки
- `globals.css` подключается динамически ПОСЛЕ страницы (`.then(mod => loadGlobals().then(() => mod))`) — сохраняет прежний порядок CSS (раньше globals импортировался последним)

### KioskPage.jsx + KioskPage.module.css (`frontend/src/pages/kiosk/`)
- **Стили — в `KioskPage.module.css`** (CSS Modules, с 2026-09-25). Инлайн-стилей нет (кроме `display:none` у canvas). Префиксы классов: `t*` — планшет, `m*` — телефон, `p*` — попап (общее), `s*` — карточка сотрудника; хелпер `cx(...)` для склейки className
- **Раскладки**: телефон ≤768px (`useIsMobile()`), планшет >768px, монитор ≥1920px (8 колонок) / ≥2560px (10 колонок); планшет вертикально — компактная шапка `@media (max-width: 1100px)`
- **Телефон**: шапка ☰ / HannoSHIFT / Wi-Fi (тонкие SVG), дата+время одной строкой по центру; горизонтальная строка букв `MobileKanaBar` под шапкой (вне скролла → всегда видна); сетка 4 колонки, gap 2px
- **Планшет**: шапка с тонкими иконками ☰ ↻ Wi-Fi, 出勤中 N人 текстом; левая колонка букв; сетка 5 колонок, gap 14px
- **Карточка сотрудника** (`StaffCard`, общая для обоих, `React.memo`): фото фиксированной высоты — CSS-переменные `--kiosk-photo-h` / `--kiosk-name-h` в `.mGrid` (телефон) и `.tGrid` (планшет); высота ряда задаётся `.gridRows` (`grid-auto-rows`) только когда показаны карточки; бейдж времени прихода в левом верхнем углу фото (● зелёная — работает, оранжевая — перерыв)
- **Попап отметки** (`PunchPopup`, одна разметка для телефона и планшета): камера (овал `.pOval`, имя, ✕, бейдж прихода), `PopupClock align="left"`, отметки за сегодня, кнопки 2×2 с иконками, контурная キャンセル. Телефон — колонка, планшет — камера слева / панель справа. Экран подтверждения: 写真を確認してください, фото (`--cam-h`), время, ✓-кнопка цвета действия
- **Цвета действий** — классы `.actClockIn` (#17935f зелёный), `.actClockOut` (#e53935), `.actBreakStart` (#f57c00), `.actBreakEnd` (#3b6fd4 синий); `ACTION_CLASS` в JSX
- **Фото**: снимок зеркалится при сохранении (как на камере); JPEG 0.7 кодируется асинхронно (`canvasToJpegDataUrl`, fallback `toDataURL`)
- **Wi-Fi**: тап → подсказка 接続あり/接続なし на 2 сек (`showWifiTip`), окна с OK больше нет
- **Сеть/данные** (2026-09-26):
  - `fetchStatusesBatch()` → `/api/kiosk/statuses`; при 404/405 запоминает «не поддерживается» и использует `fetchStatusesEach()` (старый способ по одному запросу); при 401/403/5xx — старый способ на этот раз
  - При сбое запроса по отдельному сотруднику сохраняется прежний статус (не «не пришёл»); если упали все — считается, что нет связи
  - `fetchWithTimeout()` (8с / 10с пробивка), retry 3×5с, `online`-listener — как раньше. Авто-reload через 20с в текущем коде **нет**
  - Опрос каждые 30с (`POLL_INTERVAL_MS`) только когда экран виден и попап закрыт; при возврате на экран — сразу обновление
  - Одинаковые данные не перерисовываются (`sameJson`, `mergeStatusMap`)
- **После отметки**: попап закрывается сразу, карточка обновляется оптимистично (`applyPunchLocally`, повторяет серверную логику: 退勤 → NOT_STARTED), затем `fetchOneStatus` в фоне + `preloadImage`; `lastPunchAtRef` / `punchSeqRef` не дают старому ответу затереть свежий статус
- **Камера** — один общий менеджер на уровне модуля (`camAcquire` / `camRelease` / `camEnsure` / `camStopNow`): после закрытия попапа остаётся включённой `CAMERA_KEEP_ALIVE_MS` (60с), при скрытии экрана выключается сразу, при возврате попап перезапускает её сам
- **Часы**: `useNow(stepMs)` в отдельных компонентах (`MobileHeaderClock` — раз в минуту, `TabletHeaderClock`/`PopupClock` — раз в секунду) — остальной экран каждую секунду не перерисовывается
- Сознательное решение (с 2026-09-01, без изменений): при обрыве сети пробивка **не** сохраняется локально
- Порядок сотрудников по отделам задаёт сервер (`GET /api/kiosk/staff`), фронт сохраняет порядок массива

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
- Flyway на dev отключён — новые миграции (например V20) применять вручную через `docker compose exec postgres psql -U shiftuser -d shiftapp`, файл миграции при этом всё равно коммитить в репозиторий для прода

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
- **`toISOString()` в форме редактирования打刻 (`AttendancePage.jsx`)** — та же ловушка что и с датами: показывает UTC-время вместо JST при заполнении `<input type="datetime-local">`. Использовать `toJstDatetimeLocal()`/`fromJstDatetimeLocal()` (добавлены 2026-09-23), не голый `new Date(iso).toISOString()`
- `getName()` → `localStorage.staffName` (не декодировать JWT)
- `RESTAURANT_ID = 1` захардкожен в KioskPage.jsx
- Удаление пользователя: shift_slots → preferences → time_records → users
- `ManagerUserController.unlock()` обязан быть `@Transactional`
- `ReportService.buildDay()`: `slot.endTime` передавать всегда реальным значением, даже при `last=true`
- `勤怠管理` リスト/Excel для `休憩時刻`: fallback на `officialBreakMinutes`, если нет реальной пробивки 休憩/復帰
- **`CustomUserDetails` не имеет `getId()`** — только `getUserId()`
- **`KioskService.getStaffList()` и любой другой доступ к `user.getDepartments()`** — та же ловушка, что и с `unlock()`: обязательна `@Transactional`, иначе `LazyInitializationException`
- **Docker volume naming**: вручную созданный `docker volume create X` ≠ то же имя внутри compose без `external: true` — Compose добавляет префикс проекта и создаёт пустой volume молча
- **Git Bash на Windows** не наследует переменные окружения из `setx` — для тестовых команд с секретами использовать CMD/PowerShell либо вписывать значение прямо в команду
- **Google Drive API rate limit**: при частых последовательных `rclone copy` в тестах — `RATE_LIMIT_EXCEEDED`, нужна пауза `sleep 3` между вызовами в скриптах
- **ForgotClockoutScheduler**: не завязывать логику на "вчера" относительно текущей даты — если время проверки настроено близко к концу суток, "вчера" может быть неверным днём. Брать `workDate` из самой открытой сессии, проверять последние 2 дня
- **Vite + динамический импорт**: НЕ писать `isKiosk ? import('./A') : import('./B')` в одном выражении — Vite вешает зависимости (CSS) не того чанка: киоск грузил CSS менеджерской части, а собственные стили киоска не загружались. Каждый `import()` — в отдельной функции (см. `main.jsx`)
- **Статус на киоске — не загружать всю историю сотрудника** (`findByUser_IdOrderByRecordedAtAsc`): время растёт с каждым месяцем и умножается на число сотрудников. Использовать `buildStatuses()` / лёгкие запросы (см. 3.7)
- **`KioskRecordRow`** указан в JPQL полным именем (`com.shiftapp.kiosk.KioskRecordRow`) — при переносе/переименовании обновить запросы в `TimeRecordRepository`, иначе Spring не стартует
- **Карточки киоска в CSS grid**: высоту фото задавать фиксированно (`--kiosk-photo-h`) + `grid-auto-rows`; проценты (`padding-top`, `aspect-ratio`) внутри grid давали неверную высоту строки → карточки обрезались/наезжали
- **Камера киоска**: не вызывать `getUserMedia` напрямую в компоненте — только через `camAcquire()`/`camRelease()`, иначе вернётся баг «камера осталась включённой, если попап закрыли до её запуска»
- **KioskPage.jsx мобильная вёрстка**: контейнеру модалки нужна **явная** высота (не только `maxHeight`), иначе flex-дети с `flex:1` могут схлопнуться в 0 на некоторых мобильных браузерах — использовать `calc(100dvh - Npx)`, не `min(640px, 92vh)` с неявной высотой
- Отчёты (Excel) — при добавлении новых visibleColumns-based колонок на фронте не забывать синхронно обновлять и `attendance_sessions.py` (COLUMN_DEFS/COLUMN_ORDER), и Java-сторону (payload) — актуально и для `models.py` (SessionModel), если добавляется новое вычисляемое поле
- **`ReportService.computeSessionOfficial()` больше не "прилипает" к плану** (исправлено 2026-09-23) — если где-то в новом коде понадобится именно "прижатое к плану" значение (например, для какого-то будущего отчёта по нормо-часам), это придётся явно считать заново, старое поведение убрано намеренно как баг
- **Единственный оставшийся способ выгрузить Excel из 勤怠管理画面** — кнопка «📥 Excel» (всегда = отфильтрованные данные текущего экрана). Методы `generateAttendanceTimesheet`/`generateAttendanceList` в `ReportService.java` и соответствующие Python-файлы оставлены в коде, но из UI не вызываются — при рефакторинге репортов можно смело их удалить, если не появится других причин их использовать
- **RBAC (2026-09-26)**: `RoleController`/`PermissionController` защищены строго `hasRole('ADMIN')`, НЕ через `Permission` — иначе пользователь с правом "редактировать роли" мог бы выдать самому себе любые права (privilege escalation). Не переводить на `@PreAuthorize("hasAuthority(...)")` без явного пересмотра этого решения
- **RBAC**: если у `MANAGER`/`STAFF` не назначена `customRole` (`customRole == null`), у него нет НИ ОДНОГО точечного `Permission` — только базовый `ROLE_*`. Это осознанное решение (не fallback на "все права"), поэтому при создании новых MANAGER/STAFF нужно не забывать назначать роль, иначе они не пройдут `@PreAuthorize` ни на одном manager-эндпоинте несмотря на прохождение URL-уровня `/api/manager/**`
- **RBAC**: `Permission` enum не имеет отдельных `SHIFT_EDIT/CREATE/DELETE` — все write-операции по сменам используют тот же `SHIFT_VIEW`, что и чтение (осознанное решение 2026-09-26, см. 3.13)
- **RBAC**: точный SQL и имя файла `V18` (sort_order на users) и полный состав `AuditAction`/`AuditEntityType`/`AuditLogService` (V19, audit log) в этом чате не были получены — известно только по факту использования в коде (`User.sortOrder`, вызов `AuditLogService.log(...)` в `MonthStatusController`). Если в другом чате есть точные версии этих файлов — стоит досверить и дополнить этот документ