import { useState, useRef, useEffect } from 'react'

function hsvToHex(h: number, s: number, v: number): string {
  const hi = Math.floor(h / 60) % 6
  const f = h / 60 - Math.floor(h / 60)
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r: number, g: number, b: number
  switch (hi) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    default: r = v; g = p; b = q; break
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
  }
  h = Math.round(h * 60)
  if (h < 0) h += 360
  return [h, max === 0 ? 0 : delta / max, max]
}

interface ColorWheelPickerProps {
  value: string
  onChange: (color: string) => void
}

export default function ColorWheelPicker({ value, onChange }: ColorWheelPickerProps) {
  const [hue, setHue] = useState(() => hexToHsv(value)[0])
  const [sat, setSat] = useState(() => hexToHsv(value)[1])
  const [val, setVal] = useState(() => hexToHsv(value)[2])
  const [hexInput, setHexInput] = useState(value)
  const svRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const hueColor = hsvToHex(hue, 1, 1)

  function updateSV(clientX: number, clientY: number) {
    if (!svRef.current) return
    const rect = svRef.current.getBoundingClientRect()
    const newS = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const newV = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
    setSat(newS)
    setVal(newV)
    const hex = hsvToHex(hue, newS, newV)
    setHexInput(hex)
    onChange(hex)
  }

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging.current) return
      const point = 'touches' in e ? e.touches[0] : e
      updateSV(point.clientX, point.clientY)
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [hue])

  function handleHueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newHue = Number(e.target.value)
    setHue(newHue)
    const hex = hsvToHex(newHue, sat, val)
    setHexInput(hex)
    onChange(hex)
  }

  function handleHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setHexInput(raw)
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      const [nh, ns, nv] = hexToHsv(raw)
      setHue(nh)
      setSat(ns)
      setVal(nv)
      onChange(raw)
    }
  }

  return (
    <div className="space-y-3">
      {/* Saturation / Brightness square */}
      <div
        ref={svRef}
        className="relative w-full rounded-xl cursor-crosshair select-none"
        style={{ height: 160, background: hueColor }}
        onMouseDown={(e) => { dragging.current = true; updateSV(e.clientX, e.clientY) }}
        onTouchStart={(e) => { dragging.current = true; updateSV(e.touches[0].clientX, e.touches[0].clientY) }}
      >
        <div className="absolute inset-0 rounded-xl" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
        <div className="absolute inset-0 rounded-xl" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* Hue slider */}
      <div className="px-1">
        <style>{`
          .hue-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 14px;
            border-radius: 999px;
            background: linear-gradient(to right,
              #ff0000, #ff8000, #ffff00, #80ff00,
              #00ff00, #00ff80, #00ffff, #0080ff,
              #0000ff, #8000ff, #ff00ff, #ff0080, #ff0000
            );
            outline: none;
            cursor: pointer;
          }
          .hue-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: white;
            border: 2px solid rgba(0,0,0,0.15);
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
            cursor: pointer;
          }
          .hue-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: white;
            border: 2px solid rgba(0,0,0,0.15);
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
            cursor: pointer;
          }
        `}</style>
        <input
          type="range"
          min={0}
          max={359}
          value={hue}
          onChange={handleHueChange}
          className="hue-slider"
        />
      </div>

      {/* Preview + hex input */}
      <div className="flex items-center gap-3">
        <div
          className="flex-shrink-0 rounded-lg border border-gray-200"
          style={{ width: 36, height: 36, backgroundColor: value }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={handleHexChange}
          maxLength={7}
          className="flex-1 px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-colors tracking-wider uppercase"
        />
      </div>
    </div>
  )
}
