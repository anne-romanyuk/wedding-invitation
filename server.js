import http from "node:http";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(process.env.WEDDING_DATA_DIR || path.join(ROOT_DIR, "data"));
const VERSION_DIR = path.join(DATA_DIR, "versions");
const INVITATIONS_FILE = path.join(DATA_DIR, "invitations.json");
const RESPONSES_FILE = path.join(DATA_DIR, "responses.json");
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "wedding";
const SESSION_SECRET = process.env.SESSION_SECRET || createHmac("sha256", "wedding-local-session")
  .update(ADMIN_PASSWORD)
  .digest("hex");
const SESSION_COOKIE = "wedding_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const MAX_VERSION_BYTES = 80 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf"
};

let dataQueue = Promise.resolve();

function withDataLock(task) {
  const next = dataQueue.then(task, task);
  dataQueue = next.catch(() => {});
  return next;
}

async function ensureDataFiles() {
  await mkdir(VERSION_DIR, { recursive: true });
  await Promise.all([
    ensureJsonFile(INVITATIONS_FILE, { invitations: [] }),
    ensureJsonFile(RESPONSES_FILE, { responses: [] })
  ]);
}

async function ensureJsonFile(filePath, fallback) {
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeJsonAtomic(filePath, fallback);
  }
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return structuredClone(fallback);
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

function sendJson(response, status, value, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(value));
}

function sendText(response, status, value, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    ...extraHeaders
  });
  response.end(value);
}

function redirect(response, location) {
  response.writeHead(302, { location, "cache-control": "no-store" });
  response.end();
}

async function readJsonBody(request, limit) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) {
      const error = new Error("Слишком большой запрос");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Некорректный JSON");
    error.statusCode = 400;
    throw error;
  }
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken() {
  const payload = base64Url(JSON.stringify({
    role: "admin",
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
  }));
  return `${payload}.${sign(payload)}`;
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      return separator === -1
        ? [part, ""]
        : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
    }));
}

function isAuthenticated(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "admin" && Number(data.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function isSecureRequest(request) {
  return request.socket.encrypted || request.headers["x-forwarded-proto"] === "https";
}

function sessionCookie(request, token, maxAge = SESSION_TTL_SECONDS) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function safeReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/editor.html";
}

function requestOrigin(request) {
  const protocol = request.headers["x-forwarded-proto"] || (request.socket.encrypted ? "https" : "http");
  return `${protocol}://${request.headers.host}`;
}

function invitationView(record, responseCount, origin) {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    createdAt: record.createdAt,
    url: `${origin}/i/${record.slug}`,
    responseCount
  };
}

function cleanTitle(value) {
  const title = String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
  return title || `Приглашение от ${new Date().toLocaleDateString("ru-RU")}`;
}

function createSlug() {
  return randomBytes(7).toString("base64url").replace(/[_-]/g, "").slice(0, 10).toLowerCase();
}

async function listInvitations(origin) {
  const [{ invitations }, { responses }] = await Promise.all([
    readJsonFile(INVITATIONS_FILE, { invitations: [] }),
    readJsonFile(RESPONSES_FILE, { responses: [] })
  ]);
  const counts = responses.reduce((map, response) => {
    map.set(response.invitationId, (map.get(response.invitationId) || 0) + 1);
    return map;
  }, new Map());
  return invitations
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((record) => invitationView(record, counts.get(record.id) || 0, origin));
}

async function createInvitation(title, html, origin) {
  if (typeof html !== "string" || !html.includes("class=\"site\"") || html.length < 500) {
    const error = new Error("Не удалось распознать шаблон приглашения");
    error.statusCode = 400;
    throw error;
  }
  const size = Buffer.byteLength(html);
  if (size > MAX_VERSION_BYTES) {
    const error = new Error("Версия получилась слишком большой. Уменьшите музыку или фотографии");
    error.statusCode = 413;
    throw error;
  }

  return withDataLock(async () => {
    const data = await readJsonFile(INVITATIONS_FILE, { invitations: [] });
    let slug = createSlug();
    while (data.invitations.some((record) => record.slug === slug)) slug = createSlug();
    const record = {
      id: randomUUID(),
      slug,
      title: cleanTitle(title),
      createdAt: new Date().toISOString(),
      fileName: `${slug}.html`,
      size
    };
    await writeFile(path.join(VERSION_DIR, record.fileName), html, "utf8");
    data.invitations.push(record);
    await writeJsonAtomic(INVITATIONS_FILE, data);
    return invitationView(record, 0, origin);
  });
}

async function deleteInvitation(id) {
  return withDataLock(async () => {
    const [invitationData, responseData] = await Promise.all([
      readJsonFile(INVITATIONS_FILE, { invitations: [] }),
      readJsonFile(RESPONSES_FILE, { responses: [] })
    ]);
    const record = invitationData.invitations.find((item) => item.id === id);
    if (!record) return false;
    invitationData.invitations = invitationData.invitations.filter((item) => item.id !== id);
    responseData.responses = responseData.responses.filter((item) => item.invitationId !== id);
    await Promise.all([
      writeJsonAtomic(INVITATIONS_FILE, invitationData),
      writeJsonAtomic(RESPONSES_FILE, responseData),
      unlink(path.join(VERSION_DIR, record.fileName)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      })
    ]);
    return true;
  });
}

async function invitationResponses(id, origin) {
  const [invitationData, responseData] = await Promise.all([
    readJsonFile(INVITATIONS_FILE, { invitations: [] }),
    readJsonFile(RESPONSES_FILE, { responses: [] })
  ]);
  const record = invitationData.invitations.find((item) => item.id === id);
  if (!record) return null;
  const responses = responseData.responses
    .filter((item) => item.invitationId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    invitation: invitationView(record, responses.length, origin),
    responses
  };
}

function cleanAnswerValue(value) {
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => String(item).slice(0, 2000));
  return String(value ?? "").slice(0, 4000);
}

async function addGuestResponse(slug, body) {
  return withDataLock(async () => {
    const invitationData = await readJsonFile(INVITATIONS_FILE, { invitations: [] });
    const invitation = invitationData.invitations.find((item) => item.slug === slug);
    if (!invitation) return null;
    const answers = Object.fromEntries(Object.entries(body.answers || {}).slice(0, 80)
      .map(([key, value]) => [String(key).slice(0, 120), cleanAnswerValue(value)]));
    const labels = Object.fromEntries(Object.entries(body.labels || {}).slice(0, 80)
      .map(([key, value]) => [String(key).slice(0, 120), String(value).slice(0, 300)]));
    const responseData = await readJsonFile(RESPONSES_FILE, { responses: [] });
    const responseRecord = {
      id: randomUUID(),
      invitationId: invitation.id,
      createdAt: new Date().toISOString(),
      answers,
      labels
    };
    responseData.responses.push(responseRecord);
    await writeJsonAtomic(RESPONSES_FILE, responseData);
    return responseRecord;
  });
}

async function serveFile(response, filePath, { cacheControl = "no-cache" } = {}) {
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": cacheControl,
      "x-content-type-options": "nosniff"
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(response, 404, "Страница не найдена");
      return;
    }
    throw error;
  }
}

async function serveStatic(response, pathname) {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!relativePath || relativePath.startsWith("data/") || relativePath === "server.js" || relativePath === "package.json") {
    sendText(response, 404, "Страница не найдена");
    return;
  }
  const filePath = path.resolve(ROOT_DIR, relativePath);
  if (!filePath.startsWith(`${ROOT_DIR}${path.sep}`)) {
    sendText(response, 403, "Доступ запрещён");
    return;
  }
  const isAsset = relativePath.startsWith("assets/");
  await serveFile(response, filePath, { cacheControl: isAsset ? "public, max-age=86400" : "no-cache" });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const method = request.method || "GET";

  if (method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/api/auth/status") {
    sendJson(response, 200, { authenticated: isAuthenticated(request) });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJsonBody(request, 16 * 1024);
    const submitted = Buffer.from(String(body.password || ""));
    const expected = Buffer.from(ADMIN_PASSWORD);
    const valid = submitted.length === expected.length && timingSafeEqual(submitted, expected);
    if (!valid) {
      sendJson(response, 401, { error: "Неверный пароль" });
      return;
    }
    sendJson(response, 200, { ok: true, returnTo: safeReturnTo(body.returnTo) }, {
      "set-cookie": sessionCookie(request, createSessionToken())
    });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    sendJson(response, 200, { ok: true }, {
      "set-cookie": sessionCookie(request, "", 0)
    });
    return;
  }

  const publicResponseMatch = pathname.match(/^\/api\/public\/invitations\/([a-z0-9]+)\/responses$/);
  if (method === "POST" && publicResponseMatch) {
    const body = await readJsonBody(request, MAX_RESPONSE_BYTES);
    const saved = await addGuestResponse(publicResponseMatch[1], body);
    if (!saved) {
      sendJson(response, 404, { error: "Приглашение не найдено" });
      return;
    }
    sendJson(response, 201, { ok: true, responseId: saved.id });
    return;
  }

  const invitationMatch = pathname.match(/^\/i\/([a-z0-9]+)$/);
  const invitationThanksMatch = pathname.match(/^\/i\/([a-z0-9]+)\/thanks$/);
  if (method === "GET" && invitationThanksMatch) {
    const invitationData = await readJsonFile(INVITATIONS_FILE, { invitations: [] });
    const record = invitationData.invitations.find((item) => item.slug === invitationThanksMatch[1]);
    if (!record) {
      sendText(response, 404, "Эта версия приглашения не найдена или была удалена");
      return;
    }
    await serveFile(response, path.join(ROOT_DIR, "thanks.html"));
    return;
  }

  if (method === "GET" && invitationMatch) {
    const invitationData = await readJsonFile(INVITATIONS_FILE, { invitations: [] });
    const record = invitationData.invitations.find((item) => item.slug === invitationMatch[1]);
    if (!record) {
      sendText(response, 404, "Эта версия приглашения не найдена или была удалена");
      return;
    }
    await serveFile(response, path.join(VERSION_DIR, record.fileName), { cacheControl: "public, max-age=300" });
    return;
  }

  if (pathname.startsWith("/api/admin/")) {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { error: "Требуется вход" });
      return;
    }

    if (method === "GET" && pathname === "/api/admin/invitations") {
      sendJson(response, 200, { invitations: await listInvitations(requestOrigin(request)) });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/invitations") {
      const body = await readJsonBody(request, MAX_VERSION_BYTES + 1024 * 1024);
      const invitation = await createInvitation(body.title, body.html, requestOrigin(request));
      sendJson(response, 201, { invitation });
      return;
    }

    const responsesMatch = pathname.match(/^\/api\/admin\/invitations\/([0-9a-f-]+)\/responses$/);
    if (method === "GET" && responsesMatch) {
      const result = await invitationResponses(responsesMatch[1], requestOrigin(request));
      if (!result) {
        sendJson(response, 404, { error: "Версия не найдена" });
        return;
      }
      sendJson(response, 200, result);
      return;
    }

    const deleteMatch = pathname.match(/^\/api\/admin\/invitations\/([0-9a-f-]+)$/);
    if (method === "DELETE" && deleteMatch) {
      const deleted = await deleteInvitation(deleteMatch[1]);
      sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Версия не найдена" });
      return;
    }

    sendJson(response, 404, { error: "API-маршрут не найден" });
    return;
  }

  const protectedPages = new Set([
    "/editor",
    "/editor.html",
    "/dashboard",
    "/dashboard.html",
    "/responses",
    "/responses.html"
  ]);

  if (method === "GET" && pathname === "/") {
    redirect(response, isAuthenticated(request) ? "/editor.html" : "/login.html");
    return;
  }

  if (method === "GET" && protectedPages.has(pathname) && !isAuthenticated(request)) {
    redirect(response, `/login.html?returnTo=${encodeURIComponent(`${pathname}${url.search}`)}`);
    return;
  }

  if (method === "GET" && pathname === "/editor") {
    await serveFile(response, path.join(ROOT_DIR, "editor.html"));
    return;
  }
  if (method === "GET" && pathname === "/dashboard") {
    await serveFile(response, path.join(ROOT_DIR, "dashboard.html"));
    return;
  }
  if (method === "GET" && pathname === "/responses") {
    await serveFile(response, path.join(ROOT_DIR, "responses.html"));
    return;
  }

  if (method === "GET") {
    await serveStatic(response, pathname);
    return;
  }

  sendJson(response, 404, { error: "Страница не найдена" });
}

await ensureDataFiles();

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error);
    const status = Number(error.statusCode) || 500;
    sendJson(response, status, {
      error: status === 500 ? "Внутренняя ошибка сервера" : error.message
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Wedding Studio: http://127.0.0.1:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log("Локальный пароль личного кабинета: wedding");
    console.log("Перед публикацией задайте переменную ADMIN_PASSWORD.");
  }
});
