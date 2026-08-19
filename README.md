# Talanty — полная документация / Complete documentation

> Один основной документ для пользователей, администраторов и разработчиков.
> One canonical document for users, administrators, and developers.

**Язык по умолчанию — русский.** Интерфейс также поддерживает узбекский и английский.
**Russian is the default language.** The interface also supports Uzbek and English.

- [Русская версия](#русская-версия)
- [English version](#english-version)

---

# Русская версия

## 1. Что такое Talanty

Talanty — система для подбора сотрудников. Здесь компания может:

- создавать вакансии и публиковать их в hh.uz, OLX.uz, Telegram и PersonHunters;
- хранить кандидатов и PDF-резюме;
- получать кандидатов из hh.uz и Telegram;
- вести кандидата по этапам воронки;
- получать разбор резюме и оценку соответствия вакансии с помощью ИИ;
- работать командой, не смешивая данные разных компаний.

Простая картинка: **вакансия — коробка с работой, кандидат — карточка человека, а воронка показывает, на каком шаге сейчас этот человек**.

## 2. Главное для пользователя

### Компания и доступ

У каждого пользователя одна компания.

| Роль | Что может делать |
| --- | --- |
| Владелец | Всё; меняет роли, отключает и возвращает сотрудников |
| Администратор | Редактирует компанию и управляет ссылками-приглашениями |
| Сотрудник | Работает с доступными данными, но не управляет компанией |

Владелец — человек, создавший компанию; владелец у компании один. Владелец или администратор открывает **Мой профиль → Настройки компании → Команда**, создаёт ссылку и отправляет её сотруднику. Ссылка действует 14 дней, многоразовая и отзывная. Отключённый сотрудник не может войти, но его история сохраняется.

### Кандидаты и вакансии

Кандидата можно создать вручную, загрузить из PDF или получить из hh.uz/Telegram. PDF должен быть настоящим PDF не больше 10 МБ. Файл хранится в Directus; при настроенном Gemini система извлекает данные, делает краткий анализ и оценивает совпадение с вакансией.

Сначала создаётся основная вакансия. Затем для каждого канала создаётся отдельная версия публикации. Черновик формы хранится в браузере, поэтому обычное обновление страницы его не стирает. Все кандидаты и вакансии фильтруются по `companyId`: другая компания их не видит.

## 3. OLX.uz — инструкция простыми словами

### Что умеет интеграция

Talanty умеет:

- подключить личный OLX-аккаунт конкретного пользователя;
- загрузить актуальные категории работ и подсказки адресов OLX;
- проверить объявление без создания;
- создать объявление с защитой от дублей;
- сохранить ссылку и ID объявления;
- деактивировать, снова активировать и навсегда удалить объявление;
- попросить переподключение, если OLX завершил сессию.

Сотрудник не может управлять объявлением через личный OLX-аккаунт другого сотрудника. Управляет тот пользователь, который подключил аккаунт и опубликовал объявление.

### Как подключить OLX

1. Используйте **Google Chrome**.
2. Откройте **Мой профиль → Настройки компании → OLX.uz**.
3. Если расширения нет, нажмите кнопку установки. Откроется [Talanty — OLX.uz Connector](https://chromewebstore.google.com/detail/talanty-%E2%80%94-olxuz-connector/fojllciekjkejbnehccfkeoghpjippon).
4. Нажмите **Установить**, вернитесь в Talanty и при необходимости нажмите **Проверить установку** или обновите страницу.
5. Прочитайте уведомление, поставьте галочку согласия и нажмите **Подключить OLX.uz**.
6. На настоящем сайте `olx.uz` войдите обычным способом. Пароль, CAPTCHA, SMS и OTP вводятся **только на OLX**.
7. Дождитесь полной загрузки страницы и нажмите в панели расширения **Я вошёл — подключить аккаунт**.
8. Вернитесь в Talanty: должен появиться статус **Подключен**.

Ничего копировать вручную не нужно. Пароль OLX Talanty не видит и не хранит.

### Как опубликовать

1. Откройте вакансию и создайте версию для **OLX.uz**.
2. Выберите специальность из живого списка OLX.
3. Начните вводить город и обязательно выберите точную подсказку; если OLX просит район, выберите район.
4. Заполните название (16–70 знаков), описание (80–9000), контактное лицо, вид работы и занятость. Телефон форматируется как `+998 XX XXX XX XX`.
5. Нажмите проверку/предпросмотр — объявление ещё не создаётся.
6. Нажмите **Опубликовать** один раз и подтвердите.

До отправки Talanty сохраняет стабильный `posting-id` и атомарно «занимает» публикацию. Параллельные нажатия не создадут два объявления. Если ответ потерялся, система проверит результат, а не отправит слепой дубль. Версию с сохранённым OLX ID/URL повторно опубликовать нельзя.

### Управление объявлением

- **Деактивировать** — скрыть на OLX.
- **Активировать** — показать снова.
- **Удалить** — удалить навсегда; сначала нужно деактивировать.

Локальный статус меняется только после подтверждения OLX. Если OLX уже не находит удаляемое объявление, это считается успехом только для публикации с подтверждённым владельцем.

### Если OLX не подключается

1. Проверьте Chrome и включённое расширение.
2. Обновите Talanty после установки или обновления расширения.
3. Войдите именно на `www.olx.uz` и дождитесь полной загрузки.
4. При сообщении «контекст запроса не готов» один раз обновите вкладку OLX, дождитесь загрузки и повторите подтверждение.
5. При статусе «Требуется вход» отключите и подключите OLX заново.
6. Не нажимайте публикацию много раз: пауза — 30 секунд, лимит — 10 операций в час.
7. При неопределённом ответе сначала проверьте **Мои объявления** на OLX.

### Данные, безопасность и ограничения

Расширение передаёт только нужный контекст OLX: access/refresh-токены, ID устройства, fingerprint, user agent и разрешённые cookies `deviceGUID`/`access_token`. Оно не читает пароль, CAPTCHA, SMS/OTP, формы, ответы API и чужие сайты. Данные передаются по HTTPS через одноразовый билет на 15 минут и не сохраняются в постоянном хранилище расширения.

- Учётные данные шифруются AES-256-GCM отдельным `OLX_CREDENTIALS_ENCRYPTION_KEY`, привязываются к пользователю/сессии и удаляются при отключении.
- Разрешены только точные ID расширений. Официальный ID: `fojllciekjkejbnehccfkeoghpjippon`; локальные ID перечисляются явно.
- Одна заблокированная строка билета не позволяет двум расширениям забрать его одновременно.
- Поиск мест: 120 запросов пользователя и 300 с IP за 15 минут.
- Предпросмотр/публикация: общая пауза 30 секунд и 10 операций в час на пользователя.
- Активация/деактивация/удаление: пауза 10 секунд и 20 операций в час на OLX-аккаунт.
- Chromium работает в короткой сессии, через ограниченную очередь, максимум два процесса; production sandbox не отключается.
- Категории кэшируются на 6 часов, адреса — на 15 минут. Сначала используется обычный HTTP; при OLX `403` запускается короткий Chromium fallback. Варианты `Tashkent`, `Samarkand`, `Bukhara` нормализуются для поиска OLX.
- Ротация refresh-токена сериализуется на один аккаунт. Старые ключи шифрования можно временно оставить только для чтения во время ротации.
- Endpoint подключения имеет IP-throttling, ограничивает тело во время чтения и разрешает только точные OLX-хосты и redirect-направления.
- OLX.uz не предоставляет поддерживаемый публичный API для этого сценария. Изменение сайта OLX может потребовать обновления Talanty/расширения. Это не официальное партнёрство с OLX.

## 4. Telegram — инструкция простыми словами

Telegram выполняет **две разные задачи**:

1. публикует вакансии в каналах;
2. получает PDF-резюме и создаёт кандидатов.

Обе функции используют настроенного бота, но работают независимо.

### 4.1 Публикация вакансий

#### Добавить канал

1. Откройте **Мой профиль → Настройки компании → Telegram-каналы**.
2. Нажмите **Добавить канал**, укажите `@channel`, имя или ссылку `t.me/...` и нажмите **Проверить**.
3. Выберите способ:
   - **Напрямую ботом** — добавьте бота администратором и разрешите публикацию.
   - **Через администраторов** — добавьте логины людей, которые опубликуют готовый пост вручную.
4. Сохраните.

Для доставки через людей каждый администратор должен открыть бота и нажать `/start`. Иначе бот не сможет написать ему; Talanty показывает статус активации.

#### Отправить пост

Откройте вакансию → публикации → **Telegram**, напишите текст, при желании загрузите картинку, выберите каналы и нажмите публикацию. Talanty добавляет зарплату и уникальный восьмизначный ключ вакансии. Лимит подписи с фото — 1024 символа, обычного сообщения — 4096; текст безопасно сокращается.

- В прямом режиме бот публикует сразу и сохраняет ссылку каждого канала.
- Через людей бот отправляет готовый текст/фото каждому активированному администратору с кнопкой **✅ Запощено**. Публикация активируется после подтверждения.
- Если картинку не удалось получить из Directus, отправляется текст. Зарплата берётся из Telegram-версии или основной вакансии.
- Частичные успехи сохраняются, а ошибки показываются отдельно по каналу/человеку.
- Если не доставлено ничего, операция считается ошибкой.

#### Деактивация

Для Telegram деактивация означает удаление сообщений. Боту нужно право `can_delete_messages`. Статус меняется только когда известные сообщения удалены. При частичном сбое уже удалённые ссылки убираются из базы, а оставшиеся перечисляются в ошибке. Удалённый Telegram-пост нельзя включить обратно — нужно отправить новый.

### 4.2 Получение резюме

#### Общая группа компании

У каждой компании есть скрытая системная вакансия **Склад кандидатов из Telegram** для резюме без конкретной вакансии.

Администратор компании открывает **Настройки компании → Telegram-группа резюме**, создаёт одноразовую команду `/connect` на 15 минут, добавляет бота администратором нужной группы и отправляет команду в группе. Сервер проверяет, что это группа, бот активен и видит обычные сообщения, а защита содержимого отключена. Одна группа привязывается ровно к одной компании. Отключение останавливает новые документы, но не удаляет старых кандидатов.

#### PDF лично боту

Активированный администратор канала может отправить PDF прямо боту:

- без ключа — в склад, если он связан ровно с одной компанией;
- с восьмизначным ключом публикации — в воронку соответствующей вакансии;
- при нескольких компаниях ключ обязателен.

Чужой или угаданный ключ не работает: сервер пересчитывает ключ и проверяет компанию. Обычный текст подтверждается и игнорируется.

#### Что происходит с файлом

1. Telegram вызывает защищённый webhook; webhook быстро кладёт документ в PostgreSQL-очередь.
2. Worker скачивает файл и принимает только непустой настоящий PDF до 10 МБ.
3. ИИ-классификатор проверяет, что это резюме.
4. Directus сохраняет файл, ИИ извлекает профиль и создаёт анализ.
5. Кандидат и связь с вакансией создаются одной транзакцией.
6. Для обычной вакансии считается match score, совпавшие и отсутствующие требования; склад пропускает сравнение.

Повторы Telegram не создают дубль благодаря уникальным индексам сообщения и файла. Временная ошибка повторяется до пяти раз с растущей паузой. Готовый результат ИИ кэшируется. Произвольную старую историю Bot API не отдаёт; недоставленные события хранятся не больше 24 часов. Для старой истории используется экспорт Telegram Desktop.

Webhook принимает только `message`/`channel_post`, проверяет секрет и не выполняет скачивание/ИИ внутри HTTP-ответа. Jobs забираются через `FOR UPDATE SKIP LOCKED`, а PID-lock исключает перекрытие локальных worker-процессов. Невалидные файлы и не-резюме сохраняются как `ignored` с причиной.

## 5. hh.uz

Каждый пользователь подключает собственный hh.uz OAuth-аккаунт; синхронизация компании обрабатывает всех подключённых работодателей.

1. **Обнаружение** каждые 20 минут находит новые отклики по watermark, создаёт лёгкие карточки и задания.
2. **Обогащение** каждую минуту получает структурированное резюме, запускает ИИ и заполняет карточку; worker использует `FOR UPDATE SKIP LOCKED`.
3. **Сверка** каждые 5 минут обновляет статусы/отказы.

Один `hhResumeId` в компании — один кандидат; заявка на каждую вакансию хранится отдельно. Сырой `hhStage` не перезаписывает этап рекрутера, а `profileLocked` защищает от перезаписи отредактированного профиля. PDF не скачивается: хранится структурированный профиль и ссылка на оригинал. Активные и архивные вакансии сохраняются локально; архивная может быть лёгкой заглушкой, а продление запускает пользователь.

## 6. PersonHunters

Включается через `PERSON_HUNTER_API_KEY`. База: `https://api.personhunters.com/v1`. Чтение использует `?lang=ru|uz|en`, запись — поле `lang`; по умолчанию русский.

| Действие | Метод и путь |
| --- | --- |
| Справочники | `GET /dictionaries` |
| Список | `GET /vacancies?page=1&per-page=...&lang=ru` |
| Детали | `GET /vacancies/{id}?lang=ru` |
| Создание | `POST /vacancies` + Bearer token |
| Изменение/перевод | `PUT/PATCH /vacancies/{id}` |
| Удаление | `DELETE /vacancies/{id}` |

Поля записи: `unique_code`, `pay_from/to`, `currency_id`, `industry_id`, `status`, `country/region/city_id`, `experience_from/to`, массивы `employment_id`/`schedule_id`, `vacancy_name`, `duties`, `requirements`, `conditions`, `vacancy_description`, `lang`. Связанные данные возвращаются как `{id, name}`. Коды: `200/201` успех, `204` удалено, `401` токен, `403` чужая вакансия, `404` не найдено, `422` ошибка полей.

## 7. Языки

Локали: `ru` (по умолчанию), `uz`, `en`. Выбор хранится в cookie `NEXT_LOCALE`; URL не меняется. Каталоги: `messages/ru.json`, `messages/uz.json`, `messages/en.json`. Каждый новый ключ добавляется во все три. Пользовательские тексты остаются на языке ввода. Проверка: `bun run i18n:check`.

## 8. Разработка

Стек: Next.js 15, React 19, TypeScript, tRPC, NextAuth, Drizzle/PostgreSQL, Tailwind 4, Zustand/TanStack Query, Directus, Mastra/Gemini. `src/app` — UI/API, `src/server` — логика/БД, `drizzle` — миграции, `browser-extension/olx-connector` — Chrome-расширение, `scripts` — операции.

```bash
bun install
cp .env.example .env
bun run db:migrate
bun dev
```

```bash
bun run check
bun run typecheck
bun run i18n:check
bun test
bun run build
```

Важные группы переменных перечислены в `.env.example`: база/auth, почта, Google OAuth/Gemini, Directus, hh.uz, Telegram, OLX и PersonHunters. `AUTH_SECRET` и отдельный OLX-ключ — минимум 32 символа и не должны совпадать. Пропуск email-кода разрешён только в development.

Основные таблицы: auth/лимиты; компании/приглашения; кандидаты/вакансии/заявки; аудит; hh-аккаунты и jobs; шифрованные OLX-сессии; Telegram-каналы, администраторы, посты/доставки; настройки и очередь Telegram-резюме. Все доменные чтения ограничены компанией.

Регистрация: аккаунт → компания/приглашение → шестизначный email-код → JWT. Google-пользователь без компании проходит onboarding. Лимиты: 3 регистрации/час, 60 секунд между письмами, 8 проверок кода/15 минут, 5 входов/15 минут. Смена пароля инвалидирует старые JWT.

## 9. Production и операции

Для схемы всегда генерируйте и коммитьте SQL:

```bash
bun run db:generate
bun run db:migrations:check
```

В production **не используйте `db:push`**. Deploy создаёт и проверяет backup, запускает `db:migrate-custom`, затем `yeshunt.service` от пользователя `persona-web`.

```bash
cd /root/projects/persona-management
git status --short
DEPLOY_BRANCH=main bash ./scripts/deploy.sh
sudo systemctl status yeshunt.service --no-pager
sudo journalctl -u yeshunt.service -f
```

Расписание UTC: hh enrichment каждую минуту; hh discovery каждые 20 минут; hh statuses каждые 5 минут; backup ежедневно 02:17; тест восстановления в воскресенье 03:43. Команда настройки Telegram отдельно ставит обработку одного Telegram-резюме в минуту; вместо неё production может использовать защищённый cron endpoint. Копии `backups/database`: daily 14, weekly 56, monthly 366 дней; нужна дополнительная зашифрованная off-site копия. Cron-логи: `/var/log/persona-management/`.

Telegram:

```bash
bun run telegram:resume:setup
bun run telegram:resume:webhook:set
bun run telegram:resume:status
bun run telegram:resume:drain
bun run telegram:resume:history -- <path-to-result.json>
```

Webhook: `/api/integrations/telegram/resume-webhook`. Альтернативный планировщик вызывает `GET /api/cron/telegram-resumes` с Bearer `AUTH_SECRET`; используйте один worker-механизм. Очередь: `pending`, `processing`, `done`, `failed`, `ignored`.

`telegram:resume:setup` проверяет бота, группу, схему БД и Directus, создаёт/находит склад, записывает нужные ID в env и ставит cron. При недействительном токене Directus выполните `bun run directus:token:repair`, затем повторите setup. `telegram:resume:status` показывает URL webhook, очередь Telegram и последнюю ошибку доставки.

Для OLX серверу нужен современный Chrome/Chromium и исходящий HTTPS/DNS к `login.olx.uz`, `www.olx.uz`, `categories.olxcdn.com`, `production-graphql.eu-sharedservices.olxcdn.com`. Локально: `chrome://extensions` → режим разработчика → загрузить `browser-extension/olx-connector`; точный локальный ID добавить в `OLX_CONNECTOR_EXTENSION_IDS`.

Обновление Chrome Web Store:

1. увеличьте `version` в обоих manifest-файлах;
2. выполните `bun run olx:extension:package`;
3. загрузите ZIP в существующую карточку магазина, сохранив ID;
4. карточка: Russian, Productivity, Free, Unlisted, Uzbekistan;
5. privacy URL: `https://admin.talanty.uz/privacy/olx-connector`;
6. используйте `icons/icon128.png` и `store-assets/olx-connection-1280x800.png`;
7. раскройте перечисленные данные, не заявляйте партнёрство OLX, тестовые аккаунты передавайте только в приватных полях ревьюера.

Chrome обычно обновит расширение автоматически после одобрения. При проблеме пользователь открывает `chrome://extensions`, нажимает **Обновить** и перезагружает Talanty.

## 10. Известные ограничения

- Приватные OLX endpoints могут измениться без предупреждения.
- Внешняя публикация может быть частично успешной; Telegram показывает ошибки по месту доставки.
- Telegram Bot API не предоставляет произвольную старую историю.
- hh.uz использует фоновые интервалы, а не realtime webhook.
- Ручное создание/назначение кандидата не всегда запускает автоматический пересчёт match score.
- Операции файлов и внешних постов не могут быть одной транзакцией между разными сервисами.

---

# English version

## 1. What Talanty is

Talanty is an applicant tracking system. A company can create jobs, publish them to hh.uz, OLX.uz, Telegram, and PersonHunters, store candidates and PDF résumés, receive candidates from hh.uz/Telegram, manage hiring stages, and use AI for résumé summaries and job matching.

Simple picture: **a vacancy is a box containing a job, a candidate is a person's card, and the funnel shows which step that person has reached**.

## 2. User essentials

Each user belongs to one company. The owner can do everything and manage people; admins edit the company and invitations; members cannot administer the company. Invitation links last 14 days and are reusable/revocable. Deactivation blocks sign-in without erasing history.

Candidates can be created manually, uploaded as a valid PDF up to 10 MB, or received from hh.uz/Telegram. Directus stores files; Gemini/Mastra extracts the profile, summarizes it, and calculates vacancy match when configured. Create a base vacancy first, then a channel-specific publication. Browser-persisted drafts survive normal reloads. Company data is isolated by `companyId`.

## 3. OLX.uz in plain language

### Features and connection

Talanty connects one user's personal OLX account, loads live categories and locations, validates without creating, publishes with duplicate protection, stores the advert URL/id, and can deactivate, reactivate, or permanently delete it. Only the connecting publisher can operate that personal account's advert.

1. Use Chrome and open **My profile → Company settings → OLX.uz**.
2. Install [Talanty — OLX.uz Connector](https://chromewebstore.google.com/detail/talanty-%E2%80%94-olxuz-connector/fojllciekjkejbnehccfkeoghpjippon) if requested.
3. Return to Talanty, let it detect the extension, read the disclosure, consent, and click Connect.
4. Sign in on real `olx.uz`; password/CAPTCHA/SMS/OTP stay there.
5. Wait for the OLX page to finish and press **I am signed in — connect account** in the panel.
6. Return and confirm **Connected**. No manual copying is required.

### Publish, manage, troubleshoot

Select a live job category and exact location, then provide a 16–70 character title, 80–9000 character description, contact, work/employment type, and optional Uzbek phone/salary. Preview creates nothing. Press Publish and confirm once.

A stable `posting-id` is persisted before OLX is contacted. Concurrent clicks cannot both claim the row; uncertain results are reconciled, not blindly resent; a stored advert ID/URL blocks republishing. Deactivation hides, activation restores, and deletion is permanent after deactivation. Local status changes only after OLX accepts it.

If connection fails: confirm Chrome/extension is enabled, reload Talanty after install/update, sign in at `www.olx.uz`, and wait for full load. If request context is not ready, reload the OLX tab once and retry. Reconnect when sign-in is required. Do not hammer Publish: cooldown is 30 seconds and the hourly limit is 10.

### Privacy, security, limits

The connector transfers only OLX access/refresh tokens, device id, fingerprint, user agent, and allowlisted `deviceGUID`/`access_token` cookies. It does not read passwords, CAPTCHA/SMS/OTP, forms, API responses, or unrelated sites. A one-use 15-minute ticket carries data over HTTPS without persistent extension credential storage.

Credentials use AES-256-GCM, a separate `OLX_CREDENTIALS_ENCRYPTION_KEY`, user/session AAD, key versions, and deletion on disconnect. Extension origins exact-match an allowlist; official ID is `fojllciekjkejbnehccfkeoghpjippon`. One locked ticket prevents double claim. Location search limits are 120/user and 300/IP per 15 minutes. Lifecycle cooldown/limit is 10 seconds and 20/hour per account. Chromium uses short sessions, a bounded queue, at most two processes, and an enforced production sandbox.

Categories are cached for six hours and locations for 15 minutes. Native HTTP is tried first; OLX `403` uses a short Chromium fallback, and common English city spellings are normalized. Refresh rotation is serialized per account, old encryption keys may remain decrypt-only during rotation, the connection endpoint enforces streamed size/IP limits, and only explicit OLX hosts/redirects are accepted.

OLX.uz has no supported public API for this flow. Web endpoint changes can require an application/extension update; this is not an official OLX partnership.

## 4. Telegram in plain language

Telegram has two independent jobs: vacancy publication and résumé ingestion.

### 4.1 Vacancy publication

In **Company settings → Telegram channels**, add/verify a handle or link and choose direct bot delivery or delivery through people. Direct mode requires the bot to be channel admin with posting permission. Human mode requires listed admins to open the bot and press `/start`.

Create the Telegram publication, optionally attach an image, and select channels. Talanty adds salary and an eight-character vacancy keyword. Photo captions are capped at 1024 characters, text at 4096. Direct mode posts immediately and stores every message URL. Human mode sends ready content with a **✅ Posted** button and activates after confirmation. Partial successes are saved with per-destination errors; zero deliveries is failure.

If a Directus image cannot be loaded, Talanty sends text instead. Salary comes from the Telegram version or its base vacancy.

Telegram deactivation deletes remote messages and requires `can_delete_messages`. Status changes only after known messages are gone. Partial deletion records completed removals and reports remaining messages. Deleted posts cannot be reactivated; publish a new one.

### 4.2 Résumé ingestion

Every company has a hidden Telegram candidate warehouse. An admin creates a 15-minute `/connect` command, adds the bot as group admin, and sends it in the group. The server verifies group type, membership/message visibility, and disabled content protection, then binds the chat to exactly one company. Disconnect stops new imports but retains candidates.

An activated channel admin can also DM a PDF. Without a keyword it goes to the warehouse when the sender belongs to exactly one company; with the valid eight-character publication keyword it goes to that vacancy; multi-company admins must use a keyword. Tenant-bound recomputation rejects guessed foreign keywords.

The secured webhook queues quickly. A worker accepts a real non-empty PDF up to 10 MB, classifies it as a résumé, stores it in Directus, extracts/summarizes it, transactionally creates candidate/application, and calculates matching for real vacancies. Unique message/file indexes prevent Telegram retry duplicates. Transient errors retry up to five times with backoff; successful AI output is cached. Bots cannot fetch arbitrary old group history, and undelivered updates last at most 24 hours; use Telegram Desktop export for history import.

The webhook accepts only `message`/`channel_post`, checks its secret, and keeps download/AI work outside the HTTP response. Workers claim with `FOR UPDATE SKIP LOCKED` plus a local PID lock. Invalid/non-résumé files remain inspectable as `ignored` with a reason.

## 5. hh.uz

hh.uz OAuth accounts are per-user; company synchronization covers all connected employers. Discovery runs every 20 minutes using watermarks, enrichment every minute through `FOR UPDATE SKIP LOCKED`, and status reconciliation every five minutes. One company/resume id maps to one candidate; each vacancy application has its own stage. Recruiter stage is separate from raw `hhStage`, `profileLocked` protects edits, and only structured data/original URL is stored—no hh PDF. Active and archived vacancies are persisted; prolongation is explicit.

## 6. PersonHunters

Enable with `PERSON_HUNTER_API_KEY`; base URL is `https://api.personhunters.com/v1`. Reads use `?lang=ru|uz|en`; writes use body `lang`; Russian is default.

| Action | Method/path |
| --- | --- |
| Dictionaries | `GET /dictionaries` |
| List/detail | `GET /vacancies`, `GET /vacancies/{id}` |
| Create | `POST /vacancies` + Bearer token |
| Update/translation | `PUT/PATCH /vacancies/{id}` |
| Delete | `DELETE /vacancies/{id}` |

Writable data covers unique code, pay/currency, industry/status/location/experience ids, employment/schedule arrays, localized name/duties/requirements/conditions/description, and language. Related values return as `{id, name}`. Statuses: `200/201` success, `204` deleted, `401` token, `403` forbidden, `404` missing, `422` validation.

## 7. Internationalization

Locales are `ru` (default), `uz`, and `en`. `NEXT_LOCALE` stores selection without route changes. Catalogs are `messages/ru.json`, `messages/uz.json`, `messages/en.json`; every key belongs in all three. User content keeps its stored language. Run `bun run i18n:check`.

## 8. Development

Stack: Next.js 15, React 19, TypeScript, tRPC, NextAuth, Drizzle/PostgreSQL, Tailwind 4, Zustand/TanStack Query, Directus, Mastra/Gemini. `src/app` contains UI/API, `src/server` business/data logic, `drizzle` migrations, `browser-extension/olx-connector` the connector, and `scripts` operations.

```bash
bun install
cp .env.example .env
bun run db:migrate
bun dev

bun run check
bun run typecheck
bun run i18n:check
bun test
bun run build
```

`.env.example` lists database/auth, mail, Google OAuth/Gemini, Directus, hh.uz, Telegram, OLX, and PersonHunters variables. `AUTH_SECRET` and the separate OLX key must each be 32+ characters and must not be reused. Email verification bypass is development-only.

Core tables cover auth/limits, companies/invites, candidates/vacancies/applications, audit, hh accounts/jobs, encrypted OLX sessions, Telegram channels/admin dispatches/posts, and Telegram résumé configuration/queue. Domain reads are company-scoped.

Registration is account → company/invite → six-digit email code → JWT. Google users without a company complete onboarding. Limits: 3 registrations/hour, 60 seconds between emails, 8 code checks/15 minutes, 5 logins/15 minutes. Password changes invalidate old JWTs.

## 9. Production and operations

Generate/review/commit SQL for schema changes:

```bash
bun run db:generate
bun run db:migrations:check
```

Never use `db:push` in production. Deploy verifies a backup, runs `db:migrate-custom`, and starts `yeshunt.service` as `persona-web`.

```bash
cd /root/projects/persona-management
git status --short
DEPLOY_BRANCH=main bash ./scripts/deploy.sh
sudo systemctl status yeshunt.service --no-pager
sudo journalctl -u yeshunt.service -f
```

UTC: hh enrichment each minute; hh discovery every 20 minutes; hh status every five minutes; backup daily 02:17; restore test Sunday 03:43. Telegram setup separately installs one résumé job per minute; production may use the authenticated cron endpoint instead. Retention under `backups/database` is daily 14, weekly 56, monthly 366 days; also keep encrypted off-site backups. Cron logs are under `/var/log/persona-management/`.

```bash
bun run telegram:resume:setup
bun run telegram:resume:webhook:set
bun run telegram:resume:status
bun run telegram:resume:drain
bun run telegram:resume:history -- <path-to-result.json>
```

Webhook: `/api/integrations/telegram/resume-webhook`. An external scheduler may call authenticated `GET /api/cron/telegram-resumes`; use one worker mechanism. Queue states: `pending`, `processing`, `done`, `failed`, `ignored`.

`telegram:resume:setup` verifies the bot, group, schema, and Directus, ensures the warehouse, writes required ids to the environment file, and installs cron. If the Directus token is invalid, run `bun run directus:token:repair` and repeat setup. The status command reports the webhook URL, Telegram pending-update count, and latest delivery error.

OLX servers need current Chrome/Chromium and outbound access to `login.olx.uz`, `www.olx.uz`, `categories.olxcdn.com`, and `production-graphql.eu-sharedservices.olxcdn.com`. Local install: `chrome://extensions` → Developer mode → load `browser-extension/olx-connector`; add its exact id to `OLX_CONNECTOR_EXTENSION_IDS`.

Extension release: raise both manifest versions, run `bun run olx:extension:package`, and upload to the existing store item to retain its ID. Listing: Russian, Productivity, Free, Unlisted, Uzbekistan; privacy URL `https://admin.talanty.uz/privacy/olx-connector`; use included icon/screenshot; disclose listed data; do not imply OLX partnership; reviewer accounts belong only in private store fields. Chrome normally auto-updates after approval.

## 10. Known limitations

- Private OLX endpoints may change without warning.
- External publication can partially succeed; Telegram reports each failed destination.
- Telegram bots cannot fetch arbitrary old group history.
- hh.uz uses scheduled synchronization rather than realtime webhooks.
- Manual candidate creation/assignment does not always trigger match rescoring.
- External files/posts cannot share one atomic transaction across services.
