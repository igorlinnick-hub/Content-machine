# Supabase Setup — Шаг 1

Инструкция для создания Supabase проекта и применения схемы.

---

## 1. Создать проект

1. Открой https://supabase.com/dashboard и войди.
2. **New project** → в любой организации.
3. Заполни:
   - **Name:** `content-machine` (или любое)
   - **Database password:** сгенерируй сильный пароль и сохрани в менеджере паролей (понадобится для прямого SQL доступа, но не для приложения)
   - **Region:** выбери ближайший к тебе/Vercel регион (например `eu-central-1` Frankfurt)
   - **Plan:** Free tier достаточно для MVP
4. Нажми **Create new project** и подожди ~2 минуты пока поднимется.

---

## 2. Применить схему

1. В левом меню: **SQL Editor** → **New query**.
2. Открой файл `supabase/schema.sql` из этого репо, скопируй всё содержимое.
3. Вставь в редактор и нажми **Run** (Ctrl/Cmd+Enter).
4. Проверка: в конце выполни
   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' order by table_name;
   ```
   Должно вернуть 9 таблиц: `clinics`, `diff_rules`, `doctor_notes`, `few_shot_library`, `insights`, `script_finals`, `scripts`, `slide_sets`, `trend_signals`.

---

## 3. Скопировать ключи в `.env.local`

В Supabase dashboard: **Project Settings** → **API**.

| Переменная в `.env.local` | Где взять |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API keys → `service_role` `secret` ⚠️ **никогда не коммить** |
| `SUPABASE_PROJECT_ID` | из URL проекта: `https://<project-id>.supabase.co` → `<project-id>` |

`service_role` ключ нужен серверной стороне Next.js чтобы обходить RLS для cron-джобов и создания клиник. `anon` ключ — для клиентских запросов (с включённым RLS).

---

## 4. Sanity check (опционально)

В SQL Editor:
```sql
-- Проверить что RLS включена
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```
Все 9 таблиц должны иметь `rowsecurity = true`.

```sql
-- Проверить политики
select tablename, policyname from pg_policies
where schemaname = 'public' order by tablename;
```
Должно быть 9 политик вида `clinic_isolation_*`.

---

## 5. После этого

Сообщи мне что схема применена и `.env.local` заполнен — я сгенерирую TypeScript типы (`types/supabase.ts`) и продолжим на Шаг 2 (SharedContext + типы).

**Команда для генерации типов (я запущу сам):**
```bash
npx supabase gen types typescript --project-id <SUPABASE_PROJECT_ID> > types/supabase.ts
```
Для этого нужен `SUPABASE_PROJECT_ID` в `.env.local` и доступ к Supabase (логин через `npx supabase login` — я попрошу тебя запустить это интерактивно).
