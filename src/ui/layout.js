(function (app) {
'use strict';
function atualizarResumo(parametros) {
    const consumo = document.getElementById('outConsumo');
    if (consumo) consumo.textContent = parametros.validos ? parametros.consumo.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km/L' : '—';
    const status = document.getElementById('outStatusPosto');
    const nivel = parametros.nivel;
    const titulo = !parametros.validos ? 'Confira os dados' : nivel <= .15 ? 'Reserva crítica' : nivel <= .30 ? 'Recomendamos abastecer' : 'Nível adequado';
    const descricao = !parametros.validos ? status.textContent : nivel <= .15 ? 'Abasteça imediatamente. O tanque está na reserva crítica.' : nivel <= .30 ? 'O nível está baixo. Procure um posto dentro da autonomia.' : 'Combustível em nível normal. Confira abaixo a autonomia até cada posto.';
    status.replaceChildren();
    const texto = document.createElement('div');
    const strong = document.createElement('strong');
    const small = document.createElement('small');
    strong.textContent = titulo;
    small.textContent = descricao;
    texto.append(strong, small);
    status.append(texto);
    document.getElementById('outAutonomiaSegura').style.color = !parametros.validos ? 'var(--muted)' : nivel <= .15 ? 'var(--red)' : nivel <= .30 ? 'var(--amber)' : 'var(--green)';
    const atualizado = document.getElementById('atualizacaoCombustivel');
    if (atualizado) atualizado.textContent = 'Atualizado agora';
}
document.addEventListener('DOMContentLoaded', () => {
    const configuracoes = document.getElementById('configuracoes');
    function abrirConfiguracoes() {
        configuracoes.open = true;
        configuracoes.scrollIntoView({ block: 'start' });
        document.getElementById('inpCapacidade').focus({ preventScroll: true });
    }
    document.getElementById('btnAtualizarDados')?.addEventListener('click', abrirConfiguracoes);
    const links = [...document.querySelectorAll('.navigation a')];
    function marcarLink(hash) {
        for (const link of links) {
            if (link.hash === hash) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        }
    }
    for (const link of links) link.addEventListener('click', () => {
        if (link.hash === '#configuracoes') abrirConfiguracoes();
        marcarLink(link.hash);
    });
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#configuracoes') configuracoes.open = true;
        marcarLink(window.location.hash || '#inicio');
    });
    const cadastro = document.getElementById('importacaoPostos');
    const sincronizarMenu = () => {
        const link = document.querySelector('.navigation a[href="#importacaoPostos"]');
        if (link) link.hidden = cadastro.hidden;
    };
    new MutationObserver(sincronizarMenu).observe(cadastro, { attributes: true, attributeFilter: ['hidden'] });
    sincronizarMenu();
    const botaoMapa = document.getElementById('btnExpandirMapa');
    function expandir(valor) {
        document.getElementById('mapaRota').classList.toggle('ampliado', valor);
        botaoMapa.setAttribute('aria-pressed', String(valor));
        botaoMapa.setAttribute('aria-label', valor ? 'Reduzir mapa' : 'Ampliar mapa');
        app.ui.mapa?.redimensionar();
    }
    botaoMapa?.addEventListener('click', () => expandir(botaoMapa.getAttribute('aria-pressed') !== 'true'));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') expandir(false); });
});
app.ui.layout = { atualizarResumo };
})(window.RotaCombustivel);
