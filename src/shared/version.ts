export const APP_VERSION = '2.2.0'

/**
 * Compare semantic versions (e.g., "2.2.0" vs "2.1.2")
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v1 is older)
 *   0 if v1 === v2 (equal)
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = (v1 || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const p2 = (v2 || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(p1.length, p2.length)

  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0
    const num2 = p2[i] || 0
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

