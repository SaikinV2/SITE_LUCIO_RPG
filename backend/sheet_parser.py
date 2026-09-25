import asyncio
import base64
import io
import json
import os
import re
import time
import random

import anthropic

SYSTEM_PROMPT = """Você é um analisador de fichas de personagens de RPG (sistemas como D&D 5e, Pathfinder, ou sistemas homebrew).
Analise o conteúdo recebido e extraia todos os dados do personagem que conseguir identificar.

Retorne APENAS um objeto JSON válido com os campos encontrados. Omita campos que não conseguir identificar.

Estrutura aceita (inclua só o que encontrar):
{
  "name": "Nome do personagem",
  "level": 5,
  "class_name": "Guerreiro",
  "origin": "Humano",
  "background": "Soldado",
  "alignment": "Leal e Bom",
  "speed": 9,
  "proficiency_bonus": 3,
  "attributes": {
    "str": 16, "dex": 14, "con": 15, "int": 10, "wis": 12, "cha": 8
  },
  "hit_points": {
    "max": 45, "current": 45, "temporary": 0, "hit_dice": "5d10"
  },
  "saving_throws": [
    {"attr": "str", "proficient": true},
    {"attr": "con", "proficient": true}
  ],
  "skills": [
    {"id": "atletismo", "name": "Atletismo", "attr": "str", "proficient": true, "expertise": false, "manual_bonus": 0},
    {"id": "percepcao", "name": "Percepção", "attr": "wis", "proficient": true, "expertise": false, "manual_bonus": 0}
  ],
  "inventory": [
    {"name": "Espada Longa", "type": "Arma", "damage": "1d8", "damage_type": "Cortante", "equipped": true, "quantity": 1, "description": ""},
    {"name": "Cota de Malha", "type": "Armadura", "equipped": true, "quantity": 1, "ac_base": 16, "ac_attr": "", "description": ""}
  ],
  "abilities": [
    {"name": "Ação Adicional", "category": "class", "description": "Pode atacar duas vezes por turno.", "action_type": "action", "uses_max": 0, "uses_current": 0, "recovery_type": "long_rest"}
  ],
  "spell_slots": {
    "1": {"max": 4, "current": 4},
    "2": {"max": 3, "current": 3}
  },
  "spells": [
    {"name": "Míssil Mágico", "circle": 1, "school": "evocacao", "casting_time": "1 ação", "range": "36 metros", "duration": "Instantâneo", "description": "3 dardos de força mágica."}
  ],
  "currency": {"copper": 0, "silver": 10, "electrum": 0, "gold": 50, "platinum": 0},
  "notes": {"free_notes": "Notas gerais"}
}

IDs de perícias válidos: atletismo, acrobacia, prestidigitacao, furtividade, arcanismo, historia, investigacao, natureza, religiao, adestrar_animais, intuicao, medicina, percepcao, sobrevivencia, enganacao, intimidacao, atuacao, persuasao

Atributos: str=Força, dex=Destreza, con=Constituição, int=Inteligência, wis=Sabedoria, cha=Carisma

Escolas de magia: abjuracao, adivinhacao, conjuracao, encantamento, evocacao, ilusao, necromancia, transmutacao

Se o sistema de jogo usar nomes diferentes (ex: "Athletics" em inglês), traduza para os IDs corretos.
Retorne APENAS o JSON, sem texto adicional, sem markdown, sem blocos de código."""


def _make_id() -> str:
    return hex(int(time.time() * 1000))[2:] + hex(random.randint(0, 0xfff))[2:]


def _build_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY não configurada no ambiente do servidor.")
    return anthropic.Anthropic(api_key=api_key)


def _extract_json(text: str) -> dict:
    text = text.strip()
    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)


def _normalize(data: dict) -> dict:
    for item in data.get("inventory", []):
        item.setdefault("id", _make_id())
        item.setdefault("quantity", 1)
        item.setdefault("equipped", False)
        item.setdefault("type", "Outro")
        item.setdefault("description", "")

    for ab in data.get("abilities", []):
        ab.setdefault("id", _make_id())
        ab.setdefault("category", "class")
        ab.setdefault("action_type", "action")
        ab.setdefault("uses_max", 0)
        ab.setdefault("uses_current", 0)
        ab.setdefault("recovery_type", "long_rest")
        ab.setdefault("description", "")
        ab.setdefault("cost", "")
        ab.setdefault("notes", "")

    for sp in data.get("spells", []):
        sp.setdefault("id", _make_id())
        sp.setdefault("circle", 0)
        sp.setdefault("school", "")
        sp.setdefault("casting_time", "")
        sp.setdefault("range", "")
        sp.setdefault("duration", "")
        sp.setdefault("components", "")
        sp.setdefault("description", "")

    # Ensure spell_slots keys are strings
    if "spell_slots" in data:
        data["spell_slots"] = {
            str(k): {"max": int(v.get("max", 0)), "current": int(v.get("current", v.get("max", 0)))}
            for k, v in data["spell_slots"].items()
        }

    return data


def _sync_call_text(text: str) -> str:
    client = _build_client()
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Analise esta ficha de personagem e extraia os dados:\n\n{text}"}],
    )
    return response.content[0].text


def _sync_call_image(image_b64: str, media_type: str) -> str:
    client = _build_client()
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": image_b64},
                },
                {"type": "text", "text": "Analise a ficha de personagem nesta imagem e extraia os dados."},
            ],
        }],
    )
    return response.content[0].text


async def parse_text(text: str) -> dict:
    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(None, _sync_call_text, text)
    return _normalize(_extract_json(raw))


async def parse_image(image_bytes: bytes, media_type: str) -> dict:
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(None, _sync_call_image, image_b64, media_type)
    return _normalize(_extract_json(raw))


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    parts = []

    # 1) AcroForm fields (fillable PDF values)
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        fields = reader.get_form_text_fields() or {}
        if fields:
            parts.append("=== CAMPOS DO FORMULÁRIO ===")
            for key, val in fields.items():
                if val and str(val).strip():
                    parts.append(f"{key}: {val}")
        # Also try checkbox/radio fields via full fields dict
        all_fields = reader.get_fields() or {}
        for key, field in all_fields.items():
            val = field.get("/V") or field.get("/DV")
            if val and str(val).strip() not in ("/Off", "Off", "") and key not in fields:
                parts.append(f"{key}: {val}")
    except Exception:
        pass

    # 2) Regular text layer (labels, static text)
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    parts.append(page_text)
    except Exception:
        pass

    return "\n".join(parts).strip()


async def parse_pdf(pdf_bytes: bytes) -> dict:
    full_text = _extract_pdf_text(pdf_bytes)
    if not full_text:
        raise ValueError("Não foi possível extrair texto do PDF. Tente enviar como imagem (PNG/JPG).")
    return await parse_text(full_text)
