# Baile Example

Exemplo oficial da **Etapa 10** do pipeline modular para `baile`.

Este diretório mantém dois grupos de artefatos:
- os arquivos antigos `*.example.*`, preservados como histórico do pipeline anterior
- os arquivos novos `*.modular.*`, que representam o pipeline atual baseado em:
  - `analysis`
  - `scene graph`
  - `composição modular`
  - `render final SVG`
  - `preview PNG`
  - `validação técnica`

## Referências usadas

- [baile_funk_1.jpg](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/references/baile_funk_1.jpg)
- [palco_4.jpg](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/references/palco_4.jpg)

## Comando base

```bash
cd /home/cesar/projects/cs_rio/apps/mobile

npm run asset:pipeline -- \
  generate \
  --type baile \
  --style-guide simcity-urban \
  --ref ./assets/examples/funk/baile_funk_1.jpg \
  --ref ./assets/examples/party/palco_4.jpg \
  --out ./assets/asset-pipeline/output/baile.svg
```

## Artefatos modulares atuais

- [baile.modular.analysis.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.analysis.json)
- [baile.modular.scene-graph.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.scene-graph.json)
- [baile.modular.composition.svg](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.composition.svg)
- [baile.modular.composition.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.composition.json)
- [baile.modular.svg](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.svg)
- [baile.modular.render.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.render.json)
- [baile.modular.preview.png](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.preview.png)
- [baile.modular.preview.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.preview.json)
- [baile.modular.validation.json](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile/baile.modular.validation.json)

## Leitura do resultado

Este exemplo já está acima do baile abstrato anterior porque:
- a rua agora lê como corredor comprimido por massas laterais de favela
- o palco virou âncora de profundidade, não um ícone solto
- a multidão ocupa o miolo da composição
- postes, fios, tendas e caixas de som passaram a reforçar leitura urbana e não só “festa”

O resultado ainda não é final art, mas já cumpre o papel de referência oficial do pipeline novo com:
- rua de baile reconhecível
- massa social central
- favela lateral enquadrando o evento
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
- o sucesso desta etapa é visualmente superior ao baseline anterior
- refinamento artístico ainda pode continuar depois
- mas o conjunto já é suficiente para encerrar os dois exemplos obrigatórios do plano
