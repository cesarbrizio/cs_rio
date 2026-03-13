# MAPA.md — Plano de Reestruturação do Mapa

> Este documento **substitui a estratégia anterior**. O grid isométrico atual com overlays foi útil para provar engine e interação básica, mas **falhou como linguagem principal de jogo**. O objetivo agora é transformar o mapa em um **bairro jogável estilizado**, com leitura imediata de lugar, território e ação.

## Objetivo

Transformar o mapa de:

- grid abstrato com cores sem semântica clara
- overlays territoriais que parecem técnicos
- linhas como `Eixo do Centro` e `Rota do Porto` que não parecem ruas
- POIs percebidos como marcadores soltos
- dificuldade em entender onde está favela, rua, boca, baile e fábrica

em:

- **bairro jogável estilizado**
- **favela como distrito reconhecível**
- **POIs com identidade visual forte**
- **ruas e caminhos que parecem ruas e caminhos**
- **mapa que comunica o sistema sem depender de textos grandes**
- **jogador sempre visível e recentralizável**

## Diagnóstico

O problema principal **não é falta de informação**.

O problema principal é:

- a base visual do mapa **não significa nada sozinha**
- quando adicionamos mais labels, estados e POIs, a confusão aumenta
- o jogador não pensa “estou num bairro do jogo”
- o jogador pensa “estou num tabuleiro com marcadores”

Conclusão:

- **não basta enriquecer o grid atual**
- é preciso **mudar a linguagem base do mapa**

## Princípios

### 1. O mapa deve parecer lugar, não overlay

O jogador precisa reconhecer:

- rua
- beco
- quadra
- morro
- favela
- área bloqueada

sem depender de tooltip.

### 2. Favela é distrito, não polígono técnico

Cada favela precisa parecer uma área real do mundo:

- forma própria
- nome
- controle
- estado

### 3. Cada POI precisa ter silhueta e semântica

O jogador deve reconhecer em 1 segundo:

- boca
- fábrica
- baile
- mercado negro
- hospital
- treino
- universidade

### 4. Home, macro mapa e painel territorial têm papéis diferentes

- **Home** = mapa local jogável da região atual
- **MapScreen** = deslocamento macro entre regiões
- **TerritoryScreen** = leitura sistêmica e administrativa

### 5. O jogador nunca pode “sumir”

Sempre deve existir:

- botão de recentralizar
- modo seguir jogador
- retorno consistente ao mapa

### 6. O backend continua sendo a fonte de verdade

Mas o mapa precisa materializar visualmente:

- controle territorial
- guerra
- evento
- pressão policial
- atividade de POIs

## Linguagem Visual Alvo

### Terreno

- **Rua principal**: faixa larga e clara
- **Beco**: passagem estreita
- **Quadra urbana**: bloco neutro
- **Encosta / morro**: textura distinta
- **Favela**: mancha urbana própria
- **Área bloqueada**: visual obviamente não caminhável

### Favela

Cada favela deve ter:

- área/distrito visível
- nome legível
- estado:
  - `Neutra`
  - `Controlada`
  - `Guerra`
- dono:
  - `CV`
  - `TCP`
  - `ADA`
  - etc.

### POIs

- **Boca**: ícone clandestino
- **Fábrica**: galpão / engrenagem / fumaça
- **Baile**: som / luz / palco
- **Mercado Negro**: maleta / banca
- **Hospital**: cruz
- **Treino**: peso / luva
- **Universidade**: livro / prédio

### Caminhos

As linhas abstratas atuais devem ser eliminadas.

`Eixo do Centro`, `Rota do Porto` e equivalentes só podem existir se parecerem:

- avenida
- rua
- via portuária
- subida

Se parecerem “raio”, estão errados.

## MVP do Mapa

### Regiões foco

- **Centro**
- **Zona Norte**

### Home

A home deve mostrar a **região local**, não o Rio inteiro.

Essa região precisa ter:

- 2 a 5 favelas claramente reconhecíveis
- 4 a 8 POIs relevantes
- ruas e caminhos legíveis
- leitura de controle territorial
- jogador claramente posicionado

### Macro Mapa

O `MapScreen` serve para:

- ver regiões
- escolher destino
- pagar custo
- entender tempo de deslocamento

Não precisa substituir o mapa local.

## Fase 0 — Reset Conceitual

### Saída esperada

Fechar a gramática visual e abandonar explicitamente a linguagem anterior baseada em grid abstrato com overlays.

- [x] `0.1` Assumir que o plano anterior falhou como linguagem principal
- [x] `0.2` Fixar o alvo como “bairro jogável estilizado”
- [x] `0.3` Separar Home, MapScreen e TerritoryScreen
- [x] `0.4` Fixar gramática mínima de terreno, favela e POI
- [x] `0.5` Fixar regiões MVP: Centro e Zona Norte

## Fase 1 — Base Visual do Bairro

### Saída esperada

O jogador bate o olho e entende que está num bairro do jogo, não num tabuleiro técnico.

- [x] `1.1` Remover a linguagem dominante de losangos abstratos como leitura principal
- [x] `1.2` Desenhar ruas principais e becos como vias reconhecíveis
- [x] `1.3` Criar blocos/quarteirões/quadras com leitura urbana simples
- [x] `1.4` Diferenciar claramente chão caminhável e área bloqueada
- [x] `1.5` Dar ao morro/encosta linguagem própria
- [x] `1.6` Eliminar as linhas abstratas tipo `Eixo do Centro` e `Rota do Porto`
- [x] `1.7` Substituir essas linhas por ruas/avenidas/trilhas semânticas
- [ ] `1.8` Validar em device que o mapa deixou de parecer “grid colorido sem sentido”

Estado atual:

- `1.1` a `1.7` implementados no código
- `1.8` depende de validação real no device

### Critério

Se o jogador ainda disser:

- “não sei o que é esse chão”
- “esses pisos verde/cinza/amarelo não significam nada”

então a fase falhou.

## Fase 2 — Favela como Distrito

### Saída esperada

Favela passa a parecer favela do jogo, e não mancha técnica.

- [ ] `2.1` Projetar as favelas como distritos reais dentro da região local
- [ ] `2.2` Garantir que 2 a 5 favelas apareçam naturalmente na viewport comum
- [ ] `2.3` Colocar nome da favela diretamente no espaço
- [ ] `2.4` Mostrar controle com selo curto e legível
- [ ] `2.5` Mostrar estado territorial (`Neutra`, `Controlada`, `Guerra`)
- [ ] `2.6` Destacar a favela selecionada sem poluir o resto
- [ ] `2.7` Tocar na favela abre contexto e `TerritoryScreen` focado nela
- [ ] `2.8` Validar em device que o jogador entende o que é favela sem depender do painel

### Critério

Se o jogador ainda disser:

- “só achei uma favela no mapa”
- “não sei quem controla isso”

então a fase falhou.

## Fase 3 — POIs com Identidade de Jogo

### Saída esperada

Cada lugar do jogo tem cara própria.

- [ ] `3.1` Boca com identidade clandestina clara
- [ ] `3.2` Fábrica com identidade industrial clara
- [ ] `3.3` Baile com identidade de evento/lugar
- [ ] `3.4` Mercado Negro com identidade própria
- [ ] `3.5` Hospital com ícone e presença claros
- [ ] `3.6` Treino com identidade própria
- [ ] `3.7` Universidade com identidade própria
- [ ] `3.8` Tocar em cada POI abre a ação/contexto certo
- [ ] `3.9` Validar que os lugares agora parecem lugares, não marcadores genéricos

## Fase 4 — Navegação, Câmera e Presença

### Saída esperada

O jogador nunca mais se perde e sente que está navegando um espaço jogável.

- [ ] `4.1` Botão de recentralizar sempre centraliza no jogador real
- [ ] `4.2` Modo seguir jogador funciona sempre
- [ ] `4.3` Pan manual desativa seguir de forma previsível
- [ ] `4.4` Destino marcado fica visualmente claro
- [ ] `4.5` Voltar ao mapa recentraliza quando fizer sentido
- [ ] `4.6` Validar em uso prolongado que o jogador não “some” mais

### Critério

Se o botão de recentralizar ainda:

- não fizer nada
- centralizar lugar aleatório
- ou falhar com frequência

então a fase falhou.

## Fase 5 — Macro Mapa do Rio

### Saída esperada

O `MapScreen` vira um mapa regional de verdade, não uma tela preta com nomes.

- [ ] `5.1` Usar mapa do Rio como base estilizada
- [ ] `5.2` Destacar macro-regiões de forma clara
- [ ] `5.3` Mostrar região atual do jogador
- [ ] `5.4` Mostrar destino escolhido de forma forte
- [ ] `5.5` Mostrar tempo e custo de deslocamento
- [ ] `5.6` Confirmar visualmente a viagem entre regiões
- [ ] `5.7` Validar que `Ampliar` agora abre um mapa que parece mapa de verdade

## Fase 6 — Estado Vivo Integrado

### Saída esperada

O mapa local vira fonte principal de contexto da rodada.

- [ ] `6.1` Refletir domínio territorial real nas favelas
- [ ] `6.2` Refletir guerra de forma clara
- [ ] `6.3` Refletir eventos ativos sem card gigante
- [ ] `6.4` Refletir POIs controlados / quentes / ativos
- [ ] `6.5` Refletir pressão policial / clima regional
- [ ] `6.6` Refletir presença remota só quando fizer sentido
- [ ] `6.7` Mudar leitura do mapa conforme facção do jogador
- [ ] `6.8` Validar em device que o mapa virou fonte principal de contexto

## Fase 7 — Fechamento e Validação Final

### Saída esperada

Fechar o mapa como parte viva do jogo, não como protótipo visual.

- [ ] `7.1` Rodada de teste real no Centro
- [ ] `7.2` Rodada de teste real na Zona Norte
- [ ] `7.3` Confirmar que favela, POIs e domínio são entendidos sem explicação
- [ ] `7.4` Confirmar que o jogador não depende do `TerritoryScreen` para entender o mundo
- [ ] `7.5` Confirmar que o mapa agora tem “cara de jogo” e não de software

## Ordem Recomendada de Execução

| Passo | Fase | Entrega | Impacto |
|---|---|---|---|
| 1 | Fase 1 | Base visual do bairro | Para de parecer grid técnico |
| 2 | Fase 2 | Favela como distrito | Território passa a ser legível |
| 3 | Fase 3 | POIs com identidade forte | Lugares passam a parecer lugares |
| 4 | Fase 4 | Navegação e presença | Jogador para de se perder |
| 5 | Fase 5 | Macro mapa coerente | Deslocamento regional fica claro |
| 6 | Fase 6 | Estado vivo integrado | Mapa vira fonte de contexto |
| 7 | Fase 7 | Validação final | Confirma se virou jogo de verdade |

## Critérios de Aceite Final

Só considerar o objetivo do mapa cumprido quando, em teste real, o jogador disser algo próximo de:

- “sei onde estou”
- “sei qual área é favela”
- “sei quem controla essa área”
- “sei onde fica boca / baile / fábrica / mercado”
- “consigo voltar para o meu boneco sem me perder”
- “isso parece um bairro de jogo, não um software com overlays”

Se o jogador ainda disser:

- “não sei o que significam essas cores”
- “não sei o que é favela”
- “o mapa ainda parece grid abstrato”
- “parece software, não jogo”

então o plano falhou.

## Métricas de Progresso

| Fase | Tarefas | Concluídas | % |
|---|---|---|---|
| Fase 0 — Reset Conceitual | 5 | 5 | 100% |
| Fase 1 — Base Visual do Bairro | 8 | 7 | 88% |
| Fase 2 — Favela como Distrito | 8 | 0 | 0% |
| Fase 3 — POIs com Identidade de Jogo | 9 | 0 | 0% |
| Fase 4 — Navegação, Câmera e Presença | 6 | 0 | 0% |
| Fase 5 — Macro Mapa do Rio | 7 | 0 | 0% |
| Fase 6 — Estado Vivo Integrado | 8 | 0 | 0% |
| Fase 7 — Fechamento e Validação Final | 5 | 0 | 0% |
| **TOTAL** | **56** | **12** | **21%** |
