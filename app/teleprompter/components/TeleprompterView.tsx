'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  saveDraft,
  loadLatestDraft,
  clearDraft,
  draftAgeLabel,
  type RecordingDraft,
} from '@/lib/client/recording-draft'

type Phase = 'setup' | 'reading' | 'preview' | 'saving' | 'saved'

interface RecentScript {
  id: string
  title: string
  body: string
}

interface SavedRecording {
  id: string
  title: string
  drive_url: string
  duration_sec: number | null
  size_bytes: number | null
  created_at: string
}

interface Props {
  clinicId: string
  clinicName: string
  recentScripts: RecentScript[]
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtBytes(b: number | null) {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function TeleprompterView({ clinicId, clinicName, recentScripts }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [text, setText] = useState('')
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null)
  const [saveTitle, setSaveTitle] = useState('')
  const [speed, setSpeed] = useState(45) // px per second
  const [fontSize, setFontSize] = useState(30)
  const [isScrolling, setIsScrolling] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [wantCamera, setWantCamera] = useState(true)
  const [hasStream, setHasStream] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [driveUrl, setDriveUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  // True after entering reading phase but before doctor taps "Start Recording"
  const [readyToStart, setReadyToStart] = useState(false)

  // Draft recovery state
  const [pendingDraft, setPendingDraft] = useState<RecordingDraft | null>(null)
  const draftIdRef = useRef<string | null>(null)

  // Recordings history
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)   // outer overflow:hidden container
  const textInnerRef = useRef<HTMLDivElement>(null) // inner div — animated via translateY
  const scrollPosRef = useRef(0)                    // current Y offset in px
  const cameraRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef<number>(0)
  const speedRef = useRef(speed)
  const isRecordingRef = useRef(false)
  const startTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Sub-pixel accumulator so any speed value advances smoothly
  const scrollAccRef = useRef(0)

  speedRef.current = speed

  // Check for a pending draft on mount (survives page refresh)
  useEffect(() => {
    loadLatestDraft(clinicId).then(setPendingDraft).catch(() => {})
  }, [clinicId])

  // Fetch recordings history whenever setup phase is entered
  useEffect(() => {
    if (phase !== 'setup') return
    setLoadingHistory(true)
    fetch(`/api/studio/recordings?clinicId=${clinicId}`)
      .then((r) => r.json())
      .then((data) => setSavedRecordings((data as { recordings: SavedRecording[] }).recordings ?? []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [phase, clinicId])

  // Cleanup on unmount — stop camera + recording so the green LED goes away
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (recorderRef.current) {
        recorderRef.current.onstop = null
        recorderRef.current.ondataavailable = null
        try { recorderRef.current.stop() } catch {}
        recorderRef.current = null
      }
    }
  }, [])

  // Stable stop-recording callback stored in a ref so the RAF loop can call it
  const stopRecordingFn = useCallback(() => {
    if (!recorderRef.current) return
    recorderRef.current.stop()
    recorderRef.current = null
    isRecordingRef.current = false
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const stopRecordingRef = useRef(stopRecordingFn)
  stopRecordingRef.current = stopRecordingFn

  // ── RAF scroll loop ──────────────────────────────────────────────────────────
  // Uses CSS transform: translateY on the inner text div instead of scrollTop.
  // scrollTop on overflow:hidden is unreliable on iOS Safari — translateY is not.
  // Sub-pixel accumulator ensures smooth movement at any speed value.
  const scrollLoop = useCallback(() => {
    const container = scrollRef.current
    const inner = textInnerRef.current
    if (!container || !inner) return
    const total = inner.offsetHeight - container.clientHeight
    if (total <= 0) return
    scrollAccRef.current += speedRef.current / 60
    const whole = Math.floor(scrollAccRef.current)
    if (whole > 0) {
      scrollPosRef.current = Math.min(scrollPosRef.current + whole, total)
      scrollAccRef.current -= whole
      inner.style.transform = `translateY(-${scrollPosRef.current}px)`
      setProgress(scrollPosRef.current / total)
    }
    if (scrollPosRef.current < total) {
      rafRef.current = requestAnimationFrame(scrollLoop)
    } else {
      cancelAnimationFrame(rafRef.current)
      setIsScrolling(false)
      if (isRecordingRef.current) stopRecordingRef.current()
    }
  }, [])

  const scrollLoopRef = useRef(scrollLoop)
  scrollLoopRef.current = scrollLoop

  useEffect(() => {
    if (isScrolling) {
      rafRef.current = requestAnimationFrame(scrollLoopRef.current)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [isScrolling])

  // Attach stream to video element AFTER React mounts the {hasStream && <video>} node.
  // Cannot do this synchronously in startCamera() because setHasStream(true) schedules
  // a render — the <video> ref is null until that render commits.
  useEffect(() => {
    if (!hasStream || !streamRef.current) return
    const video = cameraRef.current
    if (!video) return
    video.srcObject = streamRef.current
    video.play().catch(() => {})
  }, [hasStream])

  // ── Camera setup ─────────────────────────────────────────────────────────────
  async function startCamera(): Promise<boolean> {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = stream
      setHasStream(true)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Camera access denied'
      setCameraError(msg)
      setHasStream(false)
      return false
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setHasStream(false)
  }

  // ── Recording ────────────────────────────────────────────────────────────────
  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : ''

    if (!mimeType) {
      setCameraError('Video recording is not supported on this device/browser.')
      stopCamera()
      return
    }

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 500_000,
      })
    } catch {
      setCameraError('Could not start recorder. Try a different browser.')
      stopCamera()
      return
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000)

      // Persist to IndexedDB immediately — survives a page refresh
      const draftId = `${clinicId}-${Date.now()}`
      draftIdRef.current = draftId
      saveDraft({
        id: draftId,
        clinicId,
        scriptId: selectedScriptId,
        blob,
        title: saveTitle || 'Untitled',
        durationSec,
        savedAt: Date.now(),
      }).catch(console.error)

      setElapsedSec(durationSec)
      setRecordedBlob(blob)
      stopCamera()
      setPhase('preview')
    }
    recorder.start(250)
    recorderRef.current = recorder
    isRecordingRef.current = true
    setIsRecording(true)
    setElapsedSec(0)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 500)
  }

  // ── Seek helpers ─────────────────────────────────────────────────────────────
  function getTotal() {
    const container = scrollRef.current
    const inner = textInnerRef.current
    if (!container || !inner) return 0
    return Math.max(0, inner.offsetHeight - container.clientHeight)
  }

  function applyPos(pos: number) {
    scrollPosRef.current = pos
    scrollAccRef.current = 0
    if (textInnerRef.current)
      textInnerRef.current.style.transform = `translateY(-${pos}px)`
    const total = getTotal()
    setProgress(total > 0 ? pos / total : 0)
  }

  function seekByFraction(fraction: number) {
    const total = getTotal()
    if (total <= 0) return
    applyPos(Math.max(0, Math.min(total * fraction, total)))
  }

  function rewindScroll() {
    applyPos(Math.max(0, scrollPosRef.current - speedRef.current * 5))
  }

  function forwardScroll() {
    const total = getTotal()
    applyPos(Math.min(total > 0 ? total : scrollPosRef.current, scrollPosRef.current + speedRef.current * 5))
  }

  // ── Enter reading phase — show camera first, wait for doctor to tap Start ───
  async function enterReading() {
    if (!text.trim()) return
    scrollPosRef.current = 0
    scrollAccRef.current = 0
    if (textInnerRef.current) textInnerRef.current.style.transform = ''
    setProgress(0)
    setReadyToStart(true)
    setPhase('reading')

    if (wantCamera) {
      await startCamera()  // preview only — recording starts when doctor taps Start
    }
  }

  // ── Doctor taps "Start Recording" — recording + scroll begin ─────────────────
  function beginRecording() {
    setReadyToStart(false)
    if (wantCamera && streamRef.current) startRecording()
    setIsScrolling(true)
  }

  // ── Restore a draft recording from IndexedDB ─────────────────────────────────
  function restoreDraft(draft: RecordingDraft) {
    draftIdRef.current = draft.id
    setRecordedBlob(draft.blob)
    setElapsedSec(draft.durationSec)
    setSaveTitle(draft.title)
    setSelectedScriptId(draft.scriptId)
    setPendingDraft(null)
    setPhase('preview')
  }

  async function discardDraft(draft: RecordingDraft) {
    await clearDraft(draft.id).catch(console.error)
    setPendingDraft(null)
  }

  // ── Preview: wire recorded blob to video element ─────────────────────────────
  useEffect(() => {
    if (phase !== 'preview' || !previewVideoRef.current || !recordedBlob) return
    const url = URL.createObjectURL(recordedBlob)
    const video = previewVideoRef.current
    video.src = url
    video.preload = 'auto'
    video.load() // iOS Safari won't load the blob unless load() is called explicitly

    // MediaRecorder doesn't write duration metadata into the WebM container,
    // so Safari shows "Live Broadcast" and disables seeking.
    // Fix: once metadata loads, jump to a huge timestamp — the browser scans
    // the whole file, learns the real duration, then we seek back to 0.
    const onMeta = () => {
      if (!isFinite(video.duration)) {
        video.currentTime = 1e101
        const onUpdate = () => {
          video.removeEventListener('timeupdate', onUpdate)
          video.currentTime = 0
        }
        video.addEventListener('timeupdate', onUpdate)
      }
    }
    video.addEventListener('loadedmetadata', onMeta)

    return () => {
      video.removeEventListener('loadedmetadata', onMeta)
      URL.revokeObjectURL(url)
    }
  }, [phase, recordedBlob])

  // ── Upload to Drive (resumable — bypasses Vercel, no size limit) ────────────
  async function saveRecording() {
    if (!recordedBlob) return
    setPhase('saving')
    setUploadProgress(0)
    setUploadError(null)

    const title = saveTitle.trim() || 'Untitled'

    try {
      // Step 1: get a resumable session URL from our server
      const presignRes = await fetch(`/api/studio/upload-recording/presign?clinicId=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          mimeType: recordedBlob.type || 'video/webm',
          scriptId: selectedScriptId,
          duration: elapsedSec,
        }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `Presign failed (${presignRes.status})`)
      }
      const { uploadUrl } = (await presignRes.json()) as { uploadUrl: string }

      // Step 2: upload blob directly to Google Drive (XHR for progress events)
      const driveFile = await new Promise<{ id: string; webViewLink?: string }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', recordedBlob.type || 'video/webm')
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(e.loaded / e.total)
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText) as { id: string; webViewLink?: string })
              } catch {
                reject(new Error('Drive returned invalid response'))
              }
            } else {
              reject(new Error(`Drive upload failed (${xhr.status})`))
            }
          }
          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.onabort = () => reject(new Error('Upload cancelled'))
          xhr.send(recordedBlob)
        }
      )

      const savedDriveUrl =
        driveFile.webViewLink ??
        `https://drive.google.com/file/d/${driveFile.id}/view`

      // Step 3: save metadata to Supabase
      const confirmRes = await fetch(`/api/studio/recordings/confirm?clinicId=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: driveFile.id,
          driveUrl: savedDriveUrl,
          title,
          scriptId: selectedScriptId,
          duration: elapsedSec,
          sizeBytes: recordedBlob.size,
        }),
      })
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({}))
        console.error('Metadata save failed:', (err as { error?: string }).error)
      }

      // Clear the IndexedDB draft — recording is now safely in Drive
      if (draftIdRef.current) {
        clearDraft(draftIdRef.current).catch(console.error)
        draftIdRef.current = null
      }

      setDriveUrl(savedDriveUrl)
      setPhase('saved')
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
      setPhase('preview')
    }
  }

  // ── Reset to setup ───────────────────────────────────────────────────────────
  function resetToSetup() {
    cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    stopRecordingFn()
    stopCamera()

    // Clear the draft when user consciously discards or finishes
    if (draftIdRef.current) {
      clearDraft(draftIdRef.current).catch(console.error)
      draftIdRef.current = null
    }

    setRecordedBlob(null)
    setIsScrolling(false)
    setIsRecording(false)
    isRecordingRef.current = false
    setElapsedSec(0)
    setProgress(0)
    setDriveUrl(null)
    setUploadError(null)
    setSaveTitle('')
    setReadyToStart(false)
    scrollPosRef.current = 0
    scrollAccRef.current = 0
    if (textInnerRef.current) textInnerRef.current.style.transform = ''
    setPhase('setup')
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SETUP PHASE
  // ────────────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard?clinicId=${clinicId}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">
              Teleprompter
            </p>
            <h1 className="text-xl font-bold text-neutral-900">{clinicName}</h1>
          </div>
        </div>

        {/* Draft recovery banner */}
        {pendingDraft && (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl p-4"
            style={{
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.3)',
              boxShadow: '0 2px 12px rgba(251,191,36,0.08)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Unsaved recording found</p>
                <p className="text-xs text-amber-600">
                  {pendingDraft.title} · {fmtTime(pendingDraft.durationSec)} · {draftAgeLabel(pendingDraft.savedAt)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => restoreDraft(pendingDraft)}
                className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
              >
                Review
              </button>
              <button
                onClick={() => discardDraft(pendingDraft)}
                className="rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Script picker */}
        {recentScripts.length > 0 && (
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.85)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Load a recent script
            </p>
            <div className="flex flex-col gap-2">
              {recentScripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setText(s.body)
                    setSaveTitle(s.title)
                    setSelectedScriptId(s.id)
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    selectedScriptId === s.id
                      ? 'bg-violet-50 ring-1 ring-violet-300'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-800">{s.title}</span>
                    <span className="block truncate text-xs text-neutral-400">
                      {s.body.slice(0, 80)}…
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text editor */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Script text
          </p>
          <textarea
            className="w-full resize-none rounded-xl border border-neutral-200 bg-white/60 p-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
            rows={10}
            placeholder="Paste your script here or load one from the list above…"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setSelectedScriptId(null)
            }}
          />
        </div>

        {/* Settings row */}
        <div
          className="flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4"
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Camera toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <div
              onClick={() => setWantCamera((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${wantCamera ? 'bg-violet-500' : 'bg-neutral-300'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${wantCamera ? 'translate-x-5' : ''}`}
              />
            </div>
            <span className="text-sm text-neutral-700">Record with camera</span>
          </label>

          {/* Speed */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Speed</span>
            <input
              type="range"
              min={15}
              max={120}
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              className="w-24 accent-violet-500"
            />
            <span className="w-6 text-right text-xs font-medium text-neutral-700">{speed}</span>
          </div>

          {/* Font size */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Text</span>
            <button
              onClick={() => setFontSize((v) => Math.max(20, v - 2))}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-neutral-100 text-xs hover:bg-neutral-200"
            >A−</button>
            <button
              onClick={() => setFontSize((v) => Math.min(52, v + 2))}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-neutral-100 text-xs hover:bg-neutral-200"
            >A+</button>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={enterReading}
          disabled={!text.trim()}
          className="cm-btn cm-btn-primary h-14 rounded-2xl text-base font-semibold disabled:opacity-40"
        >
          {wantCamera ? 'Start Recording' : 'Open Teleprompter'}
        </button>

        {/* Recordings history */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Past recordings
          </p>

          {loadingHistory ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-violet-500" />
              <span className="text-xs text-neutral-400">Loading…</span>
            </div>
          ) : savedRecordings.length === 0 ? (
            <p className="text-sm text-neutral-400">No saved recordings yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {savedRecordings.map((rec) => (
                <a
                  key={rec.id}
                  href={rec.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-neutral-50"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-400 group-hover:bg-violet-100">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-800">{rec.title}</span>
                    <span className="text-xs text-neutral-400">
                      {rec.duration_sec ? fmtTime(rec.duration_sec) : '—'}
                      {rec.size_bytes ? ` · ${fmtBytes(rec.size_bytes)}` : ''}
                      {' · '}{fmtDate(rec.created_at)}
                    </span>
                  </span>
                  <svg className="h-3.5 w-3.5 shrink-0 text-neutral-300 group-hover:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // READING PHASE — camera full-screen background, text scrolls over it
  // ────────────────────────────────────────────────────────────────────────────
  if (phase === 'reading') {
    return (
      // flex-col is load-bearing: the scroll loop needs flex-1 to give the
      // scroll container an explicit clientHeight so scrollHeight > clientHeight
      <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">

        {/* Camera — absolute, sits behind everything */}
        <video
          ref={cameraRef}
          muted
          playsInline
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            hasStream ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />
        {/* Slight veil so white text pops on bright backgrounds */}
        <div className="pointer-events-none absolute inset-0 bg-black/25" />

        {/* Pre-flight overlay — doctor checks framing before recording begins */}
        {readyToStart && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <button
              onClick={beginRecording}
              className="flex items-center gap-3 rounded-2xl bg-red-600 px-10 py-5 text-2xl font-bold text-white shadow-2xl transition active:scale-95 hover:bg-red-500"
            >
              <span className="h-4 w-4 shrink-0 rounded-full bg-white" />
              Start Recording
            </button>
            <p className="mt-4 text-base text-white/60">Check your framing, then tap to begin</p>
            <button
              onClick={resetToSetup}
              className="mt-6 rounded-xl bg-white/10 px-6 py-2.5 text-sm text-white/70 backdrop-blur-sm hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Toolbar — two rows so nothing overflows on phone */}
        <div
          className="relative z-10 shrink-0 px-4 pb-2 pt-3"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.40) 80%, transparent 100%)' }}
        >
          {/* Row 1: status badge (left) + Done/Exit (right) */}
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRecording && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  REC {fmtTime(elapsedSec)}
                </span>
              )}
              {!isRecording && isScrolling && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70 backdrop-blur-sm">
                  Reading…
                </span>
              )}
              {!isScrolling && !readyToStart && (
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                  ⏸ Paused
                </span>
              )}
              {cameraError && (
                <span className="rounded-full bg-orange-900/70 px-2.5 py-1 text-xs text-orange-300 backdrop-blur-sm">
                  Camera off
                </span>
              )}
            </div>
            <button
              onClick={() => {
                cancelAnimationFrame(rafRef.current)
                setIsScrolling(false)
                if (isRecording) {
                  stopRecordingFn()
                } else {
                  resetToSetup()
                }
              }}
              className="rounded-xl bg-white/10 px-5 py-2 text-sm font-semibold text-white/90 backdrop-blur-sm hover:bg-white/20 active:scale-95"
            >
              {isRecording ? 'Done' : 'Exit'}
            </button>
          </div>

          {/* Row 2: playback controls centered */}
          <div className="flex items-center justify-center gap-3">
            {/* ◄◄ -5 s */}
            <button
              onClick={rewindScroll}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 active:scale-90"
              title="Back 5 s"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
            </button>

            {/* ⏸ / ▶ — biggest button */}
            <button
              onClick={() => setIsScrolling((v) => !v)}
              className="flex items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 active:scale-90"
              title={isScrolling ? 'Pause' : 'Resume'}
              style={{ width: 52, height: 52 }}
            >
              {isScrolling ? (
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* ►► +5 s */}
            <button
              onClick={forwardScroll}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 active:scale-90"
              title="Forward 5 s"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
              </svg>
            </button>

            {/* − speed N + */}
            <div className="flex items-center rounded-xl bg-white/10 backdrop-blur-sm">
              <button
                onClick={() => setSpeed((v) => Math.max(15, v - 10))}
                className="flex h-11 w-9 items-center justify-center rounded-l-xl text-lg text-white hover:bg-white/20 active:scale-90"
              >−</button>
              <span className="min-w-[30px] text-center text-sm font-semibold text-white/80">{speed}</span>
              <button
                onClick={() => setSpeed((v) => Math.min(120, v + 10))}
                className="flex h-11 w-9 items-center justify-center rounded-r-xl text-lg text-white hover:bg-white/20 active:scale-90"
              >+</button>
            </div>
          </div>
        </div>

        {/* Outer clip container — flex-1 gives it the remaining viewport height.
            Inner div moves via translateY (not scrollTop) — reliable on iOS Safari. */}
        <div
          ref={scrollRef}
          className="relative z-10 flex-1 overflow-hidden px-6 sm:px-16"
          style={{
            userSelect: 'none',
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
          }}
        >
          <div ref={textInnerRef} style={{ willChange: 'transform', paddingTop: '20vh' }}>
            <p
              className="mx-auto max-w-2xl text-center leading-relaxed"
              style={{
                fontSize: fontSize,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: 'rgba(255,255,255,0.92)',
                textShadow: '0 1px 6px rgba(0,0,0,0.98), 0 0 24px rgba(0,0,0,0.85)',
              }}
            >
              {text}
            </p>
            {/* Spacer so the last line can scroll fully into view */}
            <div style={{ height: '60vh' }} />
          </div>
        </div>

        {/* Progress bar — click anywhere to seek */}
        <div
          className="relative z-10 h-2 w-full shrink-0 cursor-pointer bg-white/10"
          title="Click to seek"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seekByFraction((e.clientX - rect.left) / rect.width)
          }}
        >
          <div
            className="h-full bg-violet-400/80 transition-none"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Scrub thumb */}
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-md"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PREVIEW PHASE
  // ────────────────────────────────────────────────────────────────────────────
  if (phase === 'preview') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">
            Preview recording
          </p>
          <h1 className="mt-1 text-xl font-bold text-neutral-900">How did it go?</h1>
        </div>

        {recordedBlob && (
          <video
            ref={previewVideoRef}
            controls
            playsInline
            className="w-full rounded-2xl bg-neutral-950 shadow-lg"
            style={{ maxHeight: '55vh' }}
          />
        )}

        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>{fmtTime(elapsedSec)}</span>
          <span>{fmtBytes(recordedBlob?.size ?? null)}</span>
        </div>

        {/* Title for Drive */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Save as
          </label>
          <input
            type="text"
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            placeholder="Recording title…"
            className="cm-input w-full"
          />
        </div>

        {uploadError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError}</p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={saveRecording}
            className="cm-btn cm-btn-primary flex-1 rounded-2xl py-3 text-sm font-semibold"
          >
            Save to Drive
          </button>
          <button
            onClick={resetToSetup}
            className="flex-1 rounded-2xl border border-neutral-200 bg-white py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Record again
          </button>
          <button
            onClick={resetToSetup}
            className="rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            Discard
          </button>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SAVING PHASE
  // ────────────────────────────────────────────────────────────────────────────
  if (phase === 'saving') {
    const pct = Math.round(uploadProgress * 100)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        <div className="w-full max-w-xs text-center">
          <p className="text-sm font-medium text-neutral-700">
            {uploadProgress < 0.05 ? 'Starting upload…' : `Uploading to Drive… ${pct}%`}
          </p>
          <p className="mt-1 text-xs text-neutral-400">{fmtBytes(recordedBlob?.size ?? null)}</p>
        </div>
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SAVED PHASE
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Saved to Drive</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {saveTitle || 'Your recording'} · {fmtTime(elapsedSec)}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cm-btn cm-btn-primary w-full rounded-2xl py-3 text-sm font-semibold"
          >
            Open in Drive →
          </a>
        )}
        <button
          onClick={resetToSetup}
          className="w-full rounded-2xl border border-neutral-200 bg-white py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Record another
        </button>
        <Link
          href={`/dashboard?clinicId=${clinicId}`}
          className="w-full rounded-2xl py-3 text-sm text-neutral-400 hover:text-neutral-600"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
