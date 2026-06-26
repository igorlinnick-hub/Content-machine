'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'crew-checklist-v1'

type CheckItem = { id: string; label: string }
type Step = {
  id: string
  emoji: string
  title: string
  subtitle: string
  owner?: string
  items: CheckItem[]
  notes?: string
}

const STEPS: Step[] = [
  {
    id: 'setup',
    emoji: '📷',
    title: 'Camera Setup',
    subtitle: 'Pre-show — before doors open',
    items: [
      { id: 'wb', label: 'Выставить White Balance на всех камерах — один и тот же Kelvin (5600K день / 3200K вечер)' },
      { id: 'gopro-pos', label: 'CAM 1 GoPro — поставить на clamp на DJ столе, угол: hands + CDJs + crowd over-shoulder' },
      { id: 'gopro-set', label: 'CAM 1 GoPro — 4K 60fps, Protune ON, Color: Flat, Shutter 1/120s, ISO max 1600, HyperSmooth OFF' },
      { id: 'gopro-nd', label: 'CAM 1 GoPro — ND фильтр clip-on если яркое солнце (ND8 или ND16)' },
      { id: 'gopro-rec', label: 'CAM 1 GoPro — запустить запись, проверить что пишет' },
      { id: 'insta-pos', label: 'CAM 2 Insta360 X4 — поставить на C-stand высоко, DJ + толпа в одном кадре' },
      { id: 'insta-set', label: 'CAM 2 Insta360 — 8K 30fps, Color: LOG, Shutter 1/60s, FlowState ON' },
      { id: 'insta-rec', label: 'CAM 2 Insta360 — запустить запись, проверить что пишет' },
      { id: 'sony-shade', label: 'CAM 3 Sony A7 — держать в тени, не оставлять на солнце без присмотра' },
      { id: 'sony-set', label: 'CAM 3 Sony — 4K 24fps, PP8 (S-Log3), Shutter 1/48s, переменный ND, ISO 800' },
      { id: 'ref-shot', label: 'Снять референсный кадр: все три камеры на один объект (белый лист или лицо) для матчинга' },
    ],
  },
  {
    id: 'shoot',
    emoji: '🎬',
    title: 'During the Set',
    subtitle: 'Во время сета',
    items: [
      { id: 'gopro-check', label: 'GoPro пишет (красная точка видна)' },
      { id: 'insta-check', label: 'Insta360 пишет' },
      { id: 'sony-check', label: 'Sony держать в тени между съёмками' },
      { id: 'broll', label: 'B-roll iPhone — снимать толпу, детали, реакции, свет' },
      { id: 'gopro-bat', label: 'Проверить батарею GoPro в середине сета' },
      { id: 'insta-bat', label: 'Проверить батарею Insta360 в середине сета' },
    ],
  },
  {
    id: 'offload',
    emoji: '💾',
    title: 'Copy to Hard Drive',
    subtitle: 'После сета — сразу, не откладывать',
    items: [
      { id: 'gopro-stop', label: 'Остановить запись GoPro, достать карту / подключить по USB' },
      { id: 'insta-stop', label: 'Остановить запись Insta360, достать карту / подключить по USB' },
      { id: 'folder', label: 'Создать папку на харде: YYYY-MM-DD_EventName' },
      { id: 'copy-gopro', label: 'Скопировать все файлы с GoPro → папка /CAM1_GoPro' },
      { id: 'copy-insta', label: 'Скопировать все файлы с Insta360 → папка /CAM2_Insta360' },
      { id: 'copy-iphone', label: 'Скопировать B-roll с iPhone → папка /CAM3_iPhone' },
      { id: 'copy-sony', label: 'Скопировать материал с Sony (если снимал) → папка /CAM3_Sony' },
      { id: 'verify', label: 'Проверить: открыть по одному файлу из каждой папки, убедиться что играет' },
      { id: 'space', label: 'Проверить что на харде осталось место для следующего ивента' },
    ],
  },
  {
    id: 'drive',
    emoji: '☁️',
    title: 'Upload to Google Drive',
    subtitle: 'Brandon — после получения харда',
    owner: 'Brandon',
    items: [
      { id: 'recv', label: 'Получил хард от команды' },
      { id: 'drive-folder', label: 'Создать папку в Google Drive: Events / YYYY-MM-DD_EventName' },
      { id: 'upload-all', label: 'Загрузить все папки (CAM1, CAM2, CAM3) в Drive' },
      { id: 'upload-verify', label: 'Проверить размер папки в Drive = размер на харде' },
      { id: 'notify', label: 'Написать команде что материал в Drive готов к редактуре' },
    ],
    notes: 'Ссылку на Drive папку кинуть в общий чат после загрузки.',
  },
  {
    id: 'edit',
    emoji: '✂️',
    title: 'Ready to Edit',
    subtitle: 'Редактор — после загрузки в Drive',
    items: [
      { id: 'access', label: 'Открыть папку в Google Drive, скачать на рабочую машину' },
      { id: 'lut-gopro', label: 'CAM 1 GoPro: применить GoPro Flat → Rec709 LUT' },
      { id: 'lut-insta', label: 'CAM 2 Insta360: reframe в Insta360 Studio, применить Insta360 Log LUT' },
      { id: 'lut-sony', label: 'CAM 3 Sony: применить S-Log3 → Rec709 LUT (Sony official)' },
      { id: 'match', label: 'Color match: подтянуть GoPro и Insta360 под Sony (Sony — референс)' },
      { id: 'ref-use', label: 'Использовать референсный кадр (белый лист) из начала съёмки как точку отсчёта' },
    ],
  },
]

function useChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setChecked(JSON.parse(saved))
    } catch {}
  }, [])

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const reset = () => {
    setChecked({})
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  return { checked, toggle, reset }
}

export default function CrewPage() {
  const { checked, toggle, reset } = useChecklist()
  const [open, setOpen] = useState<string | null>('setup')

  const totalItems = STEPS.flatMap(s => s.items).length
  const doneCount = STEPS.flatMap(s => s.items).filter(i => checked[i.id]).length
  const progress = Math.round((doneCount / totalItems) * 100)

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest">Crew</p>
            <h1 className="text-lg font-semibold">Shoot Checklist</h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#0ea5e9]">{progress}%</p>
            <p className="text-xs text-white/40">{doneCount}/{totalItems}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 max-w-lg mx-auto h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0ea5e9] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {STEPS.map((step) => {
          const stepDone = step.items.filter(i => checked[i.id]).length
          const stepTotal = step.items.length
          const isOpen = open === step.id
          const allDone = stepDone === stepTotal

          return (
            <div
              key={step.id}
              className={`rounded-2xl border transition-all ${
                allDone
                  ? 'border-green-600/40 bg-green-900/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {/* Step header */}
              <button
                className="w-full text-left px-4 py-4 flex items-center gap-3"
                onClick={() => setOpen(isOpen ? null : step.id)}
              >
                <span className="text-2xl">{step.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{step.title}</p>
                    {step.owner && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#0ea5e9]/20 text-[#0ea5e9] shrink-0">
                        {step.owner}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{step.subtitle}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-medium ${allDone ? 'text-green-400' : 'text-white/50'}`}>
                    {stepDone}/{stepTotal}
                  </span>
                  <span className={`text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </button>

              {/* Items */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-2">
                  {step.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className="w-full flex items-start gap-3 text-left py-2"
                    >
                      <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                        checked[item.id]
                          ? 'bg-green-500 border-green-500'
                          : 'border-white/30'
                      }`}>
                        {checked[item.id] && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-sm leading-snug ${checked[item.id] ? 'text-white/30 line-through' : 'text-white/80'}`}>
                        {item.label}
                      </span>
                    </button>
                  ))}

                  {step.notes && (
                    <p className="mt-2 text-xs text-[#0ea5e9]/70 bg-[#0ea5e9]/10 rounded-xl px-3 py-2">
                      {step.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Reset */}
        <div className="pt-4 text-center">
          <button
            onClick={() => {
              if (confirm('Сбросить весь чеклист?')) reset()
            }}
            className="text-xs text-white/20 hover:text-white/40 transition-colors py-2 px-4"
          >
            Сбросить чеклист
          </button>
        </div>
      </div>
    </main>
  )
}
