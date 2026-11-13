import React from 'react'
import { FileDown, Folder, CheckSquare, Square, AlertCircle, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
import { SubtitleTrack } from './Step1Video'

interface Step2ExtractProps {
  videoPath: string | null
  subtitleTracks: SubtitleTrack[]
  selectedTrackIndices: number[]
  outputDir: string | null
  onToggleTrack: (trackIndex: number) => void
  onSelectAllTracks: () => void
  onDeselectAllTracks: () => void
  onChangeOutputDir: () => void
  onExtractSingleNow?: (track: SubtitleTrack) => void
  onRescan?: () => void
  onSwitchToGenerate?: () => void
  isExtracting?: boolean
}

// Map common ISO 639-1 / 639-2 codes to friendly language names
const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English',
  en: 'English',
  spa: 'Spanish',
  es: 'Spanish',
  fre: 'French',
  fra: 'French',
  fr: 'French',
  ger: 'German',
  deu: 'German',
  de: 'German',
  ita: 'Italian',
  it: 'Italian',
  por: 'Portuguese',
  pt: 'Portuguese',
  rus: 'Russian',
  ru: 'Russian',
  chi: 'Chinese',
  zho: 'Chinese',
  zh: 'Chinese',
  jpn: 'Japanese',
  ja: 'Japanese',
  kor: 'Korean',
  ko: 'Korean',
  ara: 'Arabic',
  ar: 'Arabic',
  hin: 'Hindi',
  hi: 'Hindi',
  sin: 'Sinhala',
  si: 'Sinhala',
  tam: 'Tamil',
  ta: 'Tamil',
  und: 'Undetermined'
}

export const Step2Extract: React.FC<Step2ExtractProps> = ({
  videoPath,
  subtitleTracks,
  selectedTrackIndices,
  outputDir,
  onToggleTrack,
  onSelectAllTracks,
  onDeselectAllTracks,
  onChangeOutputDir,
  onExtractSingleNow,
  onRescan,
  onSwitchToGenerate,
  isExtracting = false
}) => {
  const textTracks = subtitleTracks.filter((t) => t.isText)
  const allSelected = textTracks.length > 0 && textTracks.every((t) => selectedTrackIndices.includes(t.index))
  const someSelected = textTracks.some((t) => selectedTrackIndices.includes(t.index))

  const videoDir = videoPath ? videoPath.substring(0, Math.max(videoPath.lastIndexOf('/'), videoPath.lastIndexOf('\\'))) : ''
  const displayDir = outputDir || videoDir || 'Same as movie folder'

  return (
    <div className="bg-white dark:bg-slate-900/60 border-2 border-blue-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm shadow-blue-500/10 dark:shadow-md dark:shadow-black/20 hover:border-blue-300 dark:hover:border-slate-700/70 transition-all">
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-blue-100/80 dark:border-slate-800/80 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shadow-blue-600/30">
            2
          </span>
          <h2 className="font-bold text-blue-950 dark:text-slate-100 text-xs tracking-wider uppercase">
            Encoded Subtitle Tracks in Container
          </h2>
          {subtitleTracks.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20">
              {subtitleTracks.length} {subtitleTracks.length === 1 ? 'stream' : 'streams'} detected
            </span>
          )}
        </div>

        {textTracks.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allSelected ? onDeselectAllTracks : onSelectAllTracks}
              disabled={isExtracting}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              {allSelected ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
              <span>{allSelected ? 'Deselect All' : 'Select All Text Tracks'}</span>
            </button>
          </div>
        )}
      </div>

      {!videoPath ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-[#0B0F19]/40">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileDown className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Please select a movie/video in Step 1 first
          </p>
          <p className="text-xs text-slate-400 mt-1">
            The app will scan your video container (MKV, MP4, etc.) for encoded subtitle tracks.
          </p>
        </div>
      ) : subtitleTracks.length === 0 ? (
        <div className="border-2 border-dashed border-amber-200 dark:border-amber-900/40 rounded-xl p-6 text-center bg-amber-50/50 dark:bg-amber-950/20">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
            No Embedded Subtitle Streams Detected Yet
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-1 max-w-md mx-auto">
            If your video container has embedded subtitle tracks, click the button below to re-scan the file with FFmpeg:
          </p>
          {onRescan && (
            <button
              type="button"
              onClick={onRescan}
              disabled={isExtracting}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-scan Video for Subtitles</span>
            </button>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 max-w-md mx-auto">
            Note: If subtitles are hardcoded/burned directly into the movie video pixels, they are part of the video image and cannot be extracted as text without optical OCR.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Destination Folder Selector */}
          <div className="flex items-center justify-between gap-3 bg-blue-50/70 dark:bg-[#0B0F19]/70 border border-blue-200/80 dark:border-slate-800 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Export Destination:
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block" title={displayDir}>
                  {displayDir}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onChangeOutputDir}
              disabled={isExtracting}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
            >
              Change Folder...
            </button>
          </div>

          {/* Banner when all detected subtitles are bitmap/image-based (DVD Subtitle / PGS) */}
          {textTracks.length === 0 && subtitleTracks.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 dark:bg-amber-950/30 dark:border-amber-800/60 flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Image-Based Subtitles Detected (DVD Subtitle / PGS)
                  </p>
                  <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                    These tracks are DVD picture overlays (raster images), not digital text. An .SRT file requires text characters. To create an .SRT subtitle for this movie, use the <strong>Generate Subtitle</strong> mode to automatically transcribe the movie's speech!
                  </p>
                </div>
              </div>
              {onSwitchToGenerate && (
                <button
                  type="button"
                  onClick={onSwitchToGenerate}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate .SRT from Speech</span>
                </button>
              )}
            </div>
          )}

          {/* Tracks list */}
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {subtitleTracks.map((track) => {
              const isSelected = selectedTrackIndices.includes(track.index)
              const langKey = track.language.toLowerCase()
              const langFriendly = LANGUAGE_NAMES[langKey] || track.language.toUpperCase()
              const codecDisplay = track.codec.toUpperCase().replace('_', ' ')

              return (
                <div
                  key={track.index}
                  className={`p-3.5 rounded-xl border transition-all ${
                    !track.isText
                      ? 'bg-slate-50/60 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-70'
                      : isSelected
                      ? 'bg-emerald-50/70 border-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-600/50 shadow-xs'
                      : 'bg-white dark:bg-[#0B0F19]/70 border-blue-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => track.isText && onToggleTrack(track.index)}
                        disabled={!track.isText || isExtracting}
                        className={`mt-0.5 shrink-0 ${
                          !track.isText
                            ? 'cursor-not-allowed opacity-40'
                            : 'cursor-pointer text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 fill-emerald-100 dark:fill-emerald-950" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>

                      {/* Details */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                            Track #{track.index + 1}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 dark:bg-blue-600/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                            {langFriendly} ({track.language.toUpperCase()})
                          </span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {codecDisplay}
                          </span>
                          {track.isDefault && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              DEFAULT
                            </span>
                          )}
                          {track.isForced && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              FORCED
                            </span>
                          )}
                        </div>

                        {track.title && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate italic">
                            "{track.title}"
                          </p>
                        )}

                        <div className="text-[11px]">
                          {track.isText ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Text stream — ready to extract and convert to .SRT
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Bitmap/Image stream (PGS/VobSub) — direct text export not supported
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Single Track Extract Button */}
                    {track.isText && onExtractSingleNow && (
                      <button
                        type="button"
                        onClick={() => onExtractSingleNow(track)}
                        disabled={isExtracting}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Extract to .SRT</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
