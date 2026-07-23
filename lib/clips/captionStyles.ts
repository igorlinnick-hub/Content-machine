// Caption style presets for the clips pipeline (HANDOFF §22.2 п.10).
// Each preset is a libass force_style string burned in by ffmpeg
// (lib/clips/ffmpeg.ts). The clinic picks a default in the /clips
// video editor tab; the pipeline applies it to every processed clip.
//
// Pure data — safe to import from both server (pipeline) and client
// (style picker). libass colors are &HAABBGGRR (alpha, blue, green,
// red) — NOT web hex.

export interface CaptionStyle {
  key: string
  label: string
  description: string
  forceStyle: string
  /** Word-by-word karaoke animation (ASS burn via lib/clips/ass.ts).
      Falls back to the static forceStyle burn when the transcript has
      no word-level timestamps. */
  animated?: boolean
  /** ASS style for the animated burn. Colours are libass &HAABBGGRR. */
  ass?: {
    fontname: string
    fontsize: number
    primaryColour: string
    secondaryColour: string
    outlineColour: string
    outline: number
    shadow: number
    marginV: number
    bold: boolean
  }
}

export const CAPTION_STYLES: CaptionStyle[] = [
  {
    key: 'classic',
    label: 'Classic Box',
    description: 'White text on a dark box — the original look',
    forceStyle: [
      'Fontname=Liberation Sans',
      'Fontsize=22',
      'PrimaryColour=&H00FFFFFF',
      'OutlineColour=&H00000000',
      'BackColour=&H80000000',
      'BorderStyle=3',
      'Outline=2',
      'Shadow=0',
      'Alignment=2',
      'MarginV=60',
    ].join(','),
  },
  {
    key: 'clean',
    label: 'Clean',
    description: 'White text with a thin outline, no box',
    forceStyle: [
      'Fontname=Liberation Sans',
      'Fontsize=22',
      'Bold=1',
      'PrimaryColour=&H00FFFFFF',
      'OutlineColour=&H00000000',
      'BorderStyle=1',
      'Outline=2',
      'Shadow=1',
      'Alignment=2',
      'MarginV=60',
    ].join(','),
  },
  {
    key: 'bold',
    label: 'Big Bold',
    description: 'Large bold captions — punchy reels style',
    forceStyle: [
      'Fontname=Liberation Sans',
      'Fontsize=28',
      'Bold=1',
      'PrimaryColour=&H00FFFFFF',
      'OutlineColour=&H00000000',
      'BorderStyle=1',
      'Outline=3',
      'Shadow=1',
      'Alignment=2',
      'MarginV=70',
    ].join(','),
  },
  {
    key: 'pop',
    label: 'Yellow Pop',
    description: 'Creator-style yellow captions',
    forceStyle: [
      'Fontname=Liberation Sans',
      'Fontsize=24',
      'Bold=1',
      'PrimaryColour=&H0000FFFF',
      'OutlineColour=&H00000000',
      'BorderStyle=1',
      'Outline=3',
      'Shadow=1',
      'Alignment=2',
      'MarginV=60',
    ].join(','),
  },
  {
    key: 'ocean',
    label: 'Ocean Pop',
    description: 'Animated word-by-word — white text, ocean-blue highlight',
    animated: true,
    // Static fallback (no word timestamps): white text, blue outline.
    forceStyle: [
      'Fontname=Liberation Sans',
      'Fontsize=24',
      'Bold=1',
      'PrimaryColour=&H00FFFFFF',
      'OutlineColour=&H00F6B629',
      'BorderStyle=1',
      'Outline=3',
      'Shadow=1',
      'Alignment=2',
      'MarginV=60',
    ].join(','),
    ass: {
      fontname: 'Liberation Sans',
      fontsize: 72, // PlayRes 1080x1920 — ≈ Fontsize 24 at 360p
      // Spoken word fills ocean blue (#29B6F6 → BGR F6B629); the rest
      // of the line stays white until its moment.
      primaryColour: '&H00F6B629',
      secondaryColour: '&H00FFFFFF',
      outlineColour: '&H00000000',
      outline: 6,
      shadow: 2,
      marginV: 180,
      bold: true,
    },
  },
]

export const DEFAULT_CAPTION_STYLE_KEY = 'classic'

// Unknown / null / pre-migration values fall back to the classic
// preset so the pipeline output never changes under our feet.
export function resolveCaptionStyle(
  key: string | null | undefined
): CaptionStyle {
  return (
    CAPTION_STYLES.find((s) => s.key === key) ??
    CAPTION_STYLES.find((s) => s.key === DEFAULT_CAPTION_STYLE_KEY)!
  )
}
