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
- Строки `clinics` с `niche='hiredrop'` ещё нет — без неё реестр HireDrop не сработает.
- Не закоммичено. В дереве лежит чужой незакоммиченный `lib/render/html.ts` — его не коммитить вслепую.

- Файлы 03.10: `lib/publish/buffer-accounts.ts` (каналы hiredrop), `app/api/publish/buffer/route.ts`
  (assets → `{ image: { url } }`), `.env.local` (`BUFFER_ACCESS_TOKEN_HIREDROP`); вне репо — `R2/buffer-schedule.cjs`,
  `R2/buffer-scheduled.json`, `R2/to-drive.cjs`. Ничего не закоммичено.

## Следующий шаг
Ничего не ждёт: посты 1–10 выйдут сами до 21.10. После — либо Игорь постит 11–36 руками (папки «manual»
на диске), либо `buffer-schedule.cjs 11 20 …` по мере освобождения слотов. Роут Content Machine
(`app/api/publish/buffer`) для HireDrop не задействован — нужна строка `clinics` niche=`hiredrop`.
