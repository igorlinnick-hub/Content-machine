# scripts

Обновлено: 2026-08-19 · ветка: main

## Состояние
Отдельный экран /scripts со звёздами и инлайн-редактированием в Recent — в main. Миграция 046_script_starred.sql применена в предыдущей сессии.

## Последний заход (2026-08-19) — бан клише как категории
- Игорь: «Here's why that's already too late» — пример, «будут и другие такие клише». Правило = категория + тест (сказал бы это врач пациенту через стол?), списки — примеры.
- `lib/agents/writer.ts` — HARD-блок NO CLICHÉS в базовом промпте (видео-скрипты И карусели): тизеры, strawman-зачины, маркетинг/AI-филлер, антитеза-бантик, rule-of-three, wrap-up после каждого бита; из allowed registers убрано «here's what most people miss»; хук в LENGTH SPEC заканчивается на факте; пример в COVER MUST BE PAID OFF переписан без «here's the…».
- `lib/agents/teaser-lines.ts` — два яруса regex: `findTeaserLines()` (HARD → hook_quality ≤ 3, approved=false) и `findClicheLines()` (SOFT → 1: tone_match ≤ 6, ≥2: tone_match ≤ 4 + approved=false); `lib/agents/critic.ts` подмешивает оба в бриф и велит судить перефразы сверх скана. Подробности — docs/handoff/main.md.
- `docs/POST-CRAFT.md` — пункт «Teaser / announcer lines» в banned patterns.
- Не закоммичено, не задеплоено. В проде пока старый промпт.

## Предыдущий заход
- feat(scripts): отдельный экран /scripts, звезда + инлайн-правка в Recent
- feat(teleprompter): кнопка «Open in Google Drive» на экране сохранения
- незакоммичено: PWAInstallCard.tsx, globals.css, PostsWorkspace.tsx, scripts/canva-runner/run.sh, новый app/dev-pwa/

## Сломано / не доделано
Незакоммиченные правки по PWA и dev-pwa не описаны — заполнить при следующем заходе.

## Следующий шаг
Разобрать незакоммиченный PWA-хвост: доделать или откатить.
