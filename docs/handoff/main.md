# Main — репозиторий, доступы, Drive-аккаунт, тексты и фото по нише

Обновлено: 2026-10-05 · ветка: main

## Состояние
**Рабочая копия — `~/Code/Content-machine`** (старый путь в `~/Documents` — симлинк). **Деплой по `git push`**;
`vercel --prod` руками не гонять — CLI грузит незакоммиченное. Прод — `content-machine-gules.vercel.app`,
`/api/version` отдаёт sha. Админ-запрос = `Cookie: cm_admin=$ADMIN_KEY`, `+ cm_view_as=<clinicId>` рендерит
экран глазами врача. Локально приложение **не поднять** — в `.env.local` нет ни `ADMIN_KEY`, ни Supabase:
UI-правки проверяются на проде.

**В репозитории работают несколько сессий одновременно.** `tsc` локально видит рабочую копию целиком, а
Vercel — только коммит, поэтому **обе половины правки должны ехать одним коммитом**. Дважды уронили сборку
именно этим (16.09 `planner.ts` без `formats.ts`, 17.09 `writer.ts` без `profiles.ts`). Дешёвая проверка:
`git worktree add --detach <tmp> HEAD`, симлинк `node_modules`, `npx next build`. **Границы владения:**
сессия Notes — `lib/notes/`, `app/api/notes/ideas/`, `lib/agents/note-tidy.ts`, `app/scripts/*`, миграция 057;
сессия Yedino — `app/visual/*`, `lib/posts/*`; сессия Publish — `lib/publish/*`, `app/api/cron/buffer-feed/`,
`app/api/cron/meta-publish/`, миграция 062 (детали — `publish.md`).

**Публикация по брендам — отдельный модуль, см. `publish.md`.** Buffer: реестр `lib/publish/buffer-accounts.ts`,
ключ = `clinics.niche`, ниша без записи публиковать не может (HWC/aesthetics выключены, решение 28.09).
Прямой Instagram через Meta: реестр `DIRECT_META` в `lib/publish/meta-creds.ts`, для `hiredrop` токен
`META_SYSTEM_USER_TOKEN` (только Instagram; Threads — через Buffer). Код написан 05.10, не закоммичен.

**Долгий SSE рвётся без сердцебиения (24.09).** Writer пишет минутами, поток молчит — прокси закрывает
простаивающее соединение, браузер бросает «Stream ended without result», а прогон при этом доходит до конца
и сохраняет (`waitUntil`). Выглядит как «генерация не работает», хотя скрипты в библиотеке. В
`/api/agents/generate` теперь комментарный кадр раз в 10 с; клиентский парсер его игнорирует (нет `data:`).
**Тот же паттерн ждёт любой другой долгий стрим — рендер, авто-монтаж.**

**Комплаенс-гейт может срезать вариант.** `grade: REMOVE` → вариант не сохраняется, из трёх приезжают два.
Это штатно, не ошибка; UI про это молчит.

**Правка скрипта = два поля, не одно.** Телесуфлёр пишет `full_script`, а карточка в `/scripts` и подписи
к постам читают `hook`. Сохранение из телесуфлёра несёт `hook` — первой строкой ЧИТАЕМОГО текста
(`cleanReadingText(spokenScript(...))`), иначе в подпись уедет `Slide 2 —` или `SOURCES:`.

**Свой рендер каруселей — `lib/render/`** (`compose.ts`, `html.ts`, `png.ts`, `shapes.ts`, `fonts.ts`, `skins/`)
+ `POST /api/posts/:id/render`: «draw the carousel HERE instead of in Canva». Один скин `style3`, роут режет
стили **1–5**. Шрифты инлайнятся из `assets/fonts/` как data-URI (на Vercel шрифтов нет — иначе Chromium уедет в Times).

**Роли (16.09).** Скрипты генерит только админ (403 клиничному токену, вкладка Generate скрыта). Видео врач
**смотрит, но не скачивает**: ни чипов папок Drive, ни «Open in Drive», плюс `copyRequiresWriterPermission`.

**Плеер `/videos` — свой роут, не iframe Drive.** Байты идут через `/api/recordings/[fileId]/stream` (кука +
проверка клиники, `Range` пробрасывается, иначе Safari ломает перемотку); iframe — фолбэк по `onError`.
Цена: залогиненный врач технически вытащит байты по URL — трещина в watch-only. **Удаление подтверждается
оверлеем внутри страницы**, не `window.confirm` (iOS Safari глушит диалоги).

**Телесуфлёр знает 16:9** (`e79912e`): поворот телефона переключает раскладку, кнопка `16:9`/`9:16` —
запасной путь; свой кегль (56 px против 30, регулятор 28–120), панели в overlay.

**Drive приложения = `kinnil.official@gmail.com`**; корень записей `content-machine`, папка клиники —
anyone-reader. Замок скачивания — право владельца: записи по 22.08 за `hellosystems111` не лочатся,
ретро-прогон `POST /api/studio/recordings/fix-permissions?clinicId=…[&unlock=1]`.

**Buffer API (23.09).** Free-план, 1 личный ключ на аккаунт, OAuth не включён. API — GraphQL, один эндпоинт
`POST https://api.buffer.com`, `Authorization: Bearer <key>`; `channels` требует `input: {organizationId}`.
Ключи: Yedino `BUFFER_ACCESS_TOKEN_YEDINO`, HireDrop `BUFFER_ACCESS_TOKEN_HIREDROP` (в Vercel prod есть).
Гоча: Buffer'у нужен прямой скачиваемый URL, Drive-шаралинк не подходит. Очерёдность: посты → approve-флаг
в `/videos` → видео.

**Бренды в CM.** Yedino Systems `c072746d-e302-45ae-a992-7980ee615551`, root
`152f_Nrdh4WRa2lhZinawtV5cvvgIuiLb`. HireDrop `261b5a34-8584-405c-aa52-b55dfbd0fa09`, niche `hiredrop`
(профиля в `lib/niche/profiles.ts` НЕТ — генерацию не запускать), root `1G6UN4dOvdlPkATdQ0KuCKPkN9qcKp0Vx`,
коды `hiredrop-doctor` / `hiredrop-team`. В обоих root'ах папка `Static Posts` (Yedino
`16kpRyxETXOfTcRWwwIEQtqMpkSKcaYcV`, HireDrop `1hMByaQOXSjixGHE6YsjP0X_62HIpJ2DF`, владелец — SA).

**RLS — на каждой новой таблице, в той же миграции (29.09).** Приложение ходит в БД только service_role
(обходит RLS), так что `enable row level security` + политика `clinic_isolation_*` ничего не ломают, а без
них таблица открыта публичному anon-ключу. Supabase шлёт письмо `rls_disabled_in_public` — так поймали 056.
Проверка: `select relname from pg_class … where nspname='public' and not relrowsecurity` через CLI — сейчас пусто.

**Прочее.** Compose-поллер `com.hwc.canva-runner` ставится только `bash scripts/canva-runner/install.sh`.
Canva: серверный автофил мёртв, карусели собирает Claude+MCP runner копированием мастера, реестр —
`lib/posts/style-templates.ts`. Доступы: `/c/<token>` + memorable-код, роли `doctor`/`editor`, две клиники
HWC. Тексты: формат = HOW, тема = WHAT, каталог — 9 форматов. Возражения: вопрос — строка в
`clinic_objections` (056 прогнана), `objectionId` или `"next"` в генератор. Фото — доктрина по нише v4.1,
грабли Flux в `POST-CRAFT.md §5a`. Себестоимость: карусель ≈ $11.8 с подписки, скрипт ≈ $0.30.
Бренд агентства — `docs/YEDINO-STYLE.md` + `yedino.md`; блокнот идей — `notes.md`.

## Последний заход
- 05.10: в `lib/publish/meta-creds.ts` добавлен прямой путь к Instagram через Meta для ниши `hiredrop`
  (токен `META_SYSTEM_USER_TOKEN` из env, `igUserId 17841446093945559`, `graph.facebook.com`). Threads для
  этой ниши — `null`, идёт через Buffer. Остальные ниши — прежнее поведение через Hellometrix.
  `tsc` 0, `eslint` чист. **Не закоммичено, не задеплоено.**
- 05.10: `META_SYSTEM_USER_TOKEN` есть в `.env.local`, **в Vercel production его нет**. Попытка добавить
  заблокирована классификатором (Secret-Store Writes). Обходить не стали.
- 05.10: `clinics`-строка HireDrop есть (`261b5a34…`, niche `hiredrop`, проверено REST'ом); `BUFFER_ACCESS_TOKEN_HIREDROP`
  в Vercel prod, health HireDrop — оба канала `connected`.
- 05.10: закоммичен Buffer по брендам (`e1eee22`) + хендоффы (`4ae7a65`, `cbbca24`). Запушено, прод на `d171eb1`.
- 29.09: `clinic_objections` закрыта RLS (миграция 059, `9efcfee`).

## Сломано / не доделано
- **Прямой Instagram не работает, пока нет `META_SYSTEM_USER_TOKEN` в Vercel prod.** Нужно либо добавить
  переменную руками, либо дать мне узкое разрешение на `vercel env add`. Потом деплой, пробный пост, permalink.
- **Незакоммиченное в рабочей копии** (несколько сессий): `lib/publish/meta-creds.ts` (этот заход),
  `app/api/cron/meta-publish/route.ts`, `app/api/cron/buffer-feed/`, `lib/publish/buffer-api.ts`,
  `lib/cron/db-key.ts`, `supabase/migrations/062_buffer_feed.sql` (уже прогнана; pg_cron `buffer-feed` бьёт в
  несуществующий роут), `types/supabase.ts`, `docs/handoff/yedino.md`, `lib/render/html.ts`. Коммитить по правилу
  «обе половины одним коммитом», чужое не трогать без согласования.
- **Скина под стиль 6 нет, роут `/render` режет `style must be 1-5`** — цена вопроса «уходим ли от Canva».
- **Миграции 055 (`canva_oauth_tokens`) и 057 (`idea_notes`) не прогнаны** — попап Notes отдаёт пустой список.
- **Пайплайн не дёрнуть напрямую**: `SERVICE_TOKEN`, `SUPABASE_*`, `ANTHROPIC_API_KEY` — `[SENSITIVE]`.
  Но ADMIN_KEY читается (прод-роуты), Supabase — через CLI, ref `pscqjvkuqqmvmcbxdwtu`.
- **Списка вопросов от Игоря нет** — в `clinic_objections` три пробных (101–103), метод в
  `docs/objection-maps/`. Батч (`"next"` подряд) не гонялся дальше одного вопроса. `One thing` и `Vague vs specific`
  живьём не прогонялись.
- **`hook` у старых скриптов может расходиться с телом** — чинится при следующем сохранении; разово —
  PATCH `{hook}` на `/api/scripts/:id`.
- **Стрим-плеер и 16:9 не смотрены живьём**; перекраска акцента через Canva MCP невозможна (см. `yedino.md`).
- Две карточки `cleaned.mp4` у HWC не удаляются роутом (сносит только `failed/processing/pending`).
- Розданные PDF-гайды указывают на старую папку записей; коды врачей в истории public-репо — риск принят.
- «Anyone with the link» на папке формы снимать нельзя — на нём держатся врачебные ссылки.

## Следующий шаг
1. Публикация HireDrop в Instagram: `META_SYSTEM_USER_TOKEN` в Vercel prod → деплой (сначала закоммитить
   `meta-creds.ts` вместе с парными правками) → пробный пост → permalink. Детали — `publish.md`.
2. Принять от Игоря список вопросов пациентов, залить в `clinic_objections` вместо пробных и прогнать батч
   `"next"` подряд — это и есть съёмочный день.
3. Параллельно: решение по Canva (уходим — скин под стиль 6 в `lib/render/skins/`), прогнать миграции 055 и
   057, согласовав с сессией Notes, кто коммитит общую правку.
