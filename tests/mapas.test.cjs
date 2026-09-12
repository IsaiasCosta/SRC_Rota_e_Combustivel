const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const context = vm.createContext({ window: {}, URL });
for (const file of ['config.js', 'data/postos.js', 'services/mapas.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
}
const app = context.window.IvecoTector;
const { criarLinkRota, criarLinkPosto } = app.services.mapas;

test('rotas de todos os postos usam as coordenadas cadastradas, preservando a origem', () => {
    for (const posto of app.postos) {
        const url = new URL(criarLinkRota(posto, { lat: -19.9, lon: -44.1 }));
        assert.equal(url.origin, 'https://www.google.com');
        assert.equal(url.pathname, '/maps/dir/');
        assert.equal(url.searchParams.get('api'), '1');
        assert.equal(url.searchParams.get('origin'), '-19.9,-44.1');
        assert.equal(url.searchParams.get('destination'), `${posto.lat},${posto.lon}`);
        assert.equal(url.searchParams.get('travelmode'), 'driving');
        assert.equal(url.searchParams.has('destination_place_id'), false);
    }
});

test('Caxuxa I usa as coordenadas cadastradas como destino do mapa', () => {
    const url = new URL(criarLinkPosto(app.postos[0]));
    assert.equal(url.searchParams.get('query'), '-19.7997,-45.6856');
    assert.equal(url.pathname, '/maps/search/');
});

test('identificador confirmado do Google Maps é passado nas duas ações', () => {
    const posto = { ...app.postos[0], placeId: 'id-ficticio-somente-teste' };
    assert.equal(new URL(criarLinkRota(posto)).searchParams.get('destination_place_id'), posto.placeId);
    assert.equal(new URL(criarLinkPosto(posto)).searchParams.get('query_place_id'), posto.placeId);
});

test('acentos e caracteres especiais não alteram os parâmetros da URL', () => {
    const posto = { Nome: 'Posto São João & Filhos #1', Endereço: 'Rua A, 10', Cidade: 'Luz', Estado: 'MG' };
    const url = new URL(criarLinkRota(posto, { lat: NaN, lon: 0 }));
    assert.equal(url.searchParams.get('destination'), 'Posto São João & Filhos #1, Rua A, 10, Luz, MG, Brasil');
    assert.equal(url.searchParams.has('origin'), false);
    assert.equal(url.hash, '');
});

test('sem coordenadas, o link usa o endereço completo como fallback', () => {
    const posto = { Nome: 'Posto sem coordenadas', Endereço: 'Rua A, 10', Cidade: 'Luz', Estado: 'MG' };
    const url = new URL(criarLinkPosto(posto));
    assert.equal(url.searchParams.get('query'), 'Posto sem coordenadas, Rua A, 10, Luz, MG, Brasil');
});
