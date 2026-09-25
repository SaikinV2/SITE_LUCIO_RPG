import copy
import json


REQUIRED_FIELDS = ["id", "name", "level", "attributes", "skills", "saving_throws", "hit_points"]


def validate_character_data(data: dict) -> list[str]:
    errors = []
    for field in REQUIRED_FIELDS:
        if field not in data:
            errors.append(f"Campo obrigatório ausente: {field}")

    if "attributes" in data:
        for attr in ["str", "dex", "con", "int", "wis", "cha"]:
            if attr not in data["attributes"]:
                errors.append(f"Atributo ausente: {attr}")

    return errors


def _deep_merge(base: dict, override: dict) -> dict:
    result = copy.deepcopy(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = copy.deepcopy(v)
    return result


def normalize_character_data(data: dict) -> dict:
    from backend.rules import create_default_character
    default = create_default_character()
    return _deep_merge(default, data)


def export_character(character_data: dict) -> str:
    return json.dumps(character_data, ensure_ascii=False, indent=2)


def import_character(json_str: str) -> tuple[dict | None, list[str]]:
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        return None, [f"JSON inválido: {e}"]

    if not isinstance(data, dict):
        return None, ["O arquivo deve conter um objeto JSON."]

    errors = validate_character_data(data)
    if errors:
        return None, errors

    return normalize_character_data(data), []
