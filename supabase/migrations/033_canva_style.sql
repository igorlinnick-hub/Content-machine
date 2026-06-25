-- Migration 033 — Canva style selector.
-- Lets the marketer pick between two carousel master designs per post.
-- 1 = current default (CANVA_BRAND_TEMPLATE_ID env var)
-- 2 = second design  (CANVA_BRAND_TEMPLATE_ID_2 env var)

alter table public.slide_sets
  add column if not exists canva_style smallint not null default 1;
