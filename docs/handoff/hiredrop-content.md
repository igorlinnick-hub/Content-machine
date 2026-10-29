# HireDrop content — карусели в бренде + lane в движке + LinkedIn/X

Обновлено: 2026-10-28 · ветка: main

## Состояние
- **Бренд с 22–23.10: фиолетового и янтаря нет → мягкая пастельная радуга, макеты прежние.** Правило —
  `~/Code/HireDrop Templates/README.md` → Brand; эталон `JobFlow/content-lab/founder-story/R2/`. Шрифты Space Grotesk /
  Instrument Serif italic / Inter / Caveat. Drop кремовый и без щёк: новую картинку из JobFlow — через `R2/deblush.py`.
- Шаблоны вне репо, в `~/Code/HireDrop Templates/` (README — карта). R2 = 36 каруселей P01–P36 (`R2/render.cjs`, подписи
  `posts.json`, факты `CONTENT-PLAN.md` §3); R3 = листиклы с живыми фото (`R3/tools/queue-meta.mjs`); R4 = радужный скин
  поверх R2 (`node R4/render.cjs P16 --native`; грабли — `R4/README.md`). Css R2/R3 помечены RETIRED.
- **Вся очередь P14–P36 на радуге (25.10).** Картинки `hiredrop-posts/v3/<id>/N.png` = `R4/export/native/` байт в байт;
  после перерисовки — только новый префикс (CDN отдаёт старое). P11, P12 вышли фиолетовыми.
- Выпуск: карусели → Instagram через `buffer_feed` (через день 16:00 UTC; `status` вышедших остаётся `scheduled`, правду
  знает Buffer `post{status sentAt}`). R3 и Reels → `meta_posts`. Детали — `publish.md`. Карта постов:
  https://claude.ai/artifact/KY2TAJ8ZUCbY8w2Afagz58
- Контент: голос фаундера; Threads личный, без рекламы и CTA (форматы 1–21:
  https://claude.ai/code/artifact/5a7c0abb-4406-44c2-afb4-eea65abf6fe0). Фото — реальный сток, тёплый грейд, лицо только
  на обложке. slop-check на любой текст. В движке CM профиля hiredrop нет: посты делаются шаблонами.
- **LinkedIn + X: профили и канал выпуска.** Тексты для этих площадок — лейн `hiredrop-social.md`; здесь только профили и
  канал (F10, F12, F15). Отчёты 28.10 в `~/Code/HireDrop Templates/social/`: `profiles.md` (риск, поля, обложки §8,
  аватары §7), `copy-final.md` (тексты профилей), `formats.md`/`examples.md` (для лейна social). Ассеты —
  `social/assets/` (README; на графите читается одно плотное свечение, бледные пастельные пятна выходят грязными).
  - **LinkedIn-страница** https://www.linkedin.com/company/hiredrop (admin `linkedin.com/company/146894600/admin/edit/`) —
    страница внутри личного профиля Игоря (`/in/igor-lynnik`, вход `igor.linnick@gmail.com`), отдельного аккаунта нет.
    Заполнено: About 1094 зн. (`copy-final.md` без «solo»; факты сверены с hiredrop.io), слоган A, сайт с UTM, Software
    Development, 2–10, Privately held, основана 2026, 12 специализаций без «auto apply/automation», лого HD, обложка L1,
    **локация San Diego, California, US (HQ, primary, без улицы; выбор Игоря 28.10)**. Кастомная кнопка — за Premium, не
    платим. Нет второго super admin (F10).
  - **X** https://x.com/hiredrop_io (почта hellosystems111, пароль у Игоря): аватар HD, шапка X1, био вариант 1,
    «Remote · US jobs», hiredrop.io, проф. аккаунт Business / Software Company. `@HireDrop` занят спящим аккаунтом.
  - Решения Игоря 28.10: никаких Premium/галочек; постинг наращивать постепенно. Риск LinkedIn (`profiles.md` §1): на
    LinkedIn не писать LinkedIn / Easy Apply / auto-apply / «human pace» / «own browser»; мишень — личный профиль Игоря.
  - **Канал LinkedIn/X = Zernio (вариант A, Игорь 28.10).** Аккаунт — вход через Google hellosystems111, профиль Default
    `6ae2adcd5799e69aef5d349c`. Ключ «content-machine» → `ZERNIO_API_KEY` в `.env.local` (в Vercel ещё нет). Billing: 2 канала
    бесплатно, X по цене X без наценки ($0.015 пост, $0.20 со ссылкой), **лимит X $2/мес стоит**, карта Игоря (Link) с 29.10.
    **LinkedIn подключён: страница HireDrop**, account `6ae2fabade937bee78ca5fe2`, `accountType: organization`, healthy.
    Токен Игоря видит и страницу Hawaii Wellness Clinic (`112716642`) — её не подключали. **X подключён 29.10: `@hiredrop_io`**,
    account `6ae3be7d8b995bed0a88a935`, healthy. Счёт: free tier, X $0.00 из $2. Код выпуска — лейн publish (`publish.md` F8).
  - Почему не постим сами (проверено 28.10): у X нет бесплатного API для новых разработчиков с 06.02.2026 — своё приложение
    стоит столько же, сколько Zernio; постить от LinkedIn-страницы можно только после одобрения Community Management API
    (юрлицо, скринкаст, живое демо). Без ревью своё приложение пускает только Meta.

## Последний заход
- 28.10: поставил LinkedIn-локацию San Diego и перечитал после Save. Разобрал с Игорем «почему не сами», Игорь выбрал A.
  Завёл Zernio (аккаунт, ключ в `.env.local`, лимит X $2), подключил LinkedIn-страницу HireDrop через headless-поток.
  Трогал: этот хендофф, `publish.md` (F8), `.env.local` (`ZERNIO_API_KEY`), память `hiredrop-linkedin-x`. Код CM не менялся.
- Zernio-вход: Google иногда пропускает выбор аккаунта и молча входит последним (так 29.10 появился **пустой лишний
  Zernio-аккаунт на igor.linnick@gmail.com** — не удалял, удаление необратимо, решает Игорь). Перед работой сверять почту
  в сайдбаре; выйти — меню аккаунта (Radix: `pointerdown`) → Sign out, войти заново и выбрать hellosystems111 в списке.
- Zernio: кнопки подключения в дашборде открывают popup, второй клик его убивает (`about:blank`). Ссылку брать из API:
  `GET /v1/connect/{linkedin|twitter}?profileId=…&redirect_url=<urlencoded URL на zernio.com>` (для X ещё
  `&expectedUsername=hiredrop_io`) → `authUrl` открыть обычной вкладкой своего окна.
- Zernio LinkedIn: стандартный поток выбор страницы **молча теряет** (callback `stage=callback`, аккаунта нет). Рабочий путь:
  `&headless=true` → редирект с `step=select_organization`, `tempToken`, `connect_token`, `userProfile`, `organizations` →
  `POST /v1/connect/linkedin/select-organization` (Bearer + `X-Connect-Token`), тело `{profileId, tempToken, userProfile,
  accountType:'organization', selectedOrganization:<объект из organizations>}`. URL редиректа несёт токены — не печатать
  целиком и сразу увести вкладку. LinkedIn на первом OAuth просит вход (проще «Continue with Google»), дальше только Allow.
- Формы LinkedIn/X через osascript (своё окно по id): длинный JS — файлом, `do JavaScript (read POSIX file "<f>" as «class utf8»)`;
  поля React/Ember — нативный setter `value` + `input`/`change`/`keyup`/`focusout`; после Save перечитать `/admin/edit/`
  (редактор теряет первое правленое поле). Локация: вкладка Locations → «Add a location», чекбокс
  `#opt-out-street-address-checkbox`. Обложка — `#org-admin-background-image-single-file-input` + `DataTransfer`. X: профиль в
  `x.com/settings/profile`, код X приходит в `[Gmail]/All Mail`. Игорь открывает ссылки в поднятом окне Claude → лишние
  вкладки; адресоваться `tab N of window id W`.

## Находки
- [x] F1 Правила радуги не было в шаблонах → закрыто: README → Brand, `R4/`, RETIRED в css R2/R3, память.
- [x] F2 23 карусели P14–P36 в очереди были фиолетовые → закрыто 25.10: все на `v3/` радуге, Buffer и `buffer_feed` сверены.
- [x] F3 Буква H (P17), фиолетовый реквизит Drop, `scene-tailor-stamp` → закрыто: canvas-перекраска, `R4/recolor.py`, замена сцены.
- [ ] F4 Ролики 26/28/30.10: фиолетовое «Hire» в лого на финальной плашке; ролики делаются вне CM → хозяин: Игорь.
- [x] F5 TikTok стоял с 22.10 (`thumbnailUrl`) → закрыто 27.10 лейном publish: `7f39ec2`.
- [ ] F6 R3-листиклы радугу не знают, `R4/render.cjs` читает только R2 → хозяин: этот лейн, до следующего листикла.
- [ ] F7 P19 (08.11): слайд 1 и подпись — «A thin violet tab». Если язычок расширения уже не фиолетовый, менять слова →
  хозяин: Игорь (цвет язычка), потом этот лейн. Флаг на карте.
- [x] F8 Копия карусели P14 в Threads вышла 29.10 16:00 UTC → закрыто 29.10: Игорь «забей», оставляем.
- [x] F9 X `@hiredrop_io` → закрыто 28.10: создан и оформлен.
- [ ] F10 LinkedIn: второй super admin. Игорь 28.10 «назову человека», имени нет; человек должен быть у Игоря в контактах →
  хозяин: Игорь (имя), потом этот лейн (admin → Manage admins → Add admin). Локация — закрыта 28.10 (San Diego).
- [x] F11 Риск LinkedIn → закрыто вердиктом `profiles.md` §1.4.
- [x] F12 Канал выпуска LinkedIn/X → закрыто 29.10: Zernio (вариант A), LinkedIn-страница HireDrop и X `@hiredrop_io`
  подключены и здоровы, лимит X $2. Код выпуска — лейн publish (`publish.md` F8).
- [ ] F13 IG `hiredrop.io`: аватар со старым фиолетовым H, в био опечатка «30 Aplications per day» → хозяин: Игорь.
- [ ] F14 Тексты для Threads/LinkedIn/X → 29.10 план ноября готов (два плана по 2 недели, `social/plan-2026-11.json`),
  план 1 ждёт «да» Игоря → хозяин: лейн hiredrop-social.
- [ ] F15 Лимит X $2 в Zernio общий для всего X API: аналитика и синк инбокса тоже тратят (чтение $0.005). Через сутки после
  подключения X посмотреть Billing → usage; если синк тратит — выключить или поднять лимит → хозяин: этот лейн.

## Сломано / не доделано
- Ждут Игоря с 11.10: «берём» на форматах Threads 1–21; кто отвечает на комментарии в первый час; три стиля постов для
  замера (бриф 09.10); `post_metrics` по плану роста https://claude.ai/code/artifact/3305cc64-63a1-4b52-b472-b15e6cb2b961;
  первый буст $10 — только с «да». Органики почти нет (IG 28.10: 20 подписчиков).
- Музыку к карусели Meta API не ставит. Unsplash `napi/search` — только curl; Pexels режет curl (403).
- `ZERNIO_API_KEY` есть только в `.env.local`; в Vercel кладёт Игорь через `!`, когда лейн publish соберёт канал.

## Следующий шаг
30.10: F15 — Zernio Billing → X usage (`$… of $2.00`); если за сутки без постов набежало — синк аналитики/инбокса X тратит,
выключить или поднять лимит. F10 — ответ Игоря про второго admin. Выпуск в LinkedIn/X — лейн publish (F8), тексты —
лейн hiredrop-social. Параллельно: 29.10 после 16:00 UTC проверить P14 в IG, F8. Opus.
