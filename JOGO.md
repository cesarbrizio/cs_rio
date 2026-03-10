# CS Rio — Game Design Document

> Jogo de RPG criminal multiplayer ambientado no Rio de Janeiro, com visual isométrico 2D.
> Inspirado em The Crims, adaptado para a realidade carioca.

---

## 1. Conceito Geral

O jogador é um criminoso tentando sobreviver e ascender no submundo do crime do Rio de Janeiro. A cidade é representada por um mapa isométrico 2D navegável, dividido em regiões reais (favelas, bairros, morros). O objetivo é acumular **Conceito** (respeito) através de atividades criminosas, domínio territorial, gestão de negócios ilícitos e liderança de facção.

### 1.1 Ciclo de Jogo (Rodada)

- 1 dia no jogo = 6 horas reais (tempo 4x acelerado)
- 1 rodada dura **156 dias de jogo** (~39 dias reais)
- Ao fim da rodada, o jogador com mais **Conceito** vence
- Rankings são preservados entre rodadas (Hall da Fama)
- Ao iniciar nova rodada, os jogadores recomeçam do zero com bônus baseados em conquistas anteriores

### 1.2 Ambientação

O cenário é o **Rio de Janeiro real**. O mapa reproduz a geografia da cidade com suas favelas, morros, zona sul, zona norte, centro, zona oeste, zona sudoeste e baixada. Cada região tem características socioeconômicas próprias que influenciam a dificuldade, o tipo de crime disponível, o volume de moradores e os recursos.

### 1.3 Filosofia de Design: Jogo Estratégico de Otimização

CS Rio **não é um jogo de ação direta** — é um **jogo estratégico de otimização de recursos em tempo real**. O jogador precisa gerenciar simultaneamente:

- **Estamina** — recurso principal para ações
- **Nervos** — limita crimes arriscados
- **Vida** — sobrevivência em combate
- **Vício** — efeito colateral do uso de drogas
- **Dinheiro** — moeda para tudo
- **Conceito** — ranking e progressão
- **Tempo** — tudo regenera/decai com o tempo; nunca deixar estamina cheia parada

Jogadores experientes tratam o jogo como uma **planilha de otimização**: calculam risco/recompensa de cada crime, dosam uso de drogas para maximizar estamina sem overdose, escolhem horários estratégicos para atacar e investem em negócios com melhor retorno.

---

## 2. Criação de Personagem

### 2.1 Classes (Vocações)

Ao criar o personagem, o jogador escolhe uma **vocação** que define seus bônus iniciais e especialidades:

| Vocação | Atributo Principal | Atributo Secundário | Especialidade |
|---|---|---|---|
| **Cria** | Força | Resistência | Roubos e assaltos de rua, crimes físicos |
| **Gerente** | Inteligência | Resistência | Gestão de bocas, fábricas e logística de drogas |
| **Soldado** | Força | Inteligência | Combate PvP, defesa territorial, execuções |
| **Político** | Carisma | Inteligência | Negociação com PM, influência social, cafetinagem, lavagem |
| **Empreendedor** | Inteligência | Carisma | Negócios ilícitos, lavagem de dinheiro, investimentos |

- O jogador pode trocar de vocação a qualquer momento mediante pagamento (dinheiro do jogo ou créditos premium)
- Troca de vocação leva 2 dias de jogo para ser efetivada (período de transição)
- Cada vocação possui uma **árvore de habilidades** exclusiva desbloqueada por nível

### 2.2 Atributos Base

Quatro atributos core determinam todas as capacidades do personagem:

| Atributo | Efeito |
|---|---|
| **Força** | Dano em combate, sucesso em roubos físicos, capacidade de carga de armas pesadas |
| **Inteligência** | Produção em fábricas, planejamento de golpes, sucesso em crimes complexos, eficiência de treino |
| **Resistência** | Vida máxima (HP), absorção de dano, capacidade de gestão de propriedades, recuperação de estamina passiva |
| **Carisma** | Lucro com GPs, recrutamento, negociação com PM, desconto em compras, influência em julgamentos |

**Distribuição inicial por vocação:**

| Vocação | Força | Inteligência | Resistência | Carisma |
|---|---|---|---|---|
| Cria | 30 | 10 | 20 | 10 |
| Gerente | 10 | 30 | 20 | 10 |
| Soldado | 25 | 20 | 15 | 10 |
| Político | 10 | 20 | 10 | 30 |
| Empreendedor | 10 | 25 | 10 | 25 |

Atributos aumentam através de:
- Treinos (principal fonte)
- Crimes bem-sucedidos (ganho menor, constante)
- Itens consumíveis (impulsos temporários e permanentes)
- Equipamentos (bônus enquanto equipado)
- Cursos na Universidade do Crime (passivos permanentes)

### 2.3 Aparência

- Sprite do personagem customizável: tom de pele, cabelo, roupa
- Roupas temáticas desbloqueáveis (boné, chinelo, bermudão, colete, corrente de ouro, óculos juliet, camisa de time)
- Roupas de facção (uniforme visual ao entrar em uma facção)
- Itens cosméticos premium
- Tatuagens desbloqueáveis por conquistas

---

## 3. Recursos e Progressão

### 3.1 Conceito (Respeito)

**Conceito** é a moeda de prestígio do jogo. É o que define o ranking do jogador e determina o vencedor da rodada.

**Ganha-se Conceito ao:**
- Completar crimes com sucesso
- Ganhar dinheiro (qualquer fonte)
- Vencer combates PvP
- Conquistar favelas
- Subir de nível
- Doar para a facção
- Realizar atividades do mercado negro
- Vencer guerras de facção
- Julgar corretamente no Tribunal do Tráfico
- Completar eventos especiais

**Perde-se Conceito ao:**
- Ser preso
- Morrer (hospitalização)
- Perder combate PvP
- Ser delatado (X9)
- Falhar em crimes
- Perder território
- Julgar mal no Tribunal do Tráfico (revolta popular ou da facção)
- Ter propriedade sabotada

### 3.2 Níveis de Progressão

| Nível | Título | Conceito Requerido | Desbloqueia |
|---|---|---|---|
| 1 | **Pivete** | 0 | Crimes básicos de rua, mercado negro (compra) |
| 2 | **Aviãozinho** | 50 | Venda de drogas, mercado negro (venda), tráfico |
| 3 | **Fogueteiro** | 200 | Treinos, armas médias, porrada (PvP), fábricas de drogas |
| 4 | **Vapor** | 500 | Raves, bocas de fumo, tráfico nas docas |
| 5 | **Soldado** | 1.500 | Criar facção, crimes de facção, sabotagem, maquininha de caça-níquel |
| 6 | **Gerente de Boca** | 5.000 | Gestão de puteiros (GPs), lojas de fachada, lavagem de dinheiro |
| 7 | **Frente** | 15.000 | Crimes complexos (elite), Universidade do Crime, assassinato por encomenda |
| 8 | **Dono da Boca** | 50.000 | Domínio de favelas, organizar baile funk, armas pesadas |
| 9 | **Líder da Facção** | 150.000 | Guerras de facção, negociação de propina com PM, Tribunal do Tráfico |
| 10 | **Prefeito** | 500.000 | Todas as mecânicas, status lendário, bônus passivos exclusivos |

### 3.3 Estamina (Disposição)

A estamina é o **recurso principal** do jogo. Determina a capacidade de executar qualquer atividade. Vai de 0% a 100%.

**Regra de ouro:** estamina cheia parada é estamina desperdiçada. Jogadores otimizados nunca ficam em 100% por muito tempo.

**Consumo por atividade:**

| Atividade | Custo de Estamina |
|---|---|
| Crimes solo (fáceis) | 5–15% |
| Crimes solo (médios) | 15–30% |
| Crimes solo (difíceis) | 30–50% |
| Crimes de facção | 30% (fixo) |
| Combate PvP (porrada) | 20% |
| Sabotagem | 40% |
| Treinamento | 15% |
| Tráfico de drogas | 5% |
| Visitar GP | 10% |

**Recuperação passiva:**
A velocidade de recuperação depende do **moral** (estado de intoxicação). Quanto mais "chapado", mais rápido recupera — mas isso exige uso de drogas, que aumenta o vício.

**Estados de Moral (afetam velocidade de recuperação):**

| Estado | Recuperação Passiva | Como Atingir |
|---|---|---|
| Sóbrio | 1% a cada 10 min reais | Estado padrão |
| Leve | 1% a cada 6 min | 1-2 doses de droga |
| Chapado | 1% a cada 4 min | 3-4 doses |
| Muito Louco | 1% a cada 3 min | 5-7 doses |
| Destruído | 1% a cada 2 min | 8+ doses (risco de overdose) |

**Outras formas de recuperação:**
- Drogas consumidas em raves/bailes (recuperação instantânea, mas aumenta tolerância e vício)
- GPs: recuperam estamina + moral (10-20% instantâneo)
- Descanso em casa própria: bônus de +50% na recuperação passiva
- Itens especiais (Tadalafila, etc.)

### 3.4 Nervos (Nerve)

Os nervos são um **recurso secundário** que limita crimes mais arriscados. Vai de 0 a 100.

- Cada crime arriscado consome nervos (crimes fáceis não consomem)
- Nervos regeneram lentamente com o tempo (1 ponto a cada 5 min reais)
- Drogas estimulantes (Cocaína, Crack, Bala) restauram nervos parcialmente
- Se nervos = 0: só pode cometer crimes básicos (nível 1-2)
- Servem como **limitador natural** para evitar que jogadores farmen crimes pesados infinitamente

**Consumo de nervos por tipo de crime:**

| Crime | Nervos Consumidos |
|---|---|
| Crimes de rua (nível 1-2) | 0 |
| Assaltos armados (nível 3-4) | 5-15 |
| Grandes roubos (nível 5-6) | 15-30 |
| Crimes de elite (nível 7+) | 30-50 |
| Crimes de facção | 20 (fixo) |

### 3.5 Vida (HP)

- Base: 100 HP (aumenta com Resistência: +1 HP por ponto de Resistência)
- Perde vida em combate PvP, falhas em crimes violentos, incursões policiais, overdose
- Recupera: passivamente (lento), no Hospital (pago), com itens (Transfusão, Viagra)
- Se chegar a 0: personagem fica **hospitalizado** (2-12 horas de jogo)
- Com Plano de Saúde: hospitalização reduzida para 15 minutos de jogo

### 3.6 Vício (Addiction)

O vício é uma **mecânica de risco/recompensa** central no jogo.

- Aumenta cada vez que o jogador usa drogas
- Diminui lentamente com o tempo (1% por hora de jogo sem usar drogas)
- **Efeitos do vício alto:**

| Faixa de Vício | Efeito |
|---|---|
| 0-20% | Sem efeitos negativos |
| 21-40% | -5% em todos os atributos |
| 41-60% | -10% em atributos, eficiência de drogas reduzida em 25% |
| 61-80% | -20% em atributos, eficiência de drogas reduzida em 50%, tremores (chance de falhar ações) |
| 81-99% | -30% em atributos, eficiência de drogas reduzida em 75%, risco de overdose espontânea |
| 100% | **Overdose automática** — hospitalização, perda de conceito, reset de moral |

**Desintoxicação:**
- Feita no Hospital
- Custo: baseado no nível de conceito do jogador
- Alternativa barata: Metadona ($500 por sessão, reduz 10% do vício)
- Remove toda a tolerância e vício acumulados

**Tolerância:**
Separada do vício. Cada droga tem tolerância individual:
- Quanto mais usa uma droga específica, menor o efeito dela
- Eficiência diminui progressivamente (até 1/45 do normal em tolerância máxima)
- Desintoxicação reseta tanto vício quanto tolerância

---

## 4. Sistema de Crimes

### 4.1 Crimes Solo

Crimes individuais disponíveis conforme o nível do jogador. Quanto mais abaixo na lista, maior a dificuldade, o risco e a recompensa. Cada crime dentro de um nível também tem graduação de dificuldade (o último da lista é o mais difícil daquele nível).

**Nível 1 — Pivete:**
- Roubar celular na rua
- Furtar turista na praia
- Arrastão no ônibus
- Roubar loja de conveniência
- *(Sem consumo de nervos, só estamina)*

**Nível 2 — Aviãozinho:**
- Assaltar pedestre armado
- Roubar bicicleta/patinete elétrico
- Furtar carga de van de entrega
- Golpe do falso delivery
- Roubar celular no sinal (janela de carro)
- *(Sem consumo de nervos, só estamina)*

**Nível 3 — Fogueteiro:**
- Assaltar posto de gasolina
- Roubar farmácia
- Sequestro relâmpago
- Assalto a ônibus (todos os passageiros)
- Roubo de moto na pista
- *(Consome 5-10 nervos)*

**Nível 4 — Vapor:**
- Roubar joalheria
- Assalto a casa de câmbio
- Roubar carga de caminhão (cigarros, bebidas)
- Sequestro com resgate
- Golpe do seguro (carro)
- *(Consome 10-15 nervos)*

**Nível 5 — Soldado:**
- Assalto a banco (agência de bairro)
- Roubo de carro-forte
- Assalto a shopping
- Roubo de carga pesada (eletrônicos)
- Invasão de condomínio
- *(Consome 15-20 nervos)*

**Nível 6 — Gerente de Boca:**
- Golpe financeiro (pirâmide)
- Roubo a banco (agência central)
- Assalto ao Aeroporto Tom Jobim / Galeão
- Sequestro de empresário (alto valor)
- Roubo de obra de arte
- *(Consome 20-25 nervos)*

**Nível 7 — Frente:**
- Roubo ao Porto do Rio
- Assalto à Casa da Moeda
- Golpe na Bolsa de Valores
- Roubo ao Maracanã (dia de jogo)
- Interceptação de avião de carga
- *(Consome 30-40 nervos)*

**Nível 8 — Dono da Boca:**
- Mega-assalto ao Banco Central
- Roubo de ouro do Aeroporto
- Sequestro de político
- Assalto ao BNDES
- *(Consome 40-50 nervos)*

**Nível 9 — Líder da Facção:**
- Golpe bilionário coordenado
- Roubo ao Tesouro Nacional
- Sequestro de embaixador
- *(Consome 50 nervos, requer planejamento prévio de 1 dia de jogo)*

**Nível 10 — Prefeito:**
- O Grande Golpe (crime lendário, 1x por rodada)
- *(Consome 50 nervos + 50% estamina, recompensa colossal)*

**Cada crime tem:**
- Custo de estamina
- Custo de nervos (a partir do nível 3)
- Probabilidade de sucesso (baseada em atributos + equipamento)
- Recompensa (dinheiro + conceito + chance de itens/componentes)
- Risco de prisão em caso de falha
- Cooldown entre execuções
- Chance de dropar componentes especiais para fábricas (crimes nível 4+)

### 4.2 Crimes de Facção (Coletivos)

Requerem pertencer a uma facção e estar no nível 5+. Todos os membros online participam. Custo fixo de 30% de estamina + 20 nervos por membro.

**Crimes de facção disponíveis:**
- Roubo a banco central (mínimo 3 membros)
- Assalto ao porto — cargas internacionais (mínimo 5 membros)
- Invasão de base rival (mínimo 4 membros)
- Mega-sequestro (mínimo 3 membros)
- Heist coordenado — requer 1 dia de jogo de planejamento (mínimo 6 membros)
- Tomada de favela — ver seção 11 (mínimo depende da favela)

O sucesso depende do **poder combinado** de todos os membros participantes. A recompensa é dividida proporcionalmente ao poder de cada membro.

### 4.3 Probabilidade e Poder

```
Poder de Assalto = Força + (Resistência / 2) + Bônus de Arma + Bônus de Colete + Bônus de Vocação
Poder de Inteligência = Inteligência + (Carisma / 2) + Bônus de Equipamento
```

Crimes físicos usam **Poder de Assalto**. Crimes de planejamento (golpes, fraudes) usam **Poder de Inteligência**.

Cada crime tem um **poder mínimo** requerido. A probabilidade de sucesso é:
- Poder < 50% do Mínimo: 0% (crime bloqueado, aparece em vermelho)
- Poder = 50% do Mínimo: 10%
- Poder = Mínimo: 50%
- Poder = 1.5x Mínimo: 75%
- Poder = 2x Mínimo: ~90%
- Poder = 3x Mínimo: ~99%

O jogador vê a **porcentagem estimada** antes de escolher o crime (como no The Crims).

**Falha pode resultar em:**
- Perda de estamina (sempre, mesmo em falha)
- Perda de nervos (sempre, se o crime consome nervos)
- Perda de dinheiro (parcial)
- Prisão (probabilidade varia)
- Hospitalização (crimes violentos)
- Perda de conceito
- Perda de durabilidade da arma/colete

---

## 5. Equipamento e Mercado Negro

### 5.1 Armas

Armas aumentam a **Força** efetiva em combate e crimes. Cada arma possui:
- **Poder de ataque**: bônus fixo adicionado ao Poder de Assalto
- **Durabilidade**: desgasta com uso (cada crime/combate consome 1-3 pontos), pode ser reparada
- **Proficiência**: aumenta com uso da arma (0-100%), melhora efetividade em até 50% do poder base
- **Nível mínimo** requerido para equipar

**Lista de armas (progressão):**

| Arma | Poder | Nível Min. | Durabilidade | Preço Base |
|---|---|---|---|---|
| Canivete | +50 | 1 | 100 | $500 |
| Soco inglês | +120 | 1 | 150 | $1.200 |
| Faca peixeira | +250 | 2 | 120 | $3.000 |
| Revólver .32 | +500 | 2 | 200 | $8.000 |
| Pistola .380 | +900 | 3 | 200 | $15.000 |
| Pistola 9mm | +1.500 | 3 | 250 | $30.000 |
| Pistola .40 | +2.500 | 4 | 250 | $60.000 |
| Escopeta | +4.000 | 5 | 180 | $120.000 |
| Submetralhadora UZI | +6.500 | 5 | 150 | $250.000 |
| Fuzil AK-47 | +10.000 | 6 | 300 | $500.000 |
| Fuzil AR-15 | +15.000 | 7 | 300 | $900.000 |
| Fuzil .50 | +25.000 | 8 | 200 | $2.000.000 |
| Lança-granadas | +40.000 | 9 | 100 | $5.000.000 |
| Minigun | +60.000 | 10 | 80 | $15.000.000 |

**Reparo de armas:**
- Feito no Mercado Negro (Negociante de Armas)
- Custo: 10% do preço base por 50 pontos de durabilidade recuperados
- Arma com durabilidade 0 não funciona (sem bônus)

### 5.2 Coletes

Coletes aumentam a **Resistência** efetiva. Funcionam como armadura.

| Colete | Defesa | Nível Min. | Durabilidade | Preço Base |
|---|---|---|---|---|
| Colete improvisado | +30 | 1 | 80 | $300 |
| Colete de couro | +100 | 2 | 120 | $2.000 |
| Colete balístico nível II | +300 | 3 | 200 | $10.000 |
| Colete balístico nível IIIA | +600 | 4 | 250 | $30.000 |
| Colete tático | +1.200 | 5 | 300 | $80.000 |
| Colete militar | +2.500 | 6 | 350 | $200.000 |
| Blindagem completa | +5.000 | 7 | 300 | $600.000 |
| Colete BOPE | +10.000 | 8 | 400 | $1.500.000 |
| Exoesqueleto tático | +20.000 | 9 | 250 | $5.000.000 |

- Coletes ativam automaticamente ao comprar
- Perdem durabilidade ao absorver dano (1-5 pontos por hit)
- Podem ser reparados no Mercado Negro (mesma lógica das armas)

### 5.3 Soldados (Guardas de Propriedade)

Soldados protegem suas propriedades (bocas, fábricas, puteiros, raves) e territórios de favela. Cada soldado tem:
- Custo diário de manutenção (pago automaticamente)
- Poder de defesa (soma ao poder defensivo da propriedade)
- Pode ser preso em incursões policiais
- Pode ser morto em ataques de facção rival
- Se o dono não pagar o salário, soldado abandona o posto

| Tipo | Poder | Custo/Dia | Nível Min. |
|---|---|---|---|
| Olheiro | 500 | $1.000 | 3 |
| Soldado de rua | 2.000 | $5.000 | 4 |
| Fogueteiro de alerta | 5.000 | $15.000 | 5 |
| Segurança armado | 10.000 | $40.000 | 7 |
| Mercenário | 25.000 | $100.000 | 9 |

### 5.4 Mercado Negro

O Mercado Negro é o hub central de comércio do jogo. Localizado em cada região do mapa.

**O que se compra e vende:**
- Armas e coletes (novos e usados)
- Drogas (tráfico entre jogadores)
- Componentes de fábrica
- Itens especiais e impulsos
- Serviços (reparo de armas/coletes)

**Mecânica:**
- Taxa de comissão: **5%** sobre todas as transações entre jogadores
- Preços flutuam com oferta/demanda real dos jogadores
- Jogadores podem colocar ordens de compra/venda (como um mercado de ações)
- Itens raros podem ser leiloados (lance mínimo + tempo)

---

## 6. Itens Especiais e Impulsos

### 6.1 Consumíveis de Combate/Saúde

| Item | Efeito | Obtido Via | Nome Original (The Crims) |
|---|---|---|---|
| **Tadalafila** | +20% em todos os atributos por 1 dia de jogo | Mercado Negro, drop de crimes | Esteróides |
| **Viagra** | Recuperação rápida de vida (cura 50% HP instantaneamente) | Hospital, Mercado Negro | Rápida recuperação |
| **Camisinha** | Previne DSTs ao usar serviços de GP (1 uso) | Mercado Negro, lojas | Preservativos |
| **Transfusão de Sangue** | Recupera 100% HP instantaneamente | Hospital | Transfusão de sangue |
| **Meia Transfusão** | Recupera 50% HP instantaneamente | Hospital, Mercado Negro | Meia transfusão |

### 6.2 Impulsos (Boosts)

Impulsos são itens temporários que potencializam atividades específicas. Duram **1 dia de jogo (6h reais)** salvo indicação contrária. Não acumulam entre si (usar outro do mesmo tipo substitui).

| Impulso | Efeito | Nome Original (The Crims) |
|---|---|---|
| **Impulso de Milico** | +30% ganho de atributos em treinos | Reforço de treinamento |
| **Impulso de Conceito Alto** | Dobra o Conceito ganho em todas atividades | Big Brother |
| **Impulso de Cria** | +50% recompensa em crimes solo | Amor ao Trabalho |
| **Impulso de Jogo do Bicho** | +30% chance de vitória na maquininha/bicho | Bingo |
| **Impulso de Dono da Boca** | +50% produção em fábricas de drogas | Viciado em Componentes |
| **Impulso de Dono da Facção** | +30% produção em todas as fábricas + bônus de qualidade | Laboratórios NASA |
| **Impulso de Fintech** | +50% retorno em lavagem de dinheiro e investimentos | Mercado de Ações Frenético |

**Obtenção de impulsos:**
- Drop raro em crimes de alto nível
- Compra no Mercado Negro (preço alto)
- Recompensa de eventos especiais
- Leilão entre jogadores

### 6.3 Lavagem de Dinheiro

Disponível a partir do nível 6 (Gerente de Boca).

**Mecânica:**
1. O jogador escolhe um **método de lavagem** (cada um com características diferentes)
2. Investe uma quantia de dinheiro sujo
3. Após o período de processamento, recebe o dinheiro limpo + lucro

**Métodos de lavagem:**

| Método | Retorno | Tempo | Risco de Investigação | Nível Min. |
|---|---|---|---|---|
| Barbearia | 10% | 1 dia de jogo | Baixo (5%) | 6 |
| Lava-rápido | 12% | 1 dia | Baixo (8%) | 6 |
| Loja de Açaí | 13% | 1 dia | Médio (12%) | 7 |
| Igreja Evangélica | 15% | 2 dias | Baixo (5%) | 7 |
| Oficina Mecânica | 15% | 1 dia | Médio (15%) | 7 |
| Empresa Fantasma | 20% | 3 dias | Alto (25%) | 8 |
| Construtora | 25% | 5 dias | Alto (30%) | 9 |

- Com **Impulso de Fintech**: retorno aumenta em 50% (ex: 15% → 22,5%)
- **Risco de investigação**: chance de ser investigado pela Polícia Federal
  - Se investigado: perde o investimento inteiro + chance de prisão
  - Risco aumenta com o valor investido (acima de $1M: risco dobra)
  - **Carisma** do jogador reduz o risco de investigação em até 30%

---

## 7. Drogas

### 7.1 Tipos de Drogas

Drogas são consumidas em raves/bailes para recuperar estamina e elevar o moral. Também podem ser produzidas em fábricas e vendidas para lucro. São a **espinha dorsal da economia** do jogo.

| Droga | Recuperação de Estamina | Aumento de Moral | Preço Base | Nível para Produzir | Bônus de Nervos |
|---|---|---|---|---|---|
| **Maconha** | 1% | +1 nível | $50 | 2 | 0 |
| **Lança** (lança-perfume) | 2% | +1 nível | $150 | 3 | +2 |
| **Bala** (ecstasy) | 3% | +2 níveis | $400 | 4 | +5 |
| **Doce** (LSD) | 4% | +2 níveis | $800 | 4 | 0 |
| **MD** (MDMA) | 5% | +2 níveis | $1.500 | 5 | +3 |
| **Cocaína** | 7% | +3 níveis | $3.000 | 6 | +10 |
| **Crack** | 8% | +3 níveis | $5.000 | 7 | +15 |

**Aumento de Vício por uso:**

| Droga | Vício por Dose |
|---|---|
| Maconha | +0,5% |
| Lança | +1% |
| Bala | +1,5% |
| Doce | +1% |
| MD | +2% |
| Cocaína | +3% |
| Crack | +5% |

### 7.2 Tolerância e Overdose

- Cada uso de droga aumenta a **tolerância específica** àquela droga
- Com alta tolerância, a eficiência cai (até 1/45 do normal no máximo)
- **Overdose** acontece se:
  - Estamina ultrapassar 100% por efeito de droga
  - Vício chegar a 100%
  - Usar 3+ tipos de droga diferentes em menos de 1 hora de jogo
- **Efeitos da overdose:**
  - Hospitalização por 30 minutos reais (2 horas de jogo)
  - Perda de todos os contatos do tipo "conhecidos"
  - Perda de 5% do conceito
  - Vício resetado para 50%
  - Moral vai para Sóbrio

### 7.3 Fábricas de Drogas

- Compradas no mercado (preço varia por tipo de droga)
- Produzem drogas automaticamente a cada ciclo (quantidade baseada em **Inteligência**)
- Custo diário de manutenção (eletricidade, insumos)
- Podem ser sabotadas por rivais
- Podem ser apreendidas em incursões policiais
- Necessitam **componentes** para funcionar:
  - Componentes obtidos via crimes especiais (nível 4+)
  - Componentes obtidos via leilões no Mercado Negro
  - Cada tipo de droga requer componentes específicos
  - Sem componentes, fábrica para de produzir

**Produção diária por fábrica:**
```
Produção = Base da Droga × (1 + Inteligência/1000) × Bônus de Impulso × Bônus de Vocação(Gerente)
```

### 7.4 Venda de Drogas

| Canal | Comissão | Volume | Observação |
|---|---|---|---|
| Tráfico direto (rua) | 5% | Baixo | Rápido, estamina 5% |
| Boca de fumo própria | 0% | Médio | Venda automática a NPCs e jogadores |
| Rave/Baile próprio | 0% | Alto | Jogadores consomem no local |
| Mercado Negro | 5% | Variável | Preço definido por oferta/demanda |
| Docas (Porto) | 0% | Muito Alto | Preço 50% maior quando navio atraca |

---

## 8. Negócios e Propriedades

### 8.1 Bocas de Fumo

Ponto fixo de venda de drogas. Disponível a partir do nível 4 (Vapor).

- Gera renda passiva diária vendendo drogas a NPCs e jogadores que passam
- O dono define quais drogas estocar e o preço
- Lucro depende de: localização (favela/região), variedade de drogas, preços, fluxo de jogadores
- Pode ser protegida por soldados
- Pode ser sabotada ou tomada por rivais
- Pode ser apreendida pela PM em incursões
- **Bônus de localização**: bocas em favelas mais populosas vendem mais

### 8.2 Raves e Bailes Funk

O jogador pode ser dono de estabelecimentos onde outros jogadores consomem drogas e recuperam estamina.

**Raves** (nível 4+):
- Até 10 tipos de drogas disponíveis para consumo
- Preço de entrada customizável
- Filtro de conceito mínimo para entrar
- Receita: entrada + venda de drogas
- Localização: qualquer região do mapa
- Pode ter DJ (NPC que aumenta o fluxo de visitantes)

**Bailes Funk** (nível 8+ ou facção que domina a favela):
- Até 5 tipos de drogas
- Entrada mais barata, maior volume de visitantes
- Bônus de satisfação para moradores da favela (se o baile for no território)
- Pode atrair atenção da PM (risco calculado)
- MC ao vivo (NPC que aumenta satisfação dos moradores)
- Só pode existir em favelas dominadas

### 8.3 Puteiros (Casas de GP)

Casas com **Garotas do Job (GPs)**. Disponível a partir do nível 6 (Gerente de Boca).

**Funcionamento:**
- Cada puteiro comporta 5 GPs
- Lucro depende do **Carisma** do dono
- Clientes (NPCs e jogadores) geram receita automática
- Coleta de receita manual (1x por dia de jogo)
- GPs também recuperam estamina e moral do jogador que as visita

**Riscos com GPs:**
- Podem fugir (chance diária baixa, reduzida com Carisma alto)
- Podem morrer (evento raro)
- Podem ser "roubadas" por rivais (sabotagem)
- Podem transmitir DSTs a clientes sem Camisinha

**Tipos de GP (progressão de qualidade e lucro):**

| Tipo | Lucro/Dia | Estamina Restaurada | Preço de Compra |
|---|---|---|---|
| Novinha | $2.000 | 10% | $10.000 |
| Experiente | $5.000 | 12% | $30.000 |
| Premium | $12.000 | 15% | $80.000 |
| VIP | $25.000 | 18% | $200.000 |
| Diamante | $50.000 | 20% | $500.000 |

### 8.4 Lojas de Fachada

Negócio "legal" que serve para lavar dinheiro. Disponível a partir do nível 6.

- Cada loja tem um tipo (lava-rápido, barbearia, igreja, loja de açaí, oficina mecânica)
- Gera renda legítima pequena por dia (dinheiro limpo)
- Processa lavagem de dinheiro (ver seção 6.3)
- Quanto maior o negócio (upgrades), mais dinheiro pode lavar por dia
- Pode ser investigada pela Polícia Federal (risco reduzido com Carisma)

### 8.5 Maquininha de Caça-Níquel / Jogo do Bicho

**Jogo do Bicho** (disponível nível 1+):
- Aposta em animais (1-25)
- Sorteio a cada 2 horas de jogo (30 min reais)
- Pagamento: 18x a aposta no bicho certo
- Com **Impulso de Jogo do Bicho**: +30% chance
- Pode apostar na cabeça (animal exato: 18x), no grupo (grupo de 4: 5x), ou na dezena (dezena exata: 60x)

**Maquininha de Caça-Níquel** (disponível nível 5+):
- Espalhadas por bares e bocas da cidade
- Aposta por rodada: $100 a $100.000
- Probabilidades configuradas pelo dono da maquininha
- Jackpot: 100x a aposta (chance ~1%)
- O dono da maquininha lucra com a margem da casa
- Com impulso: +30% nas probabilidades de prêmio

**Comprar Maquininhas** (nível 6+):
- Jogadores podem comprar maquininhas e instalar em locais estratégicos
- Renda passiva com margem de 15-30% (configurável)
- Atraem jogadores para a região (movimento)

### 8.6 Imóveis (Casas)

Jogadores podem comprar imóveis para moradia. Cada tipo dá bônus diferentes:

| Tipo | Preço | Bônus Estamina | Cofre | Localização Típica |
|---|---|---|---|---|
| Barraco | $5.000 | +10% recuperação | $50.000 | Favelas |
| Kitnet | $20.000 | +15% recuperação | $100.000 | Centro, Z. Norte |
| Apartamento | $100.000 | +25% recuperação | $500.000 | Z. Sul, Z. Sudoeste |
| Casa | $300.000 | +35% recuperação | $1.000.000 | Z. Oeste, Z. Sudoeste |
| Cobertura | $1.000.000 | +45% recuperação | $5.000.000 | Z. Sul |
| Mansão | $5.000.000 | +50% recuperação | $20.000.000 | Z. Sudoeste |

- Bônus de Estamina: melhora a regeneração passiva quando "em casa"
- Cofre: dinheiro guardado está protegido de apreensão e roubo (limite do cofre)
- Localização afeta preço e prestígio
- Pode ser invadida por rivais se sem proteção (soldados)
- Pode guardar itens (inventário extra)

---

## 9. Treinamento

### 9.1 Centro de Treino

Disponível a partir do nível 3 (Fogueteiro). Principal forma de aumentar atributos permanentemente.

| Tipo de Treino | Duração | Atributos Ganhos | Desbloqueio |
|---|---|---|---|
| Treino Básico | 30 min reais | Base conforme vocação | Nível 3 |
| Treino Avançado | 1h real | 2x base | Após 30 treinos básicos |
| Treino Intensivo | 2h reais | 3x base | Nível 7 (Frente) |

**Distribuição de ganho por vocação:**

| Vocação | Força | Inteligência | Resistência | Carisma |
|---|---|---|---|---|
| Cria | 40% | 15% | 30% | 15% |
| Gerente | 15% | 40% | 30% | 15% |
| Soldado | 35% | 25% | 25% | 15% |
| Político | 10% | 25% | 15% | 50% |
| Empreendedor | 10% | 35% | 15% | 40% |

**Ganho base por sessão de treino básico:** 2.400 pontos no atributo principal + 600 nos secundários (por 30 min reais).

- Custa estamina (15%) e dinheiro ($1.000 a $50.000 dependendo do tipo)
- Com **Impulso de Milico**: +30% em todos os atributos ganhos
- Treinos em sequência sem descanso dão rendimento decrescente (-10% por treino consecutivo)
- Descanso de 1h real entre treinos restaura o rendimento total

### 9.2 Universidade do Crime

Sistema avançado de especialização. Desbloqueado no nível 7 (Frente).

- Cada vocação tem **cursos exclusivos** organizados em módulos
- Cursos dão **habilidades passivas permanentes**
- Cada curso tem pré-requisitos (nível, atributos mínimos, dinheiro)
- Dura de 1 a 5 dias de jogo para completar (não pode treinar durante)

**Cursos por vocação:**

**Cria — Escola da Rua:**
| Curso | Efeito | Pré-requisito |
|---|---|---|
| Mão Leve | +10% sucesso em roubos solo | Nível 7 |
| Corrida de Fuga | -20% chance de prisão em falhas | Nível 7, Força 500 |
| Olho Clínico | Identifica valor real de alvos antes do crime | Nível 8 |
| Rei da Rua | +25% recompensa em crimes nível 1-4 | Nível 9, todos anteriores |

**Gerente — Escola de Logística:**
| Curso | Efeito | Pré-requisito |
|---|---|---|
| Logística de Boca | Fábricas produzem 15% mais | Nível 7 |
| Rede de Distribuição | Bocas vendem 20% mais por dia | Nível 7, Inteligência 500 |
| Químico Mestre | Desbloqueia produção de 2 drogas por fábrica | Nível 8 |
| Magnata do Pó | +30% em toda produção de drogas | Nível 9, todos anteriores |

**Soldado — Escola PQD (Paraquedista):**
| Curso | Efeito | Pré-requisito |
|---|---|---|
| Tiro Certeiro | +15% dano em PvP | Nível 7 |
| Emboscada Perfeita | +20% poder em emboscadas | Nível 7, Força 500 |
| Instinto de Sobrevivência | -30% dano recebido quando HP < 25% | Nível 8 |
| Máquina de Guerra | +25% em Poder de Assalto total | Nível 9, todos anteriores |

**Político — Escola de Influência:**
| Curso | Efeito | Pré-requisito |
|---|---|---|
| Lábia de Político | +20% sucesso em negociações com PM | Nível 7 |
| Rede de Contatos | +15% lucro com GPs, -20% custo de suborno | Nível 7, Carisma 500 |
| Manipulação de Massa | +25% influência em Satisfação dos Moradores | Nível 8 |
| Poderoso Chefão | Bônus de Carisma para toda a facção (+5%) | Nível 9, todos anteriores |

**Empreendedor — Escola de Negócios:**
| Curso | Efeito | Pré-requisito |
|---|---|---|
| Engenharia Financeira | +10% retorno em lavagem de dinheiro | Nível 7 |
| Faro para Negócios | -15% custo de manutenção de todas propriedades | Nível 7, Inteligência 500 |
| Mercado Paralelo | Taxa do Mercado Negro reduzida de 5% para 2% | Nível 8 |
| Império do Crime | +20% renda passiva em todos os negócios | Nível 9, todos anteriores |

---

## 10. Facções

### 10.1 Facções Fixas

Estas facções **sempre existem** no jogo e não podem ser dissolvidas. São controladas por jogadores (liderança disputável), mas nunca deixam de existir.

| Sigla | Nome Completo | Território Inicial | Bônus Temático |
|---|---|---|---|
| **CV** | Comando Vermelho | Complexo do Alemão, Rocinha | +15% lucro em tráfico de drogas |
| **TCP** | Terceiro Comando Puro | Complexo de São Carlos, Mangueira | +15% poder em defesa territorial |
| **ADA** | Amigo dos Amigos | Vidigal, Cantagalo | +15% em crimes solo |
| **TC** | Terceiro Comando | Diversas (Zona Norte) | +10% em todos os atributos de combate |
| **MIL** | Milícia | Rio das Pedras, Campo Grande, Santa Cruz | +20% receita de serviços de favela |
| **LJ** | Liga da Justiça | Baixada Fluminense (diversas) | +15% poder em ataques de facção |
| **PCC** | Primeiro Comando da Capital | Presença menor, zonas comerciais | +15% em lavagem de dinheiro e negócios |

- Jogadores podem se candidatar a entrar nelas
- Liderança pode ser disputada internamente:
  - **Eleição**: votação entre membros (1x por rodada, se solicitada por 30%+ dos membros)
  - **Desafio**: combate direto com o líder (PvP, requer nível 9+)
- Se nenhum jogador estiver na liderança, a facção é controlada por NPCs (com IA básica)

### 10.2 Facções Criadas por Jogadores

- Requer nível 5 (Soldado) + 50 de Conceito mínimo
- O criador é o **Patrão** (líder)
- Nome e sigla customizáveis (moderados para evitar nomes ofensivos)
- Começam sem território e sem bônus temático
- Ganham bônus ao atingir marcos (10 membros, primeira favela, etc.)
- Podem ser dissolvidas se:
  - Ficarem sem membros ativos por 7 dias reais
  - Patrão for preso por mais de 10 dias de jogo sem substituto

### 10.3 Hierarquia da Facção

| Cargo | Permissões | Limite por Facção |
|---|---|---|
| **Patrão** | Tudo: promover, expulsar, declarar guerra, negociar com PM, gerenciar finanças, julgar tribunal | 1 |
| **General** | Declarar guerra, coordenar ataques, promover até Gerente, acessar finanças | 2 |
| **Gerente** | Gerenciar território, organizar bailes, recrutar membros | 5 |
| **Vapor** | Coordenar vendas, acessar banco da facção (depósito) | 10 |
| **Soldado** | Participar de crimes de facção, defender território | Ilimitado |
| **Cria** | Participar de atividades básicas, sem acesso a finanças | Ilimitado |

### 10.4 Banco da Facção

- Membros doam dinheiro, drogas e itens
- Doações geram **pontos de facção** (proporcionais ao valor doado)
- Pontos de facção desbloqueiam upgrades coletivos:

| Upgrade | Pontos Necessários | Efeito |
|---|---|---|
| Mula de Drogas Nível 1 | 5.000 | Entrega 1.000 unidades de droga a cada 10 dias de jogo |
| Mula de Drogas Nível 2 | 20.000 | Entrega 10.000 unidades |
| Mula de Drogas Nível 3 | 100.000 | Entrega 100.000 unidades |
| Mula de Drogas Nível MAX | 500.000 | Entrega 250.000.000 unidades |
| Bônus de Atributos +5% | 10.000 | +5% em todos os atributos para membros |
| Bônus de Atributos +10% | 50.000 | +10% em todos os atributos para membros |
| Arsenal Exclusivo | 30.000 | Acesso a armas especiais da facção |
| Exército Expandido | 25.000 | +50% capacidade de soldados em territórios |
| QG Fortificado | 40.000 | Sede da facção com defesa extra |

### 10.5 Pontuação da Facção

A facção ganha pontos por **toda atividade criminosa** de seus membros:
- Crimes bem-sucedidos (solo e coletivos)
- Venda de armas/coletes no Mercado Negro
- Venda de drogas (todos os canais)
- Cafetinagem (lucro com GPs)
- Domínio territorial (renda de favelas)
- Vitórias em guerras
- Lavagem de dinheiro
- Atividades no Mercado Negro

O ranking de facção é separado do ranking individual.

---

## 11. Sistema Territorial (Favelas)

### 11.1 Conceito de Favela

Cada **favela** é uma região territorial do mapa com:
- Nome real (Rocinha, Complexo do Alemão, Cidade de Deus, Jacarezinho, etc.)
- Número de **moradores** (NPCs) — determina potencial de receita
- Nível de dificuldade para conquistar (baseado na localização e tamanho)
- Recursos e atividades disponíveis
- Infraestrutura (afeta quais serviços podem ser instalados)

**Regra fundamental:** favelas mais populosas = mais dinheiro, mas mais difíceis de manter (mais moradores insatisfeitos, PM cobra mais propina, rivais cobiçam mais).

### 11.2 Bônus de Domínio Regional

Se uma **única facção** dominar **todas as favelas de uma região**, recebe um **Bônus de Domínio Regional**:

| Região | Bônus de Domínio |
|---|---|
| Zona Sul | +25% em todas as receitas das favelas da região |
| Zona Norte | +20% em todas as receitas + +10% produção de drogas |
| Centro | +20% em todas as receitas + +15% lavagem de dinheiro |
| Zona Oeste | +20% em todas as receitas + +15% serviços de favela |
| Zona Sudoeste | +25% em todas as receitas + +10% negócios legítimos |
| Baixada | +15% em todas as receitas + -20% custo de manutenção |

O bônus é **perdido imediatamente** se qualquer favela da região for tomada por outra facção ou pelo Estado.

### 11.3 Conquista de Favela

Disponível a partir do nível 8 (Dono da Boca).

Para conquistar uma favela:
1. A facção (Patrão ou General) declara intenção de invasão
2. É necessário derrotar o **boss local**:
   - Se a favela é neutra: boss é um NPC (poder fixo baseado na dificuldade da favela)
   - Se a favela pertence a outra facção: → **Guerra de Facção** (ver seção 11.9)
3. Combate envolve poder combinado dos membros presentes fisicamente no mapa
4. Se vitoriosa, a facção assume o controle
5. Primeiras 24 horas de jogo: período de estabilização (receita reduzida em 50%)

### 11.4 Serviços da Favela

Ao dominar uma favela, a facção pode impor serviços monopolizados aos moradores:

| Serviço | Descrição | Receita Base/Dia por Morador | Investimento Inicial |
|---|---|---|---|
| **GatoNet** | Internet/TV clandestina | $500 | $50.000 |
| **TVGato** | TV a cabo pirata | $300 | $30.000 |
| **Botijão de Gás** | Monopólio de gás na região | $400 | $40.000 |
| **Mototáxi** | Transporte monopolizado | $350 | $35.000 |
| **Van** | Transporte alternativo | $450 | $45.000 |
| **Comércio Local** | Taxa sobre comércio da região | $600 | $60.000 |

**Cálculo de receita real:**
```
Receita = (Base × Moradores) × Multiplicador_Satisfação × Multiplicador_Regional × Bônus_Facção
```

- Receita depositada automaticamente no banco da facção
- Cada serviço requer investimento inicial para ser instalado
- Serviços podem ser upgradados (aumenta receita, aumenta satisfação)
- Serviços danificados em guerras/incursões precisam ser reparados

### 11.5 Satisfação dos Moradores

Cada favela tem um índice de **Satisfação** de 0% a 100%. Inicia em 50% ao ser conquistada.

**Aumenta com:**
- Baile funk bem-sucedido (+10-20%)
- Preços baixos nos serviços (+1% por dia se preços < média)
- Presença de soldados — sensação de segurança (+0,5% por soldado/dia, máx +5%)
- Tempo sem incursão policial (+1% por dia pacífico)
- Melhoria/upgrade de serviços (+5% por upgrade)
- Julgamentos justos no Tribunal do Tráfico (+2-10% dependendo do caso)
- Investimento em infraestrutura (+1-3%)

**Diminui com:**
- Guerras na região (-10% por guerra)
- Incursões policiais (-5 a -15%)
- Falta de serviços (-2% por dia sem serviço ativo)
- Preços abusivos nos serviços (-1% por dia se preços > média)
- Mortes de moradores em fogo cruzado (-5% por morte)
- Ausência de soldados (-1% por dia)
- Julgamentos injustos no Tribunal do Tráfico (-5 a -20%)
- Facção cobrando taxa excessiva (-2% por dia)

**Efeitos da satisfação:**

| Faixa | Multiplicador de Receita | Risco de X9 | Efeitos Extras |
|---|---|---|---|
| 80-100% | 1.20 (+20%) | 5% por dia | Moradores colaboram, denunciam invasores |
| 60-79% | 1.00 (normal) | 15% por dia | Neutro |
| 40-59% | 0.80 (-20%) | 30% por dia | Moradores relutantes |
| 20-39% | 0.50 (-50%) | 50% por dia | Moradores fogem (-2% população/dia) |
| 0-19% | 0.20 (-80%) | 75% por dia | Êxodo massivo (-5% população/dia), PM pressiona |

### 11.6 X9 (Delação)

Evento aleatório verificado **1x por dia de jogo** por favela. A probabilidade depende da satisfação.

**Quando um X9 ocorre:**

1. Um morador delata a facção para a PM (notificação ao líder)
2. **Período de aviso**: 2-4 horas de jogo antes da incursão (tempo para preparar)
3. **Incursão policial** acontece:
   - Perda de armas (10-30% do estoque da favela)
   - Perda de drogas (20-50% do estoque)
   - Perda de dinheiro (5-15% do caixa da favela)
   - **1-3 soldados são presos** aleatoriamente
   - Satisfação cai -10%
4. **Pós-incursão — Desenrolo para liberar soldados:**
   - Custo: dinheiro + conceito da facção
   - Sucesso depende do **Carisma** do negociador (Patrão, General ou Político da facção)
   - Desconto de até 50% com Carisma alto
   - Se falhar: soldado fica preso por 1-3 dias de jogo
   - Se não negociar: soldado fica preso por 5 dias de jogo

### 11.7 Propina para PM (Arrego)

Toda favela conquistada exige pagamento de **propina (arrego)** à Polícia Militar. É o custo de "permissão" para operar.

**Fluxo de negociação:**
1. Ao conquistar a favela, PM envia cobrança em até 1 dia de jogo
2. **Valor base**: proporcional a (moradores × riqueza da região)
3. O Patrão/General pode negociar desconto:
   - Sucesso depende de: **Carisma** + **nível de Conceito** + vocação **Político** (bônus)
   - Pode conseguir desconto de até 40% do valor base
   - Negociação acontece 1x — resultado é final para aquele período
4. Se aceitar: propina é paga **a cada 5 dias de jogo** automaticamente do banco da facção
5. Se não tiver dinheiro para pagar no dia: inadimplência

**Valores de referência (propina por período de 5 dias de jogo):**

| Região | Propina Base (por morador) |
|---|---|
| Zona Sul | $800/morador |
| Zona Norte | $400/morador |
| Centro | $600/morador |
| Zona Oeste | $500/morador |
| Zona Sudoeste | $700/morador |
| Baixada | $300/morador |

**Consequências de inadimplência/recusa:**
- **Dias 1-3 sem pagar**: PM começa incursões "de aviso" (-20% receita)
- **Dias 4-6 sem pagar**: Incursões intensificam (-50% receita, soldados presos)
- **Dia 7+ sem pagar**: PM **toma a favela** da facção
  - Favela fica sob **domínio do Estado** por 3-7 dias de jogo
  - Durante esse período, nenhuma facção pode operar
  - Após o período, volta a estar neutra e disponível para conquista
  - A facção que perdeu não pode reconquistá-la por mais 3 dias (cooldown)

### 11.8 Baile na Favela

Evento especial que a facção pode organizar **1x a cada 3 dias de jogo por favela**. Nível 8+ necessário.

**Mecânica:**
1. Facção anuncia o baile (custo de organização: $10.000 a $100.000 dependendo da favela)
2. Preparo: definir quais drogas disponibilizar, preço de entrada, MC convidado
3. O resultado depende da **Satisfação dos Moradores**:

| Satisfação | Resultado | Efeitos |
|---|---|---|
| > 70% | **Sucesso total** | Venda de drogas +300%, satisfação +20%, conceito da facção +500, estamina +30% para todos presentes |
| 50-70% | **Sucesso** | Venda de drogas +200%, satisfação +15%, conceito +300, estamina +20% |
| 30-49% | **Resultado misto** | Venda normal, satisfação +5%, algum incidente menor |
| < 30% | **Fracasso** | Prejuízo financeiro, satisfação -10%, chance de briga/tiro/PM aparecer, conceito -200 |

### 11.9 Guerra de Facção

Quando uma facção ataca território de outra. Disponível nível 9 (Líder da Facção) para declarar.

**Fluxo completo:**

1. **Declaração de guerra**: Patrão ou General declara ataque a uma favela rival (custo: $50.000 da facção)
2. **Período de preparação**: 6 horas de jogo (1,5h real) para ambos os lados:
   - Convocar membros
   - Posicionar soldados
   - Estocar suprimentos
   - Formar alianças
3. **Combate** (dura 2-4 horas de jogo):
   - Poder dos atacantes vs. poder dos defensores + soldados + bônus de terreno
   - Vários rounds automáticos com resultados parciais reportados
   - Membros podem cair (hospitalização, prisão)
   - Dano a propriedades na favela
4. **Resultado**:
   - **Vitória do atacante**: conquista a favela, pega 30% do estoque, ganha conceito massivo
   - **Vitória do defensor**: mantém território, ganha conceito, 20% do armamento dos atacantes
   - **Empate**: ninguém conquista, ambos perdem recursos e membros
5. **Cooldown**: 7 dias de jogo antes de poder atacar a mesma facção novamente
6. **Satisfação**: moradores perdem -10 a -20% satisfação independente do resultado

---

## 12. Tribunal do Tráfico

### 12.1 Conceito

Evento aleatório exclusivo de favelas dominadas. Um morador da favela denuncia outro morador ao "tribunal" da facção. O líder da facção (ou General) deve julgar o caso.

Este é um sistema de **dilema moral com consequências mecânicas**: cada decisão afeta a **moral dos moradores** e/ou a **moral da facção**, e o jogador deve equilibrar ambas.

### 12.2 Frequência

- Ocorre aleatoriamente: 1x a cada 2-5 dias de jogo por favela
- Favelas maiores (mais moradores) geram mais tribunais
- Satisfação baixa aumenta a frequência (moradores mais conflituosos)

### 12.3 Tipos de Casos

Cada caso é gerado aleatoriamente com dois lados (acusador e acusado), cada um com seu nível de carisma na comunidade.

| Caso | Descrição | Gravidade |
|---|---|---|
| **Roubo entre moradores** | Morador roubou pertences de outro morador dentro da favela | Média |
| **Talaricagem** | Morador se envolveu com a esposa/marido de outro morador | Média |
| **Dívida de jogo** | Morador fez dívida em jogo de azar e não pagou a outro morador | Baixa-Média |
| **Dívida de drogas** | Morador comprou droga fiado e não pagou à facção | Média-Alta |
| **Estupro** | Morador estuprou moradora da favela | Muito Alta |
| **Agressão** | Morador agrediu fisicamente outro morador | Média |
| **Homicídio não autorizado** | Morador matou outro morador sem permissão da facção | Muito Alta |

### 12.4 Mecânica do Julgamento

**Fase 1 — Apresentação:**
- Cada lado apresenta sua versão (texto gerado pelo jogo com detalhes do caso)
- Cada lado tem um **Carisma na Comunidade** (valor oculto que representa quanto a comunidade confia naquela pessoa)
- Cada lado tem um **Carisma na Facção** (valor oculto que representa a relação com membros da facção)

**Fase 2 — O Antigão:**
Um NPC especial chamado **"Antigão"** (morador antigo e respeitado da favela) sempre intercede antes da decisão. Ele:
- Dá sua opinião sobre o caso (baseada na verdade — nem sempre o acusador tem razão)
- Sugere uma punição compatível
- **Revela dicas sobre o impacto** de cada escolha na moral dos moradores e da facção
- Funciona como um "conselheiro" que ajuda o jogador a tomar decisões informadas

O Antigão **não decide** — apenas aconselha. A decisão é sempre do jogador.

**Fase 3 — Punições Disponíveis:**

| Punição | Descrição | Impacto na Moral dos Moradores | Impacto na Moral da Facção |
|---|---|---|---|
| **Liberar com aviso** | Apenas conversa e aviso verbal | Depende do caso* | Facção pode ver como fraqueza |
| **Dar uma surra** | Punição física moderada | Depende do caso* | Neutro a positivo |
| **Expulsar da favela** | Banido de morar na favela | Depende do caso* | Neutro |
| **Matar** | Execução | Depende do caso* | Mostra autoridade |
| **Esquartejar** | Execução brutal + exposição | Depende do caso* | Intimida, mostra poder máximo |
| **Queimar no pneu** | Execução pública extrema | Depende do caso* | Máxima intimidação |

*O impacto depende da gravidade do caso e de qual lado a comunidade apoia:

### 12.5 Tabela de Impactos Detalhada

**Caso: Roubo entre moradores**

| Punição | Se Comunidade Apoia o Acusador | Se Comunidade Apoia o Acusado |
|---|---|---|
| Liberar com aviso | Moradores: -5%, Facção: -2% | Moradores: +2%, Facção: -5% |
| Surra | Moradores: +3%, Facção: 0% | Moradores: -3%, Facção: +2% |
| Expulsar | Moradores: +5%, Facção: +2% | Moradores: -8%, Facção: +3% |
| Matar | Moradores: -5%, Facção: +5% | Moradores: -15%, Facção: +5% |
| Esquartejar | Moradores: -15%, Facção: +5% | Moradores: -25%, Facção: +3% |
| Queimar no pneu | Moradores: -20%, Facção: +3% | Moradores: -30%, Facção: +2% |

**Caso: Talaricagem**

| Punição | Se Comunidade Apoia o Acusador | Se Comunidade Apoia o Acusado |
|---|---|---|
| Liberar com aviso | Moradores: -8%, Facção: -5% | Moradores: +3%, Facção: -3% |
| Surra | Moradores: +5%, Facção: +2% | Moradores: -5%, Facção: +2% |
| Expulsar | Moradores: +8%, Facção: +3% | Moradores: -5%, Facção: +3% |
| Matar | Moradores: -3%, Facção: +5% | Moradores: -20%, Facção: +3% |
| Esquartejar | Moradores: -15%, Facção: +5% | Moradores: -30%, Facção: +2% |
| Queimar no pneu | Moradores: -20%, Facção: +3% | Moradores: -35%, Facção: 0% |

**Caso: Dívida de jogo**

| Punição | Se Comunidade Apoia o Acusador | Se Comunidade Apoia o Acusado |
|---|---|---|
| Liberar com aviso | Moradores: -3%, Facção: -3% | Moradores: +2%, Facção: -5% |
| Surra | Moradores: +2%, Facção: +2% | Moradores: -2%, Facção: +3% |
| Expulsar | Moradores: +3%, Facção: +3% | Moradores: -5%, Facção: +3% |
| Matar | Moradores: -10%, Facção: +3% | Moradores: -20%, Facção: +2% |
| Esquartejar | Moradores: -20%, Facção: +3% | Moradores: -30%, Facção: 0% |
| Queimar no pneu | Moradores: -25%, Facção: 0% | Moradores: -35%, Facção: -2% |

**Caso: Dívida de drogas com a facção**

| Punição | Se Comunidade Apoia o Acusador (facção) | Se Comunidade Apoia o Acusado |
|---|---|---|
| Liberar com aviso | Moradores: 0%, Facção: -10% | Moradores: +3%, Facção: -15% |
| Surra | Moradores: -2%, Facção: +5% | Moradores: -5%, Facção: +5% |
| Expulsar | Moradores: -3%, Facção: +5% | Moradores: -8%, Facção: +5% |
| Matar | Moradores: -8%, Facção: +10% | Moradores: -15%, Facção: +8% |
| Esquartejar | Moradores: -15%, Facção: +10% | Moradores: -25%, Facção: +5% |
| Queimar no pneu | Moradores: -20%, Facção: +8% | Moradores: -30%, Facção: +3% |

**Caso: Estupro**

| Punição | Se Comunidade Apoia o Acusador | Se Comunidade Apoia o Acusado (alega inocência) |
|---|---|---|
| Liberar com aviso | Moradores: -25%, Facção: -15% | Moradores: +5%, Facção: -10% |
| Surra | Moradores: -10%, Facção: -5% | Moradores: -3%, Facção: 0% |
| Expulsar | Moradores: +5%, Facção: 0% | Moradores: -5%, Facção: +2% |
| Matar | Moradores: +10%, Facção: +5% | Moradores: -10%, Facção: +5% |
| Esquartejar | Moradores: +8%, Facção: +5% | Moradores: -15%, Facção: +5% |
| Queimar no pneu | Moradores: +10%, Facção: +3% | Moradores: -20%, Facção: +3% |

**Caso: Agressão**

| Punição | Se Comunidade Apoia o Acusador | Se Comunidade Apoia o Acusado |
|---|---|---|
| Liberar com aviso | Moradores: -5%, Facção: -3% | Moradores: +2%, Facção: -3% |
| Surra | Moradores: +3%, Facção: +2% | Moradores: -3%, Facção: +2% |
| Expulsar | Moradores: +5%, Facção: +2% | Moradores: -5%, Facção: +2% |
| Matar | Moradores: -8%, Facção: +5% | Moradores: -15%, Facção: +3% |
| Esquartejar | Moradores: -18%, Facção: +5% | Moradores: -25%, Facção: +2% |
| Queimar no pneu | Moradores: -22%, Facção: +3% | Moradores: -30%, Facção: 0% |

**Caso: Homicídio não autorizado**

| Punição | Se Comunidade Apoia o Acusador | Se Comunidade Apoia o Acusado (alega defesa) |
|---|---|---|
| Liberar com aviso | Moradores: -20%, Facção: -15% | Moradores: +3%, Facção: -20% |
| Surra | Moradores: -5%, Facção: -5% | Moradores: -2%, Facção: -3% |
| Expulsar | Moradores: +3%, Facção: 0% | Moradores: -5%, Facção: 0% |
| Matar | Moradores: +8%, Facção: +8% | Moradores: -5%, Facção: +5% |
| Esquartejar | Moradores: +5%, Facção: +10% | Moradores: -10%, Facção: +8% |
| Queimar no pneu | Moradores: +3%, Facção: +10% | Moradores: -15%, Facção: +5% |

### 12.6 O Papel do Antigão

O Antigão revela informações cruciais antes da decisão:
- "A comunidade tá do lado do(a) [acusador/acusado]..." — indica qual lado a comunidade apoia
- "Se tu liberar esse aí, os crias vão achar que tá amolecendo..." — indica impacto negativo na facção
- "Essa daí o pessoal não vai perdoar se tu pegar leve..." — indica que comunidade quer punição dura
- "Toma cuidado, esse moleque tem muito parente aqui dentro..." — indica que punição severa vai reduzir moral dos moradores
- "Esse caso aí é sério, os moradores tão de olho..." — indica que a decisão terá alto impacto

### 12.7 Conceito Ganho/Perdido

O jogador ganha ou perde Conceito pessoal baseado na percepção geral:
- Se a decisão for vista como **justa** pela maioria (moradores + facção): +50 a +200 Conceito
- Se for vista como **injusta**: -50 a -200 Conceito
- Se for vista como **covarde** (liberar crimes graves): -100 a -300 Conceito
- Se for vista como **brutal desnecessariamente**: -50 a -150 Conceito (mas +intimidação)

---

## 13. Combate PvP

### 13.1 Porrada (1v1)

- Jogador ataca outro jogador diretamente (precisa estar na mesma região do mapa)
- Custo: 20% estamina
- Nível mínimo: 3 (Fogueteiro)
- Fórmula de poder:
  ```
  Poder = Força + (Resistência / 2) + Arma + Colete + Bônus de Vocação(Soldado: +10%)
  ```
- Se o atacante tiver **2x o poder** do defensor: **mata o alvo** (hospitalização)
- Recompensa: ~5% dos atributos do perdedor (ganho para o vencedor)
- Matar jogador: conceito + chance de dropar itens + dinheiro que a vítima carrega

### 13.2 Emboscada (Facção vs. Jogador)

- Grupo de 2-5 membros da facção ataca um jogador
- Poder combinado vs. poder individual
- Maior chance de matar, mas divide a recompensa
- Custo: 15% estamina por membro (desconto por grupo)
- Conceito do grupo é dividido igualmente

### 13.3 Assassinato por Encomenda

Disponível a partir do nível 7 (Frente).

- Jogadores podem colocar **contrato** na cabeça de outro jogador
- Custo: valor da recompensa + 10% de taxa
- Qualquer jogador nível 5+ pode aceitar o contrato
- Recompensa em dinheiro ao completar + conceito
- O alvo **não sabe** que tem contrato (a menos que tenha informantes — parceiros com nível 7+ podem avisá-lo)
- Se o assassino falhar: alvo é notificado e pode contra-atacar

---

## 14. Prisão

### 14.1 Como é Preso

- Falhar em crimes (probabilidade baseada na dificuldade do crime)
- Ser pego em incursão policial na favela
- Matar muitos jogadores em sequência (calor da polícia)
- Ser delatado (X9 de favela pode prender membros)
- Overdose em local público (recolhido pela PM)
- Perder combate PvP drasticamente (PM encontra inconsciente)

### 14.2 Calor da Polícia

Mecânica invisível que mede o quanto a polícia está de olho no jogador:
- Cada crime aumenta o "calor" um pouco
- Crimes em sequência sem descanso acumulam calor rapidamente
- Matar jogadores gera muito calor
- Calor diminui com o tempo (inatividade criminal)
- Calor alto: chance de prisão mesmo em crimes fáceis

### 14.3 Tempo de Prisão

| Motivo | Tempo Base (horas de jogo) |
|---|---|
| Crime leve falho | 2-4h |
| Crime médio falho | 4-8h |
| Crime pesado falho | 8-12h |
| Incursão policial | 4-6h |
| Homicídio (PvP) | 6-10h |
| Múltiplos homicídios | 12-24h |

- Reduzido com bom Carisma (-10% por 100 pontos de Carisma)
- Com Plano de Saúde: -50% no tempo

### 14.4 Sair da Prisão

| Método | Custo | Tempo | Observação |
|---|---|---|---|
| Esperar | Grátis | Total da pena | Sem ação possível |
| Suborno | Conceito × $500 | Imediato | Depende do Carisma para aceitar |
| Fiança | 10 créditos | Imediato | Sempre funciona (premium) |
| Fuga | 0 | Variável | Minigame: sucesso = livre, falha = +50% tempo |
| Resgate da facção | $50.000+ da facção | 1-2h de jogo | Facção organiza operação, risco para participantes |

### 14.5 Efeitos da Prisão

- Perde conceito (-5% a -15% dependendo do motivo)
- Não pode executar nenhuma atividade
- Propriedades ficam vulneráveis (sem gestão ativa, sem coleta de renda)
- Facção perde poder enquanto membros estão presos
- Soldados contratados continuam cobrando salário
- Fábricas continuam produzindo (mas sem vender/coletar)

---

## 15. Hospital

### 15.1 Serviços

| Serviço | Efeito | Custo |
|---|---|---|
| **Tratamento** | Cura HP após combate/hospitalização | $500 por 10% HP |
| **Desintoxicação** | Remove tolerância e vício de drogas | Conceito × $100 ou Metadona |
| **Cirurgia Plástica** | Muda aparência/nickname | 5 créditos |
| **Compra de Stats** | Consumíveis que aumentam atributos permanentes | Varia (caro) |
| **Tratamento de DST** | Remove DSTs contraídas com GPs | $5.000 |
| **Plano de Saúde** | Reduz hospitalização de 12h para 15min de jogo | 10 créditos/rodada |

### 15.2 Consumíveis de Stat (Hospital)

Itens comprados no hospital que dão **aumento permanente** de atributos. Caros e com limites de compra por rodada.

| Item | Efeito | Preço | Limite/Rodada |
|---|---|---|---|
| Cerebrina | +100 Inteligência permanente | $50.000 | 5 |
| Poção do Carisma | +100 Carisma permanente | $50.000 | 5 |
| Creatina | +100 Resistência permanente | $40.000 | 5 |
| Deca-Durabolin | +150 Força permanente (mas -30 Inteligência) | $30.000 | 5 |

---

## 16. Locais do Mapa

O mapa isométrico do Rio de Janeiro inclui os seguintes tipos de locais:

### 16.1 Locais Fixos (sempre presentes)

Presentes em todas as regiões do mapa:
- **Hospital** — cura, desintox, cirurgia, consumíveis de stat
- **Delegacia/Presídio** — onde jogadores presos ficam, pagamento de fiança
- **Mercado Negro** — compra/venda de armas, coletes, drogas, itens, reparo
- **Porto/Docas** — venda de drogas em larga escala quando navio atraca (apenas Centro)
- **Banco** — guardar dinheiro (protege de apreensão), rende juros
- **Banca do Bicho** — apostas no jogo do bicho
- **Centro de Treino** — academia para treinar atributos
- **Universidade do Crime** — cursos de especialização (apenas 1, no Centro)
- **Tribunal** — onde se paga fiança e se resolve questões legais
- **Ponto de Mototáxi** — transporte rápido entre regiões do mapa
- **Bar/Boteco** — local social, maquininhas de caça-níquel, informações

### 16.2 Locais de Jogadores (criados/comprados)

- **Boca de Fumo** — venda de drogas
- **Fábrica** — produção de drogas
- **Puteiro** — casa de GPs
- **Rave** — casa noturna com drogas
- **Baile Funk** — evento em favela dominada
- **Loja de Fachada** — lavagem de dinheiro
- **Casa/Barraco/Mansão** — moradia do jogador
- **QG da Facção** — sede operacional da facção
- **Maquininha de Caça-Níquel** — negócio de jogos de azar

### 16.3 Regiões do Rio de Janeiro

O mapa é dividido em 6 grandes regiões, cada uma com características socioeconômicas definidas:

---

**Zona Sul** — *Muito rica, densamente povoada*
- Favelas: Rocinha, Vidigal, Santa Marta, Cantagalo, Pavão-Pavãozinho, Chapéu Mangueira, Babilônia
- Bairros: Copacabana, Ipanema, Leblon, Botafogo, Leme, Gávea, Lagoa
- **Características**:
  - Crimes de alta recompensa (turistas ricos, joalherias, carros de luxo)
  - GPs premium (maior lucro)
  - Imóveis caríssimos (coberturas, mansões)
  - PM mais presente (mais propina, mais blitz)
  - Favelas menores porém muito lucrativas
  - Mercado Negro com itens raros

---

**Zona Norte** — *Pobre, densamente povoada*
- Favelas: Complexo do Alemão, Jacarezinho, Mangueira, Maré, Complexo da Penha, Manguinhos, Cidade Alta, Juramento
- Bairros: Méier, Madureira, Tijuca, São Cristóvão, Benfica, Penha
- **Características**:
  - Maior concentração de favelas grandes (muitos moradores)
  - Tráfico pesado — fábricas produzem mais, venda em volume
  - Custo de operação médio
  - Muitas disputas territoriais (região mais violenta)
  - Bailes funk com maior público
  - Recrutamento fácil de soldados (mão de obra barata)

---

**Centro** — *Renda média, povoação média*
- Favelas: Morro da Providência, Santo Cristo, Morro do Pinto
- Bairros: Lapa, Centro, Praça Mauá, Saúde, Gamboa
- **Características**:
  - Hub comercial — Mercado Negro principal fica aqui
  - Porto/Docas — venda massiva de drogas quando navio atraca
  - Lavagem de dinheiro é mais eficiente (+10% retorno)
  - Maquininhas de caça-níquel rendem mais (fluxo de pessoas)
  - Universidade do Crime (única)
  - Poucos territórios mas altamente estratégicos

---

**Zona Oeste** — *Renda média, pouco povoada*
- Favelas: Cidade de Deus, Muzema, Gardênia Azul, Rio das Pedras, Cesarão
- Bairros: Campo Grande, Santa Cruz, Bangu, Jacarepaguá, Recreio
- **Características**:
  - Território clássico de milícia
  - Serviços de favela rendem mais (+15% GatoNet, Mototáxi, etc.)
  - Região extensa — mototáxi essencial para se mover
  - Menos PM (propina mais barata)
  - Ideal para fábricas escondidas
  - Imóveis baratos, bom para começar

---

**Zona Sudoeste** — *Rica, povoação média*
- Favelas: Vila Kennedy, Vila Aliança, Antares
- Bairros: Barra da Tijuca, Recreio dos Bandeirantes, Itanhangá, São Conrado
- **Características**:
  - Área nobre com condomínios de luxo
  - Crimes de alto valor (sequestros, roubos a condomínio)
  - Lavagem de dinheiro premium (empresas fantasma, construtoras)
  - Poucos territórios de favela, mas alto valor
  - Mercado imobiliário caro (mansões)
  - Menos violenta, mais estratégica

---

**Baixada Fluminense** — *Muito pobre, povoação média*
- Favelas: Diversos morros e comunidades (Caxias, São João, Belford Roxo, Nova Iguaçu)
- Bairros: Duque de Caxias, São João de Meriti, Belford Roxo, Nova Iguaçu, Nilópolis
- **Características**:
  - Custo de operação mais barato (-20% em tudo)
  - Favelas mais fáceis de conquistar (boss NPCs mais fracos)
  - PM menos organizada (propina mais barata, menos incursões)
  - Mão de obra muito barata para soldados
  - Ideal para facções iniciantes construírem poder
  - Menos recompensa por crime, mas volume compensa

---

**Niterói** *(expansão futura)*
- Acesso via barca (tempo de travessia: 1 hora de jogo)
- Território de disputa entre facções estabelecidas
- Mecânicas exclusivas planejadas

---

## 17. Eventos do Jogo

Eventos são ocorrências periódicas que afetam a gameplay de toda a cidade ou regiões específicas.

### 17.1 Eventos Programados

| Evento | Frequência | Efeito |
|---|---|---|
| **Navio nas Docas** | A cada 3-5 dias de jogo | Compra ilimitada de drogas por 50% a mais no Porto |
| **Baile Funk da Cidade** | A cada 7 dias de jogo | Todas as raves/bailes faturam 3x, satisfação +5% em todas favelas |
| **Carnaval** | 1x por rodada (7 dias de jogo) | Turistas no mapa, crimes na Z.Sul rendem 2x, GPs rendem 3x, PM distraída |
| **Ano Novo em Copa** | 1x por rodada (3 dias de jogo) | Similar ao Carnaval, focado em Z.Sul e Centro |

### 17.2 Eventos Aleatórios

| Evento | Probabilidade | Efeito |
|---|---|---|
| **Operação Policial** | 15%/dia de jogo | Incursão massiva em favela aleatória (pior que X9 normal) |
| **Blitz da PM** | 20%/dia | Jogadores em certas áreas podem ser presos aleatoriamente |
| **Seca de Drogas** | 10%/dia | Preço das drogas sobe 50% por 2 dias de jogo |
| **Delação Premiada** | 5%/dia | NPC delata múltiplas facções, risco de apreensão generalizado |
| **Saidinha de Natal** | 3%/dia | Todos os jogadores presos são liberados |
| **Inspeção Trabalhista** | 10%/dia | Produção de fábricas +20% por 1 dia (moradores trabalham mais) |
| **Bonecas da China** | 8%/dia | GPs rendem 2x por 1 dia (novidades no mercado) |
| **Ressaca do Baile** | 8%/dia | GPs rendem 50% por 1 dia (morador sem dinheiro pós-baile) |
| **Tribunal do Tráfico** | Variável | Julgamento na favela (ver seção 12) |
| **Chuva de Verão** | 15%/dia | Movimentação no mapa mais lenta, crimes de rua -30%, fábricas normais |
| **Operação Verão** | Sazonal | PM reforçada na Z.Sul, crimes mais arriscados mas mais lucrativos |

---

## 18. Economia

### 18.1 Moedas

| Moeda | Tipo | Uso |
|---|---|---|
| **Dinheiro ($)** | In-game, farmável | Tudo: armas, drogas, propriedades, soldados, propina |
| **Créditos** | Premium (compra real ou achievements) | Cosméticos, conveniência, fiança instantânea |

### 18.2 Fluxo Econômico

**Fontes de renda (da menor para a maior no late-game):**
- Crimes solo (principal no early game)
- Tráfico de drogas (rua, boca)
- Maquininhas de caça-níquel
- Crimes de facção
- Venda de drogas nas Docas
- Puteiros (GPs)
- Raves/Bailes
- Serviços de favela (GatoNet, Van, etc.) — **maior fonte no late-game**
- Lavagem de dinheiro (retorno sobre investimento)

**Drenos de dinheiro (mantém equilíbrio econômico):**
- Compra e reparo de armas/coletes
- Salário de soldados (custo diário constante)
- Manutenção de fábricas
- Propina para PM (custo periódico pesado)
- Organização de bailes
- Desintoxicação no hospital
- Tratamento no hospital
- Treinos
- Compra de propriedades e upgrades
- Prejuízo em crimes falhos
- Suborno para sair da prisão
- Investimento em lavagem (risco de perda)
- Taxa do Mercado Negro (5%)

### 18.3 Banco

- Dinheiro no banco é protegido de:
  - Apreensão policial
  - Roubo em combate PvP
  - Perda por morte
- Rende juros diários: **1% ao dia de jogo** (sobre saldo)
- Limite de depósito diário: $500.000 (aumenta com nível)
- Dinheiro no bolso é vulnerável a tudo acima
- O banco cobra taxa de saque: 0,5% (simula taxas bancárias)

### 18.4 Inflação e Balanceamento

- Preços de NPCs (hospital, treino) escalam com o dia da rodada
- Nas últimas semanas da rodada, tudo fica mais caro (late-game mais competitivo)
- Novos jogadores têm "proteção de novato": 3 dias de jogo sem poder ser atacado por PvP

---

## 19. Sistema Social

### 19.1 Chat

| Tipo | Alcance | Desbloqueio |
|---|---|---|
| **Global** | Todos os jogadores online | Nível 1 |
| **Local** | Jogadores na mesma região do mapa | Nível 1 |
| **Facção** | Membros da mesma facção | Ao entrar em facção |
| **Privado** | 1 para 1 (entre contatos) | Nível 2 |
| **Comércio** | Canal dedicado a negociações | Nível 2 |

### 19.2 Lista de Contatos

- **Parceiros** (aliados confirmados) — aparecem em dourado
  - Podem ser convidados para crimes
  - Podem avisá-lo de contratos de assassinato (se nível 7+)
  - Limite: 20 parceiros
- **Conhecidos** (contatos adquiridos) — aparecem em cinza
  - Só mensagens privadas
  - Limite: 100 conhecidos
- Contatos são perdidos em overdose (conhecidos) ou troca de facção (parceiros de facção rival)

### 19.3 Estatísticas Públicas do Jogador

Cada jogador tem um perfil público com:
- Nível e título
- Vocação
- Conceito total
- Facção (se tiver)
- Número de assassinatos (PvP)
- Guerras vencidas
- Favelas conquistadas (atual)
- Maior golpe realizado
- Tempo como líder de facção
- Tempo jogado na rodada

---

## 20. Sabotagem

Jogadores podem destruir propriedades rivais. Disponível a partir do nível 5 (Soldado).

- Custo: 40% estamina + 20 nervos
- Pode destruir: bocas, fábricas, puteiros, raves, maquininhas
- Não gera lucro direto, apenas prejudica o rival
- Sucesso depende de: poder do atacante vs. poder dos soldados que guardam a propriedade
- Risco de prisão se falhar
- Risco de retaliação (o dono é notificado, mas não sabe quem sabotou se o atacante tiver sucesso)
- Pode gerar guerra de facção se o alvo for membro de uma
- Propriedade destruída precisa ser reconstruída (custo = 50% do valor original)

---

## 21. Monetização (Modelo Free-to-Play)

### 21.1 Princípio

O jogo é **free-to-play** com monetização cosmética e de conveniência. **Não é pay-to-win.** Nenhum item premium dá vantagem direta em combate ou nos crimes.

### 21.2 O que Créditos Compram

- Skins e roupas exclusivas (cosméticas)
- Fiança instantânea (conveniência)
- Mudança de vocação (sem esperar)
- Cirurgia plástica (mudar nome/aparência)
- Plano de saúde (reduz hospitalização)
- Emotes e efeitos visuais
- Expansão de inventário (+20 slots)
- Nomes coloridos no chat
- Moldura de perfil customizada
- Tatuagens exclusivas

### 21.3 O que Créditos NÃO Compram

- Armas ou coletes superiores
- Atributos diretos
- Conceito
- Território
- Vantagem em combate
- Impulsos (apenas farmáveis)
- Soldados mais fortes
- Drogas

### 21.4 Obtenção Gratuita de Créditos

Jogadores free-to-play podem obter créditos limitados:
- 1 crédito por nível alcançado
- 5 créditos por terminar no top 10 da rodada
- 2 créditos por conquista especial (primeira favela, primeira guerra, etc.)
- 1 crédito por semana real de login consecutivo

---

## 22. Anti-Cheat e Regras

### 22.1 Proibições

- Múltiplas contas (1 conta por dispositivo, verificação por device ID)
- Bots/automação de qualquer tipo
- Exploits ou manipulação de bugs
- Comércio de contas por dinheiro real
- Linguagem discriminatória (racismo, homofobia, etc.)
- Compartilhamento de conta

### 22.2 Punições

| Infração | Punição |
|---|---|
| Multi-conta | Ban permanente de todas as contas |
| Bot/automação | Ban permanente |
| Exploit | Ban temporário (7 dias) + reset de stats. Reincidência: permanente |
| Comércio de conta | Ban de ambas as contas |
| Linguagem proibida | 1ª: Mute 24h → 2ª: Ban 7 dias → 3ª: Ban permanente |
| Compartilhamento | Aviso → Ban temporário → Ban permanente |

### 22.3 Proteção de Novatos

- Primeiros 3 dias de jogo: não pode ser atacado em PvP
- Primeiros 3 dias de jogo: não pode ter propriedades sabotadas
- Pode cancelar proteção manualmente se quiser (para poder atacar outros)

---

## 23. Estratégias Avançadas (Meta-Game)

Seção de referência sobre como jogadores experientes otimizam o jogo.

### 23.1 Gerenciamento de Estamina
- Nunca deixar estamina em 100% por muito tempo (é desperdício de regeneração)
- Usar drogas estrategicamente para manter moral alto sem overdose
- Intercalar crimes com tráfico (baixo custo de estamina) para maximizar ganho

### 23.2 Otimização de Drogas
- Rotacionar entre tipos de droga para evitar tolerância alta em uma só
- Crack dá mais estamina mas vicia rápido — usar com moderação
- Maconha é segura mas ineficiente — bom para iniciantes
- Desintoxicar no momento certo (quando tolerância começa a reduzir eficiência significativamente)

### 23.3 Progressão Eficiente
- **Early game** (Pivete-Fogueteiro): focar em crimes solo para ganhar conceito e dinheiro
- **Mid game** (Vapor-Gerente): investir em fábricas e bocas para renda passiva
- **Late game** (Frente-Prefeito): domínio territorial e guerra de facção para receita máxima
- Treinar consistentemente — ganho de atributos é exponencialmente importante

### 23.4 Economia
- Banco cedo: proteger dinheiro de perdas em PvP e prisão
- Diversificar: não depender de uma única fonte de renda
- Investir em lavagem quando tiver capital excedente
- Comprar armas/coletes usados no Mercado Negro (mais barato)

### 23.5 PvP e Facção
- Atacar jogadores vulneráveis (estamina baixa, sem colete, sem facção)
- Nunca atacar sem estamina para fugir se necessário
- Facção forte > jogador forte solo (proteção + renda territorial)
- Político na facção é essencial para negociações de propina e tribunal

---

## 24. Glossário

| Termo do Jogo | Significado |
|---|---|
| **Conceito** | Pontos de respeito/reputação (determina ranking) |
| **Cria** | Jogador iniciante / cargo mais baixo da facção / vocação de rua |
| **Vapor** | Responsável por vender drogas / nível 4 de progressão |
| **Boca** | Ponto fixo de venda de drogas |
| **GP** | Garota de Programa (garota do Job) |
| **X9** | Delator/informante |
| **Desenrolo** | Negociação (geralmente com polícia ou no tribunal) |
| **Baile** | Festa funk na favela |
| **Soldado** | Membro armado que protege território / vocação de combate / nível 5 |
| **Patrão** | Líder da facção |
| **Pivete** | Menor/iniciante no crime / nível 1 |
| **Fogueteiro** | Responsável por alertar sobre invasões (fogos de artifício) / nível 3 |
| **Arrego** | Propina paga à polícia |
| **Bonde** | Grupo de ataque da facção |
| **Antigão** | Morador antigo e respeitado da favela (NPC conselheiro no Tribunal) |
| **PQD** | Paraquedista — nome da escola de combate do Soldado |
| **Talaricagem** | Trair cônjuge de outrem |
| **Calor** | Nível de atenção da polícia sobre o jogador |
| **Mula** | Entregador de drogas (upgrade de facção) |

---

## 25. Referências e Inspiração

- **The Crims** (thecrims.com) — mecânicas base de crimes, gangues, economia, rodadas
- **Tibia** (tibia.com) — visual isométrico, navegação no mapa, mundo persistente, sensação de exploração
- **Age of Empires 1** — estética isométrica retrô
- **GTA San Andreas** — ambientação de gangues e território
- **Cidade de Deus** (filme) — inspiração narrativa e temática
- **Tropa de Elite** (filme) — dinâmica PM vs. facções, propina, incursões
- **Elite Squad / Morro dos Prazeres** — atmosfera de favela, tribunal do tráfico

---

> Este documento é vivo e deve ser atualizado conforme o desenvolvimento avança.
> Última atualização: 2026-03-10
