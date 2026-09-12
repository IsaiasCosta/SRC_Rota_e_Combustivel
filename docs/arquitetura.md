# Arquitetura do sistema

## Escolha para esta etapa

Frontend estático em HTML, CSS e JavaScript, organizado por responsabilidade. O HTML existente continua sendo a entrada principal e os scripts são carregados com `defer`, na ordem declarada na página.

Cada arquivo JavaScript encapsula suas variáveis em uma função e publica apenas sua interface no objeto `window.IvecoTector`. Essa estrutura mantém a abertura direta por arquivo, sem compilação ou instalação de dependências. Não são usados módulos ES nesta etapa, pois exigiriam servir a página por HTTP para o fluxo de desenvolvimento adotado.

## Responsabilidades

| Parte | Responsabilidade | Exemplos |
| --- | --- | --- |
| HTML | Estrutura e campos da tela | Seções, botões, regiões de resultados |
| `assets/css` | Apresentação e responsividade | Cores, espaçamento, adaptação ao celular |
| `src/app.js` | Inicialização e ligação dos eventos | Eventos de clique, seleção e digitação |
| `src/controllers` | Coordenação dos fluxos e estados da operação | Recalcular o painel, buscar postos, tratar erros |
| `src/domain` | Regras que recebem e retornam dados | Autonomia, margem, distância |
| `src/services` | Acesso a recursos externos | Rede e armazenamento do navegador |
| `src/ui` | Leitura e apresentação na página | Medidor, campos e cartões dos postos |
| `src/data` | Dados de referência | Cadastro de postos |
| `src/utils` | Funções auxiliares reutilizáveis | Formatação e escape de texto |

As regras de `domain` não acessam DOM, rede ou armazenamento. Isso permite testar os cálculos isoladamente. Os componentes de interface não fazem consultas de rede. Os controladores conectam essas partes; o controlador do painel também atualiza os indicadores simples da página.

## Fluxos principais

1. `app.js` restaura os parâmetros pelo controlador do painel, cria o medidor e conecta os eventos.
2. Ao editar um parâmetro, o controlador lê os campos, chama o cálculo de domínio, atualiza o painel e salva os valores válidos.
3. Ao buscar postos, o controlador do localizador obtém e valida a origem por endereço ou GPS. Seleciona os candidatos pela distância geográfica, excluindo coordenadas inválidas ou fora do intervalo aproximado brasileiro do cadastro.
4. O serviço de mapas consulta as rotas. Em caso de indisponibilidade, o controlador usa a estimativa de distância e mantém essa indicação no resultado. A resposta `NoRoute` é tratada separadamente: o resultado recebe `tipoDistancia: 'SEM_ROTA'`, distância e tempo nulos, e aparece depois dos resultados com distância disponível. A interface não calcula autonomia para esse caso.
5. A interface dos postos recebe a lista e os parâmetros atuais para apresentar a análise de autonomia.
6. Se o combustível mudar após uma busca, os resultados existentes são recalculados sem consultar as rotas novamente.

## Dados e estado

- **Configuração:** `config.js` reúne os consumos iniciais por carga, os campos persistidos e a chave `iveco-tector.parametros.v1`, preservada nesta reorganização.
- **Persistência:** `services/armazenamento.js` lê e grava os parâmetros. Ao ler cadastros antigos, soma `inpCapacidade1` e `inpCapacidade2` no novo campo `inpCapacidade`. Um valor já salvo no campo novo tem prioridade e não é somado novamente. A interface esvazia campos salvos inválidos; falhas de leitura ou migração esvaziam todos os parâmetros. O controlador informa a necessidade de preenchimento e preserva o conteúdo salvo até todos os campos ficarem válidos. Na ausência de cadastro salvo, os padrões iniciais continuam disponíveis.
- **Estado da busca:** origem, resultados e indicação de operação em andamento ficam privados em `controllers/localizador.js`.
- **Cadastro:** `data/postos.js` mantém os registros existentes. Mudanças de campos precisam ser refletidas na seleção e na apresentação dos postos.

## Como acrescentar funcionalidades

- Para mudar o visual, edite `assets/css/style.css` e, quando necessário, a estrutura do HTML.
- Para alterar uma fórmula, edite `src/domain` e verifique os limites em `tests/domain.test.cjs`.
- Para substituir o serviço de mapas, preserve os contratos de `services/mapas.js`: origem com coordenadas e nome; rota com distância em quilômetros e tempo em minutos; erro com `code: 'NoRoute'` quando o provedor informar ausência de trajeto. As coordenadas numéricas devem respeitar os limites definidos em `domain/distancia.js`.
- Para criar um histórico de abastecimentos, acrescente regras em `domain`, persistência em `services`, interface em `ui` e um controlador para o fluxo. Conecte os eventos em `app.js`.
- Ao criar um script, declare-o no HTML antes dos arquivos que dependem dele. O servidor local reconhece os recursos declarados em `src/` e `assets/`.
- Os eventos da aplicação devem ser registrados em JavaScript, sem atributos `onclick`, `oninput` ou `onchange` no HTML.

Login, múltiplos veículos, sincronização entre dispositivos e banco de dados compartilhado são evoluções futuras, ainda não implementadas. Quando forem necessários, a camada de serviços será o ponto de integração com um backend.

## Execução e publicação

O servidor de desenvolvimento aceita conexões apenas da máquina local e entrega a página e seus recursos declarados. Backups, documentação e ferramentas não são servidos.

Para hospedar como site estático, publique o HTML principal junto de `src/` e `assets/`. Se o serviço de hospedagem exigir `index.html`, use esse nome para a página no pacote de publicação. O servidor local já aceita `/index.html` como um endereço alternativo, sem duplicar o HTML no projeto.

`backup/original.html.txt` preserva o material inicial. `backup/antes-arquitetura/` contém os antigos arquivos JavaScript e não participa da aplicação.
