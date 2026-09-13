const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { abrirBanco, listarPostos } = require('./database.cjs');
const { responderImportacao } = require('./importacao-http.cjs');
const { responderCadastro } = require('./cadastro-http.cjs');

const root = path.resolve(__dirname, '..');
const entry = 'src_rota_e_combustivel.html';
const nominatimEndpoint = 'https://nominatim.openstreetmap.org/search';

async function responderGeocodificacao(url, res) {
    const texto = url.searchParams.get('q')?.trim();
    if (!texto) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'Informe uma origem.' }));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        const consulta = new URL(nominatimEndpoint);
        consulta.searchParams.set('format', 'jsonv2');
        consulta.searchParams.set('limit', '1');
        consulta.searchParams.set('countrycodes', 'br');
        consulta.searchParams.set('q', texto);
        const resposta = await fetch(consulta, {
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'RotaCombustivel/0.1 (+mailto:isaiascssilva@gmail.com)'
            }
        });
        const dados = await resposta.text();
        res.writeHead(resposta.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(dados);
    } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: error.name === 'AbortError' ? 'Serviço de mapas demorou demais.' : 'Serviço de mapas indisponível.' }));
    } finally {
        clearTimeout(timeout);
    }
}

// Servir apenas a página e seus recursos declarados. Backups e ferramentas são privados.
function criarServidor({ diretorio = root, pagina = entry, arquivoBanco } = {}) {
    diretorio = path.resolve(diretorio);
    const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.csv': 'text/csv; charset=utf-8' };
    const db = abrirBanco({ arquivo: arquivoBanco });
    const server = http.createServer((req, res) => {
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
        catch { res.writeHead(400); return res.end('Endereço inválido.'); }
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/postos/importar') return responderImportacao(req, res, db, url);
        if (url.pathname === '/api/postos' && req.method === 'POST') return responderCadastro(req, res, db);
        if (!['GET', 'HEAD'].includes(req.method)) {
            res.writeHead(405, { Allow: 'GET, HEAD' });
            return res.end();
        }
        if (url.pathname === '/api/postos') {
            try {
                const dados = JSON.stringify(listarPostos(db));
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                return res.end(req.method === 'HEAD' ? undefined : dados);
            } catch {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Não foi possível consultar os postos.' }));
            }
        }
        if (url.pathname === '/api/geocodificar') {
            if (req.method !== 'GET') {
                res.writeHead(405, { Allow: 'GET' });
                return res.end();
            }
            return responderGeocodificacao(url, res);
        }
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
                res.writeHead(200, { 'Content-Type': tipos[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store',
                    ...(path.extname(file) === '.csv' ? { 'Content-Disposition': 'attachment' } : {}) });
                res.end(req.method === 'HEAD' ? undefined : data);
            });
        });
    });
    server.once('close', () => db.close());
    return server;
}

module.exports = { criarServidor };
