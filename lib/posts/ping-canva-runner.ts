// Canva runner polls /api/posts/ready-for-canva periodically — no ping needed.
export async function pingCanvaRunner(_params: {
  slideSetId: string
  clinicId: string
  topic: string | null
  origin: string
}): Promise<void> {
  console.log('[ping-canva-runner] skipped — runner polls on its own')
}
