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
    <footer className="w-full h-[42px] border-t border-[#CADEFC] dark:border-slate-800/80 shrink-0 flex items-center justify-between px-5 bg-[#F2F6FD] dark:bg-[#0B0F19] text-[11px] text-slate-700 dark:text-slate-400 font-semibold transition-colors z-20">
      <span>Developed by DH-0216</span>
      <button
        type="button"
        onClick={handleOpenRepo}
        className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer"
      >
        <span>GitHub Repository ↗</span>
      </button>
    </footer>
  )
}
