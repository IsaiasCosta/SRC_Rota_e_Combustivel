const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');

const arquivoPadrao = path.resolve(__dirname, '../database/rota-combustivel.sqlite');

function lerCadastroInicial() {
    // Executa somente o cadastro versionado do projeto, nunca conteúdo recebido pela API.
    const contexto = { window: { RotaCombustivel: {} } };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/data/postos.js'), 'utf8'), contexto, { timeout: 1000 });
    return contexto.window.RotaCombustivel.postos;
}

function abrirBanco({ arquivo = arquivoPadrao, cadastroInicial = lerCadastroInicial } = {}) {
    if (arquivo !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(arquivo)), { recursive: true });
    const db = new DatabaseSync(arquivo);
    try {
        db.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
        const versao = db.prepare('PRAGMA user_version').get().user_version;
        if (versao > 1) throw new Error('Versão do banco mais recente que esta aplicação.');
        if (versao === 0) {
            db.exec(fs.readFileSync(path.resolve(__dirname, '../database/migrations/001-postos.sql'), 'utf8'));
            const inserir = db.prepare(`INSERT INTO postos
                (nome, nome_mapa, endereco, cidade, estado, latitude, longitude, cnpj)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const posto of cadastroInicial()) {
                inserir.run(posto.Nome, posto.nomeMapa ?? null, posto.Endereço, posto.Cidade,
                    posto.Estado, posto.lat, posto.lon, posto.cnpj ?? null);
            }
            db.exec('PRAGMA user_version = 1;');
        }
        db.exec('COMMIT;');
        return db;
    } catch (error) {
        try { db.exec('ROLLBACK;'); } catch { /* A transação pode não ter iniciado. */ }
        db.close();
        throw error;
    }
}

function listarPostos(db) {
    return db.prepare(`SELECT id, nome AS Nome, nome_mapa AS nomeMapa,
        endereco AS "Endereço", cidade AS Cidade, estado AS Estado,
        latitude AS lat, longitude AS lon, cnpj FROM postos ORDER BY id`).all();
}

function importarCSV(db, texto, previa = false) {
    const { analisarCSV } = require('./importacao-csv.cjs');
    return gravarPostos(db, existentes => analisarCSV(texto, existentes), previa);
}

function cadastrarPosto(db, dados) {
    const { validarPosto, identidade } = require('./validacao-postos.cjs');
    return gravarPostos(db, existentes => {
        const { posto, erros } = validarPosto(dados);
        const duplicado = !erros.length && existentes.some(p =>
            identidade(p) === identidade(posto) || Boolean(posto.cnpj && p.cnpj === posto.cnpj));
        return { erros, novos: erros.length || duplicado ? 0 : 1, duplicados: Number(duplicado), postos: [{ ...posto, duplicado }] };
    });
}

function gravarPostos(db, analisar, previa = false) {
    // Revalida duplicados dentro da transação, inclusive após outra importação.
    db.exec('BEGIN IMMEDIATE;');
    try {
        const resultado = analisar(listarPostos(db));
        if (previa || resultado.erros.length) {
            db.exec('ROLLBACK;');
            return resultado;
        }
        const inserir = db.prepare(`INSERT INTO postos
            (nome, nome_mapa, endereco, cidade, estado, latitude, longitude, cnpj)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const p of resultado.postos.filter(p => !p.duplicado)) {
            inserir.run(p.Nome, p.nomeMapa, p.Endereço, p.Cidade, p.Estado, p.lat, p.lon, p.cnpj);
        }
        const postos = listarPostos(db);
        db.exec('COMMIT;');
        return { importados: resultado.novos, duplicados: resultado.duplicados, erros: [], postos };
    } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
    }
}

module.exports = { abrirBanco, listarPostos, arquivoPadrao, lerCadastroInicial, importarCSV, cadastrarPosto };
