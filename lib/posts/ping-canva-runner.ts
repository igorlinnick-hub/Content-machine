import { tgSend } from '@/lib/team/telegram'

// Notifies the runner (Canva-bot) that a slide_set was just queued.
// The runner ALSO polls periodically — the ping is just a "wake up
// faster" signal so the marketer doesn't wait the full poll interval.
// Dual-channel: poll is the fallback, ping is the fast path.
//
// Chat target is TELEGRAM_RUNNER_CHAT_ID when set, otherwise the
// first id in TELEGRAM_ADMIN_CHAT_IDS, otherwise a no-op. Failures
// never throw — the queue-into-DB step is the source of truth.

function adminChatId(): string | null {
  const dedicated = process.env.TELEGRAM_RUNNER_CHAT_ID?.trim()
  if (dedicated) return dedicated
  const list = process.env.TELEGRAM_ADMIN_CHAT_IDS?.trim()
  if (!list) return null
  const first = list.split(',')[0]?.trim()
  return first && first.length > 0 ? first : null
}

export async function pingCanvaRunner(params: {
  slideSetId: string
  clinicId: string
  topic: string | null
  origin: string
}): Promise<void> {
  const chat = adminChatId()
  if (!chat) {
    console.log('[ping-canva-runner] no chat id configured, skipping')
    return
  }
  const topicLine = params.topic ? `\n📝 ${params.topic}` : ''
  const url = `${params.origin}/api/posts/ready-for-canva?clinicId=${encodeURIComponent(params.clinicId)}`
  const text =
    `🎨 *New post queued for Canva*${topicLine}\n` +
    `\`slide_set_id: ${params.slideSetId}\`\n` +
    `Poll: ${url}`
  await tgSend(chat, text, { parseMode: 'Markdown', disablePreview: true })
}
