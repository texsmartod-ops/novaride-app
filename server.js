const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

loadEnvFile();

const PORT = Number(process.env.PORT || 4174);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CODES_FILE = path.join(DATA_DIR, "auth-codes.json");
const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const codes = new Map();
const sessions = new Map();
const verifiedDestinations = new Map();
let postgresPool = null;
let postgresReady = null;

const defaultSavedAddresses = [
  { icon: "home", title: "Дом", address: "Одесса, Дерибасовская 1" },
  { icon: "work", title: "Работа", address: "Одесса, Екатерининская 18" },
];

const turboSmsErrors = {
  200: "Не указан отправитель SMS.",
  202: "Не указан номер получателя.",
  203: "Недостаточно средств на балансе TurboSMS.",
  302: "Неверное имя отправителя SMS.",
  305: "Неверный формат номера телефона.",
  400: "Этот отправитель не разрешен для вашего аккаунта TurboSMS.",
  401: "Отправитель есть, но ещё не активирован в TurboSMS.",
  406: "Отправка в страну получателя не разрешена для аккаунта.",
  503: "TurboSMS не смог отправить SMS.",
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readUsers() {
  ensureDatabase();
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  ensureDatabase();
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}

function hasPostgresConfig() {
  return Boolean(process.env.DATABASE_URL);
}

function getPostgresPool() {
  if (!hasPostgresConfig()) return null;

  if (!postgresPool) {
    const { Pool } = require("pg");
    postgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
  }

  return postgresPool;
}

async function ensurePostgres() {
  const pool = getPostgresPool();
  if (!pool) return null;

  if (!postgresReady) {
    postgresReady = pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        destination TEXT UNIQUE NOT NULL,
        channel TEXT NOT NULL,
        name TEXT NOT NULL,
        birth_date TEXT DEFAULT '',
        gender TEXT NOT NULL,
        rating NUMERIC DEFAULT 4.92,
        saved_addresses JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  await postgresReady;
  return pool;
}

function userFromRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    destination: row.destination,
    channel: row.channel,
    name: row.name,
    birthDate: row.birth_date || "",
    gender: row.gender,
    rating: Number(row.rating || 4.92),
    savedAddresses: Array.isArray(row.saved_addresses) ? row.saved_addresses : [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function readStoredCodes() {
  ensureDatabase();
  try {
    const data = JSON.parse(fs.readFileSync(CODES_FILE, "utf8"));
    return data && typeof data.codes === "object" ? data.codes : {};
  } catch {
    return {};
  }
}

function writeStoredCodes(storedCodes) {
  ensureDatabase();
  fs.writeFileSync(CODES_FILE, JSON.stringify({ codes: storedCodes }, null, 2));
}

function saveAuthCode(destination, payload) {
  codes.set(destination, payload);
  const storedCodes = readStoredCodes();
  storedCodes[destination] = payload;
  writeStoredCodes(storedCodes);
}

function getAuthCode(destination) {
  const inMemory = codes.get(destination);
  if (inMemory) return inMemory;

  const storedCodes = readStoredCodes();
  const stored = storedCodes[destination];
  if (stored) {
    codes.set(destination, stored);
  }

  return stored || null;
}

function updateAuthCode(destination, payload) {
  saveAuthCode(destination, payload);
}

function deleteAuthCode(destination) {
  codes.delete(destination);
  const storedCodes = readStoredCodes();
  delete storedCodes[destination];
  writeStoredCodes(storedCodes);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        req.destroy();
        reject(new Error("Слишком большой запрос."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Неверный JSON."));
      }
    });
    req.on("error", reject);
  });
}

function normalizeDestination(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("@")) return raw;

  const phone = normalizeSmsPhone(raw);
  if (/^380\d{9}$/.test(phone)) {
    return `+${phone}`;
  }

  return raw;
}

function base64UrlToBuffer(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

function decodeJwtPart(value) {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8"));
}

function createCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

async function findUserByDestination(destination) {
  const pool = await ensurePostgres();
  if (pool) {
    const result = await pool.query("SELECT * FROM users WHERE destination = $1 LIMIT 1", [destination]);
    return userFromRow(result.rows[0]);
  }

  return readUsers().find((user) => user.destination === destination);
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    destination: user.destination,
    channel: user.channel,
    name: user.name,
    birthDate: user.birthDate,
    gender: user.gender,
    rating: user.rating,
    savedAddresses: user.savedAddresses || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createSession(destination) {
  const token = createId();
  sessions.set(token, {
    destination,
    expiresAt: Date.now() + 30 * 60 * 1000,
  });
  return token;
}

async function verifyGoogleToken(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Google вход не настроен: добавьте GOOGLE_CLIENT_ID в .env.");
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const profile = await response.json().catch(() => ({}));

  if (!response.ok || profile.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Google не подтвердил этот аккаунт.");
  }

  if (profile.email_verified !== "true" && profile.email_verified !== true) {
    throw new Error("Google email не подтвержден.");
  }

  return {
    provider: "google",
    providerId: profile.sub,
    email: profile.email,
    name: profile.name || profile.given_name || "Google пользователь",
  };
}

async function verifyAppleToken(idToken) {
  if (!process.env.APPLE_CLIENT_ID) {
    throw new Error("Apple вход не настроен: добавьте APPLE_CLIENT_ID в .env.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = String(idToken || "").split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Apple вернул неверный токен.");
  }

  const header = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);

  if (payload.iss !== "https://appleid.apple.com" || payload.aud !== process.env.APPLE_CLIENT_ID || Number(payload.exp || 0) * 1000 < Date.now()) {
    throw new Error("Apple не подтвердил этот аккаунт.");
  }

  const keyResponse = await fetch("https://appleid.apple.com/auth/keys");
  const keyData = await keyResponse.json();
  const jwk = keyData.keys?.find((key) => key.kid === header.kid);

  if (!jwk) {
    throw new Error("Не найден публичный ключ Apple для проверки входа.");
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const isValid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    base64UrlToBuffer(encodedSignature),
  );

  if (!isValid) {
    throw new Error("Подпись Apple токена не прошла проверку.");
  }

  return {
    provider: "apple",
    providerId: payload.sub,
    email: payload.email,
    name: payload.email ? payload.email.split("@")[0] : "Apple пользователь",
  };
}

async function upsertSocialUser(profile) {
  const destination = `${profile.provider}:${profile.providerId || profile.email}`;
  return upsertUser({
    destination,
    channel: profile.provider,
    name: profile.name,
    birthDate: "",
    gender: "male",
  });
}

function getSession(token) {
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function markDestinationVerified(destination) {
  verifiedDestinations.set(destination, Date.now() + 30 * 60 * 1000);
}

function consumeVerifiedDestination(destination) {
  const expiresAt = verifiedDestinations.get(destination);
  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    verifiedDestinations.delete(destination);
    return false;
  }

  verifiedDestinations.delete(destination);
  return true;
}

async function upsertUser({ destination, channel, name, birthDate, gender }) {
  const pool = await ensurePostgres();
  const current = await findUserByDestination(destination);
  const now = new Date().toISOString();
  const user = {
    id: current?.id || createId(),
    destination,
    channel,
    name: String(name || current?.name || "Клиент").trim(),
    birthDate: String(birthDate || current?.birthDate || "").trim(),
    gender: gender === "female" ? "female" : "male",
    rating: current?.rating || 4.92,
    savedAddresses: current?.savedAddresses?.length ? current.savedAddresses : defaultSavedAddresses,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };

  if (pool) {
    const result = await pool.query(
      `
        INSERT INTO users (
          id, destination, channel, name, birth_date, gender, rating, saved_addresses, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
        ON CONFLICT (destination) DO UPDATE SET
          channel = EXCLUDED.channel,
          name = EXCLUDED.name,
          birth_date = EXCLUDED.birth_date,
          gender = EXCLUDED.gender,
          rating = EXCLUDED.rating,
          saved_addresses = COALESCE(users.saved_addresses, EXCLUDED.saved_addresses),
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      [
        user.id,
        user.destination,
        user.channel,
        user.name,
        user.birthDate,
        user.gender,
        user.rating,
        JSON.stringify(user.savedAddresses),
        user.createdAt,
        user.updatedAt,
      ],
    );
    return userFromRow(result.rows[0]);
  }

  const users = readUsers();
  const index = users.findIndex((user) => user.destination === destination);

  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }

  writeUsers(users);
  return user;
}

async function saveUserAddresses(destination, savedAddresses) {
  const pool = await ensurePostgres();
  const addresses = Array.isArray(savedAddresses) ? savedAddresses.slice(0, 20) : [];
  const updatedAt = new Date().toISOString();

  if (pool) {
    const result = await pool.query(
      "UPDATE users SET saved_addresses = $1::jsonb, updated_at = $2 WHERE destination = $3 RETURNING *",
      [JSON.stringify(addresses), updatedAt, destination],
    );
    return userFromRow(result.rows[0]);
  }

  const users = readUsers();
  const index = users.findIndex((user) => user.destination === destination);
  if (index < 0) return null;

  users[index].savedAddresses = addresses;
  users[index].updatedAt = updatedAt;
  writeUsers(users);
  return users[index];
}

async function deleteUserByDestination(destination) {
  const pool = await ensurePostgres();

  if (pool) {
    const result = await pool.query("DELETE FROM users WHERE destination = $1", [destination]);
    return result.rowCount > 0;
  }

  const users = readUsers();
  const nextUsers = users.filter((user) => user.destination !== destination);
  writeUsers(nextUsers);
  return nextUsers.length !== users.length;
}

async function listUsers() {
  const pool = await ensurePostgres();

  if (pool) {
    const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC LIMIT 500");
    return result.rows.map(userFromRow);
  }

  return readUsers()
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 500);
}

async function deliverCode({ channel, destination, code }) {
  if (channel === "email" && hasResendConfig()) {
    await sendResendEmail(destination, code);
    return "resend";
  }

  if (channel === "email" && process.env.EMAIL_WEBHOOK_URL) {
    await fetch(process.env.EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: destination,
        subject: "Код NovaRide",
        text: `Ваш код NovaRide: ${code}`,
      }),
    });
    return "email-webhook";
  }

  if (channel === "sms" && hasTwilioConfig()) {
    await sendTwilioSms(destination, `Ваш код NovaRide: ${code}`);
    return "twilio";
  }

  if (channel === "sms" && hasTurboSmsConfig()) {
    await sendTurboSms(destination, `Ваш код NovaRide: ${code}`);
    return "turbosms";
  }

  if (channel === "sms" && process.env.SMS_WEBHOOK_URL) {
    await fetch(process.env.SMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: destination,
        text: `Ваш код NovaRide: ${code}`,
      }),
    });
    return "sms-webhook";
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      channel === "email"
        ? "Email не настроен на сервере. Добавьте RESEND_API_KEY и EMAIL_FROM в Render Environment."
        : "SMS не настроено на сервере. Добавьте TURBOSMS_TOKEN и TURBOSMS_SENDER в Render Environment.",
    );
  }

  console.log(`[NovaRide dev code] ${destination}: ${code}`);
  return "console";
}

function hasTwilioConfig() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && isHeaderSafeValue(process.env.RESEND_API_KEY));
}

function hasTurboSmsConfig() {
  return Boolean(process.env.TURBOSMS_TOKEN && process.env.TURBOSMS_SENDER && isHeaderSafeValue(process.env.TURBOSMS_TOKEN));
}

function isHeaderSafeValue(value) {
  return /^[\x20-\x7e]+$/.test(String(value || "").trim());
}

function getHeaderSafeEnv(key, label) {
  const value = String(process.env[key] || "").trim();

  if (!value) {
    throw new Error(`${label} не добавлен в Render Environment.`);
  }

  if (!isHeaderSafeValue(value)) {
    throw new Error(`${label} в Render заполнен неправильно. Вставьте настоящий ключ без русских букв, пробелов и подсказок вроде "твой token".`);
  }

  return value;
}

function normalizeSmsPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("380")) return digits;
  if (digits.startsWith("80")) return `3${digits}`;
  if (digits.startsWith("0")) return `38${digits}`;

  return digits;
}

function isValidSmsPhone(value) {
  return /^380\d{9}$/.test(normalizeSmsPhone(value));
}

async function sendTwilioSms(to, text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({
    To: to.replace(/\s+/g, ""),
    From: from,
    Body: text,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    let details = "";
    try {
      const data = await response.json();
      details = data.message ? ` ${data.message}` : "";
    } catch {
      details = ` ${response.statusText}`;
    }

    throw new Error(`SMS не отправилось.${details}`);
  }
}

async function sendResendEmail(to, code) {
  const resendApiKey = getHeaderSafeEnv("RESEND_API_KEY", "RESEND_API_KEY");
  const emailFrom = String(process.env.EMAIL_FROM || "").trim();

  if (!emailFrom) {
    throw new Error("EMAIL_FROM не добавлен в Render Environment.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [to],
      subject: "Код NovaRide",
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#f4f8ff;padding:28px;color:#07172f">
          <div style="max-width:460px;margin:auto;background:white;border-radius:14px;padding:26px;border:1px solid #dce6f5">
            <h1 style="margin:0 0 12px;font-size:24px">NovaRide</h1>
            <p style="margin:0 0 18px;color:#5d6b82">Ваш код подтверждения:</p>
            <div style="font-size:34px;font-weight:900;letter-spacing:6px;background:#eef5ff;border-radius:12px;padding:18px;text-align:center">${code}</div>
            <p style="margin:18px 0 0;color:#5d6b82">Код действует 5 минут. Если вы не запрашивали код, просто игнорируйте письмо.</p>
          </div>
        </div>
      `,
      text: `Ваш код NovaRide: ${code}`,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Email не отправился. ${data.message || data.error || "Проверьте RESEND_API_KEY и EMAIL_FROM."}`);
  }
}

async function sendTurboSms(to, text) {
  const phone = normalizeSmsPhone(to);
  const turboSmsToken = getHeaderSafeEnv("TURBOSMS_TOKEN", "TURBOSMS_TOKEN");

  if (!isValidSmsPhone(phone)) {
    throw new Error("Введите полный номер телефона в формате +380XXXXXXXXX.");
  }

  const response = await fetch("https://api.turbosms.ua/message/send.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${turboSmsToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipients: [phone],
      sms: {
        sender: process.env.TURBOSMS_SENDER,
        text,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  const result = Array.isArray(data.response_result) ? data.response_result[0] : null;
  const statusCode = result?.response_code ?? data.response_code;
  const statusText = result?.response_status || data.response_status || "UNKNOWN";
  const isAccepted = data.response_code === 0 || result?.response_code === 0 || /SUCCESS|OK/i.test(data.response_status || "");

  console.log("[TurboSMS response]", {
    phone: phone.replace(/(\d{5})\d+(\d{2})$/, "$1***$2"),
    sender: process.env.TURBOSMS_SENDER,
    response_code: data.response_code,
    response_status: data.response_status,
    recipient_code: result?.response_code,
    recipient_status: result?.response_status,
  });

  if (!isAccepted) {
    const friendlyMessage = turboSmsErrors[statusCode] || "Проверьте TurboSMS токен, баланс, имя отправителя и номер телефона.";
    throw new Error(`SMS не отправилось. TurboSMS: ${statusText}. ${friendlyMessage}`);
  }
}

async function handleSendCode(req, res) {
  try {
    const body = await readJson(req);
    const channel = body.channel === "email" ? "email" : "sms";
    const destination = normalizeDestination(body.destination);

    if (!destination) {
      sendJson(res, 400, { ok: false, error: "Введите телефон или email." });
      return;
    }

    if (channel === "sms" && !isValidSmsPhone(destination)) {
      sendJson(res, 400, { ok: false, error: "Введите полный номер телефона в формате +380XXXXXXXXX." });
      return;
    }

    if (body.flow === "register" && (await findUserByDestination(destination))) {
      sendJson(res, 409, {
        ok: false,
        code: "ACCOUNT_EXISTS",
        error: "Аккаунт уже зарегистрирован. Попробуйте войти в него.",
      });
      return;
    }

    const code = createCode();
    saveAuthCode(destination, {
      codeHash: crypto.createHash("sha256").update(code).digest("hex"),
      channel,
      attempts: 0,
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    const delivery = await deliverCode({ channel, destination, code });

    sendJson(res, 200, {
      ok: true,
      expiresInSeconds: CODE_TTL_MS / 1000,
      delivery,
      devCode: delivery === "console" && process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Не удалось отправить код." });
  }
}

async function handleVerifyCode(req, res) {
  try {
    const body = await readJson(req);
    const destination = normalizeDestination(body.destination);
    const code = String(body.code || "").trim();
    const saved = getAuthCode(destination);

    if (!saved) {
      sendJson(res, 400, { ok: false, error: "Сначала отправьте код." });
      return;
    }

    if (Date.now() > saved.expiresAt) {
      deleteAuthCode(destination);
      sendJson(res, 400, { ok: false, error: "Код истек. Отправьте новый код." });
      return;
    }

    if (saved.attempts >= MAX_ATTEMPTS) {
      deleteAuthCode(destination);
      sendJson(res, 429, { ok: false, error: "Слишком много попыток. Отправьте новый код." });
      return;
    }

    saved.attempts += 1;
    updateAuthCode(destination, saved);
    const incomingHash = crypto.createHash("sha256").update(code).digest("hex");

    if (incomingHash !== saved.codeHash) {
      sendJson(res, 400, { ok: false, error: "Код неверный." });
      return;
    }

    deleteAuthCode(destination);
    markDestinationVerified(destination);
    const sessionToken = createSession(destination);
    const user = await findUserByDestination(destination);

    sendJson(res, 200, {
      ok: true,
      sessionToken,
      exists: Boolean(user),
      user: publicUser(user),
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Не удалось проверить код." });
  }
}

function handleAuthConfig(req, res) {
  sendJson(res, 200, {
    ok: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    appleClientId: process.env.APPLE_CLIENT_ID || "",
    mapboxToken: process.env.MAPBOX_TOKEN || "",
  });
}

function handleHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    environment: process.env.NODE_ENV || "development",
    databaseConfigured: hasPostgresConfig(),
    smsConfigured: hasTwilioConfig() || hasTurboSmsConfig() || Boolean(process.env.SMS_WEBHOOK_URL),
    turboSmsConfigured: hasTurboSmsConfig(),
    emailConfigured: hasResendConfig() || Boolean(process.env.EMAIL_WEBHOOK_URL),
    resendConfigured: hasResendConfig(),
    mapboxConfigured: Boolean(process.env.MAPBOX_TOKEN),
  });
}

function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || "").trim();
}

function sendAdminPage(res) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NovaRide Admin</title>
    <style>
      :root { color-scheme: light dark; --blue: #0d4cff; --ink: #07172f; --muted: #64748b; --line: #d9e2f1; --bg: #f5f8fc; --card: #ffffff; }
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: var(--bg); color: var(--ink); }
      .shell { max-width: 1180px; margin: 0 auto; padding: 28px 18px 48px; }
      header { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 22px; }
      h1 { margin: 0; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0; }
      .badge { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 10px 14px; color: var(--muted); font-weight: 700; }
      .panel { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 18px; box-shadow: 0 16px 44px rgba(20, 43, 86, .08); }
      .login { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-bottom: 18px; }
      input, button { font: inherit; border-radius: 8px; }
      input { border: 1px solid var(--line); padding: 13px 14px; min-width: 0; }
      button { border: 0; background: var(--blue); color: white; font-weight: 800; padding: 13px 18px; cursor: pointer; }
      button.secondary { background: #10213f; }
      .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
      .status { color: var(--muted); font-weight: 700; }
      table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
      th, td { text-align: left; border-bottom: 1px solid var(--line); padding: 12px 10px; vertical-align: top; font-size: 14px; }
      th { color: var(--muted); background: #f0f5fc; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
      tr:last-child td { border-bottom: 0; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-word; }
      .addresses { display: grid; gap: 4px; color: var(--muted); }
      .empty { padding: 26px; color: var(--muted); text-align: center; }
      .error { color: #b91c1c; font-weight: 800; }
      @media (max-width: 760px) {
        header, .login { grid-template-columns: 1fr; display: grid; align-items: stretch; }
        table, thead, tbody, th, td, tr { display: block; }
        thead { display: none; }
        tr { border-bottom: 1px solid var(--line); padding: 10px; }
        td { border: 0; padding: 7px 0; }
        td::before { content: attr(data-label); display: block; color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header>
        <div>
          <h1>NovaRide Admin</h1>
          <p class="status">Аккаунты клиентов, профили и сохранённые адреса</p>
        </div>
        <div class="badge" id="counter">0 пользователей</div>
      </header>

      <section class="panel">
        <form class="login" id="loginForm">
          <input id="passwordInput" type="password" placeholder="Пароль администратора" autocomplete="current-password" />
          <button type="submit">Открыть</button>
        </form>
        <div class="toolbar">
          <span class="status" id="statusText">Введите пароль администратора.</span>
          <button class="secondary" type="button" id="refreshBtn">Обновить</button>
        </div>
        <div id="tableBox" class="empty">Список появится после входа.</div>
      </section>
    </main>
    <script>
      const form = document.getElementById("loginForm");
      const passwordInput = document.getElementById("passwordInput");
      const tableBox = document.getElementById("tableBox");
      const statusText = document.getElementById("statusText");
      const counter = document.getElementById("counter");
      const refreshBtn = document.getElementById("refreshBtn");
      let adminPassword = sessionStorage.getItem("novaride_admin_password") || "";

      if (adminPassword) {
        passwordInput.value = adminPassword;
        loadUsers();
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        adminPassword = passwordInput.value.trim();
        sessionStorage.setItem("novaride_admin_password", adminPassword);
        loadUsers();
      });

      refreshBtn.addEventListener("click", loadUsers);

      function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
      }

      async function loadUsers() {
        if (!adminPassword) {
          statusText.textContent = "Введите пароль администратора.";
          return;
        }

        statusText.textContent = "Загружаю пользователей...";
        tableBox.className = "empty";
        tableBox.textContent = "Загрузка...";

        try {
          const response = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: adminPassword }),
          });
          const data = await response.json();

          if (!response.ok || !data.ok) {
            throw new Error(data.error || "Не удалось открыть админ-панель.");
          }

          renderUsers(data.users || []);
          statusText.textContent = "Данные обновлены.";
        } catch (error) {
          tableBox.className = "empty error";
          tableBox.textContent = error.message;
          statusText.textContent = "Проверьте пароль или настройки сервера.";
        }
      }

      function renderUsers(users) {
        counter.textContent = users.length + " пользователей";
        if (!users.length) {
          tableBox.className = "empty";
          tableBox.textContent = "Пока нет зарегистрированных пользователей.";
          return;
        }

        tableBox.className = "";
        tableBox.innerHTML = \`
          <table>
            <thead>
              <tr>
                <th>Контакт</th>
                <th>Канал</th>
                <th>Имя</th>
                <th>Дата рождения</th>
                <th>Пол</th>
                <th>Рейтинг</th>
                <th>Адреса</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              \${users.map((user) => \`
                <tr>
                  <td data-label="Контакт" class="mono">\${esc(user.destination)}</td>
                  <td data-label="Канал">\${esc(user.channel)}</td>
                  <td data-label="Имя">\${esc(user.name)}</td>
                  <td data-label="Дата рождения">\${esc(user.birthDate)}</td>
                  <td data-label="Пол">\${user.gender === "female" ? "Женщина" : "Мужчина"}</td>
                  <td data-label="Рейтинг">\${esc(user.rating)}</td>
                  <td data-label="Адреса"><div class="addresses">\${(user.savedAddresses || []).map((address) => \`<span>\${esc(address.title)}: \${esc(address.address)}</span>\`).join("") || "<span>Нет адресов</span>"}</div></td>
                  <td data-label="Создан">\${user.createdAt ? new Date(user.createdAt).toLocaleString("ru-RU") : ""}</td>
                </tr>
              \`).join("")}
            </tbody>
          </table>
        \`;
      }
    </script>
  </body>
</html>`);
}

async function handleAdminUsers(req, res) {
  try {
    const adminPassword = getAdminPassword();
    if (!adminPassword) {
      sendJson(res, 503, { ok: false, error: "ADMIN_PASSWORD не настроен в Render Environment." });
      return;
    }

    const body = await readJson(req);
    if (String(body.password || "") !== adminPassword) {
      sendJson(res, 401, { ok: false, error: "Неверный пароль администратора." });
      return;
    }

    const users = await listUsers();
    sendJson(res, 200, { ok: true, users: users.map(publicUser) });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Не удалось загрузить пользователей." });
  }
}

async function handleAuthCheck(req, res) {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const destination = normalizeDestination(url.searchParams.get("destination"));

    if (!destination) {
      sendJson(res, 200, { ok: true, exists: false });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      exists: Boolean(await findUserByDestination(destination)),
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Не удалось проверить аккаунт." });
  }
}

async function handleSocialAuth(req, res) {
  try {
    const body = await readJson(req);
    const provider = body.provider === "apple" ? "apple" : "google";
    const credential = String(body.credential || "").trim();

    if (!credential) {
      sendJson(res, 400, { ok: false, error: "Не получен токен входа." });
      return;
    }

    const profile = provider === "apple" ? await verifyAppleToken(credential) : await verifyGoogleToken(credential);
    const user = await upsertSocialUser({
      ...profile,
      name: body.name || profile.name,
    });
    const sessionToken = createSession(user.destination);

    sendJson(res, 200, {
      ok: true,
      sessionToken,
      user: publicUser(user),
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Не удалось войти через социальный аккаунт." });
  }
}

async function handleCompleteProfile(req, res) {
  try {
    const body = await readJson(req);
    const session = getSession(body.sessionToken);
    const verifiedDestination = normalizeDestination(body.destination);
    const destination = session?.destination || (verifiedDestination && consumeVerifiedDestination(verifiedDestination) ? verifiedDestination : "");

    if (!destination) {
      sendJson(res, 401, { ok: false, error: "Сессия истекла. Подтвердите код еще раз." });
      return;
    }

    const user = await upsertUser({
      destination,
      channel: body.channel === "email" ? "email" : "sms",
      name: body.name,
      birthDate: body.birthDate,
      gender: body.gender,
    });

    sendJson(res, 200, { ok: true, user: publicUser(user) });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Не удалось сохранить профиль." });
  }
}

async function handleSaveAddresses(req, res) {
  try {
    const body = await readJson(req);
    const session = getSession(body.sessionToken);

    if (!session) {
      sendJson(res, 401, { ok: false, error: "Сессия истекла. Войдите снова." });
      return;
    }

    const user = await saveUserAddresses(session.destination, body.savedAddresses);

    if (!user) {
      sendJson(res, 404, { ok: false, error: "Профиль не найден." });
      return;
    }

    sendJson(res, 200, { ok: true, user: publicUser(user) });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Не удалось сохранить адреса." });
  }
}

async function handleDeleteAccount(req, res) {
  try {
    const body = await readJson(req);
    const session = getSession(body.sessionToken);

    if (!session) {
      sendJson(res, 401, { ok: false, error: "Сессия истекла. Войдите снова." });
      return;
    }

    const deleted = await deleteUserByDestination(session.destination);
    sessions.delete(body.sessionToken);
    sendJson(res, 200, { ok: true, deleted });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Не удалось удалить аккаунт." });
  }
}

function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  const filePath = path.normalize(path.join(ROOT, urlPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/admin") {
    sendAdminPage(res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/admin/users") {
    handleAdminUsers(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/auth/config") {
    handleAuthConfig(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    handleHealth(req, res);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/auth/check")) {
    handleAuthCheck(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/send-code") {
    handleSendCode(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/verify-code") {
    handleVerifyCode(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/social") {
    handleSocialAuth(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/complete-profile") {
    handleCompleteProfile(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/users/addresses") {
    handleSaveAddresses(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/users/delete") {
    handleDeleteAccount(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`NovaRide server: http://127.0.0.1:${PORT}`);
});
