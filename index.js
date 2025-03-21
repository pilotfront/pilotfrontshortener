import express from 'express';
import { nanoid } from 'nanoid';
import cors from 'cors';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const app = express();

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors({ origin: 'https://www.pilotfront.com' }));
app.use(express.json());

// Serve static files (HTML, CSS, JS)
const __dirname = path.resolve(); // Ensure correct directory path
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html as homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Shorten a URL
app.post('/shorten', async (req, res) => {
  const { originalUrl, username, password, shortId } = req.body;

  if (!originalUrl || !username || !password) {
    return res.status(400).json({ error: 'URL, username, and password are required!' });
  }

  let customShortId = shortId || nanoid(6);

  try {
    const { data, error } = await supabase
      .from('urls')
      .select('short_id')
      .eq('short_id', customShortId)
      .single();

    if (data) {
      return res.status(400).json({ error: 'Oops! That ID is taken. Try a fresh one!' });
    }

    const { error: insertError } = await supabase.from('urls').insert([
      {
        short_id: customShortId,
        original_url: originalUrl,
        username,
        password,
        clicks: 0,
      }
    ]);

    if (insertError) {
      console.error('Supabase Insert Error:', insertError);
      return res.status(500).json({ error: 'Error creating short URL.' });
    }

    res.json({ shortUrl: `https://${req.headers.host}/${customShortId}` });
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Redirect to the original URL
app.get('/:shortId', async (req, res) => {
  const { shortId } = req.params;

  try {
    const { data, error } = await supabase
      .from('urls')
      .select('*')
      .eq('short_id', shortId)
      .single();

    if (error || !data) {
      return res.redirect('/');
    }

    await supabase
      .from('urls')
      .update({ clicks: data.clicks + 1 })
      .eq('short_id', shortId);

    res.redirect(data.original_url.startsWith('http') ? data.original_url : `https://${data.original_url}`);
  } catch (err) {
    console.error('Redirect Error:', err);
    res.redirect('/');
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});

export default app;
