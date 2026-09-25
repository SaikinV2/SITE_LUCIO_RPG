# SDD - Interface Web Para Ficha De Personagem RPG

## 1. Visao Geral

Este documento descreve o MVP de uma interface web para organizar, consultar e automatizar a ficha de um personagem de RPG. O objetivo inicial e criar uma pagina responsiva, rapida e facil de usar durante a sessao, com foco em atributos, pericias, combate basico, habilidades e rolagens.

O sistema deve permitir que o jogador consulte os dados importantes do personagem sem precisar navegar pela ficha em PDF durante o jogo. Tambem deve automatizar calculos derivados, como modificadores de atributos, bonus de pericias, testes de resistencia e rolagens.

## 2. Objetivos Do MVP

- Centralizar os dados principais do personagem em uma interface web.
- Automatizar os calculos mais usados durante a sessao.
- Permitir consulta rapida de habilidades, recursos e pericias.
- Funcionar bem em desktop, tablet e celular.
- Salvar os dados localmente para uso offline ou sem login.
- Criar uma base tecnica simples para evoluir depois com magias, multiplos personagens e importacao de ficha.

## 3. Escopo Do MVP

### Incluido

- Tela principal do personagem.
- Edicao de dados gerais.
- Atributos com modificadores automaticos.
- Pericias calculadas automaticamente.
- Testes de resistencia calculados automaticamente.
- Area de combate basica.
- Lista de habilidades do personagem.
- Controle de usos de habilidades.
- Rolagem de dados simples.
- Historico recente de rolagens.
- Inventario simples.
- Area de anotacoes.
- Salvamento local no navegador.
- Exportacao e importacao em JSON.

### Planejado Para Fase 2

- Multiplos personagens.
- Importacao automatica do PDF.
- Magias completas com preparacao e espacos.
- Inventario avancado com peso automatico.
- Backup/exportacao completa.
- Sincronizacao opcional por arquivo ou pasta compartilhada.

### Fora Das Fases Iniciais

- Integracao com mesa virtual.
- Sistema de regras totalmente customizavel.

## 4. Personas E Contexto De Uso

### Jogador

Usa a interface durante a sessao para consultar atributos, rolar testes, acompanhar vida, gastar habilidades e ler descricoes rapidamente.

### Mestre

Pode consultar dados do personagem se o jogador compartilhar a tela ou exportar o JSON da ficha.

## 5. Requisitos Funcionais

### RF01 - Dados Gerais Do Personagem

O sistema deve exibir e permitir editar:

- Nome do personagem.
- Nivel.
- Classe.
- Raca, especie ou origem.
- Antecedente.
- Tendencia, se aplicavel.
- Deslocamento.
- Bonus de proficiencia.
- Inspiracao ou recurso equivalente.

### RF02 - Atributos

O sistema deve exibir os atributos principais do personagem:

- Forca.
- Destreza.
- Constituicao.
- Inteligencia.
- Sabedoria.
- Carisma.

Para cada atributo, o sistema deve:

- Permitir editar o valor base.
- Calcular o modificador automaticamente.
- Atualizar automaticamente pericias e testes derivados.

Formula inicial sugerida:

```text
modificador = floor((valorDoAtributo - 10) / 2)
```

### RF03 - Pericias

O sistema deve listar as pericias do personagem e calcular o bonus final de cada uma.

Cada pericia deve possuir:

- Nome.
- Atributo associado.
- Indicador de proficiencia.
- Indicador de especializacao, se aplicavel.
- Bonus manual.
- Bonus final calculado.

Formula inicial sugerida:

```text
bonusFinal = modificadorDoAtributo + bonusManual + bonusDeProficiencia
```

Quando houver especializacao:

```text
bonusDeProficiencia = proficiencia * 2
```

### RF04 - Testes De Resistencia

O sistema deve exibir testes de resistencia por atributo.

Cada teste deve permitir:

- Marcar proficiencia.
- Adicionar bonus manual.
- Calcular total automaticamente.
- Rolar o teste com um botao.

### RF05 - Combate Basico

O sistema deve exibir:

- Pontos de vida atuais.
- Pontos de vida maximos.
- Pontos de vida temporarios.
- Classe de armadura.
- Iniciativa.
- Deslocamento.
- Dados de vida.

O sistema deve permitir:

- Aplicar dano.
- Aplicar cura.
- Alterar vida temporaria.
- Restaurar vida para o maximo.

### RF06 - Habilidades

O sistema deve permitir cadastrar, editar e visualizar habilidades do personagem.

Cada habilidade deve conter:

- Nome.
- Categoria.
- Descricao.
- Tipo de acao.
- Custo.
- Limite de usos.
- Usos atuais.
- Tipo de recuperacao.
- Observacoes.

Categorias iniciais:

- Classe.
- Raca ou origem.
- Talento.
- Item.
- Customizada.

Tipos de acao iniciais:

- Acao.
- Acao bonus.
- Reacao.
- Passiva.
- Livre.
- Outro.

### RF07 - Controle De Usos

O sistema deve permitir gastar e recuperar usos de habilidades.

Exemplos:

- Gastar 1 uso.
- Recuperar 1 uso.
- Restaurar todos os usos.
- Mostrar visualmente habilidades sem usos restantes.

### RF08 - Rolagem De Dados

O sistema deve permitir rolar dados pela interface.

Rolagens minimas:

- Atributo.
- Pericia.
- Teste de resistencia.
- Ataque simples.
- Rolagem livre, como `1d20+5` ou `2d6+3`.

Cada rolagem deve exibir:

- Expressao rolada.
- Resultado dos dados.
- Bonus aplicado.
- Total final.
- Data e hora da rolagem.

### RF09 - Historico De Rolagens

O sistema deve manter um historico recente das rolagens.

O historico deve exibir:

- Nome da rolagem.
- Expressao.
- Resultado final.
- Detalhes dos dados.

Limite inicial sugerido:

```text
20 rolagens recentes
```

### RF10 - Inventario Simples

O sistema deve permitir listar itens importantes.

Cada item deve conter:

- Nome.
- Tipo.
- Quantidade.
- Descricao.
- Equipado ou nao.

Para armas, deve permitir:

- Bonus de ataque.
- Dano.
- Tipo de dano.
- Alcance.

### RF11 - Anotacoes

O sistema deve possuir uma area de texto livre para anotacoes de campanha.

Secoes sugeridas:

- Objetivos.
- Aliados.
- Inimigos.
- Missoes.
- Informacoes importantes.
- Notas livres.

### RF12 - Persistencia Local

O sistema deve salvar automaticamente os dados da ficha em um banco local simples.

Implementacao definida:

```text
SQLite
```

O navegador pode manter um rascunho temporario durante a edicao, mas a fonte principal dos dados deve ser o backend local.

### RF13 - Exportacao E Importacao

O sistema deve permitir:

- Exportar os dados do personagem em JSON.
- Importar um JSON previamente exportado.
- Validar se o arquivo importado possui estrutura compativel.

### RF14 - Layout Responsivo

O sistema deve adaptar a interface para:

- Desktop.
- Tablet.
- Celular.

No celular, as areas mais importantes devem aparecer primeiro:

- Vida.
- Classe de armadura.
- Iniciativa.
- Rolagens rapidas.
- Pericias.
- Habilidades.

### RF15 - Magias Completas

Na Fase 2, o sistema deve permitir gerenciar magias do personagem.

Cada magia deve conter:

- Nome.
- Nivel da magia.
- Escola ou categoria.
- Tempo de conjuracao.
- Alcance.
- Componentes.
- Duracao.
- Descricao.
- Dano ou efeito.
- Teste de resistencia, se houver.
- Fonte da magia.
- Preparada ou nao.

O sistema deve permitir:

- Marcar magias preparadas.
- Filtrar por nivel.
- Filtrar por acao, acao bonus, reacao ou ritual.
- Controlar espacos de magia gastos e disponiveis.
- Restaurar espacos apos descanso longo.
- Rolar dano ou cura de uma magia quando aplicavel.

### RF16 - Inventario Avancado

Na Fase 2, o inventario deve evoluir para controlar peso, dinheiro e equipamentos.

O sistema deve permitir:

- Definir peso por item.
- Calcular peso total carregado.
- Marcar item como equipado.
- Separar itens por categorias.
- Controlar moedas.
- Controlar cargas ou usos de itens.
- Adicionar observacoes em itens magicos.

Categorias sugeridas:

- Arma.
- Armadura.
- Consumivel.
- Ferramenta.
- Item magico.
- Tesouro.
- Municao.
- Outro.

### RF17 - Multiplos Personagens

Na Fase 2, o sistema deve permitir gerenciar mais de um personagem.

O sistema deve permitir:

- Criar novo personagem.
- Duplicar personagem existente.
- Alternar entre personagens.
- Renomear personagem.
- Arquivar personagem.
- Exportar um personagem especifico.
- Exportar todos os personagens.

No primeiro passo desta fase, os multiplos personagens devem continuar salvos localmente no SQLite.

### RF18 - Backup E Portabilidade

Na Fase 2, o sistema deve facilitar backup e portabilidade antes de pensar em login.

O backup deve ser simples e opcional.

O sistema deve permitir:

- Exportar todos os personagens em JSON.
- Exportar o banco SQLite para backup.
- Importar backup JSON.
- Informar quando o ultimo backup foi feito.
- Manter a aplicacao funcionando sem internet.

O sistema nao deve exigir login para usar a ficha local.

### RF19 - Sincronizacao Opcional

Na Fase 2, sincronizacao deve ser considerada apenas se backup manual nao resolver.

O sistema deve permitir:

- Exportar backup para uma pasta escolhida pelo usuario.
- Usar pasta sincronizada por ferramenta externa, como Google Drive, Dropbox ou OneDrive.
- Resolver conflito simples usando data da ultima alteracao.
- Informar claramente quando a ficha esta salva localmente ou tem backup recente.

Regra simples de conflito:

```text
se houver conflito, manter a versao mais recente e oferecer backup da versao antiga
```

### RF20 - Importacao Automatica Do PDF

Na Fase 2, o sistema deve tentar importar dados a partir de uma ficha em PDF.

O sistema deve permitir:

- Selecionar um arquivo PDF local.
- Extrair texto do PDF quando possivel.
- Preencher campos detectados automaticamente.
- Mostrar tela de revisao antes de salvar.
- Permitir ajuste manual dos campos importados.
- Falhar de forma segura quando o PDF for imagem ou tiver leitura ruim.

Campos prioritarios para importacao:

- Nome.
- Nivel.
- Classe.
- Atributos.
- Pontos de vida.
- Classe de armadura.
- Pericias.
- Habilidades.

Importacao automatica nao deve substituir a ficha atual sem confirmacao do usuario.

## 6. Requisitos Nao Funcionais

### RNF01 - Performance

- A interface deve carregar em menos de 2 segundos em ambiente local.
- Calculos derivados devem atualizar imediatamente apos alteracao.
- Acoes comuns nao devem depender de requisicoes externas.

### RNF02 - Usabilidade

- Acoes frequentes devem exigir poucos cliques.
- Botoes de rolagem, dano e cura devem ser grandes o suficiente para celular.
- Informacoes importantes devem ser escaneaveis durante a sessao.

### RNF03 - Responsividade

- A interface deve usar layout fluido.
- Componentes nao devem sobrepor texto em telas pequenas.
- Tabelas devem virar listas ou cards compactos no celular.

### RNF04 - Confiabilidade

- Alterar atributos deve recalcular pericias e testes corretamente.
- Dados salvos nao devem ser perdidos ao recarregar a pagina.
- Importacoes invalidas devem mostrar erro claro sem apagar a ficha atual.

### RNF05 - Manutenibilidade

- Regras de calculo devem ficar separadas da camada visual.
- Dados do personagem devem seguir um modelo previsivel.
- Componentes devem ser reutilizaveis.

### RNF06 - Acessibilidade

- Interface deve possuir bom contraste.
- Botoes devem ter labels claros.
- Campos devem ser navegaveis por teclado.
- Estados visuais nao devem depender apenas de cor.

### RNF07 - Portabilidade

- A ficha deve poder ser exportada em JSON.
- O projeto deve funcionar localmente com um backend Python simples.
- O banco local deve ficar em um arquivo SQLite facil de copiar e fazer backup.

## 7. Stack Oficial Do Projeto

O projeto deve ser simples, funcional e facil de vibecodar. A stack oficial evita frontend moderno pesado, build step, TypeScript, React, Redux, Docker e qualquer coisa que exija muita configuracao antes de ver a ficha funcionando.

### Stack Principal Do MVP

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Linguagem principal | Python | Simples de ler, facil de mexer e bom para regras, dados e automacoes. |
| Backend web | Quart | Parecido com Flask, leve, direto e suficiente para servir paginas e APIs locais. |
| Templates | Jinja2 | Ja vem no ecossistema Flask/Quart e permite montar HTML sem framework de frontend. |
| Frontend | HTML + CSS + JavaScript puro | Sem build, sem npm, sem React. Abriu o arquivo, entendeu a tela. |
| Banco local | SQLite | Um arquivo `.db`, facil de copiar, versionar em backup e usar sem servidor. |
| Persistencia de ficha | SQLite + JSON por personagem | Mantem o banco simples e permite evoluir o modelo sem migracoes complexas no inicio. |
| Testes | pytest | Apenas para testar calculos importantes quando necessario. |
| PDF futuro | pypdf ou pymupdf | Leitura de PDF no backend quando a importacao entrar na Fase 2. |

### Decisao Principal

O projeto sera uma aplicacao web local:

```text
Python/Quart no backend
HTML/CSS/JavaScript puro no frontend
SQLite como banco local
```

Isso significa que a aplicacao roda com um comando Python, abre no navegador e salva tudo localmente no projeto.

### Funcionalidades Que A Stack Deve Favorecer

- Rodar localmente com pouca configuracao.
- Salvar a ficha em SQLite.
- Ter telas HTML faceis de editar.
- Fazer calculos instantaneos no navegador com JavaScript simples.
- Manter regras importantes tambem no backend para exportacao e validacao.
- Exportar/importar JSON.
- Evoluir para multiplos personagens sem trocar de stack.
- Permitir importacao de PDF no backend futuramente.

### Stack Da Fase 2A - Local Avancado

Quando o MVP estiver estavel, a mesma stack continua valendo.

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Backend | Quart | Continua servindo telas e APIs. |
| Banco | SQLite | Ja suporta multiplos personagens, magias, inventario e historico. |
| PDF | pypdf ou pymupdf | Extrai texto da ficha no backend. |
| Validacao | Funcoes Python simples | Evita adicionar bibliotecas ate precisar. |

### Stack Da Fase 2B - Backup E Sincronizacao Opcional

Conta e nuvem ficam para depois. Se forem realmente necessarias, o caminho mais simples e manter o app local e adicionar backup/sync separado.

Opcoes futuras, em ordem de simplicidade:

- Exportar/importar JSON manualmente.
- Backup automatico do arquivo SQLite.
- Sincronizacao via pasta compartilhada, como Google Drive/Dropbox/OneDrive.
- So depois disso pensar em login real com servico externo.

### O Que Evitar Por Enquanto

- React.
- TypeScript.
- Vite.
- Redux.
- Next.js.
- Docker obrigatorio.
- Supabase no inicio.
- Autenticacao no MVP.
- Microservicos.
- UI kit pesado.
- Build step de frontend.
- Sincronizacao em tempo real.

Essas escolhas podem ser revistas depois, mas agora elas atrapalham mais do que ajudam.

## 8. Funcionalidades Prioritarias Da Stack

### Essenciais Para O MVP

- Painel do personagem com dados gerais.
- Atributos com modificadores automaticos.
- Pericias e testes calculados automaticamente.
- Vida, dano, cura, CA, iniciativa e deslocamento.
- Habilidades com controle de usos.
- Rolador de dados.
- Historico curto de rolagens.
- Inventario simples.
- Notas de campanha.
- Auto-save no backend local.
- Exportar/importar JSON.
- Layout responsivo para celular.

### Melhores Funcionalidades Para Evoluir Depois

- Multiplos personagens locais.
- Magias com preparo, CD, ataque e espacos.
- Inventario avancado com peso, moedas e cargas.
- Importacao de PDF com revisao manual.
- Busca e filtros em habilidades, magias e itens.
- Backup em pasta local ou sincronizada.
- Indicador de conflito/sincronizacao.

### Principio De Produto

Toda funcionalidade nova deve responder a uma pergunta simples:

```text
isso ajuda durante a sessao ou so deixa o sistema mais complicado?
```

Se a resposta for "deixa mais complicado", a funcionalidade deve ficar fora do MVP.

## 9. Arquitetura Proposta

Para o MVP, recomenda-se uma aplicacao web local com backend Python e frontend simples.

### Implementacao Do MVP

- Quart serve as paginas HTML.
- Jinja2 renderiza templates.
- CSS puro define a interface.
- JavaScript puro cuida de interacoes rapidas, rolagens e recalculos na tela.
- SQLite salva os personagens.
- Python centraliza regras de negocio, exportacao, importacao e acesso ao banco.
- pytest testa regras de calculo quando necessario.

Esta stack e suficiente porque evita build de frontend, npm, TypeScript e frameworks grandes. A aplicacao roda localmente, abre no navegador e salva em um arquivo SQLite.

### Bibliotecas Simples Permitidas

- `quart` para o backend web.
- `pytest` para testes.
- `pypdf` ou `pymupdf` para importacao de PDF na Fase 2.
- `python-dotenv` apenas se configuracoes locais forem necessarias.

Se alguma dessas bibliotecas aumentar complexidade demais, a implementacao deve comecar manual e evoluir depois.

### Implementacao Da Fase 2

Para manter simplicidade, a Fase 2 deve evoluir em duas etapas.

#### Fase 2A - Local Avancado

- Quart.
- SQLite.
- HTML/CSS/JavaScript puro.
- pypdf ou pymupdf para importacao de PDF.

Esta etapa adiciona:

- Multiplos personagens locais.
- Magias completas.
- Inventario avancado.
- Importacao de PDF com revisao manual.

#### Fase 2B - Conta E Nuvem

- Backup/exportacao automatica.
- Sincronizacao simples por arquivo, se necessario.
- Login real apenas se o projeto deixar de ser uso pessoal local.

Esta etapa adiciona:

- Backup em nuvem ou pasta sincronizada.
- Sincronizacao entre dispositivos, se realmente virar necessidade.

### Stack Nao Recomendada Para Agora

- React.
- TypeScript.
- Vite.
- Backend proprio com Express, NestJS ou FastAPI.
- Redux.
- Next.js.
- Microservicos.
- Docker obrigatorio.
- Sistema completo de permissoes.

Essas opcoes podem ser uteis no futuro, mas aumentam a complexidade antes do produto precisar delas.

## 10. Estrutura Inicial De Pastas

Estrutura sugerida:

```text
/
  app.py
  requirements.txt
  README.md
  SDD.md
  data/
    rpg.db
  backend/
    __init__.py
    database.py
    models.py
    rules.py
    dice.py
    import_export.py
    pdf_import.py
  templates/
    base.html
    index.html
    character.html
    partials/
      attributes.html
      skills.html
      combat.html
      abilities.html
      inventory.html
      notes.html
      rolls.html
  static/
    css/
      styles.css
    js/
      app.js
      dice.js
      character.js
      autosave.js
  tests/
    test_rules.py
```

## 11. Modelo De Dados Inicial

Para manter o banco simples, o MVP pode usar uma tabela principal com JSON da ficha.

```sql
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  class_name TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

O campo `data` guarda a ficha completa em JSON. Isso evita dezenas de tabelas no inicio e facilita exportar/importar.

Formato inicial do JSON:

```json
{
  "id": "lucio",
  "name": "Lucio",
  "level": 11,
  "class_name": "",
  "origin": "",
  "background": "",
  "proficiency_bonus": 4,
  "inspiration": false,
  "speed": 9,
  "armor_class": 10,
  "initiative_bonus_manual": 0,
  "hit_points": {
    "current": 0,
    "max": 0,
    "temporary": 0,
    "hit_dice": ""
  },
  "attributes": {
    "str": 10,
    "dex": 10,
    "con": 10,
    "int": 10,
    "wis": 10,
    "cha": 10
  },
  "skills": [],
  "saving_throws": [],
  "abilities": [],
  "inventory": [],
  "currency": {
    "copper": 0,
    "silver": 0,
    "electrum": 0,
    "gold": 0,
    "platinum": 0
  },
  "notes": {
    "goals": "",
    "allies": "",
    "enemies": "",
    "quests": "",
    "important_info": "",
    "free_notes": ""
  },
  "roll_history": [],
  "updated_at": ""
}
```

## 12. Regras De Calculo

### Modificador De Atributo

```py
def get_attribute_modifier(score: int) -> int:
    return (score - 10) // 2
```

### Bonus De Proficiencia Em Pericia

```py
def get_skill_proficiency_bonus(
    proficient: bool,
    expertise: bool,
    proficiency_bonus: int,
) -> int:
    if expertise:
        return proficiency_bonus * 2
    if proficient:
        return proficiency_bonus
    return 0
```

### Total De Pericia

```py
def get_skill_total(attribute_score: int, proficiency_bonus: int, skill: dict) -> int:
    return (
        get_attribute_modifier(attribute_score)
        + get_skill_proficiency_bonus(
            skill.get("proficient", False),
            skill.get("expertise", False),
            proficiency_bonus,
        )
        + int(skill.get("manual_bonus", 0))
    )
```

### Iniciativa

```text
iniciativa = modificadorDeDestreza + bonusManualDeIniciativa
```

### CD De Magia

```text
cdMagia = 8 + bonusDeProficiencia + modificadorDoAtributoDeConjuracao + bonusManual
```

### Ataque Com Magia

```text
ataqueMagia = bonusDeProficiencia + modificadorDoAtributoDeConjuracao + bonusManual
```

### Espacos De Magia Disponiveis

```text
espacosDisponiveis = espacosMaximos - espacosUsados
```

### Peso Total Do Inventario

```text
pesoTotal = soma(item.peso * item.quantidade)
```

## 13. Fluxos Principais

### Fluxo 1 - Editar Atributo

1. Usuario altera o valor de um atributo.
2. Sistema recalcula modificador.
3. Sistema recalcula pericias associadas.
4. Sistema recalcula teste de resistencia associado.
5. Sistema salva a ficha automaticamente.

### Fluxo 2 - Rolar Pericia

1. Usuario clica em rolar uma pericia.
2. Sistema calcula o bonus atual.
3. Sistema rola `1d20`.
4. Sistema soma dado + bonus.
5. Sistema mostra resultado.
6. Sistema adiciona a rolagem ao historico.

### Fluxo 3 - Usar Habilidade

1. Usuario abre a lista de habilidades.
2. Usuario clica em gastar uso.
3. Sistema diminui os usos atuais.
4. Sistema bloqueia gasto se os usos chegarem a zero.
5. Sistema salva a ficha automaticamente.

### Fluxo 4 - Aplicar Dano

1. Usuario informa valor de dano.
2. Sistema reduz primeiro pontos de vida temporarios.
3. Dano restante reduz pontos de vida atuais.
4. Sistema impede vida atual abaixo de zero, salvo decisao futura.
5. Sistema salva a ficha automaticamente.

### Fluxo 5 - Criar Outro Personagem

1. Usuario abre a lista de personagens.
2. Usuario clica em criar personagem.
3. Sistema cria uma ficha com valores iniciais.
4. Usuario edita dados principais.
5. Sistema salva o personagem localmente.

### Fluxo 6 - Preparar E Usar Magia

1. Usuario abre a area de magias.
2. Usuario marca uma magia como preparada.
3. Usuario usa a magia durante a sessao.
4. Sistema permite gastar espaco de magia, se aplicavel.
5. Sistema registra rolagem de dano ou cura, se houver.

### Fluxo 7 - Fazer Backup

1. Usuario abre a area de backup.
2. Sistema mostra a data do ultimo backup.
3. Usuario exporta JSON ou copia o arquivo SQLite.
4. Sistema confirma que o backup foi gerado.
5. Se houver importacao futura, sistema compara datas antes de substituir dados.

### Fluxo 8 - Importar PDF

1. Usuario seleciona um arquivo PDF.
2. Sistema tenta extrair texto do arquivo.
3. Sistema detecta campos conhecidos.
4. Sistema mostra uma tela de revisao.
5. Usuario corrige campos quando necessario.
6. Usuario confirma a importacao.
7. Sistema cria ou atualiza o personagem.

## 14. Interface E UX

### Layout Desktop

- Cabecalho com nome, classe, nivel e controles de exportar/importar.
- Painel de status com vida, CA, iniciativa e deslocamento.
- Grade de atributos.
- Abas para Pericias, Combate, Habilidades, Inventario e Notas.
- Historico de rolagens em painel lateral ou bloco inferior.

### Layout Mobile

Ordem recomendada:

1. Nome e nivel.
2. Vida, CA e iniciativa.
3. Rolagem rapida.
4. Atributos compactos.
5. Abas ou acordeoes para pericias, habilidades, inventario e notas.

### Estados Visuais

- Vida baixa deve ter destaque visual.
- Habilidades sem usos devem aparecer desativadas.
- Pericias proficientes devem ter marcador visual.
- Ultima rolagem deve ficar em destaque temporario.

## 15. Criterios De Aceite

### MVP

- O usuario consegue editar atributos e ver modificadores atualizados.
- O usuario consegue marcar proficiencia em uma pericia e ver o bonus final mudar.
- O usuario consegue rolar uma pericia e ver o resultado no historico.
- O usuario consegue alterar vida atual, aplicar dano e cura.
- O usuario consegue cadastrar uma habilidade com usos limitados.
- O usuario consegue gastar e restaurar usos de habilidade.
- Os dados continuam salvos apos recarregar a pagina.
- A interface e utilizavel em tela de celular.
- O usuario consegue exportar e importar a ficha em JSON.

### Fase 2

- O usuario consegue cadastrar e preparar magias.
- O usuario consegue controlar espacos de magia gastos e disponiveis.
- O usuario consegue calcular CD de magia e ataque com magia.
- O usuario consegue controlar peso total do inventario.
- O usuario consegue cadastrar moedas e itens com cargas.
- O usuario consegue criar e alternar entre multiplos personagens.
- O usuario consegue fazer backup dos personagens em JSON ou SQLite.
- O usuario consegue usar a aplicacao sem internet.
- O usuario consegue importar um PDF e revisar os dados antes de salvar.

## 16. Backlog Inicial

### MVP - Prioridade 1

> Stack: Python + Quart + Jinja2 + HTML/CSS/JavaScript puro + SQLite.

- Criar projeto Python.
- Criar `app.py` com Quart.
- Criar templates HTML base.
- Criar CSS principal.
- Criar JavaScript principal.
- Criar banco SQLite.
- Criar modelo de dados do personagem.
- Implementar atributos e modificadores.
- Implementar pericias e calculos.
- Implementar salvamento no backend local.

### MVP - Prioridade 2

- Implementar combate basico.
- Implementar habilidades.
- Implementar controle de usos.
- Implementar rolagem de dados.
- Implementar historico de rolagens.

### MVP - Prioridade 3

- Implementar inventario.
- Implementar anotacoes.
- Implementar exportacao e importacao JSON.
- Ajustar responsividade.
- Revisar acessibilidade.

### Fase 2A - Local Avancado

> Stack: Quart + SQLite + HTML/CSS/JavaScript puro + pypdf/pymupdf.

- Implementar lista de personagens.
- Implementar criacao, duplicacao, arquivamento e troca de personagem.
- Implementar magias completas.
- Implementar espacos de magia.
- Implementar inventario avancado.
- Implementar moedas.
- Implementar importacao de PDF com tela de revisao.

### Fase 2B - Backup E Sincronizacao Opcional

> Stack: manter Quart + SQLite e adicionar backup/sync simples apenas se necessario.

- Implementar backup do banco SQLite.
- Implementar exportacao automatica de JSON.
- Avaliar sincronizacao via pasta compartilhada.
- Implementar resolucao simples de conflitos.
- Implementar indicador de status: local, backup feito ou erro.

## 17. Riscos E Decisoes Pendentes

### Riscos

- A ficha original pode ter regras especificas que nao seguem exatamente o modelo D20 padrao.
- Algumas habilidades podem ter textos longos e exigir melhor organizacao visual.
- Importacao automatica do PDF pode ser complexa se o arquivo for imagem ou tiver estrutura ruim.
- Sincronizacao por backup pode gerar conflitos se o mesmo personagem for editado em dois dispositivos.
- Magias e inventario avancado podem variar muito conforme o sistema de RPG.

### Decisoes Pendentes

- Confirmar o sistema de RPG usado.
- Confirmar nomes exatos das pericias.
- Confirmar regras de proficiencia, especializacao e bonus.
- Confirmar se a ficha segue regras D20 padrao ou possui adaptacoes.
- Confirmar se algum dia login real sera necessario ou se backup local/exportacao ja resolve.

## 18. Proxima Etapa Recomendada

A proxima etapa e criar a aplicacao web do MVP com Python, Quart, HTML, CSS, JavaScript puro e SQLite, usando este SDD como guia. O primeiro incremento deve entregar:

- Estrutura do projeto.
- Backend local com Quart.
- Banco SQLite.
- Tela principal responsiva.
- Dados gerais do personagem.
- Atributos.
- Pericias.
- Calculos automaticos.
- Salvamento local no SQLite.

Depois que o MVP estiver estavel, a evolucao recomendada e seguir para a Fase 2A com multiplos personagens, magias completas, inventario avancado e importacao de PDF no backend. Login e nuvem devem ficar fora ate existir uma necessidade real.
