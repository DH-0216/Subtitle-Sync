/**
 * Centralized Whisper Models Configuration
 * Single source of truth for offline Whisper speech-to-text models, categories, and catalogs.
 */

export type WhisperModelCategory =
  | 'recommended'
  | 'standard'
  | 'high_accuracy'
  | 'quantized'
  | 'english_only'
  | 'custom'

export interface WhisperModelOption {
  id: string
  name: string
  label?: string
  sizeBytes?: number
  sizeFormatted?: string
  description?: string
  category?: WhisperModelCategory
  isDownloaded?: boolean
  localPath?: string | null
  speedHint?: string
  isRecommended?: boolean
}

/**
 * Categorized Default Whisper Models Catalog
 * Single source of truth for fallback and offline model selections across all views.
 */
export const DEFAULT_WHISPER_MODELS: WhisperModelOption[] = [
  // 1. Recommended
  {
    id: 'base',
    name: 'Base (Recommended, ~142MB)',
    label: 'Base (Recommended)',
    sizeBytes: 147964211,
    sizeFormatted: '~142MB',
    description: 'Fast & balanced (~16x real-time), optimal for movie dialogue and daily use',
    category: 'recommended',
    speedHint: '⚡ Fast (~16x)',
    isRecommended: true
  },
  {
    id: 'large-v3-turbo',
    name: 'Large v3 Turbo (Recommended, ~1.5GB)',
    label: 'Large v3 Turbo (Recommended)',
    sizeBytes: 1625977916,
    sizeFormatted: '~1.5GB',
    description: 'State-of-the-art accuracy with fast 8x real-time inference',
    category: 'recommended',
    speedHint: '⚡ Accurate (~8x)',
    isRecommended: true
  },

  // 2. Standard Multilingual
  {
    id: 'tiny',
    name: 'Tiny (Fastest, ~75MB)',
    label: 'Tiny',
    sizeBytes: 77793139,
    sizeFormatted: '~75MB',
    description: 'Ultra-fast, lowest memory usage (~32x real-time), lower precision',
    category: 'standard',
    speedHint: '⚡⚡ Ultra Fast (~32x)'
  },
  {
    id: 'small',
    name: 'Small (Better accuracy, ~466MB)',
    label: 'Small',
    sizeBytes: 487847979,
    sizeFormatted: '~466MB',
    description: 'High precision for complex accents, dialects and background audio',
    category: 'standard',
    speedHint: '⚡ Precision (~6x)'
  },

  // 3. High Accuracy
  {
    id: 'medium',
    name: 'Medium (High accuracy, ~1.5GB)',
    label: 'Medium',
    sizeBytes: 1533155455,
    sizeFormatted: '~1.5GB',
    description: 'Very high accuracy model for intricate movie dialogue (~2x real-time)',
    category: 'high_accuracy',
    speedHint: 'High Accuracy (~2x)'
  },
  {
    id: 'large-v3',
    name: 'Large v3 (Maximum precision, ~3.1GB)',
    label: 'Large v3',
    sizeBytes: 3095033481,
    sizeFormatted: '~3.1GB',
    description: 'Maximum multilingual accuracy whisper model (~1x real-time)',
    category: 'high_accuracy',
    speedHint: 'Maximum Accuracy (~1x)'
  },

  // 4. Quantized Fast (Low RAM)
  {
    id: 'large-v3-turbo-q5_0',
    name: 'Large v3 Turbo Q5 (~574MB)',
    label: 'Large v3 Turbo Q5',
    sizeBytes: 574000000,
    sizeFormatted: '~574MB',
    description: 'Quantized large-v3-turbo: 60% smaller download with reduced RAM',
    category: 'quantized',
    speedHint: 'Low RAM'
  },
  {
    id: 'base-q5_1',
    name: 'Base Q5 (~60MB)',
    label: 'Base Q5',
    sizeBytes: 60000000,
    sizeFormatted: '~60MB',
    description: 'Compact quantized model for resource-constrained systems',
    category: 'quantized',
    speedHint: 'Low RAM'
  },
  {
    id: 'small-q5_1',
    name: 'Small Q5 (~191MB)',
    label: 'Small Q5',
    sizeBytes: 191000000,
    sizeFormatted: '~191MB',
    description: 'Balanced quantized model variant',
    category: 'quantized',
    speedHint: 'Low RAM'
  },
  {
    id: 'medium-q5_0',
    name: 'Medium Q5 (~539MB)',
    label: 'Medium Q5',
    sizeBytes: 539000000,
    sizeFormatted: '~539MB',
    description: 'High accuracy quantized model',
    category: 'quantized',
    speedHint: 'Low RAM'
  },

  // 5. English-Only Optimized (.en)
  {
    id: 'base.en',
    name: 'Base English-Only (~142MB)',
    label: 'Base (English Only)',
    sizeBytes: 147964211,
    sizeFormatted: '~142MB',
    description: 'Trained specifically for English speech recognition with optimal vocabulary',
    category: 'english_only',
    speedHint: 'English Only'
  },
  {
    id: 'small.en',
    name: 'Small English-Only (~466MB)',
    label: 'Small (English Only)',
    sizeBytes: 487847979,
    sizeFormatted: '~466MB',
    description: 'Precision English-only model',
    category: 'english_only',
    speedHint: 'English Only'
  },
  {
    id: 'tiny.en',
    name: 'Tiny English-Only (~75MB)',
    label: 'Tiny (English Only)',
    sizeBytes: 77793139,
    sizeFormatted: '~75MB',
    description: 'Ultra-fast English-only model',
    category: 'english_only',
    speedHint: 'English Only'
  },
  {
    id: 'medium.en',
    name: 'Medium English-Only (~1.5GB)',
    label: 'Medium (English Only)',
    sizeBytes: 1533155455,
    sizeFormatted: '~1.5GB',
    description: 'High accuracy English-only model',
    category: 'english_only',
    speedHint: 'English Only'
  }
]
