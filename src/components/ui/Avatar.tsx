import { User } from '../../types'

interface AvatarProps {
  user: User
  size?: 'sm' | 'md' | 'lg'
  clickable?: boolean
  selected?: boolean
  onClick?: () => void
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
}

export default function Avatar({
  user,
  size = 'md',
  clickable = false,
  selected = false,
  onClick,
  className = '',
}: AvatarProps) {
  const baseClasses = `
    ${sizeClasses[size]}
    rounded-full
    flex items-center justify-center
    font-medium
    transition-all
    ${clickable ? 'cursor-pointer hover:opacity-80' : ''}
    ${selected ? 'ring-4 ring-blue-500 ring-offset-2' : ''}
    ${className}
  `

  const firstLetter = user.name.charAt(0).toUpperCase()

  if (user.avatar_url) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        className={`${baseClasses} overflow-hidden bg-gray-200`}
        title={user.name}
      >
        <img
          src={user.avatar_url}
          alt={user.name}
          className="w-full h-full object-cover"
        />
      </button>
    )
  }

  // Fallback to first letter with colored background
  const colors = [
    'bg-blue-500 text-white',
    'bg-green-500 text-white',
    'bg-purple-500 text-white',
    'bg-pink-500 text-white',
    'bg-orange-500 text-white',
    'bg-teal-500 text-white',
  ]

  // Use user ID to consistently pick a color
  const colorIndex = user.id.charCodeAt(0) % colors.length
  const colorClass = colors[colorIndex]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`${baseClasses} ${colorClass}`}
      title={user.name}
    >
      {firstLetter}
    </button>
  )
}
