# Revisão do mapa e das localizações — 25/09/2026

Auditoria do arquivo de referência (49 postos) e do banco SQLite local (49 postos e 704 lojas). O banco remoto Supabase não foi consultado. O relatório completo, com nomes, IDs, coordenadas e links para conferência, está em [auditoria-mapas.json](auditoria-mapas.json). Para reproduzir: `node scripts/auditar-mapas.cjs`. O script lê o banco sem alterar registros.

## Divergências encontradas

- Os 49 postos têm coordenadas dentro do intervalo brasileiro e links de mapa/rota com o mesmo destino textual. As coordenadas do arquivo e do SQLite coincidem. Isso não comprova a entrada física nem o ponto que o Google resolverá a partir do endereço.
- 29 registros de lojas com nome e município correspondentes a postos estão a mais de 100 metros das coordenadas do localizador. São distâncias em linha reta entre os dois cadastros, não distâncias rodoviárias. É necessário conferir endereço e identidade antes de substituir posições.
- 25 links de lojas diferem do endereço atual: 16 podem ser recompostos com cidade/UF; 9 pertencem a registros com “Endereço não informado”.
- 125 lojas não têm coordenadas completas. Há 35 grupos de lojas com coordenadas repetidas, incluindo endereços diferentes; repetição é um indício para conferência, não prova automática de duplicidade.
- POSTO REDE BRASIL e POSTO SERRA usam o mesmo endereço em Serra/ES e o ponto (-20.2046526, -40.2689504). No cadastro de lojas, os registros equivalentes ficam 17,359 km distantes desse ponto.
- 25 postos não têm conferência concluída no histórico. O histórico contém POSTO SJDR II/SHARK, enquanto o cadastro atual contém POSTO 604 SJDR (MATOZINHOS); essa correspondência permanece pendente.

| Posto | ID em lojas | Divergência entre cadastros |
| --- | --- | --- |
| Caxuxa Curvelo | 653 | 53,351 km |
| Caxuxa Veredas | 671 | 31,449 km |
| Caxuxa JK | 658 | 24,528 km |
| POSTO 624 TAIOBEIRAS | 649 | 22,517 km |
| Caxuxa I | 656 | 18,789 km |
| Caxuxa Barril | 651 | 9,122 km |
| POSTO 621 PADRE EUSTAQUIO | 646 | 0,288 km |

## Correções no código

- O marcador inicial agora diz “Origem da consulta”, pois a origem pode vir de endereço digitado e não do GPS.
- Uma origem inválida limpa os marcadores antigos. Mudanças no traçado também atualizam o enquadramento, mesmo com os mesmos pontos inicial e final.
- Coordenadas ausentes retornadas pelo Supabase permanecem ausentes; não são convertidas em zero.
- Links de pesquisa gerados para lojas são recompostos a partir do endereço atual; links específicos de coordenadas, Place ID e links curtos do Maps são preservados. A correção ocorre na interface, sem sobrescrever os links do banco.
- “Endereço não informado” deixa de ser aceito para geocodificar uma loja sem coordenadas.
- Rotas extensas são divididas em partes numeradas, preservando ordem e continuidade. Cada link aceita até três paradas intermediárias e 2.048 caracteres, conforme a [documentação oficial do Google Maps](https://developers.google.com/maps/documentation/urls/get-started). IDs de destino e de paradas completas são preservados.

Os testes verificam a construção das URLs e o comportamento da interface com dados simulados. Não confirmam o ponto físico de cada estabelecimento. As coordenadas divergentes foram preservadas para evitar substituições sem uma fonte confiável. A lista de pendências está no relatório JSON.
