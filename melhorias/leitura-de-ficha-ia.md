# Leitura de Ficha com IA

## O que é
Botão "🤖 Ler Ficha" no header que aceita PDF (editável ou escaneado), imagem (PNG/JPG) ou texto colado. A IA extrai automaticamente todos os dados do personagem (atributos, HP, habilidades, magias, inventário, etc.) e preenche a ficha.

## Estado atual
Código já implementado e funcional — só precisa de uma chave de API:
- `backend/sheet_parser.py` — lógica de extração (pypdf + pdfplumber + chamada à IA)
- `app.py` — endpoint `POST /api/character/<id>/parse-sheet`
- `static/js/app.js` — funções `initParseSheet`, `openParseSheetModal`, `sendParseSheet`, `showParsePreview`, `applyParsedData`

## Por que está desativado
Requer chave de API de IA. A Anthropic (Claude) não tem plano gratuito.

## Como ativar gratuitamente
Usar **Google Gemini** (gratuito em https://aistudio.google.com):
1. Criar chave em aistudio.google.com → "Get API key"
2. `pip install google-generativeai`
3. Trocar o cliente em `sheet_parser.py` de `anthropic` para `google.generativeai`
4. Setar `GEMINI_API_KEY` no ambiente do servidor
5. Reativar o botão no `character.html`

## Modelo sugerido
`gemini-1.5-flash` — grátis, suporta visão (PDF/imagem), rápido.

## Capacidades do parser atual
- PDF editável: lê campos AcroForm (valores preenchidos) + texto estático
- PDF escaneado / imagem: envia para visão da IA
- Texto colado: qualquer formato
- Extrai: nome, classe, nível, raça, atributos, HP, perícias, resistências, inventário, habilidades, magias, espaços de magia, moeda, notas
