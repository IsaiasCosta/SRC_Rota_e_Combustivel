const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function ambienteAuth(resposta = {}) {
    const chamadas = [];
    const armazenamento = new Map();
    const app = { config: { supabaseUrl: 'https://auth.example.test', supabaseAnonKey: 'chave-teste' }, services: {} };
    const contexto = {
        window: { RotaCombustivel: app,
            location: { hash: '#type=recovery&access_token=token-teste&refresh_token=refresh-teste', pathname: '/', search: '' },
            history: { replaceState() {} } },
        URL, URLSearchParams,
        sessionStorage: {
            setItem: (chave, valor) => armazenamento.set(chave, valor),
            getItem: chave => armazenamento.get(chave),
            removeItem: chave => armazenamento.delete(chave)
        },
        fetch: async (url, opcoes) => {
            chamadas.push({ url, ...opcoes, dados: JSON.parse(opcoes.body) });
            return { ok: true, json: async () => ({ access_token: 'login-teste' }), ...resposta };
        }
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/auth.js'), 'utf8'), contexto);
    return { auth: app.services.auth, chamadas, armazenamento };
}

test('cadastro exige exatamente oito caracteres antes de consultar o Supabase', async () => {
    const { auth, chamadas } = ambienteAuth();
    for (const senha of ['', '1234567', '123456789', '123456789012', null, undefined]) {
        await assert.rejects(auth.cadastrar('Usuario', 'usuario@example.test', senha), /exatamente 8 caracteres/);
    }
    assert.equal(chamadas.length, 0);
    await auth.cadastrar('Usuario', 'usuario@example.test', 'Abcd123!');
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].dados.password, 'Abcd123!');
    assert.equal(chamadas[0].url.pathname, '/auth/v1/signup');
});

test('redefinir exige oito caracteres, preserva a senha e limpa a sessao ao salvar', async () => {
    const { auth, chamadas } = ambienteAuth();
    await auth.processarRecuperacao();
    for (const senha of ['', '1234567', '123456789', '123456789012']) {
        await assert.rejects(auth.definirNovaSenha(senha), /exatamente 8 caracteres/);
    }
    assert.equal(chamadas.length, 0);
    assert.equal(auth.obterToken(), 'token-teste');
    await auth.definirNovaSenha(' Abcd12 ');
    assert.equal(chamadas[0].method, 'PUT');
    assert.equal(chamadas[0].dados.password, ' Abcd12 ');
    assert.equal(auth.obterToken(), null);
});

test('login aceita senha de oito caracteres e preserva o acesso com senhas antigas', async () => {
    const { auth, chamadas } = ambienteAuth();
    for (const senha of ['Abcd123!', 'SenhaAntiga123!']) {
        await auth.entrar('usuario@example.test', senha);
        assert.equal(chamadas.at(-1).dados.password, senha);
        assert.equal(auth.obterToken(), 'login-teste');
    }
});

test('rejeicao do provedor e propagada sem informar que a senha foi salva', async () => {
    const { auth } = ambienteAuth({ ok: false, json: async () => ({ message: 'Politica do provedor rejeitou a senha.' }) });
    await assert.rejects(auth.cadastrar('Usuario', 'usuario@example.test', 'Abcd123!'), /Politica do provedor/);
    await auth.processarRecuperacao();
    await assert.rejects(auth.definirNovaSenha('Abcd123!'), /Politica do provedor/);
    assert.equal(auth.obterToken(), 'token-teste');
});
