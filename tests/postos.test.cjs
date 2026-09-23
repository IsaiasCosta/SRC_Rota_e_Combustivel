const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function ambiente(protocol, fetch, temporizadores = {}) {
    const app = { postos: [{ Nome: 'Referência' }], services: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/postos.js'), 'utf8'), {
        window: { RotaCombustivel: app, location: { protocol } }, fetch, AbortController, setTimeout, clearTimeout, ...temporizadores
    });
    return app;
}

test('HTTP usa os postos da API, inclusive quando o banco está vazio', async () => {
    const dados = [{ id: 1, Nome: 'Banco' }];
    const app = ambiente('http:', async url => {
        assert.equal(url, '/api/postos');
        return { ok: true, json: async () => dados };
    });
    await app.services.postos.carregar();
    assert.equal(app.postos, dados);
    dados.length = 0;
    await app.services.postos.carregar();
    assert.equal(app.postos.length, 0);
});

test('abertura por arquivo mantém a referência sem consultar o servidor', async () => {
    const app = ambiente('file:', () => { throw new Error('Não deve consultar rede'); });
    assert.equal((await app.services.postos.carregar())[0].Nome, 'Referência');
});

test('erros da API são propagados para bloquear buscas com cadastro desatualizado', async () => {
    for (const fetch of [
        async () => ({ ok: false }),
        async () => ({ ok: true, json: async () => ({ error: 'inválido' }) }),
        async () => { throw new Error('Sem rede'); }
    ]) {
        await assert.rejects(ambiente('http:', fetch).services.postos.carregar());
    }
});

test('cadastro interrompe espera sem resposta ou corpo incompleto e libera o temporizador', async () => {
    for (const etapa of ['conexao', 'corpo']) {
        let expirar, recebeuSinal, liberado = false;
        const fetch = async (_url, { signal }) => {
            recebeuSinal = signal;
            const esperar = () => new Promise((resolve, reject) => {
                if (signal.aborted) reject(signal.reason);
                else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
            return etapa === 'conexao' ? esperar() : { ok: true, json: esperar };
        };
        const app = ambiente('http:', fetch, {
            setTimeout(callback, ms) { assert.equal(ms, 12000); expirar = callback; return 123; },
            clearTimeout(id) { assert.equal(id, 123); liberado = true; }
        });
        const cadastro = app.services.postos.cadastrar({ Nome: 'Posto teste' });
        await Promise.resolve();
        expirar();
        await assert.rejects(cadastro, /servidor demorou demais/);
        assert.equal(recebeuSinal.aborted, true);
        assert.equal(liberado, true);
    }
});

function avisosCadastro(postos) {
    const avisos = [];
    const contexto = vm.createContext({
        window: {},
        console: { warn(_mensagem, problemas) { avisos.push(...problemas); } }
    });
    for (const arquivo of ['config.js', 'utils/formatacao.js', 'domain/distancia.js', 'controllers/localizador.js']) {
        if (arquivo === 'controllers/localizador.js') contexto.window.RotaCombustivel.services.mapas = {};
        vm.runInContext(fs.readFileSync(require.resolve(`../src/${arquivo}`), 'utf8'), contexto);
    }
    const app = contexto.window.RotaCombustivel;
    app.postos = postos;
    app.controllers.localizador.validarCadastroPostos();
    assert.equal(app.postos, postos, 'a validação não substitui os registros');
    return avisos;
}

const postoValidacao = Object.freeze({
    Nome: 'Caxuxa Juá', Endereço: 'BR-354, km 471', Cidade: 'Arcos', Estado: 'MG',
    lat: -20.2723772, lon: -45.57558267
});

test('validação permite nomes iguais em endereços, cidades ou UFs diferentes', () => {
    const postos = [postoValidacao,
        { ...postoValidacao, Endereço: 'BR-354, km 472' },
        { ...postoValidacao, Cidade: 'Outra cidade' },
        { ...postoValidacao, Estado: 'SP' }];
    assert.deepEqual(avisosCadastro(postos), []);
});

test('validação identifica o cadastro repetido e informa os registros e o endereço', () => {
    const avisos = avisosCadastro([postoValidacao, { ...postoValidacao,
        Nome: '  CAXUXA   JUA ', Endereço: ' br-354,  km 471 ', Cidade: ' ARCOS ', Estado: 'mg',
        lat: -20.27 }]);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /cadastro duplicado/);
    assert.match(avisos[0], /registros 1 e 2/);
    assert.match(avisos[0], /br-354,  km 471/);
});

test('validação continua alertando sobre coordenadas inválidas ou fora do Brasil', () => {
    const avisos = avisosCadastro([
        { ...postoValidacao, lat: null },
        { ...postoValidacao, Nome: 'Outro posto', lat: 0, lon: 0 }
    ]);
    assert.equal(avisos.length, 2);
    assert.match(avisos[0], /coordenada inválida/);
    assert.match(avisos[1], /fora do intervalo esperado para Brasil/);
});

function ambienteSupabase(registros = []) {
    const chamadas = [];
    const contexto = vm.createContext({ window: {} });
    for (const arquivo of ['config.js', 'utils/formatacao.js', 'services/supabase.js']) {
        vm.runInContext(fs.readFileSync(require.resolve(`../src/${arquivo}`), 'utf8'), contexto);
    }
    const app = contexto.window.RotaCombustivel;
    app.postos = [];
    app.services.supabase.requisicao = async (_tabela, opcoes = {}) => {
        chamadas.push(opcoes.method || 'GET');
        if (opcoes.method === 'POST') registros.push(...JSON.parse(opcoes.body));
        return registros;
    };
    vm.runInContext(fs.readFileSync(require.resolve('../src/services/postos.js'), 'utf8'), contexto);
    return { app, chamadas };
}

const registroBarbacena = Object.freeze({ id: 41, nome: 'POSTO 601 BARBACENA',
    endereco: 'Rua Benjamin Constant, 200', cidade: 'Barbacena', estado: 'MG',
    latitude: -21.2161322, longitude: -43.7697524 });

test('Supabase consulta o banco e bloqueia novo cadastro igual sem enviar POST', async () => {
    const { app, chamadas } = ambienteSupabase([registroBarbacena]);
    const resultado = await app.services.postos.cadastrar({ Nome: ' posto  601 barbacena ',
        Endereço: ' rua benjamin constant, 200 ', Cidade: 'BARBACENA', Estado: 'mg',
        lat: -21.2, lon: -43.7 });
    assert.equal(resultado.duplicados, 1);
    assert.match(resultado.erros[0].mensagem, /já está cadastrado/);
    assert.deepEqual(chamadas, ['GET']);
});

test('Supabase permite o mesmo nome em outro endereço', async () => {
    const { app, chamadas } = ambienteSupabase([registroBarbacena]);
    const resultado = await app.services.postos.cadastrar({ Nome: registroBarbacena.nome,
        Endereço: 'Rua Outra, 10', Cidade: 'Barbacena', Estado: 'MG', lat: -21.2, lon: -43.7 });
    assert.equal(resultado.erros.length, 0);
    assert.equal(resultado.postos.length, 2);
    assert.deepEqual(chamadas, ['GET', 'POST', 'GET']);
});

test('CSV no Supabase normaliza acentos e espaços e consulta repetições antes de gravar', async () => {
    const { app, chamadas } = ambienteSupabase([registroBarbacena]);
    const csv = 'nome;endereco;cidade;estado;latitude;longitude\n' +
        'POSTO  601 BARBACENA;Rua Benjamin Constant, 200;Barbacena;MG;-21.2;-43.7\n' +
        'Posto São João;Rua Nova, 10;Barbacena;MG;-21.2;-43.7\n' +
        'POSTO SAO   JOAO;RUA NOVA, 10;BARBACENA;mg;-21.2;-43.7';
    const previa = await app.services.postos.importarCSV(csv, true);
    assert.equal(previa.novos, 2);
    assert.deepEqual(chamadas, []);
    const resultado = await app.services.postos.importarCSV(csv, false);
    assert.equal(resultado.novos, 1);
    assert.equal(resultado.importados, 1);
    assert.equal(resultado.duplicados, 2);
    assert.equal(resultado.postos.length, 2);
    assert.deepEqual(chamadas, ['GET', 'POST', 'GET']);
});

test('aviso distingue posições da lista de IDs e mostra coordenadas para conferência', () => {
    const avisos = avisosCadastro([{ ...postoValidacao, id: 41 },
        { ...postoValidacao, id: 900, lat: -20.27 }]);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /registros 1 e 2/);
    assert.match(avisos[0], /IDs no banco: 41 e 900/);
    assert.match(avisos[0], /Coordenadas: \(-20.2723772, -45.57558267\) e \(-20.27, -45.57558267\)/);
});

test('CSV que se tornou repetido após a prévia preserva toda a lista de postos', async () => {
    const { app, chamadas } = ambienteSupabase([registroBarbacena,
        { ...registroBarbacena, id: 42, nome: 'Outro posto' }]);
    const csv = 'nome;endereco;cidade;estado;latitude;longitude\n' +
        'POSTO 601 BARBACENA;Rua Benjamin Constant, 200;Barbacena;MG;-21.2;-43.7';
    const previa = await app.services.postos.importarCSV(csv, true);
    assert.equal(previa.novos, 1);
    const resultado = await app.services.postos.importarCSV(csv, false);
    assert.equal(resultado.importados, 0);
    assert.equal(resultado.duplicados, 1);
    assert.equal(resultado.postos.length, 2);
    assert.equal(resultado.postos[0].id, 41);
    assert.deepEqual(chamadas, ['GET']);
});
