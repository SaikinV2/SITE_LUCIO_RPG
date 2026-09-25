// Character state management and pure calculation functions.

const ATTR_LABEL = {
  str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR'
};

const ATTR_FULL = {
  str: 'Força', dex: 'Destreza', con: 'Constituição',
  int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma'
};

const CATEGORY_LABELS = {
  class: 'Classe', race: 'Raça', feat: 'Talento', item: 'Item', weapon: 'Arma', armor: 'Armadura', custom: 'Customizada'
};

const ACTION_LABELS = {
  action: 'Ação', bonus_action: 'Ação Bônus', reaction: 'Reação',
  passive: 'Passiva', free: 'Livre', other: 'Outro'
};

const RECOVERY_LABELS = {
  long_rest: 'Descanso Longo', short_rest: 'Descanso Curto',
  manual: 'Manual', unlimited: 'Ilimitado'
};

const ITEM_TYPES = ['Arma', 'Armadura', 'Consumível', 'Ferramenta', 'Item Mágico', 'Tesouro', 'Munição', 'Outro'];

function modifier(score) {
  return Math.trunc((+score - 10) / 2);
}

function fmtMod(m) {
  return (m >= 0 ? '+' : '') + m;
}

function calcProfBonus(level) {
  return Math.floor((level - 1) / 4) + 2;
}

function getArmorAttrBonus(char, attr) {
  if (!char.inventory) return 0;
  return char.inventory
    .filter(i => i.type === 'Armadura' && i.equipped && i.attr_bonuses)
    .reduce((s, i) => s + (parseInt(i.attr_bonuses[attr]) || 0), 0);
}

function getBrigaoBonus(char, attr) {
  if (!['dex', 'con', 'cha'].includes(attr)) return 0;
  return Math.floor((char.sinfonia?.brigao || 0) / 5);
}

const MOD_FORMULAS = {
  prof:          c => c.proficiency_bonus || 2,
  cha_mod:       c => modifier(getEffectiveAttr(c, 'cha')),
  str_mod:       c => modifier(getEffectiveAttr(c, 'str')),
  dex_mod:       c => modifier(getEffectiveAttr(c, 'dex')),
  con_mod:       c => modifier(getEffectiveAttr(c, 'con')),
  int_mod:       c => modifier(getEffectiveAttr(c, 'int')),
  wis_mod:       c => modifier(getEffectiveAttr(c, 'wis')),
  half_cha_attr: c => Math.floor(getEffectiveAttr(c, 'cha') / 2),
  half_str_attr: c => Math.floor(getEffectiveAttr(c, 'str') / 2),
  half_dex_attr: c => Math.floor(getEffectiveAttr(c, 'dex') / 2),
  half_cha_mod:  c => Math.floor(modifier(getEffectiveAttr(c, 'cha')) / 2),
  half_str_mod:  c => Math.floor(modifier(getEffectiveAttr(c, 'str')) / 2),
  half_dex_mod:  c => Math.floor(modifier(getEffectiveAttr(c, 'dex')) / 2),
};

function evaluateModValue(char, mod) {
  if (mod.formula) {
    const fn = MOD_FORMULAS[mod.formula];
    return fn ? fn(char) : 0;
  }
  return parseInt(mod.value) || 0;
}

function getTalentoBonus(char, target) {
  return (char.talentos || [])
    .filter(t => t.type === 'passivo' || (t.type === 'ativo' && t.toggleable && t.active))
    .flatMap(t => t.modifiers || [])
    .filter(m => m.target === target)
    .reduce((sum, m) => sum + evaluateModValue(char, m), 0);
}

function getEffectiveAttr(char, attr) {
  const base = parseInt(char.attributes[attr] ?? 10, 10);
  return (isNaN(base) ? 10 : base)
    + getArmorAttrBonus(char, attr)
    + getBrigaoBonus(char, attr)
    + getTalentoBonus(char, attr);
}

function computeCA(char) {
  const armors = (char.inventory || []).filter(i => i.type === 'Armadura' && i.equipped);
  const talentoCA = getTalentoBonus(char, 'ca');
  const spellCA = (char.spell_effects || []).reduce(
    (total, effect) => total + (parseInt(effect.ca_bonus) || 0), 0
  );
  if (armors.length === 0) {
    return 10 + modifier(getEffectiveAttr(char, 'dex')) + talentoCA + spellCA;
  }
  return armors.reduce((total, armor) => {
    const base = parseInt(armor.ac_base) || parseInt(armor.ac_bonus) || 0;
    const flat  = parseInt(armor.ac_flat_bonus) || 0;
    let attrMod = 0;
    if (armor.ac_attr) {
      attrMod = modifier(getEffectiveAttr(char, armor.ac_attr));
      const cap = parseInt(armor.ac_attr_cap) || 0;
      if (cap > 0) attrMod = Math.min(attrMod, cap);
    }
    return total + base + attrMod + flat;
  }, 0) + talentoCA + spellCA;
}

function skillTotal(char, skill) {
  const m = modifier(getEffectiveAttr(char, skill.attr));
  const pb = (char.proficiency_bonus || 2) + getTalentoBonus(char, 'prof');
  let prof = 0;
  if (skill.expertise) prof = pb * 2;
  else if (skill.proficient) prof = pb;
  return m + prof + (parseInt(skill.manual_bonus) || 0);
}

function saveTotal(char, save) {
  const m = modifier(getEffectiveAttr(char, save.attr));
  const pb = (char.proficiency_bonus || 2) + getTalentoBonus(char, 'prof');
  const spellBonus = (char.spell_effects || []).reduce(
    (total, effect) => total + (parseInt(effect.save_bonus) || 0), 0
  );
  return m + (save.proficient ? pb : 0) + (parseInt(save.manual_bonus) || 0) + spellBonus;
}

function initiative(char) {
  return modifier(getEffectiveAttr(char, 'dex'))
    + (parseInt(char.initiative_bonus_manual) || 0)
    + getTalentoBonus(char, 'initiative');
}

function setNestedField(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getNestedField(obj, path) {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

function applyDamage(char, amount) {
  amount = parseInt(amount) || 0;
  if (amount <= 0) return;
  const resistsAllDamage = (char.spell_effects || []).some(effect => effect.damage_resistance_all);
  if (resistsAllDamage) amount = Math.floor(amount / 2);
  const temp = char.hit_points.temporary || 0;
  if (amount <= temp) {
    char.hit_points.temporary = temp - amount;
  } else {
    const remaining = amount - temp;
    char.hit_points.temporary = 0;
    char.hit_points.current = Math.max(0, (char.hit_points.current || 0) - remaining);
  }
}

function applyHeal(char, amount) {
  amount = parseInt(amount) || 0;
  if (amount <= 0) return;
  const max = char.hit_points.max || 0;
  char.hit_points.current = Math.min(max, (char.hit_points.current || 0) + amount);
}

function spendAbilityUse(char, abilityId) {
  const ab = char.abilities.find(a => a.id === abilityId);
  if (!ab) return false;
  if (ab.uses_max > 0 && ab.uses_current <= 0) return false;
  if (ab.uses_max > 0) ab.uses_current = Math.max(0, ab.uses_current - 1);
  return true;
}

function restoreAbilityUse(char, abilityId) {
  const ab = char.abilities.find(a => a.id === abilityId);
  if (!ab || ab.uses_max === 0) return;
  ab.uses_current = Math.min(ab.uses_max, ab.uses_current + 1);
}

function restoreAllAbilityUses(char) {
  char.abilities.forEach(ab => {
    if (ab.uses_max > 0) ab.uses_current = ab.uses_max;
  });
}

function getStacksBonus1500(char) {
  return Math.floor((char.sinfonia?.stacks ?? 0) / 1500);
}

function getStacksBonus3000(char) {
  return Math.floor((char.sinfonia?.stacks ?? 0) / 3000);
}

function sinfoniaSkillTotal(char) {
  const chaMod = modifier(getEffectiveAttr(char, 'cha'));
  return 8 + chaMod + getStacksBonus1500(char);
}

function newTalento() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: 'Novo Talento',
    type: 'ativo',
    description: '',
    action_type: 'action',
    uses_max: 0,
    uses_current: 0,
    recovery_type: 'long_rest',
    modifiers: [],
  };
}

function newAbility() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: 'Nova Habilidade',
    category: 'class',
    description: '',
    action_type: 'action',
    cost: '',
    uses_max: 0,
    uses_current: 0,
    recovery_type: 'long_rest',
    notes: '',
  };
}

function newItem() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: 'Novo Item',
    type: 'Consumível',
    quantity: 1,
    equipped: false,
    active: false,
    description: '',
    effect_type: 'none',
    effect_formula: '',
    passive: false,
    passives: [],
    item_abilities: [],
  };
}


function newWeaponItem() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: 'Nova Arma',
    type: 'Arma',
    quantity: 1,
    equipped: false,
    active: false,
    description: '',
    damage: '',
    damage_type: '',
    attack_attr: 'dex',
    attack_bonus: 0,
    range: '',
    passives: [],
    item_abilities: [],
  };
}

function newArmorItem() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: 'Nova Armadura',
    type: 'Armadura',
    quantity: 1,
    equipped: false,
    active: false,
    description: '',
    ac_base: 0,
    ac_attr: 'dex',
    ac_attr_cap: 0,
    ac_flat_bonus: 0,
    attr_bonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    passives: [],
    item_abilities: [],
  };
}
