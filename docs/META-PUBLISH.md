# Прямой постинг в Instagram + Threads (Graph API) — контракт CM ↔ HelloMetrix

Введено 2026-10-05. Buffer остаётся рабочим, это второй канал без лимита 10 постов в очереди.

## Кто что делает

| | Content Machine (готово) | HelloMetrix (задача его сессии) |
|---|---|---|
| OAuth «Разрешить», хранение токенов, продление | — | ✅ его Meta-приложение |
| Очередь постов, публикация, повторы, алерты | ✅ `meta_posts` + `/api/cron/meta-publish` | — |
| Расписание | ✅ pg_cron в Supabase CM, раз в 5 мин (Vercel Hobby так не умеет) | — |

CM спрашивает токены у HelloMetrix прямо перед каждой публикацией — у себя их не хранит.

## Контракт (HelloMetrix должен отдать)

```
GET {HELLOMETRIX_API_URL}/api/cm/meta-publish-creds?clientId=<hellometrix client id>
Authorization: Bearer ${CM_API_KEY}            // тот же ключ, что у /api/cm/recent-posts

200 {
  "instagram": { "igUserId": "1784…", "accessToken": "…", "graphHost": "graph.facebook.com" } | null,
  "threads":   { "userId": "…",       "accessToken": "…" } | null
}
401 — неверный ключ; 404 — клиента нет.
```

- `graphHost`: `graph.facebook.com`, если токен от Facebook Login (как сейчас в HelloMetrix — через страницу),
  или `graph.instagram.com`, если от Instagram Login. Эндпоинты публикации у обоих одинаковые.
- Токены должны быть живые: HelloMetrix продлевает их сам (оба живут 60 дней) и сам шумит, если продление упало.
- Сеть, которой нет, = `null` → CM помечает такие посты `failed` с понятной ошибкой.

## Бриф для сессии HelloMetrix

1. **Instagram, права на публикацию** в существующем Meta-приложении HelloMetrix. Один из двух путей:
   - Facebook Login (как сейчас): добавить `instagram_content_publish` (+ `pages_show_list`,
     `pages_read_engagement`, `business_management`). Нужно, чтобы IG `hiredrop.io` был привязан к странице Facebook.
   - Instagram Login (use case «Instagram API»): `instagram_business_basic` + `instagram_business_content_publish`.
     Страница Facebook не нужна. Тогда `graphHost = graph.instagram.com`.
   Существующий read-only коннектор `meta` у HWC не ломать — права публикации отдельным подключением.
2. **Threads**: добавить use case «Access the Threads API» (если в это приложение нельзя — отдельное
   Threads-приложение). Права `threads_basic`, `threads_content_publish`. Аккаунт `hiredrop.io` добавить в
   тестеры Threads (App roles), пока приложение в Development mode. OAuth: `threads.net/oauth/authorize` →
   short-lived → `th_exchange_token` (60 дней) → продление `th_refresh_token`.
3. App Review не нужен: свои аккаунты, у Игоря роль в приложении.
4. Клиент HireDrop в HelloMetrix (создать, если нет). Игорь один раз жмёт «Разрешить» для Instagram и для Threads.
5. Эндпоинт по контракту выше + ежедневное продление токенов с алертом при сбое.
6. **Вернуть в Content Machine**: `clientId` HireDrop в HelloMetrix → CM пропишет его в
   `clinics.hellometrix_client_id` для клиники HireDrop `261b5a34-8584-405c-aa52-b55dfbd0fa09`.

## Как работает сторона CM

- Очередь: `meta_posts` (миграция 060) — строка = один пост в одну сеть в одно время: `caption`, `image_urls`
  (публичные URL; **для Instagram только JPEG**), `publish_at`, `status`, `source` (метка, напр. `hiredrop:P11`,
  уникальна на клинику+сеть — дважды не встанет).
- Тик: pg_cron (`061`) раз в 5 мин дергает `POST /api/cron/meta-publish` с `x-cron-key` из `app_secrets`.
  Берёт до 4 созревших постов, захватывает строку (`publishing`), создаёт контейнер, сохраняет `container_id`,
  публикует, пишет `permalink`.
- Повторы: временные ошибки Meta (5xx, rate limit) → назад в `scheduled`, до 5 попыток. Постоянные (токен,
  права, битая картинка) → сразу `failed` + push админам. Упавший посреди публикации тик подхватывается через
  15 мин, и сначала проверяется, не опубликован ли уже контейнер (`PUBLISHED`) — дублей нет.
- Ручной прогон: `curl -X POST …/api/cron/meta-publish -H "Authorization: Bearer $CRON_SECRET"`.
