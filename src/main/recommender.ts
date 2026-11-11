/**
 * Intelligent sync mode recommendation engine based on video and subtitle media analysis.
 * Faithfully ports the original Python recommender logic with release detection & heuristics.
 */
import { VideoSyncDetails, getReleaseTypeAndCut, detectSubtitleFps } from './media'
import { SrtCue } from './srtTools'

export interface Recommendation {
  mode: 'Standard' | 'Smart' | 'Split sync'
  title: string
  hint: string
  type: 'warning' | 'success' | 'info'
}

// Physical cut editions that add/remove/rearrange scenes
const REAL_CUTS = ['Extended', "Director's Cut", 'Unrated', 'Theatrical']

// Broadcast sources (HDTV) have commercial interruptions removed
const BROADCAST_SOURCES = ['hdtv', 'pdtv', 'dsrip', 'tvrip']

// Continuous home and streaming release sources
const CONTINUOUS_SOURCES = ['bluray', 'web', 'dvd']

export function analyzeRecommendation(
  video: VideoSyncDetails | null,
  cues: SrtCue[],
  subFileName: string,
  videoFileName: string,
  subContent?: string
): Recommendation {
  if (!videoFileName || !subFileName) {
    return {
      mode: 'Standard',
      title: 'Ready to synchronize subtitles with reference movie.',
      hint: "💡 Tip: Choose 'Standard' for same-cut sync, 'Smart' for drift, or 'Split sync' for different releases.",
      type: 'info'
    }
  }

  // 1. Video release source and cut
  const vMeta = getReleaseTypeAndCut(videoFileName)
  const vSource = vMeta.source.toLowerCase()
  const vSceneCuts = vMeta.cuts.filter((c) => REAL_CUTS.includes(c))
  const isVBroadcast = BROADCAST_SOURCES.includes(vSource)

  // 2. Subtitle release source and cut
  const sMeta = getReleaseTypeAndCut(subFileName)
  const sSource = sMeta.source.toLowerCase()
  const sSceneCuts = sMeta.cuts.filter((c) => REAL_CUTS.includes(c))
  const isSBroadcast = BROADCAST_SOURCES.includes(sSource)

  const videoFps = video?.fps || null
  const subFps = detectSubtitleFps(subFileName, subContent)

  // Check A: Broadcast TV commercial mismatch vs Retail/Streaming
  if (vSource && sSource && isVBroadcast !== isSBroadcast) {
    const vLabel = vMeta.tag || 'Movie reference'
    const sLabel = sMeta.tag || 'Subtitle release'
    return {
      mode: 'Split sync',
      title: `Broadcast commercial cuts (${vMeta.source} vs ${sMeta.source}) (Video: ${vLabel} vs Subtitle: ${sLabel}) — Recommended: 'Split sync' mode.`,
      hint: '💡 Broadcast HDTV releases have TV commercial breaks removed, which physically alters timeline intervals. Piecewise Split sync aligns subtitles around commercial cuts.',
      type: 'warning'
    }
  }

  // Check B: Alternate edition cuts (e.g. Extended vs Theatrical)
  const vCutsStr = vSceneCuts.sort().join(' ')
  const sCutsStr = sSceneCuts.sort().join(' ')
  if (vCutsStr !== sCutsStr && (vSceneCuts.length > 0 || sSceneCuts.length > 0)) {
    const vCutName = vSceneCuts.length > 0 ? vSceneCuts.join(' ') : 'Standard cut'
    const sCutName = sSceneCuts.length > 0 ? sSceneCuts.join(' ') : 'Standard cut'
    const vLabel = vMeta.tag || vCutName
    const sLabel = sMeta.tag || sCutName
    return {
      mode: 'Split sync',
      title: `Different edition cuts (${vCutName} vs ${sCutName}) (Video: ${vLabel} vs Subtitle: ${sLabel}) — Recommended: 'Split sync' mode.`,
      hint: "💡 Extended, Unrated, or Director's Cuts contain added or rearranged scenes. 'Split sync' aligns subtitles piecewise around scene changes.",
      type: 'warning'
    }
  }

  // Check C: Large runtime discrepancy (> 180 seconds)
  if (video?.durationSec && cues.length > 0) {
    const subDurationSec = Math.max(...cues.map((c) => c.endMs)) / 1000
    const diffSec = Math.abs(video.durationSec - subDurationSec)
    if (diffSec > 180) {
      return {
        mode: 'Split sync',
        title: `Substantial runtime difference (~${Math.round(diffSec / 60)} min) — Recommended: 'Split sync' mode.`,
        hint: "💡 The subtitle and video durations differ significantly. 'Split sync' handles major scene additions, cutaways, and missing sequences.",
        type: 'warning'
      }
    }
  }

  // Check D: Frame rate mismatch (Speed drift)
  if (videoFps && subFps && Math.abs(videoFps - subFps) >= 0.05) {
    return {
      mode: 'Smart',
      title: `Frame rate mismatch: Video (${videoFps} fps) vs Subtitle (${subFps} fps) — Recommended: 'Smart' mode.`,
      hint: "💡 Frame rate differences (e.g. 23.976 vs 25.0 fps) cause subtitles to slowly drift out of sync over time. 'Smart' mode stretches or compresses timing to keep pace across the whole movie.",
      type: 'warning'
    }
  }

  // Check E: Uncut continuous releases and matching frame rates
  if (videoFps && subFps && Math.abs(videoFps - subFps) < 0.05) {
    if (vSource && sSource && CONTINUOUS_SOURCES.includes(vSource) && CONTINUOUS_SOURCES.includes(sSource)) {
      return {
        mode: 'Standard',
        title: `Uncut continuous releases (Video: ${vMeta.source} vs Subtitle: ${sMeta.source}, ${videoFps} fps) — Recommended: 'Standard' mode.`,
        hint: `💡 Both ${vMeta.source} and ${sMeta.source} share unbroken, continuous timelines without commercials. Fast 1-pass Standard mode aligns all dialogue globally with maximum accuracy.`,
        type: 'success'
      }
    }

    return {
      mode: 'Standard',
      title: `Frame rates & release types match (${videoFps} fps) — Recommended: 'Standard' mode.`,
      hint: '💡 Subtitle and video share the same release cut. Fast 1-pass alignment will quickly shift subtitles into place with zero drift.',
      type: 'success'
    }
  }

  // Fallback Case
  return {
    mode: 'Standard',
    title: 'Ready to synchronize subtitles with reference movie.',
    hint: "💡 Tip: Choose 'Standard' for same-cut sync, 'Smart' for drift, or 'Split sync' for different releases.",
    type: 'info'
  }
}
