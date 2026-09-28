const fs = require('fs');

const ARQUIVO = 'Postos_MG_BA_ES_MVP.csv';
const SAIDA = 'docs/auditoria-links-postos.csv';

function normalizarCoordenada(valor) {
    let s = String(valor || '').trim().replace(',', '.');

    const negativo = s.startsWith('-');
    if (negativo) s = s.slice(1);

    const partes = s.split('.');
    if (partes.length > 2) {
        s = partes.shift() + '.' + partes.join('');
    }

    const n = Number((negativo ? '-' : '') + s);
    return Number.isFinite(n) ? n : null;
}

function extrairCoordenadas(url) {
    const decodificada = decodeURIComponent(url);

    let m = decodificada.match(
        /maps\/search\/(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/
    );

    if (m) {
        return {
            lat: Number(m[1]),
            lon: Number(m[2])
        };
    }

    m = decodificada.match(/!3d(-?\d+(?:\.\d+))!4d(-?\d+(?:\.\d+))/);

    if (m) {
        return {
            lat: Number(m[1]),
            lon: Number(m[2])
        };
    }

    return null;
}

function distanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const rad = x => x * Math.PI / 180;

    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) *
        Math.cos(rad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(a));
}

function campoCSV(valor) {
    const s = String(valor ?? '');
    return /[;"\r\n]/.test(s)
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
}

(async () => {
    const texto = fs
        .readFileSync(ARQUIVO, 'utf8')
        .replace(/^\uFEFF/, '')
        .trim();

    const linhas = texto.split(/\r?\n/);
    const registros = linhas.slice(1);

    const resultado = [];

    for (let i = 0; i < registros.length; i++) {
        const c = registros[i].split(';');

        const nome = (c[0] || '').trim();
        const endereco = (c[1] || '').trim();
        const cidade = (c[2] || '').trim();
        const estado = (c[3] || '').trim();
        const link = (c[4] || '').trim();

        const latCSV = normalizarCoordenada(c[5]);
        const lonCSV = normalizarCoordenada(c[6]);

        process.stdout.write(
            `[${i + 1}/${registros.length}] ${nome} ... `
        );

        try {
            const resposta = await fetch(link, {
                redirect: 'follow'
            });

            const destino = resposta.url;
            const coord = extrairCoordenadas(destino);

            let distancia = '';
            let status = 'SEM_COORDENADA_NO_LINK';

            if (
                coord &&
                latCSV !== null &&
                lonCSV !== null
            ) {
                distancia = distanciaMetros(
                    latCSV,
                    lonCSV,
                    coord.lat,
                    coord.lon
                );

                if (distancia <= 100) {
                    status = 'OK';
                } else if (distancia <= 500) {
                    status = 'REVISAR';
                } else {
                    status = 'DIVERGENTE';
                }
            }

            resultado.push([
                nome,
                endereco,
                cidade,
                estado,
                link,
                latCSV ?? '',
                lonCSV ?? '',
                coord?.lat ?? '',
                coord?.lon ?? '',
                distancia === '' ? '' : distancia.toFixed(0),
                status,
                destino
            ]);

            console.log(status);
        } catch (erro) {
            resultado.push([
                nome,
                endereco,
                cidade,
                estado,
                link,
                latCSV ?? '',
                lonCSV ?? '',
                '',
                '',
                '',
                'ERRO_LINK',
                erro.message
            ]);

            console.log('ERRO_LINK');
        }
    }

    const cabecalho = [
        'Nome',
        'Endereco',
        'Cidade',
        'Estado',
        'Google Maps',
        'Latitude CSV',
        'Longitude CSV',
        'Latitude Google',
        'Longitude Google',
        'Distancia metros',
        'Status',
        'Destino Google Maps'
    ];

    const conteudo = [
        cabecalho,
        ...resultado
    ]
        .map(linha => linha.map(campoCSV).join(';'))
        .join('\r\n');

    fs.mkdirSync('docs', { recursive: true });
    fs.writeFileSync(SAIDA, '\uFEFF' + conteudo, 'utf8');

    console.log('');
    console.log('Auditoria concluída.');
    console.log('Arquivo:', SAIDA);
    console.log('');

    for (const status of [
        'OK',
        'REVISAR',
        'DIVERGENTE',
        'SEM_COORDENADA_NO_LINK',
        'ERRO_LINK'
    ]) {
        console.log(
            status + ':',
            resultado.filter(r => r[10] === status).length
        );
    }
})();