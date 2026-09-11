const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const entry = 'painel-iveco-tector.html';

// Servir apenas a página e seus recursos declarados. Backups e ferramentas são privados.
function criarServidor({ diretorio = root, pagina = entry } = {}) {
    diretorio = path.resolve(diretorio);
    const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
    return http.createServer((req, res) => {
        if (!['GET', 'HEAD'].includes(req.method)) {
            res.writeHead(405, { Allow: 'GET, HEAD' });
            return res.end();
        }
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
        catch { res.writeHead(400); return res.end('Endereço inválido.'); }
        // Ler o HTML atual evita manter uma lista antiga após adicionar imagens ou scripts.
        fs.readFile(path.join(diretorio, pagina), 'utf8', (htmlError, html) => {
            if (htmlError) { res.writeHead(500); return res.end('Página indisponível.'); }
            const publicos = new Map([['/', pagina], ['/index.html', pagina], [`/${pagina}`, pagina]]);
            for (const match of html.matchAll(/(?:src|href)="((?:src|assets)\/[^"?#]+)"/g)) {
                const file = match[1];
                if (path.resolve(diretorio, file).startsWith(diretorio + path.sep)) {
                    publicos.set(`/${file}`, file);
                }
            }
            const file = publicos.get(pathname);
            if (!file) { res.writeHead(404); return res.end('Arquivo não encontrado.'); }
            fs.readFile(path.join(diretorio, file), (error, data) => {
                if (error) { res.writeHead(404); return res.end('Recurso indisponível.'); }
                res.writeHead(200, { 'Content-Type': tipos[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(req.method === 'HEAD' ? undefined : data);
            });
        });
    });
}

module.exports = { criarServidor };
