# Camera Shoot Plan — DJ Events

## Сетап (3 камеры)

### CAM 1 — GoPro Hero 13 Black — Table Clamp (stationary, always on)
**Позиция:** Clamp прямо на DJ столе, смотрит на DJ — hands, CDJs, faders, crowd over-shoulder  
**Режим:** Locked off, пишет весь сет без остановки

**Настройки:**
- Resolution: **4K 60fps**
- Protune: **ON**
- Color: **Flat** (не GoPro Color — нужен Flat для матчинга)
- White Balance: **Manual / Locked** — выставить до начала (напр. 5600K днём, 3200K при искусственном свете)
- Shutter: **1/120s** (правило 180° при 60fps)
- ISO Max: **1600** (день) / **3200** (вечер/indoor)
- EV Comp: **-0.5**
- Sharpness: **Low**
- HyperSmooth: **Off** (стоит на clamp, стабилизация не нужна)
- ND Filter: clip-on ND8 или ND16 если яркий день
- Audio: **Off** (звук пишется отдельно)

**В посте:** Apply GoPro Flat → Rec709 LUT, затем color match под Sony

---

### CAM 2 — Insta360 X4 — C-Stand Elevated (stationary, always on)
**Позиция:** C-stand высоко, смотрит на DJ + толпа в одном кадре  
**Режим:** Locked off, 360° — reframe в посте под нужный угол

**Настройки:**
- Resolution: **8K 30fps** (максимум — нужен запас для reframe)
- Color Profile: **LOG** (Insta360 Log для максимального DR)
- White Balance: **Manual / Locked** — тот же Kelvin что и на GoPro
- Shutter: **1/60s** (правило 180° при 30fps)
- ISO: **Auto, max cap 1600**
- Stabilization: **FlowState ON** (даже на стативе — на случай вибраций)
- Audio: **Off**

**В посте:** Apply Insta360 Log LUT → Rec709, reframe в Insta360 Studio или Premiere, затем color match

---

### CAM 3 — Sony A7 — Handheld / B-roll (managed, kept in shade)
**Позиция:** Не оставлять на солнце — держать в тени, доставать для конкретных shots  
**Режим:** B-roll, портреты, детали, hero shots в нужный момент

**Настройки:**
- Resolution: **4K 24fps** (кино-ритм) или 4K 30fps если нужен матч с остальными
- Picture Profile: **PP8 — S-Log3 / S-Gamut3.Cine** (лучший DR, легче матчить)
- White Balance: **Manual / Locked** — тот же Kelvin
- Shutter: **1/48s** при 24fps / **1/60s** при 30fps
- Aperture: **f/2.0–f/2.8** — кино-боке, не уходить в совсем открытую на ярком солнце
- ISO: **800 базовый** (S-Log3 native ISO на A7 зависит от модели — уточни)
- ND Filter: **переменный ND** — обязательно для дня с открытой диафрагмой
- Codec: **XAVC S, 100Mbps+**
- Audio: **Off**

**В посте:** Apply S-Log3 → S-Gamut3.Cine → Rec709 LUT (Sony официальный), затем master color match

---

## Матчинг в посте

**Ключевое правило:** все три камеры должны иметь **одинаковый locked white balance** до начала съёмки — это 80% работы по матчингу.

**Workflow:**
1. Все камеры → Flat/Log профиль
2. Apply camera-specific LUT каждой камере (GoPro Flat, Insta360 Log, Sony S-Log3)
3. Всё приходит в Rec709
4. Вторичная цветокоррекция — подтягиваем GoPro и Insta360 под Sony (Sony — референс, лучшее качество)
5. Export master grade → применить на весь монтаж

**Референсный кадр:** снять все три камеры одновременно на один объект (напр. white card или лицо) в начале дня — использовать как точку отсчёта при матчинге.

---

## Что купить

| Предмет | Цена |
|---------|------|
| GoPro Hero 13 Black | ~$400 |
| Clamp mount (magic arm + cold shoe) | ~$30–50 |
| ND фильтр clip-on для GoPro (ND8/ND16) | ~$20–30 |
| Переменный ND фильтр для Sony (нужный диаметр) | ~$60–100 |

---

*Обновлено: 2026-06-26*
