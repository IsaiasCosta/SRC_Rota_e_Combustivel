(function (app) {
'use strict';

// Ponto de composição: inicializa a interface e conecta os eventos aos controladores.
document.addEventListener('DOMContentLoaded', () => {
    const { calcular, alterarCarga } = app.controllers.painel;
    const { buscarPostos, buscarGPS, validarCadastroPostos } = app.controllers.localizador;
    app.controllers.painel.restaurarParametros();
    document.getElementById('quantidadePostos').textContent = app.postos.length + ' postos cadastrados';
    app.ui.medidor.criarMedidor();
    calcular();
    validarCadastroPostos();

    for (const id of app.config.parametros) {
        const campo = document.getElementById(id);
        const evento = campo.tagName === 'SELECT' ? 'change' : 'input';
        campo.addEventListener(evento, id === 'inpCarga' ? alterarCarga : calcular);
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
})(window.IvecoTector);
