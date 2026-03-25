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

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'estilapp-api' })
})

/**
 * POST /recommend
 * Body JSON: { userFaceShape, headPoseProfile?, hairType?, hairDensity?, weights?, candidates: [{ id, faceShape, hairTexture? }] }
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
