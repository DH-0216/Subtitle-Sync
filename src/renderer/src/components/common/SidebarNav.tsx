import React from 'react'
import { Badge } from './Badge'

export interface SidebarNavItem<T extends string = string> {
  id: T
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | null
}

export interface SidebarNavProps<T extends string = string> {
  items: readonly SidebarNavItem<T>[] | SidebarNavItem<T>[]
  activeId: T
  onSelect: (id: T) => void
  sectionTitle?: string
  className?: string
  itemClassName?: string
}

export function SidebarNav<T extends string = string>({
  items,
  activeId,
  onSelect,
  sectionTitle,
  className = '',
  itemClassName = ''
}: SidebarNavProps<T>): React.ReactElement {
  return (
    <div className={`space-y-1 ${className}`}>
      {sectionTitle && (
        <p className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider px-2.5 py-1">
          {sectionTitle}
        </p>
      )}

      {items.map((item) => {
        const Icon = item.icon
        const isActive = activeId === item.id

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full text-left px-2.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2.5 group select-none ${
              isActive
                ? 'bg-app-primary text-app-primary-fg shadow-xs font-semibold'
                : 'text-app-text hover:bg-app-sidebar-hover hover:text-app-accent'
            } ${itemClassName}`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 transition-transform ${
                isActive
                  ? 'text-app-primary-fg'
                  : 'text-app-text-muted group-hover:text-app-accent group-hover:scale-105'
              }`}
            />
            <span className="text-xs truncate flex-1 font-semibold">
              {item.label}
            </span>
            {item.badge && (
              <Badge
                text={item.badge}
                size="xs"
                variant={isActive ? 'glass' : 'auto'}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
