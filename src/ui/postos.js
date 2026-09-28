/* Cartões de postos: os estados vêm da análise de autonomia existente. */
(function (app) {
'use strict';
const { escaparHTML, formatarTempo } = app.utils;
const { criarLinkRota, criarLinkPosto } = app.services.mapas;
const numero = valor => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
function exibirResultadosPostos(listaPostos, local, parametros) {
    const container = document.getElementById('resultadosPostos');
    if (!container) return;
    container.style.display = 'block';
    const vazio = document.getElementById('postosVazios');
    if (vazio) vazio.hidden = true;
    if (!listaPostos.length) {
        container.innerHTML = '<p class="helper">Nenhum posto com coordenadas válidas. Confira o cadastro de postos.</p>';
        app.ui.mapa?.exibir([], local, parametros);
        return;
    }
    let html = '<ul class="postos-lista">';
    listaPostos.forEach((p, indice) => {
        const semRota = p.tipoDistancia === 'SEM_ROTA';
        const analise = semRota
            ? { classe: 'status-danger', texto: 'Rota não encontrada — autonomia não avaliada.', margemKm: null }
            : app.domain.combustivel.analisarAutonomia(p.distancia, parametros);
        const titulo = semRota ? 'Rota não encontrada' : !parametros.validos ? 'Confira os parâmetros' :
            analise.classe === 'status-success' ? 'Você consegue chegar' :
            analise.classe === 'status-warning' ? 'Recomendamos abastecer' : 'Combustível insuficiente';
        const simbolo = analise.classe === 'status-success' ? '✓' : analise.classe === 'status-warning' ? '!' : '×';
        const necessario = !semRota && parametros.validos ? 'Necessário: ' + numero(p.distancia / parametros.consumo) + ' litros' : 'Autonomia não avaliada';
        const distancia = semRota ? 'Trajeto indisponível' : numero(p.distancia) + ' km ' + (p.tipoDistancia === 'ROTA' ? 'por rota' : '(estimativa)');
        html += `<li class="posto-card ${analise.classe}" data-tipo-distancia="${semRota ? 'SEM_ROTA' : p.tipoDistancia === 'ROTA' ? 'ROTA' : 'ESTIMADA'}">
            <span class="posto-numero" aria-label="Posto ${indice + 1}">${indice + 1}</span>
            <div class="posto-identidade">
                <strong>${escaparHTML(p.Nome)}</strong>
                <a href="${escaparHTML(criarLinkPosto(p))}" target="_blank" rel="noopener noreferrer" aria-label="Ver ${escaparHTML(p.Nome)} no mapa">${escaparHTML(p.Endereço)} — ${escaparHTML(p.Cidade)}/${escaparHTML(p.Estado)}</a>
                <span class="posto-distancia">${distancia}${p.tempoMin ? ' · ' + formatarTempo(p.tempoMin) : ''}</span>
            </div>
            <div class="posto-avaliacao">
                <strong title="${escaparHTML(analise.texto)}">${simbolo} &nbsp;${titulo}</strong>
                <small>${necessario}</small>
                <a class="posto-rota" href="${escaparHTML(criarLinkRota(p, local))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir rota para ${escaparHTML(p.Nome)}"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#send"></use></svg>Abrir rota</a>
            </div>
        </li>`;
    });
    html += `</ul><details class="postos-observacoes"><summary>Sobre as distâncias e a autonomia</summary>
        <p>Distâncias por rota quando o roteador está disponível; em caso de falha, são estimativas. Sem trajeto encontrado, a autonomia não é avaliada. O verde indica alcance dentro da margem selecionada; amarelo, fora da margem; vermelho, autonomia insuficiente.</p>
        <p>Os links priorizam o endereço completo. As coordenadas cadastradas podem diferir do Google Maps. Rotas comuns não consideram as restrições do bitruck; confira o trajeto e o posto antes de seguir.</p></details>`;
    container.innerHTML = html;
    app.ui.mapa?.exibir(listaPostos, local, parametros);
}
app.ui.postos = { exibirResultadosPostos };
})(window.RotaCombustivel);
