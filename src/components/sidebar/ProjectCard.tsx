import type { Project, CalendarEvent } from '../../types'
import { calculateProjectHours, formatHours, filterEventsForHours } from '../../utils/hours'
import { getContrastColor } from '../../utils/colors'

interface ProjectCardProps {
  project: Project
  events: CalendarEvent[]
  selected: boolean
  onSelect: () => void
  onOpenPanel: () => void
}

function formatDeadline(deadline: string): { label: string; color: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(deadline + 'T00:00:00')
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  let label: string
  if (diffDays < 0) label = `${Math.abs(diffDays)}d overdue`
  else if (diffDays === 0) label = 'Due today'
  else if (diffDays === 1) label = 'Due tomorrow'
  else if (diffDays <= 7) label = `${diffDays}d left`
  else label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const color = diffDays < 0 ? 'text-red-500' : diffDays <= 3 ? 'text-orange-500' : 'text-gray-400'
  return { label, color }
}

export default function ProjectCard({ project, events, selected, onSelect, onOpenPanel }: ProjectCardProps) {
  const projectEvents = filterEventsForHours(
    events.filter((e) => e.project_id === project.id),
    project
  )
  const hours = calculateProjectHours(projectEvents)

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        selected ? 'border-[#007aff] bg-blue-50/30 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <button
        onClick={() => { onSelect(); onOpenPanel() }}
        className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
      >
        <div
          className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow-sm"
          style={{ backgroundColor: project.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate tracking-tight">
            {project.title}
          </div>
          {project.description && (
            <div className="text-xs text-gray-500 truncate mt-0.5">{project.description}</div>
          )}
          {project.deadline && (() => {
            const { label, color } = formatDeadline(project.deadline)
            return <div className={`text-xs font-medium mt-0.5 ${color}`}>{label}</div>
          })()}
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 shadow-sm tracking-tight"
          style={{ backgroundColor: project.color, color: getContrastColor(project.color) }}
        >
          {formatHours(hours)}
        </span>
      </button>
    </div>
  )
}
