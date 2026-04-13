import { useState, useRef, useCallback, useEffect } from 'react'
import { getMenuRecommendation, type MenuRecommendation } from '../../utils/menuAI'

interface MenuRecommenderProps {
  onClose: () => void
}

type Step = 'photo' | 'preference' | 'loading' | 'result' | 'error'

// SpeechRecognition types (not in all TS DOM libs)
interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: Event) => void) | null
  onresult: ((event: ISpeechRecognitionEvent) => void) | null
}

interface ISpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition
    webkitSpeechRecognition?: new () => ISpeechRecognition
  }
}

export default function MenuRecommender({ onClose }: MenuRecommenderProps) {
  const [step, setStep] = useState<Step>('photo')
  const [menuImage, setMenuImage] = useState<{ base64: string; type: string; preview: string } | null>(null)
  const [preference, setPreference] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recommendation, setRecommendation] = useState<MenuRecommendation | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [usingCamera, setUsingCamera] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [cameraStream])

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (usingCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
    }
  }, [usingCamera, cameraStream])

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      setCameraStream(null)
    }
    setUsingCamera(false)
  }, [cameraStream])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      setCameraStream(stream)
      setUsingCamera(true)
    } catch {
      setErrorMessage('Could not access camera. Please allow camera permissions or upload a photo instead.')
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const base64 = dataUrl.split(',')[1]
    setMenuImage({ base64, type: 'image/jpeg', preview: dataUrl })
    stopCamera()
    setStep('preference')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      const base64 = dataUrl.split(',')[1]
      const type = file.type || 'image/jpeg'
      setMenuImage({ base64, type, preview: dataUrl })
      setStep('preference')
    }
    reader.readAsDataURL(file)
  }

  const startVoiceInput = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setErrorMessage('Voice input is not supported in this browser. Please type your preference instead.')
      return
    }
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsRecording(true)
    recognition.onend = () => setIsRecording(false)
    recognition.onerror = () => {
      setIsRecording(false)
      setErrorMessage('Voice input failed. Please type your preference instead.')
    }
    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      setPreference((prev: string) => (prev ? prev + ' ' + transcript : transcript))
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopVoiceInput = () => {
    recognitionRef.current?.stop()
  }

  const handleGetRecommendation = async () => {
    if (!menuImage || !preference.trim()) return
    setStep('loading')
    try {
      const result = await getMenuRecommendation(menuImage.base64, menuImage.type, preference.trim())
      setRecommendation(result)
      setStep('result')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStep('error')
    }
  }

  const handleReset = () => {
    setStep('photo')
    setMenuImage(null)
    setPreference('')
    setRecommendation(null)
    setErrorMessage('')
    stopCamera()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Menu Recommender</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 'photo' && 'Take or upload a photo of the menu'}
              {step === 'preference' && "Tell us what you're in the mood for"}
              {step === 'loading' && 'Analysing the menu…'}
              {step === 'result' && 'Here is your recommendation'}
              {step === 'error' && 'Something went wrong'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        {(step === 'photo' || step === 'preference') && (
          <div className="flex gap-1.5 px-6 py-3 shrink-0">
            {['photo', 'preference'].map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === 0 && (step === 'photo' || step === 'preference')
                    ? 'bg-[#007aff]'
                    : i === 1 && step === 'preference'
                    ? 'bg-[#007aff]'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── STEP: PHOTO ── */}
          {step === 'photo' && (
            <div className="p-6 space-y-4">
              {usingCamera ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-3">
                    <button
                      onClick={stopCamera}
                      className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="flex-1 py-3 rounded-2xl bg-[#007aff] text-white text-sm font-semibold hover:bg-[#0066d6] transition-colors"
                    >
                      Capture Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={startCamera}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#007aff] hover:bg-blue-50/40 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#007aff]/10 flex items-center justify-center shrink-0 group-hover:bg-[#007aff]/20 transition-colors">
                      <svg className="w-6 h-6 text-[#007aff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">Take a photo</p>
                      <p className="text-xs text-gray-400">Use your camera to capture the menu</p>
                    </div>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#007aff] hover:bg-blue-50/40 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-[#007aff]/20 transition-colors">
                      <svg className="w-6 h-6 text-gray-500 group-hover:text-[#007aff] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">Upload from gallery</p>
                      <p className="text-xs text-gray-400">Choose an existing photo from your device</p>
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── STEP: PREFERENCE ── */}
          {step === 'preference' && menuImage && (
            <div className="p-6 space-y-4">
              {/* Thumbnail */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
                <img
                  src={menuImage.preview}
                  alt="Menu"
                  className="w-14 h-14 rounded-xl object-cover shrink-0"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-700">Menu photo captured</p>
                  <button
                    onClick={() => { setMenuImage(null); setStep('photo') }}
                    className="text-xs text-[#007aff] mt-0.5"
                  >
                    Change photo
                  </button>
                </div>
              </div>

              {/* Preference input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-800">What are you in the mood for?</label>
                <div className="relative">
                  <textarea
                    value={preference}
                    onChange={(e) => setPreference(e.target.value)}
                    placeholder="e.g. something light and healthy, spicy food, a hearty pasta…"
                    rows={3}
                    className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-200 focus:border-[#007aff] focus:ring-2 focus:ring-[#007aff]/20 outline-none resize-none text-sm text-gray-800 placeholder:text-gray-400 transition-all"
                  />
                  {/* Mic button */}
                  <button
                    onMouseDown={startVoiceInput}
                    onMouseUp={stopVoiceInput}
                    onTouchStart={startVoiceInput}
                    onTouchEnd={stopVoiceInput}
                    className={`absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-red-500 shadow-lg shadow-red-200 animate-pulse'
                        : 'bg-gray-100 hover:bg-[#007aff]/10'
                    }`}
                    title="Hold to speak"
                  >
                    <svg
                      className={`w-4 h-4 ${isRecording ? 'text-white' : 'text-gray-500'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </div>
                {isRecording && (
                  <p className="text-xs text-red-500 font-medium">Recording… release to stop</p>
                )}
                <p className="text-xs text-gray-400">Hold the mic icon to speak, or type above</p>
              </div>

              {errorMessage && (
                <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{errorMessage}</p>
              )}

              <button
                onClick={handleGetRecommendation}
                disabled={!preference.trim()}
                className="w-full py-3.5 rounded-2xl bg-[#007aff] text-white text-sm font-semibold hover:bg-[#0066d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200"
              >
                Find my dish
              </button>
            </div>
          )}

          {/* ── STEP: LOADING ── */}
          {step === 'loading' && (
            <div className="p-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#007aff]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#007aff] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">Reading the menu…</p>
              <p className="text-xs text-gray-400 text-center">Claude is scanning the menu and finding the perfect dish for you</p>
            </div>
          )}

          {/* ── STEP: RESULT ── */}
          {step === 'result' && recommendation && menuImage && (
            <div className="p-6 space-y-4">
              {/* Menu thumbnail */}
              <div className="flex gap-3 items-start">
                <img src={menuImage.preview} alt="Menu" className="w-12 h-12 rounded-xl object-cover shrink-0 opacity-60" />
                <div>
                  <p className="text-xs text-gray-400">Based on the menu photo</p>
                  <p className="text-xs text-gray-500 italic">"{preference}"</p>
                </div>
              </div>

              {/* Top recommendation */}
              <div className="bg-gradient-to-br from-[#007aff]/8 to-[#007aff]/4 border border-[#007aff]/20 rounded-2xl p-5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-gray-900 tracking-tight">{recommendation.dish}</h3>
                  <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#007aff] text-white text-[10px] font-bold uppercase tracking-wide">
                    Top pick
                  </span>
                </div>
                {recommendation.description && (
                  <p className="text-sm text-gray-600">{recommendation.description}</p>
                )}
                <p className="text-sm text-[#0055b3] font-medium leading-snug">{recommendation.reason}</p>
              </div>

              {/* Alternatives */}
              {recommendation.alternatives?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Also consider</p>
                  {recommendation.alternatives.map((alt, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3.5 space-y-1">
                      <p className="text-sm font-semibold text-gray-800">{alt.dish}</p>
                      <p className="text-xs text-gray-500">{alt.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Start over
                </button>
                <button
                  onClick={() => { setStep('preference'); setRecommendation(null) }}
                  className="flex-1 py-3 rounded-2xl bg-[#007aff] text-white text-sm font-semibold hover:bg-[#0066d6] transition-colors"
                >
                  Try different mood
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: ERROR ── */}
          {step === 'error' && (
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm font-semibold text-red-700">Oops!</p>
                </div>
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-2xl bg-[#007aff] text-white text-sm font-semibold hover:bg-[#0066d6] transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
