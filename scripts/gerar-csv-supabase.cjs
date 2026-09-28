const fs = require('fs');

const linhas = fs.readFileSync('Postos_MG_BA_ES_MVP.csv', 'utf8')
  .replace(/^\uFEFF/, '')
  .trim()
  .split(/\r?\n/);

const cab = linhas.shift().split(';');
const idx = Object.fromEntries(cab.map((x, i) => [x, i]));

const out = ['nome;nome_mapa;endereco;cidade;estado;latitude;longitude;cnpj'];

for (const linha of linhas) {
  const v = linha.split(';');
  const q = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';

  out.push([
    v[idx.Nome],
    '',
    v[idx.Endereco],
    v[idx.Cidade],
    v[idx.Estado],
    v[idx.latitude],
    v[idx.longitude],
    ''
  ].map(q).join(';'));
}

fs.writeFileSync(
  'Postos_MG_BA_ES_SUPABASE.csv',
  '\uFEFF' + out.join('\r\n'),
  'utf8'
);

console.log('CSV SUPABASE CRIADO:', out.length - 1, 'postos');
