# Publish — Buffer, прямой Meta и Zernio по брендам

Обновлено: 2026-10-29 (поздно) · ветка: main

## Состояние
- **Бренды:** у каждого свой Buffer-ключ и каналы, реестр `lib/publish/buffer-accounts.ts` (ключ = `clinics.niche`). Нет
  записи → 403 «Publishing is switched off» (HWC/aesthetics так выключены, решение 28.09). Yedino: IG `6ab468f5…`, Threads
  `6ab46922…`, `BUFFER_ACCESS_TOKEN_YEDINO`. HireDrop (клиника `261b5a34-…`): Buffer org `6ab46ada…`, IG `6ab57e4c…`,
  Threads `6ab57e68…`, TikTok `hiredrop1` `6ab73629…`, `BUFFER_ACCESS_TOKEN_HIREDROP` (в `.env.local` и Vercel prod).
- **HireDrop, куда что идёт:** карусели R2 → IG через `buffer_feed`; R3, Reels и Stories → прямой Meta (`meta_posts`,
  `DIRECT_META` в `lib/publish/meta-creds.ts`, `META_SYSTEM_USER_TOKEN`, igUserId `17841446093945559`, pg_cron
  `meta-publish` */5); TikTok — только видео, через `buffer_feed`; Threads — только личный текст, через `buffer_feed` (план 1 ноября, 7 постов, в Buffer с 29.10).
- **`zernio_feed`** (067, `1e3f754`): X и LinkedIn HireDrop через Zernio. pg_cron `zernio-feed` 15:00 UTC отдаёт Zernio
  всё `pending` с `due_at` в ближайшие 14 дней; дальше ждёт в таблице. Опоздавшая строка сохраняет время дня и встаёт на
  ближайший день, где на канале нет поста ±20 ч (залпа, как в F5, не бывает). Документ LinkedIn без PDF не уходит, за 2 дня
  до срока шлёт push. Статус знает Zernio: `zernio-feed.mjs list` (спрашивает Zernio, даёт ссылку). Реестр аккаунтов —
  `lib/publish/zernio.ts` (по `clinics.niche`; ключ `ZERNIO_API_KEY`). Закрепить пост в X через API нельзя (pin только Facebook).
- **`buffer_feed`** (062/063): pg_cron `buffer-feed` 16:30 UTC; free-план = 10 запланированных на канал; порядок держится
  по каналу (застрявшая строка держит все следующие на этом канале); просроченной строке время = сейчас + 1 ч.
  `buffer_ids` — id поста в Buffer по каналу; **`status` в таблице после выхода остаётся `scheduled`** — что вышло, знает
  только Buffer. Поэтому «вышло ли в TikTok» смотреть через `feed-video.mjs list` (спрашивает Buffer, даёт ссылку), не SQL.
  3 ошибки подряд → push админам.
- **Инструменты:** `node scripts/zernio-feed.mjs plan|doc|list|move|drop|tick` (X/LinkedIn; `plan` отсекает X > 280 по весу X,
  X со ссылками — голый домен тоже ссылка, запрещённые слова бренда и slop; `tick` = ручной тик прода). `node scripts/feed-video.mjs add|plan|list|drop|stories --brand hiredrop` (видео и сторис; контракт для
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
- 29.10 поздно **F8: фид Zernio** (`1e3f754`): миграция 067 применена (таблица + pg_cron `zernio-feed` 15:00 UTC, проверено в
  `cron.job`), роут `/api/cron/zernio-feed` на проде (401 без ключа), `scripts/zernio-feed.mjs`. План 1 поставлен: X01–X04,
  X06, X07, L01–L03 в `zernio_feed` (`pending`; L03 `needs-pdf`). X05 отсеян проверкой. Ручной тик прода → «`ZERNIO_API_KEY`
  is not set»: ключа в Vercel нет, это шаг Игоря.
- 29.10 **`list` спрашивает Buffer** (`5105c02`): TikTok-строки показывают реальный статус и ссылку на ролик, ещё не отданные
  в Buffer — `pending`. Повод: Игорь спросил «в TikTok видео выходят или как?», а таблица говорила `scheduled` про вышедшие.
  Вживую в TikTok вышли 20.10 glasses-card-challenge, 28.10 why-i-built-hiredrop, 29.10 broll-hours-quote.
- 27.10 **TikTok через Buffer починен** (`7f39ec2`): из видео-ассета убран `thumbnailUrl` (Buffer его отвергает); с 22.10
  строка с обложкой падала на каждом тике и держала все TikTok после себя. Просроченные разнесены по одному в день:
  30.10 word-stack, 31.10 pov-oneliner, 01.11 beat-sentence; следующий `drop` встанет на 03.11.
- 25.10 Instagram Stories через Meta (`a1690f6`, миграция 066): 11 сторис «My story» вышли 26.10.

## Находки
- [x] F1 TikTok через Buffer стоял с 22.10 (`thumbnailUrl`) → закрыто: `7f39ec2` + даты 28.10–01.11; вышел вживую 28.10 16:07 UTC
  (https://tiktok.com/@hiredrop1/video/7701750487955016974).
- [x] F2 Instagram Stories CM не публиковала → закрыто: `a1690f6` + миграция 066.
- [x] F3 Отчёт о сторис «My story» → закрыто 27.10: все 11 `published` с media id (`feed-video.mjs list`).
- [x] F4 `list` показывал вышедшие TikTok как `scheduled` → закрыто 29.10: `list` спрашивает статус и ссылку у Buffer
  (сама таблица `buffer_feed.status` по-прежнему остаётся `scheduled` — смотреть через `list`, не SQL).
- [ ] F5 Залп после простоя: когда канал стоит несколько дней, все просроченные строки получают одно время «сейчас + 1 ч» и
  выходят разом. 27.10 разнесено руками; в коде нужен шаг между просроченными на одном канале → хозяин: лейн publish.
- [ ] F6 Сторис «My story» добавить в «Актуальное» (только с телефона) → хозяин: Игорь.
- [x] F7 API-ключ Buffer HireDrop истекал 02.11 (не 03.11) → закрыто 29.10: Claude перевыпустил его сам через Safari
  (publish.buffer.com/settings/api → ⋯ → Regenerate, срок **1 год, до 29.10.2027**; free-план = 1 ключ, «New Key» не даёт),
  ключ взят кнопкой «Copy key» (в окне выпуска поле маскировано `•`), записан в `.env.local` и Vercel prod
  (`npx vercel env rm/add`, CLI залогинен), прод пересобран `vercel redeploy`; health → instagram/threads/tiktok connected.
- [ ] F8 **Выпуск HireDrop в LinkedIn и X через Zernio** → код, таблица, cron и план 1 готовы 29.10 (`1e3f754`, см. Состояние).
  Осталось: (1) Игорь кладёт `ZERNIO_API_KEY` в Vercel prod (команда в «Следующем шаге»); (2) Claude: пустой коммит + push
  (редеплой, чтобы env подхватился) → `zernio-feed.mjs tick` → `list`: 8 строк `scheduled` в Zernio, L03 `needs-pdf`. Без
  ключа к cron 30.10 15:00 UTC X01 сам сдвинется на 31.10 17:00 UTC → хозяин: Игорь (ключ), затем лейн publish.
- [ ] F9 **X05 не проходит в X**: 4 голых домена (`boards.greenhouse.io` и др.) X делает ссылками → 283 из 280 по весу X и
  $0.20 за пост. Не поставлен. Переписать (напр. поисковую строку картинкой или без доменов) и `zernio-feed.mjs plan … --plan 1`
  (стоящие пропустит). Срок — до 09.11 → хозяин: лейн hiredrop-social (F16 там).
- [ ] F10 X01 (30.10) закрепить в профиле `@hiredrop_io` руками после выхода — API X закреплять не умеет → хозяин: Игорь.
- [ ] F11 Время X/LinkedIn (7:00 и 6:00 HST) — если в первый час отвечает Игорь, сдвинуть: `zernio-feed.mjs move <source> <iso>`
  двигает и в Zernio → хозяин: Игорь (решение, hiredrop-social F5/F15), команда — любой лейн.

## Сломано / не доделано
- **Threads без Buffer — ждёт «да» Игоря.** Путь через HelloMetrix (ветка `hiredrop-meta-publish`: OAuth, slug
  `threads-publish`): Игорь в приложении HelloMetrics `1467679217599442` включает «Access the Threads API», redirect
  `https://dashboard-hwc.vercel.app/api/auth/meta-publish/threads/callback`, HireDrop в Threads Testers,
  `THREADS_APP_ID/SECRET` в Vercel HelloMetrix, «да» на деплой → Claude берёт `threads` из HelloMetrix в `meta-creds.ts`.
  Системный токен Meta в `graph.threads.net` не принимается (190).
- Ветка Threads (`type:'thread'`) вживую не проверялась. Звук к видео через API не добавить — музыку вшивать в файл.
- В дереве чужой незакоммиченный `lib/render/html.ts` — не коммитить вслепую.

## Следующий шаг
**Игорь (один раз, через `!`):**
`! cd ~/Code/Content-machine && grep '^ZERNIO_API_KEY=' .env.local | cut -d= -f2- | tr -d '"\n' | vercel env add ZERNIO_API_KEY production`
Затем Claude: `git commit --allow-empty -m "chore: redeploy for ZERNIO_API_KEY"` + push → дождаться деплоя → `node scripts/zernio-feed.mjs tick`
→ `list` (8 `scheduled`, ссылки после выхода). 31.10: X01 вышел? (`list`), напомнить Игорю закрепить (F10). F7 (токен Buffer до
03.11). Потом F5: в `app/api/cron/buffer-feed/route.ts` разносить просроченные по образцу `zernio-feed` (время дня + ±20 ч). Opus.
