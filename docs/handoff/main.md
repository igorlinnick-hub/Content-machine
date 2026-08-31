# Main — репозиторий вне iCloud, compose-поллер, доступы, тексты, фото по нише

Обновлено: 2026-08-27 · ветка: main

## Состояние
**Рабочая копия — `~/Code/Content-machine`**; старый путь под `~/Documents` — симлинк. Код туда не
возвращать; файл, читающийся пустым при ненулевом размере, проверять `ls -lO` на `dataless`.

**Compose-поллер** `com.hwc.canva-runner` в `gui/501`, тик 2 мин; ставить только
`bash scripts/canva-runner/install.sh` (`--check` — здоровье), `launchctl load` запрещён. **launchd не
тикает, пока идёт сборка (~25–40 мин)** — heartbeat `poller_ts` во время сборки стучит из фонового цикла
в `run.sh` (детали и CAS-фильтр — в комментариях там же). Обновить `run.sh`/`SKILL.md` при живой сборке:
`cp → .new && mv` в `~/Library/Application Support/HWC/canva-runner/` (атомарно); `install.sh` при локе
отказывает — `bootout` убьёт сборку. Источник SKILL.md — `~/.claude/skills/canva-compose-runner/`, не репо.
Блокировки → `stage='blocked'` + push через `/api/canva/blocked`.
**Canva:** `upload-asset-from-url` работает; managed MCP чинится `/mcp`, локальный — `claude mcp login`.
**Canva notes — только чтение с 2026-08-24** (MCP сменил инструменты: у `perform-editing-operations`
нет операции для notes, `notes:""` в `pages[]` игнорируется). Caption поста (`scripts.long_caption`)
кладётся на дизайн комментарием — `comment-on-design`, скилл §6 шаг 3a; §6a читает notes копии и печатает
`NOTES LEAK`, если мастер снова с текстом. **Все 5 мастеров вычищены 26.08, сверено по API.** Чистить
снова: Safari `do JavaScript` работает только через нативный сеттер + `input` + `blur()` + ~10 с
(синтетический клик — нет), и панель Notes привязана к странице под вьюпортом — **«Page 1» в редакторе ≠
страница 1 в API** (сверху прячется ещё одна): скроллить к `scrollTop=0` и перепроверять чтением API.
**Доступы:** `/c/<token>` / memorable-код, роли `doctor` / `editor`, две клиники HWC (regenmed + aesthetics).
**Тексты:** формат = HOW, тема = WHAT; клише забанены тестом «сказал бы врач одному пациенту?».
**Evidence-слайд:** студии из PubMed (`lib/posts/studies.ts`), ярус «3 года», год только в одном
предложении с журналом — таймлайны запрещены.

**Фото — доктрина ПО НИШЕ (v4.1).** `lib/posts/photo-brief.ts` и `cover-brief.ts` выбирают доктрину по
`clinics.niche`. Regenmed = v4 (3D-рендеры + Гавайи, ~40% из Drive, Pexels ≤2). Aesthetics (Made, мастер
`DAHMHS1wLls`) = только реальные фото, тёплая + лавандовая палитра: SKIN — нелицевые зоны (шея со спины,
плечо, декольте, кисть); TOOLS — натюрморт без кожи и этикеток; ROOM — пустой кабинет; BOTANICAL — только
аналогии. Клиника 25% — пол и потолок (`capClinic`): общая Drive-папка — regenmed-команда за столами.
Обложка aesthetics выбирается кодом по словам темы, текст темы во Flux не уходит (любое лицевое слово →
лицо, измерено). Правила и грабли Flux: `POST-CRAFT.md §5a`, `SKILL.md §4`.

## Последний заход
- Диагноз «Canva runner is not ticking» при живой сборке: тиков нет, пока `run.sh` занят → `poller_ts`
  замирает → красная плашка с 6-й минуты КАЖДОЙ сборки; при 2+ постах в очереди — на весь цикл.
  Сегодня проявилось из-за 12 висящих процессов Claude Code (VS Code): первая стадия пришла через 10 мин.
- `run.sh`: фоновый heartbeat пока жив `claude -p`; UI `ComposeWaitingChip`: `in_canva` без стадии →
  «claimed, booting», после 20 мин → «died, watchdog requeues»; путь к `install.sh` → `~/Code/…`.
- SKILL.md: `ts` через `$(date -u …)` — модель писала `22:23:00Z` за 3 мин до старта процесса.
  Проверено живьём: `photos:start` с честными секундами, CAS не затёр стадию.
- Собрано: `DAHTbk2F2F8` (tissue repair, Style 2, 38 мин); `DAHTcKwCtjQ` (aesthetics, «Duck Lip Myth»,
  готов) — первый композ на новом скилле: сам положил caption-комментарий и напечатал `NOTES LEAK
  DAHMHS1wLls p1` до чистки мастера.
- Старые notes в постах = caption донорского поста из мастера; setter в MCP пропал 24.08, раннер писал
  об этом в итогах, никто не читал. Скилл переведён на caption-комментарий, мастера вычищены скриптом
  через Safari (ручные попытки не сохранялись). Разбор: `.crew-learnings/2026-08-26-canva-mcp-notes-read-only.md`.
- Caption-комментарии положены на `DAHTa8Dj7bA`, `DAHTP_HYGCY`, `DAHTbk2F2F8` (ретрофит) и `DAHTcKwCtjQ`.
- Коммит `d58eb44` (run.sh + UI + `.crew-learnings/2026-08-26-launchd-no-overlap-heartbeat.md`).

- **Мастер Aesthetic (5) приведён к стандарту (27.08).** `DAHMHS1wLls` оставался копией старого
  ED-поста: страницы 2–7 — стены по 60–100 слов, шрифт ~2/3 от стандарта, нативные були, текст уходил
  за нижний край. Раннер наследует размеры мастера, поэтому в такой типографике выходил каждый пост
  Made. Тела страниц переписаны в систему Style 1 (`font_size` 67/56 при `line_height` 1.2 → бокс
  80 / 268 / 335 units, как у `DAHRSR-KWdA`), блок слева 64 / шириной 950, низ ≈1240, пустая строка
  между пунктами, литеральные `✓`/`①`. Донорские тексты ED вычищены (обложка «Fillers & Lip Filler /
  Three Filler Myths», CTA-ключ `GLOW`), title дизайна → «Aesthetic master (Made) — canva_style 5»,
  превью в пикере перевыгружено (`public/style-previews/aesthetic.png` — там висел «Erectile
  Dysfunction»), `bodySlots` 5 → 6 (посчитано по самому мастеру). Бэкап до правки — `DAHTh7vDmxM`.
  Разбор: `.crew-learnings/2026-08-27-aesthetic-master-editorial-standard.md`.

## Сломано / не доделано
- **Фото в мастере Aesthetic — донорские regenmed** (мужчина с бородой, пробирки, консультация двух
  мужчин). Раннер обязан заменять их по `photo_brief`, но сам мастер не по доктрине §5a — перегенерить
  aesthetics-набор (кожа-макро без лица, инструменты, пустая комната, ботаника) и залить в мастер.
- Панели (диагонали/волны) на этих мастерах через Canva MCP **не адресуются** — их нет ни в
  `richtexts`, ни в `fills`. Panel-fit из скилла на страницах 2+ физически невозможен: текст подгоняем
  под панель, а не панель под текст.
- **Стиль по нише (27.08):** `slide_sets.canva_style` имеет DB-default 1 (мастер regenmed), а generate
  его не проставлял — посты Made рождались в Style 1 и собирались с дизайн-элементами Шона, хотя
  Aesthetic (5) — единственный доступный им стиль. Добавлен `defaultStyleForNiche()` в
  `lib/posts/style-templates.ts`, `createSlideSet` принимает `canvaStyle`, generate ставит его на обеих
  ветках создания строки. `tsc` чистый. **Работает только после деплоя**; ждущей строке Made стиль
  проставлен вручную (5).

- main ahead 2 от origin — пуш делает Игорь; **до пуша плашка на Vercel остаётся старой** (но с новым
  heartbeat заклеймленный пост уже не краснеет и в старом UI).
- Pre-flight `claude mcp list` в `run.sh` — ~5 мин на этом Маке → при непустой очереди реальный тик 5–8 мин.
- Нишевая доктрина не видела реальной генерации aesthetics-поста (LLM-бриф + раннер) — нужен деплой.
  Не закоммичено: photo-brief/cover-brief/splitter/compose+generate route + доки и studies.ts/writer.ts
  (evidence-слайд, NAD+-пост не перегенерирован). Коммитить двумя коммитами.
- iCloud (2026-08-26): потеряно `scripts/clips-runner/`, `scripts/render-preview.mts`, `pptest.mjs`,
  правки `next.config.mjs`, `app/api/clips/from-recording/route.ts`; `…/Content machine.icloud-broken`
  (621 МБ) не удалён. Чужие хвосты в дереве: серверный рендер (`app/api/posts/[id]/render/`, `lib/render/`,
  `lib/photos/*`, миграции 047/051, шрифты, `ADS-CRAFT.md`, `AdFormatPicker.tsx`), остатки clips.
- Маршруты `/api/visual/photo-*` не существуют; `/install` вживую не видели. Песочница: `googleapis`
  виснет (JWT через `crypto.createSign`); `slide_sets` читать PostgREST'ом с ключом из `…/HWC/canva-runner/env`.

- **From the floor — папка MA подключена к CM (31.08, не задеплоено, миграция 052 не применена).**
  Google-форма медассистентов (раздатка с QR уже роздана) пишет в Drive-папку; CM зеркалит её в
  `floor_media` и показывает **вкладкой в `/videos`** — отдельно от телепромптерных дублей, без новой
  карточки на дашборде (бейдж «N new» на «My videos»). Папка подключается вставкой ссылки прямо во
  вкладке (`clinics.drive_floor_folder_id`), синк — cron `0 7 * * *` (21:00 Hawaii, он же шлёт push),
  Sync now и тихий синк при открытии вкладки. Push-подписки стали admin-scoped
  (`push_subscriptions.is_admin`) — устройство Игоря теперь получает и «Made/Shawn записал», и «MA
  залили» по всем клиникам; `PushToggle` вернулся в UI (в шапке `/videos`) — без него подписаться было
  негде и пуши физически никому не приходили. Детали и грабли Drive-доступа — `HANDOFF-MODULES.md` §6b.

## Следующий шаг
После пуша Игоря сгенерировать один aesthetics-пост (Made): `photo_brief` — SKIN только шея/плечо/кисть,
лицевые темы в TOOLS/ROOM, clinic ≤ 25%; во время его сборки плашка в /visual не краснеет — тогда
коммитить фото-доктрину.

Параллельно (floor): прогнать `supabase/migrations/052_floor_media.sql` в SQL Editor, открыть
`/videos` → вкладка **From the floor** → вставить ссылку на папку ответов формы, включить
«Notify me about new videos» на телефоне. Аккаунт из `GOOGLE_DRIVE_USER_REFRESH_TOKEN` должен быть
**Editor** на этой папке — иначе плитки серые.
