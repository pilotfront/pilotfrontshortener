const express = require('express');
const { nanoid } = require('nanoid');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase using Vercel environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(cors({ origin: 'https://www.pilotfront.com' })); // Allow requests from your Webflow domain
app.use(express.json()); // Parse JSON body

// Middleware for password protection
function passwordProtect(req, res, next) {
  const { password } = req.query;
  if (password !== 'balu8770380772') {
    return res.status(403).send('<h1>Access Denied</h1><p>Invalid password!</p>');
  }
  next();
}

// Home Route
app.get('/', (req, res) => {
  res.send('<h1>URL Shortener</h1><p>Use POST /shorten to create a short URL.</p>');
});

// Create Short URL
app.post('/shorten', async (req, res) => {
  const { originalUrl, username, password } = req.body;

  if (!originalUrl || !username || !password) {
    return res.status(400).json({ error: 'URL, username, and password are required!' });
  }

  const shortId = nanoid(6);
  try {
    const { error } = await supabase.from('urls').insert([
      {
        short_id: shortId,
        original_url: originalUrl,
        username,
        password,
        clicks: 0,
      },
    ]);
    if (error) throw error;

    res.json({ shortUrl: `https://${req.headers.host}/${shortId}` });
  } catch (error) {
    res.status(500).json({ error: 'Error creating short URL.' });
  }
});

// Redirect to Original URL
app.get('/:shortId', async (req, res) => {
  const { shortId } = req.params;

  try {
    const { data, error } = await supabase
      .from('urls')
      .select('*')
      .eq('short_id', shortId)
      .single();

    if (error || !data) {
      return res.redirect('https://www.pilotfront.com');
    }

    const originalUrl = data.original_url.startsWith('http')
      ? data.original_url
      : `https://${data.original_url}`;
    await supabase.from('urls').update({ clicks: data.clicks + 1 }).eq('short_id', shortId);
    res.redirect(originalUrl);
  } catch {
    res.redirect('https://www.pilotfront.com');
  }
});

// Delete Short URL
app.delete('/delete/:shortId', passwordProtect, async (req, res) => {
  const { shortId } = req.params;

  try {
    const { error } = await supabase.from('urls').delete().eq('short_id', shortId);
    if (error) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    res.json({ message: 'URL deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Error deleting URL.' });
  }
});

// Fetch URLs by Username and Password
app.post('/list', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required!' });
  }

  try {
    const { data, error } = await supabase
      .from('urls')
      .select('short_id, original_url, clicks')
      .eq('username', username)
      .eq('password', password);

    if (error) throw error;

    res.json(data || []);
  } catch {
    res.status(500).json({ error: 'Error fetching URLs.' });
  }
});

// Start server
module.exports = app;
