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
- Бан клише как категории (тизеры HARD + 5 мягких категорий): `lib/agents/writer.ts`,
  новый `lib/agents/teaser-lines.ts` (два яруса), `lib/agents/critic.ts`,
  `docs/POST-CRAFT.md` (см. Состояние). Полный `tsc --noEmit` чистый (exit 0). Не
  закоммичено, не задеплоено — в проде старый промпт.
- Ранее в тот же день (другая сессия): desktop-фикс «Not recording» в `TeleprompterView`,
  страница `/videos` + карточка на дашборде — закоммичены (`7538b79`, `2224a96`), вживую
  не проверены.
- Дерево смешанное от параллельных сессий (серверный рендер слайдов `lib/render/`,
  `app/api/posts/[slideSetId]/render/`, clips-runner, шрифты, `pexels.ts`, миграция 047,
  `pptest.mjs`) — коммитить только свои файлы точечно.
- ГРАБЛИ машины: `next dev`, `next lint` на 8 ГБ виснут/таймаутят; полный `tsc` сегодня
  прошёл, но при параллельных процессах лучше отдельный tsconfig с `include`.

## Сломано / не доделано
- Бан клише не прогнан на живой генерации — нужно сгенерировать 1–2 скрипта и убедиться,
  что Writer не выдаёт тизеры/филлер, а Critic цитирует найденное и роняет approved.
  Возможный побочный эффект: больше `!approved` → чаще rewrite в refine-роуте (дороже).
- Телепромтер-фикс и `/videos` не видели вживую — ни на компе, ни на телефоне.
- Сквозной прогон доктрины v4 не проверен: ни одного поста с `source:"clinic"` ещё не
  собрано; библиотека Made не проиндексирована.
- `/api/visual/photo-recommend`, `/photo-override`, `/photo-thumb/<id>` не существуют —
  UI визуальных постов в этой части нерабочий; каруселям не нужны.
- `/install` вживую никто не видел (за doctor-сессией).

## Следующий шаг
Закоммитить точечно `lib/agents/writer.ts`, `lib/agents/teaser-lines.ts`,
`lib/agents/critic.ts`, `docs/POST-CRAFT.md`, `docs/handoff/*` как
`feat(writer): ban clichés — teaser lines, strawman openers, marketing filler`, запушить, на проде сгенерировать один скрипт и
проверить отсутствие тизер-фраз. Затем — Vercel-preview проверка телепромтера с компа
(Start серая 1–3 с → красная → `REC 0:00`) и `/videos` с телефона под доктором.
