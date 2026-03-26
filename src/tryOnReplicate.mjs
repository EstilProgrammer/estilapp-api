/**
 * Try-on con IA vía Replicate (flux-kontext-apps/change-haircut).
 * Módulo ESM (importado con import() desde index.js).
 */

import Replicate from 'replicate'

function mapHaircutLabel(name = '') {
  const s = String(name).toLowerCase()
  if (/(fade|degradado|buzz|rapado|militar|crew|bald)/.test(s)) return 'Short fade'
  if (/(undercut|contraste|laterales rapados)/.test(s)) return 'Undercut'
  if (/(pompadour|quiff|raíz elevada|volumen frontal)/.test(s)) return 'Pompadour'
  if (/(riz|afro|twist|dread|perm )/.test(s)) return 'Curly'
  if (/(mullet|nuca)/.test(s)) return 'Mullet'
  if (/(largo|flow|melena|coleta|surfero)/.test(s)) return 'Long'
  if (/(bob|midi)/.test(s)) return 'Bob'
  if (/(slick|ejecutivo|hacia atrás|peinado hacia atrás)/.test(s)) return 'Slicked back'
  if (/(french crop|flequillo)/.test(s)) return 'French crop'
  if (/(ivy|superior corto)/.test(s)) return 'Ivy league'
  if (/(mohawk|central)/.test(s)) return 'Mohawk'
  if (/(side part|partido|raya)/.test(s)) return 'Side part'
  if (/(taper)/.test(s)) return 'Taper fade'
  return 'Random'
}

function mapGenderHint(hint = '') {
  const g = String(hint).toLowerCase().trim()
  if (g === 'male' || g === 'hombre' || g === 'm') return 'Male'
  if (g === 'female' || g === 'mujer' || g === 'f') return 'Female'
  return 'none'
}

function outputToUrl(output) {
  if (output == null) throw new Error('El modelo no devolvió imagen')
  if (typeof output === 'string' && output.startsWith('http')) return output
  if (Array.isArray(output) && output.length > 0) return outputToUrl(output[0])
  if (typeof output.url === 'function') {
    const u = output.url()
    if (typeof u === 'string') return u
  }
  if (typeof output === 'object' && typeof output.url === 'string') return output.url
  throw new Error('Formato de salida del modelo no reconocido')
}

async function runOnce(replicate, input) {
  const output = await replicate.run('flux-kontext-apps/change-haircut', { input })
  return outputToUrl(output)
}

export async function runTryOnReplicate(imageBuffer, meta = {}) {
  const token = process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) throw new Error('Falta REPLICATE_API_TOKEN')

  const replicate = new Replicate({ auth: token })
  const haircut = mapHaircutLabel(meta.haircutName || '')
  const gender = mapGenderHint(meta.genderHint || '')

  const baseInput = {
    input_image: imageBuffer,
    hair_color: 'No change',
    gender,
    aspect_ratio: 'match_input_image',
    output_format: 'jpeg',
    safety_tolerance: 2,
  }

  try {
    return await runOnce(replicate, { ...baseInput, haircut })
  } catch (firstErr) {
    if (haircut === 'Random') throw firstErr
    try {
      return await runOnce(replicate, { ...baseInput, haircut: 'Random' })
    } catch {
      throw firstErr
    }
  }
}
