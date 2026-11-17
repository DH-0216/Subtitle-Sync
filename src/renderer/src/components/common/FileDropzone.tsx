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
      className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-200 app-dropzone ${
        isDragOver
          ? 'scale-[0.99] shadow-xs !border-[#174082] !bg-[#E0ECFF] dark:!bg-blue-950/40'
          : ''
      } ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-[#E0ECFF] border border-[#B6CFF7] text-[#174082] dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
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
