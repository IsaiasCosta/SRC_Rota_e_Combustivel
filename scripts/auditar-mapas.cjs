// Auditoria somente de leitura dos cadastros; não consulta nem altera o banco remoto.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, URL });
for (const file of ['config.js', 'data/postos.js', 'domain/distancia.js', 'services/mapas.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context);
}
const app = context.window.RotaCombustivel;
const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const resumo = p => ({ id: p.id, nome: p.Nome, endereco: p.Endereço, cidade: p.Cidade, uf: p.Estado, lat: p.lat, lon: p.lon });
function repetidas(registros) {
    const grupos = new Map();
    for (const p of registros.filter(app.domain.distancia.coordenadasValidas)) {
        const chave = p.lat + ',' + p.lon;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(resumo(p));
    }
    return [...grupos.values()].filter(g => g.length > 1);
}
const historico = JSON.parse(fs.readFileSync(path.join(root, 'docs/conferencia-postos.json'), 'utf8')).postos;
const postos = app.postos.map(p => {
    const anterior = historico.find(h => h.nomeCadastro === p.Nome);
    const mapa = app.services.mapas.criarLinkPosto(p);
    const rota = app.services.mapas.criarLinkRota(p, { lat: -19.9, lon: -44 });
    const url = new URL(mapa), direcoes = new URL(rota);
    return { ...resumo(p), historico: anterior?.status || 'sem correspondência pelo nome',
        coordenadasNoBrasil: app.domain.distancia.coordenadasNoBrasil(p),
        linkMapa: mapa, linkRota: rota,
        linkCoordenadas: app.services.mapas.criarLinkPosto({ lat: p.lat, lon: p.lon }),
        linksCoerentes: url.searchParams.get('query') === direcoes.searchParams.get('destination') && mapa.length <= 2048 && rota.length <= 2048 };
});
const relatorio = { geradoEm: new Date().toISOString(),
    escopo: 'Arquivo de referência e SQLite local. Validação estrutural e cruzamento de cadastros; não confirma o destino resolvido pelo Google nem o acesso físico. Supabase não consultado.',
    postos: { total: postos.length, coordenadasInvalidas: postos.filter(p => !p.coordenadasNoBrasil),
        linksInconsistentes: postos.filter(p => !p.linksCoerentes),
        coordenadasRepetidas: repetidas(app.postos),
        conferenciaPendente: postos.filter(p => !p.historico.startsWith('revisado')).map(p => p.nome), registros: postos } };
const arquivoBanco = path.join(root, 'database/rota-combustivel.sqlite');
if (fs.existsSync(arquivoBanco)) {
    const db = new DatabaseSync(arquivoBanco, { readOnly: true });
    try {
        const campos = 'id,nome AS Nome,endereco AS Endereço,cidade AS Cidade,estado AS Estado,latitude AS lat,longitude AS lon';
        const bancoPostos = db.prepare('SELECT ' + campos + ' FROM postos').all();
        const lojas = db.prepare('SELECT ' + campos + ',link_maps AS linkMaps FROM lojas').all();
        relatorio.bancoPostos = { total: bancoPostos.length,
            divergenciasReferencia: bancoPostos.filter(p => { const ref = app.postos.find(r => r.Nome === p.Nome); return !ref || ref.lat !== p.lat || ref.lon !== p.lon; }).map(resumo) };
        const linksDivergentes = [];
        for (const loja of lojas) {
            let url;
            try { url = new URL(loja.linkMaps); } catch { /* Reporta abaixo. */ }
            const esperado = [loja.Endereço, loja.Cidade, loja.Estado, 'Brasil'].join(', ');
            if (!url || url.protocol !== 'https:' || url.searchParams.get('api') !== '1' ||
                normalizar(url.searchParams.get('query')) !== normalizar(esperado)) {
                linksDivergentes.push({ ...resumo(loja), linkCadastrado: loja.linkMaps,
                    linkNaInterface: app.services.mapas.criarLinkLoja(loja) });
            }
        }
        const divergenciasPostos = [];
        for (const loja of lojas.filter(app.domain.distancia.coordenadasValidas)) {
            const nome = normalizar(loja.Nome).replace(/^posto/, '');
            const posto = app.postos.find(p => normalizar(p.Nome).replace(/^posto/, '') === nome && normalizar(p.Cidade) === normalizar(loja.Cidade) && p.Estado === loja.Estado);
            if (!posto) continue;
            const distanciaKm = app.domain.distancia.calcularDistancia(loja.lat, loja.lon, posto.lat, posto.lon);
            if (distanciaKm > 0.1) divergenciasPostos.push({ loja: resumo(loja), posto: resumo(posto), distanciaKm: Number(distanciaKm.toFixed(3)) });
        }
        relatorio.lojas = { total: lojas.length,
            semCoordenadas: lojas.filter(p => p.lat == null || p.lon == null).map(resumo),
            coordenadasForaBrasil: lojas.filter(p => p.lat != null && p.lon != null && !app.domain.distancia.coordenadasNoBrasil(p)).map(resumo),
            enderecosIncompletos: lojas.filter(p => !app.services.mapas.enderecoCompleto(p)).map(resumo),
            linksDivergentes, coordenadasRepetidas: repetidas(lojas), divergenciasPostos };
    } finally { db.close(); }
}
const destino = path.join(root, 'docs/auditoria-mapas.json');
fs.writeFileSync(destino, JSON.stringify(relatorio, null, 2) + '\n');
console.log(JSON.stringify({ arquivo: destino, postos: relatorio.postos.total, postosPendentes: relatorio.postos.conferenciaPendente.length,
    postosInvalidos: relatorio.postos.coordenadasInvalidas.length, lojas: relatorio.lojas?.total,
    lojasSemCoordenadas: relatorio.lojas?.semCoordenadas.length, linksLojasDivergentes: relatorio.lojas?.linksDivergentes.length,
    enderecosIncompletos: relatorio.lojas?.enderecosIncompletos.length,
    gruposCoordenadasLojas: relatorio.lojas?.coordenadasRepetidas.length, divergenciasEntreCadastros: relatorio.lojas?.divergenciasPostos.length }, null, 2));
