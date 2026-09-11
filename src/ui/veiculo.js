/* src/ui/veiculo.js */
(function (app) {
'use strict';
const PARAMETROS = app.config.parametros;

function obterNumero(id) {
    const valor = Number.parseFloat(document.getElementById(id)?.value);
    return Number.isFinite(valor) && valor >= 0 ? valor : 0;
}

function parametrosValidos() {
    return ['inpCapacidade', 'inpConsumo'].every(id => {
        const campo = document.getElementById(id);
        return campo.value !== '' && campo.checkValidity();
    }) && obterNumero('inpConsumo') > 0 && obterNumero('inpCapacidade') > 0;
}

function lerParametros() {
    return {
        capacidade: obterNumero('inpCapacidade'),
        nivel: Number(document.getElementById('inpNivel').value),
        consumo: obterNumero('inpConsumo'), margem: Number(document.getElementById('inpMargem').value),
        validos: parametrosValidos()
    };
}

function aplicarParametros(salvos) {
        for (const id of PARAMETROS) {
            const campo = document.getElementById(id);
            const valor = salvos?.[id];
            if (typeof valor !== 'string') continue;
            if (campo.tagName === 'SELECT') {
                if ([...campo.options].some(opcao => opcao.value === valor)) campo.value = valor;
            } else if (valor.trim() && Number.isFinite(Number(valor)) && Number(valor) >= Number(campo.min) && (!campo.max || Number(valor) <= Number(campo.max))) {
                campo.value = valor;
            }
        }
}

function obterValoresCampos() {
    return Object.fromEntries(PARAMETROS.map(id => [id, document.getElementById(id).value]));
}

app.ui.veiculo = { lerParametros, aplicarParametros, obterValoresCampos };
})(window.IvecoTector);
