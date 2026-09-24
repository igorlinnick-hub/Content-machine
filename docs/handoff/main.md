# Main — репозиторий, доступы, Drive-аккаунт, тексты и фото по нише

Обновлено: 2026-09-24 · ветка: main

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
сессия Yedino — `app/visual/*`, `lib/posts/*`.

**Долгий SSE рвётся без сердцебиения (24.09).** Writer пишет минутами, поток молчит — прокси закрывает
простаивающее соединение, браузер бросает «Stream ended without result», а прогон при этом доходит до конца
и сохраняет (`waitUntil`). Выглядит как «генерация не работает», хотя скрипты в библиотеке. В
`/api/agents/generate` теперь комментарный кадр раз в 10 с; клиентский парсер его игнорирует (нет `data:`).
**Тот же паттерн ждёт любой другой долгий стрим — рендер, авто-монтаж.**

**Комплаенс-гейт может срезать вариант.** `grade: REMOVE` → вариант не сохраняется, из трёх приезжают два.
Это штатно, не ошибка; UI про это молчит.

**Свой рендер каруселей уже существует и это главный незадействованный рычаг.** `lib/render/`
(`compose.ts`, `html.ts`, `png.ts`, `shapes.ts`, `fonts.ts`, `skins/`) + `POST /api/posts/:id/render`:
«draw the carousel HERE instead of in Canva». Сделан один скин `style3`, роут режет стили **1–5**. Шрифты
инлайнятся из `assets/fonts/` как data-URI (на Vercel шрифтов нет — иначе Chromium уедет в Times).

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

**Дистрибуция через Buffer (23.09).** API открыт на free-плане (1 личный ключ на аккаунт, OAuth не включён),
11 каналов, есть MCP/CLI. **Yedino подключён:** `BUFFER_ACCESS_TOKEN_YEDINO` (Vercel prod/preview/dev +
`.env.local`), аккаунт `igor.linnick@gmail.com`, orgId `696c48ee111da9195976b964`, каналы instagram
`6ab468f5ea19ca0bdece1589`, threads `6ab46922ea19ca0bdece184b`. API — GraphQL, один эндпоинт
`POST https://api.buffer.com`, `Authorization: Bearer <key>`; `channels` требует `input: {organizationId}`.
**HireDrop-ключа нет.** Очерёдность: посты → approve-флаг в `/videos` → видео. Гоча: Buffer'у нужен прямой
скачиваемый URL, Drive-шаралинк не подходит.

**Бренды в CM (23.09).** Yedino Systems `c072746d-e302-45ae-a992-7980ee615551`, root
`152f_Nrdh4WRa2lhZinawtV5cvvgIuiLb`. HireDrop `261b5a34-8584-405c-aa52-b55dfbd0fa09`, niche `hiredrop`
(профиля в `lib/niche/profiles.ts` НЕТ — генерацию не запускать), root `1G6UN4dOvdlPkATdQ0KuCKPkN9qcKp0Vx`,
коды `hiredrop-doctor` / `hiredrop-team`. В обоих root'ах папка `Static Posts` (Yedino
`16kpRyxETXOfTcRWwwIEQtqMpkSKcaYcV`, HireDrop `1hMByaQOXSjixGHE6YsjP0X_62HIpJ2DF`, владелец — SA).

**Прочее.** Compose-поллер `com.hwc.canva-runner` ставится только `bash scripts/canva-runner/install.sh`.
Canva: серверный автофил мёртв, карусели собирает Claude+MCP runner копированием мастера, реестр —
`lib/posts/style-templates.ts`. Доступы: `/c/<token>` + memorable-код, роли `doctor`/`editor`, две клиники
HWC. Тексты: формат = HOW, тема = WHAT, каталог — 9 форматов. Возражения: вопрос — строка в
`clinic_objections` (056 прогнана), `objectionId` или `"next"` в генератор. Фото — доктрина по нише v4.1,
грабли Flux в `POST-CRAFT.md §5a`. Себестоимость: карусель ≈ $11.8 с подписки, скрипт ≈ $0.30.
Бренд агентства — `docs/YEDINO-STYLE.md` + `yedino.md`; блокнот идей — `notes.md`.

## Последний заход
- **Разобрана жалоба «генерация скриптов не работает».** Генерация исправна: прогон 21:50 сохранил 2 скрипта,
  21:55 — 3 (проверено запросом к `scripts`). Ошибку показывал клиент из-за оборванного SSE; третий вариант
  в прогоне Игоря срезал комплаенс-гейт. Починено сердцебиением в потоке + честным сообщением в UI, который
  теперь обновляет библиотеку вместо «failed» (`58fa922`).
- По дороге изолирован слой моделей: `POST /api/notes/ideas` (Haiku) отвечает за ~4 с — ключ, `ENABLE_LLM_AGENTS`
  и Anthropic живы; зависал только длинный Writer-прогон, и только на стороне соединения.
- Buffer-исследование + заведение брендов Yedino/HireDrop, партия из 5 постов Yedino с мастера `DAHVe9aREe4`,
  попап Notes в `/visual` (данные server-side из `lib/notes/ideas.ts`, без нового роута — чтобы не
  столкнуться с сессией Notes). Детали — в `yedino.md`.

## Сломано / не доделано
- **Контрольный прогон после правки SSE не досмотрен** — запускался, результат не зафиксирован. Проверить,
  что до клиента доезжает `done`, а не только `start`.
- **Скина под стиль 6 нет, роут `/render` режет `style must be 1-5`** — цена вопроса «уходим ли от Canva».
- **Миграции 055 (`canva_oauth_tokens`) и 057 (`idea_notes`) не прогнаны** — попап Notes отдаёт пустой список.
- **Рабочая копия грязная у двух сессий сразу.** Коммитить по правилу «обе половины одним коммитом».
- **Пайплайн не дёрнуть напрямую**: `SERVICE_TOKEN`, `SUPABASE_*`, `ANTHROPIC_API_KEY` — `[SENSITIVE]`.
  Но ADMIN_KEY читается (прод-роуты), Supabase — через CLI, ref `pscqjvkuqqmvmcbxdwtu`.
- **Живой прогон `Patient question` формой так и не удержан**: вопрос доезжает данными, но первая строка
  становится самим вопросом не всегда. **Списка 34 вопросов нет** (в таблице три пробных 101–103, метод —
  `docs/objection-maps/`). `One thing` и `Vague vs specific` живьём не прогонялись.
- **Стрим-плеер и 16:9 не смотрены живьём**; перекраска акцента через Canva MCP невозможна (см. `yedino.md`).
- Две карточки `cleaned.mp4` у HWC не удаляются роутом (сносит только `failed/processing/pending`).
- Розданные PDF-гайды указывают на старую папку записей; коды врачей в истории public-репо — риск принят.
- «Anyone with the link» на папке формы снимать нельзя — на нём держатся врачебные ссылки.

## Следующий шаг
Досмотреть контрольный прогон генерации на `58fa922` — дошёл ли `done` до клиента. Затем решение Игоря по
Canva: если уходим — скин под стиль 6 в `lib/render/skins/` и один из пяти готовых постов рядом с
Canva-версией. Параллельно прогнать 055 и 057 и согласовать с сессией Notes, кто коммитит общую правку.
