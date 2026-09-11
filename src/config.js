// Configurações compartilhadas; os valores de consumo são estimativas iniciais.
window.IvecoTector = {
    config: Object.freeze({
        consumos: Object.freeze({ VAZIO: 3.0, PARCIAL: 2.5, CARREGADO: 2.0 }),
        parametros: Object.freeze(['inpCapacidade', 'inpNivel', 'inpCarga', 'inpConsumo', 'inpMargem']),
        storageKey: 'iveco-tector.parametros.v1'
    }),
    domain: {}, services: {}, ui: {}, controllers: {}
};
