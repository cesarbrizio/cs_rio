# Favela Cluster Example

Exemplo oficial da **Etapa 9** do pipeline modular para `favela-cluster`.

Este diretório agora mantém dois grupos de artefatos:
- os arquivos antigos `*.example.*`, preservados como histórico do pipeline anterior
- os arquivos novos `*.modular.*`, que representam o pipeline atual baseado em:
  - `analysis`
  - `scene graph`
  - `composição modular`
  - `render final SVG`
  - `preview PNG`
  - `validação técnica`

## Referências usadas

- [Favela_1.jpg](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/references/Favela_1.jpg)
- [barraco_4.jpg](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/references/barraco_4.jpg)

## Comando base

```bash
cd /home/cesar/projects/cs_rio/apps/mobile

npm run asset:pipeline -- \
  generate \
  --type favela-cluster \
  --style-guide dense-favela \
  --ref ./assets/examples/favela/Favela_1.jpg \
  --ref ./assets/examples/tend/barraco_4.jpg \
  --out ./assets/asset-pipeline/output/favela-cluster.svg
```

## Artefatos modulares atuais

- [favela-cluster.modular.analysis.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.analysis.json)
- [favela-cluster.modular.scene-graph.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.scene-graph.json)
- [favela-cluster.modular.composition.svg](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.composition.svg)
- [favela-cluster.modular.composition.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.composition.json)
- [favela-cluster.modular.svg](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.svg)
- [favela-cluster.modular.render.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.render.json)
- [favela-cluster.modular.preview.png](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.preview.png)
- [favela-cluster.modular.preview.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.preview.json)
- [favela-cluster.modular.validation.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster/favela-cluster.modular.validation.json)

## Leitura do resultado

Este exemplo já está acima do cluster abstrato anterior porque:
- a massa urbana ficou mais comprimida e reconhecível
- surgiram fachadas, janelas, lajes, toldos, caixas d'água, escadas e tubulações
- a silhueta deixou de parecer um único ícone de prédio

O resultado ainda não é “final art”, mas já representa o primeiro `favela-cluster` do pipeline novo com:
- leitura de favela densa
- profundidade de rua/encosta
- preview revisável
- validação técnica aprovada

## Estado técnico

Status do exemplo modular:
- `validation.ok = true`
- `viewBox`: OK
- `dimensões`: OK
- `centralização`: OK
- `cores`: OK
- `paths`: OK
- `transparência`: OK
- `fundo`: OK

Observação honesta:
- o sucesso desta etapa é **estrutural e visualmente melhor que o baseline anterior**
- a aprovação artística final do pipeline ainda depende também da Etapa 10 (`baile`)
