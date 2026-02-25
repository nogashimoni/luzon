import { PROJECT_COLORS } from '../../utils/colors'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`w-9 h-9 rounded-full border-2 transition-all cursor-pointer shadow-sm ${
            value === color ? 'border-[#007aff] scale-110 ring-2 ring-[#007aff]/20' : 'border-white hover:scale-105 hover:shadow-md'
          }`}
          style={{ backgroundColor: color }}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  )
}
