# Main — репозиторий, доступы, Drive-аккаунт, тексты и фото по нише

Обновлено: 2026-09-23 · ветка: main

## Состояние
**Рабочая копия — `~/Code/Content-machine`** (старый путь в `~/Documents` — симлинк). **Деплой по `git push`**;
`vercel --prod` руками не гонять — CLI грузит незакоммиченное. Прод — `content-machine-gules.vercel.app`,
**сейчас на `e79912e` = HEAD, сборка зелёная** (проверено `/api/version` 23.09). Админ-запрос =
`Cookie: cm_admin=$ADMIN_KEY`, `+ cm_view_as=<clinicId>` рендерит экран глазами врача. Локально приложение
**не поднять**: в `.env.local` нет ни `ADMIN_KEY`, ни ключей Supabase — UI-правки проверяются на проде.

**В репозитории работают несколько сессий одновременно.** `tsc` локально видит рабочую копию целиком, а
Vercel — только коммит, поэтому **обе половины правки должны ехать одним коммитом**. Дважды уронили сборку
именно этим (16.09 `planner.ts` без `formats.ts`, 17.09 `writer.ts` без `profiles.ts`). Проверка перед пушем
дешёвая: `git worktree add --detach <tmp> HEAD`, симлинк `node_modules`, `npx next build`.
**Границы владения на сейчас**: сессия Notes держит `lib/notes/`, `app/api/notes/ideas/`,
`lib/agents/note-tidy.ts`, `app/scripts/*` и миграцию 057; сессия Yedino — `app/visual/*` и `lib/posts/*`.

**Свой рендер каруселей уже существует и это главный незадействованный рычаг.** `lib/render/`
(`compose.ts`, `html.ts`, `png.ts`, `shapes.ts`, `fonts.ts`, `skins/`) + `POST /api/posts/:id/render`.
В комментарии роута прямым текстом: «draw the carousel HERE instead of in Canva… the two sit side by side
for comparison». Сделан **один скин `style3`**, роут ограничен стилями **1–5**. Шрифты инлайнятся из
`assets/fonts/` как data-URI (на Vercel шрифтов нет вообще — иначе Chromium молча уедет в Times).

**Роли (16.09).** Скрипты генерит только админ (403 клиничному токену, вкладка Generate скрыта). Видео врач
**смотрит, но не скачивает**: ни чипов папок Drive, ни «Open in Drive», плюс `copyRequiresWriterPermission`.

**Плеер `/videos` — свой роут, не iframe Drive.** Drive не отдаёт файл в свой `/preview` до собственной
перекодировки. Байты идут через `/api/recordings/[fileId]/stream` (кука + проверка принадлежности клинике,
`Range` пробрасывается, иначе Safari ломает перемотку); iframe остался фолбэком по `onError` для старых
WebM. Цена: залогиненный врач технически может вытащить байты по URL — трещина в watch-only от 10.09.
**Удаление подтверждается оверлеем внутри страницы**, не `window.confirm` (iOS Safari глушит диалоги, и
`confirm()` молча возвращает `false` — кнопки Delete выглядели мёртвыми).

**Телесуфлёр знает 16:9** (`e79912e`): поворот телефона переключает раскладку, кнопка `16:9`/`9:16` —
запасной путь. У ландшафта свой кегль (56 px против 30, регулятор `A−/A+` 28–120), панели уходят в overlay.

**Drive приложения = `kinnil.official@gmail.com`**; корень записей `content-machine`, папка клиники —
anyone-reader. Замок скачивания — право владельца: записи по 22.08 за `hellosystems111` не лочатся,
ретро-прогон `POST /api/studio/recordings/fix-permissions?clinicId=…[&unlock=1]`.

**Дистрибуция через Buffer — решение созревает (23.09).** Buffer в 2026 заново открыл API: есть на free-плане
(1 личный API-ключ на аккаунт, OAuth для сторонних приложений ещё не включён), 11 каналов, есть MCP/CLI.
План: Buffer-аккаунты (Yedino + HireDrop), личные ключи в `.env`, маппинг «клиника → ключ + каналы».
**Yedino подключён (23.09):** ключ лежит как `BUFFER_ACCESS_TOKEN_YEDINO` (Vercel prod/preview/dev +
`.env.local`), аккаунт `igor.linnick@gmail.com`, orgId `696c48ee111da9195976b964`, каналы:
instagram `6ab468f5ea19ca0bdece1589`, threads `6ab46922ea19ca0bdece184b` (оба @yedino.systems).
API — GraphQL, единственный эндпоинт `POST https://api.buffer.com`, `Authorization: Bearer <key>`;
`channels` требует `input: {organizationId}`. **HireDrop-ключа ещё нет — ждём Игоря.**
Очерёдность: посты (signed URL слайдов из бакета) → approve-флаг
в `/videos` (кнопка «подтвердить» для клиник — будущий шаблон) → видео. Гоча: Buffer'у нужен прямой
скачиваемый URL, Drive-шаралинк не подходит — отдавать через свой прокси/подписанную ссылку. Не проверено:
принимает ли Buffer API видео по URL на free-плане (один curl с личным ключом).
**Бренды заведены в CM (23.09, сессия main).** Yedino Systems `c072746d-e302-45ae-a992-7980ee615551` —
Drive-workspace допровизионен (`POST /api/clinics/provision-drive`), root `152f_Nrdh4WRa2lhZinawtV5cvvgIuiLb`.
HireDrop создан через `POST /api/onboarding` — clinicId `261b5a34-8584-405c-aa52-b55dfbd0fa09`, niche
`hiredrop` (профиля в `lib/niche/profiles.ts` НЕТ — генерацию не запускать, уедет в дефолт), root
`1G6UN4dOvdlPkATdQ0KuCKPkN9qcKp0Vx`, коды доступа `hiredrop-doctor` / `hiredrop-team`. В обоих root'ах
сервис-аккаунтом создана папка **`Static Posts`** (Yedino `16kpRyxETXOfTcRWwwIEQtqMpkSKcaYcV`, HireDrop
`1hMByaQOXSjixGHE6YsjP0X_62HIpJ2DF`; владелец — SA, не kinnil). Семантика по шаблону: `Inbox` = raw,
`Finals` = готовые. ADMIN_KEY и Google SA в `.env.vercel.local` НЕ замаскированы — прод-API и Drive
доступны из сессии (Supabase — через CLI, ref `pscqjvkuqqmvmcbxdwtu`).

**Compose-поллер** `com.hwc.canva-runner` ставится только `bash scripts/canva-runner/install.sh`.
**Canva:** серверный автофил мёртв, карусели собирает Claude+MCP runner копированием мастера; реестр —
`lib/posts/style-templates.ts`. **Доступы:** `/c/<token>` + memorable-код, роли `doctor`/`editor`, две
клиники HWC. **Тексты:** формат = HOW, тема = WHAT, каталог — 9 форматов. **Возражения:** вопрос — строка
в `clinic_objections` (056 прогнана), `objectionId` или `"next"` в генератор. **Фото — доктрина по нише
v4.1**, грабли Flux в `POST-CRAFT.md §5a`. **Себестоимость:** карусель ≈ $11.8 с подписки, скрипт ≈ $0.30.

**Yedino Systems** — бренд агентства отдельно от клиник: `docs/YEDINO-STYLE.md`, хендофф `yedino.md`.
**Notes** — блокнот идей рядом с Generate (вкладка на `/scripts`, миграция 057 прогнана): хендофф `notes.md`.

## Последний заход
- Buffer-исследование + заведение брендов: Yedino допровизионен на Drive, HireDrop создан в CM целиком
  (клиника, группа, токены, Drive-workspace), в оба root'а добавлена папка `Static Posts`. Все id — в блоке
  «Дистрибуция через Buffer». Кода в репо сессия не меняла — всё через прод-API и Drive SA.
- Собрана партия из 5 постов Yedino копированием нового мастера `DAHVe9aREe4` (детали, карта текстовых
  слотов и правило «считать строки, а не символы» — в `yedino.md`). Мастер довёл Игорь руками в Canva.
- В `/visual` добавлен попап **Notes** рядом с полем Topic: заголовок заметки уходит в Topic, тело — в
  стартовую заметку генератора. `app/visual/components/NotesPopover.tsx` + два места в `page.tsx` и
  `PostsWorkspace.tsx`. Данные читаются server-side из `lib/notes/ideas.ts` **без нового API-роута** —
  намеренно, чтобы не столкнуться с сессией Notes, которая как раз пишет `app/api/notes/ideas/`.
  `tsc` чист. Живьём не смотрено (локально не поднять).
- Найдено, что `lib/render/` — это уже начатая замена Canva (см. Состояние). Игорю задан вопрос, уходим ли
  с Canva совсем; ответа пока нет.

## Сломано / не доделано
- **Скина под стиль 6 нет, и роут `/render` жёстко режет `style must be 1-5`** — пока свой рендер не умеет
  новый мастер Yedino. Это цена вопроса «уходим ли от Canva».
- **Миграция 057 (`idea_notes`) не прогнана** — попап Notes отдаёт пустой список (обёрнут в `.catch`, не
  падает). **055 (`canva_oauth_tokens`) тоже не прогнана.**
- **Рабочая копия грязная у двух сессий сразу** (`app/visual/*` + `lib/notes/`, `app/scripts/*`,
  `app/api/notes/ideas/`, `lib/agents/note-tidy.ts`). Коммитить с оглядкой на правило «обе половины одним
  коммитом», иначе снова уроним прод.
- **Пайплайн нельзя дёрнуть из сессии напрямую**: `SERVICE_TOKEN`, `SUPABASE_*`, `ANTHROPIC_API_KEY`
  замазаны `[SENSITIVE]`. НО: ADMIN_KEY читается → прод-роуты доступны; клиники читаются через Supabase
  CLI; `clinicId` yedino теперь известен (см. Состояние). Разбор путей — в `yedino.md`.
- **Перекраска акцента через Canva MCP невозможна** — проверено дважды, подробности в `yedino.md`.
- **Стрим-плеер не смотрен живьём**: ни воспроизведение сразу после записи, ни перемотка на длинном дубле,
  ни как 300-секундная функция Vercel держит стрим большого файла.
- **16:9 не проверен на реальном телефоне**; не проверено, пишет ли iOS дубль настоящим ландшафтом.
- **Третий живой прогон `Patient question` не сделан**; **списка 34 вопросов нет** (в таблице три пробных
  101–103, метод — `docs/objection-maps/`); **`One thing` и `Vague vs specific` живьём не прогонялись.**
- Две карточки `cleaned.mp4` у HWC не удаляются роутом (сносит только `failed/processing/pending`).
- Розданные PDF-гайды указывают на старую папку записей. Коды врачей в истории public-репо — риск принят.
- «Anyone with the link» на папке формы снимать нельзя — на нём держатся врачебные ссылки.

## Следующий шаг
Дождаться решения Игоря по Canva. Если «да» — написать скин под стиль 6 в `lib/render/skins/`, снять
шрифты/ассеты с мастера `DAHVe9aREe4` и отрендерить один из пяти готовых постов, чтобы положить рядом с
Canva-версией. Параллельно — прогнать 057, иначе попап Notes пустой; и согласовать с сессией Notes, кто
коммитит общую правку.
