(function (app) {
'use strict';

async function carregar() {
    // Abertura direta do HTML usa o cadastro de referência incluído na página.
    if (window.location.protocol === 'file:') return app.postos;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const resposta = await fetch('/api/postos', { signal: controller.signal, cache: 'no-store' });
        if (!resposta.ok) throw new Error('Falha ao consultar os postos.');
        const postos = await resposta.json();
        if (!Array.isArray(postos)) throw new Error('Cadastro de postos inválido.');
        app.postos = postos;
        return postos;
    } finally {
        clearTimeout(timeout);
    }
}

async function importarCSV(csv, previa) {
    const resposta = await fetch('/api/postos/importar' + (previa ? '?previa=1' : ''), {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'X-Rota-Importacao': 'csv' },
        body: csv
    });
    const resultado = await resposta.json();
    if (!resposta.ok && resposta.status !== 422) throw new Error(resultado.error || 'Falha ao importar o arquivo.');
    return resultado;
}

async function cadastrar(dados) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let resposta, resultado;
    try {
        resposta = await fetch('/api/postos', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'X-Rota-Cadastro': 'formulario' },
            body: JSON.stringify(dados)
        });
        resultado = await resposta.json();
    } catch (error) {
        throw new Error((error.name === 'AbortError' ? 'O servidor demorou demais para responder.' : 'Falha de conexão ou resposta inválida.') +
            ' Recarregue o painel para conferir o cadastro antes de tentar novamente.');
    } finally { clearTimeout(timeout); }
    if (!resposta.ok && resposta.status !== 422) throw new Error(resultado.error || 'Não foi possível salvar o posto.');
    return resultado;
}

app.services.postos = { carregar, importarCSV, cadastrar };
})(window.IvecoTector);
