# Main — compose-поллер, каталог форматов, фото по нише, ManyChat-ключи

Обновлено: 2026-08-31 · ветка: main

## Состояние
**Рабочая копия — `~/Code/Content-machine`**; путь под `~/Documents` — симлинк. Файл, читающийся
пустым при ненулевом размере, проверять `ls -lO` на `dataless`.

**Compose-поллер** `com.hwc.canva-runner` в `gui/501`, тик 2 мин; ставить только
`bash scripts/canva-runner/install.sh` (`--check` — здоровье), `launchctl load` запрещён. launchd не
тикает во время сборки (25–40 мин) — heartbeat `poller_ts` стучит из фонового цикла в `run.sh`.
`run.sh`/`SKILL.md` при живой сборке править только `cp → .new && mv`. Источник SKILL.md —
`~/.claude/skills/canva-compose-runner/`, не репо (деплоенная копия была протухшей с 27.08,
синхронизирована 31.08). Блокировки → `stage='blocked'` + push.

**Canva:** MCP не пишет notes — это делает `scripts/canva-runner/set-notes.sh` через Safari
(нативный сеттер + `input` + `blur` + 12 с; панель биндится к странице под вьюпортом — скроллим
канвас в 0 и проверяем чтением API). Caption → **notes страницы 1**, комментарий остался fallback.
Донорские notes/title на уже сделанных копиях не вычищаются (`copy-design` не принимает title).
Мастер Aesthetic (`DAHMHS1wLls`, style 5) — типографика Style 1, `bodySlots` 6.

**Тексты:** формат = HOW, тема = WHAT. Каталог форматов — 6 (`lib/posts/formats.ts`), из них
**Treatment explainer** единственный приземляется на услугу из `clinics.services`, ≤1 раз в неделю.

**CTA-ключи ManyChat** — `lib/seeds/cta-keywords.ts` единственный источник правды; пул BINDING,
выдуманное слово режется в `resolveCtaKeyword`. У HWC (`regenerative_medicine`) теперь **5 пилларов**:
к четырём добавлен `aesthetics` — BOTOX, FILLER, LIPS, SCULPTRA, MICRO, COLLAGEN, GLOW, SKIN, RENEW,
VOLUME, SMOOTH, REFRESH. Пул Made (`AESTHETICS_CTA_KEYWORDS`) отдельный, не трогали.

**Фото — доктрина ПО НИШЕ (v4.1)** в `photo-brief.ts`/`cover-brief.ts` по `clinics.niche`: regenmed =
3D-рендеры + Гавайи, ~40% Drive, Pexels ≤2; aesthetics (Made) = только реальные фото, клиника ≤25%.
**From the floor** — Google-форма зеркалится в `floor_media`, вкладка в `/videos`, cron `0 7 * * *`.

## Последний заход
- Собран Aesthetics-пиллар для HWC по `hawaiiwellnessclinic.com/aesthetics/` (Botox, Microneedling,
  Lip Filler, Sculptra, Stem Cell Aesthetics) — 12 слов, все уникальны против прежних 48.
- Сознательно без PRP и STEMCELL: у HWC оба читаются как суставные, лицевой пост увёл бы человека в
  суставной флоу. Стем-клеточная эстетика закрыта словом RENEW.
- В `REGENMED_MANYCHAT_KEYWORDS` (`lib/niche/profiles.ts`) добавлен блок с логикой выбора и запретом
  тащить эстетические слова в суставы/вес/ментальное и наоборот.
- Проверено: `tsc --noEmit` чисто; резолвер даёт Botox→BOTOX, микронидлинг→MICRO, lip filler→FILLER,
  Sculptra→SCULPTRA, stem cell aesthetics→RENEW, суставная тема→JOINT (не сломана).

## Сломано / не доделано
- **12 триггеров ещё не заведены в ManyChat HWC** — до этого слова печатаются на слайде вхолостую.
- **052_floor_media.sql** не применена. (053 применена 31.08: в плане не осталось `pending` тем с
  удалёнными форматами — только `done`, их формат намеренно не переписан.)
- **Treatment explainer живьём не прогонялся**: не видели, берёт ли писатель ровно одну услугу и
  доезжает ли `book_line` до CTA-слайда.
- `clinics.services` у Made не проверены; от Phil'а нужен список услуг по приоритету.
- Notes и имена четырёх постов ПОЧИНЕНЫ 31.08 (`set-notes.sh` закоммичен, в §6 3a раннера подключён,
  как и `update_title` шагом 0): `DAHTa8Dj7bA` → «Repair Fuel — NAD+», `DAHTcwfPHnA` → «4 Skin
  Habits…», `DAHTP_HYGCY` → «Make More Energy — Mitochondria», `DAHTbk2F2F8` → «4 Things That
  Rebuild Tissue»; у всех p1 несёт свой caption (проверено через API). Осталось: `DAHTP_HYGCY`
  **страница 7** с чужими notes про гормоны — скрипт пишет только p1.
- На SPF-посте ключ `PREVENTION` остался на слайде 7 и в описании — он невалидный, ManyChat не
  ответит. Новые посты его не получат (гейт в сплиттере), этот надо править вручную.
- Хештеги в описаниях ограничены пятью (`capHashtags` в `lib/agents/captioner.ts`).
- На обложке `DAHTP_HYGCY` слиплось «Foursleep» и счётчик «Four» при пяти пунктах.
- Фото в мастере Aesthetic — донорские regenmed. Панели (диагонали/волны) через MCP не адресуются.
- main ahead от origin, пуш делает Игорь; некоммиченный хвост — CTA-ключи, фото-доктрина, серверный
  рендер (`lib/render/`, `lib/photos/*`, 047/051/053, шрифты, `ADS-CRAFT.md`), floor.
- Pre-flight `claude mcp list` в `run.sh` ~5 мин → тик при непустой очереди 5–8 мин.

## Следующий шаг
Дождаться, пока Игорь заведёт 12 эстетических триггеров в ManyChat HWC, закоммитить правки
`cta-keywords.ts` + `profiles.ts` и задеплоить; сразу после — применить `053_retire_post_formats.sql`.
