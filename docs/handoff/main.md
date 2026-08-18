# Main — доступы, телепромтер, брендирование входа, подбор фото для каруселей

Обновлено: 2026-08-17 · ветка: main

## Состояние
**Доступы.** Вход в прод (`content-machine-gules.vercel.app`) — два эквивалентных
способа на одну сессию (cookie на год): ссылка `/c/<token>` и memorable-код на
экране входа. Выпуск и отзыв — только в UI: `/clinics` → клиника →
`InstallLinkCard`. Роли: `doctor` (тонкая поверхность) и `editor` (полный
back-office). Клиник в проде две, обе «Hawaii Wellness Clinic», различаются
доктором: Dr. Shawn (TMS / Ketamine) `5065c6ee-7c4b-451b-8dee-3498eb3af674`,
дефолтная; Dr. Made (Botox / Fillers) `cdb530e5-3ce9-4088-abee-117bc872e39a`.
Коды и токены намеренно НЕ записаны здесь — смотреть в `/clinics`.

**Запись телепромтера.** Просим `1920×1080 @ 30fps` через `ideal` (не `max` —
иначе портретный поток 1080×1920 упирается в ограничение по высоте и
деградирует), битрейт считается от фактических `track.getSettings()`: ~0.13
бит/пиксель/кадр, потолок 4–12 Мбит/с, на 1080p30 выходит ~8 Мбит/с. Кодек —
H.264/mp4 первым приоритетом: VP9 на телефоне кодируется программно и на 1080p+
роняет кадры, а mp4 ещё и играется в Drive без ремукса. 1080p — сознательный
потолок: Instagram всё равно пережимает, а 4K давал файл ×4 и черновик сверх
квоты Safari. Проверено на телефоне 2026-08-13: бейдж `1080p·30 · 8.1 Mbps`.

**UI телепромтера.** Кнопки перемотки/паузы/скорости/стоп внизу, в зоне
большого пальца (сверху статус-бейджи и Done). Нижний бар отбивается от
плавающей адресной строки Safari через `.tp-controls-safe` в `globals.css` —
`safe-area-inset` её не учитывает: во вкладке браузера запас 5rem, в
установленном PWA только системный inset. Рамка скрипта на setup-экране 55vh,
дефолтная скорость прокрутки 25.

**Брендирование HWC.** `/install` и `/` одеты в фирменный стиль клиники,
источник — `~/Documents/Code Projects/Hawaii Wellness Clinic/HWC-Landing-pages/`
(палитра и шрифты из `Pain & Joint Landing 3/index.html`). Ассеты в
`public/brand/`: `hwc-logo.png` (настоящий файл клиники) и `hwc-hero.jpg`.
Playfair Display через `next/font` в `layout.tsx`, токены `--hwc-*` и класс
`.hwc-display` — в `globals.css`. Ключевое правило вёрстки: логотип и текст
лежат на сплошном белом листе, никогда на фотографии, иначе строка «ADVANCED
THERAPIES FOR MIND AND BODY» тонет. Кнопка submit переопределена локально через
`.hwc-form` — общий `.cm-btn-primary` это матовое стекло под градиентный фон.

**Форма генерации скриптов** (`ScriptGenerator.tsx`) свёрнута до одного решения
— какая тема. Topic + starting note живут за раскрывашкой «Adjust topic or add a
note». В плановом пути текст инпута на сервер не уходит вовсе — летит
`planTopicId`. Игорь одобрил 2026-08-13.

**Подбор фото для каруселей — доктрина v4** (Игорь, 2026-08-17; отменяет v3).
Три источника вместо двух: `ai` — только 3D-медрендеры и гавайская природа
(**AI-людей больше нет вообще**, они были самым слабым местом постов);
`clinic` ~40% — настоящие фото из Drive-библиотеки клиники; `stock` (Pexels) —
не больше 2 на пост и только под конкретный предмет, которого у клиники нет
(штатив с пробирками, шприц-ручка). Обложка по-прежнему без фото.
Порядок выдачи clinic-фото — **LRU с кулдауном 30 дней**, не «сверху вниз» и не
рандом: сверху вниз выжигает голову списка, рандом даёт повтор уже через
несколько постов (61 фото, 3 выбора на пост). Среди отдохнувших выигрывает
лучшее совпадение по тегам, при равенстве — то, что не использовалось дольше.
Если отдохнувших не хватает — кулдаун ослабляется, но с явным warning в лог,
молча не «работает». Кулдаун стартует только после удачного compose
(`markPhotosUsed`), провал compose фото не сжигает.

**Drive-доступы к фото.** Служебный аккаунт
`content-machine-sa@jobflow-491621.iam.gserviceaccount.com` получил роль
читателя на папку igor `HWC Pictures Google`
(`120xEMg5Zl47ZpD6Bd8q5QodHFEdndzNK`) — проверено, читается. Внутри 61
пригодное фото: `JPEG CLINIC PICS` 45 jpeg, `HWC Pictures` 8 png,
`Pics Clinic (Edited)` 8 png; у `Screenshots from Videos` содержимое лежит
уровнем глубже (в подпапке `Screenshots`). Папка под будущие фото в аккаунте
kinnil — `Clinic Pictures` (`1NJDilk6aBXgXYLfvsGOdnQ1XsW5Kn8xP`).
Перенос файлов между аккаунтами igor → kinnil обсуждался и **отменён**: между
двумя личными gmail владение загруженными файлами не передаётся вообще (только
родные Google-документы), а в папках лежат Sony RAW по 25 МБ, которые ни Canva,
ни Vision, ни Instagram не берут.

## Последний заход
- Доктрина v4 разложена по коду ПОЛНОСТЬЮ, `tsc --noEmit` чистый. Ничего не
  закоммичено.
- `supabase/migrations/048_photo_rotation.sql` — `last_used_at` + `use_count` на
  `photo_index`, индекс `(clinic_id, drive_folder_id, last_used_at nulls first)`,
  RPC `bump_photo_usage`, колонка `clinics.photo_library_folder_id`, и триггер
  `trg_bump_photos_on_compose`: кулдаун стартует на переходе
  `slide_sets.status → visuals_ready`. Триггер, а не вызов из кода, потому что
  раннер пишет в PostgREST напрямую и серверного хука в этом месте нет.
- `app/api/visual/photo-index/route.ts` (НОВЫЙ) — индексатор, которого никогда
  не было: обходит папку, гоняет Haiku Vision, пишет описание + теги в
  `photo_index`. Батчами по `limit`, ответ `{indexed, skipped, total, remaining,
  errors[]}` — ровно тот контракт, который `PhotoPicker.tsx` дёргал в пустоту.
  Одно битое фото не топит батч. HEIC ловится и отдаётся ошибкой (Vision его не
  берёт), непрочитанная папка отвечает «расшарь на сервисный аккаунт».
- `app/api/photos/clinic/[fileId]/route.ts` (НОВЫЙ) + `lib/photos/clinic-url.ts`
  — публичная отдача байтов из Drive для Canva, подпись HMAC на CONTENT_MACHINE_SECRET
  (нового env не нужно). Без срока годности: подписанный URL лежит внутри плана,
  а пост может ждать в очереди днями. Подпись сверяется constant-time, так что
  прокси в чужой Drive из этого не сделать.
- `lib/photos/clinic.ts` — LRU-селектор (кулдаун 30 дней, теги весят вдвое
  против vision-описания, при нехватке отдохнувших ослабляет кулдаун С WARNING).
  `lib/photos/photo-lib.ts` — подтягивает папку клиники из БД.
- `lib/posts/photo-brief.ts` переписан: `PEOPLE`-режим удалён, `enforceMix`
  держит доли, `resolveClinicPicks` подставляет `drive_file_id` + подписанный
  `photo_url`, а при любом промахе деградирует слайд в AI-рендер.
- `lib/google/drive.ts` — белый список jpeg/png/webp/heic (Sony RAW это
  `image/x-sony-arw` и пролезал бы), обход на два уровня, дедуп по file id.
- Скилл `canva-compose-runner` и `docs/POST-CRAFT.md` §5 переписаны под v4;
  копия POST-CRAFT синхронизирована в
  `~/Library/Application Support/HWC/canva-runner/`.
- ГРАБЛИ песочницы: клиент `googleapis` виснет намертво на любом запросе (даже
  на `auth.authorize()`), обычный `fetch` работает — обход: подписать JWT
  сервисного аккаунта вручную (`crypto.createSign('RSA-SHA256')`) и ходить в
  Drive REST через `fetch`. `npm run dev`, `next lint`, `git log` с pathspec и
  `git status` по чужим репозиториям в песочнице тоже виснут.

## Сломано / не доделано
- **Миграция 048 НЕ применена** — без неё нет ни колонок ротации, ни триггера,
  ни `clinics.photo_library_folder_id`. Первый шаг, всё остальное ждёт её.
- **`clinics.photo_library_folder_id` не заполнен.** Для HWC поставить
  `120xEMg5Zl47ZpD6Bd8q5QodHFEdndzNK` (папка igor «HWC Pictures Google»,
  сервисный аккаунт уже читатель, внутри 61 пригодное фото).
- **Индексация ни разу не запускалась** — `photo_index` пуст, пока он пуст
  селектор честно говорит «библиотека пуста» и деградирует в AI.
- `NEXT_PUBLIC_APP_URL` должен быть выставлен в проде, иначе `clinicPhotoUrl`
  вернёт null и clinic-слайды тихо уйдут в AI (в лог пишется предупреждение).
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
Применить 048 в Supabase SQL Editor, прописать клинике
`photo_library_folder_id = '120xEMg5Zl47ZpD6Bd8q5QodHFEdndzNK'`, затем прогнать
индексацию (кнопка ↻ Re-index в PhotoPicker либо POST на
`/api/visual/photo-index` с `{clinicId, driveFolderId, limit: 8}` — 61 фото это
~8 батчей) и сгенерировать один пост, проверив, что в `photo_brief` появились
`source:"clinic"` с `photo_url`.
