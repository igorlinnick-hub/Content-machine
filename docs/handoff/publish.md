# Publish — Buffer по брендам

Обновлено: 2026-10-05 · ветка: main

## Состояние
Каждый бренд публикует через **свой** Buffer-ключ и свои каналы: реестр `lib/publish/buffer-accounts.ts`,
ключ реестра = `clinics.niche`. Бренд без записи публиковать не может — так выключена клиника
(решение Игоря 28.09): HWC/aesthetics получают 403 «Publishing is switched off for this brand».
Yedino подключён: Instagram `6ab468f5ea19ca0bdece1589`, Threads `6ab46922ea19ca0bdece184b`,
ключ `BUFFER_ACCESS_TOKEN_YEDINO` (есть в `.env.local` и в Vercel production). ID каналов лежат в коде,
а не в env: без ключа они бесполезны и меняются только при переподключении канала.
Роут публикации принимает `clinicId`; Threads — одиночный пост или ветка (`thread: string[]`,
первая часть включена). В планировщике и модалке есть канал Threads, health проверяет один бренд.

## Последний заход
- 06.10 03:05 UTC **Первая живая публикация через Meta Graph API — работает.** P13 вышел в Instagram hiredrop.io:
  https://www.instagram.com/p/DeIxyBqjJPh/ (`meta_posts` → `published`, 1 попытка). Путь: `DIRECT_META` в
  `lib/publish/meta-creds.ts` (`63858f0`), `META_SYSTEM_USER_TOKEN` в Vercel prod (внёс Игорь), pg_cron `meta-publish`
  */5 (job 3) — его в базе НЕ было, включил Игорь прогоном 061. P13 в `buffer_feed` = `cancelled` (чтобы IG не вышел
  дважды) → **Threads P13 не поставлен**. Классификатор не даёт Claude ставить посты в `meta_posts` и трогать pg_cron —
  такие шаги Игорь запускает сам через `!`.
- 05.10 (ночь) **Докармливатель Buffer в проде** (`058fd61`, «да» Игоря: «schedule через Buffer»). Закоммичены
  `app/api/cron/buffer-feed/`, `lib/publish/buffer-api.ts`, `lib/cron/db-key.ts`, правка `meta-publish/route.ts`,
  тип `buffer_feed`, миграция 062 (сборка `next build` в чистом worktree прошла). pg_cron `buffer-feed` 16:30 UTC
  активен. Первый ручной тик (той же SQL, что у pg_cron, через `supabase db query --linked`) поставил P11 и P12 —
  ответ 200, Buffer 10/10 на канал. В `buffer_feed` 26 строк 11–36: через день 16:00 UTC с 23.10, **P23 закреплён
  на 26.11 (Thanksgiving), P36 на 25.12**, seq = порядок по дате; последний обычный — P35 10.12.
  Картинки — `hiredrop-posts/v2/<id>/N.png` (перерисовка «Drop без щёк»). Посты 3–10 в Buffer перепривязаны на `v2`
  через `editPost` (`R2/buffer-swap-images.cjs`; editPost требует снова передать `metadata` с type) — время и
  тексты прежние. P01 и P03 уже вышли со старым Drop.
- 05.10 **Есть токен Meta для прямого постинга в Instagram — без HelloMetrix.** («в буфере» = в буфере обмена, не Buffer!)
  Системный пользователь Meta Business «HireDrop Campaign Builder», токен `EAAU…` лежит в `.env.local` как
  `META_SYSTEM_USER_TOKEN` (в Vercel ЕЩЁ НЕТ — добавить Игорю: автомод не даёт мне писать секреты в Vercel). Проверено
  `me/permissions`: есть `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`;
  страница HireDrop → IG `hiredrop.io`, **igUserId `17841446093945559`**, host `graph.facebook.com`. Threads: только
  `threads_business_basic`, публиковать нельзя (и Threads API отдельный) → Threads остаётся через Buffer.
- 05.10 (поздно) **Докармливатель Buffer — код написан, НЕ закоммичен, решение Игоря ждёт.** Идея: Buffer free держит 10
  постов на канал, место освобождается с каждым вышедшим → раз в день ставить следующие посты сами, без Meta-кабинета.
  Файлы (незакоммичены): `app/api/cron/buffer-feed/route.ts`, `lib/publish/buffer-api.ts` (запросы проверены живьём:
  `posts(... filter:{channelIds,status:[scheduled]})`, `pageInfo.endCursor`), `lib/cron/db-key.ts` (общая проверка
  `x-cron-key`, на неё же переведён `meta-publish`), `supabase/migrations/062_buffer_feed.sql`, тип `buffer_feed` в
  `types/supabase.ts`; вне репо `R2/buffer-feed-enqueue.cjs` (11–36 с 23.10 через день 16:00 UTC). `tsc` 0, eslint чист.
  **Миграция 062 уже прогнана**: таблица `buffer_feed` (пустая) + pg_cron `buffer-feed` 16:30 UTC — роута в проде нет,
  тик пока бьёт в 404. Залив 11–36 Игорь прервал («погодь, это токен для рекламы был» — про какой-то свой токен Meta;
  к ключу Buffer HireDrop он не относится). Сейчас в Buffer 8/10 на канал (посты 3–10), 2 места свободны.
- 05.10 **Прямой постинг в Meta (Graph API), без Buffer** — в проде (`88c2b9c`), контракт и бриф —
  `docs/META-PUBLISH.md`. Очередь `meta_posts` (060), публикатор `/api/cron/meta-publish`, тик — pg_cron
  в Supabase CM раз в 5 мин (061; Vercel Hobby крон чаще раза в сутки не умеет). Токены CM не хранит —
  берёт у HelloMetrix (`/api/cm/meta-publish-creds`), его Meta-приложение делает OAuth и продление.
  HelloMetrix свою часть написал (ветка `hiredrop-meta-publish`, ещё не задеплоена): скрытый клиент HireDrop
  `a125b7a8-735f-45e7-a1b0-722608e2163f` — **прописан** в `clinics.hellometrix_client_id` (05.10). Instagram через
  Instagram Login → `graphHost` всегда `graph.instagram.com`. **Ждёт Игоря:** «да» на деплой HelloMetrix, кабинет
  Meta (use cases IG + Threads, тестеры, 4 ключа в Vercel HelloMetrix), два «Connect» на `/hiredrop`. Постановка постов: `R2/meta-enqueue.cjs` (PNG → JPEG,
  Instagram PNG не берёт). Живой публикации через Graph API ещё не было.
- 03.10 **HireDrop подключён**: отдельный Buffer-аккаунт (hellosystems111, org `6ab46ada478e317582510051`),
  ключ `BUFFER_ACCESS_TOKEN_HIREDROP` в `.env.local` (в Vercel ещё НЕТ). В реестре: Instagram
  `6ab57e4cea19ca0bdeda5d0f`, Threads `6ab57e68ea19ca0bdeda5dd4`; TikTok `hiredrop1` подключён в Buffer,
  но в реестр не внесён — карусели 4:5 в TikTok не пускаем (решение Игоря). Free-план: 3 канала,
  **10 запланированных постов на канал** (`limits.scheduledPosts`) — при ежедневном постинге очередь
  надо докармливать.
- 03.10 **HireDrop в расписании** (решение Игоря: старт сегодня, через день; в Buffer — сколько влезет,
  остальное Игорь постит сам, не по графику). Посты 1–10 (IG + Threads, 20 записей = лимит free-плана)
  стоят: №1 сб 03.10 17:00 HST, дальше 05, 07 … 21.10 в 06:00 HST (16:00 UTC, полдень ET). Проверено
  запросом к Buffer: все `scheduled`, картинки на месте. Ставит скрипт
  `HireDrop Templates/R2/buffer-schedule.cjs <n от> <n до> <первый слот ISO> [дней] [HH:MM UTC]`,
  id записей — в `R2/buffer-scheduled.json` (по нему же удалять). Грабли: первый слот задавать
  UTC-датой нужного HST-дня (17:00 HST 03.10 = 2026-10-04T03:00Z), иначе следующие уедут на день.
  Посты 11–36 — «manual», Игорь сам. Слоты free-плана освобождаются по мере выхода постов, так что
  докармливатель мог бы вести все 36 бесплатно — Игорь пока выбрал вручную.
- 03.10 **Первые живые черновики** (пост 02 P03, 5 слайдов): IG `6ac1b195814d657011de4c8e`, Threads
  `6ac1b18d5829d2489a003252`, оба `draft`, по 5 картинок. Выяснено вживую: картинка = `{ image: { url } }`
  (голый `{ url }` схема отвергает — в роуте было так, исправлено); IG-карусель = `type: 'post'` с
  несколькими картинками (`'carousel'` IG отвергает); Threads `type: 'post'` + несколько картинок принимает.
- Картинки для Buffer: публичный бакет Supabase `hiredrop-posts` (проект Content Machine
  `pscqjvkuqqmvmcbxdwtu`), путь `P03/1.png…`. Ключи в `.env.vercel.local` замаскированы
  `[SENSITIVE]` — service key брать `supabase projects api-keys --project-ref pscqjvkuqqmvmcbxdwtu`.
- Глобальные `BUFFER_TOKEN` / `BUFFER_CHANNEL_*` заменены реестром по брендам. Старые переменные больше не читаются.
- Health-роут переписан под текущую схему Buffer: `channels` требует `input: { organizationId }`,
  поэтому список каналов читается по организациям аккаунта. Старый запрос `{ channels {…} }` схема
  отвергала — проверка каналов не могла пройти никогда. Новый запрос проверен вживую.
- Формат Threads взят интроспекцией: `metadata.threads = { type, thread: [{ text, assets }] }`, `PostType` содержит `thread`.
- `tsc` по проекту — 0 ошибок, eslint по тронутым файлам чистый.

## Сломано / не доделано
- **Живая публикация работает** (проверено 05.10 запросом `post(input:{id})` к Buffer): №1 P01 и №2 P03
  вышли в IG и Threads вовремя (`sent`, ~1–4 мин после `dueAt`, без ошибок). Ветка Threads
  (`type: 'thread'`) вживую не проверялась.
- **HireDrop подключён и в приложении (05.10):** `BUFFER_ACCESS_TOKEN_HIREDROP` в Vercel production (preview нет),
  код в проде (`d171eb1`), health на проде → instagram + threads `connected`, `verification: full`. Клиника
  `261b5a34-8584-405c-aa52-b55dfbd0fa09`, niche `hiredrop`. Через приложение HireDrop ещё ни разу не постили —
  все живые посты шли скриптом.
- Код Buffer в проде с 05.10 (`e1eee22`): HWC/aesthetics публиковать больше не могут (403, так задумано).
  В дереве остаётся чужой незакоммиченный `lib/render/html.ts` — его не коммитить вслепую.

- Файлы 03.10: `lib/publish/buffer-accounts.ts` (каналы hiredrop), `app/api/publish/buffer/route.ts`
  (assets → `{ image: { url } }`), `.env.local` (`BUFFER_ACCESS_TOKEN_HIREDROP`); вне репо — `R2/buffer-schedule.cjs`,
  `R2/buffer-scheduled.json`, `R2/to-drive.cjs` (вне репо, без git).

## Следующий шаг
0. Докармливатель работает сам: раз в день ставит следующий пост, как освобождается место. Проверка —
   `select seq, source, status, last_error from buffer_feed order by seq` (CLI). Ошибка 3 раза подряд → push админам.
1. Instagram напрямую: в `lib/publish/meta-creds.ts` добавить реестр по нише (как `buffer-accounts.ts`): `hiredrop` →
   `{ tokenEnv: 'META_SYSTEM_USER_TOKEN', igUserId: '17841446093945559', graphHost: 'graph.facebook.com' }`, HelloMetrix —
   только запасной путь. Игорь кладёт `META_SYSTEM_USER_TOKEN` в Vercel prod. Деплой → `cron.schedule` meta-publish (061,
   сейчас тикает) → один пробный пост (`meta-enqueue.cjs` с `instagram` только) → проверить permalink.
2. 11–36 уже идут через Buffer (IG + Threads), Meta для них не нужен. Чужое не трогать: `html.ts`, `yedino.md`.
Начинать на Opus.
