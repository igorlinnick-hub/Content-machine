'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Phase = 'setup' | 'reading' | 'preview' | 'saving' | 'saved'

interface RecentScript {
  id: string
  title: string
  body: string
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
  const [uploadProgress, setUploadProgress] = useState(0) // 0–1

  const scrollRef = useRef<HTMLDivElement>(null)
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

  speedRef.current = speed

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
  const scrollLoop = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const total = el.scrollHeight - el.clientHeight
    if (total <= 0) return
    el.scrollTop += speedRef.current / 60
    setProgress(Math.min(el.scrollTop / total, 1))
    if (el.scrollTop < total) {
      rafRef.current = requestAnimationFrame(scrollLoop)
    } else {
      // reached end
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
      setHasStream(true) // triggers the useEffect above which wires up the video
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
        videoBitsPerSecond: 500_000, // ~3.75MB/min — keeps files under Vercel limits
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

  // ── Enter reading phase ──────────────────────────────────────────────────────
  async function enterReading() {
    if (!text.trim()) return
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setProgress(0)
    setPhase('reading')

    if (wantCamera) {
      const ok = await startCamera()
      if (ok) startRecording()
    }
    setIsScrolling(true)
  }

  // ── Preview: wire recorded blob to video element ─────────────────────────────
  useEffect(() => {
    if (phase !== 'preview' || !previewVideoRef.current || !recordedBlob) return
    const url = URL.createObjectURL(recordedBlob)
    previewVideoRef.current.src = url
    return () => URL.revokeObjectURL(url)
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

      const driveUrl =
        driveFile.webViewLink ??
        `https://drive.google.com/file/d/${driveFile.id}/view`

      // Step 3: save metadata to Supabase
      const confirmRes = await fetch(`/api/studio/recordings/confirm?clinicId=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: driveFile.id,
          driveUrl,
          title,
          scriptId: selectedScriptId,
          duration: elapsedSec,
          sizeBytes: recordedBlob.size,
        }),
      })
      if (!confirmRes.ok) {
        // Drive upload succeeded — still show the link even if metadata save failed
        const err = await confirmRes.json().catch(() => ({}))
        console.error('Metadata save failed:', (err as { error?: string }).error)
      }

      setDriveUrl(driveUrl)
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
    setRecordedBlob(null)
    setIsScrolling(false)
    setIsRecording(false)
    isRecordingRef.current = false
    setElapsedSec(0)
    setProgress(0)
    setDriveUrl(null)
    setUploadError(null)
    setSaveTitle('')
    if (scrollRef.current) scrollRef.current.scrollTop = 0
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
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // READING PHASE — fullscreen dark teleprompter
  // ────────────────────────────────────────────────────────────────────────────
  if (phase === 'reading') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            {isRecording && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                REC {fmtTime(elapsedSec)}
              </span>
            )}
            {!isRecording && isScrolling && (
              <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-400">
                Reading…
              </span>
            )}
            {!isScrolling && (
              <span className="rounded-full bg-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-300">
                ⏸ Paused
              </span>
            )}
            {cameraError && (
              <span className="rounded-full bg-orange-900/70 px-2.5 py-1 text-xs text-orange-300">
                Camera off: {cameraError.slice(0, 40)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Pause / Play */}
            <button
              onClick={() => setIsScrolling((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-700 text-white hover:bg-neutral-600"
              title={isScrolling ? 'Pause' : 'Resume'}
            >
              {isScrolling ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Speed controls */}
            <button
              onClick={() => setSpeed((v) => Math.max(15, v - 10))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-sm"
            >−</button>
            <span className="text-xs text-neutral-500">{speed}</span>
            <button
              onClick={() => setSpeed((v) => Math.min(120, v + 10))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-sm"
            >+</button>

            {/* Stop recording / finish */}
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
              className="ml-2 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
            >
              {isRecording ? 'Done' : 'Exit'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 w-full bg-neutral-800">
          <div
            className="h-full bg-violet-500 transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Scrolling text */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden px-6 py-8 sm:px-16"
          style={{ userSelect: 'none' }}
        >
          <p
            className="mx-auto max-w-2xl leading-relaxed text-white"
            style={{ fontSize: fontSize, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}
          >
            {text}
          </p>
          {/* Bottom padding so the last line can fully scroll to center */}
          <div style={{ height: '50vh' }} />
        </div>

        {/* Camera PIP */}
        {hasStream && (
          <div
            className="absolute bottom-6 right-5 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/20"
            style={{ width: 120, height: 90 }}
          >
            <video
              ref={cameraRef}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // mirror for natural selfie view
            />
          </div>
        )}
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
