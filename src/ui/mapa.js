/* Mapa de consulta. NÃ£o altera a seleÃ§Ã£o de postos ou o cÃ¡lculo de autonomia. */
(function (app) {
    'use strict';
    let mapa, camadas, marcadores, ultimoEnquadramento = '';
    let postosNoMapa = [], mensagemRotas = '', atualizacaoMarcadores;
    const status = texto => { const el = document.getElementById('statusMapa'); if (el) el.textContent = texto; };
    function iniciar() {
        if (mapa) return true;
        if (!window.L || !document.getElementById('mapaPostos')) {
            status('Mapa indisponÃ­vel. VocÃª pode abrir os trajetos pelos cartÃµes dos postos.');
            return false;
        }
        mapa = L.map('mapaPostos', { zoomControl: false, scrollWheelZoom: true });
        L.control.zoom({ position: 'topright' }).addTo(mapa);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(mapa);
        tiles.on('tileerror', () => status('NÃ£o foi possÃ­vel carregar parte do mapa. Abra a rota pelo cartÃ£o do posto.'));
        camadas = L.featureGroup().addTo(mapa);
        marcadores = L.layerGroup().addTo(mapa);
        mapa.on('zoomend resize', () => {
            cancelAnimationFrame(atualizacaoMarcadores);
            atualizacaoMarcadores = requestAnimationFrame(atualizarMarcadores);
        });
        new ResizeObserver(() => mapa.invalidateSize()).observe(document.getElementById('mapaPostos'));
        return true;
    }
    // Agrupa por distÃ¢ncia na tela, sem deslocar as coordenadas dos postos ou das rotas.
    function atualizarMarcadores() {
        if (!mapa || !marcadores || !postosNoMapa.length) return;
        marcadores.eachLayer(marker => marker.unbindTooltip());
        marcadores.clearLayers();
        const grupos = [];
        for (const posto of postosNoMapa) {
            const ponto = mapa.latLngToContainerPoint([posto.lat, posto.lon]);
            const proximos = grupos.filter(grupo => grupo.some(item => ponto.distanceTo(item.ponto) < 52));
            const grupo = [{ ...posto, ponto }, ...proximos.flat()];
            for (const proximo of proximos) grupos.splice(grupos.indexOf(proximo), 1);
            grupos.push(grupo.sort((a, b) => a.indice - b.indice));
        }
        for (const grupo of grupos) {
            const primeiro = grupo[0];
            const agrupado = grupo.length > 1;
            const mesmaCoordenada = grupo.every(p => Number(p.lat) === Number(primeiro.lat) && Number(p.lon) === Number(primeiro.lon));
            const nomes = grupo.map(p => (p.indice + 1) + '. ' + p.Nome).join('; ');
            const html = agrupado
                ? '<div class="map-marker-numeros">' + grupo.map(p => '<span class="' + p.classe + '">' + (p.indice + 1) + '</span>').join('<span class="map-marker-separador">Â·</span>') + '</div>'
                : '<span><b>' + (primeiro.indice + 1) + '</b></span>';
            const largura = agrupado ? grupo.length * 34 + (grupo.length - 1) * 8 + 12 : 34;
            const marker = L.marker([primeiro.lat, primeiro.lon], {
                icon: L.divIcon({
                    className: agrupado ? 'map-marker map-marker-grupo' : 'map-marker ' + primeiro.classe,
                    html, iconSize: [largura, 34], iconAnchor: [largura / 2, 34]
                }),
                title: nomes, alt: nomes
            }).addTo(marcadores);
            const popup = document.createElement('div');
            if (agrupado) {
                const aviso = document.createElement('p');
                aviso.textContent = mesmaCoordenada
                    ? 'Estes postos tÃªm a mesma coordenada cadastrada. Confira os endereÃ§os antes de seguir.'
                    : 'Postos prÃ³ximos neste nÃ­vel de zoom. Amplie o mapa para distinguir as posiÃ§Ãµes.';
                popup.append(aviso);
            }
            for (const posto of grupo) {
                const nome = document.createElement('p');

                const linkPosto = document.createElement('a');
                linkPosto.href = app.services.mapas.criarLinkPosto(posto);
                linkPosto.target = '_blank';
                linkPosto.rel = 'noopener noreferrer';
                linkPosto.textContent = (posto.indice + 1) + '. ' + posto.Nome;
                linkPosto.title = 'Abrir localizaÃ§Ã£o do posto no Google Maps';

                nome.append(linkPosto);
                popup.append(nome);
            }
            marker.bindPopup(popup);
            const rotulo = document.createElement('div');
            rotulo.className = 'mapa-postos-rotulo';
            for (const posto of grupo) {
                const linha = document.createElement('div');
                linha.className = 'mapa-posto-rotulo';
                const numero = document.createElement('strong');
                numero.className = 'mapa-posto-numero ' + posto.classe;
                numero.textContent = String(posto.indice + 1);
                const nome = document.createElement('span');
                nome.textContent = posto.Nome;
                linha.append(numero, nome);
                rotulo.append(linha);
            }
            // Abre o nome para o lado com mais espaÃ§o, inclusive no mapa do celular.
            const ponto = mapa.latLngToContainerPoint([primeiro.lat, primeiro.lon]);
            const tamanho = mapa.getSize();
            const direcao = ponto.x > tamanho.x / 2 ? 'left' : 'right';
            const espaco = direcao === 'left' ? ponto.x : tamanho.x - ponto.x;
            rotulo.style.width = Math.max(90, Math.min(220, espaco - largura / 2 - 30)) + 'px';
            marker.bindTooltip(rotulo, {
                permanent: true, direction: direcao, className: 'mapa-postos-tooltip',
                offset: [direcao === 'left' ? -largura / 2 : largura / 2, -18],
                opacity: 1
            });
        }
        status(mensagemRotas + (grupos.some(g => g.length > 1) ? ' NÃºmeros juntos indicam postos sobrepostos no mapa; clique para ver os detalhes.' : ''));
    }
    function exibir(postos, local, parametros) {
        if (!app.domain.distancia.coordenadasValidas(local)) { limpar(); return; }
        if (!iniciar()) return;
        document.getElementById('mapaVazio').hidden = true;
        camadas.clearLayers();
        marcadores.eachLayer(marker => marker.unbindTooltip());
        marcadores.clearLayers();
        postosNoMapa = [];
        const origem = [local.lat, local.lon];
        L.marker(origem, { icon: L.divIcon({ className: 'map-origin', iconSize: [24, 24], iconAnchor: [12, 12] }), title: 'Origem da consulta' })
            .bindTooltip('Origem da consulta', { permanent: true, direction: 'bottom', offset: [0, 14] }).addTo(camadas);
        let rotas = 0;
        postos.forEach((posto, indice) => {
            if (!app.domain.distancia.coordenadasValidas(posto)) return;
            const classe = posto.tipoDistancia === 'SEM_ROTA' ? 'status-danger' : app.domain.combustivel.analisarAutonomia(posto.distancia, parametros).classe;
            postosNoMapa.push({ ...posto, classe, indice });
            const pontos = posto.geometria?.type === 'LineString' && posto.geometria.coordinates;
            if (posto.tipoDistancia === 'ROTA' && Array.isArray(pontos) && pontos.length > 1 &&
                pontos.every(p => Array.isArray(p) && app.domain.distancia.coordenadasValidas({ lat: p[1], lon: p[0] }))) {
                L.polyline(pontos.map(p => [p[1], p[0]]), { color: '#0873ee', weight: indice === 0 ? 5 : 3, opacity: indice === 0 ? .95 : .45 }).addTo(camadas);
                rotas++;
            }
        });
        const chave = JSON.stringify([origem, postosNoMapa.map(p => [p.lat, p.lon, p.tipoDistancia, p.geometria])]);
        mapa.invalidateSize();
        if (chave !== ultimoEnquadramento) {
            const limites = camadas.getBounds();
            postosNoMapa.forEach(p => limites.extend([p.lat, p.lon]));
            mapa.fitBounds(limites, { padding: [70, 50], maxZoom: 14 });
            ultimoEnquadramento = chave;
        }
        mensagemRotas = rotas ? 'Trajetos rodoviÃ¡rios atÃ© os postos. Confira as restriÃ§Ãµes do veÃ­culo.' : 'LocalizaÃ§Ãµes cadastradas. TraÃ§ados rodoviÃ¡rios indisponÃ­veis nesta consulta.';
        atualizarMarcadores();
    }
    function limpar() {
        camadas?.clearLayers();
        marcadores?.eachLayer(marker => marker.unbindTooltip());
        marcadores?.clearLayers();
        postosNoMapa = [];
        mensagemRotas = '';
        ultimoEnquadramento = '';
        const vazio = document.getElementById('mapaVazio');
        if (vazio) vazio.hidden = false;
        status('');
    }
    function redimensionar() { requestAnimationFrame(() => mapa?.invalidateSize()); }
    app.ui.mapa = { exibir, limpar, redimensionar };
})(window.RotaCombustivel);
