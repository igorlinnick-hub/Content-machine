'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'crew-steps-done-v1'

type SubItem = { icon: string; text: string }
type Step = {
  id: string
  number: number
  emoji: string
  title: string
  who?: string
  summary: string
  sections: { heading: string; items: SubItem[] }[]
}

const STEPS: Step[] = [
  {
    id: 'placement',
    number: 1,
    emoji: '📍',
    title: 'Camera Placement',
    summary: 'Где ставим каждую камеру',
    sections: [
      {
        heading: 'CAM 1 — GoPro',
        items: [
          { icon: '🔩', text: 'Clamp прямо на DJ столе' },
          { icon: '👀', text: 'Угол: руки диджея, CDJs, faders, толпа за спиной' },
          { icon: '📐', text: 'Низкий угол — близко к оборудованию' },
        ],
      },
      {
        heading: 'CAM 2 — Insta360 X4',
        items: [
          { icon: '🎪', text: 'C-stand — высоко, над толпой' },
          { icon: '👀', text: 'В кадре и диджей, и толпа одновременно' },
          { icon: '↕️', text: 'Ставим как можно выше' },
        ],
      },
      {
        heading: 'CAM 3 — Sony A7',
        items: [
          { icon: '🌑', text: 'Держать в тени — перегревается на солнце' },
          { icon: '🚶', text: 'Не оставлять стационарно — используем для конкретных кадров' },
          { icon: '📱', text: 'iPhone снимает B-roll пока Sony в тени' },
        ],
      },
    ],
  },
  {
    id: 'settings',
    number: 2,
    emoji: '⚙️',
    title: 'Camera Settings',
    summary: 'Настройки перед тем как начать снимать',
    sections: [
      {
        heading: 'Первое — White Balance',
        items: [
          { icon: '🌤️', text: 'День на улице → 5600K на всех камерах' },
          { icon: '💡', text: 'Искусственный свет / вечер → 3200K на всех камерах' },
          { icon: '🔒', text: 'Locked (не авто!) — иначе матчить в монтаже невозможно' },
        ],
      },
      {
        heading: 'CAM 1 — GoPro Hero 13',
        items: [
          { icon: '📹', text: '4K 60fps' },
          { icon: '🎨', text: 'Protune ON → Color: Flat (не GoPro Color)' },
          { icon: '⏱️', text: 'Shutter 1/120s' },
          { icon: '🔆', text: 'ISO max 1600, ND фильтр если яркое солнце' },
          { icon: '🔇', text: 'HyperSmooth OFF (стоит на clamp)' },
        ],
      },
      {
        heading: 'CAM 2 — Insta360 X4',
        items: [
          { icon: '📹', text: '8K 30fps (максимум — нужен запас для reframe)' },
          { icon: '🎨', text: 'Color: LOG' },
          { icon: '⏱️', text: 'Shutter 1/60s' },
          { icon: '🔄', text: 'FlowState Stabilization: ON' },
        ],
      },
      {
        heading: 'CAM 3 — Sony A7',
        items: [
          { icon: '📹', text: '4K 24fps' },
          { icon: '🎨', text: 'Picture Profile: PP8 — S-Log3' },
          { icon: '⏱️', text: 'Shutter 1/48s' },
          { icon: '🔆', text: 'ISO 800, переменный ND обязательно' },
          { icon: '📸', text: 'Aperture f/2.0–f/2.8' },
        ],
      },
      {
        heading: 'Референсный кадр',
        items: [
          { icon: '📄', text: 'Снять все три камеры на белый лист или лицо' },
          { icon: '✅', text: 'Это точка отсчёта для color match в монтаже' },
        ],
      },
    ],
  },
  {
    id: 'shoot',
    number: 3,
    emoji: '🎬',
    title: 'Shooting',
    summary: 'Что делаем во время сета',
    sections: [
      {
        heading: 'В начале сета',
        items: [
          { icon: '🔴', text: 'GoPro пишет — красная точка горит' },
          { icon: '🔴', text: 'Insta360 пишет — проверить индикатор' },
          { icon: '📱', text: 'iPhone заряжен и снимает B-roll' },
        ],
      },
      {
        heading: 'Во время сета',
        items: [
          { icon: '🌑', text: 'Sony держать в тени между съёмками' },
          { icon: '🎤', text: 'B-roll: толпа, эмоции, свет, детали, реакции' },
          { icon: '🔋', text: 'В середине сета: проверить батарею GoPro и Insta360' },
        ],
      },
      {
        heading: 'Sony — когда доставать',
        items: [
          { icon: '✨', text: 'Красивый момент: поднятые руки, пик трека' },
          { icon: '🎵', text: 'Drop — достать, снять, убрать обратно в тень' },
          { icon: '👤', text: 'Портрет диджея или кого-то из толпы' },
        ],
      },
    ],
  },
  {
    id: 'offload',
    number: 4,
    emoji: '💾',
    title: 'Copy to Hard Drive',
    summary: 'После сета — сразу, не откладывать',
    sections: [
      {
        heading: 'Создать папку',
        items: [
          { icon: '📁', text: 'Имя папки: YYYY-MM-DD_ИмяИвента' },
          { icon: '📂', text: 'Внутри: /CAM1_GoPro, /CAM2_Insta360, /CAM3_iPhone, /CAM3_Sony' },
        ],
      },
      {
        heading: 'Скопировать всё',
        items: [
          { icon: '📋', text: 'GoPro → /CAM1_GoPro (карта или USB)' },
          { icon: '📋', text: 'Insta360 → /CAM2_Insta360 (карта или USB)' },
          { icon: '📋', text: 'iPhone → /CAM3_iPhone (AirDrop или кабель)' },
          { icon: '📋', text: 'Sony → /CAM3_Sony (карта)' },
        ],
      },
      {
        heading: 'Проверка',
        items: [
          { icon: '▶️', text: 'Открыть по одному файлу из каждой папки — убедиться что играет' },
          { icon: '💿', text: 'Проверить место на харде для следующего ивента' },
        ],
      },
    ],
  },
  {
    id: 'drive',
    number: 5,
    emoji: '☁️',
    title: 'Upload to Google Drive',
    who: 'Brandon',
    summary: 'Brandon загружает материал из харда в Drive',
    sections: [
      {
        heading: 'Создать папку в Drive',
        items: [
          { icon: '📁', text: 'Events → создать папку: YYYY-MM-DD_ИмяИвента' },
        ],
      },
      {
        heading: 'Загрузить',
        items: [
          { icon: '⬆️', text: 'Загрузить все папки (CAM1, CAM2, CAM3) из харда в Drive' },
          { icon: '✅', text: 'Сверить размер: размер в Drive = размер на харде' },
        ],
      },
      {
        heading: 'После загрузки',
        items: [
          { icon: '💬', text: 'Кинуть ссылку на папку в общий чат' },
          { icon: '🔔', text: 'Написать: "Материал загружен, можно редактировать"' },
        ],
      },
    ],
  },
  {
    id: 'edit',
    number: 6,
    emoji: '✂️',
    title: 'Color Match & Edit',
    summary: 'Как привести все камеры к одной картинке',
    sections: [
      {
        heading: 'Шаг 1 — LUTs на каждую камеру',
        items: [
          { icon: '🎨', text: 'GoPro: применить GoPro Flat → Rec709 LUT' },
          { icon: '🎨', text: 'Insta360: reframe в Insta360 Studio, потом Insta360 Log LUT' },
          { icon: '🎨', text: 'Sony: применить S-Log3 → Rec709 LUT (Sony official)' },
        ],
      },
      {
        heading: 'Шаг 2 — Color Match',
        items: [
          { icon: '🎯', text: 'Sony = референс (лучшее качество)' },
          { icon: '🔧', text: 'GoPro и Insta360 подтягиваем под Sony' },
          { icon: '📄', text: 'Использовать референсный кадр (белый лист) из начала съёмки' },
        ],
      },
    ],
  },
]

export default function CrewPage() {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setDone(JSON.parse(saved))
    } catch {}
  }, [])

  const toggleDone = (id: string) => {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const activeStep = STEPS.find(s => s.id === active)
  const doneCount = STEPS.filter(s => done[s.id]).length

  // Step detail view
  if (activeStep) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setActive(null)}
            className="text-[#0ea5e9] text-sm font-medium flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="flex-1" />
          <span className="text-xs text-white/30">Step {activeStep.number} of {STEPS.length}</span>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
          {/* Step title */}
          <div className="mb-8">
            <span className="text-5xl">{activeStep.emoji}</span>
            <div className="mt-3 flex items-center gap-2">
              <h1 className="text-2xl font-bold">{activeStep.title}</h1>
              {activeStep.who && (
                <span className="text-sm px-2 py-0.5 rounded-full bg-[#0ea5e9]/20 text-[#0ea5e9]">
                  {activeStep.who}
                </span>
              )}
            </div>
            <p className="mt-1 text-white/50">{activeStep.summary}</p>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {activeStep.sections.map((section, si) => (
              <div key={si}>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ea5e9] mb-3">
                  {section.heading}
                </p>
                <div className="space-y-2">
                  {section.items.map((item, ii) => (
                    <div
                      key={ii}
                      className="flex items-start gap-3 bg-white/5 rounded-2xl px-4 py-3"
                    >
                      <span className="text-xl mt-0.5 shrink-0">{item.icon}</span>
                      <span className="text-[15px] leading-snug text-white/80">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom action */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => {
                toggleDone(activeStep.id)
                setActive(null)
              }}
              className={`w-full py-4 rounded-2xl text-base font-semibold transition-all ${
                done[activeStep.id]
                  ? 'bg-white/10 text-white/40'
                  : 'bg-[#0ea5e9] text-white active:scale-95'
              }`}
            >
              {done[activeStep.id] ? '✓ Готово' : 'Отметить как выполнено'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Main list view
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 max-w-lg mx-auto">
        <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Crew</p>
        <h1 className="text-3xl font-bold">Shoot Guide</h1>
        <p className="text-white/40 mt-1 text-sm">
          {doneCount === 0
            ? 'Tap a step to see instructions'
            : doneCount === STEPS.length
              ? 'All steps done 🎉'
              : `${doneCount} of ${STEPS.length} steps done`}
        </p>

        {/* Progress dots */}
        <div className="flex gap-2 mt-4">
          {STEPS.map(s => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-all ${
                done[s.id] ? 'bg-[#0ea5e9]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-lg mx-auto px-4 space-y-3 pb-12">
        {STEPS.map((step) => (
          <button
            key={step.id}
            onClick={() => setActive(step.id)}
            className={`w-full text-left rounded-2xl border transition-all active:scale-[0.98] ${
              done[step.id]
                ? 'border-[#0ea5e9]/30 bg-[#0ea5e9]/5'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-center gap-4 px-4 py-4">
              {/* Status indicator */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                done[step.id]
                  ? 'bg-[#0ea5e9] text-white'
                  : 'bg-white/10 text-white/40'
              }`}>
                {done[step.id] ? '✓' : step.number}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{step.emoji}</span>
                  <span className="font-semibold">{step.title}</span>
                  {step.who && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                      {step.who}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/40 mt-0.5 truncate">{step.summary}</p>
              </div>

              <span className="text-white/20 shrink-0">›</span>
            </div>
          </button>
        ))}

        {doneCount > 0 && (
          <div className="text-center pt-4">
            <button
              onClick={() => {
                if (confirm('Сбросить?')) {
                  setDone({})
                  try { localStorage.removeItem(STORAGE_KEY) } catch {}
                }
              }}
              className="text-xs text-white/20 py-2 px-4"
            >
              Сбросить
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
