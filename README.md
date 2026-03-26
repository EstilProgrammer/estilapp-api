# EstilApp API (`estilapp-api`)

Backend Node.js para **Render.com**: recomendación **Top-3** (árbol de decisión / reglas en servidor) y endpoint **try-on** compatible con la app Android.

## Crear el repositorio en GitHub (copiar y pegar)

**Nombre del repositorio:** `estilapp-api`

**Descripción corta (campo *Description* en GitHub):**

- *Inglés (recomendado en GitHub):*  
  `REST API for EstilApp: Top-3 haircut recommendations (rule-based / decision tree) and try-on multipart endpoint for Render + Android.`
- *Español:*  
  `API REST para EstilApp: recomendación Top-3 (reglas / árbol de decisión) y endpoint try-on para Render y la app Android.`

**Topics / etiquetas sugeridas:**  
`nodejs` `express` `rest-api` `render` `android` `firebase` `decision-tree` `haircut-recommendation` `multipart`

**Licencia:** **MIT** (archivo `LICENSE` incluido en este proyecto). En GitHub: al crear el repo puedes marcar *Add license* → MIT, o subir el `LICENSE` que hay aquí y en *About* del repo pulsa ⚙️ y elige *MIT License*.

**Visibilidad:** *Public* (suele pedirse en TFG para revisión) o *Private* si tu tutor prefiere.

**Qué código subir:** solo el contenido de esta carpeta (`server/`): `package.json`, `package-lock.json` (tras `npm install`), `src/`, `README.md`, `LICENSE`, `.gitignore`, `.env.example`. **No** subas `.env` ni `node_modules/`.

**Web del repositorio (opcional):** si despliegas en Render, puedes poner en *Website* la URL del servicio, por ejemplo `https://estilapp-api.onrender.com`.

---

## ¿Un repo o dos en GitHub?

| Opción | Nombre sugerido | Cuándo usarla |
|--------|------------------|----------------|
| **A — Monorepo (recomendado)** | Mismo repo que el Android: `EstilApp` o `estilapp` | Un solo proyecto TFG, un clon, memoria más simple. Carpeta **`server/`** en la raíz. |
| **B — Repo solo API** | `estilapp-api` o `estilapp-backend` | Si quieres despliegues/permisos/colaboradores separados. |

Convención de nombres: minúsculas y guiones (`estilapp-api`) es lo más habitual en GitHub.

## Qué debe llevar el repositorio (info mínima)

- **Código** de esta carpeta `server/` (o el repo entero si es monorepo).
- **`README.md`** (este archivo): cómo arrancar en local y cómo desplegar en Render.
- **`.env.example`**: variables públicas de ejemplo (sin secretos).
- **`.gitignore`**: `node_modules/`, `.env`.
- **No subir**: `.env` con API keys, JSON de cuenta de servicio de Firebase, claves de terceros.

## Configuración en Render

1. En [Render](https://render.com): **New +** → **Web Service**.
2. Conecta el **mismo repositorio** GitHub.
3. Si usas **monorepo**: en **Root Directory** pon `server`.
4. **Runtime**: Node.
5. **Build command**: `npm install`
6. **Start command**: `npm start`
7. **Environment** (Variables):
   - `REPLICATE_API_TOKEN` = tu token de [Replicate](https://replicate.com/account/api-tokens) (**secreto**). Con esto el try-on usa IA real (`flux-kontext-apps/change-haircut`). Tiene coste por ejecución según tu plan.
   - `TRYON_DEMO_PASS_THROUGH` = `true` solo si **no** usas token (entonces la app recibe la imagen del catálogo). Si defines `REPLICATE_API_TOKEN`, el servidor prioriza la IA y ya no hace falta el demo para try-on real.

Tras el deploy, la URL será algo como `https://estilapp-api.onrender.com`.

## URLs que usa la app Android

En `local.properties` (raíz del proyecto Android, no va a Git):

```properties
# Try-on: URL completa al endpoint multipart (como espera RenderApiClient.kt)
render.api.url=https://TU-SERVICIO.onrender.com/try-on
```

La app hace **POST** a esa URL exacta (no añade rutas por detrás).

Para probar recomendación desde Postman o desde un futuro cliente:

- `GET https://TU-SERVICIO.onrender.com/health`
- `POST https://TU-SERVICIO.onrender.com/recommend` con JSON (ver abajo).

## Contrato `POST /recommend`

```http
POST /recommend
Content-Type: application/json
```

```json
{
  "userFaceShape": "OVALADO",
  "headPoseProfile": "FRONTAL",
  "hairType": "rizado",
  "hairDensity": "media",
  "weights": { "global": 1 },
  "candidates": [
    { "id": "abc123", "faceShape": "OVALADO", "hairTexture": "rizado" }
  ]
}
```

Respuesta:

```json
{
  "top3": [
    { "id": "abc123", "score": 66, "faceShape": "OVALADO" }
  ]
}
```

*(Integrar la llamada a `/recommend` desde Kotlin es opcional: hoy el motor también está en la app; el servidor sirve para cumplir requisito de lógica en nube y para memoria.)*

## Contrato `POST /try-on`

Igual que `tools/haircuts/RENDER_API.txt`: `multipart/form-data` con `image`, `haircutId`, `referenceImageUrl`.

### Try-on con IA (Replicate)

1. Crea cuenta en Replicate y un **API token**.
2. En Render (o en `.env` local): `REPLICATE_API_TOKEN=r8_...`
3. Vuelve a desplegar. `POST /try-on` enviará la foto del usuario al modelo **flux-kontext-apps/change-haircut** y responderá `{ "resultUrl": "https://replicate.delivery/...", "provider": "replicate" }`.

La app debe tener `render.api.url` apuntando a `https://TU-SERVICIO.onrender.com/try-on` (ver `tools/haircuts/RENDER_API.txt`).

**Notas:** la generación puede tardar **30–90 s**; en planes gratuitos de Render el request puede cortarse por timeout — si pasa, sube de plan o usa otro host con límite mayor. El estilo se infiere del **nombre del corte** (`haircutName`) y la preferencia de género (`genderHint`); no es una copia pixel a pixel de la foto de referencia del catálogo.

### Try-on en demo (sin token)

Con `TRYON_DEMO_PASS_THROUGH=true` y **sin** `REPLICATE_API_TOKEN`, la respuesta devuelve `resultUrl` = `referenceImageUrl` para validar el flujo sin API de terceros.

## Primer push a GitHub (solo repo `estilapp-api`)

Trabaja en la carpeta que será la **raíz del repositorio** (todo el contenido de `server/`). Crea el repo vacío en GitHub con nombre `estilapp-api`, **sin** README si ya tienes el de aquí.

```bash
git init
git add .
git commit -m "Initial commit: EstilApp API (Express, /recommend, /try-on)"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/estilapp-api.git
git push -u origin main
```

Sustituye `TU_USUARIO` por tu usuario u organización de GitHub.

## Arranque local

Si clonaste solo `estilapp-api`, ya estás en la raíz del proyecto:

```bash
npm install
npm start
```

Copia variables de ejemplo (opcional):

- Windows (cmd/PowerShell): `copy .env.example .env`
- macOS/Linux: `cp .env.example .env`

Si el API vive dentro del monorepo Android, entra antes en `server/`: `cd server` y luego los mismos comandos.

Prueba: http://localhost:8787/health
