# MAPA.md — Estado Final do Mapa

## Status

**Concluído e aprovado em device** para o escopo atual do `cs_rio`.

Este arquivo deixa de ser um plano aberto de reestruturação e passa a registrar a direção final que foi implementada e aceita no jogo.

## Objetivo que foi perseguido

Sair de um mapa que parecia:

- grid técnico
- chão psicodélico
- overlay sem lugar
- urbanismo passivo demais
- muito deslocamento para pouca ação

para um mapa que funciona como:

- **mapa regional compacto**
- **tabuleiro tático de lugares interativos**
- **leitura rápida**
- **pouco deslocamento**
- **foco no que interessa jogar**

## Direção final aprovada

O mapa local não tenta mais ser:

- cidade realista
- malha viária detalhada
- urbanismo decorativo
- cenário cheio de casa/prédio sem função

O mapa local agora é construído com estas regras:

- **só o que importa para jogar aparece**
- **as regiões são compactas**
- **o chão é simples**
- **as construções interativas são o protagonista**
- **as legendas nascem das próprias construções**
- **macro mapa do Rio é separado do mapa local**

## O que foi implementado

### 1. Biblioteca visual interativa

Foi criada uma biblioteca SVG própria para o mapa, cobrindo os elementos centrais do jogo:

- barracos
- favela cluster
- boca
- baile
- rave
- hospital
- prisão
- fábrica
- mercado negro
- universidade
- docas
- desmanche

### 2. Mapa local compacto

Todas as regiões jogáveis foram reduzidas e reorganizadas para leitura rápida:

- `Centro`
- `Zona Norte`
- `Zona Sul`
- `Zona Oeste`
- `Zona Sudoeste`
- `Baixada`

O foco passou a ser:

- ver favela e POIs rápido
- circular pouco
- reduzir espaço morto
- reduzir caminhada desnecessária

### 3. Poda radical do cenário passivo

Foram removidos ou drasticamente reduzidos do mapa local:

- ruas decorativas
- traçados viários confusos
- prédios passivos
- casas passivas
- polígonos técnicos sem função
- overlays grandes que não ajudavam a jogar

### 4. Chão simplificado

O piso do mapa local foi reduzido a uma base visual simples, em vez de múltiplas cores e manchas competindo entre si.

Objetivo:

- parar de confundir
- parar de parecer ferramenta técnica
- deixar as construções dominarem a leitura

### 5. Assets assentados no mapa

Os SVGs deixaram de usar:

- sombras decorativas soltas
- lotes grandes demais
- polígonos visuais desnecessários

O resultado final aprovado foi:

- construção sem sombra solta
- menos sensação de flutuação
- leitura limpa, focada no asset

### 6. Legendas presas às construções

As legendas passaram a:

- sair da própria construção
- ter conector curto
- identificar claramente a qual asset pertencem

Isso foi aplicado para:

- favelas
- prisão
- demais construções/POIs relevantes do mapa local

### 7. Câmera e leitura

Foram ajustados:

- recentralizar
- seguir jogador
- bounds do mapa
- recorte do conteúdo útil

O objetivo foi impedir que a câmera “enlouquecesse” e que o jogador perdesse referência espacial enquanto olha a tela.

### 8. HUD do mapa

O status de conexão/sessão (`Offline - modo solo`, `Conectando...` etc.) saiu da camada do mapa e foi reposicionado abaixo do minimapa, para não competir com o espaço jogável.

### 9. Macro mapa do Rio

O `MapScreen` foi mantido como **macro mapa de deslocamento regional**, separado do mapa local.

Foram feitos estes ajustes finais:

- simplificação das badges das regiões
- remoção de informação visual excessiva
- correção da disposição das zonas
- correção da clicabilidade da `Baixada`

No macro mapa, o que importa é:

- onde você está
- para onde vai
- comparação rápida entre regiões

## O que foi descartado como direção

Estas ideias foram explicitamente abandonadas:

- fazer o mapa local parecer “urbanismo bonito”
- insistir em ruas como protagonista
- preencher a região com construções sem ação
- usar polígonos técnicos como parte principal da leitura
- depender de overlay para explicar tudo

## Critério final que foi atingido

O mapa passou a funcionar melhor quando:

- o jogador bate o olho e vê **lugares**
- não precisa atravessar um mapa enorme
- não fica lendo rua, lote, polígono e cenário inútil
- entende rápido onde estão os pontos de ação
- o macro mapa fica limpo para deslocamento regional

## Arquivos centrais da implementação

- [apps/mobile/src/components/GameView.tsx](/home/cesar/projects/cs_rio/apps/mobile/src/components/GameView.tsx)
- [apps/mobile/src/screens/HomeScreen.tsx](/home/cesar/projects/cs_rio/apps/mobile/src/screens/HomeScreen.tsx)
- [apps/mobile/src/screens/MapScreen.tsx](/home/cesar/projects/cs_rio/apps/mobile/src/screens/MapScreen.tsx)
- [apps/mobile/src/data/mapRegionVisuals.ts](/home/cesar/projects/cs_rio/apps/mobile/src/data/mapRegionVisuals.ts)
- [apps/mobile/src/data/mapStructureCatalog.ts](/home/cesar/projects/cs_rio/apps/mobile/src/data/mapStructureCatalog.ts)
- [apps/mobile/src/data/mapStructureSvgCatalog.ts](/home/cesar/projects/cs_rio/apps/mobile/src/data/mapStructureSvgCatalog.ts)
- [apps/mobile/src/data/generated/mapStructureSvgCatalog.generated.ts](/home/cesar/projects/cs_rio/apps/mobile/src/data/generated/mapStructureSvgCatalog.generated.ts)
- [apps/mobile/assets/map-structures](/home/cesar/projects/cs_rio/apps/mobile/assets/map-structures)

## Resumo curto

O mapa final aprovado do `cs_rio` ficou assim:

- **compacto**
- **interativo**
- **sem poluição de urbanismo passivo**
- **com construções SVG como foco**
- **com leitura rápida por região**
- **com macro mapa do Rio limpo e funcional**
