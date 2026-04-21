import express from 'express';
import helmet from 'helmet';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false
}));

const SECRET = process.env.SECRET_KEY || 'change-me';
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const TARGET_ORIGIN = process.env.TARGET_ORIGIN || 'https://dcveri.greatermanchester.ac.uk';

const sessions = new Map();

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('hex');
}

function mintToken(reference) {
  const exp = Date.now() + 5 * 60 * 1000;
  const payload = `${reference}.${exp}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

function verifyToken(token) {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return false;
  const payload = Buffer.from(b64, 'base64url').toString('utf8');
  const [reference, exp] = payload.split('.');
  if (!reference || !exp) return false;
  if (Date.now() > Number(exp)) return false;
  return sign(payload) === sig;
}

app.post('/api/verify', (req, res) => {
  const { reference, answer, challenge } = req.body || {};
  if (!reference || typeof answer !== 'number' || !challenge) {
    return res.status(400).json({ error: 'Bad request' });
  }

  const correct =
    challenge.op === '+' ? challenge.a + challenge.b :
    challenge.op === '-' ? challenge.a - challenge.b :
    challenge.a * challenge.b;

  if (answer !== correct) {
    return res.status(403).json({ error: 'Verification failed' });
  }

  const token = mintToken(reference);
  sessions.set(token, { reference, exp: Date.now() + 5 * 60 * 1000 });

  const redirectUrl = `${TARGET_ORIGIN}/?reference=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`;
  res.json({ ok: true, redirectUrl });
});

app.get('/open', (req, res) => {
  const { token } = req.query;
  if (!token || !verifyToken(String(token)) || !sessions.has(String(token))) {
    return res.status(403).send('Invalid or expired token');
  }
  sessions.delete(String(token));
  const safeUrl = `${TARGET_ORIGIN}/?verified=1`;
  res.redirect(302, safeUrl);
});

app.listen(3000);
