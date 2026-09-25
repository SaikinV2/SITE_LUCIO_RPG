import random
import re


def roll_die(sides: int) -> int:
    return random.randint(1, sides)


def parse_and_roll(expression: str) -> dict:
    expr = expression.strip().lower().replace(" ", "")
    pattern = r"^(\d+)d(\d+)([+-]\d+)?$"
    match = re.match(pattern, expr)

    if not match:
        try:
            bonus = int(expr)
            return {"expression": expression, "rolls": [], "bonus": bonus, "total": bonus}
        except ValueError:
            return {
                "expression": expression,
                "rolls": [],
                "bonus": 0,
                "total": 0,
                "error": f"Expressão inválida: {expression}",
            }

    count = int(match.group(1))
    sides = int(match.group(2))
    bonus = int(match.group(3) or "0")

    rolls = [roll_die(sides) for _ in range(count)]
    total = sum(rolls) + bonus

    return {"expression": expression, "rolls": rolls, "bonus": bonus, "total": total}
