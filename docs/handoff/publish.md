# Publish — Buffer и прямой Meta по брендам

Обновлено: 2026-10-27 · ветка: main

## Состояние
- **Бренды:** у каждого свой Buffer-ключ и каналы, реестр `lib/publish/buffer-accounts.ts` (ключ = `clinics.niche`). Нет
  записи → 403 «Publishing is switched off» (HWC/aesthetics так выключены, решение 28.09). Yedino: IG `6ab468f5…`, Threads
  `6ab46922…`, `BUFFER_ACCESS_TOKEN_YEDINO`. HireDrop (клиника `261b5a34-…`): Buffer org `6ab46ada…`, IG `6ab57e4c…`,
  Threads `6ab57e68…`, TikTok `hiredrop1` `6ab73629…`, `BUFFER_ACCESS_TOKEN_HIREDROP` (в `.env.local` и Vercel prod).
- **HireDrop, куда что идёт:** карусели R2 → IG через `buffer_feed`; R3, Reels и Stories → прямой Meta (`meta_posts`,
  `DIRECT_META` в `lib/publish/meta-creds.ts`, `META_SYSTEM_USER_TOKEN`, igUserId `17841446093945559`, pg_cron
  `meta-publish` */5); TikTok — только видео, через `buffer_feed`; Threads — только личный текст, в очереди ничего.
- **`buffer_feed`** (062/063): pg_cron `buffer-feed` 16:30 UTC; free-план = 10 запланированных на канал; порядок держится
  по каналу (застрявшая строка держит все следующие на этом канале); просроченной строке время = сейчас + 1 ч.
  `buffer_ids` — id поста в Buffer по каналу; **`status` после выхода остаётся `scheduled`** — что вышло, знает только
  Buffer `post(input:{id}){status sentAt externalLink}`. 3 ошибки подряд → push админам.
- **Инструменты:** `node scripts/feed-video.mjs add|plan|list|drop|stories --brand hiredrop` (видео и сторис; контракт для
  чужих сессий — `docs/VIDEO-FEED.md`; `drop` ставит через день после последнего видео, 16:00 UTC). Прямой Meta —
  `docs/META-PUBLISH.md`. Карусели вне репо: `HireDrop Templates/R2/buffer-feed-enqueue.cjs` (постановка),
  `R2/buffer-swap-images.cjs` (перепривязка постов 1–10). Картинки — публичный бакет `hiredrop-posts` (проект CM
  `pscqjvkuqqmvmcbxdwtu`); после перерисовки — **новый префикс** (CDN отдаёт старое). Service key:
  `supabase projects api-keys --project-ref pscqjvkuqqmvmcbxdwtu`.
- **Форматы Buffer (проверены вживую):** картинка `{image:{url}}`; IG-карусель `type:'post'`; Threads `type:'post'` или
  `thread`; видео `{video:{url}}` — `thumbnailUrl` Buffer отвергает, обложка только `video.metadata.thumbnailOffset` (мс);
  `editPost` требует снова передать `metadata` с type. Instagram PNG через Meta не берёт → JPEG.
- **Ручной тик** (тот же SQL, что у pg_cron): `supabase link --project-ref pscqjvkuqqmvmcbxdwtu --yes` во временной папке →
  `supabase db query --linked "select net.http_post(... '/api/cron/buffer-feed' ... x-cron-key из app_secrets 'meta_publish_cron')"`,
  ответ — `net._http_response`.
- **Классификатор не даёт Claude:** писать секреты в Vercel, менять pg_cron, удалять посты в Buffer, ставить launchd;
  вставку в `meta_posts` иногда блокирует. Такое Игорь запускает сам через `!`.

## Последний заход
- 27.10 **TikTok через Buffer починен** (`7f39ec2`, в проде): из видео-ассета убран `thumbnailUrl`, `cover_url` для Buffer
  больше не читается (Reels берут обложку через Meta). С 22.10 строка `why-i-built-hiredrop` (единственная с обложкой)
  падала на каждом тике и держала все TikTok после себя.
- Просроченные ролики разнесены по одному в день, чтобы не вышли разом: 28.10 why-i-built-hiredrop, 29.10 hours-quote,
  30.10 word-stack, 31.10 pov-oneliner, 01.11 beat-sentence (16:00 UTC). Ручной тик → все 5 в Buffer `scheduled`,
  видео сверены. Следующий `drop` встанет на 03.11 (дата от последнего ролика).
- Ролик 20.10 glasses-card-challenge в TikTok вышел (`sent` 17:31 UTC) — первый живой TikTok; в `buffer_feed` он `scheduled`.
- 25.10 Instagram Stories через Meta (`a1690f6`, миграция 066): 11 сторис «My story» вышли 26.10 13:00–23:00 UTC.

## Находки
- [x] F1 TikTok через Buffer стоял с 22.10 (`thumbnailUrl`) → закрыто: `7f39ec2` + даты 28.10–01.11; живой выход — следующий шаг.
- [x] F2 Instagram Stories CM не публиковала → закрыто: `a1690f6` + миграция 066.
- [x] F3 Отчёт о сторис «My story» → закрыто 27.10: все 11 `published` с media id (`feed-video.mjs list`).
- [ ] F4 `buffer_feed.status` не узнаёт о выходе: `list` показывает вышедшие посты как `scheduled` (JobFlow 27.10 принял
  вышедший TikTok 20.10 за застрявший). Нужна сверка статуса с Buffer в тике или в `list` → хозяин: лейн publish.
- [ ] F5 Залп после простоя: когда канал стоит несколько дней, все просроченные строки получают одно время «сейчас + 1 ч» и
  выходят разом. 27.10 разнесено руками; в коде нужен шаг между просроченными на одном канале → хозяин: лейн publish.
- [ ] F6 Сторис «My story» добавить в «Актуальное» (только с телефона) → хозяин: Игорь.

## Сломано / не доделано
- **Threads без Buffer — ждёт «да» Игоря.** Путь через HelloMetrix (ветка `hiredrop-meta-publish`: OAuth, slug
  `threads-publish`): Игорь в приложении HelloMetrics `1467679217599442` включает «Access the Threads API», redirect
  `https://dashboard-hwc.vercel.app/api/auth/meta-publish/threads/callback`, HireDrop в Threads Testers,
  `THREADS_APP_ID/SECRET` в Vercel HelloMetrix, «да» на деплой → Claude берёт `threads` из HelloMetrix в `meta-creds.ts`.
  Системный токен Meta в `graph.threads.net` не принимается (190).
- Ветка Threads (`type:'thread'`) вживую не проверялась. Звук к видео через API не добавить — музыку вшивать в файл.
- В дереве чужой незакоммиченный `lib/render/html.ts` — не коммитить вслепую.

## Следующий шаг
28.10 после 16:00 UTC проверить, что TikTok why-i-built-hiredrop вышел (Buffer `post{status sentAt externalLink}` по `buffer_ids.tiktok`), потом взять F5 (шаг между просроченными); Opus.
