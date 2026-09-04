# Main — репозиторий, поллер, доступы, Drive-аккаунт, тексты и фото по нише

Обновлено: 2026-09-03 · ветка: main

## Состояние
**Рабочая копия — `~/Code/Content-machine`**; старый путь под `~/Documents` — симлинк. Код туда не
возвращать; файл, читающийся пустым при ненулевом размере, проверять `ls -lO` на `dataless`.

**Drive приложения = `kinnil.official@gmail.com` (с 03.09).** `GOOGLE_DRIVE_USER_REFRESH_TOKEN` в
Vercel перевыпущен на этот аккаунт (`scripts/get-drive-token.mjs`, клиент `drive-upload`, Desktop,
но требует `GOOGLE_OAUTH_CLIENT_SECRET`). Было `hellosystems111` с бесплатными 15 ГБ → стало 107 ГБ
(занято ~34). `Clinic Clips` принадлежал kinnil, а **корень записей — нет**: старое значение
`DRIVE_RECORDINGS_ROOT_FOLDER_ID` (`1XDZ…`) — папка hellosystems111, расшарена была только её
дочерняя `Recordings`, и телесуфлёр из-за этого перестал сохранять (см. «Последний заход»).
Теперь корень записей = `content-machine` (`1rqNJb…`, владелец kinnil), файлы ложатся в
`content-machine/Recordings/<клиника>`; папка клиники создаётся с anyone-reader. Старые 8 записей
(по 22.08) остались за hellosystems111 — читаются, но кнопка удаления по ним откажет. Секреты клиента в Vercel — write-only, читать только в GCP
(Client secrets → Add secret, старый показать нельзя).

**Деплой — автоматический по `git push`.** GitHub-интеграция Vercel поднимает Production на
каждый коммит в `main` (проверено 03.09 по `gh api .../deployments`: у `a350332`, `215195a`,
`414ba08`… по успешному деплою через ~2 с после пуша). Руками `vercel --prod` не запускать:
CLI грузит **рабочую папку целиком, вместе с незакоммиченным** — так в прод уедет чужой
недоделанный код (в этот раз рядом жил клипсовый заход второй сессии). Push = деплой.

**Compose-поллер** `com.hwc.canva-runner` в `gui/501`, тик 2 мин; ставить только
`bash scripts/canva-runner/install.sh` (`--check` — здоровье), `launchctl load` запрещён. launchd не
тикает во время сборки (~25–40 мин) — heartbeat `poller_ts` стучит из фонового цикла в `run.sh`.
Обновлять `run.sh`/`SKILL.md` при живой сборке через `cp → .new && mv`. Источник SKILL.md —
`~/.claude/skills/canva-compose-runner/`, не репо. Блокировки → `stage='blocked'` + `/api/canva/blocked`.

**Canva notes — только чтение** (MCP убрал сеттер 24.08): caption поста кладётся на дизайн
комментарием (`comment-on-design`). Мастера вычищены 26.08.

**Доступы:** `/c/<token>` / memorable-код, роли `doctor` / `editor`, две клиники HWC —
Made (aesthetics, `cdb530e5-3ce9-4088-abee-117bc872e39a`) и Shawn (regenmed,
`5065c6ee-7c4b-451b-8dee-3498eb3af674`). Vercel-аккаунт `igorlinnick-1951`, план **Hobby**.
Профиль HWC после 054 (применена 03.09): **5 пилларов** (добавлен Aesthetics), **22 услуги**
(шесть эстетических с сайта), **20 deep-dive тем**. 047 и 051 тоже применены.

**CTA-ключи ManyChat** — `lib/seeds/cta-keywords.ts` единственный источник правды в коде, пул
BINDING, выдуманное слово режется в `resolveCtaKeyword`. Двенадцать эстетических ключей (BOTOX,
FILLER, LIPS, SCULPTRA, MICRO, COLLAGEN, GLOW, SKIN, RENEW, VOLUME, SMOOTH, REFRESH) **заведены
в ManyChat HWC** — подтверждено Игорем 03.09, цепочка пост → комментарий → бот замкнута.

**Гайды врачей — розданы (03.09).** По одному PDF на Shawn и Made в `~/Downloads/HWC/Content
Machine PDFs/` (скрипт пишет туда, fallback — `samples/`). Формат финальный: одна страница в стиле
приложения (Inter/violet, без QR и лого), папки = Recordings + Finished videos (+ floor у Made),
Inbox и Photo library — только админу, terms мелким внизу. Коды и инсталл-ссылки напечатаны в самих
PDF — **в репо не держим, репозиторий публичный**. Прод-переменные sensitive, поэтому `env pull` для
генерации бесполезен: папка записей передаётся флагом `--recordings-folder <id>`.

**Тексты:** формат = HOW, тема = WHAT; клише забанены тестом «сказал бы врач одному пациенту?».
Каталог форматов — 6 (`lib/posts/formats.ts`), один источник для планировщика, кнопок и сидинга
`script_templates`. **Treatment explainer** — единственный, кто приземляется на услугу из
`clinics.services`, и это учебный пост: слайды 2-4 (механизм → что сделать самому → где это
упирается) обязаны стоять сами по себе, услуга объясняется на слайде 5 и больше нигде, 6 и 7 —
кому не подходит и как проходит визит. Прогнан живьём 03.09 на форехед-линиях (`slide_set
7dcd2914`, script `aed52ad5`): арка сошлась, CTA попросил ключ BOTOX.
Evidence-слайд — студии из PubMed (`lib/posts/studies.ts`), поиск ярусами (свежие 3 года, добор из
7), год только в одном предложении с журналом.

**Фото — доктрина ПО НИШЕ (v4.1).** `lib/posts/photo-brief.ts` и `cover-brief.ts` выбирают доктрину по
`clinics.niche`. Regenmed = v4 (3D-рендеры + Гавайи, ~40% из Drive, Pexels ≤2). Aesthetics (Made,
мастер `DAHMHS1wLls`) = только реальные фото: SKIN — нелицевые зоны, TOOLS — натюрморт, ROOM — пустой
кабинет, BOTANICAL — аналогии; клиника ≤25%. Правила и грабли Flux: `POST-CRAFT.md §5a`, `SKILL.md §4`.

## Последний заход
- **Телесуфлёр не сохранял в Drive — починено, в проде (03.09).** После смены аккаунта каждое
  «Save to Drive» падало 404 на поиске корневой папки, врач видел голое `File not found: <id>`;
  файл ≥4 МБ не спасал и прокси-фолбэк. `lib/google/recordings.ts` теперь один раз проверяет корень
  (`files.get`) и при 404/403 уходит в `GOOGLE_DRIVE_FOLDER_ID`, оставив предупреждение в логе
  (`e72a618`); `DRIVE_RECORDINGS_ROOT_FOLDER_ID` переписан на `1rqNJb…`. Проверено живьём: запись
  8.2 МБ легла в `content-machine/Recordings/Hawaii Wellness Clinic`, владелец — kinnil.
- **Врачебный доступ к материалам (03.09, не задеплоено).** По решению Игоря «их контент остаётся
  их»: (1) `/videos` теперь показывает врачу ряд чипов **«Your folders in Drive»** — Recordings /
  Finished videos / Uploads inbox / Photo library / Clinic photos&clips, строится из колонок
  `clinics.*_folder_id` + Drive-lookup папки записей (`getClinicRecordingsFolderId`, кэш в памяти);
  (2) папки открываются по ссылке: `provisionClinicDriveFolders` ставит anyone-reader на корень
  клиники, `getOrCreateFolder` — на папку записей при создании; (3) **`scripts/render-doctor-guide.mjs`**
  — персональный 4-страничный PDF врача (QR-инсталл `/c/<token>`, memorable-код — создаёт при
  отсутствии, ссылки на папки — шарит их, страница Access & Terms от Hello Systems LLC). Превью:
  `node scripts/render-doctor-guide.mjs --dry`. Боевой запуск (классификатор не пускает Клода к
  прод-кредам — запускает Игорь, предварительно освежив `vercel env pull .env.vercel.local`):
  `node --env-file=.env.vercel.local scripts/render-doctor-guide.mjs --clinic shawn` и `--clinic made`.
  Логотип HWC переложен в репо: `assets/hwc-logo.png` (iCloud-копии dataless).
- **Модуль «From the floor» в проде** (коммит `ad8194d`, миграция 052 применена Игорем). Google-форма
  MA пишет в Drive-папку `Untitled form (File responses)`; CM зеркалит её в `floor_media` и показывает
  **вкладкой в `/videos`** — админской, доктор её не видит. Подробности модуля — `HANDOFF-MODULES.md` §6b
  и `docs/handoff/floor-media.md`.
- Push стали admin-scoped (`push_subscriptions.is_admin`), floor-пинги уходят ТОЛЬКО админам;
  `PushToggle` вернулся в UI (шапка `/videos`) — подписок теперь 2, обе админские Игоря.
  Починен `public/sw.js`: клик по уведомлению вёл в `/clips` независимо от payload.
- Раздатка со ссылкой на папку: `scripts/render-folder-card.mjs` → цветная и `STYLE=mono` ч/б версии,
  копии лежат в `Documents/Code Projects/Hawaii Wellness Clinic/HWC-Floor-Folder-Access[-BW].pdf`.

## Сломано / открытые хвосты
- **Клипы закоммичены и в проде** (`8fcadb6`), область сужена до телесуфлёра (Игорь 03.09):
  резы только в тишине по словам, общий таймлайн для прожига и `.srt`, один проход кодирования
  вместо двух. Модульный хендофф — `docs/handoff/clips.md`. Переписанные на «только очередь»
  `/api/clips/process` и `/api/cron/clips-inbox` **запаркованы в `git stash`** (раннера нет,
  очередь копила бы строки молча). Не проверено живьём на настоящем MediaRecorder-файле.
- **Коды врачей в истории public-репо — риск принят Игорем 03.09** («забей, никто не будет
  трогать их коды»): до скраба они были в этом файле, дефолты `hwc-team`/`hwc-doctor` — в
  `render-staff-guide.mjs`. Не перевыпускаем и репо не закрываем; вопрос закрыт, заново не
  поднимать. Если когда-нибудь заметится чужой вход — коды меняются в БД, PDF перегенерятся
  одной командой.
- **Публичный репозиторий.** `samples/doctor-guide-*-doctor.*` и `samples/floor-folder-access*.pdf`
  ушли в `.gitignore`: первый печатает рабочий install-код врача, второй — capability-ссылку на
  Drive-папку. `render-folder-card.mjs` берёт ссылку из `FOLDER_URL`, в исходнике её больше нет.
- `assets/hwc-logo.png` в репо НЕ попал — его режет блэнкет `*.png` в `.gitignore`. Сейчас на него
  никто не ссылается (гайд финализирован без лого), но фраза «переложен в репо» неверна.
- Vercel **Hobby** с шестью cron-записями: деплой прошёл, но если сборка когда-нибудь упрётся в лимит —
  первой снимать `/api/cron/floor-media` (модуль переживёт: останутся Sync now и синк при открытии).
- Первый штатный крон `/api/cron/floor-media` (07:00 UTC) ещё не отрабатывал — проверить, что
  пуш-дайджест уходит.
- Превью части видео Made ещё генерируются Drive (у файлов от 28.08 они уже есть) — не баг, плитка
  сама перезапрашивает 4 раза по 45 с.
- Доступ «Anyone with the link» на папке формы **снимать НЕЛЬЗЯ** (передумано 03.09): на нём держатся
  врачебные ссылки на папки в `/videos` и в PDF-гайде — врачи ходят по ссылке без Google-логина.
- **Розданные PDF-гайды указывают на СТАРУЮ папку записей** (`1q97nn…`, дерево hellosystems111):
  новые записи туда больше не попадают. В `/videos` чипы считаются живьём и ведут куда надо —
  расходятся только напечатанные ссылки. Чинится перегенерацией с `--recordings-folder
  1Zn1cerArg3p5E-oDQD0BYhv2gfXjRQEL`.
- **`DRIVE_RECORDINGS_ROOT_FOLDER_ID` не читается обратно:** политика проекта держит переменную
  sensitive, пересоздание через CLI флаг не снимает, `env pull` отдаёт `[SENSITIVE]`. Значит
  записанное значение нельзя проверить чтением — только по поведению. Снимается в дашборде
  (Settings → Environment Variables) с последующим пересозданием переменной.
- Canva MCP в этой сессии отвалился (просит авторизацию через настройки коннекторов claude.ai).

## Следующий шаг
Перегенерировать оба PDF-гайда с новым id папки записей — `node --env-file=.env.vercel.local
scripts/render-doctor-guide.mjs --clinic shawn|made --recordings-folder 1Zn1cerArg3p5E-oDQD0BYhv2gfXjRQEL`
— у врачей на руках версия со ссылкой в старое дерево, куда новые записи уже не попадают.
