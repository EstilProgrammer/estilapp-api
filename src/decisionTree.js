/**
 * Motor por reglas / árbol de decisión (servidor).
 * Mantener alineado con los valores que envía la app (Firestore / enums Kotlin).
 */

const COMPATIBLE = {
  OVALADO: new Set(['OVALADO', 'REDONDO', 'CUADRADO', 'ALARGADO', 'TRIANGULAR', 'ROMBOIDAL']),
  REDONDO: new Set(['REDONDO', 'OVALADO']),
  CUADRADO: new Set(['CUADRADO', 'OVALADO', 'ROMBOIDAL']),
  ALARGADO: new Set(['ALARGADO', 'OVALADO', 'CUADRADO']),
  TRIANGULAR: new Set(['TRIANGULAR', 'OVALADO', 'REDONDO']),
  ROMBOIDAL: new Set(['ROMBOIDAL', 'OVALADO', 'CUADRADO']),
}

function normalizeShape(s) {
  if (!s || typeof s !== 'string') return 'OVALADO'
  const u = s.trim().toUpperCase()
  return COMPATIBLE[u] ? u : 'OVALADO'
}

function normalizePose(p) {
  if (!p || typeof p !== 'string') return 'FRONTAL'
  const u = p.trim().toUpperCase()
  if (u === 'LATERAL_IZQ' || u === 'LATERAL_DER' || u === 'LATERAL') return 'LATERAL'
  if (u === 'FRONTAL') return 'FRONTAL'
  return 'FRONTAL'
}

function hairTypeBonus(hairType, textureHint) {
  const t = (hairType || '').toLowerCase()
  const hint = (textureHint || '').toLowerCase()
  let b = 0
  if (hint && t && hint.includes(t)) b += 12
  return b
}

function densityBonus(density) {
  const d = (density || '').toLowerCase()
  if (d.includes('alta') || d.includes('thick')) return 8
  if (d.includes('baja') || d.includes('thin')) return 4
  return 6
}

/**
 * @param {object} input
 * @param {string} input.userFaceShape
 * @param {string} [input.headPoseProfile]
 * @param {string} [input.hairType]
 * @param {string} [input.hairDensity]
 * @param {Array<{id:string, faceShape:string, hairTexture?:string}>} input.candidates
 * @param {object} [input.weights] pesos opcionales desde feedback (app)
 */
function scoreCandidate(input, cut) {
  const userShape = normalizeShape(input.userFaceShape)
  const pose = normalizePose(input.headPoseProfile)
  const cutShape = normalizeShape(cut.faceShape)

  let score = 0
  if (cutShape === userShape) score += 40
  else if (COMPATIBLE[userShape]?.has(cutShape)) score += 22
  else score += 6

  if (pose === 'LATERAL') score += 5

  score += hairTypeBonus(input.hairType, cut.hairTexture)
  score += densityBonus(input.hairDensity)

  const w = input.weights || {}
  score *= typeof w.global === 'number' && w.global > 0 ? w.global : 1

  return Math.round(score * 10) / 10
}

function recommendTopThree(input) {
  const list = Array.isArray(input.candidates) ? input.candidates : []
  const scored = list.map((c) => ({
    id: String(c.id),
    score: scoreCandidate(input, c),
    faceShape: c.faceShape,
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3)
}

module.exports = { recommendTopThree, normalizeShape, normalizePose }
