# Main — доступы, телепромтер + /videos, брендирование входа, фото для каруселей, формат vs тема

Обновлено: 2026-08-24 · ветка: main

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
- Разбирали, почему «автономный цикл» встал: 2026-08-24 в 12:18 токен Canva протух
  ПОСРЕДИ compose'а. Раннер отработал правильно — вернул строку в `ready_for_canva`,
  оставил resume-маркер на дизайне `DAHTPtk5YAM` (готовы обложка и слайды 1–3), дальше
  15+ тиков подряд пропускал по pre-flight'у. Границу автономности зафиксировали: OAuth-
  согласие Canva продлевает только человек, кодом это не закрывается — можно лишь сделать
  обрывы реже и чинить их быстрее.
- Сделано: вернули локальную регистрацию `claude_ai_Canva`; новый роут
  `app/api/canva/blocked/route.ts` + вызов из `mark_blocked`; текст плашки теперь называет
  и команду, и `/mcp`. `run.sh` синхронизирован с installed-копией
  (`~/Library/Application Support/HWC/canva-runner/run.sh`), ручной тик — exit 0.
- Не сделано намеренно: не коммитили и не пушили — в дереве много чужих незакоммиченных
  правок, решение о пуше за Игорем.

## Сломано / не доделано
- **Пост `c9270c18` стоит недособранный.** Ждёт `claude mcp login claude_ai_Canva` в
  ИНТЕРАКТИВНОМ терминале — до этого каждый тик пропускается. После логина раннер сам
  дошьёт слайды 4–8 с resume-маркера, ничего нажимать не надо.
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
`claude mcp login claude_ai_Canva` в интерактивном терминале — и дать раннеру самому
дособрать пост `c9270c18` со слайда 4; глазами проверить шов между слайдами 3 и 4.
