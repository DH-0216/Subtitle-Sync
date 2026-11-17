import React from 'react'
import {
  FileUp,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { SubtitleTrack } from './Step1Video'
import { StepCard } from './common/StepCard'

interface Step2ExtractProps {
  videoPath: string | null;
  subtitleTracks: SubtitleTrack[];
  selectedTrackIndices: number[];
  onToggleTrack: (trackIndex: number) => void;
  onSelectAllTracks: () => void;
  onDeselectAllTracks: () => void;
  onExtractSingleNow?: (track: SubtitleTrack) => void;
  onRescan?: () => void;
  onSwitchToGenerate?: () => void;
  isExtracting?: boolean;
}

// Map common ISO 639-1 / 639-2 codes to friendly language names
const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English",
  en: "English",
  spa: "Spanish",
  es: "Spanish",
  fre: "French",
  fra: "French",
  fr: "French",
  ger: "German",
  deu: "German",
  de: "German",
  ita: "Italian",
  it: "Italian",
  por: "Portuguese",
  pt: "Portuguese",
  rus: "Russian",
  ru: "Russian",
  chi: "Chinese",
  zho: "Chinese",
  zh: "Chinese",
  jpn: "Japanese",
  ja: "Japanese",
  kor: "Korean",
  ko: "Korean",
  ara: "Arabic",
  ar: "Arabic",
  hin: "Hindi",
  hi: "Hindi",
  sin: "Sinhala",
  si: "Sinhala",
  tam: "Tamil",
  ta: "Tamil",
  und: "Undetermined",
};

export const Step2Extract: React.FC<Step2ExtractProps> = ({
  videoPath,
  subtitleTracks,
  selectedTrackIndices,
  onToggleTrack,
  onSelectAllTracks,
  onDeselectAllTracks,
  onExtractSingleNow,
  onRescan,
  onSwitchToGenerate,
  isExtracting = false,
}) => {
  const textTracks = subtitleTracks.filter((t) => t.isText);
  const allSelected =
    textTracks.length > 0 &&
    textTracks.every((t) => selectedTrackIndices.includes(t.index));
  const someSelected = textTracks.some((t) =>
    selectedTrackIndices.includes(t.index),
  );

  const badge = subtitleTracks.length > 0 ? (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-app-card-inner-hover text-app-text border border-app-card-inner-border whitespace-nowrap shrink-0">
      {subtitleTracks.length} {subtitleTracks.length === 1 ? 'stream' : 'streams'} detected
    </span>
  ) : undefined

  const headerRight = textTracks.length > 0 ? (
    <button
      type="button"
      onClick={allSelected ? onDeselectAllTracks : onSelectAllTracks}
      disabled={isExtracting}
      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
    >
      {allSelected ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
      <span>{allSelected ? 'Deselect All' : 'Select All Text Tracks'}</span>
    </button>
  ) : undefined

  return (
    <StepCard
      step={2}
      title="Encoded Subtitle Tracks in Container"
      badge={badge}
      headerRight={headerRight}
    >

      {!videoPath ? (
        <div className="border-2 border-dashed border-app-card-inner-border rounded-xl p-8 text-center bg-app-card-inner">
          <div className="w-12 h-12 rounded-xl bg-app-card-inner-hover text-app-text-muted flex items-center justify-center mx-auto mb-3">
            <FileUp className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-app-text">
            Please select a movie/video in Step 1 first
          </p>
          <p className="text-xs text-app-text-muted mt-1">
            The app will scan your video container (MKV, MP4, etc.) for encoded
            subtitle tracks.
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
            If your video container has embedded subtitle tracks, click the
            button below to re-scan the file with FFmpeg:
          </p>
          {onRescan && (
            <button
              type="button"
              onClick={onRescan}
              disabled={isExtracting}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-app-primary hover:bg-app-primary-hover text-app-primary-fg shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-scan Video for Subtitles</span>
            </button>
          )}
          <p className="text-xs text-app-text-muted mt-3 max-w-md mx-auto">
            Note: If subtitles are hardcoded/burned directly into the movie
            video pixels, they are part of the video image and cannot be
            extracted as text without optical OCR.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
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
                    These tracks are DVD picture overlays (raster images), not
                    digital text. An .SRT file requires text characters. To
                    create an .SRT subtitle for this movie, use the{" "}
                    <strong>Generate Subtitle</strong> mode to automatically
                    transcribe the movie's speech!
                  </p>
                </div>
              </div>
              {onSwitchToGenerate && (
                <button
                  type="button"
                  onClick={onSwitchToGenerate}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white shadow-2xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
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
              const isSelected = selectedTrackIndices.includes(track.index);
              const langKey = track.language.toLowerCase();
              const langFriendly =
                LANGUAGE_NAMES[langKey] || track.language.toUpperCase();
              const codecDisplay = track.codec.toUpperCase().replace("_", " ");

              return (
                <div
                  key={track.index}
                  className={`p-3.5 rounded-xl border transition-all ${
                    !track.isText
                      ? "bg-app-card-inner border-app-card-inner-border opacity-70"
                      : isSelected
                        ? "bg-blue-50/50 border-blue-400 dark:bg-blue-950/20 dark:border-blue-600/50 shadow-2xs"
                        : "bg-app-card-inner border border-app-card-inner-border hover:border-blue-400 shadow-2xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() =>
                          track.isText && onToggleTrack(track.index)
                        }
                        disabled={!track.isText || isExtracting}
                        className={`mt-0.5 shrink-0 ${
                          !track.isText
                            ? "cursor-not-allowed opacity-40"
                            : "cursor-pointer text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-5 h-5 text-app-text-muted hover:text-app-text" />
                        )}
                      </button>

                      {/* Details */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-app-text font-mono">
                            Subtitle Track #{track.index + 1}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-app-card-inner-hover text-app-text border border-app-card-inner-border">
                            {langFriendly} ({track.language.toUpperCase()})
                          </span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-app-card-inner-hover text-app-text-muted border border-app-card-inner-border">
                            {codecDisplay}
                          </span>
                          {track.isDefault && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-app-card-inner-hover text-app-text">
                              DEFAULT
                            </span>
                          )}
                          {track.isForced && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40">
                              FORCED
                            </span>
                          )}
                        </div>

                        {track.title && (
                          <p className="text-xs text-app-text-muted truncate italic">
                            "{track.title}"
                          </p>
                        )}

                        <div className="text-[11px]">
                          {track.isText ? (
                            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Text stream — ready to extract and convert to .SRT
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Bitmap/Image stream (PGS/VobSub) — direct text
                              export not supported
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
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-app-btn text-app-btn-text border border-app-btn-border hover:bg-app-primary hover:text-app-primary-fg transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Extract to .SRT</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </StepCard>
  )
}
