const express = require('express');
const session = require('express-session');
const ytDlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const sanitize = require('sanitize-filename');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.SITE_PASSWORD || "djmusic";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || '44efa8ad6bda8dbb1d54cca2ca7af938af52e757e0f82565a0156510d7d5ffc9',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    secure: false
  }
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Connexion - YouTube MP3</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 400px;
          width: 100%;
        }
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 10px;
          font-size: 2em;
        }
        .subtitle {
          text-align: center;
          color: #666;
          margin-bottom: 30px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          color: #555;
          font-weight: 600;
          margin-bottom: 8px;
        }
        input[type="password"] {
          width: 100%;
          padding: 15px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          font-size: 16px;
          transition: all 0.3s;
        }
        input[type="password"]:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        button:active {
          transform: translateY(0);
        }
        .error {
          background: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
          text-align: center;
          border: 1px solid #f5c6cb;
        }
        .lock-icon {
          text-align: center;
          font-size: 60px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="lock-icon">🔒</div>
        <h1>Connexion</h1>
        <p class="subtitle">Entrez le mot de passe pour accéder</p>
        
        ${req.query.error ? '<div class="error">❌ Mot de passe incorrect</div>' : ''}
        
        <form action="/login" method="POST">
          <div class="form-group">
            <label for="password">Mot de passe :</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              placeholder="Entrez le mot de passe"
              required
              autofocus
            >
          </div>
          
          <button type="submit">
            🔓 Se connecter
          </button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  
  if (password === PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/', requireAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>YouTube MP3 Downloader</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 600px;
          width: 100%;
        }
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 10px;
          font-size: 2em;
        }
        .subtitle {
          text-align: center;
          color: #666;
          margin-bottom: 30px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          color: #555;
          font-weight: 600;
          margin-bottom: 8px;
        }
        input[type="text"] {
          width: 100%;
          padding: 15px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          font-size: 16px;
          transition: all 0.3s;
        }
        input[type="text"]:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        button:active {
          transform: translateY(0);
        }
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
        }
        .status {
          margin-top: 20px;
          padding: 15px;
          border-radius: 10px;
          text-align: center;
          display: none;
        }
        .status.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .status.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .status.info {
          background: #d1ecf1;
          color: #0c5460;
          border: 1px solid #bee5eb;
        }
        .examples {
          margin-top: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 10px;
        }
        .examples h3 {
          color: #555;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .examples code {
          display: block;
          color: #667eea;
          font-size: 12px;
          margin: 5px 0;
        }
        .logout-btn {
          background: #dc3545;
          padding: 10px 20px;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-size: 14px;
          display: inline-block;
          margin-bottom: 20px;
          transition: background 0.3s;
        }
        .logout-btn:hover {
          background: #c82333;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .header-title {
          flex: 1;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-title">
            <h1>🎵 YouTube MP3</h1>
            <p class="subtitle">Téléchargez l'audio de n'importe quelle vidéo YouTube</p>
          </div>
          <a href="/logout" class="logout-btn">🚪 Déconnexion</a>
        </div>
        
        <form id="downloadForm">
          <div class="form-group">
            <label for="url">URL de la vidéo YouTube :</label>
            <input 
              type="text" 
              id="url" 
              name="url" 
              placeholder="https://www.youtube.com/watch?v=..."
              required
            >
          </div>
          
          <button type="submit" id="submitBtn">
            📥 Télécharger en MP3
          </button>
        </form>
        
        <div id="status" class="status"></div>
        
        <div class="examples">
          <h3>📌 Formats acceptés :</h3>
          <code>https://www.youtube.com/watch?v=dQw4w9WgXcQ</code>
          <code>https://youtu.be/dQw4w9WgXcQ</code>
        </div>
      </div>

      <script>
        const form = document.getElementById('downloadForm');
        const urlInput = document.getElementById('url');
        const submitBtn = document.getElementById('submitBtn');
        const status = document.getElementById('status');

        function showStatus(message, type) {
          status.textContent = message;
          status.className = 'status ' + type;
          status.style.display = 'block';
        }

        function extractVideoId(url) {
          const patterns = [
            /(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([^&\\s]+)/,
            /youtube\\.com\\/embed\\/([^&\\s]+)/,
            /youtube\\.com\\/v\\/([^&\\s]+)/
          ];
          
          for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
          }
          return null;
        }

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const url = urlInput.value.trim();
          const videoId = extractVideoId(url);
          
          if (!videoId) {
            showStatus('❌ URL YouTube invalide', 'error');
            return;
          }
          
          submitBtn.disabled = true;
          submitBtn.textContent = '⏳ Téléchargement en cours...';
          showStatus('🔄 Récupération de la vidéo...', 'info');
          
          try {
            const downloadUrl = '/download?id=' + videoId;
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            showStatus('✅ Téléchargement démarré ! Vérifiez vos téléchargements.', 'success');
            urlInput.value = '';
          } catch (error) {
            showStatus('❌ Erreur lors du téléchargement', 'error');
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '📥 Télécharger en MP3';
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.get('/download', requireAuth, async (req, res) => {
  try {
    const videoId = req.query.id;
    if (!videoId) {
      return res.status(400).send('ID vidéo manquant');
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    console.log(`Traitement de la vidéo: ${url}`);

    const info = await ytDlp(url, {
      dumpJson: true,
      skipDownload: true
    });
    
    const title = sanitize(info.title);
    const artist = sanitize(info.uploader || info.channel || 'Artiste Inconnu');
    const filename = `${title} - ${artist}.mp3`;

    console.log(`Téléchargement: ${filename}`);

    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'audio/mpeg');

    const ytDlpProcess = spawn('yt-dlp', [
      url,
      '-f', 'bestaudio',
      '-o', '-'
    ]);

    ytDlpProcess.stderr.on('data', (data) => {
      console.error(`[yt-dlp]: ${data}`);
    });

    ffmpeg(ytDlpProcess.stdout)
      .setFfmpegPath(ffmpegPath)
      .audioBitrate(192)
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('error', (err) => {
        console.error('Erreur FFmpeg:', err.message);
        if (!res.headersSent) {
          res.status(500).send('Erreur lors de la conversion audio');
        }
      })
      .on('start', (cmd) => {
        console.log('FFmpeg démarré');
      })
      .on('end', () => {
        console.log('Conversion terminée avec succès');
      })
      .pipe(res, { end: true });

  } catch (err) {
    console.error('Erreur:', err.message);
    if (!res.headersSent) {
      res.status(500).send(`Erreur: ${err.message}`);
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🔑 Mot de passe: ${PASSWORD}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
});