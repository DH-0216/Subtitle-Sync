import React from 'react'
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
        className="text-app-accent hover:text-app-accent-hover font-semibold flex items-center gap-1 cursor-pointer"
      >
        <span>GitHub Repository ↗</span>
      </button>
    </footer>
  )
}
