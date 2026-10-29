# HireDrop social — что выходит в Threads, LinkedIn и X

Обновлено: 2026-10-29 (поздно) · ветка: main

## Состояние
- Лейн = **содержание** текстовых площадок HireDrop: Threads, LinkedIn, X. Профили и канал — лейн `hiredrop-content.md`;
  код выпуска (фид Zernio, cron) — лейн `publish.md` F8. Instagram и TikTok — своя очередь.
- **Решения Игоря:** 28.10 — LinkedIn только страница HireDrop («we»), форматы 11–12 в ноябре не ставим, HireDrop в постах
  не называем, X только бесплатный, копию P14 в Threads снять. 29.10 — «все берём» (тексты как написаны, тон A);
  «не просто выставлять, а план на 2 недели и cron, как с инст» (выпуск только через фид); **«да» на план 1**.
- **Ноябрь** — вкладка «Ноябрь: план и тексты» в доке https://claude.ai/artifact/CB4NfGq5ebGRVW3Q7ssjsu (id
  `5a7c0abb-4406-44c2-afb4-eea65abf6fe0`, tab `b8cb7bfb-8f6f`, body `e2f3f76d-dd1d`, rev 33): календарь с колонкой
  «Решение» (enum `f1c858df-5248`), тексты по площадкам, запас на декабрь, таблица «Решения Игоря».
  - **План 1 = 30.10–13.11, одобрен.** Threads: 7 постов `hiredrop:threads-T01…T07` в `buffer_feed` → ручной тик 29.10 →
    все `scheduled` в Buffer (первый 30.10 23:00 UTC, проверен `buffer-post.mjs show`). X (7) и LinkedIn (3, из них
    документ 12.11) стоят в `zernio_feed` с 29.10 (X05 отсеян, F16), уйдут в Zernio после ключа в Vercel.
  - План 2 = 16.11–29.11, 15 постов (документ 19.11) — черновик; 11.11 сверить с откликом на план 1 и прислать на «да».
  - Время: Threads 23:00 UTC, X 17:00 UTC, LinkedIn 16:00 UTC (по HST 13:00 / 7:00 / 6:00; Игорь на Гавайях).
- **Машинный источник:** `~/Code/HireDrop Templates/social/plan-2026-11.json` (не в git; `id`, `plan`, `platform`, `format`,
  `due_at`, `text`, `threads_topic`, `pin`, `first_comment`, `document_pages`). Правки Игоря в доке переносить туда до
  постановки. Threads плана ставит `social/queue-threads.mjs <план> [--dry]` (пропускает уже стоящие), дальше cron 16:30 UTC
  или ручной тик (`publish.md`). X и LinkedIn: `node scripts/zernio-feed.mjs plan <plan.json> --brand hiredrop --plan N [--dry]`
  из репо CM (проверяет вес X со ссылками, запреты LinkedIn, slop; cron 15:00 UTC отдаёт Zernio на 14 дней вперёд), статус — `list`.
- Проверки: все 34 текста чисто прошли `slop-check`; Threads ≤ 500, X ≤ 280 по правилам X (→ = 2 знака); на LinkedIn нет
  LinkedIn / Easy Apply / auto-apply / HireDrop; в X без ссылок. `buffer_feed` шлёт в Threads один текст, без цепочек.
  Карусели P01–P36 для документов LinkedIn не годятся (автоподача, HireDrop) — документы рисуются заново.
- Источники цифр: FTC $220 млн (https://www.ftc.gov/node/86951), Greenhouse 18–22% ghost jobs
  (https://www.fox5ny.com/news/ghost-jobs-greenhouse-analysis), «3 из 4 топ-постов remote job» — наш разбор Threads 11.10.
- Threads-канал Buffer `6ab57e68ea19ca0bdeda5dd4`; клиника HireDrop `261b5a34-8584-405c-aa52-b55dfbd0fa09`. Отчёты ботов
  (LX-01…30) — `~/Code/HireDrop Templates/social/`; сборщик рынка — `threads-research/`.

## Последний заход
- 29.10: календарь и 34 текста в доке; F2–F4, F11 закрыты; месяц разбит на два плана по 2 недели; требование «фид + cron»
  вписано в `publish.md` F8. После «да» Игоря поставил Threads плана 1 в `buffer_feed`, ручной тик → 7 постов в Buffer.
- Трогал: этот файл, `publish.md` (F8, Состояние, Следующий шаг), `hiredrop-content.md` (F8, F14), вкладку «Ноябрь»,
  новые `~/Code/HireDrop Templates/social/plan-2026-11.json` и `queue-threads.mjs`, строки `buffer_feed`. Код CM не трогал.
  Не закоммичено.

## Находки
- [ ] F1 Threads молчал с 07.10 → план 1 в Buffer с 29.10; закрыть после выхода T01 30.10 23:00 UTC → хозяин: этот лейн.
- [x] F2 Формат 6 → закрыто 29.10: оба домена Greenhouse.
- [x] F3 Формат 10 → закрыто 29.10: тезис «вакансия без вилки зарплаты», без нашей цифры.
- [x] F4 «40 applications» → закрыто 29.10: убрано из 14 и из документа 2.
- [x] F5 Кто отвечает на посты-вопросы в первый час → закрыто 29.10: Игорь «пусть идут как есть», никто не отвечает.
- [x] F6 Факты для 11/12 → закрыто 28.10. · [x] F7 Голос LinkedIn → закрыто 28.10. · [x] F8 Отчёты ботов → закрыто.
- [x] F9 Копия P14 вышла в Threads 29.10 16:00 UTC → закрыто 29.10: Игорь «забей», оставляем.
- [ ] F10 Зарплата 13% против 17,8% → в ноябре без цифры; перемер `measure_salary_fill.py` → хозяин: лейн hiredrop-content.
- [x] F11 Ротация под Premium/личный профиль → закрыто 29.10 календарём.
- [ ] F12 Источник первым комментарием на LinkedIn (Zernio `platformSpecificData.firstComment`) → закрыть после поста 05.11 → хозяин: этот лейн.
- [ ] F13 PDF документа 1 «Rejection emails, translated» (7 стр., радужный скин `R4/rainbow.css`, без CTA) нужен к 10.11 для
  поста 12.11; документ 2 к 17.11. Тексты — `document_pages` в `plan-2026-11.json`. Строка L03 уже стоит (`needs-pdf`), PDF
  цепляется так: `node scripts/zernio-feed.mjs doc hiredrop:linkedin-L03 <file.pdf> --brand hiredrop [--title "…"]` (заливает в
  бакет и отпускает строку; без PDF за 2 дня до срока — push) → хозяин: этот лейн.
- [ ] F14 Фид Zernio + cron на 2 недели для X и LinkedIn → 29.10 фид готов, план 1 стоит в `zernio_feed` (X01–X04, X06, X07,
  L01–L03); уйдёт в Zernio, когда Игорь положит `ZERNIO_API_KEY` в Vercel (`publish.md` F8) → хозяин: лейн publish.
- [ ] F16 **X05 отсеян фидом**: X делает ссылками голые домены (`boards.greenhouse.io`, `jobs.lever.co`…) → вес 283 из 280 и
  $0.20 за пост. «≤ 280» в плане считалось без ссылок. Переписать X05 (без доменов или строкой поиска на картинке), поправить
  `plan-2026-11.json` и `node scripts/zernio-feed.mjs plan "<plan.json>" --brand hiredrop --plan 1` (стоящие пропустит). До 09.11
  → хозяин: этот лейн.
- [x] F15 Время X/LinkedIn под ответы Игоря → закрыто 29.10: не сдвигаем, отвечать никто не будет (F5).

## Сломано / не доделано
- X и LinkedIn плана 1 стоят в `zernio_feed`, но в Zernio не уйдут без `ZERNIO_API_KEY` в Vercel (F14). Если ключа не будет к
  30.10 15:00 UTC, X01 сам сдвинется на 31.10 17:00 UTC.
- Токен Buffer HireDrop истекает 03.11 (`publish.md` F7): Threads плана 1 уже в Buffer и выйдет, но план 2 без нового токена не встанет.
- `~/.claude/scripts/sessions.py` нет — лейн на доске сессий не заведён, только этот файл.

## Следующий шаг
F13: нарисовать PDF документа 1 (7 страниц из `document_pages`, R4 радуга, 1080×1350 → PDF) к 10.11 и отдать лейну publish;
затем документ 2. 31.10 проверить, что T01 вышел (F1). 11.11 — сверка плана 2 с откликом, «да» Игоря, `queue-threads.mjs 2` и `zernio-feed.mjs plan … --plan 2`. До 09.11 — F16 (X05).
Новой сессией, Opus.
