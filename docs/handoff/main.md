# Main — compose-поллер, каталог форматов, фото по нише, подписи к постам

Обновлено: 2026-08-31 · ветка: main

## Состояние
**Рабочая копия — `~/Code/Content-machine`**; путь под `~/Documents` — симлинк. Файл, читающийся
пустым при ненулевом размере, проверять `ls -lO` на `dataless`.

**Compose-поллер** `com.hwc.canva-runner` в `gui/501`, тик 2 мин; ставить только
`bash scripts/canva-runner/install.sh` (`--check` — здоровье), `launchctl load` запрещён. launchd не
тикает во время сборки (25–40 мин) — heartbeat `poller_ts` стучит из фонового цикла в `run.sh`.
`run.sh`/`SKILL.md` при живой сборке править только `cp → .new && mv`. Источник SKILL.md —
`~/.claude/skills/canva-compose-runner/`, не репо. Блокировки → `stage='blocked'` + push.

**Canva:** MCP по-прежнему не пишет notes, но это делает `scripts/canva-runner/set-notes.sh` через
Safari (нативный сеттер + `input` + `blur` + 12 с; панель биндится к странице под вьюпортом — скроллим
канвас в 0 и проверяем чтением API). Caption кладётся в **notes страницы 1** (слот инстаграм-описания);
комментарий остался только как fallback. Донорские notes и title на уже сделанных копиях НЕ
вычищаются: чистка мастеров на них не распространяется, а `copy-design` не принимает title.
Мастер Aesthetic (`DAHMHS1wLls`, style 5) — типографика Style 1, `bodySlots` 6.

**Тексты:** формат = HOW, тема = WHAT. **Каталог форматов — 6** (`lib/posts/formats.ts`, было 9):
Educational explainer · Practical tips · Warning signs · Myth-busting · Patient story ·
**Treatment explainer** — единственный, который приземляется на услугу из `clinics.services`,
максимум 1 раз в неделю; потолок ротации `Math.ceil(24 / N) + 1`, не хардкод.

**Фото — доктрина ПО НИШЕ (v4.1)** в `photo-brief.ts` / `cover-brief.ts` по `clinics.niche`.
Regenmed = 3D-рендеры + Гавайи, ~40% Drive, Pexels ≤2. Aesthetics (Made) = только реальные фото:
SKIN нелицевые зоны, TOOLS натюрморт, ROOM пустой кабинет, клиника ≤25%. Текст темы во Flux не
уходит. **From the floor** — папка Google-формы зеркалится в `floor_media`, вкладка в `/videos`,
cron `0 7 * * *`.

## Последний заход
- Вручную переписаны подписи к 4 живым постам (`DAHTa8Dj7bA` NAD+, `DAHTP_HYGCY` митохондрии,
  `DAHTbk2F2F8` tissue repair, `DAHTcwfPHnA` skin habits) — в чат, на дизайны не повешены.
- Причина: в notes этих копий лежали **чужие** подписи (GLP-1 у NAD+, одна и та же CARTILAGE у двух
  постов, пусто у skin), title тоже донорские («Spravato»). То есть без шага «caption комментарием»
  пост уезжает с описанием от донора, и это видно клиенту.
- Каталог форматов 9 → 6: убраны System critique / Expert secrets / Medicine philosophy (один
  регистр «система и другие врачи неправы», против POST-CRAFT §1) и Diagnostic deep-dive как дубль
  Educational explainer; добавлен Treatment explainer со слайдом-мостиком и «честным пределом».
- Миграция `053_retire_post_formats.sql`: правки в TS мало — `ensureDefaultScriptTemplates` только
  INSERT'ит, писатель читает активные `script_templates` из таблицы. Деактивирует строки и
  перекатывает **только `pending`** топики.

## Сломано / не доделано
- **053 не применена** — в живом плане остаются чипы `System critique`.
- **Treatment explainer живьём не прогонялся**: не видели, берёт ли писатель ровно одну услугу и
  доезжает ли `book_line` до CTA-слайда (в `DAHTcwfPHnA` там была только comment-строка).
- `clinics.services` у Made не проверены; от Phil'а нужен список услуг **по приоритету**.
- `scripts/canva-runner/set-notes.sh` (запись notes через Safari/osascript) появился вне этой
  сессии, не закоммичен и в compose-runner не подключён — работоспособность не проверена.
- На обложке `DAHTP_HYGCY` слиплось «Foursleep» и счётчик «Four» при пяти пунктах.
- Фото в мастере Aesthetic — донорские regenmed. Панели (диагонали/волны) через MCP не адресуются.
- `defaultStyleForNiche()` работает только после деплоя. Миграция `052_floor_media.sql` не применена.
- main ahead от origin, пуш делает Игорь; некоммиченный хвост — фото-доктрина, серверный рендер
  (`lib/render/`, `lib/photos/*`, 047/051/053, шрифты, `ADS-CRAFT.md`), floor.
- Pre-flight `claude mcp list` в `run.sh` ~5 мин → реальный тик при непустой очереди 5–8 мин.

## Следующий шаг
Применить `053_retire_post_formats.sql` в SQL Editor и после пуша/деплоя сгенерировать для Made один
пост в формате **Treatment explainer**: проверить, что взята ровно одна услуга из `clinics.services`,
что слайд «честный предел» на месте и что Book-строка называет услугу.

## Хвост по notes (31.08)
- Прогнать `set-notes.sh` по уже собранным: `DAHTcwfPHnA`, `DAHTa8Dj7bA`, `DAHTcKwCtjQ`,
  `DAHTP_HYGCY` — p1 пустая или с чужим caption; правильные тексты лежат комментариями на них же.
  На `DAHTbk2F2F8` уже сделано (тест) и проверено через API.
- **Деплоенный `SKILL.md` был устаревшим с 27.08** — без правил перестроенного мастера Style 5.
  Раннер всё это время собирал по старой редакции. Синхронизирован 31.08.
