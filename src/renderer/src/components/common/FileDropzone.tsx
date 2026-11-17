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
          ? 'border-app-primary bg-app-dropzone-drag scale-[0.99] shadow-xs'
          : 'border-app-dropzone-border hover:border-app-dropzone-hover-border bg-app-dropzone hover:bg-app-dropzone-hover'
      } ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-app-dropzone-icon-bg border border-app-dropzone-icon-border text-app-dropzone-icon-text flex items-center justify-center mx-auto mb-3 shadow-xs">
        {icon || <Upload className="w-6 h-6" />}
      </div>
      <p className="text-sm font-bold text-app-text mb-1">
        {title}
      </p>
      {subtitle && (
        <p className="text-xs text-app-text-muted">
          {subtitle}
        </p>
      )}
    </div>
  )
}
