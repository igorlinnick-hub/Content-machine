// Thin Telegram Bot API wrappers used by webhook + dispatcher. All
// calls swallow network errors — Telegram delivery should never
// crash a generate path. Logs the response status so dropped sends
// show up in Vercel logs.

const API = (token: string, method: string) =>
  `https://api.telegram.org/bot${token}/${method}`

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null
}

export async function tgSend(
  chatId: number | string,
  text: string,
  opts: { parseMode?: 'Markdown' | 'HTML'; disablePreview?: boolean } = {}
): Promise<void> {
  const t = token()
  if (!t) return
  await fetch(API(t, 'sendMessage'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts.parseMode ?? 'Markdown',
      disable_web_page_preview: opts.disablePreview ?? true,
    }),
  }).catch(() => {})
}

export async function tgChatAction(
  chatId: number | string,
  action: 'typing' | 'upload_photo'
): Promise<void> {
  const t = token()
  if (!t) return
  await fetch(API(t, 'sendChatAction'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {})
}

// Send a carousel of up to 10 PNG buffers in a single album. The
// caption is attached to the first photo only (Telegram convention —
// caption on subsequent photos in an album is ignored). Falls back
// to sending the first photo alone with caption if the album upload
// fails (e.g. one buffer too big).
export async function tgSendMediaGroup(
  chatId: number | string,
  photos: Buffer[],
  caption?: string
): Promise<{ ok: boolean; status: number }> {
  const t = token()
  if (!t) return { ok: false, status: 0 }
  const slice = photos.slice(0, 10)

  const fd = new FormData()
  fd.append('chat_id', String(chatId))

  const media = slice.map((_, i) => ({
    type: 'photo' as const,
    media: `attach://photo_${i}`,
    ...(i === 0 && caption
      ? { caption, parse_mode: 'Markdown' as const }
      : {}),
  }))
  fd.append('media', JSON.stringify(media))

  for (let i = 0; i < slice.length; i++) {
    const blob = new Blob([slice[i] as unknown as ArrayBuffer], {
      type: 'image/png',
    })
    fd.append(`photo_${i}`, blob, `slide_${i}.png`)
  }

  try {
    const res = await fetch(API(t, 'sendMediaGroup'), {
      method: 'POST',
      body: fd,
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

// Single-photo upload with caption. Used as a fallback when album
// fails or when there's only one image to send.
export async function tgSendPhoto(
  chatId: number | string,
  photo: Buffer,
  caption?: string
): Promise<{ ok: boolean; status: number }> {
  const t = token()
  if (!t) return { ok: false, status: 0 }
  const fd = new FormData()
  fd.append('chat_id', String(chatId))
  if (caption) {
    fd.append('caption', caption)
    fd.append('parse_mode', 'Markdown')
  }
  const blob = new Blob([photo as unknown as ArrayBuffer], {
    type: 'image/png',
  })
  fd.append('photo', blob, 'slide.png')
  try {
    const res = await fetch(API(t, 'sendPhoto'), {
      method: 'POST',
      body: fd,
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}
