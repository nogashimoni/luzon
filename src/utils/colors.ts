export const PROJECT_COLORS = [
  '#A8C5E3', // soft blue
  '#F7B5CA', // soft pink
  '#B5E7A0', // soft green
  '#FFD6A5', // soft peach
  '#D4B5F7', // soft lavender
  '#FFB3BA', // soft coral
  '#B5F1E7', // soft mint
  '#FFC9A8', // soft orange
  '#A8E6CF', // soft aqua
  '#C5B3E6', // soft purple
  '#FFE5A8', // soft yellow
  '#E6B5D8', // soft rose
]

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}
