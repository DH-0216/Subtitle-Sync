import React from 'react'
import { Upload } from 'lucide-react'

export interface FileDropzoneProps {
  icon?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onClick?: () => void
  className?: string
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  icon,
  title,
  subtitle,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  className = ''
}) => {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-200 ${
        isDragOver
          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 scale-[0.99] shadow-xs'
          : 'border-[#B6CFF7] hover:border-blue-500 bg-[#F2F7FD] hover:bg-[#E0ECFF] dark:border-slate-700 dark:hover:border-slate-600 dark:bg-[#0B0F19] dark:hover:bg-[#0E1424]'
      } ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
        {icon || <Upload className="w-6 h-6" />}
      </div>
      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  )
}
