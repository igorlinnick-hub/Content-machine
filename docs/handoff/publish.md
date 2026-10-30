# Publish — Buffer, прямой Meta и Zernio по брендам

Обновлено: 2026-10-30 22:55 UTC · ветка: main

## Состояние
- **Бренды Buffer:** у каждого свой ключ и каналы, реестр `lib/publish/buffer-accounts.ts` (ключ = `clinics.niche`). Нет
  записи → 403 «Publishing is switched off» (HWC/aesthetics так выключены, решение 28.09). Yedino: IG `6ab468f5…`, Threads
  `6ab46922…`, `BUFFER_ACCESS_TOKEN_YEDINO`. HireDrop (клиника `261b5a34-…`): Buffer org `6ab46ada…`, IG `6ab57e4c…`,
  Threads `6ab57e68…`, TikTok `hiredrop1` `6ab73629…`, `BUFFER_ACCESS_TOKEN_HIREDROP` (в `.env.local` и Vercel prod; ключ
  перевыпущен 29.10, годен до 29.10.2027).
- **HireDrop, куда что идёт:** карусели R2 → IG через `buffer_feed`; R3, Reels и Stories → прямой Meta (`meta_posts`,
  `DIRECT_META` в `lib/publish/meta-creds.ts`, `META_SYSTEM_USER_TOKEN`, igUserId `17841446093945559`, pg_cron
  `meta-publish` */5); TikTok — только видео, `buffer_feed`; Threads — только личный текст, `buffer_feed` (план 1 ноября,
  7 постов, в Buffer с 29.10); **X и LinkedIn — `zernio_feed` → Zernio.**
- **`zernio_feed`** (миграция 067, `1e3f754`): строка = пост на один канал (`x` | `linkedin`). pg_cron `zernio-feed` 15:00 UTC
  → `/api/cron/zernio-feed` отдаёт Zernio всё `pending` с `due_at` в ближайшие 14 дней; дальше ждёт в таблице (план можно
  править). Опоздавшая строка сохраняет время дня и встаёт на ближайший день без поста на канале ±20 ч — залпа нет.
  Документ LinkedIn (`document_title` без `media_urls`) не уходит, за 2 дня до срока — push. Ошибки → push «Zernio feed».
  Статус знает Zernio, не таблица: смотреть `zernio-feed.mjs list`. Реестр аккаунтов — `lib/publish/zernio.ts` (по
  `clinics.niche`; HireDrop: LinkedIn-страница `6ae2fabade937bee78ca5fe2`, X `@hiredrop_io` `6ae3be7d8b995bed0a88a935`;
  ключ `ZERNIO_API_KEY`). API Zernio: https://zernio.com/openapi.json; `scheduledFor` в прошлом = публикация сразу (код такое
  не шлёт); закрепить в X через API нельзя (pin только Facebook); X стоит $0.015 за пост, $0.20 со ссылкой, лимит $2/мес.
- **`buffer_feed`** (062/063): pg_cron `buffer-feed` 16:30 UTC; free-план = 10 запланированных на канал; порядок держится
  по каналу (застрявшая строка держит следующие); просроченной строке время = сейчас + 1 ч (F5). `status` после выхода
  остаётся `scheduled` — правду знает Buffer: `feed-video.mjs list`, не SQL. 3 ошибки подряд → push.
- **Инструменты:**
  - `node scripts/zernio-feed.mjs plan <plan.json> --brand hiredrop [--plan N] [--dry] [--force]` — X/LinkedIn из плана
    (стоящие пропускает; отсекает X > 280 по весу X, X со ссылками — голый домен тоже ссылка, запреты бренда, slop);
    `doc <source> <pdf>` (заливает PDF в бакет, отпускает документ), `list`, `move <source> <iso>` (и в Zernio),
    `drop <source>` (и в Zernio), `tick` (ручной тик прода).
  - `node scripts/feed-video.mjs add|plan|list|drop|stories --brand hiredrop` — видео и сторис (контракт — `docs/VIDEO-FEED.md`).
  - Прямой Meta — `docs/META-PUBLISH.md`. Карусели вне репо: `HireDrop Templates/R2/buffer-feed-enqueue.cjs`.
  - Картинки/PDF — публичный бакет `hiredrop-posts` (проект `pscqjvkuqqmvmcbxdwtu`); после перерисовки — **новый префикс**
    (CDN отдаёт старое). Service key: `supabase projects api-keys --project-ref pscqjvkuqqmvmcbxdwtu`.
- **Форматы Buffer (проверены вживую):** картинка `{image:{url}}`; IG-карусель `type:'post'`; Threads `type:'post'`/`thread`;
  видео `{video:{url}}` без `thumbnailUrl` (обложка — `video.metadata.thumbnailOffset`); `editPost` требует `metadata` с type.
- **Ручной тик buffer-feed:** `supabase link --project-ref pscqjvkuqqmvmcbxdwtu --yes` во временной папке →
  `supabase db query --linked "select net.http_post(... '/api/cron/buffer-feed' ... x-cron-key из app_secrets 'meta_publish_cron')"`.
- **Классификатор не даёт Claude:** писать секреты в Vercel без прямого «сам» Игоря (29.10 отказ на `ZERNIO_API_KEY`;
  30.10 с его разрешением ключ лёг), удалять посты в Buffer, ставить launchd. Миграцию с pg_cron (067) через `supabase db query` 29.10 пропустил. Редеплой без env — пустой коммит + push.
- **`vercel` нет в PATH шелла** (`command not found`) — только `npx --yes vercel …`.

## Последний заход
- 30.10 22:54 UTC: `zernio-feed.mjs list` — **X01 вышел** 30.10 17:00 UTC, ссылка есть; X02–X04, X06, L01, L02 `scheduled`;
  L03 `needs-pdf`; X07 `pending` (горизонт 14 дней, уйдёт cron 31.10 15:00 UTC). Cron 30.10 15:00 UTC — `succeeded`. F8 закрыт.
- Раньше (29–30.10): фид Zernio (`1e3f754`: миграция 067, роут, `zernio.ts`, `zernio-feed.mjs`), ключ в Vercel, 7 постов плана 1
  приняты Zernio. git упал на лицензии Xcode (F13), обход — `DEVELOPER_DIR` на Command Line Tools.

## Находки
- [x] F1 TikTok через Buffer стоял с 22.10 (`thumbnailUrl`) → закрыто: `7f39ec2`; вышел вживую 28.10.
- [x] F2 Instagram Stories CM не публиковала → закрыто: `a1690f6` + миграция 066.
- [x] F3 Отчёт о сторис «My story» → закрыто 27.10: все 11 `published`.
- [x] F4 `list` показывал вышедшие TikTok как `scheduled` → закрыто 29.10: `list` спрашивает Buffer (`5105c02`).
- [ ] F5 Залп после простоя в `buffer_feed`: все просроченные строки канала получают одно «сейчас + 1 ч» и выходят разом.
  Образец решения уже есть в `zernio-feed` (время дня + шаг сутки, ±20 ч) → хозяин: лейн publish.
- [ ] F6 Сторис «My story» добавить в «Актуальное» (только с телефона) → хозяин: Игорь.
- [x] F7 Ключ Buffer HireDrop истекал 02.11 → закрыто 29.10: перевыпущен до 29.10.2027, в `.env.local` и Vercel prod.
- [x] F8 X и LinkedIn HireDrop через Zernio → закрыто 30.10: X01 вышел 30.10 17:00 UTC
  (https://twitter.com/i/web/status/2116213981383647659), cron `zernio-feed` 30.10 15:00 UTC `succeeded`.
- [ ] F9 **X05 не проходит в X**: 4 голых домена (`boards.greenhouse.io`…) X делает ссылками → 283 из 280 по весу и $0.20.
  Не поставлен. Переписать и `zernio-feed.mjs plan … --plan 1` (стоящие пропустит), до 09.11 → хозяин: лейн hiredrop-social (F16).
- [x] F10 Закреп в X `@hiredrop_io` → закрыто 30.10: Игорь закрепил сам (X01 — единственный вышедший).
- [x] F11 X/LinkedIn выходят в 7:00 и 6:00 HST → закрыто 29.10: Игорь «пусть идут как есть», время не двигаем
  (hiredrop-social F5/F15).
- [ ] F12 Первый пост LinkedIn через Zernio (L01, 05.11 16:00 UTC, с первым комментарием-источником) вживую ещё не выходил →
  06.11 `zernio-feed.mjs list`: `published` + ссылка, комментарий на месте → хозяин: лейн publish.
- [x] F13 git на маке без лицензии Xcode (Xcode.app обновился 29.10, `xcode-select` смотрит в него → exit 69) → закрыто 30.10:
  обход `DEVELOPER_DIR=/Library/Developer/CommandLineTools git …`. Xcode в планах Игоря — **xcode-select не переключать,
  лицензию не принимать за него**: примет сам при первом запуске Xcode.

## Сломано / не доделано
- git без лицензии Xcode (F13): работать через `DEVELOPER_DIR=/Library/Developer/CommandLineTools git …`.
- **Threads без Buffer — ждёт «да» Игоря.** Путь через HelloMetrix (ветка `hiredrop-meta-publish`: OAuth, slug
  `threads-publish`): Игорь в приложении HelloMetrics `1467679217599442` включает «Access the Threads API», redirect
  `https://dashboard-hwc.vercel.app/api/auth/meta-publish/threads/callback`, HireDrop в Threads Testers,
  `THREADS_APP_ID/SECRET` в Vercel HelloMetrix, «да» на деплой → Claude берёт `threads` из HelloMetrix в `meta-creds.ts`.
- Threads `type:'thread'` вживую не проверялся. Звук к видео через API не добавить — музыку вшивать в файл.
- В дереве чужие незакоммиченные `lib/render/html.ts`, `scripts/buffer-post.mjs`, хендоффы main/yedino — не коммитить вслепую.

## Следующий шаг
31.10 после 15:00 UTC — `zernio-feed.mjs list`: X07 `scheduled`. 06.11 — L01 вышел с комментарием (F12). По желанию ~12.11
предложить перезакрепить лучший из X03/X06. Между делом F5 в `app/api/cron/buffer-feed/route.ts` по образцу
`zernio-feed`. git — через `DEVELOPER_DIR` (F13). Новой сессией, Opus.
