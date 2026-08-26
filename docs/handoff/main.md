# Main — репозиторий вне iCloud, compose-поллер, доступы, тексты

Обновлено: 2026-08-26 · ветка: main

## Состояние
**Рабочая копия — `~/Code/Content-machine`.** На старом пути
`~/Documents/Code Projects/Content machine` теперь симлинк, так что все прежние пути и
LaunchAgent'ы работают. Причина переезда — в «Сломано». Правило: код не возвращать под
`~/Documents`; файл, который читается пустым при ненулевом размере, проверять `ls -lO` на
флаг `dataless`, а не искать баг в коде.

**Compose-поллер.** `com.hwc.canva-runner` живёт в домене `gui/501`, тик 2 мин. Ставить
только через `bash scripts/canva-runner/install.sh` — он делает `bootstrap gui/$(id -u)`,
проверяет `launchctl print` и падает, если джоб не встал; `launchctl load` запрещён (см.
«Сломано»). Здоровье одной командой: `install.sh --check` (агент / возраст тика / лок / MCP).
Раннер штампует `compose_progress.poller_ts` на очередь каждый тик — `/visual` по нему
отличает «раннер жив, возьмёт сам» от красного «раннер не тикает». Блокировки (протухший
Canva-токен, 402 Replicate, quota-cooldown) пишут `stage='blocked'` + web-push через
`POST /api/canva/blocked`, дедуп файлом `blocked-notified`.

**Canva.** `upload-asset-from-url` снова работает (сегодняшний compose залил 7 фото, `fetch_failed`
от 24-го больше не воспроизводится). Две записи MCP, одна связь: managed `claude.ai Canva`
чинится только `/mcp` в интерактиве, локальная `claude_ai_Canva` — `claude mcp login`.

**Доступы.** Вход в прод — `/c/<token>` или memorable-код, cookie на год, выпуск/отзыв в
`/clinics` → `InstallLinkCard`. Роли `doctor` (тонкая поверхность) / `editor` (back-office),
две клиники HWC. Токены здесь намеренно не записаны.

**Тексты.** Формат (`lib/posts/formats.ts`) = HOW, тема (`content_plan_topics`) = WHAT; поле
темы при смене формата не трогается — на нём висит 8-недельная арка. Клише забанены как
категория с тестом «сказал бы это спокойный врач одному пациенту через стол?»
(`writer.ts`, `teaser-lines.ts`, `critic.ts`, `POST-CRAFT.md`). Тихие правки текста downstream
запрещены. У врача в `/teleprompter` и `/scripts` только `starred` (в проде с 9ac7577).

**Фото.** Доктрина v4: `ai` — 3D-медрендеры и гавайская природа, `clinic` ~40% из Drive (LRU,
кулдаун 30 дней), `stock` ≤2 на пост. Обложки стилей 1/4/Aesthetic подбирает раннер, не
библиотека: `canva_style` проставляется PATCH'ем уже после генерации.

## Последний заход
- Очередь стояла двое суток: поллер был выгружен. Поднял `bootstrap gui/501` — пост NAD+
  (`8fde28e4`) собрался, `visuals_ready`, дизайн `DAHTa8Dj7bA`.
- Нашёл настоящую причину: `install.sh` ставил агент через `launchctl load`, тот
  регистрируется в домене вызывающего шелла и умирает вместе с сессией Claude Code.
- Починил класс проблемы (коммит `850c540`): явный домен + проверка + отказ выгружать агент
  во время compose + `--check`; heartbeat `poller_ts` до взятия лока; честный баннер на
  `/visual`; `{stage:'queued'}` при постановке в очередь.
- Обнаружил, что iCloud вытирал репозиторий (см. «Сломано»), и перенёс код в `~/Code`.
- `npm ci` + `tsc --noEmit` чистые в новой копии.

## Сломано / не доделано
- **main ahead 2 от origin (`850c540` heartbeat + `5039a01` порядок вкладок /scripts), не запушено** — пуш делает Игорь одной командой на оба; heartbeat-баннер появится на проде после деплоя.
- **iCloud сожрал часть дерева (2026-08-26).** Квота исчерпана (`brctl status` →
  `Quota exceeded`) при диске на 97%, macOS вытеснил 35 859 файлов репо в нечитаемые
  `dataless`-заглушки, включая 3 893 объекта в `.git`. Восстановлено клоном с GitHub.
  **Безвозвратно потеряно незакоммиченное:** `scripts/clips-runner/`,
  `scripts/render-preview.mts`, `pptest.mjs`, правки в `next.config.mjs` и
  `app/api/clips/from-recording/route.ts`. Сам диск и квота не починены — только обойдены.
- Старое дерево `~/Documents/Code Projects/Content machine.icloud-broken` не удалено;
  в нём 621 МБ `.claude/worktrees`.
- Чужие незакоммиченные хвосты в дереве: серверный рендер слайдов
  (`app/api/posts/[slideSetId]/render/`, `lib/render/`, `lib/photos/*`, миграции 047/051)
  и остатки clips (`app/api/clips/*`, `lib/clips/ffmpeg.ts`).
- Маршруты фото-пикера (`/api/visual/photo-recommend`, `/photo-override`, `/photo-thumb/<id>`)
  не существуют — эта часть UI визуальных постов нерабочая. Каруселям не нужна.
- `/install` вживую никто не видел: страница за doctor-сессией.
- Грабли песочницы: `googleapis` виснет на любом запросе (обход — ручной JWT через
  `crypto.createSign`); `slide_sets` читать PostgREST'ом с сервисным ключом из
  `~/Library/Application Support/HWC/canva-runner/env`.

## Следующий шаг
Игорь пушит оба коммита; после деплоя проверить на `/visual`, что очередной queued-пост
показывает «раннер жив», а не красную плашку (запись poller_ts в БД уже smoke-тестирована).
