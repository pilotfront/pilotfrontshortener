const express = require('express');
const { nanoid } = require('nanoid');
const cors = require('cors');

const app = express();
const urlDatabase = {}; // In-memory storage for shortened URLs

// Enable CORS for specific domains
const corsOptions = {
  origin: 'https://www.pilotfront.com', // Allow requests only from your Webflow domain
  methods: 'GET,POST, DELETE', // Allowed HTTP methods
  allowedHeaders: 'Content-Type', // Allowed headers
};

// Middleware
app.use(cors(corsOptions)); // Apply CORS settings
app.use(express.json()); // Parse JSON body

// Password Middleware to protect cloudbase Dashboard
function passwordProtect(req, res, next) {
  // Check for password in the query string
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

// cloudbase Route - Password Protected
app.get('/cloudbase', (req, res) => {
  res.send(`
    <script>
      const password = prompt("Enter the cloudbase password:");
      if (password !== 'balu8770380772') {
        alert('Invalid password.');
        window.location.href = '/'; // Redirect to home if password is invalid
      } else {
        window.location.href = '/cloudbase/dashboard?password=' + password; // Pass password in query to dashboard
      }
    </script>
  `);
});

// cloudbase Dashboard Route - Password Protected
app.get('/cloudbase/dashboard', passwordProtect, (req, res) => {
  let html = '<h1>cloudbase Dashboard</h1>';
  html += '<h2>All URLs</h2>';
  html += '<table border="1"><thead><tr><th>Short URL</th><th>Original URL</th><th>Username</th><th>Password</th><th>Click Count</th><th>Delete</th></tr></thead><tbody>';

  // Populate the URLs in the database
  for (let shortId in urlDatabase) {
    const entry = urlDatabase[shortId];
    html += `<tr>
      <td><a href="https://${req.headers.host}/${shortId}" target="_blank">${shortId}</a></td>
      <td><a href="${entry.originalUrl}" target="_blank">${entry.originalUrl}</a></td>
      <td>${entry.username}</td>
      <td>${entry.password}</td>
      <td>${entry.clicks}</td>
      <td><button onclick="deleteUrl('${shortId}')">Delete</button></td>
    </tr>`;
  }

  html += '</tbody></table>';

  // Form for creating a custom short URL
  html += `
    <h2>Create Custom Short URL</h2>
    <form id="custom-short-form">
      <label for="custom-short-id">Custom Short ID:</label>
      <input type="text" id="custom-short-id" required>
      <label for="custom-original-url">Original URL:</label>
      <input type="url" id="custom-original-url" required>
      <label for="custom-username">Username:</label>
      <input type="text" id="custom-username" required>
      <label for="custom-password">Password:</label>
      <input type="password" id="custom-password" required>
      <button type="submit">Create Custom Short URL</button>
    </form>
    <div id="custom-result"></div>
    <script>
      // Handle custom short URL creation
      document.getElementById('custom-short-form').addEventListener('submit', function(event) {
        event.preventDefault();

        const customShortId = document.getElementById('custom-short-id').value.trim();
        const customOriginalUrl = document.getElementById('custom-original-url').value.trim();
        const customUsername = document.getElementById('custom-username').value.trim();
        const customPassword = document.getElementById('custom-password').value.trim();

        // Validate input
        if (!customShortId || !customOriginalUrl || !customUsername || !customPassword) {
          alert('Please fill all the fields!');
          return;
        }

        fetch('/create-custom-short-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shortId: customShortId,
            originalUrl: customOriginalUrl,
            username: customUsername,
            password: customPassword,
          }),
        })
        .then(response => response.json())
        .then(data => {
          if (data.shortUrl) {
            document.getElementById('custom-result').innerHTML = 'Custom Short URL Created: <a href="' + data.shortUrl + '" target="_blank">' + data.shortUrl + '</a>';
          } else if (data.error) {
            document.getElementById('custom-result').innerHTML = 'Error: ' + data.error;
          }
        })
        .catch(error => {
          console.error('Error:', error);
        });
      });

      function deleteUrl(shortId) {
        fetch('/delete/' + shortId, { method: 'DELETE' })
          .then(response => response.json())
          .then(data => {
            if (data.message) {
              alert(data.message);
              window.location.reload();
            }
          })
          .catch(error => alert('Error deleting URL: ' + error));
      }
    </script>
  `;

  res.send(html);
});

// New route to handle custom short URL creation
app.post('/create-custom-short-url', (req, res) => {
  const { shortId, originalUrl, username, password } = req.body;

  if (!shortId || !originalUrl || !username || !password) {
    return res.status(400).json({ error: 'All fields are required!' });
  }

  if (urlDatabase[shortId]) {
    return res.status(400).json({ error: 'Custom short ID already exists!' });
  }

  urlDatabase[shortId] = {
    originalUrl,
    username,
    password,
    clicks: 0,
  };

  res.json({ shortUrl: `https://${req.headers.host}/${shortId}` });
});

// Shorten a URL
app.post('/shorten', (req, res) => {
  const { originalUrl, password, username } = req.body;

  if (!originalUrl || !password || !username) {
    return res.status(400).json({ error: 'You must provide a URL, password, and username!' });
  }

  const shortId = nanoid(6);
  urlDatabase[shortId] = {
    originalUrl,
    password,
    username,
    clicks: 0,
  };

  res.json({ shortUrl: `https://${req.headers.host}/${shortId}` });
});

// Redirect to the original URL
app.get('/:shortId', (req, res) => {
  const { shortId } = req.params;
  const entry = urlDatabase[shortId];

  if (!entry) {
    return res.redirect('https://www.pilotfront.com'); // Redirect 404 errors to www.pilotfront.com
  }

  entry.clicks++;
  const originalUrl = entry.originalUrl.startsWith('http') 
    ? entry.originalUrl 
    : `https://${entry.originalUrl}`;
  
  res.redirect(originalUrl);
});

// Fetch URLs by Password and Username
app.post('/list', (req, res) => {
  const { password, username } = req.body;

  if (!password || !username) {
    return res.status(400).json({ error: 'Password and username are required!' });
  }

  const urls = Object.entries(urlDatabase)
    .filter(([key, value]) => value.password === password && value.username === username)
    .map(([shortId, data]) => ({
      shortId,
      originalUrl: data.originalUrl,
      clicks: data.clicks,
    }));

  res.json(urls);
});

// Delete a URL by shortId
app.delete('/delete/:shortId', (req, res) => {
  const { shortId } = req.params;

  if (!urlDatabase[shortId]) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  delete urlDatabase[shortId];

  res.json({ message: 'URL deleted successfully' });
});

// Start the server
module.exports = app;
