import pytest
from backend.rules import (
    get_attribute_modifier,
    get_skill_proficiency_bonus,
    get_skill_total,
    calc_proficiency_bonus,
    create_default_character,
)


def test_modifier_standard():
    assert get_attribute_modifier(10) == 0
    assert get_attribute_modifier(11) == 0
    assert get_attribute_modifier(12) == 1
    assert get_attribute_modifier(14) == 2
    assert get_attribute_modifier(20) == 5
    assert get_attribute_modifier(8) == -1
    assert get_attribute_modifier(1) == -5


def test_proficiency_bonus_by_level():
    assert calc_proficiency_bonus(1)  == 2
    assert calc_proficiency_bonus(4)  == 2
    assert calc_proficiency_bonus(5)  == 3
    assert calc_proficiency_bonus(8)  == 3
    assert calc_proficiency_bonus(9)  == 4
    assert calc_proficiency_bonus(13) == 5
    assert calc_proficiency_bonus(17) == 6
    assert calc_proficiency_bonus(20) == 6


def test_skill_prof_bonus_none():
    assert get_skill_proficiency_bonus(False, False, 4) == 0


def test_skill_prof_bonus_proficient():
    assert get_skill_proficiency_bonus(True, False, 4) == 4


def test_skill_prof_bonus_expertise():
    assert get_skill_proficiency_bonus(True, True, 4) == 8
    assert get_skill_proficiency_bonus(False, True, 4) == 8


def test_skill_total_no_prof():
    skill = {"proficient": False, "expertise": False, "manual_bonus": 0}
    assert get_skill_total(14, 3, skill) == 2


def test_skill_total_proficient():
    skill = {"proficient": True, "expertise": False, "manual_bonus": 0}
    assert get_skill_total(14, 3, skill) == 5


def test_skill_total_expertise():
    skill = {"proficient": True, "expertise": True, "manual_bonus": 0}
    assert get_skill_total(14, 3, skill) == 8


def test_skill_total_manual_bonus():
    skill = {"proficient": True, "expertise": False, "manual_bonus": 2}
    assert get_skill_total(14, 3, skill) == 7


def test_default_character_has_all_skills():
    char = create_default_character("Test")
    assert len(char["skills"]) == 18
    assert len(char["saving_throws"]) == 6


def test_default_character_attributes():
    char = create_default_character()
    for attr in ["str", "dex", "con", "int", "wis", "cha"]:
        assert char["attributes"][attr] == 10
