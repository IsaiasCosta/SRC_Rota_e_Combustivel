/* Medidor semicircular: apresentação dos valores calculados pelo domínio. */
(function (app) {
'use strict';
function criarMedidor() {
    const container = document.getElementById('gaugeContainer');
    if (!container) return;
    container.innerHTML = `<svg id="gaugeSvg" viewBox="0 0 280 160" role="img" aria-label="Nível de combustível">
        <path d="M 22 140 A 118 118 0 0 1 258 140" fill="none" stroke="#edf0f4" stroke-width="26" stroke-linecap="round"/>
        <path id="gaugeArc" d="M 22 140 A 118 118 0 0 1 258 140" fill="none" stroke="#109447" stroke-width="26" stroke-linecap="round" pathLength="100" stroke-dasharray="100 100"/>
        <text id="gaugePercent" x="140" y="130" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" fill="#101827">—</text>
    </svg>`;
}
function atualizarMedidor(percentual, combustivelAtual, capacidadeTotal) {
    percentual = Math.max(0, Math.min(1, percentual));
    const validos = app.ui.veiculo.lerParametros().validos;
    const arc = document.getElementById('gaugeArc');
    if (arc) {
        arc.style.strokeDashoffset = 100 * (1 - percentual);
        arc.style.visibility = validos && percentual > 0 ? 'visible' : 'hidden';
        arc.setAttribute('stroke', percentual <= .15 ? '#db242d' : percentual <= .30 ? '#dda000' : '#109447');
    }
    const text = document.getElementById('gaugePercent');
    if (text) text.textContent = validos ? `${Math.round(percentual * 100)}%` : '—';
    document.getElementById('gaugeSvg')?.setAttribute('aria-label', validos ? `Nível de combustível: ${Math.round(percentual * 100)}%` : 'Parâmetros de combustível inválidos');
    const readout = document.getElementById('gaugeReadout');
    if (readout) readout.textContent = validos ? `Nível: ${combustivelAtual.toFixed(1)} L / ${capacidadeTotal.toFixed(0)} L` : 'Confira os parâmetros do veículo.';
}
app.ui.medidor = { criarMedidor, atualizarMedidor };
})(window.RotaCombustivel);
