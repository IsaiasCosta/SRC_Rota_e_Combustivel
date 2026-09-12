# Rota & Combustível — painel do veículo

Localizador de postos cadastrados e planejamento de autonomia. Interface em português, com parâmetros do veículo salvos no navegador.

O painel possui um único campo **Capacidade do tanque (L)**. Informe a capacidade total, como 100 ou 600 litros, e selecione o nível de combustível: 600 L a 50% representam 300 L disponíveis. Os cadastros antigos com dois campos são convertidos automaticamente pela soma das capacidades, preservando o nível e o consumo salvos.

## Abrir o sistema

Abra `painel-iveco-tector.html` no navegador. Mantenha as pastas `assets/` e `src/` junto ao HTML.

Para desenvolver com um endereço local estável, use Node.js 22 ou superior:

```powershell
npm start
```

Acesse `http://localhost:3000`. Encerre o servidor com `Ctrl+C`. Não é necessário executar `npm install`: as ferramentas usam apenas recursos nativos do Node.js.

Os parâmetros ficam no armazenamento do navegador. A abertura por arquivo e por `localhost` usa armazenamentos separados; mantenha a mesma forma de acesso para recuperar seus valores.

## Organização

```text
IVECO TECTOR/
├── painel-iveco-tector.html
├── assets/
│   ├── css/style.css             # Tema e layout responsivo
│   └── images/                   # Logotipo RC e versão transparente aplicada
├── src/
│   ├── config.js                 # Consumos iniciais e chave de armazenamento
│   ├── app.js                    # Inicialização e eventos da página
│   ├── controllers/
│   │   ├── painel.js             # Coordena cálculos e persistência
│   │   └── localizador.js        # Coordena buscas e mantém seus resultados
│   ├── data/postos.js            # Cadastro dos postos
│   ├── domain/
│   │   ├── combustivel.js        # Cálculo e análise de autonomia
│   │   └── distancia.js          # Distância geográfica e estimativa
│   ├── services/
│   │   ├── armazenamento.js      # Acesso ao localStorage
│   │   └── mapas.js              # Consultas de endereço e rotas
│   ├── ui/
│   │   ├── medidor.js            # Medidor visual de combustível
│   │   ├── postos.js             # Apresentação dos resultados
│   │   └── veiculo.js            # Leitura e preenchimento dos campos
│   └── utils/formatacao.js       # Textos, escape de HTML e duração
├── scripts/
│   ├── serve.cjs                 # Comando de desenvolvimento
│   └── server.cjs                # Servidor local compartilhado pelos testes
├── tests/
│   ├── domain.test.cjs           # Regras e limites de autonomia
│   ├── armazenamento.test.cjs    # Migração e preservação dos parâmetros salvos
│   ├── mapas.test.cjs            # Identificação dos postos nos links de mapas
│   ├── server.test.cjs           # Entrega dos recursos da página
│   └── browser.cjs               # Fluxos e layout no Chrome
├── docs/arquitetura.md
├── backup/                       # Referências anteriores; não executadas
├── .editorconfig
├── .gitignore
└── package.json
```

## Verificação

```powershell
npm test
npm run test:browser
```

O primeiro comando testa as regras e o servidor. O segundo abre o Chrome em modo invisível e verifica cálculos, eventos, persistência, buscas simuladas, erros de rede, layout e abertura direta do HTML. Ele requer Chrome instalado; se necessário, configure `CHROME_PATH` com o caminho do executável. As capturas e o perfil temporário são gravados na pasta temporária do sistema, no caminho informado ao concluir.

## Estado atual

- O sistema funciona no navegador, sem backend ou banco de dados compartilhado.
- O cadastro de postos é estático e ainda precisa de conferência dos endereços e coordenadas.
- Os links do Google Maps usam as coordenadas cadastradas do posto para abrir o ponto exato. O botão “Ver posto no mapa” permite conferir o estabelecimento antes de abrir a rota. Sem coordenadas, o sistema usa nome, endereço, cidade e estado como fallback. As distâncias do painel ainda podem diferir das apresentadas pelo Google Maps.
- As consultas de endereço e rota dependem de internet. O GPS depende da permissão do navegador.
- Quando a consulta de rota falha, a interface identifica a distância como estimativa.
- Os testes de navegador simulam os serviços externos; não verificam sua disponibilidade real.

Consulte [a arquitetura e as orientações de evolução](docs/arquitetura.md) antes de acrescentar funcionalidades.
