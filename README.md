# Talanty — Recruitment Management System

Talanty is a multi-company applicant tracking system (ATS) for managing vacancies, candidates, hiring funnels, interviews, and job-board publications from one workspace.

Русская и английская версии документации приведены ниже. Интерфейс продукта доступен на русском, узбекском и английском языках.

- [Русская версия](#русская-версия)
- [English version](#english-version)

---

# Русская версия

## О проекте

Talanty помогает рекрутерам вести весь основной процесс найма: от создания и публикации вакансии до обработки резюме, оценки кандидата, планирования интервью и перемещения по этапам воронки. Данные каждой компании изолированы, а сотрудники работают вместе с учётом ролей и прав доступа.

## Основные возможности

### Рабочий стол и аналитика

- Сводка по кандидатам, активным вакансиям и наймам.
- Статистика кандидатов по статусам и источникам.
- Последние вакансии и история действий команды.
- Счётчики новых кандидатов и вакансий в навигации.

### Кандидаты и резюме

- Создание и редактирование подробных карточек кандидатов.
- Поиск, фильтрация и постраничный просмотр базы.
- Загрузка PDF-резюме, а также импорт кандидатов из hh.uz и Telegram.
- Хранение контактов, навыков, языков, опыта, образования, заметок и истории действий.
- Привязка одного кандидата к нескольким вакансиям с отдельным статусом отклика для каждой.
- Просмотр и скачивание оригинального резюме.
- Экспорт профиля в PDF или Word с выбором, порядком и оформлением разделов.

### ИИ-помощник

При настроенном Google Gemini система умеет:

- извлекать данные из PDF и автоматически заполнять карточку кандидата;
- создавать краткий анализ резюме;
- оценивать соответствие кандидата вакансии по шкале 0–100;
- выделять сильные стороны, совпавшие навыки и недостающие требования;
- улучшать и перефразировать текст вакансии в редакторе.

### Вакансии и воронка найма

- Создание, редактирование, поиск и фильтрация вакансий.
- Отдельные версии вакансии для разных каналов публикации.
- Сохраняемые в браузере черновики публикаций.
- Назначение существующих кандидатов на вакансию.
- Kanban-воронка с перемещением кандидатов между этапами drag-and-drop.
- Отдельные этап, состояние и оценка соответствия для каждого отклика.
- Управление активными, архивными и внешними вакансиями.

### Публикация и импорт

| Канал | Возможности |
| --- | --- |
| **hh.uz** | OAuth-подключение для каждого пользователя, публикация и сохранение черновиков, импорт вакансий и откликов, фоновая синхронизация профилей и статусов |
| **Telegram** | Публикация вакансий в один или несколько каналов напрямую ботом или через администраторов; приём PDF-резюме из группы компании и личных сообщений боту |
| **olx.uz** | Подключение личного аккаунта через Chrome-расширение, проверка объявления перед отправкой, публикация, деактивация, повторная активация и удаление |
| **PersonHunters** | Создание, обновление и управление публикациями через API |

Интеграции включаются только при наличии соответствующих настроек и учётных данных.

### Календарь и интервью

- Общий календарь рекрутера в режимах день, неделя и месяц.
- Создание встречи из календаря или карточки кандидата.
- Отправка кандидату email-приглашения с календарным событием.
- Хранение времени, часового пояса, места, описания и статуса доставки приглашения.

### Компания и команда

- Отдельное пространство и данные для каждой компании.
- Профиль компании с контактами, описанием и логотипом.
- Роли: владелец, администратор и сотрудник.
- Приглашение коллег по защищённым ссылкам.
- Управление ролями и доступом сотрудников без удаления истории их действий.
- Настройка личных интеграций hh.uz и olx.uz, Telegram-каналов и группы для резюме.

### Авторизация и языки

- Регистрация по email с кодом подтверждения и вход через Google OAuth.
- Восстановление и смена пароля с ограничением частоты запросов.
- Защищённые пользовательские сессии и отзыв старых сессий после смены пароля.
- Интерфейс на русском, узбекском и английском языках без изменения URL.

## Технологии

- Next.js 15, React 19, TypeScript
- tRPC, TanStack Query, Zustand
- PostgreSQL, Drizzle ORM
- NextAuth
- Tailwind CSS 4
- Directus для хранения файлов
- Mastra и Google Gemini для ИИ-функций

## Быстрый запуск

Требования: [Bun](https://bun.sh/), PostgreSQL и настроенный файл окружения.

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run db:seed
bun dev
```

После запуска приложение доступно по адресу `http://localhost:3000`.

Схема переменных окружения находится в `src/env.js`, а шаблон локальной конфигурации — в `.env.example`. Для базовой работы нужны база данных, секрет авторизации, почта и файловое хранилище. hh.uz, Telegram, olx.uz, PersonHunters, Google OAuth и Gemini настраиваются отдельно и являются опциональными интеграциями.

## Полезные команды

```bash
bun dev                       # Локальная разработка
bun run check                 # Проверка Biome
bun run typecheck             # Проверка TypeScript
bun run i18n:check            # Проверка переводов
bun test                      # Тесты
bun run build                 # Production-сборка
bun run db:generate           # Создать SQL-миграцию
bun run db:migrations:check   # Проверить миграции
```

Для production используйте миграции из каталога `drizzle/` и `bun run db:migrate-custom`. Не используйте `db:push` в production: он не обновляет журнал миграций.

## Структура проекта

```text
src/app       — страницы, компоненты и HTTP-маршруты
src/server    — API, бизнес-логика, БД, интеграции и фоновые задачи
src/mastra    — ИИ-агенты
src/stores    — клиентские Zustand-хранилища
src/styles    — глобальные стили и дизайн-токены
drizzle       — SQL-миграции
scripts       — служебные, фоновые и deployment-скрипты
```

---

# English version

## About the project

Talanty helps recruiters manage the main hiring workflow: creating and publishing vacancies, processing résumés, assessing candidates, scheduling interviews, and moving applicants through a hiring funnel. Each company has an isolated workspace, while team members collaborate according to their roles and permissions.

## Main features

### Dashboard and analytics

- Overview of candidates, active vacancies, and hires.
- Candidate statistics by status and source.
- Recent vacancies and team activity history.
- Navigation counters for newly added candidates and vacancies.

### Candidates and résumés

- Create and edit detailed candidate profiles.
- Search, filter, and paginate the candidate database.
- Upload PDF résumés or import candidates from hh.uz and Telegram.
- Store contacts, skills, languages, experience, education, notes, and activity history.
- Link one candidate to multiple vacancies with separate application states.
- View and download the original résumé.
- Export a candidate profile to PDF or Word with selectable, reorderable, and branded sections.

### AI assistance

When Google Gemini is configured, Talanty can:

- extract data from a PDF and prefill the candidate form;
- generate a concise résumé assessment;
- score candidate-to-vacancy fit from 0 to 100;
- identify strengths, matching skills, and missing requirements;
- improve and paraphrase vacancy copy in the editor.

### Vacancies and hiring funnel

- Create, edit, search, and filter vacancies.
- Maintain separate vacancy versions for different publication channels.
- Keep publication drafts in the browser.
- Assign existing candidates to a vacancy.
- Move candidates between Kanban stages using drag-and-drop.
- Track a separate stage, state, and match score for every application.
- Manage active, archived, and externally sourced vacancies.

### Publishing and imports

| Channel | Capabilities |
| --- | --- |
| **hh.uz** | Per-user OAuth connection, vacancy publishing and drafts, vacancy/application import, and background profile and status synchronization |
| **Telegram** | Publish vacancies to one or more channels directly through the bot or via channel administrators; receive PDF résumés from a company group or bot direct messages |
| **olx.uz** | Connect a personal account through the Chrome extension, validate an advert before sending, publish, deactivate, reactivate, and delete it |
| **PersonHunters** | Create, update, and manage publications through the API |

Integrations are available only when their corresponding credentials and settings are configured.

### Calendar and interviews

- Recruiter calendar with day, week, and month views.
- Create meetings from the calendar or a candidate profile.
- Send candidates email invitations containing a calendar event.
- Track time, time zone, location, description, and invitation delivery status.

### Company and team

- Separate workspace and data for every company.
- Company profile with contact details, description, and logo.
- Owner, administrator, and member roles.
- Invite colleagues through secure links.
- Manage member roles and access without deleting their activity history.
- Configure personal hh.uz and olx.uz connections, Telegram channels, and a résumé intake group.

### Authentication and languages

- Email registration with a verification code and Google OAuth sign-in.
- Rate-limited password recovery and password changes.
- Protected user sessions, with older sessions invalidated after a password change.
- Russian, Uzbek, and English UI without locale-specific URLs.

## Technology

- Next.js 15, React 19, TypeScript
- tRPC, TanStack Query, Zustand
- PostgreSQL, Drizzle ORM
- NextAuth
- Tailwind CSS 4
- Directus for file storage
- Mastra and Google Gemini for AI features

## Quick start

Requirements: [Bun](https://bun.sh/), PostgreSQL, and a configured environment file.

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run db:seed
bun dev
```

The application will be available at `http://localhost:3000`.

The environment schema is defined in `src/env.js`, while `.env.example` provides the local configuration template. Basic operation requires the database, authentication secret, email, and file storage. hh.uz, Telegram, olx.uz, PersonHunters, Google OAuth, and Gemini are optional integrations configured separately.

## Useful commands

```bash
bun dev                       # Local development
bun run check                 # Biome checks
bun run typecheck             # TypeScript checks
bun run i18n:check            # Translation catalog checks
bun test                      # Tests
bun run build                 # Production build
bun run db:generate           # Generate a SQL migration
bun run db:migrations:check   # Validate migrations
```

In production, use committed migrations from `drizzle/` with `bun run db:migrate-custom`. Do not use `db:push` in production because it does not update the migration ledger.

## Project structure

```text
src/app       — pages, components, and HTTP routes
src/server    — API, business logic, database, integrations, and background jobs
src/mastra    — AI agents
src/stores    — client-side Zustand stores
src/styles    — global styles and design tokens
drizzle       — SQL migrations
scripts       — maintenance, background, and deployment scripts
```
