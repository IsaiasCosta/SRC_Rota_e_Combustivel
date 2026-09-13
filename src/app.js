(function (app) {
'use strict';

// Ponto de composição: inicializa a interface e conecta os eventos aos controladores.
document.addEventListener('DOMContentLoaded', async () => {
    const cadastro = app.controllers.cadastro.inicializar();
    const importacao = app.controllers.importacao.inicializar();
    const { calcular, alterarCarga } = app.controllers.painel;
    const { buscarPostos, buscarGPS, validarCadastroPostos } = app.controllers.localizador;
    app.controllers.painel.restaurarParametros();
    app.ui.medidor.criarMedidor();
    calcular();

    for (const id of app.config.parametros) {
        const campo = document.getElementById(id);
        const evento = campo.tagName === 'SELECT' ? 'change' : 'input';
        campo.addEventListener(evento, id === 'inpCarga' ? alterarCarga : calcular);
    }
    const botoesBusca = ['btnBuscarCidade', 'btnGPS'].map(id => document.getElementById(id));
    botoesBusca.forEach(botao => { botao.disabled = true; });
    document.getElementById('quantidadePostos').textContent = 'Carregando postos...';
    try {
        await app.services.postos.carregar();
        document.getElementById('quantidadePostos').textContent = app.postos.length + ' postos cadastrados';
        validarCadastroPostos();
        botoesBusca.forEach(botao => { botao.disabled = false; });
        cadastro.definirDisponibilidade(true);
        importacao.definirDisponibilidade(true);
    } catch {
        document.getElementById('quantidadePostos').textContent = '';
        document.getElementById('quantidadePostos').hidden = true;
        document.getElementById('statusBusca').textContent = 'Não foi possível carregar os postos. Verifique o servidor e recarregue a página.';
        cadastro.definirDisponibilidade(false);
        importacao.definirDisponibilidade(false);
        return;
    }
    document.getElementById('btnBuscarCidade').addEventListener('click', buscarPostos);
    document.getElementById('btnGPS').addEventListener('click', buscarGPS);
    document.getElementById('inpOrigem').addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            buscarPostos();
        }
    });
});
})(window.RotaCombustivel);
