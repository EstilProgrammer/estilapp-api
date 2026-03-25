const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { recommendTopThree } = require('./decisionTree')

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
  res.json({ ok: true, service: 'estilapp-api' })
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
 * Si TRYON_DEMO_PASS_THROUGH=true, devuelve la referenceImageUrl como resultUrl (tubo probado sin IA externa).
 */
app.post('/try-on', upload.single('image'), (req, res) => {
  const referenceImageUrl = req.body?.referenceImageUrl || ''
  const haircutId = req.body?.haircutId || ''

  if (!req.file || !referenceImageUrl) {
    return res.status(400).json({ error: 'Faltan image (file) o referenceImageUrl' })
  }

  if (TRYON_DEMO) {
    return res.json({
      resultUrl: referenceImageUrl,
      demo: true,
      haircutId,
      note: 'TRYON_DEMO_PASS_THROUGH: sustituir por llamada a proveedor de IA cuando tengas API key en Render',
    })
  }

  res.status(501).json({
    error: 'Try-on real no configurado. Activa TRYON_DEMO_PASS_THROUGH=true o implementa el proveedor.',
  })
})

const port = Number(process.env.PORT) || 8787
app.listen(port, () => {
  console.log(`estilapp-api escuchando en :${port}`)
})
