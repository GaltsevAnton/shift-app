# HannoSHIFT — SERVER_INFO (RU)

Технические параметры сервера и настроек (по состоянию на 2026-09-01)

---

## 1) Общая информация о сервере

- **Расположение**: физический сервер в здании отеля (не облако/VPS)
  ⚠️ Единая точка отказа (риск полной потери при пожаре/краже/поломке). Частично снижен за счёт offsite-бэкапа (см. §4).
- **Имя хоста**: `hanno-web`
- **ОС**: Linux (Ubuntu-based, apt/systemd)
- **Основной пользователь**: `anadminsrv` (аккаунт для администрирования, есть sudo)
- **Домен**: `hanno-shift.duckdns.org` (бесплатный домен DuckDNS. Обновление IP каждые 5 мин через crontab: `*/5 * * * * ~/duckdns/duck.sh`)

---

## 2) Структура приложения

### 2.1 Backend (Spring Boot)
- **Расположение**: `/opt/shift-app/backend-0.0.1-SNAPSHOT.jar`
- **Имя systemd-сервиса**: `shift-app.service`
- **Файл юнита**: `/etc/systemd/system/shift-app.service`
- **Пользователь запуска**: `anadminsrv`
- **Внешний конфиг**: `/opt/shift-app/application.yml`
  (подключается через `--spring.config.additional-location=file:/opt/shift-app/application.yml`)
- **Переменные окружения** (`Environment=` внутри юнит-файла):
  - `APP_JWT_SECRET` — секрет для подписи JWT
  - `MAIL_APP_PASSWORD` — пароль приложения Gmail SMTP (см. §5)
- **Процесс деплоя** (текущий, ручной):
  1. Локально `mvn clean package`
  2. Полученный jar заменяет `/opt/shift-app/backend-0.0.1-SNAPSHOT.jar`
  3. `sudo systemctl restart shift-app`
- **Логи**: `sudo journalctl -u shift-app -n 100 --no-pager`

### 2.2 Report Service (Python FastAPI)
- **Расположение**: `/opt/report-service/`
- **Структура**: `main.py`, `models.py`, `builders/` (билдеры Excel-отчётов), `routers/`
- **Python**: 3.12.3
- **Виртуальное окружение**: `/opt/report-service/venv` (создано через стандартный `venv`)
- **Зависимости** (`/opt/report-service/requirements.txt`):
  ```
  fastapi==0.111.0
  uvicorn[standard]==0.29.0
  openpyxl==3.1.2
  pydantic==2.7.1
  ```
- **Имя systemd-сервиса**: `shift-report.service`
- **Юнит-файл**: `/etc/systemd/system/shift-report.service`
  ```ini
  [Unit]
  Description=HannoSHIFT Report Service (FastAPI)
  After=network.target
  [Service]
  User=anadminsrv
  WorkingDirectory=/opt/report-service
  ExecStart=/opt/report-service/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001 --workers 2
  Restart=always
  RestartSec=5
  Environment=PYTHONUNBUFFERED=1
  [Install]
  WantedBy=multi-user.target
  ```
- **Порт**: 8001 (слушает только `127.0.0.1`, не доступен снаружи напрямую — только через backend)
- **Роль**: генерация Excel-отчётов (勤怠集計表, シフト表, 打刻一覧 и т.д.)
- Backend обращается к нему по HTTP через `report.service.url` (по умолчанию `http://localhost:8001`)
- **Обновление зависимостей** (при необходимости):
  ```bash
  cd /opt/report-service
  source venv/bin/activate
  pip install -r requirements.txt --break-system-packages
  ```

### 2.3 Frontend (React / Vite)
- Статика раздаётся через nginx (`spring.web.resources.static-locations: file:/var/www/shift-app/`)
- Точные команды сборки/выкладки на сервер не задокументированы — уточнить отдельно

### 2.4 Reverse Proxy (nginx)
- **Конфиг сайта**: `/etc/nginx/sites-available/shift-app` (симлинк в `/etc/nginx/sites-enabled/shift-app`)
- **Корень статики фронтенда**: `/var/www/shift-app` (index.html + SPA-роутинг через `try_files $uri /index.html`)
- **Маршрутизация**:
  - `/` → раздача React SPA (index.html)
  - `= /kiosk` → отдельный `kiosk.html` (страница киоска)
  - `/api/auth/` → проксирование на `http://localhost:8080/auth/` (backend), с **rate-limit 5 запросов/мин** на IP (`limit_req zone=auth`) — защита от брутфорса логина
  - `/api/` → проксирование на `http://localhost:8080/` (остальной backend API)
  - `/photos/` → alias на `/var/www/shift-app/photos/`, с заголовками `no-cache, no-store` (фото не кэшируются браузером)
  - `/manifest.webmanifest`, `/kiosk-manifest.webmanifest` → PWA-манифесты
- **SSL**: через **Certbot / Let's Encrypt**
  - Сертификаты: `/etc/letsencrypt/live/hanno-shift.duckdns.org/`
  - Автообновление обычно через системный `certbot.timer` (не проверяли явно — см. §7 TODO)
- **Security-заголовки**: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- **HTTP→HTTPS редирект**: отдельный `server` блок на порту 80, редирект на https (управляется Certbot)

---

## 3) База данных

- **СУБД**: PostgreSQL 16
- **Имя базы**: `shiftapp`
- **Управление миграциями**: Flyway
  - **Прод**: `flyway.enabled: true`, `baseline-on-migrate: true`, `baseline-version: 5`
    Файлы миграций: `classpath:db/migration` (внутри jar, `V*.sql`)
  - **Dev**: `flyway.enabled: false` — миграции применяются вручную через SQL-клиент
- **JPA**: `hibernate.ddl-auto: validate` (прод) — автогенерации схемы нет, источник истины — Flyway

### Основные миграции (кратко)
```
V1–V9    — начальная схема, workplaces, departments, lock, time_records, kana, kiosk, profile
V10      — флаг next_day (ночные смены)
V11      — break_rules (правила перерывов)
V12      — break_override_minutes
V13–V14  — month_status (статус месяца, поддержка половин месяца)
V15      — безопасность входа (поэтапная блокировка аккаунта)
V16      — notification_preferences, notification_settings (email-уведомления)
```

---

## 4) Бэкапы

### 4.1 Бэкап БД (на сетевой диск другого сервера)
- **Скрипт**: `/opt/shift-app/backup.sh`
- **Запуск**: crontab пользователя root, каждый день в **03:00 JST**
  ```
  0 3 * * * bash /opt/shift-app/backup.sh >> /var/log/backup-shift.log 2>&1
  ```
- **Куда сохраняется**: `/mnt/backup-shift/shiftapp_YYYYMMDD_HHMM.sql` (SQL-дамп через `pg_dump`)
  ⚠️ **Важно**: `/mnt/backup-shift/` — это смонтированная сетевая папка (`\\192.168.1.11\backup_shift`) на **другом физическом сервере**, не на `hanno-web`. То есть это уже частичная защита от потери именно машины `hanno-web` — база не пропадёт, если сломается/украдут именно этот сервер. Но оба сервера физически находятся в одном здании отеля, поэтому от пожара/затопления всего здания это не спасает — для этого нужен именно облачный offsite-бэкап (см. §4.2).
- **Срок хранения**: 30 дней (`find ... -mtime +30 -delete`)
- **Лог**: `/var/log/backup-shift.log`

### 4.2 Offsite-бэкап БД в облако (добавлено 2026-09-01)
- **Способ**: загрузка через `rclone` на Google Drive
- **Имя remote в rclone**: `gdrive` (конфиг настроен и для `anadminsrv`, и для `root` — `~/.config/rclone/rclone.conf`)
- **Куда загружается**: Google Drive (аккаунт `hannoshift.notify@gmail.com`), папка `hannoshift-backups`
- **Срок хранения**: в Google Drive 90 дней (`rclone delete ... --min-age 90d`)
- **Когда запускается**: сразу после бэкапа БД, в том же `backup.sh`
- **Проверено**: 2026-09-01, ручной запуск, файл успешно появился в облаке

### 4.3 Бэкап фотографий (добавлено 2026-09-01)
- **Источник**: `/var/www/shift-app/photos/` (фото сотрудников при пробивке в киоске)
- **Куда**: `/mnt/backup-shift/photo/` (та же сетевая папка на `192.168.1.11`, что и для БД)
- **Способ**: `rsync -a --delete` — синхронизация только новых/изменённых файлов; удалённые на проде фото исчезают и в бэкапе (папка бэкапа всегда отражает актуальное состояние, а не копит историю)
- **Запуск**: в том же `backup.sh`, сразу после бэкапа БД
- **В Google Drive НЕ загружаются** — осознанное решение, только локальная копия на сетевом диске

### 4.4 Бэкап критичных конфигов (добавлено 2026-09-01)
- **Что бэкапится**: `/opt/shift-app/application.yml`, `/etc/systemd/system/shift-app.service`, `/etc/systemd/system/shift-report.service`, `/etc/nginx/sites-available/shift-app`
- **Куда локально**: `/mnt/backup-shift/config/` (та же сетевая папка на `192.168.1.11`), хранится последние **10 версий** каждого файла
- **Куда в облако**: Google Drive, отдельная приватная папка `hannoshift-backups-config` (отдельно от папки с SQL-дампами — там же potentially секреты уровня JWT/mail из юнитов) — хранится только **самая свежая** версия каждого файла (перезаписывается ежедневно)
- **Важно**: сам `application.yml` не содержит пароль напрямую — там плейсхолдер `${MAIL_APP_PASSWORD}`, реальное значение живёт в `Environment=` внутри systemd-юнита. Юнит-файлы (которые бэкапятся отдельно) как раз и содержат реальные секреты (`APP_JWT_SECRET`, `MAIL_APP_PASSWORD`) — обращаться с папкой `hannoshift-backups-config` аккуратно
- **Между загрузками файлов в Google Drive стоит пауза `sleep 3`** — защита от `RATE_LIMIT_EXCEEDED` (лимит Google Drive API на запросы в минуту), с этим уже столкнулись при ручном тестировании нескольких команд подряд
- **Проверено**: 2026-09-01, полный прогон `backup.sh` отработал без ошибок, файлы появились и локально, и в облаке

### 4.5 Что НЕ бэкапится (стоит продумать)
- **Исходный код** фронтенда/бэкенда: хранится в Git (GitHub и т.п., управляется отдельно разработчиком). Dev-версия `application.yml` (на локальном ПК) также **не в Git** — только прод-версия теперь бэкапится через `backup.sh`
- **SSL-сертификаты** (`/etc/letsencrypt/`): не бэкапятся отдельно — при потере сервера потребуется перевыпустить через Certbot заново (см. §7)

### 4.6 Восстановление из бэкапа

✅ **Проверено на тестовой базе 2026-09-01** — восстановление БД и фото отработало корректно.

```bash
# Восстановление БД из локального дампа
sudo -u postgres psql shiftapp < /mnt/backup-shift/shiftapp_YYYYMMDD_HHMM.sql

# Восстановление фото
rsync -a /mnt/backup-shift/photo/ /var/www/shift-app/photos/

# Восстановление конфигов
cp /mnt/backup-shift/config/application_YYYYMMDD_HHMM.yml /opt/shift-app/application.yml
cp /mnt/backup-shift/config/shift-app.service_YYYYMMDD_HHMM /etc/systemd/system/shift-app.service
cp /mnt/backup-shift/config/shift-report.service_YYYYMMDD_HHMM /etc/systemd/system/shift-report.service
cp /mnt/backup-shift/config/nginx-shift-app_YYYYMMDD_HHMM /etc/nginx/sites-available/shift-app
```

---

## 5) Email-уведомления

- **Провайдер**: Gmail SMTP
- **Аккаунт-отправитель**: `hannoshift.notify@gmail.com` (отдельный служебный аккаунт, 2FA включена)
- **Способ аутентификации**: пароль приложения (App Password)
- **Настройки SMTP** (`application.yml`, одинаково на dev и prod):
  ```yaml
  spring:
    mail:
      host: smtp.gmail.com
      port: 587
      username: hannoshift.notify@gmail.com
      password: ${MAIL_APP_PASSWORD}
      properties:
        mail:
          smtp:
            auth: true
            starttls:
              enable: true
  ```
- **Способ отправки**: асинхронно (`@Async` + `@EnableAsync`) — не блокирует пробивку в киоске
- **Типы уведомлений** (8 штук, enum `NotificationType`):
  1. `LATE_ARRIVAL` — опоздание
  2. `EARLY_DEPARTURE` — ранний уход
  3. `FORGOT_CLOCKOUT` — забытый выход (ежедневная проверка, время настраивается, по умолчанию 00:00)
  4. `UNSCHEDULED_ARRIVAL` — приход без плана
  5. `ACCOUNT_LOCKED` — постоянная блокировка аккаунта
  6. `EMPLOYEE_CREATED` — новый сотрудник создан
  7. `EMPLOYEE_DELETED` — сотрудник удалён
  8. `PASSWORD_CHANGED` — смена пароля (уведомляются все, кроме того, кто менял)
- **Управление настройками**: индивидуально на каждого менеджера (таблица `notification_preferences`, модель opt-out)
- **Лимит Gmail**: 500 писем/день (текущей нагрузки хватает с большим запасом)

### Google Drive (тот же аккаунт `hannoshift.notify@gmail.com`)
Тот же аккаунт используется и как хранилище offsite-бэкапов через rclone (§4.2).
Бесплатный лимит 15 ГБ, файлы бэкапа по несколько сотен КБ — места хватит очень надолго.

---

## 6) Безопасность

- **JWT-аутентификация**: `APP_JWT_SECRET` (переменная окружения systemd)
  - Обычные роли: access-токен на 120 минут
  - Роль KIOSK: долгоживущий токен (~10 лет, `generateKioskToken()`)
- **Разрешённые CORS-источники** (`SecurityConfig.java`):
  ```
  http://localhost:5173, http://localhost:4173
  http://192.168.1.19:5173, http://192.168.1.19:4173  (локальная сеть отеля)
  https://hanno-shift.duckdns.org
  ```
- **Блокировка при неудачных попытках входа** (миграция V15):
  - 5 попыток → блок на 10 минут
  - 10 попыток → блок на 30 минут
  - 15 попыток → блок на 3 часа
  - 20 попыток → постоянная блокировка (снимается только менеджером вручную, приходит email-уведомление)
- **Экспортный контроль и подобные внешние ограничения**: не применимо (внутренняя рабочая система)

---

## 7) Аварийное восстановление (Disaster Recovery) — план на случай отказа сервера

**Статус**: восстановление БД и фото из бэкапа **проверено на тестовой базе 2026-09-01** и отработало корректно. Полный сценарий "поднять сервер с нуля" (установка ПО → backend → report-service → nginx → DNS/SSL целиком) пока не прогонялся целиком — план ниже составлен на основе документации, прогон запланирован.

Цель — минимизировать время простоя, если `hanno-web` выйдет из строя физически (пожар, кража, поломка).

### Что нужно заранее, чтобы этот план сработал
- [x] Ежедневный бэкап `application.yml`, systemd-юнитов и nginx-конфига — настроен 2026-09-01 (см. §4.4)
- [x] Доступ к аккаунту `hannoshift.notify@gmail.com` (Google Drive с бэкапами БД/фото/конфигов, Gmail для SMTP)
- [x] Доступ к DuckDNS-аккаунту (для обновления IP нового сервера на домен)
- [x] Git-репозиторий с исходным кодом (frontend/backend/report-service) должен быть доступен независимо от `hanno-web`

### Шаги восстановления на новом сервере

**1. Базовая установка (Ubuntu/Linux)**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y openjdk-21-jdk postgresql-16 nginx python3 python3-venv python3-pip rsync certbot python3-certbot-nginx
```

**2. Восстановление базы данных**
```bash
sudo -u postgres createdb shiftapp
# Взять свежий .sql либо с /mnt/backup-shift/ (если сервер 192.168.1.11 жив),
# либо скачать последний файл из Google Drive (hannoshift-backups)
sudo -u postgres psql shiftapp < shiftapp_ПОСЛЕДНИЙ.sql
```

**3. Восстановление backend**
```bash
sudo mkdir -p /opt/shift-app
# Скопировать актуальный jar (собрать заново из Git: mvn clean package)
# Восстановить application.yml (из резервной копии — см. чеклист выше)
# Создать /etc/systemd/system/shift-app.service (содержимое — см. §2.1)
# Прописать Environment=APP_JWT_SECRET=..., Environment=MAIL_APP_PASSWORD=...
sudo systemctl daemon-reload
sudo systemctl enable --now shift-app
```

**4. Восстановление report-service**
```bash
sudo mkdir -p /opt/report-service
# Скопировать код из Git
cd /opt/report-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt --break-system-packages
deactivate
# Создать /etc/systemd/system/shift-report.service (содержимое — см. §2.2)
sudo systemctl daemon-reload
sudo systemctl enable --now shift-report
```

**5. Восстановление фронтенда**
```bash
# Собрать фронтенд из Git (npm run build) и скопировать в /var/www/shift-app
sudo mkdir -p /var/www/shift-app
# Восстановить фото (если есть свежий /mnt/backup-shift/photo/):
rsync -a /mnt/backup-shift/photo/ /var/www/shift-app/photos/
```

**6. Восстановление nginx**
```bash
# Восстановить /etc/nginx/sites-available/shift-app из резервной копии (см. §2.4)
sudo ln -s /etc/nginx/sites-available/shift-app /etc/nginx/sites-enabled/shift-app
sudo nginx -t
```

**7. DNS и SSL**
```bash
# Обновить DuckDNS на новый IP сервера (через веб-панель или duck.sh скрипт)
sudo certbot --nginx -d hanno-shift.duckdns.org
sudo systemctl reload nginx
```

**8. Восстановление бэкапов на новом сервере**
```bash
# Прописать в crontab root: backup.sh + расписание (см. §4.1)
# Настроить rclone заново (rclone config, remote "gdrive", см. §4.2) —
# либо скопировать ~/.config/rclone/rclone.conf, если сохранился
```
Начиная с 2026-09-01, актуальные версии `application.yml`, юнитов и nginx-конфига
всегда лежат в Google Drive (`hannoshift-backups-config`) — можно скачать их
оттуда сразу на шагах 3, 4, 6 вместо восстановления по памяти.

**9. Финальная проверка**
- [ ] Открыть `https://hanno-shift.duckdns.org` — фронтенд загружается
- [ ] Залогиниться менеджером — backend/БД работают
- [ ] Сгенерировать любой Excel-отчёт — report-service работает
- [ ] Открыть `/kiosk`, сделать тестовую пробивку — фото сохраняется
- [ ] Проверить, что тестовое письмо уходит (например, спровоцировать любое уведомление)
- [ ] Проверить, что `backup.sh` отрабатывает вручную без ошибок

### Как ускорить этот процесс в будущем
- Держать шаги 1–2 в виде единого bash-скрипта (`provision.sh`), а не выполнять вручную
- Рассмотреть Docker/docker-compose для backend + report-service + nginx — тогда "поднять новый сервер" сводится к `docker compose up` вместо ручной установки зависимостей
- Держать резервную копию `application.yml`, юнит-файлов и конфига nginx в приватном Git-репозитории (отдельном от кода — из-за секретов), чтобы не зависеть от единственной бумажки/файла на компьютере

---

## 8) Известные пробелы / что стоит доделать

- [x] Бэкап `application.yml` (прод) — реализован, хранится локально и в Google Drive вне `hanno-web` (см. §4.4)
- [x] Восстановление из бэкапа — **проверено на тестовой базе 2026-09-01**, БД и фото восстанавливаются корректно
- [x] Резервная копия конфигов nginx / systemd-юнитов / application.yml — реализована (см. §4.4)
- [x] Автообновление SSL-сертификата Certbot — проверено (`certbot renew --dry-run`), работает корректно
- [x] Обработка обрыва сети на киоске — реализовано и протестировано 2026-09-01 (индикатор связи, автоповтор, авто-reload), отрабатывает хорошо
- [ ] Провести пробный прогон **полного** плана аварийного восстановления (§7) на тестовом сервере — восстановление БД/фото уже проверено отдельно, но полный сценарий "с нуля" (установка ПО, backend, report-service, nginx, DNS/SSL) целиком ещё не прогонялся — запланировано
- [ ] Ограничения бесплатного домена DuckDNS — острой необходимости менять пока нет, вопрос отложен, вернуться в будущем при необходимости

---

*Этот файл собран на основе переписки и отражает текущее состояние на дату создания. При следующих технических изменениях (смена способа деплоя, миграция БД, новое место для бэкапов и т.п.) — дополняй этот файл.*