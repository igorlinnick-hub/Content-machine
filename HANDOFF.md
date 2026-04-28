# CLAUDE CODE — HANDOFF DOCUMENT
# AI Content Platform for Regenerative Medicine Clinics
# Version: 1.0 | Status: Ready to Build

---

## ПЕРВОЕ ЧТО НУЖНО ЗНАТЬ

Ты получаешь полностью продуманную архитектуру. Не предлагай альтернативные подходы — просто строй по этому документу. Все архитектурные решения приняты. Если встретишь развилку не описанную здесь — спроси, не решай сам.

---

## 1. ЧТО МЫ СТРОИМ

Платформа для клиник regenerative medicine которая:
1. Собирает данные от врача (ежедневные вопросы-виджеты, голос или текст)
2. Генерирует скрипты для видео контента (90 секунд = 200-220 слов)
3. Создаёт Instagram слайды (PNG) из тех же скриптов
4. Учится на правках — чем больше редактируешь, тем лучше пишет
5. Экспортирует всё в Google Drive, команда редактирует там

**Целевой пользователь:** врач regenerative medicine клиники. Занятой. Не технический. Даёт 5 минут в день.

**Команда:** редакторы контента, работают в Google Docs/Drive. Никакого кастомного редактора им не нужно.

---

## 2. СТЕК — НЕ МЕНЯТЬ

```
Frontend:     Next.js 14 App Router
Database:     Supabase (PostgreSQL + Auth + Storage)
AI:           Anthropic Claude API (claude-sonnet-4-20250514)
Голос→текст:  OpenAI Whisper API
Визуал:       Puppeteer (HTML → PNG рендер)
Файлы:        Google Drive API
Расписание:   Supabase pg_cron (встроено)
Деплой:       Vercel
```

**Почему именно это:** Next.js API routes = агенты как простые async функции, никаких воркеров. Supabase cron встроен. Google Drive заменяет весь кастомный редактор.

---

## 3. АРХИТЕКТУРА АГЕНТОВ

Все агенты = отдельные вызовы Claude API с разными system prompts. Один API ключ. Никаких внешних оркестраторов. Просто await цепочка.

```
lib/agents/
  analyst.ts      — извлекает инсайты из заметок врача
  research.ts     — ищет тренды ниши (web_search tool)
  writer.ts       — генерирует скрипты
  critic.ts       — проверяет качество
  diff.ts         — учится на правках
  orchestrator.ts — запускает цепочку, управляет SharedContext
```

### SharedContext — сердце системы

Каждый агент получает этот объект. Каждый агент может его обновить.

```typescript
interface SharedContext {
  clinic_profile: {
    id: string
    name: string
    niche: 'regenerative_medicine'
    services: string[]
    audience: string
    tone: 'professional' | 'educational' | 'conversational'
    doctor_name: string
    medical_restrictions: string[] // что НЕЛЬЗЯ обещать
  }
  raw_insights: Insight[]          // из заметок врача
  trend_signals: TrendSignal[]     // из Research агента
  content_memory: ContentItem[]    // что уже генерировали
  few_shot_library: ScriptExample[] // лучшие скрипты (образцы)
  diff_rules: DiffRule[]           // паттерны из правок
  style_template: VisualStyle      // шаблон Instagram слайдов
}
```

---

## 4. АГЕНТЫ — ПОДРОБНО

### 4.1 Analyst Agent (`lib/agents/analyst.ts`)

**Триггер:** после каждого ответа врача на виджет-вопросы

**Вход:** сырой текст (транскрипция голоса или печатный текст)

**System prompt:**
```
Ты аналитик контента для клиники regenerative medicine.
Получаешь сырые заметки врача. Извлекай:
- stories: конкретные наблюдения или случаи
- opinions: точка зрения врача на тему
- angles: интересные углы для контента
- hooks: потенциальные хуки для видео

Отвечай ТОЛЬКО валидным JSON без markdown:
{
  "stories": [{"text": "...", "topic": "..."}],
  "opinions": [{"text": "...", "strength": 1-5}],
  "angles": ["..."],
  "hooks": ["..."]
}
```

**Выход:** обновлённый `raw_insights[]` в SharedContext

---

### 4.2 Research Agent (`lib/agents/research.ts`)

**Триггер:** cron раз в неделю (понедельник 9:00)

**Вход:** clinic niche + текущие услуги

**Инструмент:** web_search tool Claude API

**System prompt:**
```
Ты исследователь контент-трендов в regenerative medicine.
Ищи: новые исследования, что обсуждают в longevity сообществах,
какие темы набирают просмотры у врачей в этой нише.
Фокус: научные факты которые можно объяснить просто.

Отвечай ТОЛЬКО валидным JSON:
{
  "trending_topics": [{"topic": "...", "why_relevant": "...", "hook_angle": "..."}],
  "working_hooks": ["..."],
  "avoid_topics": ["..."]
}
```

**Выход:** обновлённый `trend_signals[]` в SharedContext

---

### 4.3 Writer Agent (`lib/agents/writer.ts`)

**Триггер:** кнопка "Сгенерировать скрипт" в дашборде

**Вход:** полный SharedContext

**ВАЖНО:** генерирует ВСЕГДА 3 варианта

**Структура скрипта (строго):**
- Хук: 15 сек (~35 слов) — конкретный факт или вопрос
- Наука/факт: 20 сек (~45 слов) — что показывают исследования
- Подход клиники: 40 сек (~90 слов) — как мы делаем это иначе
- Призыв: 15 сек (~30 слов) — конкретное действие
- **Итого: 200-220 слов**

**System prompt:**
```
Ты пишешь скрипты для врача regenerative medicine.
Врач говорит в камеру — умно, без маркетинга, как коллеге.

ПРАВИЛА:
- Никаких обещаний ("вылечит", "гарантированно", "100%")
- Только факты с научным основанием
- Тон: уверенный, образовательный, живой
- Длина: строго 200-220 слов
- Структура: хук (35 слов) → факт (45 слов) → подход (90 слов) → призыв (30 слов)

Используй few_shot_library как образец стиля.
Применяй diff_rules как обязательные правила.
Используй trend_signals для актуальных тем.

Отвечай ТОЛЬКО валидным JSON:
{
  "variants": [
    {
      "id": "v1",
      "topic": "...",
      "hook": "...",
      "script": "...",
      "word_count": 210,
      "estimated_seconds": 88
    }
  ]
}
```

**Выход:** 3 варианта скрипта → передаёт Critic агенту

---

### 4.4 Critic Agent (`lib/agents/critic.ts`)

**Триггер:** сразу после Writer

**Вход:** варианты скриптов + SharedContext

**Чеклист проверки:**
1. Тон совпадает с профилем клиники?
2. Нет медицинских обещаний?
3. Хук конкретный (не абстрактный)?
4. Укладывается в 200-220 слов?
5. Есть научный факт или ссылка на исследование?

**Логика:**
- Score ≥ 7 → передаёт на экспорт
- Score < 7 → возвращает Writer с конкретным комментарием
- Максимум 1 итерация переписывания

**System prompt:**
```
Ты редактор медицинского контента. Проверяй скрипты строго.

Оценивай по шкале 1-10 каждый критерий:
- tone_match: соответствие тону клиники
- no_promises: отсутствие медицинских обещаний  
- hook_quality: конкретность хука
- length_ok: 200-220 слов
- science_present: есть научное основание

Отвечай ТОЛЬКО валидным JSON:
{
  "scores": [
    {
      "variant_id": "v1",
      "total_score": 8,
      "criteria": {...},
      "approved": true,
      "feedback": "..."
    }
  ]
}
```

---

### 4.5 Diff Agent (`lib/agents/diff.ts`)

**Триггер:** cron раз в неделю (воскресенье 22:00)

**Вход:** оригинал Writer + финальная версия из Google Doc

**Что делает:**
1. Читает отредактированные Google Docs за неделю
2. Сравнивает с оригиналами из БД
3. Находит паттерны изменений
4. Обновляет `diff_rules[]`
5. Если финальная версия значительно лучше — добавляет в `few_shot_library[]`

**System prompt:**
```
Ты анализируешь как человек улучшает AI-написанные скрипты.
Получаешь оригинал и финальную версию.

Найди паттерны: что систематически меняется?
Формулируй как правила для будущих скриптов.

Отвечай ТОЛЬКО валидным JSON:
{
  "patterns": [
    {
      "rule": "Избегай пассивного залога — заменяй на активный",
      "example_before": "...",
      "example_after": "...",
      "priority": 1-5
    }
  ],
  "add_to_few_shot": true/false
}
```

---

## 5. БАЗА ДАННЫХ — SUPABASE

### Таблицы

```sql
-- Клиники
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche TEXT DEFAULT 'regenerative_medicine',
  doctor_name TEXT,
  services TEXT[],
  audience TEXT,
  tone TEXT,
  medical_restrictions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Заметки врача (сырые)
CREATE TABLE doctor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id),
  raw_text TEXT NOT NULL,
  source TEXT DEFAULT 'widget', -- 'widget' | 'voice' | 'text'
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Инсайты (после Analyst)
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id),
  type TEXT, -- 'story' | 'opinion' | 'angle' | 'hook'
  content TEXT NOT NULL,
  used_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Тренды (после Research)
CREATE TABLE trend_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id),
  topic TEXT NOT NULL,
  why_relevant TEXT,
  hook_angle TEXT,
  expires_at TIMESTAMPTZ, -- через 2 недели
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Сгенерированные скрипты
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id),
  variant_id TEXT, -- v1, v2, v3
  topic TEXT,
  hook TEXT,
  full_script TEXT NOT NULL,
  word_count INT,
  critic_score FLOAT,
  approved BOOLEAN DEFAULT FALSE,
  google_doc_id TEXT, -- после экспорта
  google_doc_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Финальные версии (после правок команды)
CREATE TABLE script_finals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES scripts(id),
  clinic_id UUID REFERENCES clinics(id),
  final_text TEXT NOT NULL,
  edited_by TEXT,
  diff_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Few-shot библиотека (лучшие скрипты)
CREATE TABLE few_shot_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id),
  script_text TEXT NOT NULL,
  why_good TEXT,
  topic TEXT,
  score FLOAT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Правила из правок
CREATE TABLE diff_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id),
  rule TEXT NOT NULL,
  example_before TEXT,
  example_after TEXT,
  priority INT DEFAULT 3,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Визуальные слайды
CREATE TABLE slide_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES scripts(id),
  clinic_id UUID REFERENCES clinics(id),
  slides JSONB, -- [{slide_number, text, photo_id, png_path}]
  style_template JSONB,
  drive_folder_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'rendered' | 'exported'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS политики

```sql
-- Включить RLS на всех таблицах
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_finals ENABLE ROW LEVEL SECURITY;
ALTER TABLE few_shot_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE diff_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE slide_sets ENABLE ROW LEVEL SECURITY;

-- Политика: каждый видит только свою клинику
CREATE POLICY "clinic_isolation" ON clinics
  FOR ALL USING (id = current_setting('app.clinic_id')::UUID);
```

---

## 6. API ROUTES

```
app/api/
  onboarding/route.ts          — POST: квиз → Profile Agent → clinic в БД
  notes/route.ts               — POST: текст/голос → Analyst Agent
  notes/transcribe/route.ts    — POST: аудио → Whisper → текст
  agents/generate/route.ts     — POST: Writer + Critic → скрипты
  agents/research/route.ts     — POST: Research Agent (cron trigger)
  agents/diff/route.ts         — POST: Diff Agent (cron trigger)
  export/google/route.ts       — POST: скрипт → Google Doc
  visual/generate/route.ts     — POST: скрипт → слайды PNG (ИЗОЛИРОВАНО)
  visual/download/route.ts     — GET: ZIP архив слайдов
```

---

## 7. СТРАНИЦЫ (NEXT.JS APP ROUTER)

```
app/
  (auth)/
    login/page.tsx             — вход
  onboarding/
    page.tsx                   — квиз клиники (один раз)
  dashboard/
    page.tsx                   — главный дашборд
    components/
      DailyWidgets.tsx         — 3-4 вопроса дня для врача
      ScriptGenerator.tsx      — кнопка генерации + 3 варианта
      ScriptCard.tsx           — карточка скрипта с оценкой
      RecentScripts.tsx        — история скриптов
  visual/
    page.tsx                   — управление Instagram слайдами
    components/
      SlidePreview.tsx         — предпросмотр слайдов
      StyleEditor.tsx          — редактор шаблона (один раз)
      PhotoPicker.tsx          — выбор фото из Drive
```

---

## 8. ВИЗУАЛЬНЫЙ МОДУЛЬ — ОТДЕЛЬНО

**Критично:** этот модуль изолирован. Живёт в `app/api/visual/` и `app/visual/`. Не импортирует из других агентов напрямую — только читает готовые скрипты из БД.

### Процесс

```
Script из БД
    ↓
Writer генерирует slide_texts[] (5-7 слайдов)
    ↓
Drive API вытягивает фото из папки клиники
    ↓
Puppeteer: HTML шаблон + текст + фото → PNG
    ↓
ZIP архив → скачивание или upload в Drive
```

### Style Template структура

```typescript
interface VisualStyle {
  canvas: { width: 1080, height: 1080 }
  background: { type: 'photo' | 'color', overlay_opacity: number }
  text: {
    primary: { font: string, size: number, color: string, position: 'top'|'center'|'bottom' }
    secondary: { font: string, size: number, color: string }
  }
  logo: { url: string, position: string, size: number }
  padding: number
}
```

### Puppeteer рендер

```typescript
// lib/visual/renderer.ts
export async function renderSlide(
  text: string,
  photoUrl: string,
  style: VisualStyle
): Promise<Buffer> {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1080 })
  
  const html = buildSlideHTML(text, photoUrl, style) // генерирует HTML
  await page.setContent(html)
  
  const screenshot = await page.screenshot({ type: 'png' })
  await browser.close()
  return screenshot as Buffer
}
```

---

## 9. ВОПРОСЫ-ВИДЖЕТЫ

Ежедневные вопросы для врача. Ротация каждый день. Хранятся в константах.

```typescript
// lib/widgets/questions.ts
export const DAILY_QUESTIONS = [
  "Что сегодня удивило пациента больше всего?",
  "Какое возражение ты слышал чаще всего сегодня?",
  "Что ты объяснял дольше всего и почему?",
  "Какой результат лечения тебя порадовал на этой неделе?",
  "Что большинство людей не понимают о regenerative medicine?",
  "Какой миф о твоей специализации раздражает больше всего?",
  "Что ты посоветовал бы пациенту который только начинает интересоваться темой?",
  "Какое исследование тебя впечатлило в последнее время?",
  "В чём твой подход отличается от стандартного?",
  "Что ты хотел бы чтобы пациенты знали до первого визита?"
]

// Каждый день — 3 случайных вопроса из списка
export function getDailyQuestions(): string[] {
  const today = new Date().getDay()
  return DAILY_QUESTIONS
    .filter((_, i) => i % 7 === today || i % 5 === today || i % 3 === today)
    .slice(0, 3)
}
```

---

## 10. GOOGLE DRIVE ИНТЕГРАЦИЯ

```typescript
// lib/google/drive.ts

// Создать Google Doc со скриптом
export async function createScriptDoc(
  script: string,
  title: string,
  folderId: string
): Promise<{ docId: string, docUrl: string }>

// Читать финальную версию документа
export async function readDocContent(docId: string): Promise<string>

// Вытянуть список фото из папки
export async function getPhotosFromFolder(folderId: string): Promise<Photo[]>

// Загрузить PNG в Drive
export async function uploadPNG(
  buffer: Buffer,
  filename: string,
  folderId: string
): Promise<string>
```

**Env переменные:**
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID= (папка клиники)
```

---

## 11. ENV ПЕРЕМЕННЫЕ

```env
# Anthropic
ANTHROPIC_API_KEY=

# OpenAI (Whisper)
OPENAI_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 12. ПОРЯДОК СБОРКИ

Строй именно в этом порядке — каждый шаг зависит от предыдущего:

```
Шаг 1: Supabase схема
  → Запустить schema.sql в Supabase SQL Editor
  → Настроить RLS
  → Сгенерировать TypeScript типы

Шаг 2: SharedContext + типы
  → types/index.ts — все интерфейсы
  → lib/supabase/context.ts — загрузка/сохранение контекста

Шаг 3: Базовые агенты
  → lib/agents/base.ts — Claude API клиент
  → lib/agents/analyst.ts
  → lib/agents/writer.ts
  → lib/agents/critic.ts

Шаг 4: API routes (основные)
  → app/api/notes/route.ts
  → app/api/agents/generate/route.ts

Шаг 5: Онбординг + квиз
  → app/onboarding/page.tsx
  → app/api/onboarding/route.ts

Шаг 6: Дашборд
  → app/dashboard/page.tsx
  → DailyWidgets, ScriptGenerator, ScriptCard компоненты

Шаг 7: Google Drive
  → lib/google/drive.ts
  → app/api/export/google/route.ts

Шаг 8: Research + Diff агенты
  → lib/agents/research.ts
  → lib/agents/diff.ts
  → Supabase pg_cron jobs

Шаг 9: Визуальный модуль (изолированно)
  → lib/visual/renderer.ts
  → app/api/visual/generate/route.ts
  → app/visual/page.tsx
```

---

## 13. РАЗВИЛКИ — СПРОСИ ПЕРЕД РЕАЛИЗАЦИЕЙ

Перед каждым из этих пунктов — уточни у пользователя:

**Перед Шагом 3 (агенты):**
Язык скриптов — русский, английский, или оба варианта?

**Перед Шагом 6 (дашборд):**
Врач видит дашборд сам, или только команда? Нужен ли отдельный view для врача?

**Перед Шагом 7 (Google Drive):**
Service Account уже создан? Или нужна инструкция по настройке?

**Перед Шагом 9 (визуальный модуль):**
Puppeteer может не работать на Vercel (serverless ограничения). Если так — использовать @sparticuz/chromium или переключиться на Canvas API. Уточни деплой среду.

---

## 14. ЧТО НЕ СТРОИТЬ В MVP

- Многопользовательские аккаунты (multi-tenant) — пока 1-3 клиники вручную
- Аналитика просмотров и вовлечённости
- Авто-постинг в соцсети
- Голосовые заметки в реальном времени (Whisper добавить в Шаге 3, но UI — позже)
- Мобильное приложение
- Кастомный редактор для команды (только Google Docs)

---

## ФИНАЛЬНАЯ ЦЕЛЬ

Врач заходит → отвечает на 3 вопроса за 5 минут → нажимает "Сгенерировать" → получает 3 скрипта → команда выбирает лучший в Google Docs → врач снимает видео → система учится на правках и пишет лучше со временем.

Параллельно: те же скрипты превращаются в Instagram слайды PNG готовые к публикации.

---

*Handoff создан: апрель 2026*
*Следующий шаг: Шаг 1 — Supabase схема*

---

## 15. CURRENT STATE (обновлено 2026-04-27)

Все 9 шагов из раздела 12 закрыты ещё в апреле. Поверх — слой расширений: feedback loop, pillars/deep-dive, premium UI, **auth, posts workspace, content plan, categories, few-shot library editor**. Этот раздел — актуальный снимок репо, чтобы при возврате к проекту не надо было разбираться с нуля.

### Решения, отклонившиеся от оригинала

- **Язык:** только английский (все промпты, виджеты, скрипты). Поле `language` в БД не добавляли.
- **Модели:** mix — `claude-opus-4-7` для critic, `claude-sonnet-4-6` для analyst/writer/research/diff. Константы в `lib/agents/base.ts` (`MODEL_CRITIC`, `MODEL_DEFAULT`). `claude-sonnet-4-20250514` из раздела 2 — deprecated, не использовать.
- **Google Docs экспорт удалён** (коммит `4f16b08`). Вместо `app/api/export/google/route.ts` — copy-to-clipboard на карточке скрипта. `lib/google/drive.ts` остался только для визуала (фото, PNG upload).
- **Onboarding — 5-шаговый визард** (`c1e6cd6`), не одностраничный квиз. Заводит clinic + сеет начальные contrarian opinions в `insights`.
- **Feedback loop:** pick/pass кнопки на вариантах → `POST /api/scripts/feedback` → таблица `script_feedback`. Writer читает последние picks/rejects и подмешивает в промпт (`03d9611`).
- **Content pillars + deep-dive topics:** врач задаёт 3-5 столпов и углублённых тем в онбординге; writer строит скрипты вокруг них (`cfa9bda` + `03d9611`).
- **UI:** светлая премиум-тема, Inter, оранжевый акцент, собственные примитивы (`3aae25f`). Geist удалён.
- **Puppeteer:** smoke-test проход + hardening в `87e445a`. Thinking бюджеты капнуты.
- **Auth — cookie-based, без email/пароля** (`00424fa`, `2fca9bb`, `49ee949`): admin логинится по `ADMIN_KEY` через форму на лендинге или ссылку `/admin/<key>`; врач получает одноразовую ссылку `/c/<token>` (генерится из admin install-link), сервер ставит httpOnly-cookie на год + дублирует в localStorage для PWA на iOS < 16.4. Роли: `admin`, `doctor`, `editor`. Никаких `app/(auth)/login/page.tsx` — лендинг сам даёт форму.
- **Posts workspace на `/visual`** (`00424fa` + `e115c09`): admin-only страница объединяет content plan, posts gallery, style editor, categories editor, few-shot library editor. Врач туда не ходит — у него `/dashboard`.
- **Content plan** (`00424fa`, миграция 004): admin вставляет/редактирует список тем (`content_plan_topics`), кнопка Generate на теме запускает writer → critic → slides и линкает результат к топику.
- **Clinic categories** (`e115c09`, миграция 005): 4 дефолтных (Mental Health / Pain & Joint / Wellness & Vitality / Medical Weight Loss), у каждой — список trigger-слов, Drive folder для фото-фонов, CTA-шаблон. При генерации поста topic матчится по триггерам → выбирается категория → берутся её фото и CTA. `slide_sets.category_id` хранит связь.
- **Few-shot library editor** (`e115c09`): admin вручную добавляет/удаляет примеры в `few_shot_library` через UI (`FewShotEditor.tsx` + `app/api/posts/few-shot/[exampleId]`). До этого библиотека наполнялась только автоматически через diff-агента (`add_to_few_shot`).

### Схема БД — фактическая

Помимо таблиц из раздела 5:

**`002_pillars_and_feedback.sql`:**
- `content_pillars` — столпы контента клиники (id, clinic_id, title, description, priority).
- `deep_dive_topics` — углублённые темы внутри столпа (id, clinic_id, pillar_id, topic, angle).
- `script_feedback` — решения врача по вариантам (id, clinic_id, script_id, variant_id, decision `'pick'|'pass'`, created_at).

**`003_clinic_access_tokens.sql`:**
- `clinic_access_tokens` — токены для cookie-логина врачей (token PK, clinic_id, role `'doctor'|'editor'`, label, created_at, last_used_at, revoked_at).

**`004_content_plan_topics.sql`:**
- `content_plan_topics` — упорядоченный список тем для генерации (id, clinic_id, topic, position, status `'pending'|'done'|'skipped'`, last_script_id, completed_at).

**`005_clinic_categories.sql`:**
- `clinic_categories` — категории контента (id, clinic_id, slug, name, emoji, position, triggers `text[]`, drive_folder_id, cta_template), unique (clinic_id, slug).
- Добавлена колонка `slide_sets.category_id` → `clinic_categories(id)`.

Типы в `types/index.ts` и `types/supabase.ts` синхронизированы. Загрузчик контекста в `lib/supabase/context.ts` подтягивает pillars / deep-dive / feedback / few-shot.

### Что уже живёт в коде

```
lib/agents/          analyst, writer, critic, research, diff, base
lib/supabase/        client, server, context
lib/auth/            session, tokens         — cookie-based access
lib/posts/           categories, plan        — content plan + categories helpers
lib/google/          drive (только для визуала)
lib/visual/          renderer, slides, store, templates
lib/widgets/         questions (EN)
lib/cron/            (research/diff cron wiring)
lib/clinic-storage.ts

app/page.tsx                       — лендинг + AdminLogin форма
app/onboarding/page.tsx            — 5-шаговый визард (Wizard.tsx)
app/dashboard/page.tsx             — дашборд врача
  components/ DailyWidgets, ScriptGenerator, ScriptCard, RecentScripts,
              InstallLinkCard, TokenBootstrap
app/visual/page.tsx                — admin-only Posts workspace
  components/ ContentPlan, PostsGallery, StyleEditor, CategoriesEditor,
              FewShotEditor, SlidePreview, SlideGenerator, PhotoPicker
app/components/                    — RoleBadge, AdminLogin, SessionRestore

app/admin/[key]/route.ts           — bootstrap admin cookie из URL
app/c/[token]/route.ts             — bootstrap doctor cookie из install-link

app/api/admin/login/route.ts
app/api/admin/install-link/route.ts
app/api/auth/logout/route.ts
app/api/auth/restore/route.ts
app/api/onboarding/route.ts
app/api/notes/route.ts
app/api/agents/generate|research|diff/route.ts
app/api/scripts/feedback/route.ts
app/api/visual/generate|download|style/route.ts
app/api/posts/generate/route.ts
app/api/posts/plan/route.ts
app/api/posts/plan/[topicId]/route.ts
app/api/posts/categories/route.ts
app/api/posts/few-shot/route.ts
app/api/posts/few-shot/[exampleId]/route.ts
app/api/posts/[slideSetId]/route.ts
```

### Чего нет в репо (из оригинала)

- `app/(auth)/login/page.tsx` — авторизация сделана иначе (cookie + token, форма на лендинге).
- `app/api/notes/transcribe/route.ts` — Whisper endpoint не подключён.
- `app/api/export/google/route.ts` — удалён в пользу clipboard copy.

### Следующий естественный шаг

Линейная сборка по спеке закончена; проект в режиме доработок и реальных прогонов. Вероятные направления:
- Whisper-транскрипция голосовых заметок (`app/api/notes/transcribe`).
- Реальные прогоны с клиникой → калибровка diff_rules и few-shot library.
- Доработка posts pipeline: автоматический матч по triggers, Drive-фото в слайдах, CTA-подстановка.
- Тонкие места auth: PWA flow, revoke-UX для admin.

*Current state обновлён: 2026-04-27*

