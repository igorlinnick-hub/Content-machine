export type Pillar = 'Mental Health' | 'Pain & Joint' | 'Wellness & Vitality' | 'Weight Loss'

export const PILLAR_COLOR: Record<Pillar, string> = {
  'Mental Health':       '#0EA5E9',
  'Pain & Joint':        '#B45309',
  'Wellness & Vitality': '#0F766E',
  'Weight Loss':         '#A855F7',
}

export interface PlanPost {
  num: number
  topic: string
  keyword: string
}

export interface PlanWeek {
  week: number
  theme: string
  pillar: Pillar
  description: string
  posts: PlanPost[]
}

export const PLAN: PlanWeek[] = [
  {
    week: 1,
    theme: 'Ketamine & Brain',
    pillar: 'Mental Health',
    description:
      'What ketamine actually does to the brain, why antidepressants fail 1 in 3 people, and how to recognize when standard treatment has hit its ceiling.',
    posts: [
      { num: 1,  topic: 'What Ketamine Does to Depression',                  keyword: 'RESET'     },
      { num: 2,  topic: 'Antidepressant failure — a biology question',        keyword: 'MECHANISM' },
      { num: 3,  topic: 'Signs standard treatment has hit its ceiling',       keyword: 'SIGNS'     },
    ],
  },
  {
    week: 2,
    theme: 'Hormones & Aging',
    pillar: 'Wellness & Vitality',
    description:
      "Hormones shift, not just decline. Post-40 energy, testosterone beyond the gym, and NAD+ as the cellular spark plug — all three de-mystified for high performers.",
    posts: [
      { num: 4,  topic: 'Hormones after 40 — what actually shifts',           keyword: 'HORMONES'    },
      { num: 5,  topic: "Testosterone isn't about muscle",                     keyword: 'TESTOSTERONE' },
      { num: 6,  topic: 'NAD+ — spark plugs in every cell',                   keyword: 'NAD'          },
    ],
  },
  {
    week: 3,
    theme: 'Pain & Regeneration',
    pillar: 'Pain & Joint',
    description:
      "Painkillers silence the alarm while the tissue keeps breaking down. PRP and shockwave address what's actually happening inside the joint.",
    posts: [
      { num: 7,  topic: "Painkillers don't heal joints",                       keyword: 'JOINT'     },
      { num: 8,  topic: "PRP — your blood's own repair crew",                  keyword: 'PRP'       },
      { num: 9,  topic: 'Shockwave therapy — triggering biology, not numbing', keyword: 'SHOCKWAVE' },
    ],
  },
  {
    week: 4,
    theme: 'Metabolism & Weight',
    pillar: 'Weight Loss',
    description:
      'The body adapts after weight loss — hunger up, metabolism down. GLP-1 medications fix the thermostat; the scale is just the visible result.',
    posts: [
      { num: 10, topic: 'Why diets fail — the adaptation your doctor never explained', keyword: 'METABOLISM' },
      { num: 11, topic: "Semaglutide: the story isn't the scale",                       keyword: 'SEMAGLUTIDE' },
      { num: 12, topic: '30 days on a GLP-1 — what changes first',                     keyword: 'GLP1'        },
    ],
  },
  {
    week: 5,
    theme: 'SGB & Anxiety/PTSD',
    pillar: 'Mental Health',
    description:
      "Anxiety isn't just in your head — it's in your nervous system. SGB briefly cuts power to the hyperactive alarm circuit. TMS trains the underactive one.",
    posts: [
      { num: 13, topic: 'Stellate Ganglion Block for PTSD',     keyword: 'SGB'     },
      { num: 14, topic: "Anxiety isn't only in your head",       keyword: 'ANXIETY' },
      { num: 15, topic: 'TMS for depression — training an underactive muscle', keyword: 'TMS' },
    ],
  },
  {
    week: 6,
    theme: 'Peptides & Recovery',
    pillar: 'Wellness & Vitality',
    description:
      'Peptides are signaling molecules, not steroids. IV delivery bypasses digestion. Vascular health determines more than most patients realize.',
    posts: [
      { num: 16, topic: 'Peptides — a text message to your biology',          keyword: 'PEPTIDE'  },
      { num: 17, topic: 'IV drips — when delivery method matters',            keyword: 'IV'       },
      { num: 18, topic: 'Erectile dysfunction — the canary in the coal mine', keyword: 'VITALITY' },
    ],
  },
  {
    week: 7,
    theme: 'Spravato & Severe Depression',
    pillar: 'Mental Health',
    description:
      "Treatment-resistant depression is a defined medical status. Spravato (FDA-approved esketamine) and the hard conversation around suicidal ideation.",
    posts: [
      { num: 19, topic: 'Spravato — FDA-approved esketamine nasal spray',       keyword: 'SPRAVATO' },
      { num: 20, topic: 'Suicidal ideation — what clinical options exist',      keyword: 'SUPPORT'  },
      { num: 21, topic: '"Just talk to someone" isn\'t enough',                 keyword: 'CLARITY'  },
    ],
  },
  {
    week: 8,
    theme: 'A2M Biologics & Complex Pain',
    pillar: 'Pain & Joint',
    description:
      "A2M guards cartilage from the specific enzymes that degrade it. Retatrutide pulls three metabolic levers at once. A comprehensive panel shows what's actually happening.",
    posts: [
      { num: 22, topic: 'A2M — guards that cuff the cartilage vandals',              keyword: 'A2M'         },
      { num: 23, topic: 'Retatrutide — triple-action metabolic signal',              keyword: 'RETATRUTIDE' },
      { num: 24, topic: 'Comprehensive blood panel — catching fires before they start', keyword: 'PROGRAM'  },
    ],
  },
]

// Plan started June 1 2026. Posts go out Mon / Wed / Fri, 3/week.
export const PLAN_START = new Date('2026-06-01T00:00:00Z')
const POST_DAYS = [1, 3, 5] // Mon=1, Wed=3, Fri=5 (0=Sun)

export interface ScheduledPost {
  date: Date          // UTC midnight
  post: PlanPost
  week: PlanWeek
}

// Build the flat list of scheduled post dates starting from PLAN_START.
// June 1 2026 is a Monday → posts go Mon (+0), Wed (+2), Fri (+4) each week.
function buildSchedule(): ScheduledPost[] {
  const schedule: ScheduledPost[] = []
  const cursor = new Date(PLAN_START) // always Monday of current week

  for (let w = 0; w < 16; w++) { // 2 full 8-week cycles
    const planWeek = PLAN[w % 8]
    for (let p = 0; p < 3; p++) {
      const d = new Date(cursor)
      d.setUTCDate(d.getUTCDate() + [0, 2, 4][p]) // Mon / Wed / Fri
      schedule.push({ date: d, post: planWeek.posts[p], week: planWeek })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return schedule
}

let _cache: ScheduledPost[] | null = null
export function getSchedule(): ScheduledPost[] {
  if (!_cache) _cache = buildSchedule()
  return _cache
}

// Returns which week (1-8) is current, cycling every 8 weeks.
export function getCurrentPlanWeek(now = new Date()): PlanWeek {
  const daysSinceStart = Math.max(
    0,
    Math.floor((now.getTime() - PLAN_START.getTime()) / (1000 * 60 * 60 * 24))
  )
  const weekIndex = Math.floor(daysSinceStart / 7) % 8
  return PLAN[weekIndex]
}
