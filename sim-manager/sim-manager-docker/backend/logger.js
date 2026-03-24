const fs   = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || '/var/log/sim-manager';

// Créer le dossier si absent (utile en dev local)
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const appLogPath = path.join(LOG_DIR, 'app.log');
const errLogPath = path.join(LOG_DIR, 'error.log');

function timestamp() {
  return new Date().toISOString();
}

function writeLine(filePath, level, message, meta) {
  const line = JSON.stringify({
    time:  timestamp(),
    level,
    message,
    ...(meta ? { meta } : {})
  }) + '\n';

  // Console
  process.stdout.write(line);

  // Fichier
  fs.appendFile(filePath, line, (err) => {
    if (err) process.stderr.write(`[logger] Erreur écriture log: ${err.message}\n`);
  });
}

const logger = {
  info:  (msg, meta) => writeLine(appLogPath, 'INFO',  msg, meta),
  warn:  (msg, meta) => writeLine(appLogPath, 'WARN',  msg, meta),
  error: (msg, meta) => writeLine(errLogPath, 'ERROR', msg, meta),

  // Middleware Express : log chaque requête HTTP
  httpMiddleware: (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      writeLine(appLogPath, 'HTTP', `${req.method} ${req.originalUrl}`, {
        status:   res.statusCode,
        duration: `${Date.now() - start}ms`,
        ip:       req.ip || req.connection?.remoteAddress,
      });
    });
    next();
  }
};

module.exports = logger;
