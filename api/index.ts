import { handleVercelRequest } from '../server/vercel-handler.js'

export const config = { maxDuration: 30 }

export default handleVercelRequest
