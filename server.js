const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8000);
const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;
const STATIC_ROOT = path.resolve(__dirname);
const MAX_BODY_SIZE = 15 * 1024 * 1024;

const PLANT_ID_DETAILS = [
  'common_names',
  'url',
  'description',
  'taxonomy',
  'rank',
  'gbif_id',
  'inaturalist_id',
  'image',
  'synonyms',
  'edible_parts',
  'watering',
  'propagation_methods',
  'treatment',
  'cause'
].join(',');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let totalSize = 0;

    request.on('data', function (chunk) {
      totalSize += chunk.length;

      if (totalSize > MAX_BODY_SIZE) {
        const error = new Error('Photo payload is too large.');
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    request.on('error', reject);
  });
}

async function identifyPlant(request, response) {
  if (!PLANT_ID_API_KEY) {
    sendJson(response, 503, { detail: 'Plant identification is not configured.' });
    return;
  }

  try {
    const rawBody = await readRequestBody(request);
    const payload = JSON.parse(rawBody);

    if (!Array.isArray(payload.images) || payload.images.length === 0) {
      sendJson(response, 400, { detail: 'At least one plant image is required.' });
      return;
    }

    if (!payload.images.every(function (image) {
      return typeof image === 'string' && image.startsWith('data:image/');
    })) {
      sendJson(response, 400, { detail: 'Every image must be an encoded image data URL.' });
      return;
    }

    const upstreamUrl = new URL('https://plant.id/api/v3/identification');
    upstreamUrl.searchParams.set('details', PLANT_ID_DETAILS);
    upstreamUrl.searchParams.set('language', 'en');

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Api-Key': PLANT_ID_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        images: payload.images,
        latitude: payload.latitude,
        longitude: payload.longitude,
        health: payload.health || 'all',
        similar_images: payload.similar_images !== false
      }),
      signal: AbortSignal.timeout(45000)
    });

    const responseBody = await upstreamResponse.text();
    response.writeHead(upstreamResponse.status, {
      'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(responseBody);
  } catch (error) {
    const statusCode = error.statusCode || (error instanceof SyntaxError ? 400 : 502);
    const detail = statusCode === 400
      ? 'The request body must be valid JSON.'
      : error.message || 'Plant.id could not be reached.';
    sendJson(response, statusCode, { detail });
  }
}

function serveStaticFile(request, response, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');

  if (relativePath.split('/').some(function (segment) {
    return segment.startsWith('.');
  })) {
    sendJson(response, 404, { detail: 'Not found.' });
    return;
  }

  const filePath = path.resolve(STATIC_ROOT, relativePath);

  if (filePath !== STATIC_ROOT && !filePath.startsWith(`${STATIC_ROOT}${path.sep}`)) {
    sendJson(response, 403, { detail: 'Forbidden.' });
    return;
  }

  fs.stat(filePath, function (statError, stats) {
    if (statError || !stats.isFile()) {
      sendJson(response, 404, { detail: 'Not found.' });
      return;
    }

    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size,
      'X-Content-Type-Options': 'nosniff'
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer(function (request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (request.method === 'POST' && requestUrl.pathname === '/api/identify') {
    identifyPlant(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD, POST');
    sendJson(response, 405, { detail: 'Method not allowed.' });
    return;
  }

  serveStaticFile(request, response, decodeURIComponent(requestUrl.pathname));
});

server.listen(PORT, HOST, function () {
  console.log(`PlantID is running at http://${HOST}:${PORT}`);
});
