(function (app) {
'use strict';

async function carregar() {
    if (window.location.protocol === 'file:') return [];
    const resposta = await fetch('/api/lojas', { cache: 'no-store' });
    if (!resposta.ok) throw new Error('Falha ao consultar as lojas.');
    const lojas = await resposta.json();
    if (!Array.isArray(lojas)) throw new Error('Cadastro de lojas inválido.');
    app.lojas = lojas;
    return lojas;
}

async function cadastrar(dados) {
    const resposta = await fetch('/api/lojas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.error || resultado.erros?.join(' ') || 'Não foi possível cadastrar a loja.');
    app.lojas = resultado.lojas;
    return resultado;
}

async function importarCSV(csv) {
    const resposta = await fetch('/api/lojas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        body: csv
    });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.error || 'Não foi possível importar as lojas.');
    app.lojas = resultado.lojas;
    return resultado;
}

app.services.lojas = { carregar, cadastrar, importarCSV };
})(window.RotaCombustivel);