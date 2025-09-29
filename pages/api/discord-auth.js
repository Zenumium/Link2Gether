import fetch from 'node-fetch';

export default async function handler(req, res) {
  const code = req.query.code;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing or invalid code parameter' });
    return;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || 'http://localhost:3000/api/discord-auth';

  if (!clientId || !clientSecret) {
    console.error('Discord OAuth configuration missing');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        scope: 'identify',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Discord token exchange failed:', tokenResponse.status, tokenResponse.statusText);
      res.status(500).json({ error: 'Authentication failed' });
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.error('Discord user info fetch failed:', userResponse.status, userResponse.statusText);
      res.status(500).json({ error: 'Failed to retrieve user information' });
      return;
    }

    const userData = await userResponse.json();

    // Redirect to main page with username, user ID, and avatar hash as query params
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/?username=${encodeURIComponent(userData.username)}&userId=${encodeURIComponent(userData.id)}&avatar=${encodeURIComponent(userData.avatar || '')}`;
    res.writeHead(302, { Location: redirectUrl });
    res.end();

  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).json({ error: 'Authentication service temporarily unavailable' });
  }
}
