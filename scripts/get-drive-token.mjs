/**
 * One-time script to get a Google Drive OAuth2 refresh token for a personal Gmail account.
 * Uses PKCE — works with Desktop app client ID only (no client secret needed).
 *
 * Run:
 *   GOOGLE_OAUTH_CLIENT_ID=<your_client_id> node scripts/get-drive-token.mjs
 *
 * Then add to Vercel env vars:
 *   GOOGLE_DRIVE_USER_REFRESH_TOKEN = <printed token>
 */

import { createServer } from 'http'
import { createHash, randomBytes } from 'crypto'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || null
const REDIRECT_PORT = 3333
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`

if (!CLIENT_ID) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID env var first.')
  process.exit(1)
}

// PKCE
const codeVerifier = randomBytes(64).toString('base64url')
const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

const params = new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/drive',
  access_type: 'offline',
  prompt: 'consent',
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
})

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

console.log('\n─────────────────────────────────────────')
console.log('Open this URL in your browser (log in with hellosystems111@gmail.com):')
console.log('\n' + authUrl + '\n')
console.log('─────────────────────────────────────────')
console.log('Waiting for callback on localhost:' + REDIRECT_PORT + ' ...\n')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    res.end('<h2>Error: ' + error + '</h2>')
    console.error('OAuth error:', error)
    server.close()
    return
  }

  if (!code) {
    res.end('No code in callback.')
    return
  }

  try {
    // Exchange code for tokens using PKCE (no client_secret for Desktop apps)
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    })

    const tokens = await tokenRes.json()

    if (!tokenRes.ok) {
      const msg = tokens.error_description || tokens.error || JSON.stringify(tokens)
      res.end('<h2>Token error: ' + msg + '</h2>')
      console.error('Token exchange failed:', msg)

      // If PKCE without secret fails, try with a placeholder or show instructions
      if (tokens.error === 'invalid_client') {
        console.log('\n⚠️  Google requires client_secret for this client.')
        console.log('   You need to find the secret in GCP Console.')
        console.log('   Then run: GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node scripts/get-drive-token-with-secret.mjs')
      }
      server.close()
      return
    }

    res.end('<h2>Done! Check your terminal for the refresh token.</h2>')
    server.close()

    console.log('✅ Success!\n')
    console.log('Add these to Vercel environment variables:')
    console.log('─────────────────────────────────────────')
    console.log('GOOGLE_OAUTH_CLIENT_ID=' + CLIENT_ID)
    console.log('GOOGLE_DRIVE_USER_REFRESH_TOKEN=' + tokens.refresh_token)
    console.log('─────────────────────────────────────────\n')

    if (!tokens.refresh_token) {
      console.warn('⚠️  No refresh token returned.')
      console.warn('   Go to https://myaccount.google.com/permissions, revoke this app, then re-run.')
    }
  } catch (e) {
    res.end('Error: ' + e.message)
    console.error('Token exchange failed:', e.message)
    server.close()
  }
})

server.listen(REDIRECT_PORT)
