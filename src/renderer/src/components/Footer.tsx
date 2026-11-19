import React from 'react'
import { Github } from 'lucide-react'
import { EXTERNAL_LINKS } from '@shared/links'

export const Footer: React.FC = () => {
  const handleOpenRepo = () => {
    const url = EXTERNAL_LINKS.GITHUB_REPO
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <footer className="w-full h-[42px] border-t border-app-footer-border shrink-0 flex items-center justify-between px-5 bg-app-footer text-[11px] text-app-footer-text font-semibold transition-colors z-20">
      <span>Developed by DH-0216</span>
      <button
        type="button"
        onClick={handleOpenRepo}
        className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover transition-colors cursor-pointer"
        title="Open GitHub Repository"
        aria-label="Open GitHub Repository"
      >
        <Github className="w-4 h-4" />
      </button>
    </footer>
  )
}
