/* src/services/mapas.js */
(function (app) {
'use strict';


async function geocodificarOrigem(texto) {
    /*
     * Nominatim é usado aqui apenas para transformar endereço/cidade em coordenadas.
     * Para uso corporativo de alto volume, troque por um serviço de geocodificação
     * próprio/profissional.
     */
    const url =
        "https://nominatim.openstreetmap.org/search" +
        `?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(texto)}`;

    const dados = await consultarJSON(url);

    if (!Array.isArray(dados) || !dados.length) {
        throw new Error("Endereço/cidade não encontrado. Tente informar também MG ou ES.");
    }

    const lat = Number(dados[0].lat);
    const lon = Number(dados[0].lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error("O mapa retornou coordenadas inválidas.");
    }

    return {
        coordenadas: { lat, lon },
        nome: dados[0].display_name || texto
    };
}

async function consultarJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        const resposta = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!resposta.ok) throw new Error('Não foi possível consultar o serviço de mapas. Tente novamente.');
        return await resposta.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function obterRotaOSRM(local, posto) {
    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${local.lon},${local.lat};${posto.lon},${posto.lat}` +
        `?overview=false&steps=false`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const resposta = await fetch(url, { signal: controller.signal });

        if (!resposta.ok) throw new Error("Falha no roteador.");

        const dados = await resposta.json();

        if (dados.code !== "Ok" || !dados.routes?.length) {
            throw new Error("Rota não encontrada.");
        }

        const { distance, duration } = dados.routes[0];
        if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(duration) || duration < 0) throw new Error('Rota inválida.');
        return { distanciaKm: distance / 1000, tempoMin: duration / 60 };
    } finally {
        clearTimeout(timeout);
    }
}

app.services.mapas = { geocodificarOrigem, obterRotaOSRM };
})(window.IvecoTector);
