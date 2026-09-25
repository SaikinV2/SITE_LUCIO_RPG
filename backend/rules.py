import copy
import uuid
from datetime import datetime, timezone


ATTR_NAMES = {
    "str": "Força",
    "dex": "Destreza",
    "con": "Constituição",
    "int": "Inteligência",
    "wis": "Sabedoria",
    "cha": "Carisma",
}

DEFAULT_SKILLS = [
    {"id": "atletismo", "name": "Atletismo", "attr": "str", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "acrobacia", "name": "Acrobacia", "attr": "dex", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "prestidigitacao", "name": "Prestidigitação", "attr": "dex", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "furtividade", "name": "Furtividade", "attr": "dex", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "arcanismo", "name": "Arcanismo", "attr": "int", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "historia", "name": "História", "attr": "int", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "investigacao", "name": "Investigação", "attr": "int", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "natureza", "name": "Natureza", "attr": "int", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "religiao", "name": "Religião", "attr": "int", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "adestrar_animais", "name": "Adestrar Animais", "attr": "wis", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "intuicao", "name": "Intuição", "attr": "wis", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "medicina", "name": "Medicina", "attr": "wis", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "percepcao", "name": "Percepção", "attr": "wis", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "sobrevivencia", "name": "Sobrevivência", "attr": "wis", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "enganacao", "name": "Enganação", "attr": "cha", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "intimidacao", "name": "Intimidação", "attr": "cha", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "atuacao", "name": "Atuação", "attr": "cha", "proficient": False, "expertise": False, "manual_bonus": 0},
    {"id": "persuasao", "name": "Persuasão", "attr": "cha", "proficient": False, "expertise": False, "manual_bonus": 0},
]

DEFAULT_SAVING_THROWS = [
    {"attr": "str", "name": "Força", "proficient": False, "manual_bonus": 0},
    {"attr": "dex", "name": "Destreza", "proficient": False, "manual_bonus": 0},
    {"attr": "con", "name": "Constituição", "proficient": False, "manual_bonus": 0},
    {"attr": "int", "name": "Inteligência", "proficient": False, "manual_bonus": 0},
    {"attr": "wis", "name": "Sabedoria", "proficient": False, "manual_bonus": 0},
    {"attr": "cha", "name": "Carisma", "proficient": False, "manual_bonus": 0},
]


def get_attribute_modifier(score: int) -> int:
    return (score - 10) // 2


def get_skill_proficiency_bonus(proficient: bool, expertise: bool, proficiency_bonus: int) -> int:
    if expertise:
        return proficiency_bonus * 2
    if proficient:
        return proficiency_bonus
    return 0


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


def calc_proficiency_bonus(level: int) -> int:
    return (level - 1) // 4 + 2


def create_default_character(name: str = "Personagem") -> dict:
    char_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": char_id,
        "name": name,
        "level": 1,
        "class_name": "",
        "origin": "",
        "background": "",
        "alignment": "",
        "proficiency_bonus": 2,
        "inspiration": False,
        "speed": 9,
        "armor_class": 10,
        "initiative_bonus_manual": 0,
        "hit_points": {
            "current": 0,
            "max": 0,
            "temporary": 0,
            "hit_dice": "",
        },
        "attributes": {
            "str": 10,
            "dex": 10,
            "con": 10,
            "int": 10,
            "wis": 10,
            "cha": 10,
        },
        "saving_throws": copy.deepcopy(DEFAULT_SAVING_THROWS),
        "skills": copy.deepcopy(DEFAULT_SKILLS),
        "abilities": [],
        "inventory": [],
        "currency": {
            "copper": 0,
            "silver": 0,
            "electrum": 0,
            "gold": 0,
            "platinum": 0,
        },
        "notes": {
            "goals": "",
            "allies": "",
            "enemies": "",
            "quests": "",
            "important_info": "",
            "free_notes": "",
        },
        "roll_history": [],
        "sinfonia": {
            "stacks": 0,
            "brigao": 0,
            "energizacao_stacks": 0,
            "sincronizacao_active": False,
            "vantagem_active": False,
            "kit": {
                "fortalecimento": {"uses": 3, "max": 3},
                "bomba": {"uses": 3, "max": 3},
                "sincronizacao": {"uses": 3, "max": 3},
            },
        },
        "spell_slots": {str(i): {"max": 0, "current": 0} for i in range(1, 10)},
        "spells": [],
        "active_spells": [],
        "sticky_notes": [],
        "conditions": [],
        "updated_at": now,
    }
