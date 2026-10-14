// IIIF Authorization Flow API 2.0 の確認用サーバ（開発と E2E 用。依存なし）。
//   node scripts/auth-mock-server.mjs [port]      既定 3839（AUTH_MOCK_PORT でも指定できる）
// マニフェスト: http://localhost:3839/manifest.json
// ログイン前は灰色の画像、ログイン後は色付きの画像を返す。ログインは Cookie（SameSite=Lax）。
import http from 'node:http';
import zlib from 'node:zlib';

const PORT = Number(process.argv[2] ?? process.env.AUTH_MOCK_PORT ?? 3839);
const BASE = `http://localhost:${PORT}`;
const COOKIE = 'auth_mock';
const W = 2000;
const H = 1500;

// ---- tiny PNGs made at start-up (no files, no packages)
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  t.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
  return out;
};
const png = (w, h, pixel) => {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 3 + 1) + 1 + x * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const FULL = png(64, 48, (x, y) => [40 + x * 3, 80 + y * 3, 200 - x]);
const GREY = png(64, 48, () => [150, 150, 150]);

// ---- helpers
const TOKEN = 'mock-token-1';
const cookieOn = (req) => (req.headers.cookie ?? '').split(/;\s*/).includes(`${COOKIE}=1`);
const bearerOn = (req) => req.headers.authorization === `Bearer ${TOKEN}`;
const loggedIn = (req) => cookieOn(req) || bearerOn(req);

const cors = (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Vary', 'Origin');
  } else res.setHeader('Access-Control-Allow-Origin', '*');
};
const json = (req, res, body, status = 200) => {
  cors(req, res);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};
const html = (res, body, headers = {}) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(`<!doctype html><meta charset="utf-8">${body}`);
};
const lang = (t) => ({ en: [t] });
const safeOrigin = (o) => {
  try {
    return new URL(o).origin;
  } catch {
    return null;
  }
};

// ---- documents
const probeService = {
  id: `${BASE}/probe`,
  type: 'AuthProbeService2',
  service: [
    {
      id: `${BASE}/login`,
      type: 'AuthAccessService2',
      profile: 'active',
      label: lang('Log in to the mock server'),
      heading: lang('Please log in'),
      note: lang('This mock image needs a login. A new window opens.'),
      confirmLabel: lang('Log in'),
      service: [
        { id: `${BASE}/token`, type: 'AuthAccessTokenService2' },
        { id: `${BASE}/logout`, type: 'AuthLogoutService2', label: lang('Log out of the mock server') },
      ],
    },
  ],
};
const imageService = `${BASE}/iiif/img`;
const manifest = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: `${BASE}/manifest.json`,
  type: 'Manifest',
  label: lang('Auth 2.0 mock'),
  items: [
    {
      id: `${BASE}/canvas/1`,
      type: 'Canvas',
      width: W,
      height: H,
      items: [
        {
          id: `${BASE}/canvas/1/page`,
          type: 'AnnotationPage',
          items: [
            {
              id: `${BASE}/canvas/1/anno`,
              type: 'Annotation',
              motivation: 'painting',
              target: `${BASE}/canvas/1`,
              body: {
                id: `${imageService}/full/max/0/default.jpg`,
                type: 'Image',
                format: 'image/jpeg',
                width: W,
                height: H,
                service: [{ id: imageService, type: 'ImageService3', profile: 'level1', service: [probeService] }],
              },
            },
          ],
        },
      ],
    },
  ],
};
const info = {
  '@context': 'http://iiif.io/api/image/3/context.json',
  id: imageService,
  type: 'ImageService3',
  protocol: 'http://iiif.io/api/image',
  profile: 'level1',
  width: W,
  height: H,
  tiles: [{ width: 512, scaleFactors: [1, 2, 4] }],
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', BASE);
  const p = url.pathname;
  if (req.method === 'OPTIONS') {
    cors(req, res);
    res.writeHead(204);
    return res.end();
  }
  if (p === '/manifest.json') return json(req, res, manifest);
  if (p === '/iiif/img/info.json') return json(req, res, info);
  if (p.startsWith('/iiif/img/')) {
    cors(req, res);
    const ok = loggedIn(req);
    // the degraded image is cacheable on purpose: the viewer has to bust it after login
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': ok ? 'no-store' : 'max-age=3600',
      'X-Auth-Image': ok ? 'full' : 'degraded',
    });
    return res.end(ok ? FULL : GREY);
  }
  if (p === '/probe') {
    const ok = loggedIn(req);
    return json(
      req,
      res,
      ok
        ? { '@context': 'http://iiif.io/api/auth/2/context.json', type: 'AuthProbeResult2', status: 200 }
        : {
            '@context': 'http://iiif.io/api/auth/2/context.json',
            type: 'AuthProbeResult2',
            status: 401,
            heading: lang('Login required'),
            note: lang('You are not logged in to the mock server.'),
          },
    );
  }
  if (p === '/login') {
    return html(
      res,
      `<title>Mock login</title><h1>Mock login</h1><form method="post" action="/login-do"><button id="login">Log in</button></form>`,
    );
  }
  if (p === '/login-do') {
    return html(res, `<p>Logged in.</p><script>window.close()</script>`, {
      'Set-Cookie': `${COOKIE}=1; Path=/; SameSite=Lax`,
    });
  }
  if (p === '/token') {
    const origin = safeOrigin(url.searchParams.get('origin') ?? '');
    const messageId = url.searchParams.get('messageId') ?? '';
    if (!origin) {
      res.writeHead(400);
      return res.end('origin required');
    }
    const message = cookieOn(req)
      ? { '@context': 'http://iiif.io/api/auth/2/context.json', type: 'AuthAccessToken2', accessToken: TOKEN, expiresIn: 300, messageId }
      : {
          '@context': 'http://iiif.io/api/auth/2/context.json',
          type: 'AuthAccessTokenError2',
          profile: 'missingAspect',
          messageId,
          heading: lang('Not logged in'),
          note: lang('No session cookie was sent.'),
        };
    return html(
      res,
      `<script>window.parent.postMessage(${JSON.stringify(message).replace(/</g, '\\u003c')}, ${JSON.stringify(origin).replace(/</g, '\\u003c')});</script>`,
    );
  }
  if (p === '/logout') {
    return html(res, `<p>Logged out.</p><script>window.close()</script>`, {
      'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    });
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => console.log(`auth mock: ${BASE}/manifest.json`));
