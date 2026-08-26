# Main — доступы, телепромтер + /videos, брендирование входа, фото для каруселей, формат vs тема

Обновлено: 2026-08-25 · ветка: main

## Состояние
**Доступы.** Вход в прод (`content-machine-gules.vercel.app`) — ссылка `/c/<token>` или
memorable-код на экране входа, cookie на год. Выпуск/отзыв — только в UI `/clinics` →
`InstallLinkCard`. Роли: `doctor` (тонкая поверхность), `editor` (back-office). Клиник две,
обе HWC: Dr. Shawn `5065c6ee-7c4b-451b-8dee-3498eb3af674` (дефолт), Dr. Made
`cdb530e5-3ce9-4088-abee-117bc872e39a`. Коды/токены здесь намеренно НЕ записаны.

**Формат vs тема — разведены by design.** Тема (`content_plan_topics`) = WHAT, формат
(`lib/posts/formats.ts`) = HOW. Поле темы в форме генерации при смене формата НЕ меняется и
не должно: на нём висит 8-недельная арка плана. Заголовок обложки при этом уже пересобирается
под формат — у каждого формата есть `coverTitle`, `lib/agents/writer.ts` отдаёт его Writer'у
как BINDING, когда формат запинен, плюс запрет использовать голое слово темы как заголовок.
Кто в следующий раз подумает «пусть формат переписывает тему» — это тихая правка текста,
запрещена; максимум — явная кнопка «подогнать тему под формат» рядом с ↻.

**Тексты скриптов и каруселей — бан клише как КАТЕГОРИИ (2026-08-19).** Правило — категория
с тестом («сказал бы это спокойный врач одному пациенту через стол?»), списки — примеры, не
блоклист. Шесть категорий (тизер-строки HARD, strawman-зачины, маркетинг/AI-филлер,
антитеза-бантик, rule-of-three, wrap-up после каждого бита). Где живёт: `lib/agents/writer.ts`
(HARD-блок `NO CLICHÉS`), `lib/agents/teaser-lines.ts` (`findTeaserLines()` HARD →
`approved=false`; `findClicheLines()` SOFT), `lib/agents/critic.ts` подмешивает оба списка в
бриф, `docs/POST-CRAFT.md`. Downstream текст не переписывает — источник фраз только Writer.

**Запись телепромтера.** `1920×1080 @ 30fps` через `ideal`, битрейт от `getSettings()`
(~0.13 бит/пиксель/кадр), H.264/mp4 первым приоритетом. «Start Recording» заблокирована,
пока нет стрима; `startRecording()` возвращает boolean, при ошибке камеры — «Read without
recording». Транспорт внизу, `.tp-controls-safe`, скорость по умолчанию 25.
Экран «Saved»: кнопка «Watch in My videos» → `/videos?clinicId=…`.

**Список скриптов у врача = шорт-лист по звезде (2026-08-25, просьба Фила).** Врач/editor
видит в `/teleprompter` и `/scripts` ТОЛЬКО `starred` (колонка из 046, миграция применена);
админ — весь архив. Звезду переключает только админ (`RecentScripts canStar`), у врача она
read-only маркер «picked for you» — иначе она снимет звезду и вынесет скрипт из своего же
списка. Запросы терпят базу без колонки: ошибка → откат на нефильтрованный список, а не
пустой экран. Deep-link `?scriptId=` открывает скрипт даже без звезды. Пусто = отдельная
плашка с объяснением, а не исчезнувший блок. Тап по скрипту скроллит страницу к карточке
«Script text» (`editorRef.scrollIntoView`) — на телефоне текст грузился за экраном и
выглядело, будто тап не сработал.

**`/videos` — библиотека видео для врача** (`app/videos/*`). С 2026-08-20 — ОДИН плоский
список: edited (`clips` status=cleaned) и записи (`clinic_recordings` status=final) слиты и
отсортированы по дате. `kind` внутри остался — только он даёт право на Delete (recordings).
Плеер — Drive-embed `…/file/<id>/preview`. Embed играет только файлы с доступом по ссылке —
новые получают его в `confirm` (`allowLinkView`), для старых
`POST /api/studio/recordings/fix-permissions`.

**Брендирование HWC.** `/install` и `/` в стиле клиники (`HWC-Landing-pages/`), ассеты
`public/brand/`, Playfair через `next/font`, токены `--hwc-*`. Логотип только на белом.

**Подбор фото для каруселей — доктрина v4** (2026-08-17): `ai` — только 3D-медрендеры и
гавайская природа; `clinic` ~40% из Drive-библиотеки (LRU, кулдаун 30 дней после compose);
`stock` ≤2 на пост. Обе клиники проиндексированы по 137 фото. Индексировать чужую клинику —
ТОЛЬКО админом. Служебный аккаунт
`content-machine-sa@jobflow-491621.iam.gserviceaccount.com`, папка `120xEMg5Zl47ZpD6Bd8q5QodHFEdndzNK`.

**Блокировки compose-раннера видны и слышны (2026-08-24).** `scripts/canva-runner/run.sh`
на каждом pre-flight'е (протухший Canva-токен, 402 Replicate, quota-cooldown) пишет
`compose_progress.stage='blocked'` во ВСЕ строки `ready_for_canva` — жёлтая плашка на
`/visual` рендерит `progress.error` как есть, отдельного текста в UI нет. С этого захода
`mark_blocked` ещё и шлёт web-push через `POST /api/canva/blocked`
(`x-internal-dispatch-secret: CONTENT_MACHINE_SECRET`, пуш уходит только клиникам, у которых
реально висит строка в очереди). Дедуп — файл `blocked-notified` в конфиг-каталоге раннера:
пуш уходит один раз на причину, `clear_blocked_notice` стирает его, когда очередь поехала.
Env раннера пополнен `CONTENT_MACHINE_SECRET` и `APP_URL`.

**Canva MCP: две записи, одна связь.** `claude.ai Canva` — managed-коннектор, его токен живёт
на claude.ai, CLI обновить его НЕ может (лечится только `/mcp` в интерактивной сессии).
`claude_ai_Canva` — тот же MCP, зарегистрированный локально
(`claude mcp add --transport http --scope user claude_ai_Canva https://mcp.canva.com/mcp`),
refresh-токен на машине, продлевается сам, чинится одной командой `claude mcp login
claude_ai_Canva`. Локальную запись вернули 2026-08-24 — pre-flight в run.sh принимает оба
написания. Из неинтерактивной сессии логин невозможен (`stdin isn't a terminal`).

## Последний заход
- **Фидбек Фила по скриптам (два пункта, оба сделаны в дереве).** (1) Врачу видны только те
  скрипты, что маркетинг отметил звездой; (2) тап по скрипту в «Load a recent script»
  скроллит к загруженному тексту.
- Правки: `app/teleprompter/page.tsx` (фильтр `starred` для не-админа + fallback на
  нефильтрованную выборку, deep-link ловится отдельным запросом), `TeleprompterView.tsx`
  (`editorRef` + `scrollIntoView`, янтарная звезда в строке, плашка на пустой список),
  `app/scripts/page.tsx` (`loadRecentScripts(..., { starredOnly: isDoctor })`, свои
  заголовки для врача), `RecentScripts.tsx` (проп `canStar`, read-only звезда, свой empty
  state), `lib/supabase/context.ts` (опция `starredOnly`). `tsc --noEmit` чистый.
- Локально показать живую страницу не вышло: в `.env.local` нет Supabase, а в
  `.env.vercel.local` значения затёрты в `[SENSITIVE]` (`vercel` CLI на машине нет) —
  dev-сервер падал на `Invalid supabaseUrl`. Поведение скролла показано отдельным статичным
  демо в scratchpad'е, dev-сервер погашен.
- Не коммитили и не пушили — решение о пуше за Игорем (в дереве много чужих правок).

## Сломано / не доделано
- **Canva MCP не скачивает картинки по URL (2026-08-24, 13:45).** `upload-asset-from-url`
  отдаёт `fetch_failed` на ЛЮБОМ хосте — раннер проверил и Replicate-URL'ы, и нейтральный
  Wikimedia, три попытки с паузами. Сбой на стороне Canva, не наши ссылки. Логин при этом
  живой (`claude_ai_Canva — ✔ Connected`), пост `c9270c18` вернулся в `ready_for_canva`,
  resume-указатель `DAHTP_HYGCY` (копия мастера, ничего ещё не залито).
- **Поллер намеренно выгружен**: `launchctl bootout gui/501/com.hwc.canva-runner`. Иначе он
  тикает раз в 2 минуты и на каждый тик запускает полный compose (~5 мин и живые деньги по
  ANTHROPIC_API_KEY) в бесконечный retry. Вернуть:
  `launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.hwc.canva-runner.plist`.
  Обсуждали cooldown-файл для класса `fetch_failed` по образцу quota-cooldown — не сделан.
- **Правки по скриптам не задеплоены** — Фил увидит фильтр по звезде и автоскролл только
  после пуша (`app/teleprompter/*`, `app/scripts/page.tsx`,
  `app/dashboard/components/RecentScripts.tsx`, `lib/supabase/context.ts`).
- **`POST /api/canva/blocked` не задеплоен** — на проде 404, пуши молчат до следующего
  деплоя. Раннер это переживает: при не-200 файл `blocked-notified` не пишется, так что
  первый же тик после деплоя отправит уведомление.
- **Compose в Canva с clinic-фото ни разу не прогонялся.** Сервер отдаёт `photo_url`,
  скилл раннера его ждёт, живой сборки не было (~$18 и ~180 ходов за карусель).
- **Обложка.** Стили 1, 4 и Aesthetic требуют полноэкранного фото, его выбирает раннер
  (Pexels/Flux), а не библиотека клиники: `canva_style` проставляется PATCH'ем ПОСЛЕ
  генерации, на момент брифа сервер стиля не знает. Не регресс — так было и в v3.
- Маршруты пикера (`/api/visual/photo-recommend`, `/photo-override`, `/photo-thumb/<id>`)
  не существуют — UI визуальных постов в этой части нерабочий. Каруселям не нужны.
- `/install` вживую никто не видел: она за doctor-сессией.
- Чужие незакоммиченные хвосты в дереве, не тронуты: серверный рендер слайдов
  (`app/api/posts/[slideSetId]/render/`, `lib/render/`, `lib/photos/*`, `assets/fonts/*`,
  `scripts/render-preview.mts`, `pptest.mjs`, миграция 047) и clips-runner
  (`scripts/clips-runner/`, `app/api/clips/*`, `app/api/cron/clips-inbox/`,
  `lib/clips/ffmpeg.ts`, `next.config.mjs`).
- ГРАБЛИ песочницы: `googleapis` виснет на любом запросе (обход — ручной JWT через
  `crypto.createSign`), `npm run dev` / `next lint` / `git status` по чужим репам виснут;
  `slide_sets.slides` читать PostgREST'ом с сервисным ключом из
  `~/Library/Application Support/HWC/canva-runner/env`.

## Следующий шаг
Запушить правки по скриптам (пять файлов, отдельным коммитом от чужих хвостов) и дать Филу
проверить на телефоне: список должен показывать только звёздные скрипты, тап — уезжать к
тексту. Параллельно — проверить, ожил ли `upload-asset-from-url` в Canva (прогнать compose
вручную одним заходом): ожил — вернуть поллер `launchctl bootstrap`; не ожил — делать
cooldown для `fetch_failed`, чтобы раннер сам паузил и сам возобновлял.
