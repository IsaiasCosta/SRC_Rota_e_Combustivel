# Links dos postos

Os links de rota anteriores usavam apenas `lat,lon` no destino. Isso abria o ponto cadastrado, mesmo quando ele não correspondia à entrada do estabelecimento.

Agora `src/services/mapas.js` monta as URLs usando primeiro as coordenadas cadastradas do posto. Assim, o Google Maps abre o ponto exato em vez de tentar escolher um estabelecimento pelo texto. A origem permanece nas coordenadas usadas na busca. A interface oferece a busca do estabelecimento e a abertura da rota.

## Campos do cadastro

- `Nome`: nome apresentado no painel.
- `nomeMapa` (opcional): nome do estabelecimento confirmado em uma fonte, quando difere do nome interno. Tem prioridade na busca do Google Maps.
- `Endereço`, `Cidade` e `Estado`: complementam a identificação do destino.
- `placeId` (opcional): identificador confirmado do estabelecimento no Google Maps. Quando fornecido, é enviado nos parâmetros `destination_place_id` e `query_place_id`. Não preencher com coordenadas, links ou identificadores inventados.
- `lat` e `lon`: são usados para selecionar candidatos, estimar distâncias e definir o destino exato dos links. É importante conferir essas coordenadas no mapa.

Para o registro `Caxuxa I`, o campo `nomeMapa` foi definido como `Posto Caxuxa Luz`, conforme o [site oficial da rede](https://www.redecaxuxa.com.br/posto.php?id=1), que publica a unidade em Luz/MG, BR-262, km 523.

A construção das URLs segue a [documentação oficial do Google Maps](https://developers.google.com/maps/documentation/urls/get-started). Quando não há coordenadas válidas, nome e endereço são usados como fallback; um Place ID confirmado identifica o estabelecimento com mais precisão. Nenhum Place ID foi atribuído sem confirmação.

Os testes verificam os parâmetros dos links de todos os registros, caracteres especiais, identificação por Place ID e os links renderizados na interface. Eles não comprovam que todos os estabelecimentos do cadastro foram encontrados corretamente pelo Google Maps. A conferência física das coordenadas e dos acessos rodoviários permanece pendente.
