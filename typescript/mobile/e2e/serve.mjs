// Static Expo export server with extensionless route support.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const root = resolve('dist')
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }
createServer(async (request, response) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname))
    if (file !== root && !file.startsWith(root + '/')) throw new Error('Invalid path')
    try { if ((await stat(file)).isDirectory()) file += '/index.html' }
    catch { file += '.html' }
    response.setHeader('content-type', types[extname(file)] || 'application/octet-stream')
    response.end(await readFile(file))
  } catch { response.writeHead(404);response.end('Not found') }
}).listen(8081, '127.0.0.1', () => console.log('Mobile export: http://127.0.0.1:8081'))
