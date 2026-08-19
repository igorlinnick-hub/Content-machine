# Main — доступы, телепромтер + /videos, брендирование входа, фото для каруселей, бан тизер-фраз

Обновлено: 2026-08-19 · ветка: main

## Состояние
**Доступы.** Вход в прод (`content-machine-gules.vercel.app`) — ссылка `/c/<token>` или
memorable-код на экране входа, cookie на год. Выпуск/отзыв — только в UI `/clinics` →
`InstallLinkCard`. Роли: `doctor` (тонкая поверхность), `editor` (back-office). Клиник две,
обе HWC: Dr. Shawn `5065c6ee-7c4b-451b-8dee-3498eb3af674` (дефолт), Dr. Made
`cdb530e5-3ce9-4088-abee-117bc872e39a`. Коды/токены здесь намеренно НЕ записаны.

**Тексты скриптов и каруселей — бан клише как КАТЕГОРИИ (2026-08-19).** Игорь: «Here's
why that's already too late» — только пример, «там будут и другие такие клише». Правило
сформулировано как категория с тестом («сказал бы это спокойный врач одному пациенту через
стол?»), списки — примеры, не блоклист. Шесть категорий: тизер/announcer-строки (HARD),
strawman-зачины («Most people think…», «The standard story is…» — max 1), маркетинг/AI-филлер
(«game-changer», «unlock», «journey», «at the end of the day», «it's important to note»…),
антитеза-бантик («It's not X, it's Y» — max 1), rule-of-three абстрактных списков, wrap-up
после каждого бита. Где живёт: `lib/agents/writer.ts` — HARD-блок `NO CLICHÉS` в базовом
промпте (видео-скрипты, карусели, Refine), хук в LENGTH SPEC заканчивается фактом, из allowed
registers убрано «here's what most people miss»; `lib/agents/teaser-lines.ts` — два яруса
regex: `findTeaserLines()` (HARD → `hook_quality ≤ 3`, `approved=false`) и
`findClicheLines()` (SOFT → 1 шт. `tone_match ≤ 6`, ≥2 → `tone_match ≤ 4`, `approved=false`);
`lib/agents/critic.ts` подмешивает оба списка в бриф как DETECTED TEASER LINES / DETECTED
CLICHÉS и явно велено судить перефразы сверх скана; `docs/POST-CRAFT.md` — категории в banned
patterns. Refine-роут переписывает при `!approved`, generate — только при best < 6.0.
Детектор проверен на скрипте «How your face ages»: 2 тизера + 4 клише, на чистом тексте 0.
Downstream (splitter/slide-fixer) текст не переписывают — источник фраз только Writer.

**Запись телепромтера.** `1920×1080 @ 30fps` через `ideal` (не `max` — портретный поток
деградирует), битрейт от фактических `getSettings()` (~0.13 бит/пиксель/кадр, 4–12 Мбит/с),
H.264/mp4 первым приоритетом (VP9 на телефоне роняет кадры, mp4 играется в Drive без
ремукса). 1080p — сознательный потолок. С 2026-08-19 кнопка «Start Recording» в оверлее
заблокирована («Starting camera…»), пока нет стрима: на компе вебкам греется 1–3 с и
браузер спрашивает разрешение — доктор жал в чёрный экран, `beginRecording` молча пропускал
`startRecording()`, текст скроллился без записи. Теперь `startRecording()` возвращает
boolean, без записи скролл не стартует, есть `recorder.onerror`, при ошибке камеры — явная
кнопка «Read without recording».

**UI телепромтера.** Транспорт (перемотка/пауза/скорость/стоп) внизу, в зоне большого
пальца; отбивка от плавающей адресной строки Safari — `.tp-controls-safe` в `globals.css`.
Скорость по умолчанию 25.

**`/videos` — библиотека видео для врача** (`app/videos/*`). Табы Recordings
(`clinic_recordings` status=final) / Edited (`clips` status=cleaned; таб виден только при
наличии, открывается первым). Плеер — Drive-embed `…/file/<id>/preview`, read-only, «Open in
Drive». Карточка «My videos» на дашборде, «Watch all →» в телепромтере. Embed играет только
файлы с доступом по ссылке — новые получают его в `confirm` (`allowLinkView`), для старых
`POST /api/studio/recordings/fix-permissions`.

**Брендирование HWC.** `/install` и `/` в стиле клиники (источник — `HWC-Landing-pages/`,
`Pain & Joint Landing 3/index.html`). Ассеты `public/brand/`, Playfair через `next/font`,
токены `--hwc-*`. Правило: логотип и текст на сплошном белом, никогда на фото.

**Форма генерации скриптов** свёрнута до выбора темы; в плановом пути летит `planTopicId`,
текст инпута на сервер не уходит (одобрено 2026-08-13).

**Подбор фото для каруселей — доктрина v4** (2026-08-17): `ai` — только 3D-медрендеры и
гавайская природа (AI-людей нет вообще); `clinic` ~40% из Drive-библиотеки; `stock`
(Pexels) ≤2 на пост и только под предмет, которого у клиники нет. Обложка без фото.
Порядок clinic-фото — LRU с кулдауном 30 дней, кулдаун стартует после удачного compose
(`markPhotosUsed`). Служебный аккаунт `content-machine-sa@jobflow-491621.iam.gserviceaccount.com`
читает папку `HWC Pictures Google` (`120xEMg5Zl47ZpD6Bd8q5QodHFEdndzNK`), 137 файлов.

## Последний заход
- **Доктрина v4 проверена вживую и работает.** Тестовый пост
  `34883573-63c9-4638-854f-ffe4f3362f6a`: бриф `3 clinic / 3 ai / обложка
  fallback` (43% при цели 40%), три РАЗНЫХ файла, все три подписанные ссылки
  отдают настоящий JPEG (638–738 КБ, `image/jpeg`, HTTP 200).
- **Обе клиники проиндексированы по 137 фото**, ошибок ноль.
  ВАЖНО про роут: доктору он принудительно подставляет клинику ЕГО сессии и
  игнорирует переданный `clinicId`. Первый прогон шёл под докторской сессией
  Made — все 137 строк легли под Made, у Шона было пусто. Индексировать чужую
  клинику можно ТОЛЬКО админом.
- Коммиты сессии: `99f3a47` (основной), `c3824aa`, `f186ec5`, `e006312`,
  `36e029e`, `0378ae8`. Миграция 048 применена, обеим клиникам проставлен
  `photo_library_folder_id`, `NEXT_PUBLIC_APP_URL` добавлен в прод-env.
- Баги, найденные только в бою:
  1. `disabledHttpResponse()` без `await` → роут возвращал
     `Promise<Response | null>`, деплой упал. **Локальный `tsc --noEmit` это НЕ
     ловит** — проверка типов роутов живёт внутри `next build`.
  2. 15 фото из 137 — PNG по 20–28 МБ, vision-API режет base64 на 10 МБ.
     Свыше 7 МБ описывается уменьшенная копия (`thumbnailLink` с `=s1600`).
  3. Drive отдаёт thumbnail в исходном формате, а не JPEG → 400 на несовпадении
     media type. Тип читается по сигнатуре (`sniffImageMime`).
  4. `enforceMix` исключал 3D-рендеры из конвертации, а в v4 почти все слайды
     тела — рендеры, поэтому в посте оказывался ОДИН clinic-слайд вместо трёх.
     Теперь рендеры флипаются последними, но флипаются.
- Разовый сбой: у поста `9f0b6cce` `photo_brief` пустой — упал LLM-вызов брифа,
  сработал soft-fail в сплиттере. На следующих генерациях не повторилось.
- ГРАБЛИ песочницы: клиент `googleapis` виснет намертво на любом запросе (даже
  на `auth.authorize()`), обычный `fetch` работает — обход: подписать JWT
  сервисного аккаунта вручную (`crypto.createSign('RSA-SHA256')`). `npm run dev`,
  `next lint`, `git log` с pathspec и `git status` по чужим репозиториям тоже
  виснут. Читать `slide_sets.slides` удобнее всего PostgREST'ом с сервисным
  ключом из `~/Library/Application Support/HWC/canva-runner/env`.

## Сломано / не доделано
- **Compose в Canva с clinic-фото ни разу не прогонялся.** Сервер отдаёт
  `photo_url`, скилл раннера его ждёт, но живой сборки на таком посте не было.
  Это последняя непроверенная миля (~$18 и ~180 ходов за карусель).
- **Обложка.** Стили 1, 4 и Aesthetic требуют полноэкранного фото, и его
  выбирает раннер (Pexels/Flux), а не библиотека клиники. Причина
  архитектурная: `canva_style` проставляется отдельным PATCH ПОСЛЕ генерации,
  на момент сборки брифа сервер стиля не знает. Не регресс — так было и в v3.
- Остальные маршруты пикера (`/api/visual/photo-recommend`, `/photo-override`,
  `/photo-thumb/<id>`) по-прежнему не существуют — UI визуальных постов в этой
  части нерабочий. Каруселям они не нужны.
- `/install` вживую никто не видел: она за doctor-сессией.
- Чужие незакоммиченные хвосты в дереве, не тронуты: серверный рендер слайдов
  (`app/api/posts/[slideSetId]/render/`, `lib/render/`, `lib/photos/pexels.ts`,
  `lib/photos/resolve.ts`, `assets/fonts/*`, `scripts/render-preview.mts`,
  `pptest.mjs`, миграция 047) и clips-runner (`scripts/clips-runner/`,
  `app/api/clips/*`, `app/api/cron/clips-inbox/`, `lib/clips/ffmpeg.ts`,
  `next.config.mjs`, правка `HANDOFF-MODULES.md`).

## Следующий шаг
Прогнать `canva-compose-runner` на посте `34883573-63c9-4638-854f-ffe4f3362f6a`
и глазами проверить, что три фото клиники встали в слайды, а не подменились
стоком. После этого решить, чинить ли обложку под стили 1/4/Aesthetic.
