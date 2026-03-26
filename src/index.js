const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { recommendTopThree } = require('./decisionTree')

/**
 * Replicate token: variable de entorno REPLICATE_API_TOKEN, o Secret File en Render.
 * Render documenta: /etc/secrets/<filename> y también acceso desde la raíz del proyecto (cwd).
 */
function ensureReplicateTokenFromFile() {
  if (process.env.REPLICATE_API_TOKEN?.trim()) {
    console.log('[estilapp-api] REPLICATE_API_TOKEN tomada de variables de entorno')
    return
  }

  const candidates = [
    process.env.REPLICATE_API_TOKEN_FILE?.trim(),
    '/etc/secrets/REPLICATE_API_TOKEN',
    '/etc/secrets/replicate_api_token',
    path.join(process.cwd(), 'REPLICATE_API_TOKEN'),
    path.join(process.cwd(), 'replicate_api_token'),
    // Si el servicio arranca con cwd = carpeta server/
    path.join(process.cwd(), '..', 'REPLICATE_API_TOKEN'),
    // Si el entry es server/src/index.js, repo puede montar el secreto junto a server/
    path.resolve(__dirname, '..', 'REPLICATE_API_TOKEN'),
    path.resolve(__dirname, '..', '..', 'REPLICATE_API_TOKEN'),
  ].filter(Boolean)

  const tried = []
  const seen = new Set()

  for (const p of candidates) {
    const resolved = path.resolve(p)
    if (seen.has(resolved)) continue
    seen.add(resolved)
    tried.push(resolved)

    try {
      if (!fs.existsSync(resolved)) continue
      const st = fs.statSync(resolved)
      if (!st.isFile()) continue
      const t = fs.readFileSync(resolved, 'utf8').trim()
      if (t) {
        process.env.REPLICATE_API_TOKEN = t
        console.log('[estilapp-api] REPLICATE_API_TOKEN leída desde archivo:', resolved)
        return
      }
    } catch (e) {
      console.warn('[estilapp-api] Error leyendo posible secret:', resolved, e.message)
    }
  }

  console.warn(
    '[estilapp-api] REPLICATE_API_TOKEN no encontrada. Try-on usará demo si TRYON_DEMO_PASS_THROUGH=true. Rutas comprobadas:\n  -',
    tried.join('\n  - ')
  )
}
ensureReplicateTokenFromFile()

const app = express()
const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } })

app.use(cors())
app.use(express.json({ limit: '2mb' }))

const TRYON_DEMO =
  String(process.env.TRYON_DEMO_PASS_THROUGH || 'true').toLowerCase() === 'true'

app.get('/', (_req, res) => {
  res.json({
    service: 'estilapp-api',
    message: 'API activa. Usa GET /health o los endpoints documentados en el README del repositorio.',
    endpoints: {
      'GET /health': 'comprobación de estado',
      'POST /recommend': 'JSON → top3 recomendaciones',
      'POST /try-on': 'multipart (image, haircutId, referenceImageUrl)',
    },
  })
})

app.get('/health', (_req, res) => {
  const replicateReady = Boolean(process.env.REPLICATE_API_TOKEN?.trim())
  res.json({
    ok: true,
    service: 'estilapp-api',
    /** true si hay token (env o archivo); no expone el valor */
    tryOnReplicateConfigured: replicateReady,
  })
})

/**
 * POST /recommend
 * Body JSON: { userFaceShape, headPoseProfile?, hairType?, hairDensity?, recommendationGender?, weights?, candidates: [{ id, faceShape, hairTexture?, targetGender? }] }
 */
app.post('/recommend', (req, res) => {
  try {
    const top3 = recommendTopThree(req.body || {})
    res.json({ top3 })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

/**
 * GET /try-on — solo informativo (el navegador hace GET; el try-on real es POST).
 */
app.get('/try-on', (_req, res) => {
  res.json({
    endpoint: '/try-on',
    method: 'POST',
    contentType: 'multipart/form-data',
    parts: ['image (archivo JPEG)', 'haircutId', 'referenceImageUrl'],
    note: 'No uses el navegador para probar el corte; usa la app EstilApp o Postman/curl con POST.',
  })
})

/**
 * POST /try-on — multipart (misma convención que la app Android).
 * Partes: image, haircutId, referenceImageUrl, opcional haircutName, genderHint (male|female|hombre|mujer).
 *
 * Prioridad: si existe REPLICATE_API_TOKEN → IA real (Replicate flux-kontext-apps/change-haircut).
 * Si no, y TRYON_DEMO_PASS_THROUGH=true → devuelve referenceImageUrl (demo).
 */
app.post('/try-on', upload.single('image'), async (req, res) => {
  const referenceImageUrl = req.body?.referenceImageUrl || ''
  const haircutId = req.body?.haircutId || ''
  const haircutName = req.body?.haircutName || ''
  const genderHint = req.body?.genderHint || ''

  if (!req.file || !referenceImageUrl) {
    return res.status(400).json({ error: 'Faltan image (file) o referenceImageUrl' })
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN?.trim()
  if (replicateToken) {
    try {
      const { runTryOnReplicate } = await import('./tryOnReplicate.mjs')
      const resultUrl = await runTryOnReplicate(req.file.buffer, {
        haircutName,
        genderHint,
      })
      return res.json({
        resultUrl,
        provider: 'replicate',
        haircutId,
      })
    } catch (e) {
      console.error('[try-on] Replicate:', e)
      return res.status(502).json({
        error: String(e.message || e),
        hint: 'Comprueba REPLICATE_API_TOKEN, saldo en replicate.com y que la imagen sea un rostro claro.',
      })
    }
  }

  if (TRYON_DEMO) {
    return res.json({
      resultUrl: referenceImageUrl,
      demo: true,
      haircutId,
      note: 'Modo demo: configura REPLICATE_API_TOKEN en el servidor para generación real, o mantén TRYON_DEMO_PASS_THROUGH.',
    })
  }

  res.status(503).json({
    error:
      'Try-on no disponible: sin REPLICATE_API_TOKEN y TRYON_DEMO_PASS_THROUGH distinto de true.',
  })
})

const port = Number(process.env.PORT) || 8787
app.listen(port, () => {
  console.log(`estilapp-api escuchando en :${port}`)
})
