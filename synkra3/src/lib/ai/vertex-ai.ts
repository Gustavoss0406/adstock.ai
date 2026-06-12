import { VertexAI } from '@google-cloud/vertexai'

let _vertexAI: VertexAI | null = null
let _projectId: string | null = null

function getProjectId(): string {
  if (_projectId) return _projectId
  _projectId = process.env.VERTEX_AI_PROJECT || process.env.VERTEX_AI_PROJECT_ID
  if (_projectId) return _projectId
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (keyFile) {
    try {
      const fs = require('fs')
      _projectId = JSON.parse(fs.readFileSync(keyFile, 'utf-8')).project_id || 'texar-497405'
    } catch { _projectId = 'texar-497405' }
  } else {
    _projectId = 'texar-497405'
  }
  return _projectId
}

function getGoogleAuthOptions() {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (credsJson) {
    try {
      const parsed = JSON.parse(credsJson)
      return { credentials: { client_email: parsed.client_email, private_key: parsed.private_key } }
    } catch {}
  }
  const clientEmail = process.env.VERTEX_AI_CLIENT_EMAIL
  const privateKey = process.env.VERTEX_AI_PRIVATE_KEY
  if (clientEmail && privateKey) {
    return { credentials: { client_email: clientEmail, private_key: privateKey.replace(/\\n/g, '\n') } }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
  }
  return {}
}

function getVertexAI(): VertexAI {
  if (_vertexAI) return _vertexAI
  _vertexAI = new VertexAI({
    project: getProjectId(),
    location: process.env.VERTEX_AI_LOCATION || 'us-central1',
    googleAuthOptions: getGoogleAuthOptions(),
  })
  return _vertexAI
}

export async function generateBackgroundImage(
  title: string, content: string, industry: string, audience: string,
  brandColors?: { primary: string; secondary: string }
): Promise<Buffer> {
  const vertexAI = getVertexAI()
  const modelName = process.env.VERTEX_IMAGE_MODEL || 'gemini-2.5-flash-image'
  const model = vertexAI.getGenerativeModel({ model: modelName })

  const primary = brandColors?.primary || '#6366F1'
  const secondary = brandColors?.secondary || '#e05c2a'

  const prompt = `Create a beautiful background photograph/image for a professional Instagram post (1080x1450 vertical format).

Context:
- Industry: ${industry}
- Target audience: ${audience}
- Post theme: "${title}"
- Post message: "${content.substring(0, 300)}"
- Brand accent colors: ${primary} and ${secondary}

CRITICAL RULES:
- This is a BACKGROUND only — ABSOLUTELY NO TEXT, no letters, no words, no numbers, no logos, no typography of any kind
- Generate a rich, atmospheric visual scene that relates to the theme
- Use colors that complement ${primary} and ${secondary}
- Leave the bottom 40% of the image darker/compatible with dark overlay
- Professional, editorial quality — like a premium magazine spread

Output: A single image with NO text whatsoever. Pure visual background.`

  console.log(`[VertexAI] Background: "${title.substring(0, 50)}"`)

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, topP: 0.95, maxOutputTokens: 8192 },
  })

  const parts = result.response.candidates?.[0]?.content?.parts
  if (!parts) throw new Error('Vertex AI returned no content parts')

  const imagePart = parts.find(p => p.inlineData)
  if (!imagePart?.inlineData) throw new Error('Vertex AI returned no image data')

  const { data } = imagePart.inlineData
  if (!data) throw new Error('Empty image data from Vertex AI')

  console.log(`[VertexAI] Background: ${(data.length * 0.75 / 1024).toFixed(1)} KB`)
  return Buffer.from(data, 'base64')
}
