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

function normalizeRecommendationGender(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'hombre' || s === 'mujer') return s
  return 'todos'
}

function normalizeTargetGender(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (!s) return 'unisex'
  if (s === 'masculino' || s === 'male' || s === 'man') return 'hombre'
  if (s === 'femenino' || s === 'female' || s === 'woman') return 'mujer'
  if (s === 'hombre' || s === 'mujer' || s === 'unisex' || s === 'todos') return s
  return 'unisex'
}

function cutMatchesGender(cut, pref) {
  if (pref === 'todos') return true
  const tag = normalizeTargetGender(cut.targetGender)
  if (pref === 'hombre') return tag === 'unisex' || tag === 'hombre' || tag === 'todos'
  if (pref === 'mujer') return tag === 'unisex' || tag === 'mujer' || tag === 'todos'
  return true
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

function genderAffinityBonus(cut, pref) {
  if (pref === 'todos') return 0
  const tag = normalizeTargetGender(cut.targetGender)
  if (tag === 'unisex' || tag === 'todos') return 0
  if (pref === 'hombre' && tag === 'hombre') return 12
  if (pref === 'mujer' && tag === 'mujer') return 12
  return 0
}

function normalizeFacialProfileArc(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'concavo') return 'concavo'
  if (s === 'convexo') return 'convexo'
  if (s === 'recto') return 'recto'
  return 'sin_especificar'
}

/** Alineado con RecommendationScorer.profileArcBonus en la app Android. */
function profileArcBonus(arcRaw, cut) {
  const a = normalizeFacialProfileArc(arcRaw)
  if (a === 'sin_especificar') return 0
  const blob = `${cut.name || ''} ${cut.description || ''} ${cut.hairTexture || ''} ${cut.profileArcHint || ''}`.toLowerCase()
  const hint = String(cut.profileArcHint || '')
    .trim()
    .toLowerCase()
  if (hint) {
    const match =
      hint.includes('todos') ||
      (a === 'concavo' && hint.includes('concav')) ||
      (a === 'convexo' && hint.includes('convex')) ||
      (a === 'recto' && hint.includes('rect'))
    if (match) return 14
  }
  if (a === 'convexo') {
    const keys = ['barba', 'nuca', 'posterior', 'perfil', 'mejilla', 'degradado bajo', 'degradado', 'lateral']
    return keys.some((k) => blob.includes(k)) ? 12 : 0
  }
  if (a === 'concavo') {
    const keys = ['coronilla', 'frente', 'volumen superior', 'altura', 'textur', 'superior']
    return keys.some((k) => blob.includes(k)) ? 12 : 0
  }
  if (a === 'recto') {
    const keys = ['clásico', 'clasico', 'simétrico', 'simetrico', 'limpio', 'versátil', 'versatil', 'equilibrado']
    return keys.some((k) => blob.includes(k)) ? 10 : 5
  }
  return 0
}

/**
 * @param {object} input
 * @param {string} input.userFaceShape
 * @param {string} [input.headPoseProfile]
 * @param {string} [input.hairType]
 * @param {string} [input.hairDensity]
 * @param {string} [input.recommendationGender] todos | hombre | mujer (alineado con la app)
 * @param {string} [input.facialProfileArc] sin_especificar | concavo | convexo | recto
 * @param {Array<{id:string, name?:string, faceShape:string, description?:string, hairTexture?:string, targetGender?:string, profileArcHint?:string}>} input.candidates
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
  score += profileArcBonus(input.facialProfileArc, cut)

  const w = input.weights || {}
  score *= typeof w.global === 'number' && w.global > 0 ? w.global : 1

  const genderPref = normalizeRecommendationGender(input.recommendationGender)
  score += genderAffinityBonus(cut, genderPref)

  return Math.round(score * 10) / 10
}

function recommendTopThree(input) {
  const pref = normalizeRecommendationGender(input.recommendationGender)
  const list = Array.isArray(input.candidates) ? input.candidates : []
  const filtered = list.filter((c) => cutMatchesGender(c, pref))
  const scored = filtered.map((c) => ({
    id: String(c.id),
    score: scoreCandidate(input, c),
    faceShape: c.faceShape,
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3)
}

module.exports = { recommendTopThree, normalizeShape, normalizePose, normalizeFacialProfileArc }
