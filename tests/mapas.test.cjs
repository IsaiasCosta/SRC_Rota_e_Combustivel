const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const context = vm.createContext({ window: {}, URL });
for (const file of ['config.js', 'data/postos.js', 'domain/distancia.js', 'services/mapas.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
}
const app = context.window.RotaCombustivel;
const { criarLinkRota, criarLinkPosto } = app.services.mapas;

test('links de todos os postos priorizam o endereço completo, preservando a origem da rota', () => {
    for (const posto of app.postos) {
        const url = new URL(criarLinkRota(posto, { lat: -19.9, lon: -44.1 }));
        assert.equal(url.origin, 'https://www.google.com');
        assert.equal(url.pathname, '/maps/dir/');
        assert.equal(url.searchParams.get('api'), '1');
        assert.equal(url.searchParams.get('origin'), '-19.9,-44.1');
        const destino = [posto.nomeMapa, posto.Endereço, posto.Cidade, posto.Estado, 'Brasil'].filter(Boolean).join(', ');
        assert.equal(url.searchParams.get('destination'), destino);
        assert.equal(new URL(criarLinkPosto(posto)).searchParams.get('query'), destino);
        assert.notEqual(url.searchParams.get('destination'), `${posto.lat},${posto.lon}`);
        assert.equal(url.searchParams.get('travelmode'), 'driving');
        assert.equal(url.searchParams.has('destination_place_id'), false);
    }
});

test('nome confirmado do Caxuxa I complementa o endereço rodoviário no mapa', () => {
    const url = new URL(criarLinkPosto(app.postos[0]));
    assert.equal(url.searchParams.get('query'), 'Posto Caxuxa Luz, BR-262, km 523, Luz, MG, Brasil');
    assert.equal(url.pathname, '/maps/search/');
});

test('identificador confirmado do Google Maps é passado nas duas ações', () => {
    const posto = { ...app.postos[0], placeId: 'id-ficticio-somente-teste' };
    assert.equal(new URL(criarLinkRota(posto)).searchParams.get('destination_place_id'), posto.placeId);
    assert.equal(new URL(criarLinkPosto(posto)).searchParams.get('query_place_id'), posto.placeId);
});

test('acentos e caracteres especiais não alteram os parâmetros da URL', () => {
    const posto = { Nome: 'Posto interno', nomeMapa: 'Posto São João & Filhos #1', Endereço: 'Rua A, 10', Cidade: 'Luz', Estado: 'MG' };
    const url = new URL(criarLinkRota(posto, { lat: NaN, lon: 0 }));
    assert.equal(url.searchParams.get('destination'), 'Posto São João & Filhos #1, Rua A, 10, Luz, MG, Brasil');
    assert.equal(url.searchParams.has('origin'), false);
    assert.equal(url.hash, '');
});

test('endereço completo funciona mesmo sem coordenadas e sem nome confirmado', () => {
    const posto = { Nome: 'Posto sem coordenadas', Endereço: 'Rua A, 10', Cidade: 'Luz', Estado: 'MG' };
    const url = new URL(criarLinkPosto(posto));
    assert.equal(url.searchParams.get('query'), 'Rua A, 10, Luz, MG, Brasil');
});

test('Padre Eustáquio usa o número 788 nas duas ações mesmo recebendo as coordenadas antigas', () => {
    const cadastrado = app.postos.find(p => p.Nome === 'POSTO 621 PADRE EUSTAQUIO');
    const destino = 'Posto Bretas Duarte, Rua Pará de Minas, 788, Belo Horizonte, MG, Brasil';
    for (const posto of [cadastrado, { ...cadastrado, lat: -19.915, lon: -43.985 }]) {
        assert.equal(new URL(criarLinkRota(posto)).searchParams.get('destination'), destino);
        assert.equal(new URL(criarLinkPosto(posto)).searchParams.get('query'), destino);
    }
    assert.equal(cadastrado.lat, -19.914019);
    assert.equal(cadastrado.lon, -43.9889773);
});

test('Cinquentenário usa o Posto Shell e o ponto confirmado no Google Maps', () => {
    const cadastrado = app.postos.find(p => p.Nome === 'POSTO 623 CINQUENTENARIO');
    const destino = 'Posto Shell, Rua Úrsula Paulino, 763, Belo Horizonte, MG, Brasil';
    assert.equal(new URL(criarLinkRota(cadastrado)).searchParams.get('destination'), destino);
    assert.equal(new URL(criarLinkPosto(cadastrado)).searchParams.get('query'), destino);
    assert.equal(cadastrado.lat, -19.9550962);
    assert.equal(cadastrado.lon, -43.9840226);
});

test('sem endereço completo, usa coordenadas válidas ou a identificação disponível', () => {
    const posto = { Nome: 'Posto sem endereço', lat: -20, lon: -44 };
    assert.equal(new URL(criarLinkRota(posto)).searchParams.get('destination'), '-20,-44');
    assert.equal(new URL(criarLinkPosto(posto)).searchParams.get('query'), '-20,-44');
    assert.equal(new URL(criarLinkPosto({ Nome: 'Posto teste', Cidade: 'Luz', Estado: 'MG' })).searchParams.get('query'), 'Posto teste, Luz, MG, Brasil');
});

function localizadorSimulado(responderRota) {
    const elementos = new Map(['inpOrigem', 'btnGPS', 'btnBuscarCidade', 'statusBusca', 'resultadosPostos']
        .map(id => [id, { value: 'Origem de teste', style: {}, setAttribute() {} }]));
    const contexto = vm.createContext({
        window: {}, URL, AbortController, setTimeout, clearTimeout,
        document: { getElementById: id => elementos.get(id) },
        fetch: async url => String(url).includes('nominatim')
            ? { ok: true, json: async () => [{ lat: '-19.9', lon: '-44', display_name: 'Origem de teste' }] }
            : responderRota(url)
    });
    for (const file of ['config.js', 'data/postos.js', 'utils/formatacao.js', 'domain/combustivel.js',
        'domain/distancia.js', 'services/mapas.js', 'ui/postos.js', 'controllers/localizador.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), contexto);
    }
    const app = contexto.window.RotaCombustivel;
    app.ui.veiculo = { lerParametros: () => ({ capacidade: 560, nivel: 1, consumo: 2, margem: 0.15, validos: true }) };
    return { app, elementos, contexto };
}

test('NoRoute não vira estimativa nem aviso verde, inclusive em resposta HTTP de erro', async () => {
    for (const ok of [true, false]) {
        const { app, elementos } = localizadorSimulado(async () => ({ ok, json: async () => ({ code: 'NoRoute' }) }));
        await app.controllers.localizador.buscarPostos();
        const html = elementos.get('resultadosPostos').innerHTML;
        assert.equal((html.match(/data-tipo-distancia="SEM_ROTA"/g) || []).length, 3);
        assert.doesNotMatch(html, /status-success|📏 estimativa|~[\d.]+ km|margem segura:|NaN/);
        app.controllers.localizador.atualizarResultados();
        assert.equal(elementos.get('resultadosPostos').innerHTML, html);
        assert.equal(elementos.get('btnBuscarCidade').disabled, false);
    }
});

test('falha de conexão preserva a estimativa de distância e as regras de autonomia', async () => {
    const { app, elementos } = localizadorSimulado(async () => { throw new Error('Sem conexão'); });
    await app.controllers.localizador.buscarPostos();
    const html = elementos.get('resultadosPostos').innerHTML;
    assert.equal((html.match(/data-tipo-distancia="ESTIMADA"/g) || []).length, 3);
    assert.match(html, /status-success/);
    assert.doesNotMatch(html, /data-tipo-distancia="SEM_ROTA"/);
});

test('postos com trajeto precedem os resultados sem rota', async () => {
    let chamadas = 0;
    const { app, elementos } = localizadorSimulado(async () => ({ ok: true, json: async () =>
        ++chamadas <= 8 ? { code: 'NoRoute' } : { code: 'Ok', routes: [{ distance: 50000, duration: 3600 }] }
    }));
    await app.controllers.localizador.buscarPostos();
    const html = elementos.get('resultadosPostos').innerHTML;
    assert.equal((html.match(/data-tipo-distancia="ROTA"/g) || []).length, 2);
    assert.equal((html.match(/data-tipo-distancia="SEM_ROTA"/g) || []).length, 1);
    assert.ok(html.indexOf('data-tipo-distancia="ROTA"') < html.indexOf('data-tipo-distancia="SEM_ROTA"'));
});

test('geocodificação rejeita valores ausentes, tipos indevidos e coordenadas fora dos limites', async () => {
    const { app, contexto } = localizadorSimulado();
    const invalidos = [null, '', ' ', false, true, [], {}, 'abc', 'Infinity', undefined];
    const respostas = [null, {}, ...invalidos.map(lat => ({ lat, lon: '-44' })),
        ...invalidos.map(lon => ({ lat: '-19.9', lon })),
        { lat: '91', lon: '0' }, { lat: '-91', lon: '0' }, { lat: '0', lon: '181' }, { lat: '0', lon: '-181' }];
    for (const resposta of respostas) {
        contexto.fetch = async () => ({ ok: true, json: async () => [resposta] });
        await assert.rejects(app.services.mapas.geocodificarOrigem('Teste'), /coordenadas inválidas/);
    }
    for (const resposta of [{ lat: '-19.9', lon: '-44' }, { lat: 0, lon: 0 }]) {
        contexto.fetch = async () => ({ ok: true, json: async () => [resposta] });
        const local = await app.services.mapas.geocodificarOrigem('Teste');
        assert.equal(local.coordenadas.lat, Number(resposta.lat));
        assert.equal(local.coordenadas.lon, Number(resposta.lon));
    }
});

test('origem inválida não consulta rotas e permite uma nova busca', async () => {
    const { app, contexto, elementos } = localizadorSimulado();
    let chamadas = 0;
    contexto.fetch = async () => { chamadas++; return { ok: true, json: async () => [{ lat: null, lon: '' }] }; };
    await app.controllers.localizador.buscarPostos();
    assert.equal(chamadas, 1);
    assert.match(elementos.get('statusBusca').textContent, /coordenadas inválidas/);
    assert.equal(elementos.get('btnGPS').disabled, false);
    assert.equal(elementos.get('btnBuscarCidade').disabled, false);
    assert.equal(elementos.get('resultadosPostos').style.display, 'none');
});

test('cadastro fora do intervalo brasileiro não participa das consultas de rota', async () => {
    let chamadas = 0;
    const { app, elementos } = localizadorSimulado(async () => {
        chamadas++;
        return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 1000, duration: 60 }] }) };
    });
    app.postos.splice(0, app.postos.length,
        { Nome: 'Posto válido', lat: -19.9, lon: -44 },
        { Nome: 'Posto fora do Brasil', lat: -19.9, lon: -29 },
        { Nome: 'Posto fora do globo', lat: 100, lon: -44 });
    await app.controllers.localizador.buscarPostos();
    assert.equal(chamadas, 1);
    assert.match(elementos.get('resultadosPostos').innerHTML, /Posto válido/);
    assert.doesNotMatch(elementos.get('resultadosPostos').innerHTML, /Posto fora/);
});

test('GPS inválido libera os botões sem consultar mapas', () => {
    const { app, contexto, elementos } = localizadorSimulado();
    contexto.navigator = { geolocation: { getCurrentPosition: sucesso => sucesso({ coords: { latitude: 91, longitude: -44 } }) } };
    contexto.fetch = () => { assert.fail('GPS inválido não deve consultar mapas'); };
    app.controllers.localizador.buscarGPS();
    assert.match(elementos.get('statusBusca').textContent, /GPS retornou coordenadas inválidas/);
    assert.equal(elementos.get('btnGPS').disabled, false);
    assert.equal(elementos.get('btnBuscarCidade').disabled, false);
});

test('serviço de rota rejeita coordenadas inválidas antes de acessar a rede', async () => {
    const { app, contexto } = localizadorSimulado();
    contexto.fetch = () => { assert.fail('Não deve consultar a rede'); };
    await assert.rejects(app.services.mapas.obterRotaOSRM({ lat: 91, lon: 0 }, app.postos[0]), /Coordenadas inválidas/);
    await assert.rejects(app.services.mapas.obterRotaOSRM({ lat: 0, lon: 0 }, { lat: null, lon: 0 }), /Coordenadas inválidas/);
});

test('busca não repete postos nem deixa duplicatas ocuparem os candidatos', async () => {
    let chamadas = 0;
    const { app, elementos } = localizadorSimulado(async () => {
        chamadas++;
        return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 1000, duration: 60 }] }) };
    });
    const posto = { Nome: 'POSTO 601 BARBACENA', Endereço: 'Rua Benjamin Constant, 200',
        Cidade: 'Barbacena', Estado: 'MG', lat: -21.2161322, lon: -43.7697524 };
    app.postos = [
        { ...posto, id: 1, lat: null },
        ...Array.from({ length: 12 }, (_, i) => ({ ...posto, id: i + 2 })),
        { ...posto, id: 20, Nome: ' posto 601  barbacena ' },
        { ...posto, id: 21, Endereço: 'Outra rua, 10' },
        { ...posto, id: 22, Nome: 'Posto Vizinho' }
    ];
    await app.controllers.localizador.buscarPostos();
    assert.equal(chamadas, 3);
    assert.equal((elementos.get('resultadosPostos').innerHTML.match(/<li class="posto-card /g) || []).length, 3);
    assert.match(elementos.get('resultadosPostos').innerHTML, /Posto Vizinho/);
    assert.equal(app.postos.length, 16, 'o cadastro original continua disponível para conferência');
});


test('rotas com muitas paradas preservam ordem, continuidade e limites do Maps', () => {
    const lojas = Array.from({ length: 11 }, (_, i) => ({ Nome: 'Loja ' + i, Endereço: 'Rua A, ' + i, Cidade: 'Luz', Estado: 'MG', lat: -20, lon: -44, placeId: 'teste-' + i }));
    const links = app.services.mapas.criarLinksRotaMulti({ lat: -19, lon: -43 }, lojas);
    assert.equal(links.length, 3);
    const destinos = [];
    links.forEach((link, i) => {
        const url = new URL(link.href);
        assert.ok(link.href.length <= 2048);
        const intermediarios = url.searchParams.get('waypoints')?.split('|') || [];
        assert.ok(intermediarios.length <= 3);
        destinos.push(...intermediarios, url.searchParams.get('destination'));
        assert.equal(url.searchParams.get('destination_place_id'), lojas[link.ultimaParada - 1].placeId);
        if (i) {
            const anterior = new URL(links[i - 1].href);
            assert.equal(url.searchParams.get('origin'), anterior.searchParams.get('destination'));
            assert.equal(url.searchParams.get('origin_place_id'), anterior.searchParams.get('destination_place_id'));
        } else assert.equal(url.searchParams.get('origin'), '-19,-43');
    });
    assert.deepEqual(destinos, lojas.map(l => new URL(criarLinkPosto(l)).searchParams.get('query')));
    const primeiro = new URL(links[0].href);
    assert.equal(primeiro.searchParams.get('waypoint_place_ids'), 'teste-0|teste-1|teste-2');
});

test('rota unitária omite paradas vazias e rejeita origem inválida ou lista vazia', () => {
    const { criarLinkRotaMulti, criarLinksRotaMulti } = app.services.mapas;
    assert.equal(new URL(criarLinkRotaMulti({ lat: -20, lon: -44 }, [app.postos[0]])).searchParams.has('waypoints'), false);
    for (const criar of [criarLinkRotaMulti, criarLinksRotaMulti]) {
        assert.throws(() => criar({ lat: null, lon: -44 }, [app.postos[0]]), /Origem inválida/);
        assert.throws(() => criar({ lat: -20, lon: -44 }, []), /destino/);
    }
});

test('endereços longos dividem os links antes do limite sem cortar endereços', () => {
    const loja = { Endereço: 'Rua ' + 'á'.repeat(100), Cidade: 'Luz', Estado: 'MG', lat: -20, lon: -44 };
    const links = app.services.mapas.criarLinksRotaMulti({ lat: -20, lon: -44 }, Array.from({ length: 5 }, () => ({ ...loja })));
    assert.ok(links[0].ultimaParada < 4, 'o tamanho do endereço deve reduzir o número de paradas por link');
    assert.equal(links.at(-1).ultimaParada, 5);
    assert.ok(links.every(l => l.href.length <= 2048));
    assert.throws(() => app.services.mapas.criarLinksRotaMulti({ lat: -20, lon: -44 }, [{ ...loja, Endereço: 'á'.repeat(1000) }]), /limite/);
});

test('links gerados de lojas recuperam cidade e UF; links específicos são preservados', () => {
    const loja = { Nome: 'LOJA 504 COLATINA', Endereço: 'BR-259, 175', Cidade: 'Colatina', Estado: 'ES',
        linkMaps: 'https://www.google.com/maps/search/?api=1&query=BR-259,+175,+,+ES,+Brasil' };
    const criar = app.services.mapas.criarLinkLoja;
    assert.equal(new URL(criar(loja)).searchParams.get('query'), 'BR-259, 175, Colatina, ES, Brasil');
    for (const linkMaps of ['https://maps.app.goo.gl/exemplo', 'https://www.google.com/maps/search/?api=1&query=-20,-44',
        'https://www.google.com/maps/search/?api=1&query=Posto&query_place_id=teste']) {
        assert.equal(criar({ ...loja, linkMaps }), new URL(linkMaps).href);
    }
    assert.equal(new URL(criar({ ...loja, linkMaps: 'javascript:alert(1)' })).protocol, 'https:');
});

test('texto substituto não é considerado endereço de uma loja', () => {
    assert.equal(app.services.mapas.enderecoCompleto({ Endereço: 'Endereço não informado', Cidade: 'Viana', Estado: 'ES' }), false);
    assert.equal(app.services.mapas.enderecoCompleto({ Endereço: ' ', Cidade: 'Viana', Estado: 'ES' }), false);
    assert.equal(app.services.mapas.enderecoCompleto(app.postos[0]), true);
});


test('mapa reenquadra um novo trajeto mesmo com origem e destino iguais', () => {
    let enquadramentos = 0;
    const elementos = new Map(['mapaPostos', 'mapaVazio', 'statusMapa'].map(id => [id, {}]));
    const bounds = { extend() {} };
    const grupo = () => ({ addTo() { return this; }, clearLayers() {}, eachLayer() {}, getBounds: () => bounds });
    const mapa = { on() {}, invalidateSize() {}, fitBounds() { enquadramentos++; },
        latLngToContainerPoint: () => ({ x: 100, distanceTo: () => 100 }), getSize: () => ({ x: 800 }) };
    const marker = () => ({ addTo() { return this; }, bindTooltip() { return this; }, bindPopup() {} });
    const L = { map: () => mapa, control: { zoom: () => ({ addTo() {} }) },
        tileLayer: () => ({ addTo() { return this; }, on() {} }), featureGroup: grupo, layerGroup: grupo,
        marker, divIcon: x => x, polyline: marker };
    const contexto = vm.createContext({ window: { L }, L,
        document: { getElementById: id => elementos.get(id), createElement: () => ({ style: {}, append() {} }) },
        ResizeObserver: class { observe() {} }, requestAnimationFrame() {}, cancelAnimationFrame() {} });
    for (const file of ['config.js', 'domain/distancia.js', 'ui/mapa.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), contexto);
    }
    const a = contexto.window.RotaCombustivel;
    a.services.mapas = { criarLinkPosto: () => 'https://www.google.com/maps/' };
    a.domain.combustivel = { analisarAutonomia: () => ({ classe: 'status-success' }) };
    const origem = { lat: -20, lon: -44 };
    const posto = { Nome: 'Teste', lat: -21, lon: -45, tipoDistancia: 'ESTIMADA' };
    a.ui.mapa.exibir([posto], origem, {});
    assert.equal(enquadramentos, 1);
    posto.tipoDistancia = 'ROTA';
    posto.geometria = { type: 'LineString', coordinates: [[-44, -20], [-46, -22], [-45, -21]] };
    a.ui.mapa.exibir([posto], origem, {});
    assert.equal(enquadramentos, 2, 'o desvio da rota deve caber no mapa');
    a.ui.mapa.exibir([posto], origem, {});
    assert.equal(enquadramentos, 2, 'alterar autonomia não deve reposicionar o mapa');
});
