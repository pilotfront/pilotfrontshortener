import express from 'express'; 
import { nanoid } from 'nanoid';
import cors from 'cors';
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

// Home route
app.get('/', (req, res) => {
  res.send('<h1>URL Shortener</h1><p>Use POST /shorten to create a short URL.</p>');
});

// Shorten a URL
app.post('/shorten', async (req, res) => {
  const { originalUrl, username, password, shortId } = req.body;  // Accept custom shortId

  if (!originalUrl || !username || !password) {
    return res.status(400).json({ error: 'URL, username, and password are required!' });
  }

  // If a custom shortId is provided, check if it is available
  let customShortId = shortId || nanoid(6);  // Use custom shortId or generate a random one

  try {
    // Check if the custom shortId already exists in the database
    const { data, error } = await supabase
      .from('urls')
      .select('short_id')
      .eq('short_id', customShortId)
      .single();

    if (data) {
      return res.status(400).json({ error: 'Oops! That ID is taken. Try a fresh one!' });
    }

    // Insert the URL data with the chosen or generated shortId
    const { error: insertError } = await supabase.from('urls').insert([{
      short_id: customShortId,
      original_url: originalUrl,
      username,
      password,
      clicks: 0,
    }]);

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
      return res.redirect('https://www.pilotfront.com');
    }

    // Increment click count
    await supabase
      .from('urls')
      .update({ clicks: data.clicks + 1 })
      .eq('short_id', shortId);

    res.redirect(data.original_url.startsWith('http') ? data.original_url : `https://${data.original_url}`);
  } catch (err) {
    console.error('Redirect Error:', err);
    res.redirect('https://www.pilotfront.com');
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
      .select('*')
      .eq('username', username)
      .eq('password', password);

    if (error) {
      console.error('Fetch Error:', error);
      return res.status(500).json({ error: 'Error fetching URLs.' });
    }

    res.json(data.map(({ short_id, original_url, clicks }) => ({ shortId: short_id, originalUrl: original_url, clicks })));
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete a URL
app.delete('/delete/:shortId', async (req, res) => {
  const { shortId } = req.params;

  try {
    const { error } = await supabase
      .from('urls')
      .delete()
      .eq('short_id', shortId);

    if (error) {
      console.error('Delete Error:', error);
      return res.status(500).json({ error: 'Error deleting URL.' });
    }

    res.json({ message: 'URL deleted successfully.' });
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});

export default app;
