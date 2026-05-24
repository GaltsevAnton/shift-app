# HannoSHIFT — CHANGELOG

Лог изменений по дням разработки.

---

## 2026-05-19

### Конкурентное редактирование
- Оптимистичная блокировка (`@Version` на `Preference`) — защита от конфликтов при одновременном редактировании двумя менеджерами
- `GlobalExceptionHandler` — обработка `ObjectOptimisticLockingFailureException` → HTTP 409
- `ManagerTablePage` — при конфликте показывает алерт и тихо перезагружает данные
- Автообновление таблицы каждые 60 сек — только если попап закрыт (`!openCell`)
- `load(ym, silent)` — тихий режим без спиннера и закрытия попапа
- SQL: `ALTER TABLE preferences ADD COLUMN version BIGINT NOT NULL DEFAULT 0`
### Инфраструктура
- Flyway настроен на проде (`baseline-version: 5`, `ddl-auto: validate`)
- Миграции V1-V5 созданы и записаны как BASELINE в `flyway_schema_history`
- Права БД: `GRANT ALL PRIVILEGES ON ALL TABLES/SEQUENCES TO shiftuser`
- Внешний конфиг прода: `/opt/shift-app/application.yml` через `--spring.config.additional-location`
- `shift-app.service` обновлён с флагом внешнего конфига

### Безопасность
- Автологаут через 30 минут бездействия (`App.jsx`)
- Ошибки авторизации на японском (`GlobalExceptionHandler.java`)
- Валидация полей логина с японскими сообщениями (`LoginRequest.java`)

### Новые функции
- Отделы (部署) — справочник + ManyToMany связь с сотрудниками (`departments`, `user_departments`)
- Третий таб 部署 в `SettingsPage`
- Лого и название HannoSHIFT на странице логина
- Фавикон заменён на `logo.png`
- Мануал для сотрудников — PDF и DOCX на японском (`/manual.pdf`)

### Оптимизация
- `ManagerMonthController` — 3 SQL запроса на месяц вместо N×3
- Убран `StrictMode` из `main.jsx`

### UX / Мобильная оптимизация
- Сохранение выбранного месяца/недели в localStorage (восстанавливается после перезагрузки)
- `clearToken()` очищает все ключи состояния при выходе
- iOS автозум предотвращён (`font-size: max(16px, 1em)`)
- Мобильная вёрстка `StaffMonth` и `StaffWeek` — убран лишний `min-height`, `table-layout: fixed`
- Попап `CellPopover` — `position: fixed` + `getBoundingClientRect()`
- Блокировка кнопок 更新 и 前週コピー во время запроса

### Исправление багов
- `LazyInitializationException` при загрузке сотрудников (`LEFT JOIN FETCH u.departments`)
- Копирование L: если есть L → только earliest startTime, endTime=null
- Валидация пустой недели (все галочки сняты, времена пустые)

---

## 2026-05-15

### Новые функции
- Справочники 設定 — два таба: 勤務場所 и 職種・役職
- Поле 職種・役職 в форме сотрудника → выпадающий список из справочника
- Столбец 職種・役職 и 氏名 в таблице シフト管理 (sticky)
- Столбец 勤務場所 в ячейках таблицы (под временем, серый текст)
- Мульти-слоты — до 5 рабочих зон в один день
- Попап редактирования ячейки с поддержкой нескольких слотов

### UX
- Увеличены шрифты и размеры в таблице シフト管理
- Попап всегда открывается в пределах экрана
- Sidebar получил пункт ⚙️ 設定
- Страницы 従業員管理 и 設定 отцентрированы
- Градиент в шапке topBar таблицы

---

## 2026-05-14

### Архитектура
- Рефакторинг схемы БД: `shift_slots` вместо полей в `preferences`
- Новые таблицы: `shift_slots`, `workplaces`, `positions`
- `Preference.java` — убраны `startTime/endTime/isLast`, добавлен `OneToMany slots`
- `ShiftSlot.java` — новый entity с workplace и isLast

### Новые функции
- Функция L (ラスト) — менеджер выставляет, сотрудник видит но не может ставить
- Копирование недели (`staffCopyPrevWeek`) с учётом L
- Страница 従業員管理 — поле position как выпадающий список

---

## 2026-05-10

### Основа проекта
- Monorepo: Spring Boot + React/Vite
- JWT аутентификация, роли STAFF/MANAGER/ADMIN
- Страница シフト管理 — месячная таблица смен
- Страница 従業員管理 — CRUD сотрудников
- Страница сотрудника — выбор месяца, редактирование недели
- Статусы смен: 受付中 / 作成中 / 確定
- Деплой: nginx + Spring Boot jar, `https://hanno-shift.duckdns.org`