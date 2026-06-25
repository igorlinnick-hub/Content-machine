/**
 * One-time script to get a Google Drive OAuth2 refresh token for a personal Gmail account.
 *
 * Prerequisites (one-time setup in Google Cloud Console — same project as the SA):
 *   1. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
 *   2. Application type: Desktop app
 *   3. Copy the Client ID and Client Secret
 *   4. Set them below or in env vars: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
 *
 * Run:
 *   node scripts/get-drive-token.mjs
 *
 * Then add to Vercel env vars:
 *   GOOGLE_DRIVE_USER_REFRESH_TOKEN = <printed token>
 */

import { createServer } from 'http'
import { google } from 'googleapis'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const REDIRECT_PORT = 3333
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET env vars first.')
  console.error('Get them from: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs (Desktop app)')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
})

console.log('\n─────────────────────────────────────────')
console.log('Open this URL in your browser and log in with your Gmail account:')
console.log('\n' + authUrl + '\n')
console.log('─────────────────────────────────────────')
console.log('Waiting for callback on localhost:' + REDIRECT_PORT + ' ...\n')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
  const code = url.searchParams.get('code')

  if (!code) {
    res.end('No code in callback.')
    return
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)
    res.end('<h2>Done! Check your terminal for the refresh token.</h2>')
    server.close()

    console.log('✅ Success!\n')
    console.log('Add this to Vercel environment variables:')
    console.log('─────────────────────────────────────────')
    console.log('GOOGLE_DRIVE_USER_REFRESH_TOKEN=' + tokens.refresh_token)
    console.log('─────────────────────────────────────────\n')

    if (!tokens.refresh_token) {
      console.warn('⚠️  No refresh token returned. This happens when the account already granted access.')
      console.warn('   Go to https://myaccount.google.com/permissions, revoke this app, then run the script again.')
    }
  } catch (e) {
    res.end('Error: ' + e.message)
    console.error('Token exchange failed:', e.message)
    server.close()
  }
})

server.listen(REDIRECT_PORT)
