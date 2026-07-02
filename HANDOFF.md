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

## 15. CURRENT STATE (обновлено 2026-04-28)

Все 9 шагов из раздела 12 закрыты ещё в апреле. Поверх — слой расширений: feedback loop, pillars/deep-dive, premium sky-blue UI, **auth, posts workspace, content plan, categories, few-shot library editor с pin'ом, per-clinic брендинг (логотип в Supabase Storage), refine на вариантах, кнопка Make slides на дашборде, Quick note, topic input, PWA, app-level логотип**. Этот раздел — актуальный снимок репо, чтобы при возврате к проекту не надо было разбираться с нуля.

### Решения, отклонившиеся от оригинала

- **Язык:** только английский (все промпты, виджеты, скрипты). Поле `language` в БД не добавляли.
- **Модели:** mix — `claude-opus-4-7` для critic, `claude-sonnet-4-6` для analyst/writer/research/diff. Константы в `lib/agents/base.ts` (`MODEL_CRITIC`, `MODEL_DEFAULT`). `claude-sonnet-4-20250514` из раздела 2 — deprecated, не использовать.
- **Google Docs экспорт удалён** (коммит `4f16b08`). Вместо `app/api/export/google/route.ts` — copy-to-clipboard на карточке скрипта. `lib/google/drive.ts` остался только для визуала (фото, PNG upload).
- **Onboarding — 5-шаговый визард** (`c1e6cd6`), не одностраничный квиз. Заводит clinic + сеет начальные contrarian opinions в `insights`.
- **Feedback loop:** pick/pass кнопки на вариантах → `POST /api/scripts/feedback` → таблица `script_feedback`. Writer читает последние picks/rejects и подмешивает в промпт (`03d9611`).
- **Content pillars + deep-dive topics:** врач задаёт 3-5 столпов и углублённых тем в онбординге; writer строит скрипты вокруг них (`cfa9bda` + `03d9611`).
- **UI:** светлая премиум-тема, Inter, **sky-blue акцент** (`9ce57a5`, после полного rebrand с orange → `sky-500`), собственные примитивы (`3aae25f`). Geist удалён. CSS-vars в `app/globals.css`: `--accent: #0ea5e9`, `--accent-hover: #0284c7`. На лендинге/welcome — двойной ambient sky glow + cm-fade-in каскад.
- **Puppeteer:** smoke-test проход + hardening в `87e445a`. Thinking бюджеты капнуты.
- **Auth — cookie-based, без email/пароля** (`00424fa`, `2fca9bb`, `49ee949`): admin логинится по `ADMIN_KEY` через форму на лендинге или ссылку `/admin/<key>`; врач получает одноразовую ссылку `/c/<token>` (генерится из admin install-link), сервер ставит httpOnly-cookie на год + дублирует в localStorage для PWA на iOS < 16.4. Роли: `admin`, `doctor`, `editor`. Никаких `app/(auth)/login/page.tsx` — лендинг сам даёт форму.
- **Posts workspace на `/visual`** (`00424fa` + `e115c09`): admin-only страница объединяет content plan, posts gallery, style editor, categories editor, few-shot library editor. Врач туда не ходит — у него `/dashboard`.
- **Content plan** (`00424fa`, миграция 004): admin вставляет/редактирует список тем (`content_plan_topics`), кнопка Generate на теме запускает writer → critic → slides и линкает результат к топику.
- **Clinic categories** (`e115c09`, миграция 005): 4 дефолтных (Mental Health / Pain & Joint / Wellness & Vitality / Medical Weight Loss), у каждой — список trigger-слов, Drive folder для фото-фонов, CTA-шаблон. При генерации поста topic матчится по триггерам → выбирается категория → берутся её фото и CTA. `slide_sets.category_id` хранит связь.
- **Few-shot library editor** (`e115c09`): admin вручную добавляет/удаляет примеры в `few_shot_library` через UI (`FewShotEditor.tsx` + `app/api/posts/few-shot/[exampleId]`). До этого библиотека наполнялась только автоматически через diff-агента (`add_to_few_shot`).
- **Pin для few-shot** (`c24c31e`): toggle Pin/Unpin в `FewShotEditor`. Pinned = `score = 1000` → всегда в top-5 пула, никакой автомат не подвинет. Unpinned = `score = NULL`. Endpoint `PATCH /api/posts/few-shot/[exampleId]`. Стратегия: на старте pin'им 4-5 эталонов, через 50-100 picks/passes — постепенно unpin.
- **Doctor-to-patient голос писателя** (`b9edcb6`): SYSTEM_PROMPT в `lib/agents/writer.ts` явно адресует curious adult patients (не коллег). Banned phrases: "as a clinician", "in our practice we observe", "the literature suggests", "peer-to-peer", "from a clinical standpoint". Жаргон должен быть распакован в lay-terms. Экспериментировать с регистром — через few-shot, не через system-prompt.
- **30 daily questions** (`b9edcb6`): расширили пул в `lib/widgets/questions.ts` с 10 до 30 patient-facing вопросов. Selection — date-seeded LCG: один и тот же набор из 3 вопросов на конкретный календарный день, разные дни → разные наборы.
- **Refine button на варианте** (`3a30761`): третья опция между Pick/Pass. Опциональное поле "What to change?" → `POST /api/agents/refine` → writer запускается с `refineFrom` блоком ("PREVIOUS ATTEMPT — keep what worked, fix what didn't" + нота доктора), один auto-rewrite если critic не утвердил. Карточка обновляется на месте, индикатор `refined ×N`. Старый вариант идёт в feedback как `rejected`.
- **Per-clinic logo** (`b5d5d6a`, миграция 006): `clinics.logo_url` + Supabase Storage bucket `clinic-logos` (public). UI — `BrandCard` на дашборде (admin only), drag-and-drop, версионированные пути (`<clinic_id>/<random>.<ext>`). Endpoint `/api/admin/clinic-logo` (multipart, max 2MB, PNG/JPG/WebP/SVG). `loadStyleTemplate` автоматически подмешивает `clinic.logo_url` в `style.logo.url` если override не задан → лого появляется на каждом отрендеренном слайде без дополнительных действий.
- **Make slides кнопка на дашборде** (`bd0dd1d`): на каждой ScriptCard теперь 🎴 Make slides → `POST /api/visual/generate` со scriptId → возвращает превью + zip download. Auth на `/api/visual/generate` и `/api/visual/download` ослаблен с admin-only до any-authenticated с проверкой clinic ownership. Доктор может рендерить карусели сам, не дёргая admin'а.
- **App-level brand: Logomark + PWA** (`9ce57a5`): `app/components/Logomark.tsx` — две пересекающиеся волны с центральной точкой (пульс/клетка/регенерация), всё через `currentColor`. Подставлен в eyebrow на лендинге, дашборде, wizard, welcome. PWA: `app/icon.tsx` (32×32) + `app/apple-icon.tsx` (180×180) рендерятся через `next/og` (sky-blue rounded mark с волной), `app/manifest.ts` объявляет `display: standalone`, `theme_color: #0ea5e9`. При "Add to Home Screen" иконка корректная, не дефолтная.
- **Topic input на ScriptGenerator** (`9ce57a5`): необязательное поле "Topic" перед кнопкой Generate. Пробрасывается через `/api/agents/generate` → `runWriter` как `topicHint`. Если пусто — писатель сам выбирает из pillars (как было).
- **QuickNote на дашборде** (`9ce57a5`): новая Section 2, textarea + Save → `/api/notes` → analyst парсит → insights → writer тянет на следующей генерации. Доктор может закидывать любую мысль не дожидаясь дневных вопросов.
- **Per-doctor onboarding flow** (`20954b0`, `ebbd8dc`): admin при генерации install-link вводит имя врача (хранится в `clinic_access_tokens.label`). При первом заходе (token's `last_used_at IS NULL`) врач попадает не на дашборд, а на `/onboarding?welcome=1` → персонализированный welcome ("Hey Shawn 👋 Your AI team is ready") с превью 4 агентов и 5 шагов квиза → запускает свой 5-шаговый wizard с предзаполненным именем. Возвратные заходы — сразу на дашборд с приветствием "Hi, Shawn".

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

**`006_clinic_logo_brand.sql`:**
- Колонка `clinics.logo_url text` (public URL логотипа в Supabase Storage).
- Storage bucket `clinic-logos` (public) — создаётся через `INSERT INTO storage.buckets`. Service-role uploads, public reads (для Puppeteer и браузеров при рендере).

Типы в `types/index.ts` и `types/supabase.ts` синхронизированы. Загрузчик контекста в `lib/supabase/context.ts` подтягивает pillars / deep-dive / feedback / few-shot.

### Что уже живёт в коде

```
lib/agents/          analyst, writer, critic, research, diff, refine-via-writer, base
lib/supabase/        client, server, context
lib/auth/            session, tokens         — cookie-based access
lib/posts/           categories, plan        — content plan + categories helpers
lib/clinics/         brand                   — logo upload to Supabase Storage
lib/google/          drive (только для визуала, фото-фоны категорий)
lib/visual/          renderer, slides, store, templates
lib/widgets/         questions (30 EN, date-seeded selection)
lib/cron/            (research/diff cron wiring)
lib/clinic-storage.ts

app/page.tsx                       — лендинг (sky brand, Logomark, DoctorLogin/AdminLogin)
app/layout.tsx                     — manifest, themeColor, appleWebApp meta
app/icon.tsx                       — 32×32 favicon (next/og, sky-blue Logomark)
app/apple-icon.tsx                 — 180×180 apple-touch-icon
app/manifest.ts                    — PWA manifest (standalone, theme #0ea5e9)
app/onboarding/page.tsx            — 5-шаговый визард + welcome для врача (Wizard.tsx)
app/dashboard/page.tsx             — дашборд (4 секции: Today's Q's, QuickNote, Generate, Recent)
  components/ DailyWidgets, ScriptGenerator (с topic input), ScriptCard
              (с Pick/Refine/Pass + Make slides), RecentScripts,
              InstallLinkCard (с doctor name), BrandCard (logo upload),
              QuickNote, TokenBootstrap
app/visual/page.tsx                — admin-only Posts workspace
  components/ ContentPlan, PostsGallery, StyleEditor, CategoriesEditor,
              FewShotEditor (с Pin/Unpin), SlidePreview, SlideGenerator, PhotoPicker
app/components/                    — RoleBadge, AdminLogin, DoctorLogin,
                                     SessionRestore, Logomark

app/admin/[key]/route.ts           — bootstrap admin cookie из URL
app/c/[token]/route.ts             — bootstrap doctor cookie + first-visit detection

app/api/admin/login/route.ts
app/api/admin/install-link/route.ts
app/api/admin/clinic-logo/route.ts          — GET / POST (multipart) / DELETE
app/api/auth/logout/route.ts
app/api/auth/restore/route.ts
app/api/onboarding/route.ts
app/api/notes/route.ts                       — text only, Whisper не подключён
app/api/agents/generate/route.ts             — теперь принимает topicHint
app/api/agents/refine/route.ts               — refine-from существующего скрипта
app/api/agents/research|diff/route.ts        — cron
app/api/scripts/feedback/route.ts
app/api/visual/generate/route.ts             — auth ослаблен до any-authenticated
app/api/visual/download/route.ts             — auth ослаблен до any-authenticated
app/api/visual/style/route.ts
app/api/posts/generate/route.ts
app/api/posts/plan/route.ts
app/api/posts/plan/[topicId]/route.ts
app/api/posts/categories/route.ts
app/api/posts/few-shot/route.ts
app/api/posts/few-shot/[exampleId]/route.ts  — DELETE + PATCH (pin toggle)
app/api/posts/[slideSetId]/route.ts
```

### Чего нет в репо (из оригинала)

- `app/(auth)/login/page.tsx` — авторизация сделана иначе (cookie + token, форма на лендинге).
- `app/api/notes/transcribe/route.ts` — Whisper endpoint не подключён.
- `app/api/export/google/route.ts` — удалён в пользу clipboard copy.

### Известные TODO / открытые направления

- **Picks history / approved library** — отдельная секция на дашборде "ранее одобренные скрипты". Нужен query refactor (`scripts JOIN script_feedback`).
- **Voice notes (Whisper)** — `/api/notes/transcribe` для голосовой записи на iOS-PWA.
- **Carousel slide editor** — переставить слайды, отредактировать текст одного слайда, сменить background. Сейчас слайды render-only.
- **decision='refined'** в `script_feedback` — миграция, чтобы отделять refined от полного rejected. Косметика.
- **Email/SMS install link** — отклонено пользователем; ссылка копируется вручную (или через QR).

### Pre-deploy чеклист (для нового окружения)

1. `.env.local` (или Vercel env): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_KEY`. Опц: `CRON_SECRET`, `GOOGLE_*`.
2. Накатить миграции по порядку: `002_pillars_and_feedback`, `003_clinic_access_tokens`, `004_content_plan_topics`, `005_clinic_categories`, `006_clinic_logo_brand`.
3. Проверить что bucket `clinic-logos` создан и public.

*Current state обновлён: 2026-04-28*

---

## 16. DESIGN LEDGER (создан 2026-04-28)

Этот раздел — единственная точка правды по визуалу. Каждое решение записывается с датой и причиной, чтобы при возврате к проекту не было путаницы "мы вроде это обсуждали".

### App UI (всё что НЕ слайды)

| Что | Значение | Где определено | Когда |
|---|---|---|---|
| Primary accent | `sky-500` (`#0ea5e9`) | `app/globals.css` `--accent` + Tailwind classes по всему UI | 2026-04-28 |
| Accent hover | `sky-600` (`#0284c7`) | `app/globals.css` `--accent-hover` | 2026-04-28 |
| Soft accent | `sky-50` / `sky-100` / `sky-200` | Ambient glows, chip backgrounds | 2026-04-28 |
| Background | `#ffffff` | `--background` | 2026-04-21 |
| Foreground | `#0a0a0a` | `--foreground` | 2026-04-21 |
| Muted text | `neutral-500/600` | Tailwind | 2026-04-21 |
| Font | Inter (`next/font/google`, var `--font-inter`) | `app/layout.tsx` | 2026-04-21 |
| Logomark | две пересекающиеся волны + центральная точка, через `currentColor` | `app/components/Logomark.tsx` | 2026-04-28 |
| Favicon / PWA icon | белый Logomark на sky-500 rounded square | `app/icon.tsx`, `app/apple-icon.tsx` (next/og) | 2026-04-28 |
| Animations | `cm-fade-in` (0.55s cubic-bezier), `cm-fade-in-stagger`, `cm-ping` для status dots; всё с `prefers-reduced-motion` guard | `app/globals.css` | 2026-04-27 |

### Slide visual style (PNG carousels)

**ВАЖНО:** App brand (sky-blue) и slide brand — это **две разные темы**. App UI — везде голубой акцент, но **слайды по умолчанию НЕЙТРАЛЬНЫЕ** (белый фон, чёрный текст), без брендинга приложения. Это by design — слайды должны выглядеть как контент клиники, а не как Content Machine.

| Что | Значение | Где определено | Когда |
|---|---|---|---|
| Canvas | 1080×1080 (Instagram square) | `DEFAULT_VISUAL_STYLE.canvas` | 2026-04-23 |
| Background type | `'color'` (плоский цвет, белый) — переопределяется на `'photo'` если в категории есть Drive folder | `lib/visual/store.ts` | 2026-04-23 |
| Photo overlay opacity | 0 (если background type='photo' и не задано иное) | `DEFAULT_VISUAL_STYLE.background.overlay_opacity` | 2026-04-23 |
| Primary text | Inter, 64px, `#0a0a0a`, position `center` | `DEFAULT_VISUAL_STYLE.text.primary` | 2026-04-23 |
| Secondary text | Inter, 32px, `#525252` | `DEFAULT_VISUAL_STYLE.text.secondary` | 2026-04-23 |
| Padding | 80px | `DEFAULT_VISUAL_STYLE.padding` | 2026-04-23 |
| Logo | пустой URL по умолчанию, position `bottom-right`, size 80px | `DEFAULT_VISUAL_STYLE.logo` | 2026-04-23 |
| Logo override | `clinic.logo_url` автоматически подмешивается через `loadStyleTemplate` если override не задан | `lib/visual/store.ts` | 2026-04-28 |

**Как меняется per-clinic.** В `slide_sets.style_template` (JSONB) хранится последний сохранённый style. Admin меняет через `/visual` → Style Editor → Save. Каждый последующий рендер берёт самый свежий style для clinic_id. То есть **дизайн в 95% случаев константен** — один раз настроил для клиники, дальше все генерации с ним.

**Открытое решение** (на 2026-04-28): нет согласованного "branded slide design" — то есть фирменного варианта слайда с цветами / акцентами / type-hierarchy, который шёл бы как DEFAULT_VISUAL_STYLE. Сейчас дефолт — голый белый. Если хочется чтобы новые клиники начинали с уже стилизованного шаблона (например, sky accent на хуке, чёрный body text, лого в углу) — нужно зафиксировать конкретные значения и обновить `DEFAULT_VISUAL_STYLE`.

### Где НЕ хранится дизайн (важно знать)

- В `app/globals.css` — только UI-уровень, не слайды.
- В Tailwind config — нет (используется stock Tailwind palette).
- В Figma / public/ assets / SVG файлах — нет.
- В каком-то файле "design-tokens.ts" — нет.

Всё что касается слайдов — `DEFAULT_VISUAL_STYLE` в `lib/visual/store.ts` + `slide_sets.style_template` в БД. Всё что касается app UI — Tailwind classes inline + CSS vars в `app/globals.css`.

### Hawaii Wellness Clinic — reference design (первый реальный клиент)

Файлы (НЕ закоммичены в репо, лежат локально):
- `~/Downloads/HWC/POST EXAMPLE 1/{1..5}.png` — myth-busting carousel про Ketamine Therapy (5 слайдов: cover → 3 myths → CTA с командой).
- `~/Downloads/HWC/POST EXAMPLE 2/*.png` — Mental Health / depression carousel (другая стилистика — фото-фон + chip-категория наверху).
- `~/Downloads/HWC/POST EXAMPLE 3 Screen /Screenshot….png` — single-slide hook ("3 Things your Doctor won't tell you…") — тёмное фото + serif headline + author chip.
- `~/Downloads/HWC/POST EXAMPLE 1/LOGO Brand.png` — официальный логотип HWC: волна (синий gradient navy → light blue) + "HAWAII WELLNESS CLINIC" stacked navy + tagline "ADVANCED THERAPIES FOR MIND AND BODY" в light blue.

#### Извлечённые design tokens

**Colors:**
- Primary navy (deep blue): ≈ `#1e3a8a` / `#1e40af` (используется в логотипе, в card backgrounds на cover-слайдах, в headings)
- Accent light blue: ≈ `#3b82f6` / `#60a5fa` (rounded chips типа "Mental Health", subtler accents, gradient fills)
- White text on blue panels
- Dark navy text on white background

**Layout primitives, повторяющиеся в 3-х наборах:**
- **Rounded cards** (radius ~16-24px) тёмно-синего цвета поверх фото — несут заголовок и body. Текст белый.
- **Chip labels** (rounded full pill) — категория ("Myth 1", "Mental Health", "@dr.vassily").
- **Photo backgrounds** на body-слайдах с blue overlay (transparent) частично закрывают фото снизу/сверху для контраста с текстом.
- **Logo** размещён bottom-right (small мини-логотип в виде только волны без текста) или bottom-center (полная stacked-версия на CTA).
- **Soft gradient washes** (sky-blue radial) на cover-слайдах с белым фоном — мягкое сияние сверху-справа.

**Slide types — наблюдаемая структура post:**
1. **Cover** — белый или мягкий gradient bg, eyebrow ("MYTHS"), big all-caps headline ("KETAMINE THERAPY"), all-caps subhead ("COVER EVERYTHING YOU'VE HEARD ABOUT KETAMINE THERAPY IS PROBABLY WRONG"). Логотип не виден.
2. **Body** — фото-фон, top-card chip ("Myth N — quote"), bottom-card body text. Text white on dark blue card.
3. **CTA** — фото клиники / команды / brain-image, bottom-card "STILL HAVE QUESTIONS?" + "BOOK A CONSULTATION — LINK IN BIO". Логотип виден.

**Typography:**
- Sans-serif heavy weight для всех headings (выглядит как Montserrat / Poppins / Inter Black, верифицировать у клиента).
- All-caps на cover и CTA.
- Body text в regular weight, всё ещё all-caps в myths-стиле, sentence-case в depression-стиле.
- Один пример (POST EXAMPLE 3) — serif headline на тёмном фоне; это другой "stylistic mode" (dramatic / contrarian-hook).

#### Что из этого — HWC-specific vs универсальное

- **HWC-specific:** конкретные синие цвета, логотип, формулировки CTA.
- **Универсальное (можно сделать дефолтом):** layout-системы — cover / body / CTA шаблоны; rounded card overlays; chip-категории; photo-bg + overlay; positioned logo. Каждая клиника настраивает свою цветовую палитру через style_template.

#### Текущее состояние renderer'а vs нужное

Сейчас `lib/visual/templates.ts buildSlideHTML` рисует ОДИН тип слайда: text по центру / сверху / снизу + опциональный photo bg + опциональный logo. Не поддерживает:
- Разные шаблоны cover / body / CTA.
- Top-chip + bottom-card композиции.
- Брендовую цветовую систему (`primary_color`, `accent_color`, `card_bg`).
- Eyebrow / subhead на cover.

Чтобы попасть в HWC-стиль — нужен **template system overhaul**. Это отдельная задача (~3-5 ч).

**Открытое решение (2026-04-28):** строить ли это сейчас, в каком масштабе, и что делать с per-clinic color overrides — обсуждается с клиентом.

### Решения принятые 2026-04-28 (для следующей сессии — это мандат на старт работы)

Запланированный rebuild template-системы согласован по сценарию **Path A** (полная переделка). Ниже — финальные решения, которые надо выполнить **в ту же секунду как пользователь вернётся в проект**. Не переспрашивать.

**1. Формат канваса.**
- Меняем default с `1080×1080` на **`1080×1350`** (4:5 portrait — Instagram post). Применить в `DEFAULT_VISUAL_STYLE.canvas` в `lib/visual/store.ts`.

**2. Два режима карусели — выбираются на ScriptCard перед генерацией.**
- **Mode B "Photo-rich"** — все слайды с фото-фоном + navy rounded cards (как HWC POST EXAMPLE 1).
- **Mode A "Clean"** — slide 1 cover на фото с дизайном, slides 2..N-1 белый фон + чёрный текст + accent chip сверху, slide N белый CTA с акцентом.
- **UX выбора:** один button `🎴 Make slides` → разворачивается mini-picker внутри карточки `[Photo-rich | Clean]` → "Go". (Вариант B из обсуждения.)
- API `/api/visual/generate` принимает `slide_mode: 'photo' | 'clean'` (default = `'clean'`).

**3. Mode A "Clean" — структура (5 слайдов минимум).**
Доверено агенту, выглядит так:
- Slide 1 (cover) — фото-фон + accent chip сверху ("Mental Health" / "GLP-1" — берётся из matched category) + большой headline (тема/hook) + subhead. Логотипа НЕТ.
- Slide 2-4 (body) — белый фон + accent-coloured chip сверху ("The Science", "How it works", "What this means for you") + body text чёрным. Маленький логотип-марка bottom-right.
- Slide 5 (cta) — белый фон + крупный headline ("Ready to start?" / "Curious if this fits?") + 1-line body + accent-coloured "Book a consultation — link in bio" + полный логотип bottom-center.

**4. Триггеры категорий — без изменений.**
Оставить `lib/posts/categories.ts DEFAULT_CATEGORIES` как есть (Mounjaro в Pain & Joint и Weight Loss НЕ дублируется, как ошибочно предлагалось ранее).

**5. Новая фича: "Import existing script".**
Дополнительный вход на дашборд (admin или doctor) — paste готовый script text в textarea → сразу генерим карусель из него (минуя writer). Использует тот же splitter + новые шаблоны. Полезно когда у врача есть свой написанный пост.
- UI: новый button или секция "Have a script already? Paste it here" на дашборде, с textarea + mode-picker + Make slides.
- Endpoint: extend `/api/visual/generate` чтобы принимать `rawScript` вместо `scriptId`. Сначала сохраняем в `scripts` (без variant_id, без critic), потом рендерим.

### План выполнения (когда вернёмся к работе)

| # | Шаг | Файлы | Время |
|---|---|---|---|
| 1 | Расширить `VisualStyle` + добавить `TypedSlide` + `SlideMode` | `types/index.ts` | 15 мин |
| 2 | Новый `DEFAULT_VISUAL_STYLE`: canvas 1080×1350, brand colors (HWC navy/sky как стартовый дефолт), per-mode defaults | `lib/visual/store.ts` | 15 мин |
| 3 | Splitter возвращает `TypedSlide[]` с поддержкой mode (5 слайдов в clean, 4-5 в photo-rich) | `lib/visual/slides.ts` | 30 мин |
| 4 | Шаблоны: cover/body/cta каждый с двумя modes (photo-rich vs clean) — итого 6 path'ов | `lib/visual/templates/{cover,body,cta,shared}.ts` | 90 мин |
| 5 | Dispatcher + backwards compat (старые `slide_sets` со строками рендерятся как clean body) | `lib/visual/templates.ts` | 15 мин |
| 6 | Renderer пробрасывает typed slides | `lib/visual/renderer.ts` | 15 мин |
| 7 | `/api/visual/generate` принимает `slide_mode` + опц. `rawScript` | `app/api/visual/generate/route.ts` | 20 мин |
| 8 | Style Editor: 5 brand color picker'ов + canvas size dropdown | `app/visual/components/StyleEditor.tsx` | 30 мин |
| 9 | ScriptCard: button раскрывает mode-picker | `app/dashboard/components/ScriptCard.tsx` | 25 мин |
| 10 | Новая секция "Import script" на /dashboard | `app/dashboard/components/ImportScript.tsx` + page.tsx | 30 мин |
| 11 | Локальный тест с HWC scriptом, обоими modes | — | 30 мин |
| 12 | Деплой + verify | — | 15 мин |
| 13 | Обновить §16 — что построено по факту | `HANDOFF.md` | 15 мин |
| **Total** | | | **~5.5 часов** |

### Что пользователь получает после билда

- Любая генерация → выбор режима → за ~30 сек готовый PNG-zip.
- **Photo-rich** = HWC EXAMPLE 1 layout, ~85% совпадение pixel-perfect (зависит от шрифта).
- **Clean** = editorial минимализм, фото только на cover, body белые, CTA с accent-акцентом.
- Brand colors настраиваются в Style Editor — primary navy, accent sky-blue, card text white, surface white, surface text near-black. HWC по дефолту.
- Логотип клиники из `clinics.logo_url` подставляется автоматом.
- Категория и фото-фоны (для photo-rich) подбираются по trigger-словам из топика (механика уже работает).
- Опция "Import existing script" — paste своего готового текста, минуя writer.

### НЕ в этом релизе (явно)

- Serif-headline mode (POST EXAMPLE 3) — отдельная задача после.
- Per-template font picker в UI — defaults в коде.
- Photo overlay opacity slider — захардкожено.
- Auto-photo selection per slide type — все слайды одной категории.
- Pixel-perfect шрифт (HWC использует Montserrat / Poppins, у нас Inter Black) — calibration после первого реального теста.

*Design ledger создан: 2026-04-28*

---

## 17. POSTS GENERATION — VERCEL FIX + FORMAT-LIBRARY EXPANSION (обновлено 2026-05-07)

Раздел существует чтобы любая будущая сессия могла поднять контекст без расспросов и сразу продолжить с шага, на котором остановились.

### Что сделано в этой сессии (2026-05-07, after-fix)

1. **Puppeteer на Vercel — переключён.** `puppeteer ^24.42.0` (full) выехал в `devDependencies` для локалки. В runtime используется `puppeteer-core ^24.43.0` + `@sparticuz/chromium ^148.0.0`. `lib/visual/renderer.ts` детектит serverless по `process.env.VERCEL || AWS_LAMBDA_FUNCTION_NAME || NETLIFY` и подменяет launcher. `next.config.mjs` объявляет три пакета как `serverComponentsExternalPackages` чтобы webpack их не бандлил.
2. **Format templates library.** Новая таблица `script_templates` (миграция `008_script_templates.sql`) — структурные шаблоны (system critique, patient story и т.д.), отдельно от few-shot (last — голос+тема). Поля: `name`, `description`, `scaffold`, `length_bias` (`short`/`long`/null). Endpoints: `/api/posts/templates` (GET/POST) и `/api/posts/templates/[templateId]` (PATCH/DELETE). UI: `app/visual/components/TemplatesEditor.tsx` подключён как новый details-блок в Posts Workspace. Writer теперь требует чтобы каждая variant ссылалась на template_name; SharedContext тащит активные templates и фильтрует по length_bias.
3. **Long+Short pair generation.** Миграция `009_script_length_target.sql` добавляет `scripts.length_target` (`short`|`long`|null) и `scripts.pair_id`. `runWriter` принимает `lengthTarget` и подменяет beat-budget (short = 200-220 слов / ~90 c, long = 420-540 слов / ~2.5 мин). `runCritic` теперь параметризован тем же `lengthTarget` (не зашит на 200-220). `/api/posts/generate` принимает `length: 'short'|'long'|'both'`. При `'both'` — две генерации параллельно с общим `pair_id`; рендерим карусель только для short, long остаётся text-only. UI Posts Workspace: pill-picker `[Short | Long | Both]`.
4. **Posts gallery filters.** `loadPosts` подтягивает `length_target` и `pair_id` из linked scripts. PostsWorkspace: чипы фильтра по категории (4 clinic_categories) и длине (`short`/`long`/all), счётчик `filtered / total`, в карточке поста — chip с `length_target` и название категории.
5. **Per-slide AI fix chat.** Новый агент `lib/agents/slide-fixer.ts` правит ровно ОДИН слайд по инструкции врача. Endpoint `POST /api/posts/[slideSetId]/slide-refine` принимает `{ index, instruction }`, переписывает только этот слайд, ререндерит его в одиночку (single-slide render), сохраняет в БД, возвращает новый текст + preview + опциональный warning (если pretty-fixer override'нул инструкцию из-за hard rules). UI: `app/visual/components/SlideEditor.tsx` — на каждом слайде живёт preview сбоку + "✦ Ask AI to fix this slide" → inline chat-поле.
6. **Smoke script** `scripts/smoke-render.mjs` для быстрой проверки puppeteer launch (`node scripts/smoke-render.mjs` локально или `--vercel` для serverless путя).

### Pre-deploy чеклист (дополнение к §15)

- Накатить миграции `008_script_templates.sql` и `009_script_length_target.sql` в Supabase SQL Editor.
- Vercel env: ничего нового не добавилось.
- Vercel function memory: рекомендуется поставить **1024 MB** на `/api/posts/generate` и `/api/posts/[slideSetId]/slide-refine` в Vercel dashboard (chromium прожорлив на cold start; default 1024 на Pro обычно ок).
- На Hobby плане endpoint `/api/posts/generate` упрётся в 10-секундный лимит — `maxDuration = 300` работает только на Pro.

### Что работает (подтверждено 2026-05-07, до правок этой сессии)

- `/api/posts/generate` отдаёт **HTTP 200** на dev. На warm dev: `200 in 277653ms`. Возврат: 7 текстовых слайдов + 7 PNG-превью (`data:image/png;base64,…`), категория сматчилась («Medical Weight Loss» в smoke-тесте).
- Изолированный smoke `puppeteer.launch + screenshot` (1080×1080) рендерит 3 слайда за ~1.7 c после прогрева.
- `npx tsc --noEmit` чистый.

### Что сломано / под подозрением

1. **Vercel deploy: `puppeteer` не найдёт Chromium.**
   - В `package.json` стоит `puppeteer ^24.42.0` (full). Локально Chromium лежит в `~/.cache/puppeteer/chrome/mac_arm-147.0.7727.57/`, в serverless build Vercel этой папки не будет — postinstall-скрипт не скачивает бинарник в production install, и даже если бы скачивал, размер > лимита Lambda layer.
   - Нужный фикс: `puppeteer-core` + `@sparticuz/chromium-min` (или `@sparticuz/chromium`), `launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: chromium.headless })` в `lib/visual/renderer.ts`.
2. **`maxDuration = 300` впритык.**
   - Live-замер: 277 c суммарно. Anthropic-вызовы (writer 3 варианта Sonnet 4.6 + critic Opus 4.7 + splitter) дают ~270 c. Puppeteer ~3 c.
   - Vercel **Hobby**: лимит 10 c — упадёт мгновенно. **Pro**: до 300 c — на грани.
3. **Локально перебивали миграцию `005_clinic_categories.sql`** (содержимое было `щл`). Восстановлена 2026-05-07 через `git checkout HEAD --`. Больше следов не осталось.

### Цель к концу следующей сессии

«**`/api/posts/generate` стабильно отвечает HTTP 200 на Vercel и UI получает PNG.**» Скорость не главная метрика, но не должно быть таймаута. Локальная скорость не оптимизируем.

### Definition of done

- [ ] `puppeteer` заменён на `puppeteer-core` + `@sparticuz/chromium*`.
- [ ] `lib/visual/renderer.ts` использует `executablePath` из chromium-пакета на Vercel и обычный chromium локально (определять по `process.env.VERCEL` или `AWS_LAMBDA_FUNCTION_NAME`).
- [ ] Один деплой-прогон на Vercel, в логах функции `/api/posts/generate` видно `200 in <300000>ms`. UI получает превью.
- [ ] HANDOFF §17 обновлён фактом результата + дата.

### План (последовательно)

| # | Шаг | Файл / команда | ETA |
|---|-----|----------------|-----|
| 1 | Поставить puppeteer-core + @sparticuz/chromium-min, удалить full puppeteer | `package.json`, `npm i` | 5 мин |
| 2 | Переписать `launchBrowser` в renderer | `lib/visual/renderer.ts` | 15 мин |
| 3 | Локальный smoke (как 2026-05-07): `node /tmp/cm-render-smoke.mjs`, проверить что PNG всё ещё рендерятся | — | 10 мин |
| 4 | Закоммитить, задеплоить на Vercel, дёрнуть `/api/posts/generate` через UI | — | 10 мин |
| 5 | Если 200 — обновить §17 (status: shipped). Если 500 — собрать логи функции, диагностика | Vercel logs | 15 мин |
| 6 | (опц.) Если упирается в `maxDuration` на Pro — split-эндпоинт: `/api/posts/draft` (writer+critic, ~10 c) → отдельный `/api/posts/render` (splitter+puppeteer, ~5 c). UI показывает «rendering…» между ними. | новые route'ы + UI | 1.5 ч |

### Что менять НЕ нужно

- **Migration 007** — уже валидна, накатили локально. Никаких правок.
- **Текущий UI flow `/visual` Posts Workspace** — он функционально корректен, ломается только на этапе render.
- **Anthropic-модели** — `claude-sonnet-4-6` / `claude-opus-4-7`, не трогаем (см. memory ledger).

### Стартовый промпт для новой сессии

> Продолжаем работу над `/api/posts/generate` (см. HANDOFF §17). Цель — стабильная PNG-генерация на Vercel. Локально подтвердил 200 OK + 7 PNG за ~277c. Подозрение — puppeteer не находит Chromium в serverless. Иду по плану §17 шаг 1.

*Раздел создан: 2026-05-07*

---

## 18. TELEGRAM TEAM + VIDEO PIPELINE + COST OPTIMISATION (создан 2026-05-08)

Большой раунд изменений. Любая будущая сессия должна сначала прочитать §17 (puppeteer fix), потом эту §18 и **только** потом трогать что-то новое.

### Что сделано в этой сессии (хронологически)

1. **Diagnostic layer** — `/api/diag?clinicId=…` (admin only). Возвращает env presence, Supabase ping, Drive per-category status (folder ok / photo count / first-photo data-URL ok). Использовать всегда **до** ковыряния в Vercel logs.
2. **Drive photos на review-путях** — фото подгружались только в момент `/api/posts/generate`. На просмотре, save & re-render, slide-refine, download — все рендерили с `photoUrl: null` → navy fallback. Создан `lib/visual/photos.ts loadPhotoUrlsForSlideSet()` и подключён во всех 4 путях. Drive auth требует SA env vars в Vercel — добавил `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` (раньше там не было ни одной).
3. **Categories ↔ Drive folders** — все 4 категории получили `drive_folder_id` через SQL: mental_health → Ketamin pics, pain_joint → Neuropathy pics, wellness_vitality + weight_loss → Lifestyle. Recursive walker позволяет потом перенести фото в категорийные папки без правки кода.
4. **Cost optimisation (~70-85% cut)**:
   - `callAgentJSON` поддерживает `cacheSystem: true` → system prompt с `cache_control: ephemeral`
   - Включён на writer / critic / splitter / slide-fixer / analyst / video-prompter / router-agent
   - Выключен на research + diff (cron, TTL не попадает)
   - splitter / slide-fixer / analyst / diff / video-prompter / router-agent перенесены на **Haiku 4.5** (`claude-haiku-4-5-20251001`)
   - Writer + critic остались на Sonnet 4.6 / Opus 4.7
   - **Важно:** Haiku не поддерживает `thinking: adaptive` — `callAgentJSON` сама стрипает этот параметр для моделей с `haiku` в id
5. **Video pipeline** — новая вкладка `/visual?tab=videos` в workspace
   - `lib/replicate/client.ts` — REST wrapper для Replicate
   - `lib/agents/video-prompter.ts` — Haiku генерит Seedance prompt (использует grammar 15 Seedance-скилов в `~/.claude/skills/`)
   - `lib/videos/store.ts` — DB + Storage helpers
   - Migration 010 (накатили): table `video_sets` + bucket `clinic-videos`
   - User подключил карту `*3697` в Replicate, token в Vercel env `REPLICATE_API_TOKEN`
   - **Стоимость: pay-as-you-go.** ~$0.05/сек lite, ~$0.10/сек pro. Default `bytedance/seedance-2-0-lite`, 5 сек, 9:16, 720p.
   - **Higgsfield не используется** — пользователь явно отказался от subscription
6. **Telegram team layer** — два бота, conversational LLM router
   - **`@contenmachinebot`** (id `8602999392`) — content production. Webhook ЖИВЁТ ВНУТРИ Content Machine на `/api/telegram/webhook`. v0. Admin chat id `469658442` (Igor).
   - **`@hawaiiwellnessclinicbot`** (id `8584854971`) — HWC ops. Webhook **НЕ ЗАРЕГИСТРИРОВАН** (отложено пользователем).
   - Personas в `lib/team/personas.ts` (Marek/Tilda/Ren/Iris/Vex/Ops для content). Ops team (Dax/Nova/Pia/Cal/Quill) задокументирована в `~/Code/team-router/README.md`, но **код не написан**.
   - Router в `lib/team/router-agent.ts` — Haiku 4.5, читает свободный текст, выбирает агента, пишет ответ от его лица. **БЕЗ slash-команд** — пользователь явно отверг CLI-стиль.
   - Telegram env vars в Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_IDS`, `TELEGRAM_WEBHOOK_SECRET`
   - Webhook secret сгенерирован openssl, хранится в `~/Code/team-router/secrets.md` (gitignored) и в Vercel env
7. **Standalone team-router scaffold** — `~/Code/team-router/` (отдельный git repo, ещё не задеплоен). Cloudflare Worker `wrangler.toml`, README + ARCHITECTURE.md описывают двух-bot дизайн, persona-stub в `src/agents/_personas.ts` зеркалит то что в Content Machine. Миграция v0 → standalone CF Worker — следующая сессия.

### Skills + MCP (user-wide)

Установлены 21 скил в `~/.claude/skills/`:
- 15 Seedance video prompt skills (`seedance-cinematic`, `seedance-3d-cgi`, …)
- 6 Anthropic official: `frontend-design`, `canvas-design`, `theme-factory`, `web-artifacts-builder`, `claude-api`, `skill-creator`

Playwright MCP установлен user-scope: `claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest`. Chromium browser binary скачан (~165MB).

**Активируются на старте новой сессии**, не в текущей.

### Известные TODO для следующей сессии

| # | Задача | ETA |
|---|---|---|
| 1 | Реальные handoff'ы content-bot agents — Marek → /api/posts/generate, Tilda → /api/posts/[id], Ren → /api/videos/generate, Iris → Sonar API, Ops → /api/diag, Vex → billing readers | 1-2 ч |
| 2 | Перенос content-bot logic из `app/api/telegram/webhook` в standalone `~/Code/team-router/` CF Worker | 1 ч |
| 3 | Активация ops-bot (`@hawaiiwellnessclinicbot`) — Dax, Nova, Pia, Cal, Quill agents, Meta Ads / Google Calendar / EHR API подключения | 3-5 ч |
| 4 | Step instrumentation в `/api/posts/generate` — `step('writer', …)` / `step('splitter', …)` оборачивающий каждый этап, ошибки тегаются именем step'а | 30 мин |
| 5 | Conversation history в Telegram bot — Supabase tables `tg_messages`, `tg_sessions` для контекста между сообщениями | 1 ч |

### Что менять НЕ нужно

- **Slash-команды** — пользователь явно отверг. Только `/start`, `/help` оставлены (Telegram-конвенция).
- **Higgsfield subscription** — отказались, видео через Replicate. Не возвращаться к Higgsfield API без явной просьбы.
- **Computer Max $200/мес** — рассмотрели и отвергли.
- **Покупка GPU-компьютера** — рассмотрели, математика не сходится для текущего объёма (≥1000 видео/мес для окупаемости).
- **Дублирование команд между двумя ботами** — Vex (billing) единственный shared. Остальные bot-scoped.

### Pre-deploy чеклист (для новой сессии)

- HANDOFF.md §15-18 прочитан
- `npx tsc --noEmit` чисто
- `/api/diag?clinicId=…` зелёный по всем subsystem
- Если меняешь Anthropic-модели — проверь что Haiku не получит `thinking:adaptive`
- Если меняешь Drive — проверь что photoUrls возвращаются как data URLs, не webContentLink

### Стартовый промпт для следующей сессии

> Возвращаюсь в Content Machine. Прочитай HANDOFF §15-18 и memory entries. Текущее состояние: telegram bot @contenmachinebot v0 живёт внутри Content Machine, conversational router на Haiku работает. Следующий приоритет — реальные handoff'ы (Marek → /api/posts/generate и т.д.) или активация ops-bot @hawaiiwellnessclinicbot. Скилы должны быть активны (21 шт user-wide) — используй `claude-api` для Agent SDK кода.

*Раздел создан: 2026-05-08*

### Late-day decisions (2026-05-08, end of session)

**Storage strategy fixed:**
- Google Drive = primary cloud for videos + Premiere `.prproj` files
- Local hard disk = manual cold backup (user moves files himself when Drive nears full)
- Supabase = small assets only (slide PNGs, post references). Not video archive.
- Telegram notification when Drive ≥ 90% full → Vex or Ops pings user
- AI-generated B-roll → Drive too, in per-clip subfolder

**Replicate video gen on hold:**
- $20 prepaid in user's account
- User wants to test in Replicate's playground first (`replicate.com/bytedance/seedance-2-0-lite`) — see what Seedance actually produces before committing API integration
- Ren agent stays as v0 ack until user picks specific use cases
- Don't push video gen integration until user explicitly asks

**Team autonomy reframed:**
- User pushed back on "team can't fix anything, only Claude Code can"
- Honest split: agents OWN behaviour (prompts, preferences, few-shot, diff_rules) stored in DB, self-update via Telegram feedback
- Claude Code OWNS structure (new agents, new APIs, bug fixes, deploys)
- When wiring real handoffs: store every preference / rule / learning in DB, NOT code

**Doctor video upload pipeline (planned for next session):**
- New tab `/clips` in Content Machine
- Doctor uploads iPhone recording
- Whisper transcribes ($0.006/min, OPENAI_API_KEY needed — not yet in env)
- Detect silences/fillers from transcript → ffmpeg cuts
- Auto-captions overlay from same transcript
- Export cleaned mp4 → Drive + downloadable in app
- 90% automated; 10% edge cases need Premiere (user has Premiere already, AutoEdit plugin trial recommended for talking-head cleanup)

**Next session order (re-confirmed end-of-day):**
1. Confirm Drive photos work on a NEW post (not the old `1568ae3c-...` slide_set — that one has no category linkage)
2. Wire real handoffs in Telegram bot — Marek calls /api/posts/generate, Tilda calls /api/posts/[id], Ops calls /api/diag, etc
3. Build `/clips` doctor video cleanup pipeline (if priority shifts up)
4. Long-form video stitching (~/Code/video-editor ffmpeg pipeline) — only after user confirms playground tests look good

## 19. TELEGRAM TEAM v1 — BRIEFING + REAL HANDOFFS + SELF-EVOLUTION (создан 2026-05-09)

Закрыли разрыв «агенты ничего не знают о проекте». В этом раунде команда получила реальный брифинг из DB на каждый ход, реальные руки на 4 из 6 агентов, и таблицы для self-evolution через Telegram-фидбек.

### Что сделано

1. **Migration 011** (`011_agent_self_evolution.sql`) — три таблицы per-clinic, per-agent:
   - `agent_prompts` — версионируемый override system-prompt'а агента (active=true → используется в брифе)
   - `agent_preferences` — JSONB префы (`marek.default_length=short`, `ren.paused=true`, etc)
   - `agent_learnings` — timestamped фидбек, `feedback_kind in (positive|negative|correction|rule)`, `rule` — durable текст правила
   - RLS как у `video_sets` — `app.clinic_id` setting
   - **Накатить в Supabase SQL Editor вручную после деплоя.**
2. **`lib/team/agent-store.ts`** — load/upsert функции для трёх новых таблиц + `Json` cast для `prefs` (иначе тайпы supabase ругаются).
3. **`lib/team/brief.ts`** — `loadTeamBrief(clinicId)` собирает в одном `Promise.all`: clinic_profile, categories+drive_folders, recent_picks, diff_rules, style_template, latest slide_set, pending plan topics, per-agent {prompt_override, prefs, learnings}. `formatBriefForRouter()` рендерит в стабильный markdown — стабильность важна для prompt-cache hit.
4. **`lib/team/personas.ts`** — расширен интерфейс `AgentPersona.tools: AgentTool[]`. Каждый tool: `{id, description, enabled}`. Ren.generate_video помечен enabled=false (paused per §18 addendum).
5. **`lib/team/router-agent.ts`** — v1: возвращает `{agent, intent, params, ack}`. System prompt = base + brief, оба в одном cacheable text-блоке (`cacheSystem:true`). Router валидирует intent против tools агента — если LLM галлюцинирует tool которого у агента нет / disabled, intent downgrade'ится в `chat`.
6. **Real handoffs (`lib/team/handoffs/`):**
   - `marek.ts` — `runMarekGeneratePost` зовёт `runWriter → runCritic → splitScriptToSlides → getPhotosFromFolder → renderSlides → createSlideSet` напрямую (без HTTP-хопа), потом `tgSendMediaGroup` с 7 PNG + caption=topic+hook + ссылка на /posts/[id]
   - `ops.ts` — `runOpsDiag` повторяет логику /api/diag и форматит в Telegram-friendly текст с 🟢/🔴
   - `iris.ts` — `runIrisResearch` зовёт Perplexity Sonar если `PERPLEXITY_API_KEY` set, иначе ack «not configured»
   - `vex.ts` — `runVexBilling` — пока v0: репортит env-presence + ссылки на дашборды (Anthropic/Replicate/Vercel/OpenAI). Реальные billing readers — следующий пасс
   - `tilda.ts` — `runTildaReRender` берёт latest slide_set (или указанный id), пере-загружает фото, пере-рендерит, постит album
   - `ren.ts` — отдельного файла нет, dispatcher шлёт ack в случае generate_video (disabled tool)
   - `index.ts` — `dispatchHandoff()` switchboard на intent → handoff
7. **`lib/team/telegram.ts`** — `tgSend / tgChatAction / tgSendMediaGroup / tgSendPhoto` хелперы. Album использует multipart FormData с `attach://photo_N` references.
8. **Двухроутный async-паттерн на Vercel:**
   - `/api/telegram/webhook` (maxDuration=30s) — secret check, brief load, router call, ack send, fire-and-forget POST в `/api/telegram/dispatch`, return 200
   - `/api/telegram/dispatch` (maxDuration=300s) — secret check (header `x-internal-dispatch-secret`), `dispatchHandoff()`, post results back через Telegram
   - Next.js 14.2 — нет `after()` API, поэтому split на два роута. Когда поднимем Next 15 — можно слить.
9. **agent_learnings auto-capture** — webhook эвристикой ловит short-form feedback в новом сообщении (`/^(rule:|always |never |stop |don'?t |fix:|actually,?\s)/i`, 👍/👎, и т.д.) и пишет в `agent_learnings` под последнего агента которого выбрал router. Brief'ы в следующих ходах подсасывают эти rules.
10. **Tools-интроспекция через GET /api/telegram/webhook** — теперь возвращает `team[].tools` (id list) для дебага что роутер видит.
11. **Seed script** `scripts/seed-agent-defaults.mjs` — idempotent, пишет дефолтные `agent_preferences` для clinic. Запуск: `node --env-file=.env.local scripts/seed-agent-defaults.mjs --clinicId=<HWC_uuid>`. Запускается опционально — без него brief just не emit'ит «## per-agent overrides» секцию.

### Env-переменные для Vercel (новые)

| Var | Зачем |
|---|---|
| `TELEGRAM_DEFAULT_CLINIC_ID` | UUID клиники (HWC). Webhook пользует для clinic resolution. Без неё webhook отвечает «not set» и handoff не запускается. |
| `NEXT_PUBLIC_APP_URL` | Уже было — теперь используется ещё и для review-link в Marek's caption + dispatch URL fallback. |
| `PERPLEXITY_API_KEY` | Опционально, Iris fallback'ит без него. |

### Tool list (что реально работает)

- **Marek:** `generate_post` ✅ (writer→critic→render→sendMediaGroup), `refine_script` ⚠️ ack-only (TODO в next pass)
- **Tilda:** `re_render_slides` ✅ (latest или by id), `change_style` ⚠️ ack-only (style edits TODO)
- **Ren:** `generate_video` ❌ disabled (paused per §18 addendum)
- **Iris:** `web_research` ✅ если `PERPLEXITY_API_KEY` set, иначе ack
- **Vex:** `billing_report` ✅ env-presence + dashboard links (real readers TODO)
- **Ops:** `diag` ✅ env + Supabase + Drive per-category checks

### Pre-deploy чеклист

- [ ] Накатить migration 011 в Supabase SQL Editor
- [ ] Добавить `TELEGRAM_DEFAULT_CLINIC_ID` в Vercel env (production + preview)
- [ ] (Опционально) `node --env-file=.env.local scripts/seed-agent-defaults.mjs --clinicId=<HWC>`
- [ ] `npx tsc --noEmit` чисто (✅ на момент создания §19)
- [ ] Re-deploy webhook URL не нужен — путь тот же, secret тот же

### Smoke test в Telegram (после деплоя)

1. `/help` — видно команду без изменений
2. «Marek, draft a short post on TMS for treatment-resistant depression» — должен прийти ack от Marek + через 60-180с album из 7 слайдов с caption + ссылка на /posts/[id]
3. «Ops, run diag» — green/red отчёт по env / Supabase / Drive
4. «no, the hook was generic» — auto-capture как `feedback_kind='negative'` под marek (видно в `agent_learnings` SQL)
5. «rule: never start a hook with "Did you know"» — auto-capture как `feedback_kind='rule'`. В следующем `generate_post` brief включит это правило.

### Что НЕ делалось в этом раунде

- Реальные billing readers (Anthropic Usage API + Replicate billing) — Vex пока v0
- Refine path для Marek — ack-only
- Style editing для Tilda — ack-only
- Запись `agent_action` (что именно сделал handoff) в `agent_learnings` — пока null'ы. Полезно для аудита, но не блокер.
- Standalone CF Worker миграция (`~/Code/team-router/`) — content-bot всё ещё внутри Content Machine. Перенос остаётся в TODO §18.

### Стартовый промпт для следующей сессии

> Возвращаюсь в Content Machine. Прочитай HANDOFF §15-19 и memory entries. Telegram team теперь живёт с briefing layer + 4 рабочими handoff'ами + agent_learnings auto-capture. Migration 011 накачена. Следующие приоритеты: (a) refine_script для Marek + change_style для Tilda; (b) реальные billing readers для Vex; (c) перенос content-bot в standalone CF Worker; (d) ops-bot активация.

*Раздел создан: 2026-05-09*

## 20. /CLIPS PIPELINE — DOCTOR VIDEO CLEANUP (создан 2026-05-09)

Pax — новая персона, owner doctor video clip cleanup pipeline. Полный авто-пайплайн: Whisper транскриб → ffmpeg silence/filler cuts → captions burn-in → Drive upload. Триггер из Telegram, всё через Drive (без Telegram-аплоадов чтобы не упереться в 50MB лимит).

### Архитектура

```
[Doctor uploads .mp4/.mov to Drive Clips/Inbox/]
        ↓
[Telegram: «Pax, process inbox» (или похожее)]
        ↓
[router → intent: clip_clean → handoffs/pax → fetch /api/clips/process]
        ↓
[/api/clips/process (max 300s on Vercel Pro):]
  1. listInboxClips() — Drive API list
  2. for each new file:
     a. download to /tmp
     b. ffmpeg extract audio mono mp3 64kbps
     c. Whisper transcribe (verbose_json + segment timestamps)
     d. plan cuts: drop pure-filler segments + collapse > 0.6s gaps
     e. ffmpeg apply cuts (concat filter) → cut.mp4
     f. build .srt with REMAPPED timestamps (post-cut timeline)
     g. ffmpeg burn captions → final.mp4
     h. createClipFolder under Cleaned/ + upload cleaned.mp4 + transcript.txt + transcript.srt
     i. moveFileToFolder → original out of Inbox into per-clip folder
     j. clips table row → status=cleaned
        ↓
[Pax sends Telegram message per clip with duration delta + Drive folder link]
```

### Файлы

| Файл | Что |
|---|---|
| `supabase/migrations/012_clips.sql` | `clips` таблица — clinic_id, drive_inbox_file_id, drive_clip_folder_id, status, durations, cut counts, artifact ids, RLS |
| `types/supabase.ts` | + clips Row/Insert/Update |
| `lib/google/drive.ts` | scope расширен `drive.readonly → drive` (full); + `getDriveClient()` экспорт |
| `lib/clips/drive.ts` | `listInboxClips / downloadDriveFileToBuffer / createClipFolder / uploadFileToFolder / moveFileToFolder / clipFolderUrl` |
| `lib/clips/whisper.ts` | OpenAI Whisper API wrapper (verbose_json + segment granularity) |
| `lib/clips/cuts.ts` | `planCuts(segments, totalDuration)` — strict filler regex (`um/uh/ah/er/hmm`), `MIN_SILENCE_SEC=0.6`, returns keep[] |
| `lib/clips/srt.ts` | `buildSrt(intervals)` — remapped timestamps for post-cut timeline |
| `lib/clips/ffmpeg.ts` | `extractAudioMp3 / applyCuts / burnCaptions` — spawn `@ffmpeg-installer/ffmpeg` |
| `lib/clips/store.ts` | `upsertPendingClip / markClipProcessing / markClipCleaned / markClipFailed / loadRecentClips` |
| `lib/clips/pipeline.ts` | `processClip(params)` — оркестратор всех шагов с /tmp cleanup в finally |
| `lib/team/personas.ts` | + Pax persona (✂️) с tools `clip_clean`, `clip_status` |
| `lib/team/handoffs/pax.ts` | Telegram-friendly wrapper, **fetch'ит `/api/clips/process`** (НЕ импортит pipeline directly — иначе ffmpeg утянет в dispatch bundle) |
| `lib/team/handoffs/index.ts` | + cases `clip_clean`, `clip_status` |
| `app/api/clips/process/route.ts` | maxDuration=300, secret-gated, листает Inbox или принимает `inboxFileId`, возвращает results[] |
| `package.json` | + `@ffmpeg-installer/ffmpeg ^1.1.0` (~50MB binary, fits Vercel function size) |

### Drive folder layout (создаёт оператор вручную, ids в env)

```
HWC root /
└── Clips /
    ├── Inbox /          ← GOOGLE_DRIVE_CLIPS_INBOX_ID — doctor drops files here
    └── Cleaned /         ← GOOGLE_DRIVE_CLIPS_CLEANED_ID — pipeline creates per-clip subfolders
        └── 2026-05-09_TMS_intro / (auto-created)
            ├── raw.mov              (moved from Inbox)
            ├── cleaned.mp4          (after cuts + captions)
            ├── transcript.txt       (Whisper full text)
            └── transcript.srt       (remapped timestamps)
```

### Env-переменные (новые)

| Var | Зачем |
|---|---|
| `OPENAI_API_KEY` | Whisper API ($0.006/min audio) |
| `GOOGLE_DRIVE_CLIPS_INBOX_ID` | Drive folder id для drop'ов от доктора |
| `GOOGLE_DRIVE_CLIPS_CLEANED_ID` | Drive folder id где pipeline создаёт per-clip папки |

### Bundle split (важно)

Pax handoff в `/api/telegram/dispatch` НЕ импортит `lib/clips/pipeline` напрямую — фетчит `/api/clips/process` по HTTP. Иначе бандл dispatch'а потянет ffmpeg (50MB) поверх chromium (165MB) который уже там за счёт Marek-handoff → renderSlides — упрёмся в 250MB Vercel функции. Тот же паттерн, что webhook→dispatch.

### Vercel constraints

- Function maxDuration = 300s. Хватает на 5-10 мин клип. Длиннее — Whisper chunking + background не реализованы, fallback = error от Pax.
- /tmp = 512MB. Pipeline удаляет промежуточные файлы (`raw.mp4 → audio.mp3 → cut.mp4 → final.mp4`) сразу после использования. Peak ~400MB на 5-мин 1080p клипе.
- Whisper API limit = 25MB на файл. Audio extract @ 64kbps mono = ~30KB/sec → клип <50 мин. Безопасно.

### Pre-deploy чеклист

- [ ] Накатить migration 012 в Supabase SQL Editor
- [ ] Создать Drive папки `Clips/Inbox/` и `Clips/Cleaned/`, расшарить с SA email
- [ ] Vercel env: `OPENAI_API_KEY`, `GOOGLE_DRIVE_CLIPS_INBOX_ID`, `GOOGLE_DRIVE_CLIPS_CLEANED_ID`
- [ ] `npm install` локально (✅ ffmpeg-installer добавлен)
- [ ] Push → Vercel deploy
- [ ] `npx tsc --noEmit` чисто (✅ на момент создания §20)

### Smoke test

1. Доктор кидает `.mov` в `Clips/Inbox/`
2. В Telegram: «Pax, обработай инбокс»
3. Ack от Pax — «found 1 clip, processing…»
4. Через 2-4 мин — message с durations + Drive folder link
5. В Drive folder: `cleaned.mp4` (с captions), `transcript.txt`, `transcript.srt`, `raw.mov` (moved out of Inbox)
6. SQL: `select * from clips where clinic_id=...` — row со status='cleaned'

### Конфигурация cuts (lib/clips/cuts.ts)

- `STRICT_FILLER_REGEX` — только pure-filler сегменты (`um/uh/ah/er/hmm` и phonetic вариации). Сознательно консервативно — не режет «you know», «like», «I mean» (контекст-зависимые).
- `MIN_SILENCE_SEC = 0.6` — gaps больше этого считаются silence.
- `COMPRESSED_GAP_SEC = 0.15` — оставляем micro-pause после cut чтобы не звучало как jump-cut.

Если хочется агрессивнее резать — оператор пишет в Telegram «rule: also cut "you know"» → сохранится в `agent_learnings`, в следующей сессии Claude Code переносит правило в код (или подцепляем agent_prompts override).

### Captions style (lib/clips/ffmpeg.ts:burnCaptions)

Reels/Shorts-friendly: Arial 22pt, white text, black box с alpha, bottom-centered (MarginV=60). libass `force_style` параметры. Подкручивается одной строкой если оператор скажет «captions крупнее» / «другой шрифт».

### Что НЕ сделано

- Cron poll для Inbox (сейчас только manual trigger через Telegram). Можно добавить Vercel cron `*/30 * * * *` с тем же `/api/clips/process` endpoint.
- Whisper chunking для клипов >25MB audio (сейчас error)
- Длинные клипы (>10 мин) — упрутся в Vercel 300s. Решение: вынести в Modal / Cloud Run / батч-обработка.
- Auto-detect language — сейчас Whisper определяет сам, но если язык не EN, captions всё равно generated. Тестировать на не-EN клипах перед production.
- Вырезка repetitions / restart («Let me start over», «Sorry, again») — не реализовано. Текущие cuts только filler/silence.

### Стартовый промпт для следующей сессии

> Возвращаюсь в Content Machine. Прочитай HANDOFF §15-20 и memory entries. /clips pipeline (Pax) деплоен. Migration 012 накатена. Следующие приоритеты: (a) cron poll для Inbox; (b) Whisper chunking для длинных клипов; (c) repetition cuts (LLM pass на segments чтобы дропать «let me start over» части); (d) Marek refine_script + Tilda change_style; (e) перенос content-bot в standalone CF Worker.

*Раздел создан: 2026-05-09*

## 21. CAPTIONS + TTL + VERIFY + REFINE + 1-HOP DELEGATION (создан 2026-05-09)

Раунд который превратил Telegram-команду из «дублирует лендинг» в «meta-слой для фиксов и самопроверки».

### Что сделано

1. **Caption generation alongside script** (Migration 013)
   - `scripts.short_caption` + `scripts.long_caption` (TEXT)
   - `lib/agents/captioner.ts` — Haiku 4.5, `cacheSystem:true`, runs ONLY on winner
   - Wired в `/api/posts/generate` + `lib/team/handoffs/marek.ts` (gen + refine paths)
   - Возвращается в `GenerateOneResult.short_caption / long_caption`
   - Telegram-message Marek-а теперь включает `*Short caption*` блок
   - Errors recoverable — если captioner упал, slide pipeline идёт дальше

2. **doctor_notes TTL** (Vercel cron)
   - `app/api/cron/cleanup-doctor-notes/route.ts` — DELETE WHERE created_at < now() - 3 days
   - `vercel.json` cron `0 3 * * *` daily
   - Auth: `CRON_SECRET` (Bearer) или `x-internal-dispatch-secret` для manual trigger
   - Аналитик уже извлекает signal в insights/few_shot_library/diff_rules — raw notes больше не нужны после 3 дней

3. **Verify tools** (`lib/team/handoffs/verify.ts`)
   - `verify_post` (Marek) — load slide_set + script → re-run critic → check diff_rules substring violations → 🟢/🟡/🔴 report
   - `verify_clip` (Pax) — load latest clip → check duration_ratio (over-cut <0.4 / under-cut >0.95), transcript presence, status flag
   - `verify_render` (Tilda) — re-render head+tail of slide_set → check buffer sizes (1KB-5MB band) → flag drift

4. **refine_post handoff** (`lib/team/handoffs/marek.ts:runMarekRefinePost`)
   - By slide_set_id (или latest) + note → loads existing script → `runWriter({refineFrom, variantCount:1})` → critic → captioner → split + photos + render → new slide_set (старый стоит для сравнения) → posts album с критик-оценкой и review-ссылкой
   - Inherits `drive_folder_id` + `category_id` от родительского slide_set

5. **Inter-agent delegation 1-hop** (`lib/team/handoffs/types.ts`)
   - `HandoffResult = void | DelegateRequest` — handoff может вернуть `{ delegate: { agentKey, intent, params, reason } }`
   - Dispatcher: `runOne()` отрабатывает основной handoff, если возвращает delegate — постит «↳ {agent} called in: {reason}» и запускает второй handoff. **Один уровень глубины** (если B тоже возвращает delegate — игнор).
   - Сценарии работают:
     - `verify_post` score < 6 → delegate Marek `refine_post`
     - `verify_post` ≥2 diff_rule violations → delegate Marek `refine_post`
     - `verify_clip` failed status with Drive error → delegate Ops `diag`
     - `verify_render` abnormal sizes → delegate Ops `diag`

6. **Personas обновлены** — добавлены tools: `refine_post`, `verify_post`, `verify_render`, `verify_clip`, `daily_check`. `refine_script` → переименован в `refine_post` (alias оставлен в dispatcher для backwards compat).

7. **Router-agent.ts** — обновлены Tool param schemas в system prompt (новые intents задокументированы).

### Файлы (этот раунд)

| Файл | Что |
|---|---|
| `supabase/migrations/013_script_captions.sql` | + `short_caption`/`long_caption` columns на scripts |
| `types/supabase.ts` | + caption fields в Row/Insert/Update scripts |
| `lib/agents/captioner.ts` | новый Haiku агент |
| `lib/supabase/context.ts` | + `updateScriptCaptions()` |
| `app/api/posts/generate/route.ts` | wire captioner после critic, return captions |
| `app/api/cron/cleanup-doctor-notes/route.ts` | новый cron route |
| `vercel.json` | + cron entry |
| `lib/team/handoffs/types.ts` | новый — `HandoffResult`/`DelegateRequest` |
| `lib/team/handoffs/verify.ts` | новый — 3 verify функции с auto-delegate |
| `lib/team/handoffs/marek.ts` | + `runMarekRefinePost` (~190 строк) + caption integration в gen path |
| `lib/team/handoffs/index.ts` | refactor: `runOne()` + `dispatchHandoff()` обертка с 1-hop |
| `lib/team/personas.ts` | + 5 new tools |
| `lib/team/router-agent.ts` | обновлены Tool param schemas |

### Env-переменные (новые)

| Var | Зачем |
|---|---|
| `CRON_SECRET` | Vercel автоматом аттачит `Authorization: Bearer ${CRON_SECRET}` к крон-запросам. Если set — cleanup-doctor-notes требует его. |

### Pre-deploy чеклист

- [ ] Накатить migration 013 в Supabase SQL Editor
- [ ] Vercel env: `CRON_SECRET` (любая random строка)
- [ ] Re-deploy → Vercel сам зарегистрит cron-расписание из `vercel.json`
- [ ] `npx tsc --noEmit` чисто (✅)

### Smoke test

1. **Caption test:** в лендинге сгенерь пост → проверь `select short_caption, long_caption from scripts where id=...` — должны быть заполнены
2. **TTL test:** вручную POST в `/api/cron/cleanup-doctor-notes` (с `Authorization: Bearer ...`) → ответ `{ok: true, deleted: N}`
3. **verify_post:** в Telegram «Marek, verify the last post» → должен прийти 🟢/🟡/🔴 report с критик-оценкой и feedback
4. **verify_post degradation → refine:** если найден существующий пост со score < 6 (или с явными diff_rules violations) — Marek сам шлёт «↳ Marek called in: verify flagged …» и запускает refine
5. **verify_clip:** «Pax, check the last clip» → durations + ratio + status report
6. **refine_post:** «Marek, refine the last post — hook is too generic» → ack + 60-180с → новый album с уточнённым скриптом + caption
7. **delegation:** искусственно — поломать GOOGLE_PRIVATE_KEY → сделать verify_render → должен прилететь delegate в Ops diag

### Что НЕ сделано

- **Daily Ops digest** — `daily_check` сейчас alias к `diag`, но не запущен по крон расписанию. Нужно: добавить cron `0 9 * * *` → POST в новый `/api/cron/daily-ops` который зовёт `runOpsDiag` для дефолтной clinic + шлёт в admin TG чат если что-то красное.
- **agent_action capture** в `agent_learnings` — пока null'ы. Нужно: после каждого handoff писать «Marek refined slide_set X with note Y» в `agent_action` чтобы история была audit-able.
- **Multi-hop delegation** — текущий cap 1. Если понадобится A → B → C — снимать ограничение с counter-based depth.
- **`change_style` real impl** — пока ack-only. Нужен update of `slide_sets.style_template` + сохранение в `agent_preferences[tilda]`.
- **Captioner auto-rerun на refined posts** — works (refine path вызывает captioner). Но если operator скажет «just regenerate the caption» (script ok) — отдельного intent нет. Tool `regenerate_caption` следующим раундом.

### Стартовый промпт для следующей сессии

> Возвращаюсь в Content Machine. Прочитай HANDOFF §15-21 и memory entries. Caption generation, doctor_notes TTL, verify tools, refine_post, 1-hop delegation — деплоены. Migration 013 накачена. Следующие приоритеты: (a) daily Ops digest cron; (b) agent_action capture в learnings; (c) change_style real impl; (d) regenerate_caption tool; (e) перенос content-bot в standalone CF Worker.

*Раздел создан: 2026-05-09*

## 22. PRODUCT SPLIT — CLINIC WHITE-LABEL + STUDIO STANDALONE (создан 2026-07-02)

Стратегический раунд: закрыта продуктовая развилка «клиника vs масс-маркет». Решение — **один движок, две обёртки**. Этот раздел — единый источник договорённостей для всех параллельных сессий: решения, детальные планы по каждому процессу, процесс апрувала постинга. Кода в этом раунде не менялось — только документация.

### 22.1 Решения (зафиксировано 2026-07-01)

1. **Один движок — две обёртки.** Клиника first, standalone second. Не два отдельных репозитория: одна кодовая база, любое улучшение ядра достаётся обоим продуктам.
2. **Клиника = white-label.** Команда Игоря настраивает платформу per-clinic (темы, шаблоны, тон). Setup-by-team — это модель, не времянка. Drive остаётся (UX команды клиники). Buffer остаётся — тонкий адаптер `app/api/publish/buffer/route.ts` (~130 строк), генерация про Buffer не знает, swap на другой провайдер = соседний route-файл.
3. **Standalone = приложение для креаторов говорящих видео** (эксперты, коучи, малый бизнес). НЕ конкурируем с шаблонными монтажёрами (Vids AI, CapCut) — их поле «красивые нарезки из фото/видео», наше — «что сказать, как снять, быстро почистить».
4. **Флоу standalone:** чужой reel → разбор (движок studio/analyze) → сценарий под свою тему → телепромптер → авточистка (движок clips) → **правка через текст** → экспорт/постинг.
5. **Ручной монтаж = transcript-based editing** (Descript-модель), НЕ таймлайн-редактор. UI поверх Whisper-сегментов + cut-plan: транскрипт с зачёркнутыми вырезками, tap = toggle сегмента, trim краёв. Предпросмотр — плеер перепрыгивает вырезанные диапазоны на клиенте; серверный рендер (ffmpeg) только на финальном экспорте. Решает «ИИ пропустил повтор/паузу» без постройки CapCut.
6. **Хранение:** клиника — Google Drive (как сейчас); consumer — Supabase Storage (прямая загрузка, без Drive).
7. **Постинг consumer поэтапно:** v1 share sheet → v2 агрегатор → v3 свои апрувалы (детали в 22.4). Instagram API личным аккаунтам недоступен в принципе — share sheet это не костыль, а стандарт категории.
8. **Экономика consumer:** кредиты/лимиты с первого дня (урок kill switch: pay-per-use LLM сжёг бюджет на одном клиенте), paywall сразу, free-tier без кредитной карты не делаем.
9. **Web-first.** Мобильное приложение (App Store, платежи, ревью) — только после первых денег.

### 22.2 Track 1 — клиника (порядок и статусы)

| # | Процесс | Статус | Детали |
|---|---|---|---|
| 1 | Compliance: `compliance_safe` в `CriticScore.criteria` (6 полей) + `critic.ts` → `callAgentTool` с явной JSON Schema + `MODEL_CRITIC` (opus-4-7) | ⏳ в параллельной сессии, незакоммичено | `types/index.ts`, `lib/agents/critic.ts` — НЕ трогать из других сессий |
| 2 | Compliance Layer B гейт — `lib/agents/compliance.ts` по `docs/COMPLIANCE-INTEGRATION.md` (REMOVE/REWORD/REVIEW/PASS, блок REMOVE/REWORD перед publish) | ❌ | после п.1, та же сессия ядра |
| 3 | Монтаж: cron-подхват Drive Inbox (вместо ручного триггера через Pax) | ✅ 2026-07-02 | `app/api/cron/clips-inbox/route.ts`, vercel.json `*/30 * * * *`; требует env `CLIPS_DEFAULT_CLINIC_ID` (нет — no-op); skip: processing/failed/cleaned (failed = retry только вручную, чтобы битый файл не жёг Whisper каждый тик); cap 3 клипа/тик + дедлайн 180s на подхват новых |
| 4 | Монтаж: вырезание повторных дублей («ещё раз сначала», «sorry, again») — LLM-проход по Whisper-сегментам | ✅ 2026-07-02 | `lib/clips/retakes.ts` (Sonnet — решение об удалении контента, Haiku слаба, решили 2026-07-02; callAgentTool, fail-open: любая ошибка/kill switch → 0 дропов, пайплайн живёт); врезка в `pipeline.ts` шаг 4; guard: >40% дропов = галлюцинация, игнор; `retake_count` в ProcessClipResult |
| 5 | Монтаж: Whisper chunking >25MB audio (ролики >~50 мин) | ❌ | `lib/clips/whisper.ts` |
| 6 | Монтаж: очередь батч-обработки (Upstash) + ролики >10 мин (Cloud Run) | ❌ отложено | делать когда реально упрёмся в лимит |
| 7 | Drive per-clinic: авто-создание папки клиники при онбординге (`{Клиника — Врач}/Inbox|Originals|Finals`) + пайплайн раскладывает по ним + `/clips` viewer в вебе | ✅ 2026-07-02 | Migration 037 (4 колонки drive_*_folder_id на clinics), `lib/google/clinicFolders.ts` (provision при POST /api/onboarding, non-fatal), `lib/clips/drive.ts` параметризован (нет колонок → легаси env-папки, HWC работает без изменений), original → Originals/, готовое → Finals/{клип}/, cron обходит ВСЕ provisioned-клиники + легаси Inbox. Новый env: `GOOGLE_DRIVE_CLINICS_ROOT_ID` (родитель папок клиник; не задан → provision no-op). Viewer: `app/clips/page.tsx` — статус/длительность/вырезки/ссылки Final-Original-Folder, view-only. Клиника свой Drive НЕ подключает — white-label |
| 8 | Word-level таймкоды Whisper (`timestamp_granularities[]=word`) + артефакт `words.json` (words + segments + cut plan) в папку клипа | ✅ 2026-07-02 | `lib/clips/whisper.ts` (+`WhisperWord`), `pipeline.ts` (best-effort upload, не роняет клип). Сырьё для текстового редактора Track 2 п.6 — клипы с этого дня можно ре-монтировать пословно без повторной транскрибации. Цена Whisper та же |
| 9 | Видео-бот: TG-уведомление врачу/команде «клип готов» после cron-обработки (ссылки Final/Folder) — сейчас cron тихий | ❌ | хук после `markClipCleaned` в cron-роуте → Telegram sendMessage; chat_id клиники |
| 10 | Caption-стили пресетами: 3-4 визуальных шаблона субтитров (шрифт/размер/цвет/подложка/позиция) на выбор | ❌ | `burnCaptions` уже параметризуется одной строкой libass `force_style` (§20); пресеты в коде + колонка `caption_style` на clinics; выбор в UI. Обязательно для масс-маркета (Track 2), приятно для клиник |

### 22.3 Track 2 — Studio standalone (процессы подробно)

Аудит кода 2026-07-01: `lib/studio/analyze.ts` — чистый (ноль clinic-зависимостей); привязка к clinic_id сидит в DB-слое, роутах и `loadSharedContext`. Пайплайн /clips уже полностью серверный (Vercel + ffmpeg + Whisper API), Drive там только I/O-папки.

| # | Процесс | Оценка | Что делать |
|---|---|---|---|
| 1 | Выделение движка | 2-3 дня | развязать `lib/studio/addByUrl.ts` / `slots.ts` от clinic_id → workspace_id; контекст инъекцией параметром вместо `loadSharedContext(clinicId)`; DB-insert наружу из функций |
| 2 | Consumer auth + billing | 3-4 дня | Supabase email/OAuth (не clinic-cookie), Stripe subscription, кредиты: 1 разбор ролика = 1 кредит, N кредитов в подписке |
| 3 | Хранилище/библиотека | 1-2 дня | загрузка видео в Supabase Storage bucket, «папка» пользователя (список, превью, удаление) |
| 4 | Телепромптер | 1-2 дня | уже работает для клиник; отвязать от clinic-auth и Drive-иерархии (`lib/google/recordings.ts`) → workspace + Storage |
| 5 | Авточистка видео | 1-2 дня | реюз `lib/clips/pipeline.ts` целиком; заменить только I/O-адаптер Drive→Storage; лимит ~10 мин — ок для рилсов |
| 6 | Ручной редактор через текст | 4-6 дней | транскрипт с зачёркиванием, toggle на уровне СЛОВ (word-level таймкоды уже пишутся пайплайном — Track 1 п.8, `words.json`), trim краёв; клиентский предпросмотр skip-ranges (без серверного рендера); экспорт = пересборка ffmpeg по обновлённому cut-plan |
| 7 | Экспорт + share sheet | ~1 день | готовый файл → системное «Поделиться» (IG/TikTok/YouTube), ноль согласований |
| 8 | Постинг по API | этапами | см. 22.4 |

### 22.4 Процесс апрувала постинга (полный, чтобы не блокировал запуск)

- **Instagram/Facebook (Meta Graph API).** Только business/creator аккаунты — личные нельзя в принципе (не наш недостаток, ограничение платформы). Шаги: Meta Business verification → создать Meta App → запросить permissions (`instagram_content_publish`, `instagram_basic`, `pages_manage_posts`, `pages_read_engagement`) → App Review со скринкастами use-case → production access. Срок: недели. Rate limit: ~25 API-постов/сутки на IG-аккаунт.
- **TikTok Content Posting API.** Отдельная заявка на developers.tiktok.com + аудит приложения; unaudited-приложения могут постить только приватно (SELF_ONLY). Срок: 1-2 недели.
- **YouTube Data API.** Квота по умолчанию мала (upload ≈ 1600 units при default 10k/день); повышение — через audit-форму.
- **Средний путь — агрегаторы (Ayrshare и аналоги).** Их приложения уже прошли все апрувалы; подключение = их OAuth-виджет + их API. Плюс: старт за дни. Минус: платишь per-user, дороже на объёме.
- **Рекомендация по этапам:** v1 = share sheet (запуск не блокируется вообще) → v2 = агрегатор, когда появились платящие → v3 = собственные апрувалы Meta/TikTok при объёме (экономия на агрегаторе). Заявки на апрувалы подавать параллельно с v2 — сроки длинные, пусть идут фоном.

### 22.5 Координация сессий

- **Сессия ядра/compliance** владеет: `lib/agents/critic.ts`, `types/index.ts`, будущий `lib/agents/compliance.ts`. Правки там сейчас незакоммичены — другим сессиям эти файлы не трогать и не коммитить.
- **Сессия Track 2 (standalone)** — отдельная полоса. Точки пересечения с ядром: `lib/studio/*`, `lib/clips/*` — перед правкой проверять `git status`.
- **HANDOFF §22 — единый источник договорённостей.** Закрыл пункт таблицы — обнови статус (❌ → ✅ с датой). Новые решения — дописывать в 22.1, не переписывать историю.

### 22.6 Что НЕ решено (открытые вопросы)

- Название / бренд / домен standalone-продукта; юрлицо и разделение биллинга.
- Цена подписки и размер кредитного пакета.
- Какой агрегатор для v2-постинга (Ayrshare vs аналоги) — выбрать по ценам, когда дойдём.
- ИИ-аватар (говорящая ИИ-модель на камеру): рекомендация Claude 2026-07-02 — НЕ делать. Ядро продукта = настоящее лицо врача/креатора (доверие); аватары = чужая гонка (HeyGen/Synthesia, дорогая пер-минутная генерация) + compliance/доверие-риск для мед-контента. Caption-стили (Track 1 п.10) закрывают «визуальное разнообразие» дешевле. Вернуться только если клиенты явно попросят.

### Стартовый промпт для следующей сессии

> Возвращаюсь в Content Machine. Прочитай HANDOFF §22 (product split) + §20-21. Определи свою полосу: ядро/compliance (Track 1 пп.1-2) или клиничный монтаж (Track 1 пп.3-5) или Studio standalone (Track 2). Возьми следующий ❌-пункт из таблицы своего трека, перед правкой общих файлов проверь `git status` (координация сессий — §22.5). По завершении обнови статус пункта в таблице.

*Раздел создан: 2026-07-02*
