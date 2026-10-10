// Main UI orchestrator. Depends on character.js, dice.js, autosave.js.

// ── INIT ──────────────────────────────────────────
let char;

function migrateItemPassives(item) {
  if (!Array.isArray(item.passives)) {
    if (item.passive && item.passive_type) {
      item.passives = [{ type: item.passive_type, value: item.passive_value || '' }];
    } else {
      item.passives = [];
    }
    delete item.passive_type;
    delete item.passive_value;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const raw = document.getElementById('char-data');
  if (!raw) return;
  char = JSON.parse(raw.textContent);
  (char.inventory || []).forEach(item => { migrateItemPassives(item); migrateItemAbilities(item); });

  initHeader();
  initStatusBar();
  initAttributes();
  renderSaves();
  renderSkills();
  renderAbilities();
  renderInventory();
  renderAttacks();
  initNotes();
  initRollPanel();
  renderRollHistory();
  initTabs();
  initImport();
  initArmorListeners();
  initSinfonia();
  initInstabilidade();
  renderSpellSlots();
  initSpells();
  initBladeFlourish();
  initBardInspiration();
  initStickyNotes();
  initRest();
  initParseSheet();
  initTalentos();
  initConditions();
  initPrint();
  recalcAll();
});

// ── HEADER ────────────────────────────────────────
function initHeader() {
  document.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', onFieldChange);
    el.addEventListener('change', onFieldChange);
  });

  const inspBtn = document.getElementById('inspiration-btn');
  if (inspBtn) {
    inspBtn.addEventListener('click', () => {
      char.inspiration = !char.inspiration;
      inspBtn.classList.toggle('active', char.inspiration);
      triggerAutosave();
    });
  }
}

function onFieldChange(e) {
  const el = e.target;
  const field = el.dataset.field;
  if (!field) return;

  let value = el.value;
  if (el.type === 'number') {
    if (field.startsWith('attributes.')) {
      const attr = field.split('.')[1];
      const effective = parseInt(value, 10) || 0;
      // Input shows effective score; store base (effective minus active bonuses)
      value = Math.max(1, effective - getArmorAttrBonus(char, attr) - getBrigaoBonus(char, attr));
    } else {
      value = parseFloat(value) || 0;
    }
  }
  if (el.type === 'checkbox') value = el.checked;

  setNestedField(char, field, value);

  if (field === 'level') {
    const autoPb = calcProfBonus(char.level);
    char.proficiency_bonus = autoPb;
    const pbInput = document.getElementById('prof-bonus');
    if (pbInput) pbInput.value = autoPb;
    recalcAll();
  } else if (field === 'proficiency_bonus') {
    recalcAll();
  } else if (field.startsWith('attributes.')) {
    recalcAll();
  } else if (field === 'speed' || field === 'class_name') {
    renderBladeFlourish();
  } else if (field === 'initiative_bonus_manual') {
    recalcInitiative();
  }

  triggerAutosave();
}

// ── STATUS BAR ────────────────────────────────────
function initStatusBar() {
  document.getElementById('btn-damage')?.addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('hp-delta')?.value) || 0;
    applyDamage(char, amount);
    syncHPInputs();
    triggerAutosave();
  });

  document.getElementById('btn-heal')?.addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('hp-delta')?.value) || 0;
    applyHeal(char, amount);
    syncHPInputs();
    triggerAutosave();
  });

  document.getElementById('btn-restore-hp')?.addEventListener('click', () => {
    char.hit_points.current = char.hit_points.max || 0;
    syncHPInputs();
    triggerAutosave();
  });

  document.getElementById('btn-roll-hd')?.addEventListener('click', () => {
    const dv = (char.hit_points?.hit_dice || '1d8').trim();
    const conMod = modifier(getEffectiveAttr(char, 'con'));
    const formula = conMod >= 0 ? `${dv}+${conMod}` : `${dv}${conMod}`;
    const result = parseAndRoll(formula);
    const gained = Math.max(1, result.total);
    char.hit_points.max = (char.hit_points.max || 0) + gained;
    char.hit_points.current = (char.hit_points.current || 0) + gained;
    syncHPInputs();
    const maxEl = document.getElementById('hp-max');
    if (maxEl) maxEl.value = char.hit_points.max;
    performRoll(`🎲 Dado de Vida (${formula}) → +${gained} PV máx`, result);
    triggerAutosave();
  });
}

function syncHPInputs() {
  const cur = document.getElementById('hp-current');
  const tmp = document.getElementById('hp-temp');
  if (cur) cur.value = char.hit_points.current;
  if (tmp) tmp.value = char.hit_points.temporary;
}

// ── ATTRIBUTES ────────────────────────────────────
function initAttributes() {
  document.querySelectorAll('.attr-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.tagName === 'INPUT') return;
      const attr = card.dataset.attr;
      if (!attr) return;
      const m = modifier(char.attributes[attr] || 10);
      performRoll(ATTR_FULL[attr], rollD20(m));
    });
  });
}

function recalcModifiers() {
  const brigaoBonus = Math.floor((char.sinfonia?.brigao || 0) / 5);
  ['str','dex','con','int','wis','cha'].forEach(attr => {
    const effective = getEffectiveAttr(char, attr);
    const m = modifier(effective);
    const modEl = document.getElementById(`mod-${attr}`);
    if (modEl) modEl.textContent = fmtMod(m);

    // Show effective score in input (skip if user is currently editing it)
    const scoreEl = document.getElementById(`attr-${attr}`);
    if (scoreEl && document.activeElement !== scoreEl) {
      scoreEl.value = effective;
    }

    const armorBonus = getArmorAttrBonus(char, attr);
    const hasBrigao = ['dex','con','cha'].includes(attr) && brigaoBonus > 0;
    const card = document.querySelector(`.attr-card[data-attr="${attr}"]`);
    modEl?.classList.toggle('brigao-active', hasBrigao);
    card?.classList.toggle('brigao-active', hasBrigao);
    scoreEl?.classList.toggle('attr-score-boosted', armorBonus > 0);
    card?.classList.toggle('attr-armor-boosted', armorBonus > 0);
  });
}

function recalcInitiative() {
  const init = initiative(char);
  const el = document.getElementById('initiative-display');
  if (el) el.textContent = fmtMod(init);
}

function recalcCA() {
  const el = document.getElementById('armor-class-display');
  if (!el) return;
  const base = computeCA(char);
  const stacksBonus = getStacksBonus3000(char);
  el.textContent = base + stacksBonus;
  const badge = document.getElementById('ca-stacks-badge');
  if (badge) {
    badge.textContent = stacksBonus > 0 ? `+${stacksBonus} stacks` : '';
    badge.classList.toggle('hidden', stacksBonus === 0);
  }
}

function recalcSpellStats() {
  const chaMod = modifier(getEffectiveAttr(char, 'cha'));
  const pb = char.proficiency_bonus || 2;
  const dcBonus  = getTalentoBonus(char, 'spell_dc');
  const atkBonus = getTalentoBonus(char, 'spell_atk');
  const cdEl  = document.getElementById('spell-dc-display');
  const atkEl = document.getElementById('spell-atk-display');
  if (cdEl)  cdEl.textContent  = 8 + pb + chaMod + dcBonus;
  if (atkEl) atkEl.textContent = fmtMod(pb + chaMod + atkBonus);
}

function recalcAll() {
  recalcModifiers();
  recalcInitiative();
  recalcCA();
  recalcSaves();
  recalcSkills();
  recalcSpellStats();
  renderBladeFlourish();
  renderBardInspiration();
}

// ── SAVING THROWS ─────────────────────────────────
function renderSaves() {
  const container = document.getElementById('saves-list');
  if (!container) return;
  container.innerHTML = '';

  char.saving_throws.forEach(save => {
    const card = document.createElement('div');
    card.className = 'save-card';
    card.dataset.attr = save.attr;
    const total = saveTotal(char, save);
    card.innerHTML = `
      <div class="save-card-name">${ATTR_LABEL[save.attr]}</div>
      <div class="save-card-total" id="save-total-${save.attr}">${fmtMod(total)}</div>
      <div class="save-card-label">${save.name}</div>
      <div class="save-card-footer">
        <label class="save-prof-label" title="Proficiente">
          <input type="checkbox" class="save-check" data-save="${save.attr}" ${save.proficient ? 'checked' : ''}>
          <span>Prof</span>
        </label>
        <button class="save-roll-btn" data-save-roll="${save.attr}" title="Rolar ${save.name}">🎲</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.addEventListener('change', e => {
    if (!e.target.dataset.save) return;
    const attr = e.target.dataset.save;
    const save = char.saving_throws.find(s => s.attr === attr);
    if (save) {
      save.proficient = e.target.checked;
      recalcSaveEl(attr);
      triggerAutosave();
    }
  });

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-save-roll]');
    if (!btn) return;
    const attr = btn.dataset.saveRoll;
    const save = char.saving_throws.find(s => s.attr === attr);
    if (save) performRoll(`Resistência ${save.name}`, rollD20(saveTotal(char, save)));
  });
}

function recalcSaveEl(attr) {
  const save = char.saving_throws.find(s => s.attr === attr);
  if (!save) return;
  const el = document.getElementById(`save-total-${attr}`);
  if (el) el.textContent = fmtMod(saveTotal(char, save));
}

function recalcSaves() {
  char.saving_throws.forEach(save => recalcSaveEl(save.attr));
}

// ── SKILLS ────────────────────────────────────────
function renderSkills() {
  const container = document.getElementById('skills-list');
  if (!container) return;
  container.innerHTML = '';

  char.skills.forEach(skill => {
    const total = skillTotal(char, skill);
    const row = document.createElement('div');
    row.className = 'skill-row'
      + (skill.proficient ? ' skill-proficient' : '')
      + (skill.expertise ? ' skill-expertise' : '');
    row.dataset.skillId = skill.id;
    row.innerHTML = `
      <div class="skill-card-main">
        <span class="skill-name">${skill.name}</span>
        <span class="skill-attr">${ATTR_LABEL[skill.attr]}</span>
      </div>
      <div class="skill-score-wrap">
        <span class="skill-total" id="skill-total-${skill.id}">${fmtMod(total)}</span>
        <button class="skill-roll-btn" data-skill-roll="${skill.id}" title="Rolar ${skill.name}">🎲</button>
      </div>
      <div class="skill-training">
        <label class="skill-training-toggle skill-training-prof" title="Soma a proficiência uma vez">
          <input type="checkbox" class="skill-check" data-skill="${skill.id}" ${skill.proficient ? 'checked' : ''}>
          <span><b>P</b> Proficiência</span>
        </label>
        <label class="skill-training-toggle skill-training-exp" title="Soma a proficiência duas vezes">
          <input type="checkbox" class="skill-exp-check" data-exp="${skill.id}" ${skill.expertise ? 'checked' : ''}>
          <span><b>E</b> Especialização</span>
        </label>
      </div>
    `;
    container.appendChild(row);
  });

  container.onchange = e => {
    const skillId = e.target.dataset.skill;
    const expId = e.target.dataset.exp;
    if (skillId) {
      const skill = char.skills.find(s => s.id === skillId);
      if (skill) {
        skill.proficient = e.target.checked;
        updateSkillRowStyle(skillId);
        updateSkillTotalEl(skillId);
        triggerAutosave();
      }
    } else if (expId) {
      const skill = char.skills.find(s => s.id === expId);
      if (skill) {
        skill.expertise = e.target.checked;
        updateSkillRowStyle(expId);
        updateSkillTotalEl(expId);
        triggerAutosave();
      }
    }
  };

  container.onclick = e => {
    const btn = e.target.closest('[data-skill-roll]');
    if (!btn) return;
    const skillId = btn.dataset.skillRoll;
    const skill = char.skills.find(s => s.id === skillId);
    if (skill) performRoll(skill.name, rollD20(skillTotal(char, skill)));
  };

  const sinRow = document.createElement('div');
  sinRow.className = 'skill-row skill-sinfonia-special';
  sinRow.id = 'skill-row-sinfonia';
  const sinTotal = sinfoniaSkillTotal(char);
  sinRow.innerHTML = `
    <div class="skill-card-main">
      <span class="skill-name">🎵 Sinfonia</span>
      <span class="skill-attr">CAR</span>
    </div>
    <div class="skill-score-wrap">
      <span class="skill-total" id="skill-total-sinfonia">${fmtMod(sinTotal)}</span>
      <button class="skill-roll-btn" id="btn-roll-sinfonia" title="Rolar Sinfonia">🎲</button>
    </div>
    <div class="skill-special-note">8 + CAR + bônus de stacks</div>
  `;
  sinRow.querySelector('#btn-roll-sinfonia')?.addEventListener('click', () => {
    performRoll('🎵 Sinfonia', rollD20(sinfoniaSkillTotal(char)));
  });
  container.appendChild(sinRow);
}

function updateSkillTotalEl(skillId) {
  const skill = char.skills.find(s => s.id === skillId);
  if (!skill) return;
  const el = document.getElementById(`skill-total-${skillId}`);
  if (el) el.textContent = fmtMod(skillTotal(char, skill));
}

function updateSkillRowStyle(skillId) {
  const row = document.querySelector(`[data-skill-id="${skillId}"]`);
  const skill = char.skills.find(item => item.id === skillId);
  if (!row || !skill) return;
  row.classList.toggle('skill-proficient', skill.proficient);
  row.classList.toggle('skill-expertise', skill.expertise);
}

function recalcSkills() {
  char.skills.forEach(skill => updateSkillTotalEl(skill.id));
}

function rollDamageWithEnerg(formula, label) {
  if (!formula) return;
  const enStacks = char.sinfonia?.energizacao_stacks || 0;
  const dmgBonus = getActiveDamageBonusFormula();
  const stacksBonus = getStacksBonus1500(char);
  const parts = [formula];
  if (dmgBonus) parts.push(dmgBonus);
  if (stacksBonus > 0) parts.push(String(stacksBonus));
  const fullFormula = parts.join('+');
  const baseResult = parseAndRoll(fullFormula);
  if (baseResult.error) { showToast(`Fórmula inválida: ${formula}`, 'error'); return; }
  if (enStacks > 0) {
    const enDice = `${enStacks * 2}d8`;
    const enResult = parseAndRoll(enDice);
    const combined = {
      expression: `${fullFormula} + ${enDice} (Energização)`,
      rolls: [...baseResult.rolls, ...enResult.rolls],
      bonus: baseResult.bonus,
      total: baseResult.total + enResult.total,
    };
    performRoll(`${label} (+${enDice} 🎵 Energ.)`, combined);
  } else {
    performRoll(label, baseResult);
  }
}

// ── ATTACKS ───────────────────────────────────────
function renderAttacks() {
  const container = document.getElementById('combat-weapons-list');
  if (!container) return;
  const weapons = (char.inventory || []).filter(item => item.type === 'Arma');
  if (!weapons.length) {
    container.innerHTML = '<div class="combat-empty">Nenhuma arma cadastrada.</div>';
  } else {
    container.innerHTML = weapons.map(item => {
      const idx = char.inventory.indexOf(item);
      const breakdown = weaponAttackBreakdown(item);
      const abilities = (item.item_abilities || []).length;
      return `
        <article class="combat-weapon-card">
          <header class="combat-weapon-header">
            <div>
              <strong>${esc(item.name || 'Arma')}</strong>
              <div class="spell-tags">
                <span class="ability-tag tag-weapon">${esc(ATTR_LABEL[item.attack_attr || 'dex'])}</span>
                <span class="ability-tag">${esc(item.damage_type || 'Dano não definido')}</span>
                <span class="ability-tag">${esc(item.range || 'Alcance não definido')}</span>
              </div>
            </div>
            <button class="delete-btn-small" data-combat-delete="${idx}" title="Remover arma">✕</button>
          </header>
          <div class="combat-weapon-stats">
            <div><span>Acerto</span><strong>${fmtMod(breakdown.total)}</strong><small>${fmtMod(breakdown.attr)} atributo · +${breakdown.prof} prof${breakdown.extra ? ` · ${fmtMod(breakdown.extra)} adicional` : ''}${breakdown.stacks ? ` · +${breakdown.stacks} stacks` : ''}</small></div>
            <div><span>Dano</span><strong>${esc(item.damage || '—')}</strong><small>${esc(item.damage_type || '')}</small></div>
          </div>
          <div class="combat-weapon-actions">
            <button class="btn btn-sm combat-hit-btn" data-combat-hit="${idx}">🎯 Atacar</button>
            <button class="btn btn-sm use-btn-dmg" data-combat-damage="${idx}" ${item.damage ? '' : 'disabled'}>🎲 Rolar dano</button>
            <button class="btn btn-sm btn-muted" data-combat-abilities="${idx}">✦ Habilidades${abilities ? ` (${abilities})` : ''}</button>
            <button class="btn btn-sm btn-muted" data-combat-edit="${idx}">Editar</button>
          </div>
        </article>
      `;
    }).join('');
  }

  container.onclick = event => {
    const hit = event.target.closest('[data-combat-hit]');
    if (hit) {
      const item = char.inventory[Number(hit.dataset.combatHit)];
      if (item) performRoll(`Ataque — ${item.name}`, rollD20(weaponAttackBreakdown(item).total));
      return;
    }
    const damage = event.target.closest('[data-combat-damage]');
    if (damage) {
      const item = char.inventory[Number(damage.dataset.combatDamage)];
      if (item?.damage) rollDamageWithEnerg(item.damage, `Dano — ${item.name}`);
      return;
    }
    const abilities = event.target.closest('[data-combat-abilities]');
    if (abilities) {
      openWeaponAbilityModal(Number(abilities.dataset.combatAbilities));
      return;
    }
    const edit = event.target.closest('[data-combat-edit]');
    if (edit) {
      openWeaponModal(Number(edit.dataset.combatEdit));
      return;
    }
    const remove = event.target.closest('[data-combat-delete]');
    if (remove) {
      const idx = Number(remove.dataset.combatDelete);
      const item = char.inventory[idx];
      if (item) {
        char.abilities = (char.abilities || []).filter(ab => ab.weapon_ability_id !== item.id);
        char.attacks = (char.attacks || []).filter(atk => atk.inventory_id !== item.id);
        char.inventory.splice(idx, 1);
        renderAttacks();
        renderInventory();
        renderAbilities();
        triggerAutosave();
      }
    }
  };

  const addButton = document.getElementById('btn-add-attack');
  if (addButton) addButton.onclick = () => openWeaponModal();
}

function weaponAttackBreakdown(item) {
  const attr = modifier(getEffectiveAttr(char, item.attack_attr || 'dex'));
  const prof = (char.proficiency_bonus || 2) + getTalentoBonus(char, 'prof');
  const extra = parseInt(item.attack_bonus) || 0;
  const stacks = getStacksBonus1500(char);
  return { attr, prof, extra, stacks, total: attr + prof + extra + stacks };
}

function openWeaponModal(index = null) {
  const existing = index !== null ? char.inventory[index] : null;
  const item = existing ? { ...existing } : newWeaponItem();
  item.attack_attr = item.attack_attr || 'dex';
  const attrOptions = [
    ['str','Força'], ['dex','Destreza'], ['con','Constituição'],
    ['int','Inteligência'], ['wis','Sabedoria'], ['cha','Carisma']
  ].map(([value, label]) => `<option value="${value}" ${item.attack_attr === value ? 'selected' : ''}>${label}</option>`).join('');
  const damageTypes = ['Cortante','Perfurante','Concussão','Ácido','Elétrico','Energia','Fogo','Frio','Necrótico','Psíquico','Radiante','Trovejante','Veneno'];
  const typeOptions = damageTypes.map(type => `<option value="${type}" ${item.damage_type === type ? 'selected' : ''}>${type}</option>`).join('');
  openModal(`
    <h3>${existing ? 'Editar arma' : 'Cadastrar arma'}</h3>
    <div class="weapon-form-grid">
      <div class="form-row weapon-form-wide"><label>Nome</label><input id="mwp-name" value="${esc(item.name || '')}" placeholder="Ex.: Espada longa"></div>
      <div class="form-row"><label>Dano</label><input id="mwp-damage" value="${esc(item.damage || '')}" placeholder="Ex.: 1d8+3"></div>
      <div class="form-row"><label>Tipo de dano</label><select id="mwp-type"><option value="">Selecione</option>${typeOptions}</select></div>
      <div class="form-row"><label>Atributo de ataque</label><select id="mwp-attr">${attrOptions}</select></div>
      <div class="form-row"><label>Bônus adicional momentâneo</label><input id="mwp-extra" type="number" value="${parseInt(item.attack_bonus) || 0}"></div>
      <div class="form-row weapon-form-wide"><label>Alcance</label><input id="mwp-range" value="${esc(item.range || '')}" placeholder="Ex.: Corpo a corpo, 6/18 m"></div>
    </div>
    <p class="weapon-form-hint">O bônus de acerto é calculado automaticamente: modificador do atributo + proficiência + adicional.</p>
    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="modal-save-btn">Salvar arma</button>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('modal-save-btn').onclick = () => {
    item.name = document.getElementById('mwp-name')?.value.trim() || 'Arma';
    item.damage = document.getElementById('mwp-damage')?.value.trim() || '';
    item.damage_type = document.getElementById('mwp-type')?.value || '';
    item.attack_attr = document.getElementById('mwp-attr')?.value || 'dex';
    item.attack_bonus = parseInt(document.getElementById('mwp-extra')?.value) || 0;
    item.range = document.getElementById('mwp-range')?.value.trim() || '';
    if (existing) Object.assign(existing, item);
    else char.inventory.push(item);
    ensureAttackForWeapon(existing || item);
    renderAttacks();
    renderInventory();
    triggerAutosave();
    closeModal();
  };
}

function ensureAttackForWeapon(item) {
  if (!char.attacks) char.attacks = [];
  let attack = char.attacks.find(atk => atk.inventory_id === item.id);
  if (!attack) {
    attack = { inventory_id: item.id };
    char.attacks.push(attack);
  }
  const breakdown = weaponAttackBreakdown(item);
  Object.assign(attack, {
    name: item.name,
    attack_bonus: fmtMod(breakdown.total),
    damage: item.damage,
    damage_type: item.damage_type,
    range: item.range
  });
}

// ── BARDIC INSPIRATION ─────────────────────────────
function initBardInspiration() {
  document.getElementById('btn-bard-inspiration-use')?.addEventListener('click', () => {
    const stats = bardInspirationStats(char);
    if (stats.current <= 0) return;
    const formula = '1d10' + (stats.bonus ? (stats.bonus > 0 ? '+' : '') + stats.bonus : '');
    const result = parseAndRoll(formula);
    if (result.error || !spendBardInspiration(char)) return;
    performRoll('Inspiração de Bardo', result);
    renderBardInspiration(); renderBladeFlourish(); triggerAutosave();
  });
  document.getElementById('btn-bard-inspiration-restore')?.addEventListener('click', () => {
    restoreBardInspiration(char); renderBardInspiration(); triggerAutosave();
  });
  document.getElementById('btn-bard-inspiration-reset')?.addEventListener('click', () => {
    restoreBardInspiration(char, true); renderBardInspiration(); triggerAutosave();
  });
  renderBardInspiration();
}

function renderBardInspiration() {
  const card = document.getElementById('bard-inspiration-card');
  if (!card) return;
  const stats = bardInspirationStats(char);
  card.classList.toggle('sit-active', stats.current > 0);
  document.getElementById('bard-inspiration-count').textContent = stats.current + '/' + stats.max;
  const badge = document.getElementById('bard-inspiration-badge');
  badge.textContent = stats.current > 0 ? 'disponível' : 'esgotada';
  badge.className = 'sit-badge ' + (stats.current > 0 ? 'sit-badge-on' : 'sit-badge-off');
  document.getElementById('bard-inspiration-formula').textContent = '1d10 ' + (stats.bonus >= 0 ? '+ ' : '− ') + Math.abs(stats.bonus) + ' · total = mod. CAR';
  document.getElementById('btn-bard-inspiration-use').disabled = stats.current <= 0;
  document.getElementById('btn-bard-inspiration-restore').disabled = stats.spent === 0;
  document.getElementById('btn-bard-inspiration-reset').disabled = stats.spent === 0;
}

// ── BLADE FLOURISH ────────────────────────────────
function initBladeFlourish() {
  const panel = document.getElementById('blade-flourish-panel');
  if (!panel) return;
  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-flourish-action]');
    if (!button || button.disabled) return;
    const mode = button.dataset.flourishAction;
    const state = bladeFlourishState(char);
    if (state.buffs[mode]) {
      toggleBladeFlourish(char, mode);
    } else {
      const stats = bardInspirationStats(char);
      const formula = mode === 'master' ? '1d6' : '1d10' + (stats.bonus ? (stats.bonus > 0 ? '+' : '') + stats.bonus : '');
      const result = parseAndRoll(formula);
      if (result.error || !toggleBladeFlourish(char, mode, result.total)) return;
      performRoll(mode === 'master' ? 'Dado Floreiro — bônus de CA' : 'Floreio com Inspiração de Bardo — bônus de CA', result);
    }
    recalcAll(); triggerAutosave();
  });
  renderBladeFlourish();
}

function renderBladeFlourish() {
  const panel = document.getElementById('blade-flourish-panel');
  if (!panel) return;
  const enabled = /bardo/i.test(char.class_name || '') && Number(char.level) >= 3;
  panel.classList.toggle('hidden', !enabled);
  if (!enabled) return;
  const state = bladeFlourishState(char);
  const stats = bardInspirationStats(char);
  panel.innerHTML = '<div class="flourish-simple-heading"><h3>Floreio</h3><span aria-live="polite">CA <strong>+' + (state.ca_bonus || 0) + '</strong></span></div><div class="flourish-controls">' +
    ['master', 'inspiration'].map(mode => {
      const buff = state.buffs[mode];
      const label = mode === 'master' ? 'DADO FLOREIRO' : 'INSPIRAÇÃO DE BARDO';
      const disabled = !buff && mode === 'inspiration' && stats.current <= 0;
      const formula = mode === 'master' ? '1d6 · sem gastar inspiração' : '1d10 ' + (stats.bonus >= 0 ? '+ ' : '− ') + Math.abs(stats.bonus) + ' · gasta 1 inspiração';
      return '<button class="btn btn-sm ' + (buff ? 'btn-armor-equipped' : '') + '" data-flourish-action="' + mode + '" aria-pressed="' + Boolean(buff) + '" title="' + (buff ? 'Clique novamente para encerrar o bônus de CA' : formula) + '" ' + (disabled ? 'disabled' : '') + '><span>' + label + '</span><small>' + (buff ? '+' + buff.value + ' CA · clique para encerrar' : formula) + '</small></button>';
    }).join('') + '</div>';
}

// ── ABILITIES ─────────────────────────────────────
function renderAbilities() {
  const container = document.getElementById('abilities-list');
  if (!container) return;
  (char.inventory || []).forEach(item => {
    migrateItemAbilities(item);
    syncItemAbilitiesToChar(item);
  });
  container.innerHTML = '';

  char.abilities.forEach(ab => {
    const card = createAbilityCard(ab);
    container.appendChild(card);
  });

  document.getElementById('btn-add-ability')?.addEventListener('click', openAddAbilityModal, { once: true });
  document.getElementById('btn-restore-all-uses')?.addEventListener('click', () => {
    restoreAllAbilityUses(char);
    renderAbilities();
    triggerAutosave();
  }, { once: true });
}

function createAbilityCard(ab) {
  const card = document.createElement('div');
  card.className = 'ability-card';
  card.dataset.abId = ab.id;

  const usesLeft = ab.uses_max > 0 ? ab.uses_current : null;
  const usesMax  = ab.uses_max  > 0 ? ab.uses_max  : null;
  const pips = buildPips(ab.uses_current, ab.uses_max);
  const noUses = usesMax !== null && usesLeft <= 0;

  const canUse = usesMax === null || (usesLeft !== null && usesLeft > 0);
  const effectiveCat = (ab.category === 'item' && ab.armor_ability_id) ? 'armor' : ab.category;
  const rollType = ab.roll_type || (ab.damage ? 'damage' : 'none');
  const rollIcon = rollType === 'damage' ? '⚔' : rollType === 'heal' ? '♥' : '';
  const rollFormula = ab.formula || ab.damage || '';
  card.innerHTML = `
    <div class="ability-header" data-expand="${ab.id}">
      <div class="ability-header-main">
        <span class="ability-name ${noUses ? 'ability-no-uses' : ''}">${esc(ab.name)}</span>
        <div class="ability-header-tags">
          <span class="ability-tag tag-${effectiveCat}">${CATEGORY_LABELS[effectiveCat] || effectiveCat}</span>
          <span class="ability-tag tag-action">${ACTION_LABELS[ab.action_type] || ab.action_type}</span>
          ${rollType !== 'none' && rollFormula ? `<span class="ability-tag ability-tag-dmg" title="${rollType === 'heal' ? 'Cura' : 'Dano'}">${rollIcon} ${esc(rollFormula)}</span>` : ''}
        </div>
      </div>
      <button class="expand-toggle" data-expand="${ab.id}" title="Expandir" aria-expanded="false">▼</button>
      <button class="delete-btn-small" data-del-ab="${ab.id}" title="Remover">✕</button>
    </div>
    <div class="ability-uses">
      <button class="use-btn ${rollType !== 'none' ? 'use-btn-dmg' : ''}" data-use-ab="${ab.id}" ${noUses ? 'disabled' : ''}>${rollType !== 'none' ? `${rollIcon} Usar e Rolar` : 'Usar'}</button>
      ${usesMax !== null ? `<div class="use-pips">${pips}</div><button class="restore-btn" data-restore-ab="${ab.id}">↺</button>` : ''}
    </div>
    <div class="ability-details" id="ab-details-${ab.id}">
      ${ab.description ? `<p class="ability-desc">${esc(ab.description)}</p>` : ''}
      <div class="ability-meta">
        ${ab.cost ? `<span>Custo: ${esc(ab.cost)}</span>` : ''}
        ${usesMax !== null ? `<span>Usos: ${ab.uses_current}/${ab.uses_max}</span>` : ''}
        <span>${RECOVERY_LABELS[ab.recovery_type] || ab.recovery_type}</span>
      </div>
      <div class="ability-actions">
        ${(ab.weapon_ability_id || ab.armor_ability_id || ab.util_ability_id) ? '' : `<button class="btn btn-sm" data-edit-ab="${ab.id}">Editar</button>`}
      </div>
    </div>
  `;
  return card;
}

function buildPips(current, max) {
  if (max === 0) return '<span class="pip pip-unlimited">∞</span>';
  return Array.from({ length: max }, (_, i) =>
    `<span class="pip ${i < current ? 'pip-filled' : 'pip-empty'}">●</span>`
  ).join('');
}

// Event delegation for abilities list
document.addEventListener('click', e => {
  const container = document.getElementById('abilities-list');
  if (!container) return;

  const useBtn = e.target.closest('[data-use-ab]');
  if (useBtn) {
    const abId = useBtn.dataset.useAb;
    const ab = char.abilities.find(a => a.id === abId);
    spendAbilityUse(char, abId);
    const abRollType = ab?.roll_type || (ab?.damage ? 'damage' : 'none');
    if (abRollType === 'damage') {
      const formula = buildScaledFormula(ab) || ab.damage || '';
      if (formula) rollDamageWithEnerg(formula, `${ab.name} — Dano`);
    } else if (abRollType === 'heal') {
      const formula = buildScaledFormula(ab) || '';
      if (formula) {
        const result = parseAndRoll(formula);
        performRoll(`${ab.name} — Cura`, result);
        applyHeal(char, result.total);
        syncHPInputs();
      }
    }
    if (ab?.util_ability_id) {
      const linkedItem = (char.inventory || []).find(i => i.id === ab.util_ability_id);
      if (linkedItem) triggerItemEffect(linkedItem);
    }
    renderAbilities();
    triggerAutosave();
    return;
  }

  const restoreBtn = e.target.closest('[data-restore-ab]');
  if (restoreBtn) {
    restoreAbilityUse(char, restoreBtn.dataset.restoreAb);
    renderAbilities();
    triggerAutosave();
    return;
  }

  const delBtn = e.target.closest('[data-del-ab]');
  if (delBtn) {
    char.abilities = char.abilities.filter(a => a.id !== delBtn.dataset.delAb);
    renderAbilities();
    triggerAutosave();
    return;
  }

  const editBtn = e.target.closest('[data-edit-ab]');
  if (editBtn) {
    openEditAbilityModal(editBtn.dataset.editAb);
    return;
  }

  const expandBtn = e.target.closest('[data-expand]');
  if (expandBtn) {
    const id = expandBtn.dataset.expand;
    const details = document.getElementById(`ab-details-${id}`);
    const expanded = details?.classList.toggle('expanded') || false;
    const card = expandBtn.closest('.ability-card');
    card?.classList.toggle('ability-card-expanded', expanded);
    card?.querySelector('.expand-toggle')?.setAttribute('aria-expanded', String(expanded));
    return;
  }

  // Add ability button (re-attach after re-render)
  if (e.target.id === 'btn-add-ability') {
    openAddAbilityModal();
  }
  if (e.target.id === 'btn-restore-all-uses') {
    restoreAllAbilityUses(char);
    renderAbilities();
    triggerAutosave();
  }
});

function openAddAbilityModal() {
  const ab = newAbility();
  showAbilityModal(ab, true);
}

function openEditAbilityModal(id) {
  const ab = char.abilities.find(a => a.id === id);
  if (ab) showAbilityModal(ab, false);
}

function showAbilityModal(ab, isNew) {
  const content = `
    <h3>${isNew ? 'Nova Habilidade' : 'Editar Habilidade'}</h3>
    <div class="form-row"><label>Nome</label>
      <input id="mab-name" type="text" value="${esc(ab.name)}"></div>
    <div class="form-row"><label>Categoria</label>
      <select id="mab-cat">
        ${Object.entries(CATEGORY_LABELS).map(([k,v]) =>
          `<option value="${k}" ${ab.category===k?'selected':''}>${v}</option>`).join('')}
      </select></div>
    <div class="form-row"><label>Tipo de Ação</label>
      <select id="mab-action">
        ${Object.entries(ACTION_LABELS).map(([k,v]) =>
          `<option value="${k}" ${ab.action_type===k?'selected':''}>${v}</option>`).join('')}
      </select></div>
    <div class="form-row"><label>Custo</label>
      <input id="mab-cost" type="text" value="${esc(ab.cost)}" placeholder="Ex: 1 uso, 10 PV"></div>
    <div class="form-row"><label>Usos Máximos (0 = ilimitado)</label>
      <input id="mab-uses-max" type="number" min="0" value="${ab.uses_max}"></div>
    <div class="form-row"><label>Usos Atuais</label>
      <input id="mab-uses-cur" type="number" min="0" value="${ab.uses_current}"></div>
    <div class="form-row"><label>Recuperação</label>
      <select id="mab-rec">
        ${Object.entries(RECOVERY_LABELS).map(([k,v]) =>
          `<option value="${k}" ${ab.recovery_type===k?'selected':''}>${v}</option>`).join('')}
      </select></div>
    <div class="form-row"><label>Descrição</label>
      <textarea id="mab-desc" rows="4">${esc(ab.description)}</textarea></div>
    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="modal-save-btn">Salvar</button>
    </div>
  `;
  openModal(content);

  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('modal-save-btn').onclick = () => {
    ab.name = document.getElementById('mab-name').value.trim() || 'Habilidade';
    ab.category = document.getElementById('mab-cat').value;
    ab.action_type = document.getElementById('mab-action').value;
    ab.cost = document.getElementById('mab-cost').value;
    ab.uses_max = parseInt(document.getElementById('mab-uses-max').value) || 0;
    ab.uses_current = Math.min(
      parseInt(document.getElementById('mab-uses-cur').value) || 0,
      ab.uses_max || 999
    );
    ab.recovery_type = document.getElementById('mab-rec').value;
    ab.description = document.getElementById('mab-desc').value;

    if (isNew) char.abilities.push(ab);
    renderAbilities();
    triggerAutosave();
    closeModal();
  };
}

// ── INVENTORY ─────────────────────────────────────
const UTIL_TYPES = ['Consumível', 'Ferramenta', 'Item Mágico', 'Tesouro', 'Munição', 'Outro'];

function renderInventory() {
  if (!char.inventory) char.inventory = [];
  renderWeapons();
  renderArmors();
  renderUtils();
  initInventorySubTabs();
  initInventoryButtons();
}

function renderWeapons() {
  const tbody = document.getElementById('inv-weapons-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const weapons = char.inventory.filter(i => i.type === 'Arma');
  weapons.forEach(item => {
    const idx = char.inventory.indexOf(item);
    const tr = document.createElement('tr');
    const hasAbility = !!(item.ability || item.description);
    tr.innerHTML = `
      <td><input type="text" value="${esc(item.name)}" data-item="${idx}" data-item-field="name" placeholder="Nome"></td>
      <td><input type="text" value="${esc(item.damage||'')}" data-item="${idx}" data-item-field="damage" placeholder="1d6+3" style="width:70px"></td>
      <td><input type="text" value="${esc(item.damage_type||'')}" data-item="${idx}" data-item-field="damage_type" placeholder="Cortante" style="width:70px"></td>
      <td><input type="text" value="${esc(item.range||'')}" data-item="${idx}" data-item-field="range" placeholder="Corpo a corpo" style="width:90px"></td>
      <td><input type="number" min="0" value="${item.quantity||1}" data-item="${idx}" data-item-field="quantity" style="width:40px"></td>
      <td><input type="checkbox" ${item.equipped?'checked':''} data-item="${idx}" data-item-field="equipped"></td>
      <td><button class="skill-roll-btn" data-roll-wpn-dmg="${idx}" title="Rolar dano">🎲</button></td>
      <td>
        <button class="delete-btn-small ${hasAbility ? 'has-ability' : ''}" data-wpn-ability="${idx}" title="Habilidade especial">✦</button>
        <button class="delete-btn-small" data-del-item="${idx}" title="Remover">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('input', onItemChange);
  tbody.addEventListener('change', onItemChange);
  tbody.addEventListener('click', e => {
    const abilityBtn = e.target.closest('[data-wpn-ability]');
    if (abilityBtn) { openWeaponAbilityModal(parseInt(abilityBtn.dataset.wpnAbility)); return; }
    onItemDelete(e);
  });
}

function migrateItemAbilities(item) {
  if (!Array.isArray(item.item_abilities)) {
    item.item_abilities = [];
    if (item.ability_name) {
      item.item_abilities.push({
        id: (item.id || Date.now().toString(36)) + '_a0',
        name: item.ability_name,
        action_type: item.ability_action_type || 'action',
        description: item.ability || '',
        roll_type: item.ability_damage ? 'damage' : 'none',
        formula: item.ability_damage || '',
        scale_attr: '',
        uses_max: item.ability_uses_max ?? 0,
        uses_current: item.ability_uses_max ?? 0,
        recovery_type: item.ability_recovery_type || 'long_rest',
      });
    }
  }
  if (!Array.isArray(item.passives)) item.passives = [];
  if (item.active === undefined) item.active = false;
}

function buildScaledFormula(ab) {
  const formula = ab.formula || '';
  if (!formula) return '';
  if (!ab.scale_attr) return formula;
  const m = modifier(getEffectiveAttr(char, ab.scale_attr));
  if (m === 0) return formula;
  return m > 0 ? `${formula}+${m}` : `${formula}${m}`;
}

function syncItemAbilitiesToChar(item) {
  if (!char.abilities) char.abilities = [];
  const sourceKey = item.type === 'Arma' ? 'weapon_ability_id'
                  : item.type === 'Armadura' ? 'armor_ability_id'
                  : 'util_ability_id';
  // Preserve uses_current from existing entries
  const existing = {};
  char.abilities.filter(a => a[sourceKey] === item.id).forEach(a => {
    existing[a.id] = a.uses_current;
  });
  char.abilities = char.abilities.filter(a => a[sourceKey] !== item.id);
  (item.item_abilities || []).forEach(ia => {
    if (!ia.name) return;
    const ab = {
      id: ia.id,
      [sourceKey]: item.id,
      name: ia.name,
      category: item.type === 'Arma' ? 'weapon' : item.type === 'Armadura' ? 'armor' : 'item',
      action_type: ia.action_type || 'action',
      description: ia.description || '',
      roll_type: ia.roll_type || 'none',
      formula: ia.formula || '',
      scale_attr: ia.scale_attr || '',
      damage: (ia.roll_type === 'damage' && ia.formula) ? ia.formula : '',
      uses_max: ia.uses_max ?? 0,
      uses_current: existing[ia.id] ?? (ia.uses_max ?? 0),
      recovery_type: ia.recovery_type || 'long_rest',
      cost: '',
      notes: '',
    };
    char.abilities.push(ab);
  });
}

// Shared modal for weapon & armor: passives + multiple abilities
function openItemAbilModal(idx) {
  const item = char.inventory[idx];
  if (!item) return;
  migrateItemAbilities(item);
  const isActive = !!item.active;

  const rollableAbils = (item.item_abilities || []).filter(ia => (ia.roll_type || 'none') !== 'none');
  const quickUseHtml = rollableAbils.length > 0 ? `
    <div class="itmab-quick-section">
      ${rollableAbils.map(ia => {
        const icon = ia.roll_type === 'heal' ? '♥' : '⚔';
        const inChar = (char.abilities || []).find(a => a.id === ia.id);
        const usesCur = inChar ? inChar.uses_current : (ia.uses_current || 0);
        const usesMax = inChar ? inChar.uses_max : (ia.uses_max || 0);
        const noUses = usesMax > 0 && usesCur <= 0;
        const usesText = usesMax > 0 ? `${usesCur}/${usesMax} usos` : '∞ usos';
        return `<div class="itmab-quick-use">
          <div class="itmab-qu-info">
            <span class="itmab-qu-name">${esc(ia.name)}</span>
            <span class="itmab-qu-uses">${usesText}</span>
          </div>
          <button class="btn btn-sm itmab-use-btn" data-ia-id="${ia.id}" ${noUses ? 'disabled' : ''}>${icon} Usar e Rolar</button>
        </div>`;
      }).join('')}
    </div>
  ` : '';

  openModal(`
    <h3>✦ ${esc(item.name)} — Passivas & Habilidades</h3>
    ${quickUseHtml}

    <div class="mutil-passive-toggle ${isActive?'mutil-passive-toggle--on':''}" id="itmab-toggle">
      <div class="mutil-passive-toggle-left">
        <span class="mutil-passive-toggle-icon">${isActive?'✦':'◇'}</span>
        <div>
          <div class="mutil-passive-toggle-title">Passivas ativas</div>
          <div class="mutil-passive-toggle-sub">Passivas funcionam enquanto ligado</div>
        </div>
      </div>
      <input type="checkbox" id="itmab-active-chk" class="mutil-passive-chk" ${isActive?'checked':''}>
    </div>

    <div class="mutil-sub-section">
      <div id="itmab-passives-list" class="mutil-passives-list"></div>
      <button type="button" id="itmab-add-passive" class="btn btn-sm btn-muted" style="margin-top:6px">+ Adicionar Passiva</button>
    </div>

    <div class="mutil-ability-section" style="margin-top:14px">
      <div class="mutil-section-hdr">Habilidades <span class="mutil-section-hdr-sub">aparecem na aba Habilidades</span></div>
      <div id="itmab-abilities-list"></div>
      <button type="button" id="itmab-add-ability" class="btn btn-sm btn-muted" style="margin-top:6px">+ Adicionar Habilidade</button>
    </div>

    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="itmab-save-btn">Salvar</button>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;

  document.querySelectorAll('.itmab-use-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const iaId = btn.dataset.iaId;
      const ia = (item.item_abilities || []).find(a => a.id === iaId);
      if (!ia) return;
      const ab = (char.abilities || []).find(a => a.id === iaId);
      if (ab) {
        if (ab.uses_max > 0 && ab.uses_current <= 0) return;
        if (ab.uses_max > 0) ab.uses_current = Math.max(0, ab.uses_current - 1);
        const usesEl = btn.closest('.itmab-quick-use')?.querySelector('.itmab-qu-uses');
        if (usesEl && ab.uses_max > 0) usesEl.textContent = `${ab.uses_current}/${ab.uses_max} usos`;
        btn.disabled = ab.uses_max > 0 && ab.uses_current <= 0;
      }
      const rollType = ia.roll_type || 'none';
      if (rollType === 'damage') {
        const formula = buildScaledFormula(ia) || '';
        if (formula) rollDamageWithEnerg(formula, `${ia.name} — Dano`);
      } else if (rollType === 'heal') {
        const formula = buildScaledFormula(ia) || '';
        if (formula) {
          const result = parseAndRoll(formula);
          performRoll(`${ia.name} — Cura`, result);
          applyHeal(char, result.total);
          syncHPInputs();
        }
      }
      renderAbilities();
      triggerAutosave();
    });
  });

  const toggleEl  = document.getElementById('itmab-toggle');
  const activeChk = document.getElementById('itmab-active-chk');
  toggleEl.addEventListener('click', e => {
    if (e.target !== activeChk) activeChk.checked = !activeChk.checked;
    toggleEl.classList.toggle('mutil-passive-toggle--on', activeChk.checked);
    toggleEl.querySelector('.mutil-passive-toggle-icon').textContent = activeChk.checked ? '✦' : '◇';
  });

  // ── Passives ──
  const localPassives = (item.passives || []).map(p => ({...p}));
  function renderIPassives() {
    const list = document.getElementById('itmab-passives-list');
    if (!list) return;
    list.innerHTML = '';
    localPassives.forEach((p, pi) => {
      const typeOpts = Object.entries(PASSIVE_TYPE_LABELS).map(([k,v]) =>
        `<option value="${k}" ${p.type===k?'selected':''}>${v}</option>`).join('');
      const row = document.createElement('div');
      row.className = 'mutil-passive-row';
      row.innerHTML = `
        <select class="mutil-ptype" data-pi="${pi}">${typeOpts}</select>
        <input class="mutil-pval" type="${p.type === 'passive_ca' ? 'number' : 'text'}" ${p.type === 'passive_ca' ? 'min="0" step="1" aria-label="Bônus de CA"' : ''} data-pi="${pi}" value="${esc(p.value||'')}" placeholder="${p.type === 'passive_ca' ? 'Bônus de CA (ex: 2)' : 'Valor / Fórmula'}">
        <button type="button" class="delete-btn-small mutil-pdel" data-pi="${pi}">✕</button>`;
      list.appendChild(row);
    });
    list.addEventListener('change', e => {
      const pi = parseInt(e.target.dataset.pi);
      if (!isNaN(pi) && e.target.classList.contains('mutil-ptype')) { localPassives[pi].type = e.target.value; renderIPassives(); }
    });
    list.addEventListener('input', e => {
      const pi = parseInt(e.target.dataset.pi);
      if (!isNaN(pi) && e.target.classList.contains('mutil-pval')) localPassives[pi].value = e.target.value;
    });
    list.addEventListener('click', e => {
      const btn = e.target.closest('.mutil-pdel');
      if (btn) { localPassives.splice(parseInt(btn.dataset.pi), 1); renderIPassives(); }
    });
  }
  renderIPassives();
  document.getElementById('itmab-add-passive').onclick = () => {
    localPassives.push({ type: 'passive_damage', value: '' });
    renderIPassives();
  };

  // ── Abilities ──
  const localAbilities = (item.item_abilities || []).map(a => ({...a}));
  const SCALE_OPTS = [
    ['','Sem escala'],['str','+ mod FOR'],['dex','+ mod DES'],['con','+ mod CON'],
    ['int','+ mod INT'],['wis','+ mod SAB'],['cha','+ mod CAR'],
  ];
  const ROLL_TYPE_OPTS = [['none','Sem Rolagem'],['damage','⚔ Dano'],['heal','♥ Cura']];

  function renderIAbils() {
    const list = document.getElementById('itmab-abilities-list');
    if (!list) return;
    list.innerHTML = '';
    localAbilities.forEach((ab, ai) => {
      const actionOpts = Object.entries(ACTION_LABELS).map(([k,v]) =>
        `<option value="${k}" ${(ab.action_type||'action')===k?'selected':''}>${v}</option>`).join('');
      const recovOpts = Object.entries(RECOVERY_LABELS).map(([k,v]) =>
        `<option value="${k}" ${(ab.recovery_type||'long_rest')===k?'selected':''}>${v}</option>`).join('');
      const rollOpts = ROLL_TYPE_OPTS.map(([k,v]) =>
        `<option value="${k}" ${(ab.roll_type||'none')===k?'selected':''}>${v}</option>`).join('');
      const scaleOpts = SCALE_OPTS.map(([k,v]) =>
        `<option value="${k}" ${(ab.scale_attr||'')===k?'selected':''}>${v}</option>`).join('');
      const hasRoll = (ab.roll_type||'none') !== 'none';
      const row = document.createElement('div');
      row.className = 'itmab-ability-row';
      row.dataset.ai = ai;
      row.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <input class="itmab-name" type="text" placeholder="Nome da habilidade" value="${esc(ab.name||'')}" style="flex:1">
          <button type="button" class="delete-btn-small itmab-del" data-ai="${ai}">✕</button>
        </div>
        <div class="mutil-grid-2">
          <div class="form-row"><label style="font-size:.75rem">Ação</label><select class="itmab-action">${actionOpts}</select></div>
          <div class="form-row"><label style="font-size:.75rem">Recuperação</label><select class="itmab-recovery">${recovOpts}</select></div>
        </div>
        <div class="form-row"><label style="font-size:.75rem">Descrição</label>
          <textarea class="itmab-desc" rows="2" placeholder="O que a habilidade faz…">${esc(ab.description||'')}</textarea>
        </div>
        <div class="mutil-grid-2">
          <div class="form-row"><label style="font-size:.75rem">Tipo de Rolagem</label><select class="itmab-roll-type">${rollOpts}</select></div>
          <div class="form-row"><label style="font-size:.75rem">Escala com</label><select class="itmab-scale-attr">${scaleOpts}</select></div>
        </div>
        <div class="itmab-formula-row form-row" ${hasRoll?'':'style="display:none"'}>
          <label style="font-size:.75rem">Fórmula base (ex: 2d6)</label>
          <input class="itmab-formula" type="text" value="${esc(ab.formula||'')}" placeholder="2d6">
        </div>
        <div class="form-row" style="max-width:160px"><label style="font-size:.75rem">Usos máximos (0 = ∞)</label>
          <input class="itmab-uses" type="number" min="0" value="${ab.uses_max??0}" style="width:70px">
        </div>
        <hr style="margin:8px 0 10px;border-color:var(--hairline)">`;
      list.appendChild(row);
    });
    list.addEventListener('input', e => {
      const row = e.target.closest('.itmab-ability-row');
      if (!row) return;
      const ai = parseInt(row.dataset.ai);
      if (isNaN(ai)) return;
      if (e.target.classList.contains('itmab-name')) localAbilities[ai].name = e.target.value;
      else if (e.target.classList.contains('itmab-desc')) localAbilities[ai].description = e.target.value;
      else if (e.target.classList.contains('itmab-formula')) localAbilities[ai].formula = e.target.value;
      else if (e.target.classList.contains('itmab-uses')) localAbilities[ai].uses_max = parseInt(e.target.value)||0;
    });
    list.addEventListener('change', e => {
      const row = e.target.closest('.itmab-ability-row');
      if (!row) return;
      const ai = parseInt(row.dataset.ai);
      if (isNaN(ai)) return;
      if (e.target.classList.contains('itmab-action')) localAbilities[ai].action_type = e.target.value;
      else if (e.target.classList.contains('itmab-recovery')) localAbilities[ai].recovery_type = e.target.value;
      else if (e.target.classList.contains('itmab-scale-attr')) localAbilities[ai].scale_attr = e.target.value;
      else if (e.target.classList.contains('itmab-roll-type')) {
        localAbilities[ai].roll_type = e.target.value;
        const fRow = row.querySelector('.itmab-formula-row');
        if (fRow) fRow.style.display = e.target.value !== 'none' ? '' : 'none';
      }
    });
    list.addEventListener('click', e => {
      const btn = e.target.closest('.itmab-del');
      if (btn) { localAbilities.splice(parseInt(btn.dataset.ai), 1); renderIAbils(); }
    });
  }
  renderIAbils();
  document.getElementById('itmab-add-ability').onclick = () => {
    localAbilities.push({
      id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      name:'', action_type:'action', description:'',
      roll_type:'none', formula:'', scale_attr:'', uses_max:0, uses_current:0, recovery_type:'long_rest',
    });
    renderIAbils();
  };

  document.getElementById('itmab-save-btn').onclick = () => {
    item.active = document.getElementById('itmab-active-chk')?.checked || false;
    item.passives = Array.from(
      document.querySelectorAll('#itmab-passives-list .mutil-passive-row')
    ).map(row => ({
      type: row.querySelector('.mutil-ptype')?.value || 'passive_damage',
      value: (row.querySelector('.mutil-pval')?.value || '').trim(),
    })).filter(p => p.value);
    item.item_abilities = Array.from(
      document.querySelectorAll('#itmab-abilities-list .itmab-ability-row')
    ).map((row, ai) => {
      const prev = localAbilities[ai] || {};
      return {
        id: prev.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,5)),
        name: row.querySelector('.itmab-name')?.value.trim() || '',
        action_type: row.querySelector('.itmab-action')?.value || 'action',
        description: row.querySelector('.itmab-desc')?.value || '',
        roll_type: row.querySelector('.itmab-roll-type')?.value || 'none',
        formula: row.querySelector('.itmab-formula')?.value.trim() || '',
        scale_attr: row.querySelector('.itmab-scale-attr')?.value || '',
        uses_max: parseInt(row.querySelector('.itmab-uses')?.value) || 0,
        uses_current: prev.uses_current ?? (parseInt(row.querySelector('.itmab-uses')?.value) || 0),
        recovery_type: row.querySelector('.itmab-recovery')?.value || 'long_rest',
      };
    }).filter(ia => ia.name);
    syncItemAbilitiesToChar(item);
    recalcAll();
    renderSinfonia();
    renderInventory();
    renderAttacks();
    renderAbilities();
    triggerAutosave();
    closeModal();
  };
}

function openWeaponAbilityModal(idx) { openItemAbilModal(idx); }
function syncWeaponAbility(item) { syncItemAbilitiesToChar(item); }

const ATTR_OPTIONS = [
  ['', '—'], ['str','Força'], ['dex','Destreza'], ['con','Constituição'],
  ['int','Inteligência'], ['wis','Sabedoria'], ['cha','Carisma']
];

function renderArmors() {
  const tbody = document.getElementById('inv-armor-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const armors = char.inventory.filter(i => i.type === 'Armadura');
  armors.forEach(item => {
    const idx = char.inventory.indexOf(item);
    const caPreview = (() => {
      const base = parseInt(item.ac_base) || 0;
      const flat = parseInt(item.ac_flat_bonus) || 0;
      let attrMod = 0;
      if (item.ac_attr) {
        attrMod = modifier(getEffectiveAttr(char, item.ac_attr));
        const cap = parseInt(item.ac_attr_cap) || 0;
        if (cap > 0) attrMod = Math.min(attrMod, cap);
      }
      return base + attrMod + flat;
    })();
    const attrOpts = ATTR_OPTIONS.map(([v, l]) =>
      `<option value="${v}" ${item.ac_attr === v ? 'selected' : ''}>${l}</option>`
    ).join('');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${esc(item.name)}" data-item="${idx}" data-item-field="name" placeholder="Nome" style="min-width:90px"></td>
      <td><input type="number" value="${item.ac_base||0}" data-item="${idx}" data-item-field="ac_base" style="width:46px" title="CA Base fixo"></td>
      <td><select data-item="${idx}" data-item-field="ac_attr" style="font-size:0.8rem;padding:2px 4px">${attrOpts}</select></td>
      <td style="font-weight:900;text-align:center" id="armor-ca-preview-${idx}">${caPreview}</td>
      <td><button class="btn btn-sm ${item.equipped ? 'btn-armor-equipped' : 'btn-muted'}" data-equip-armor="${idx}">${item.equipped ? '✦ Ativa' : 'Equipar'}</button></td>
      <td>
        <button class="delete-btn-small" data-edit-armor="${idx}" title="Editar regras avançadas de CA">✎</button>
        <button class="delete-btn-small ${item.ability_name ? 'has-ability' : ''}" data-armor-ability="${idx}" title="Habilidade especial">⚔</button>
        <button class="delete-btn-small" data-del-item="${idx}" title="Remover">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function initArmorListeners() {
  const tbody = document.getElementById('inv-armor-tbody');
  if (!tbody) return;
  tbody.addEventListener('input', e => {
    const el = e.target;
    if (el.type === 'text') {
      const idx = parseInt(el.dataset.item);
      const field = el.dataset.itemField;
      if (isNaN(idx) || !field || !char.inventory[idx]) return;
      char.inventory[idx][field] = el.value;
      triggerAutosave();
    }
  });
  tbody.addEventListener('change', onArmorChange);
  tbody.addEventListener('click', e => {
    const equipBtn = e.target.closest('[data-equip-armor]');
    if (equipBtn) {
      const idx = parseInt(equipBtn.dataset.equipArmor);
      if (!char.inventory[idx]) return;
      char.inventory[idx].equipped = !char.inventory[idx].equipped;
      recalcAll();
      renderArmors();
      triggerAutosave();
      return;
    }
    const editBtn = e.target.closest('[data-edit-armor]');
    if (editBtn) { openArmorAttrModal(parseInt(editBtn.dataset.editArmor)); return; }
    const abilityBtn = e.target.closest('[data-armor-ability]');
    if (abilityBtn) { openArmorAbilityModal(parseInt(abilityBtn.dataset.armorAbility)); return; }
    onItemDelete(e);
  });
}

const PASSIVE_TYPE_LABELS = {
  passive_damage:   'Bônus de Dano',
  passive_sinfonia: 'Ganho de Sinfonia',
  passive_ca:       'Aumento de CA',
};

const EFFECT_LABELS = {
  none: 'Sem efeito',
  heal: 'Cura HP',
  temp_hp: 'PV Temporários',
  roll: 'Rolar e registrar',
  charges: 'Ganho de Cargas (Sinfonia)',
};
const EFFECT_FORMULA_LABELS = {
  none: null,
  heal: 'Fórmula de cura (ex: 2d4+2)',
  temp_hp: 'Quantidade de PV temporários (ex: 10)',
  roll: 'Fórmula para rolar (ex: 1d6)',
  charges: 'Cargas de Sinfonia a ganhar (ex: 5)',
};

function getActiveSinfoniaGainBonus() {
  return (char.inventory || [])
    .filter(i => i.active && (i.passives || []).length > 0)
    .flatMap(i => i.passives)
    .filter(p => p.type === 'passive_sinfonia' && p.value)
    .reduce((sum, p) => sum + (parseInt(p.value) || 0), 0);
}

function getActiveDamageBonusFormula() {
  return (char.inventory || [])
    .filter(i => i.active && (i.passives || []).length > 0)
    .flatMap(i => i.passives)
    .filter(p => p.type === 'passive_damage' && p.value)
    .map(p => p.value)
    .join('+');
}

function triggerItemEffect(item) {
  const type    = item.effect_type    || 'none';
  const formula = item.effect_formula || '';
  if (type === 'heal' && formula) {
    const roll = parseAndRoll(formula);
    if (!roll.error) { applyHeal(char, roll.total); syncHPInputs(); performRoll(`${item.name} — Cura`, roll); }
  } else if (type === 'temp_hp' && formula) {
    const val = parseInt(formula) || 0;
    if (val > 0) { char.hit_points.temporary = Math.max(char.hit_points.temporary || 0, val); syncHPInputs(); showToast(`${item.name}: +${val} PV Temporários`, 'success'); }
  } else if (type === 'roll' && formula) {
    const roll = parseAndRoll(formula);
    if (!roll.error) performRoll(item.name, roll);
  } else if (type === 'charges' && formula) {
    const amt = parseInt(formula) || 0;
    if (amt > 0) { addSinStacks(amt); showToast(`${item.name}: +${amt} Cargas Sinfônicas`, 'success'); }
  } else {
    showToast(`${item.name} usado.`, 'success');
  }
}

function renderUtils() {
  const old = document.getElementById('inv-util-list');
  if (!old) return;
  // Replace node to wipe accumulated click listeners from previous renders
  const container = old.cloneNode(false);
  old.parentNode.replaceChild(container, old);

  const allUtils = char.inventory.filter(i => i.type !== 'Arma' && i.type !== 'Armadura');
  const passives = allUtils.filter(i => (i.passives||[]).length > 0);
  const regular  = allUtils.filter(i => !(i.passives||[]).length);

  // ── Passivas ──
  const passSec = document.createElement('div');
  passSec.className = 'util-section';
  passSec.innerHTML = '<div class="util-section-title">Passivas</div>';
  if (passives.length === 0) {
    passSec.insertAdjacentHTML('beforeend', '<p class="util-empty">Nenhuma passiva cadastrada.</p>');
  } else {
    passives.forEach(item => {
      const idx = char.inventory.indexOf(item);
      const passiveTags = (item.passives || []).map(p => {
        const lbl = PASSIVE_TYPE_LABELS[p.type] || p.type;
        return `<span class="ability-tag">${esc(lbl)}</span>${p.value ? `<span class="ability-tag tag-action">+${esc(p.value)}</span>` : ''}`;
      }).join('');
      const card = document.createElement('div');
      card.className = 'util-card util-passive-card' + (item.active ? ' util-item-active' : '');
      card.innerHTML = `
        <div class="util-card-header">
          <div class="util-card-left">
            <span class="util-card-name">${esc(item.name)}</span>
            <div class="util-card-meta">${passiveTags}</div>
          </div>
          <div class="util-card-actions">
            <button class="btn btn-sm ${item.active ? 'btn-armor-equipped' : 'btn-muted'}" data-toggle-active="${idx}">${item.active ? '✦ Ativa' : 'Ativar'}</button>
            <button class="delete-btn-small" data-edit-util="${idx}" title="Editar">✎</button>
            <button class="delete-btn-small" data-del-item="${idx}" title="Remover">✕</button>
          </div>
        </div>
        ${item.description ? `<div class="util-card-desc">${esc(item.description)}</div>` : ''}
      `;
      passSec.appendChild(card);
    });
  }
  container.appendChild(passSec);

  // ── Itens ──
  const itemSec = document.createElement('div');
  itemSec.className = 'util-section';
  itemSec.innerHTML = '<div class="util-section-title">Itens</div>';
  if (regular.length === 0) {
    itemSec.insertAdjacentHTML('beforeend', '<p class="util-empty">Nenhum item cadastrado.</p>');
  } else {
    regular.forEach(item => {
      const idx = char.inventory.indexOf(item);
      const qty = item.quantity ?? 1;
      const hasEffect = item.effect_type && item.effect_type !== 'none';
      const card = document.createElement('div');
      card.className = 'util-card' + (item.active ? ' util-item-active' : '');
      card.innerHTML = `
        <div class="util-card-header">
          <div class="util-card-left">
            <span class="util-card-name">${esc(item.name)}</span>
            <div class="util-card-meta">
              <span class="ability-tag">${esc(item.type || 'Item')}</span>
              <span class="util-qty-badge">Qtd: <strong>${qty}</strong></span>
              ${hasEffect ? `<span class="ability-tag tag-action">${esc(EFFECT_LABELS[item.effect_type] || item.effect_type)}${item.effect_formula ? ` (${esc(item.effect_formula)})` : ''}</span>` : ''}
            </div>
          </div>
          <div class="util-card-actions">
            <button class="btn btn-sm ${item.active ? 'btn-armor-equipped' : 'btn-muted'}" data-toggle-active="${idx}">${item.active ? '✦ Ativo' : 'Ativar'}</button>
            <button class="delete-btn-small ${item.ability_name ? 'has-ability' : ''}" data-edit-util="${idx}" title="Editar — habilidade${item.ability_name ? ': '+esc(item.ability_name) : ' não configurada'}">✎</button>
            <button class="delete-btn-small" data-del-item="${idx}" title="Remover">✕</button>
          </div>
        </div>
        ${item.description ? `<div class="util-card-desc">${esc(item.description)}</div>` : ''}
      `;
      itemSec.appendChild(card);
    });
  }
  container.appendChild(itemSec);

  container.addEventListener('click', e => {
    const toggleBtn = e.target.closest('[data-toggle-active]');
    if (toggleBtn) { toggleItemActive(parseInt(toggleBtn.dataset.toggleActive)); return; }
    const editBtn = e.target.closest('[data-edit-util]');
    if (editBtn) { openEditUtilModal(parseInt(editBtn.dataset.editUtil)); return; }
    onItemDelete(e);
  });
}

function toggleItemActive(idx) {
  const item = char.inventory[idx];
  if (!item) return;
  item.active = !item.active;
  recalcAll();
  renderSinfonia();
  renderUtils();
  triggerAutosave();
}

function useItem(idx) {
  const item = char.inventory[idx];
  if (!item || (item.quantity ?? 1) <= 0) return;
  item.quantity = (item.quantity ?? 1) - 1;
  triggerItemEffect(item);
  renderUtils();
  triggerAutosave();
}

function openEditUtilModal(idx) {
  const item = char.inventory[idx];
  if (!item) return;
  migrateItemAbilities(item);
  const typeOpts = UTIL_TYPES.map(t => `<option ${item.type===t?'selected':''}>${t}</option>`).join('');
  const effectOpts = Object.entries(EFFECT_LABELS).map(([k,v]) =>
    `<option value="${k}" ${(item.effect_type||'none')===k?'selected':''}>${v}</option>`).join('');
  const curEffect = item.effect_type || 'none';
  const formulaLabel = EFFECT_FORMULA_LABELS[curEffect] || 'Valor / Fórmula';
  const hasFormulaField = curEffect !== 'none';
  const isPassive = !!item.passive;

  openModal(`
    <h3>${isPassive ? '✦ Passiva' : 'Item'}</h3>

    <div class="mutil-grid-2">
      <div class="form-row"><label>Nome</label><input id="mutil-name" type="text" value="${esc(item.name)}"></div>
      <div class="form-row"><label>Tipo</label><select id="mutil-type">${typeOpts}</select></div>
    </div>
    <div class="form-row"><label>Descrição</label><textarea id="mutil-desc" rows="2" placeholder="O que o item é ou faz…">${esc(item.description || '')}</textarea></div>

    <div class="mutil-passive-toggle ${isPassive ? 'mutil-passive-toggle--on' : ''}" id="mutil-passive-toggle">
      <div class="mutil-passive-toggle-left">
        <span class="mutil-passive-toggle-icon">${isPassive ? '✦' : '◇'}</span>
        <div>
          <div class="mutil-passive-toggle-title">Passiva</div>
          <div class="mutil-passive-toggle-sub">Efeito sempre ativo quando o item estiver equipado</div>
        </div>
      </div>
      <input type="checkbox" id="mutil-is-passive" class="mutil-passive-chk" ${isPassive?'checked':''}>
    </div>

    <div id="mutil-passive-section" ${isPassive?'':'style="display:none"'} class="mutil-sub-section">
      <div id="mutil-passives-list" class="mutil-passives-list"></div>
      <button type="button" id="mutil-add-passive-row" class="btn btn-sm btn-muted" style="margin-top:6px">+ Adicionar Passiva</button>
    </div>

    <div id="mutil-item-section" ${isPassive?'style="display:none"':''} class="mutil-sub-section">
      <div class="form-row" style="max-width:140px"><label>Quantidade</label><input id="mutil-qty" type="number" min="0" value="${item.quantity ?? 1}"></div>
      <div class="form-row"><label>Efeito ao ativar</label><select id="mutil-effect">${effectOpts}</select></div>
      <div class="form-row" id="mutil-formula-row" ${hasFormulaField?'':'style="display:none"'}>
        <label id="mutil-formula-label">${formulaLabel}</label>
        <input id="mutil-formula" type="text" value="${esc(item.effect_formula || '')}" placeholder="${formulaLabel}">
      </div>
    </div>

    <div class="mutil-ability-section" style="margin-top:14px">
      <div class="mutil-section-hdr">Habilidades <span class="mutil-section-hdr-sub">aparecem na aba Habilidades</span></div>
      <div id="itmab-abilities-list"></div>
      <button type="button" id="itmab-add-ability" class="btn btn-sm btn-muted" style="margin-top:6px">+ Adicionar Habilidade</button>
    </div>

    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="mutil-save-btn">Salvar</button>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;

  const isPassiveChk = document.getElementById('mutil-is-passive');
  const passiveSec   = document.getElementById('mutil-passive-section');
  const itemSec      = document.getElementById('mutil-item-section');
  const toggleEl     = document.getElementById('mutil-passive-toggle');

  let localPassives = (item.passives || []).map(p => ({ ...p }));

  function renderPassiveRows() {
    const list = document.getElementById('mutil-passives-list');
    if (!list) return;
    list.innerHTML = '';
    localPassives.forEach((p, i) => {
      const typeOpts = Object.entries(PASSIVE_TYPE_LABELS).map(([k, v]) =>
        `<option value="${k}" ${p.type === k ? 'selected' : ''}>${v}</option>`).join('');
      const row = document.createElement('div');
      row.className = 'mutil-passive-row';
      row.innerHTML = `
        <select class="mutil-ptype" data-pi="${i}">${typeOpts}</select>
        <input class="mutil-pval" type="${p.type === 'passive_ca' ? 'number' : 'text'}" ${p.type === 'passive_ca' ? 'min="0" step="1" aria-label="Bônus de CA"' : ''} data-pi="${i}" value="${esc(p.value||'')}" placeholder="${p.type === 'passive_ca' ? 'Bônus de CA (ex: 2)' : 'Valor / Fórmula'}">
        <button type="button" class="delete-btn-small mutil-pdel" data-pi="${i}">✕</button>`;
      list.appendChild(row);
    });
    list.addEventListener('change', e => {
      const pi = parseInt(e.target.dataset.pi);
      if (!isNaN(pi) && e.target.classList.contains('mutil-ptype')) { localPassives[pi].type = e.target.value; renderPassiveRows(); }
    });
    list.addEventListener('input', e => {
      const pi = parseInt(e.target.dataset.pi);
      if (!isNaN(pi) && e.target.classList.contains('mutil-pval')) localPassives[pi].value = e.target.value;
    });
    list.addEventListener('click', e => {
      const btn = e.target.closest('.mutil-pdel');
      if (btn) { localPassives.splice(parseInt(btn.dataset.pi), 1); renderPassiveRows(); }
    });
  }
  renderPassiveRows();
  document.getElementById('mutil-add-passive-row')?.addEventListener('click', () => {
    localPassives.push({ type: 'passive_damage', value: '' });
    renderPassiveRows();
  });

  toggleEl.addEventListener('click', e => {
    if (e.target !== isPassiveChk) isPassiveChk.checked = !isPassiveChk.checked;
    const on = isPassiveChk.checked;
    toggleEl.classList.toggle('mutil-passive-toggle--on', on);
    toggleEl.querySelector('.mutil-passive-toggle-icon').textContent = on ? '✦' : '◇';
    passiveSec.style.display = on ? '' : 'none';
    itemSec.style.display    = on ? 'none' : '';
  });

  const effectSel = document.getElementById('mutil-effect');
  effectSel?.addEventListener('change', () => {
    const t = effectSel.value;
    const lbl = EFFECT_FORMULA_LABELS[t];
    const fRow = document.getElementById('mutil-formula-row');
    const fLbl = document.getElementById('mutil-formula-label');
    const fInp = document.getElementById('mutil-formula');
    if (lbl) { fRow.style.display = ''; fLbl.textContent = lbl; fInp.placeholder = lbl; }
    else fRow.style.display = 'none';
  });

  // Abilities list (shared pattern)
  const localAbilities = (item.item_abilities || []).map(a => ({...a}));
  const SCALE_OPTS_U = [
    ['','Sem escala'],['str','+ mod FOR'],['dex','+ mod DES'],['con','+ mod CON'],
    ['int','+ mod INT'],['wis','+ mod SAB'],['cha','+ mod CAR'],
  ];
  const ROLL_OPTS_U = [['none','Sem Rolagem'],['damage','⚔ Dano'],['heal','♥ Cura']];

  function renderUAbils() {
    const list = document.getElementById('itmab-abilities-list');
    if (!list) return;
    list.innerHTML = '';
    localAbilities.forEach((ab, ai) => {
      const actionOpts = Object.entries(ACTION_LABELS).map(([k,v]) =>
        `<option value="${k}" ${(ab.action_type||'action')===k?'selected':''}>${v}</option>`).join('');
      const recovOpts = Object.entries(RECOVERY_LABELS).map(([k,v]) =>
        `<option value="${k}" ${(ab.recovery_type||'long_rest')===k?'selected':''}>${v}</option>`).join('');
      const rollOpts = ROLL_OPTS_U.map(([k,v]) =>
        `<option value="${k}" ${(ab.roll_type||'none')===k?'selected':''}>${v}</option>`).join('');
      const scaleOpts = SCALE_OPTS_U.map(([k,v]) =>
        `<option value="${k}" ${(ab.scale_attr||'')===k?'selected':''}>${v}</option>`).join('');
      const hasRoll = (ab.roll_type||'none') !== 'none';
      const row = document.createElement('div');
      row.className = 'itmab-ability-row';
      row.dataset.ai = ai;
      row.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <input class="itmab-name" type="text" placeholder="Nome" value="${esc(ab.name||'')}" style="flex:1">
          <button type="button" class="delete-btn-small itmab-del" data-ai="${ai}">✕</button>
        </div>
        <div class="mutil-grid-2">
          <div class="form-row"><label style="font-size:.75rem">Ação</label><select class="itmab-action">${actionOpts}</select></div>
          <div class="form-row"><label style="font-size:.75rem">Recuperação</label><select class="itmab-recovery">${recovOpts}</select></div>
        </div>
        <div class="form-row"><label style="font-size:.75rem">Descrição</label>
          <textarea class="itmab-desc" rows="2" placeholder="O que a habilidade faz…">${esc(ab.description||'')}</textarea>
        </div>
        <div class="mutil-grid-2">
          <div class="form-row"><label style="font-size:.75rem">Tipo de Rolagem</label><select class="itmab-roll-type">${rollOpts}</select></div>
          <div class="form-row"><label style="font-size:.75rem">Escala com</label><select class="itmab-scale-attr">${scaleOpts}</select></div>
        </div>
        <div class="itmab-formula-row form-row" ${hasRoll?'':'style="display:none"'}>
          <label style="font-size:.75rem">Fórmula base (ex: 2d6)</label>
          <input class="itmab-formula" type="text" value="${esc(ab.formula||'')}" placeholder="2d6">
        </div>
        <div class="form-row" style="max-width:160px"><label style="font-size:.75rem">Usos máximos (0 = ∞)</label>
          <input class="itmab-uses" type="number" min="0" value="${ab.uses_max??0}" style="width:70px">
        </div>
        <hr style="margin:8px 0 10px;border-color:var(--hairline)">`;
      list.appendChild(row);
    });
    list.addEventListener('input', e => {
      const row = e.target.closest('.itmab-ability-row');
      if (!row) return;
      const ai = parseInt(row.dataset.ai);
      if (isNaN(ai)) return;
      if (e.target.classList.contains('itmab-name')) localAbilities[ai].name = e.target.value;
      else if (e.target.classList.contains('itmab-desc')) localAbilities[ai].description = e.target.value;
      else if (e.target.classList.contains('itmab-formula')) localAbilities[ai].formula = e.target.value;
      else if (e.target.classList.contains('itmab-uses')) localAbilities[ai].uses_max = parseInt(e.target.value)||0;
    });
    list.addEventListener('change', e => {
      const row = e.target.closest('.itmab-ability-row');
      if (!row) return;
      const ai = parseInt(row.dataset.ai);
      if (isNaN(ai)) return;
      if (e.target.classList.contains('itmab-action')) localAbilities[ai].action_type = e.target.value;
      else if (e.target.classList.contains('itmab-recovery')) localAbilities[ai].recovery_type = e.target.value;
      else if (e.target.classList.contains('itmab-scale-attr')) localAbilities[ai].scale_attr = e.target.value;
      else if (e.target.classList.contains('itmab-roll-type')) {
        localAbilities[ai].roll_type = e.target.value;
        const fRow = row.querySelector('.itmab-formula-row');
        if (fRow) fRow.style.display = e.target.value !== 'none' ? '' : 'none';
      }
    });
    list.addEventListener('click', e => {
      const btn = e.target.closest('.itmab-del');
      if (btn) { localAbilities.splice(parseInt(btn.dataset.ai), 1); renderUAbils(); }
    });
  }
  renderUAbils();
  document.getElementById('itmab-add-ability').onclick = () => {
    localAbilities.push({
      id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      name:'', action_type:'action', description:'',
      roll_type:'none', formula:'', scale_attr:'', uses_max:0, uses_current:0, recovery_type:'long_rest',
    });
    renderUAbils();
  };

  document.getElementById('mutil-save-btn').onclick = () => {
    item.name        = document.getElementById('mutil-name')?.value.trim() || item.name;
    item.type        = document.getElementById('mutil-type')?.value || item.type;
    item.description = document.getElementById('mutil-desc')?.value || '';
    item.passive     = document.getElementById('mutil-is-passive')?.checked || false;
    item.passives    = Array.from(
      document.querySelectorAll('#mutil-passives-list .mutil-passive-row')
    ).map(row => ({
      type: row.querySelector('.mutil-ptype')?.value || 'passive_damage',
      value: (row.querySelector('.mutil-pval')?.value || '').trim(),
    })).filter(p => p.value);
    if (!item.passive) {
      item.quantity       = parseInt(document.getElementById('mutil-qty')?.value) ?? 1;
      item.effect_type    = document.getElementById('mutil-effect')?.value || 'none';
      item.effect_formula = document.getElementById('mutil-formula')?.value.trim() || '';
    }
    item.item_abilities = Array.from(
      document.querySelectorAll('#itmab-abilities-list .itmab-ability-row')
    ).map((row, ai) => {
      const prev = localAbilities[ai] || {};
      return {
        id: prev.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,5)),
        name: row.querySelector('.itmab-name')?.value.trim() || '',
        action_type: row.querySelector('.itmab-action')?.value || 'action',
        description: row.querySelector('.itmab-desc')?.value || '',
        roll_type: row.querySelector('.itmab-roll-type')?.value || 'none',
        formula: row.querySelector('.itmab-formula')?.value.trim() || '',
        scale_attr: row.querySelector('.itmab-scale-attr')?.value || '',
        uses_max: parseInt(row.querySelector('.itmab-uses')?.value) || 0,
        uses_current: prev.uses_current ?? (parseInt(row.querySelector('.itmab-uses')?.value) || 0),
        recovery_type: row.querySelector('.itmab-recovery')?.value || 'long_rest',
      };
    }).filter(ia => ia.name);
    syncItemAbilitiesToChar(item);
    renderUtils();
    renderAbilities();
    recalcAll();
    triggerAutosave();
    closeModal();
  };
}

function syncUtilAbility(item) { syncItemAbilitiesToChar(item); }

function onItemChange(e) {
  const el = e.target;
  const idx = parseInt(el.dataset.item);
  const field = el.dataset.itemField;
  if (isNaN(idx) || !field) return;
  if (!char.inventory[idx]) return;
  let value = el.value;
  if (el.type === 'checkbox') value = el.checked;
  if (el.type === 'number') value = parseFloat(value) || 0;
  char.inventory[idx][field] = value;
  syncAttackFromWeapon(char.inventory[idx]);
  triggerAutosave();
}

function syncAttackFromWeapon(item) {
  if (!item || item.type !== 'Arma' || !item.id) return;
  ensureAttackForWeapon(item);
  renderAttacks();
}

function onArmorChange(e) {
  const el = e.target;
  if (el.type === 'text') return; // handled by input listener without re-render
  const idx = parseInt(el.dataset.item);
  const field = el.dataset.itemField;
  if (isNaN(idx) || !field) return;
  if (!char.inventory[idx]) return;
  let value = el.value;
  if (el.type === 'checkbox') value = el.checked;
  if (el.type === 'number') value = parseFloat(value) || 0;
  char.inventory[idx][field] = value;
  recalcAll();
  renderArmors();
  triggerAutosave();
}

function onItemDelete(e) {
  const rollBtn = e.target.closest('[data-roll-wpn-dmg]');
  if (rollBtn) {
    const idx = parseInt(rollBtn.dataset.rollWpnDmg);
    const item = char.inventory[idx];
    if (item?.damage) rollDamageWithEnerg(item.damage, `Dano — ${item.name || 'Arma'}`);
    return;
  }
  const btn = e.target.closest('[data-del-item]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.delItem);
  const item = char.inventory[idx];
  if (item?.id) {
    if (item.type === 'Arma') {
      char.attacks = (char.attacks || []).filter(a => a.inventory_id !== item.id);
      char.abilities = (char.abilities || []).filter(a => a.weapon_ability_id !== item.id);
      renderAttacks();
    } else if (item.type === 'Armadura') {
      char.abilities = (char.abilities || []).filter(a => a.armor_ability_id !== item.id);
    } else {
      char.abilities = (char.abilities || []).filter(a => a.util_ability_id !== item.id);
    }
    renderAbilities();
  }
  char.inventory.splice(idx, 1);
  renderInventory();
  recalcAll();
  triggerAutosave();
}

function openArmorAttrModal(idx) {
  const item = char.inventory[idx];
  if (!item) return;
  if (!item.attr_bonuses) item.attr_bonuses = { str:0, dex:0, con:0, int:0, wis:0, cha:0 };
  const ab = item.attr_bonuses;

  const attrSelectOpts = ATTR_OPTIONS.map(([k,label]) =>
    `<option value="${k}" ${(item.ac_attr||'')=== k?'selected':''}>${label}</option>`
  ).join('');

  const attrBonusRows = [
    ['str','Força'], ['dex','Destreza'], ['con','Constituição'],
    ['int','Inteligência'], ['wis','Sabedoria'], ['cha','Carisma']
  ].map(([k,label]) => `
    <div class="form-row"><label>${label}</label>
      <input id="marmor-${k}" type="number" value="${ab[k]||0}" style="width:70px">
    </div>`).join('');

  openModal(`
    <h3>Configurar CA — ${esc(item.name)}</h3>
    <div class="form-row"><label>CA Base (fixo)</label>
      <input id="marmor-ac-base" type="number" value="${item.ac_base||0}" style="width:70px" title="Valor fixo da armadura">
    </div>
    <div class="form-row"><label>Atributo somado à CA</label>
      <select id="marmor-ac-attr">${attrSelectOpts}</select>
    </div>
    <div class="form-row"><label>Cap do atributo (0 = sem limite)</label>
      <input id="marmor-ac-cap" type="number" min="0" value="${item.ac_attr_cap||0}" style="width:70px" title="Ex: 2 para armadura média">
    </div>
    <div class="form-row"><label>Bônus CA flat (escudo etc.)</label>
      <input id="marmor-ac-flat" type="number" value="${item.ac_flat_bonus||0}" style="width:70px">
    </div>
    <hr style="margin:10px 0;border-color:var(--hairline)">
    <p style="font-size:0.82rem;font-weight:800;margin-bottom:6px">Bônus de Atributos do Personagem</p>
    <p style="font-size:0.76rem;color:var(--muted);margin-bottom:10px">Afeta modificadores do personagem enquanto equipada.</p>
    ${attrBonusRows}
    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="modal-save-btn">Salvar</button>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('modal-save-btn').onclick = () => {
    item.ac_base      = parseInt(document.getElementById('marmor-ac-base')?.value) || 0;
    item.ac_attr      = document.getElementById('marmor-ac-attr')?.value || '';
    item.ac_attr_cap  = parseInt(document.getElementById('marmor-ac-cap')?.value) || 0;
    item.ac_flat_bonus = parseInt(document.getElementById('marmor-ac-flat')?.value) || 0;
    ['str','dex','con','int','wis','cha'].forEach(k => {
      item.attr_bonuses[k] = parseInt(document.getElementById(`marmor-${k}`)?.value) || 0;
    });
    renderArmors();
    recalcAll();
    triggerAutosave();
    closeModal();
  };
}

function openArmorAbilityModal(idx) { openItemAbilModal(idx); }
function syncArmorAbility(item) { syncItemAbilitiesToChar(item); }

function initInventorySubTabs() {
  document.querySelectorAll('.inv-tab-btn').forEach(btn => {
    btn.onclick = null;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.inv-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.inv-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`inv-tab-${btn.dataset.invTab}`);
      if (panel) panel.classList.add('active');
    });
  });
}

function initInventoryButtons() {
  const btnWeapon = document.getElementById('btn-add-weapon');
  if (btnWeapon) {
    btnWeapon.replaceWith(btnWeapon.cloneNode(true));
    document.getElementById('btn-add-weapon').addEventListener('click', () => openWeaponModal());
  }
  const btnArmor = document.getElementById('btn-add-armor');
  if (btnArmor) {
    btnArmor.replaceWith(btnArmor.cloneNode(true));
    document.getElementById('btn-add-armor').addEventListener('click', () => {
      char.inventory.push(newArmorItem());
      renderInventory();
      triggerAutosave();
    });
  }
  const btnUtil = document.getElementById('btn-add-util');
  if (btnUtil) {
    btnUtil.replaceWith(btnUtil.cloneNode(true));
    document.getElementById('btn-add-util').addEventListener('click', () => {
      const item = newItem();
      char.inventory.push(item);
      renderUtils();
      triggerAutosave();
      openEditUtilModal(char.inventory.indexOf(item));
    });
  }
}

// ── SINFONIA ──────────────────────────────────────
function initSinfonia() {
  if (!char.instabilidade_sinf) char.instabilidade_sinf = [];
  if (!char.sinfonia) {
    char.sinfonia = { stacks: 0, brigao: 0, kit: {
      fortalecimento: { uses: 4, max: 4 },
      bomba: { uses: 3, max: 3 },
      sincronizacao: { uses: 3, max: 3 },
    }};
  }
  const k = char.sinfonia.kit;
  if (!k) char.sinfonia.kit = { fortalecimento:{uses:3,max:3}, bomba:{uses:3,max:3}, sincronizacao:{uses:3,max:3} };
  if (!k.fortalecimento) k.fortalecimento = {uses:4,max:4};
  if (!k.bomba) k.bomba = {uses:3,max:3};
  if (!k.sincronizacao) k.sincronizacao = {uses:3,max:3};

  renderSinfonia();
  bindSinfoniaEvents();
}

function renderSinfonia() {
  const sin = char.sinfonia;
  if (!sin) return;

  const stacksEl = document.getElementById('sin-stacks-num');
  if (stacksEl) stacksEl.textContent = sin.stacks ?? 0;

  const brigaoNum = document.getElementById('brigao-num');
  if (brigaoNum) brigaoNum.textContent = sin.brigao ?? 0;

  const pipsEl = document.getElementById('brigao-pips');
  if (pipsEl) {
    pipsEl.innerHTML = Array.from({ length: 15 }, (_, i) => {
      const tier = Math.floor(i / 5);
      const on = i < (sin.brigao ?? 0);
      return `<span class="brigao-pip ${on ? `pip-on tier-${tier}` : 'pip-off'}"></span>`;
    }).join('');
  }

  const bonus = Math.floor((sin.brigao ?? 0) / 5);
  const statusEl = document.getElementById('brigao-status-text');
  if (statusEl) {
    statusEl.textContent = bonus > 0
      ? `Bônus ativo: +${bonus} DES / CON / CAR`
      : `Sem bônus ativo (próximo em ${5 - ((sin.brigao ?? 0) % 5)} cargas)`;
    statusEl.className = 'brigao-status' + (bonus > 0 ? ' brigao-status-active' : '');
  }

  const extraEl = document.getElementById('brigao-extra-dice');
  if (extraEl) {
    extraEl.innerHTML = (sin.brigao ?? 0) >= 15
      ? '<span class="brigao-badge">🎵 EXTRA DADO em ataques físicos!</span>'
      : `<span class="brigao-badge-off">${15 - (sin.brigao ?? 0)} cargas para Extra Dado</span>`;
  }

  renderKitUses('fort', sin.kit.fortalecimento);
  renderKitUses('sinc', sin.kit.sincronizacao);

  const perfNumEl = document.getElementById('perf-gain-num');
  if (perfNumEl) perfNumEl.textContent = 2 + getActiveSinfoniaGainBonus();
  const sincGainEl = document.getElementById('sinc-gain-num');
  if (sincGainEl) sincGainEl.textContent = 1 + getActiveSinfoniaGainBonus();

  // Energização stacks
  const enStacks = sin.energizacao_stacks || 0;
  document.getElementById('kit-energizacao')?.classList.toggle('kit-card-active', enStacks > 0);
  document.getElementById('btn-energ-reset')?.classList.toggle('hidden', enStacks === 0);

  // Energização situational card
  const enCard = document.getElementById('energ-status-card');
  const enStatusDisp = document.getElementById('energ-status-display');
  const enBadge = enCard?.querySelector('.sit-badge');
  const enReset = document.getElementById('btn-energ-reset-bar');
  if (enCard) enCard.classList.toggle('sit-active', enStacks > 0);
  if (enBadge) { enBadge.textContent = enStacks > 0 ? 'ativa' : 'inativa'; enBadge.className = `sit-badge ${enStacks > 0 ? 'sit-badge-on' : 'sit-badge-off'}`; }
  if (enStatusDisp) enStatusDisp.textContent = enStacks > 0 ? `+${enStacks * 2}d8` : '—';
  if (enReset) enReset.classList.toggle('hidden', enStacks === 0);

  // Threshold stacks display
  const thr1500 = getStacksBonus1500(char);
  const thr3000 = getStacksBonus3000(char);
  const thrEl = document.getElementById('stacks-threshold-display');
  if (thrEl) {
    if (thr1500 > 0) {
      const next1500 = 1500 - ((sin.stacks ?? 0) % 1500);
      thrEl.innerHTML = `<span class="stacks-thr-badge">+${thr1500} dano/acerto</span><span class="stacks-thr-next"> · prox. em ${next1500}</span>`;
    } else {
      const next1500 = 1500 - ((sin.stacks ?? 0) % 1500);
      thrEl.innerHTML = `<span class="stacks-thr-next">+1 dano/acerto em ${next1500} stacks</span>`;
    }
  }

  // Sinfonia skill display in sinfonia tab
  const sinSkillEl = document.getElementById('sinfonia-skill-value');
  if (sinSkillEl) sinSkillEl.textContent = fmtMod(sinfoniaSkillTotal(char));

  // Update Sinfonia skill row in skills tab if visible
  const sinSkillRow = document.getElementById('skill-total-sinfonia');
  if (sinSkillRow) sinSkillRow.textContent = fmtMod(sinfoniaSkillTotal(char));

  recalcCA();

  renderBardInspiration();
  document.getElementById('recarga-vantagem-status')?.classList.toggle('hidden', !sin.vantagem_active);

  // Vantagem situational card
  const vanCard = document.getElementById('vantagem-status-card');
  const vanBadge = vanCard?.querySelector('.sit-badge');
  const vanConsumirBtn = document.getElementById('btn-vantagem-consumir');
  if (vanCard) vanCard.classList.toggle('sit-active', !!sin.vantagem_active);
  if (vanBadge) { vanBadge.textContent = sin.vantagem_active ? 'ativa' : 'inativa'; vanBadge.className = `sit-badge ${sin.vantagem_active ? 'sit-badge-on' : 'sit-badge-off'}`; }
  if (vanConsumirBtn) vanConsumirBtn.classList.toggle('hidden', !sin.vantagem_active);

  // Sincronização state
  const sincActive = !!sin.sincronizacao_active;
  document.getElementById('kit-sincronizacao')?.classList.toggle('kit-card-active', sincActive);
  document.getElementById('sinc-banner')?.classList.toggle('hidden', !sincActive);
  document.getElementById('btn-sinc-usar')?.classList.toggle('hidden', sincActive);
  document.getElementById('btn-sinc-desativar')?.classList.toggle('hidden', !sincActive);
  const acertoBtn = document.getElementById('btn-sinc-acerto');
  if (acertoBtn) acertoBtn.disabled = !sincActive;
}

function renderKitUses(key, kitItem) {
  const el = document.getElementById(`kit-${key}-uses`);
  if (!el || !kitItem) return;
  el.innerHTML = Array.from({ length: kitItem.max }, (_, i) =>
    `<span class="pip ${i < kitItem.uses ? 'pip-filled' : 'pip-empty'}">●</span>`
  ).join('');
}

function addSinStacks(delta, skipBonus = false) {
  if (!char.sinfonia) return;
  const bonus = (!skipBonus && delta > 0) ? getActiveSinfoniaGainBonus() : 0;
  char.sinfonia.stacks = Math.max(0, (char.sinfonia.stacks ?? 0) + delta + bonus);
  renderSinfonia();
  triggerAutosave();
}

function addBrigao(delta, skipBonus = false) {
  if (!char.sinfonia) return;
  const prev = char.sinfonia.brigao ?? 0;
  const brigBonus = (!skipBonus && delta > 0) ? getActiveSinfoniaGainBonus() : 0;
  const next = Math.max(0, Math.min(15, prev + delta + brigBonus));
  const actual = next - prev;
  char.sinfonia.brigao = next;
  recalcAll();
  if (delta < 0) {
    renderSinfonia();
    triggerAutosave();
  } else if (skipBonus) {
    char.sinfonia.stacks = Math.max(0, (char.sinfonia.stacks ?? 0) + actual);
    renderSinfonia();
    triggerAutosave();
  } else {
    addSinStacks(delta);
  }
}

function bindSinfoniaEvents() {
  document.querySelectorAll('[data-sin-adj]').forEach(btn => {
    btn.addEventListener('click', () => addSinStacks(parseInt(btn.dataset.sinAdj), true));
  });

  document.getElementById('btn-sin-perf')?.addEventListener('click', () => addBrigao(2));

  document.getElementById('btn-roll-sinfonia-tab')?.addEventListener('click', () => {
    performRoll('🎵 Sinfonia', rollD20(sinfoniaSkillTotal(char)));
  });

  document.querySelectorAll('[data-brigao-adj]').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.brigaoAdj);
      addBrigao(delta, Math.abs(delta) === 5);
    });
  });

  document.getElementById('btn-fort-usar')?.addEventListener('click', () => {
    const kit = char.sinfonia?.kit?.fortalecimento;
    if (!kit || kit.uses <= 0) { showToast('Sem usos de Fortalecimento!', 'warning'); return; }
    const result = parseAndRoll('2d8');
    performRoll('Fortalecimento Musical 💥 (2d8)', result);
    kit.uses--;
    addBrigao(result.total);
    renderSinfonia();
    triggerAutosave();
  });
  document.getElementById('btn-fort-rest')?.addEventListener('click', () => {
    const k = char.sinfonia?.kit?.fortalecimento;
    if (k) { k.uses = k.max; renderSinfonia(); triggerAutosave(); }
  });

  document.getElementById('btn-bomba-usar')?.addEventListener('click', () => {
    if ((char.sinfonia?.brigao ?? 0) < 5) { showToast('Brigão insuficiente! Precisa de 5 cargas.', 'warning'); return; }
    addBrigao(-5);
    rollDamageWithEnerg('3d10', 'Bomba Sinfônica 💣');
    renderSinfonia();
    triggerAutosave();
  });

  document.getElementById('btn-energ-usar')?.addEventListener('click', () => {
    if ((char.sinfonia?.brigao ?? 0) < 5) { showToast('Brigão insuficiente! Precisa de 5 cargas.', 'warning'); return; }
    addBrigao(-5);
    char.sinfonia.energizacao_stacks = (char.sinfonia.energizacao_stacks || 0) + 1;
    renderSinfonia();
    triggerAutosave();
  });

  document.getElementById('btn-vantagem-consumir')?.addEventListener('click', () => {
    char.sinfonia.vantagem_active = false;
    renderSinfonia();
    triggerAutosave();
  });

  const resetEnerg = () => {
    char.sinfonia.energizacao_stacks = 0;
    renderSinfonia();
    triggerAutosave();
  };
  document.getElementById('btn-energ-reset')?.addEventListener('click', resetEnerg);
  document.getElementById('btn-energ-reset-bar')?.addEventListener('click', resetEnerg);

  document.getElementById('btn-sinc-usar')?.addEventListener('click', () => {
    const kit = char.sinfonia?.kit?.sincronizacao;
    if (!kit || kit.uses <= 0) { showToast('Sem usos de Sincronização!', 'warning'); return; }
    if (char.sinfonia.sincronizacao_active) { showToast('Sincronização já ativa!', 'warning'); return; }
    kit.uses--;
    char.sinfonia.sincronizacao_active = true;
    renderSinfonia();
    triggerAutosave();
  });
  document.getElementById('btn-sinc-desativar')?.addEventListener('click', () => {
    char.sinfonia.sincronizacao_active = false;
    renderSinfonia();
    triggerAutosave();
  });
  document.getElementById('btn-sinc-acerto')?.addEventListener('click', () => {
    if (!char.sinfonia.sincronizacao_active) { showToast('Sincronização não está ativa!', 'warning'); return; }
    addBrigao(1);
  });
  document.getElementById('btn-sinc-rest')?.addEventListener('click', () => {
    const k = char.sinfonia?.kit?.sincronizacao;
    if (k) {
      k.uses = k.max;
      char.sinfonia.sincronizacao_active = false;
      renderSinfonia();
      triggerAutosave();
    }
  });

  document.getElementById('btn-recarga-usar')?.addEventListener('click', () => {
    if ((char.sinfonia?.brigao ?? 0) < 10) { showToast('Brigão insuficiente! Precisa de 10 cargas.', 'warning'); return; }
    const heal = parseAndRoll('1d10');
    performRoll('Recarga Sinfônica 🎵 — Cura (1d10)', heal);
    // Aplica cura ao HP
    applyHeal(char, heal.total);
    syncHPInputs();
    // Ativa vantagem
    char.sinfonia.vantagem_active = true;
    addBrigao(-10);
    addSinStacks(2);
    renderSinfonia();
    triggerAutosave();
    // Modal para recuperar espaço de magia
    openSpellRecoveryModal();
  });
}

// ── INSTABILIDADE SINFÔNICA ───────────────────────
function renderInstabilidade() {
  const list = document.getElementById('instab-targets-list');
  if (!list) return;
  const targets = char.instabilidade_sinf || [];
  const count = document.getElementById('instab-count');
  if (count) count.textContent = targets.length;
  if (targets.length === 0) {
    list.innerHTML = '<span class="instab-empty">Nenhum alvo afetado</span>';
    return;
  }
  list.innerHTML = targets.map(t => `
    <div class="instab-target" data-instab-id="${t.id}">
      <input class="instab-name instab-name-edit" data-instab-name="${t.id}" value="${esc(t.name)}" aria-label="Nome do alvo afetado">
      <span class="instab-turns ${t.turns <= 1 ? 'instab-turns-low' : ''}">${t.turns}T</span>
      <button class="instab-remove-btn" data-instab-remove="${t.id}" title="Remover">✕</button>
    </div>
  `).join('');
}

function initInstabilidade() {
  if (!char.instabilidade_sinf) char.instabilidade_sinf = [];
  renderInstabilidade();

  document.getElementById('btn-instab-add')?.addEventListener('click', () => {
    const input = document.getElementById('instab-name-input');
    const name = (input?.value || '').trim() || 'Alvo';
    char.instabilidade_sinf.push({ id: Date.now().toString(36), name, turns: 3 });
    if (input) input.value = '';
    renderInstabilidade();
    triggerAutosave();
  });

  document.getElementById('instab-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-instab-add')?.click();
  });

  document.getElementById('btn-instab-turn')?.addEventListener('click', () => {
    char.instabilidade_sinf = (char.instabilidade_sinf || [])
      .map(t => ({ ...t, turns: t.turns - 1 }))
      .filter(t => t.turns > 0);
    renderInstabilidade();
    triggerAutosave();
  });

  document.getElementById('instab-targets-list')?.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-instab-remove]');
    if (!removeBtn) return;
    const id = removeBtn.dataset.instabRemove;
    char.instabilidade_sinf = (char.instabilidade_sinf || []).filter(t => t.id !== id);
    renderInstabilidade();
    triggerAutosave();
  });

  document.getElementById('instab-targets-list')?.addEventListener('change', e => {
    const input = e.target.closest('[data-instab-name]');
    if (!input) return;
    const target = (char.instabilidade_sinf || []).find(item => item.id === input.dataset.instabName);
    if (!target) return;
    target.name = input.value.trim() || 'Alvo';
    input.value = target.name;
    triggerAutosave();
  });

  document.getElementById('instab-targets-list')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-instab-name]')) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

// ── SPELLS ────────────────────────────────────────
const SPELL_SCHOOL_LABELS = {
  abjuracao: 'Abjuração', adivinhacao: 'Adivinhação', conjuracao: 'Conjuração',
  encantamento: 'Encantamento', evocacao: 'Evocação', ilusao: 'Ilusão',
  necromancia: 'Necromancia', transmutacao: 'Transmutação', truque: 'Truque',
};

let spellCatalog = [];
let spellCatalogReady = false;

function normalizeSpellText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function spellSchoolLabel(school) {
  const normalized = normalizeSpellText(school);
  return SPELL_SCHOOL_LABELS[normalized]
    || (school ? school.charAt(0).toUpperCase() + school.slice(1) : '');
}

function spellCastLabel(spell) {
  const timing = String(spell.casting_time || '').trim();
  return timing ? `Conjurar · ${timing}` : 'Conjurar';
}

function spellDamageFormula(spell) {
  if (spell.damage_formula) return String(spell.damage_formula).replace(/\s+/g, '');
  const description = String(spell.description || '');
  if (Number(spell.circle || 0) === 0) {
    const level = Number(char.level || 1);
    const scaled = [...description.matchAll(/(\d+)[°º]\s*nível\s*\((\d+d\d+)\)/gi)]
      .map(match => ({ level: Number(match[1]), formula: match[2] }))
      .filter(entry => entry.level <= level)
      .sort((a, b) => b.level - a.level)[0];
    if (scaled) return scaled.formula;
  }
  const baseDescription = description.split(/\bEm Níveis Superiores\b/i)[0];
  const sections = baseDescription.split(/\n\s*\n|(?<=[.!?])\s+/);
  const damageSection = sections.find(section =>
    /\bdano\b/i.test(section) && /\b\d+d\d+\b/i.test(section)
  );
  if (!damageSection) return '';
  const formulas = [...damageSection.matchAll(/\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b/gi)]
    .map(match => match[1].replace(/\s+/g, ''));
  if (!formulas.length) return '';
  if (/mísseis mágicos/i.test(spell.name) && formulas[0] === '1d4+1') return '3d4+3';
  return formulas.join('+');
}

function isSpellBuffOrDebuff(spell) {
  const description = String(spell.description || '');
  const duration = normalizeSpellText(spell.duration || '');
  const lasting = Boolean(duration) && !/instant/.test(duration);
  if (!lasting) return false;
  return /(?:\bbônus\b|\bvantagem\b|\bdesvantagem\b|\bimunidade\b|resistência a (?:todos os )?danos?|\bCA\b|\bdeslocamento\b|\bação adicional\b|pontos de vida temporários|\b(?:cego|cega|amedrontado|amedrontada|enfeitiçado|enfeitiçada|envenenado|envenenada|impedido|impedida|incapacitado|incapacitada|inconsciente|paralisado|paralisada|petrificado|petrificada|surdo|surda|atordoado|atordoada|caído|caída)\b|não pode (?:se mover|realizar ações|usar reações)|reduzid[oa])/i.test(description);
}

function analyzeSpellBuff(spell) {
  const description = String(spell.description || '');
  const caMatch = description.match(/\+(\d+)\s+de bônus\s+na CA/i);
  const saveMatch = description.match(/\+(\d+)\s+de bônus[^.]{0,80}testes? de resistência/i);
  const duration = String(spell.duration || '');
  if (!isSpellBuffOrDebuff(spell)) return null;
  const tags = [];
  if (caMatch) tags.push(`CA +${caMatch[1]}`);
  if (saveMatch) tags.push(`Resistências +${saveMatch[1]}`);
  if (/vantagem[^.]{0,100}testes? de resistência/i.test(description)) tags.push('Vantagem em resistência');
  if (/resistência a (?:todos os )?danos?/i.test(description)) tags.push('Resistência a dano');
  if (/deslocamento[^.]{0,60}dobrad/i.test(description)) tags.push('Deslocamento dobrado');
  if (/ação adicional/i.test(description)) tags.push('Ação adicional');
  return {
    id: `effect-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    spell_id: spell.catalog_id || spell.id,
    name: spell.name,
    duration,
    ca_bonus: caMatch ? Number(caMatch[1]) : 0,
    save_bonus: saveMatch ? Number(saveMatch[1]) : 0,
    damage_resistance_all: /resistência a todos os danos/i.test(description),
    tags,
    description
  };
}

function activateSpellBuff(spell) {
  const effect = analyzeSpellBuff(spell);
  if (!effect) return;
  if (!char.spell_effects) char.spell_effects = [];
  char.spell_effects = char.spell_effects.filter(active =>
    active.spell_id !== effect.spell_id && normalizeSpellText(active.name) !== normalizeSpellText(effect.name)
  );
  char.spell_effects.push(effect);
  if (spell.id && (char.spells || []).some(known => known.id === spell.id)) {
    if (!char.active_spells) char.active_spells = [];
    if (!char.active_spells.includes(spell.id)) char.active_spells.push(spell.id);
  }
  renderSpellEffects();
  recalcAll();
}

function renderSpellEffects() {
  const container = document.getElementById('spell-effects-list');
  const section = document.getElementById('spell-effects-section');
  if (!container || !section) return;
  const effects = char.spell_effects || [];
  section.classList.toggle('hidden', effects.length === 0);
  container.innerHTML = effects.map(effect => `
    <article class="active-spell-effect">
      <div class="active-spell-effect-main">
        <strong>${esc(effect.name)}</strong>
        <span class="active-spell-duration">${esc(effect.duration || 'Duração não informada')}</span>
        <div class="spell-tags">
          ${(effect.tags || []).map(tag => `<span class="ability-tag tag-buff">${esc(tag)}</span>`).join('')}
          ${!(effect.tags || []).length ? '<span class="ability-tag tag-buff">Efeito ativo</span>' : ''}
        </div>
      </div>
      <button class="btn btn-sm btn-muted" data-end-spell-effect="${effect.id}">Encerrar</button>
      <div class="active-spell-effect-details">
        <div class="spell-desc">${esc(effect.description).replace(/\n/g, '<br>')}</div>
      </div>
    </article>
  `).join('');
}

function castSpell(spell, button) {
  const circle = Number(spell.circle || 0);
  ensureSpellSlots();
  if (circle > 0) {
    const slot = char.spell_slots[circle];
    if (!slot || slot.current <= 0) {
      showToast(`Sem espaços de Círculo ${circle} disponíveis!`, 'warning');
      return false;
    }
    slot.current--;
  }
  const slotLabel = circle > 0 ? `C${circle}` : 'Truque';
  const damageFormula = spellDamageFormula(spell);
  if (damageFormula) {
    const damageRoll = parseAndRoll(damageFormula);
    performRoll(`${spell.name || 'Magia'} — Dano (${slotLabel})`, damageRoll);
  } else {
    performRoll(`${spell.name || 'Magia'} conjurada (${slotLabel})`, {
      expression: slotLabel, rolls: [], bonus: 0, total: 0
    });
  }
  activateSpellBuff(spell);
  renderSpellSlots();
  triggerAutosave();
  if (button) {
    const original = button.textContent;
    button.textContent = '✓ Conjurada!';
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1500);
  }
  return true;
}

async function initSpellCatalog() {
  document.querySelectorAll('[data-spell-view]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-spell-view]').forEach(btn => btn.classList.toggle('active', btn === button));
      document.querySelectorAll('.spell-view-panel').forEach(panel => panel.classList.toggle('active', panel.id === `spell-view-${button.dataset.spellView}`));
      if (button.dataset.spellView === 'catalog') renderSpellCatalog();
      if (button.dataset.spellView === 'submundo') renderSubmundo();
    });
  });
  ['spell-catalog-search', 'spell-catalog-circle', 'spell-catalog-class'].forEach(id => {
    document.getElementById(id)?.addEventListener(id.endsWith('search') ? 'input' : 'change', renderSpellCatalog);
  });
  ['submundo-from', 'submundo-to'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderSubmundo);
  });
  document.getElementById('submundo-roll')?.addEventListener('click', rollSubmundo);
  const handleCatalogSpellClick = event => {
    const header = event.target.closest('.catalog-spell-header');
    if (header) {
      const expand = header.querySelector('[data-catalog-expand]');
      const body = expand && document.getElementById(`catalog-body-${expand.dataset.catalogExpand}`);
      const isExpanded = body?.classList.toggle('expanded') || false;
      header.closest('.catalog-spell-card')?.classList.toggle('catalog-spell-expanded', isExpanded);
      expand?.setAttribute('aria-expanded', String(isExpanded));
      return;
    }
    const cast = event.target.closest('[data-catalog-cast]');
    if (cast) {
      const spell = spellCatalog.find(item => item.id === cast.dataset.catalogCast);
      if (spell) castSpell(spell, cast);
      return;
    }
    const learn = event.target.closest('[data-catalog-learn]');
    if (learn) {
      const spell = spellCatalog.find(item => item.id === learn.dataset.catalogLearn);
      if (spell) learnCatalogSpell(spell);
      return;
    }
    const swap = event.target.closest('[data-catalog-swap]');
    if (swap) {
      const spell = spellCatalog.find(item => item.id === swap.dataset.catalogSwap);
      if (spell) openSpellSwapModal(spell);
    }
  };
  document.getElementById('spell-catalog-list')?.addEventListener('click', handleCatalogSpellClick);
  document.getElementById('submundo-result')?.addEventListener('click', handleCatalogSpellClick);
  try {
    const response = await fetch('/static/data/spells-5e.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    spellCatalog = await response.json();
    spellCatalogReady = true;
    renderSpellCatalog();
    renderSubmundo();
  } catch (error) {
    const submundoSummary = document.getElementById('submundo-summary');
    if (submundoSummary) submundoSummary.textContent = 'Não foi possível carregar as magias.';
    const summary = document.getElementById('spell-catalog-summary');
    if (summary) summary.textContent = 'Não foi possível carregar o grimório.';
    console.error('Erro ao carregar catálogo de magias:', error);
  }
}

function submundoSpellPool() {
  const from = Number(document.getElementById('submundo-from')?.value);
  const to = Number(document.getElementById('submundo-to')?.value);
  if (!spellCatalogReady || from > to) return [];
  return spellCatalog.filter(spell => Number(spell.circle) >= from && Number(spell.circle) <= to);
}

function renderSubmundo() {
  const summary = document.getElementById('submundo-summary');
  const button = document.getElementById('submundo-roll');
  const result = document.getElementById('submundo-result');
  if (!summary || !button) return;
  if (result) result.innerHTML = '';
  if (!spellCatalogReady) {
    summary.textContent = 'Carregando magias…';
    button.disabled = true;
    return;
  }
  const from = Number(document.getElementById('submundo-from').value);
  const to = Number(document.getElementById('submundo-to').value);
  if (from > to) {
    summary.textContent = 'O círculo inicial deve ser menor ou igual ao final.';
    button.disabled = true;
    return;
  }
  const total = submundoSpellPool().length;
  summary.textContent = total
    ? `${total} magia${total === 1 ? '' : 's'} no intervalo · dado 1d${total}`
    : 'Nenhuma magia nesse intervalo.';
  button.disabled = total === 0;
}

function rollSubmundo() {
  const pool = submundoSpellPool();
  if (!pool.length) return;
  const roll = parseAndRoll(`1d${pool.length}`);
  if (roll.error) {
    showToast(roll.error, 'error');
    return;
  }
  const spell = pool[roll.total - 1];
  if (!spell) return;
  const known = isCatalogSpellKnown(spell);
  const circleLabel = spell.circle === 0 ? 'Truque' : `Círculo ${spell.circle}`;
  performRoll(`Submundo — ${spell.name}`, roll);
  const result = document.getElementById('submundo-result');
  if (!result) return;
  result.innerHTML = `
    <div class="submundo-result-roll">${esc(roll.expression)} → <strong>${roll.total}</strong></div>
    <article class="catalog-spell-card submundo-spell-card ${known ? 'catalog-spell-known' : ''}">
      <header class="catalog-spell-header">
        <div>
          <strong>${esc(spell.name)}</strong>
          <div class="spell-tags">
            <span class="ability-tag tag-action">${circleLabel}</span>
            <span class="ability-tag">${esc(spellSchoolLabel(spell.school))}</span>
            ${(spell.classes || []).map(cls => `<span class="ability-tag">${esc(cls)}</span>`).join('')}
          </div>
        </div>
        <button class="expand-toggle" data-catalog-expand="submundo-${spell.id}" aria-label="Ver detalhes" aria-expanded="false">▼</button>
      </header>
      <div class="catalog-spell-body" id="catalog-body-submundo-${spell.id}">
        <div class="spell-meta-grid">
          <div><span class="spell-meta-label">Conjuração</span><span>${esc(spell.casting_time)}</span></div>
          <div><span class="spell-meta-label">Alcance</span><span>${esc(spell.range)}</span></div>
          <div><span class="spell-meta-label">Duração</span><span>${esc(spell.duration)}</span></div>
          <div><span class="spell-meta-label">Componentes</span><span>${esc(spell.components)}</span></div>
        </div>
        <div class="spell-desc">${esc(spell.description).replace(/\n/g, '<br>')}</div>
        <div class="spell-actions">
          <button class="btn btn-sm btn-cast-spell" data-catalog-cast="${spell.id}">${esc(spellCastLabel(spell))}${spell.circle > 0 ? ` · C${spell.circle}` : ''}</button>
          <button class="btn btn-sm" data-catalog-learn="${spell.id}" ${known ? 'disabled' : ''}>${known ? '✓ Na ficha' : '+ Aprender'}</button>
          ${(char.spells || []).length ? `<button class="btn btn-sm btn-muted" data-catalog-swap="${spell.id}">Trocar magia</button>` : ''}
        </div>
      </div>
    </article>
  `;
}

function isCatalogSpellKnown(spell) {
  const key = spell.catalog_id || spell.id;
  return (char.spells || []).some(known =>
    known.catalog_id === key || normalizeSpellText(known.name) === normalizeSpellText(spell.name)
  );
}

function renderSpellCatalog() {
  const list = document.getElementById('spell-catalog-list');
  const summary = document.getElementById('spell-catalog-summary');
  if (!list || !summary || !spellCatalogReady) return;
  const query = normalizeSpellText(document.getElementById('spell-catalog-search')?.value);
  const circle = document.getElementById('spell-catalog-circle')?.value || 'all';
  const className = document.getElementById('spell-catalog-class')?.value || 'all';
  const filtered = spellCatalog.filter(spell => {
    const haystack = normalizeSpellText(`${spell.name} ${spell.school} ${spell.description}`);
    return (!query || haystack.includes(query))
      && (circle === 'all' || Number(circle) === Number(spell.circle))
      && (className === 'all' || (spell.classes || []).includes(className));
  });
  summary.textContent = `${filtered.length} de ${spellCatalog.length} magias`;
  list.innerHTML = filtered.map(spell => {
    const known = isCatalogSpellKnown(spell);
    const circleLabel = spell.circle === 0 ? 'Truque' : `Círculo ${spell.circle}`;
    return `
      <article class="catalog-spell-card ${known ? 'catalog-spell-known' : ''}">
        <header class="catalog-spell-header">
          <div>
            <strong>${esc(spell.name)}</strong>
            <div class="spell-tags">
              <span class="ability-tag tag-action">${circleLabel}</span>
              <span class="ability-tag">${esc(spellSchoolLabel(spell.school))}</span>
              ${(spell.classes || []).map(cls => `<span class="ability-tag">${esc(cls)}</span>`).join('')}
            </div>
          </div>
          <button class="expand-toggle" data-catalog-expand="${spell.id}" aria-label="Ver detalhes" aria-expanded="false">▼</button>
        </header>
        <div class="catalog-spell-body" id="catalog-body-${spell.id}">
          <div class="spell-meta-grid">
            <div><span class="spell-meta-label">Conjuração</span><span>${esc(spell.casting_time)}</span></div>
            <div><span class="spell-meta-label">Alcance</span><span>${esc(spell.range)}</span></div>
            <div><span class="spell-meta-label">Duração</span><span>${esc(spell.duration)}</span></div>
            <div><span class="spell-meta-label">Componentes</span><span>${esc(spell.components)}</span></div>
          </div>
          <div class="spell-desc">${esc(spell.description).replace(/\n/g, '<br>')}</div>
          <div class="spell-actions">
            <button class="btn btn-sm btn-cast-spell" data-catalog-cast="${spell.id}">${esc(spellCastLabel(spell))}${spell.circle > 0 ? ` · C${spell.circle}` : ''}</button>
            <button class="btn btn-sm" data-catalog-learn="${spell.id}" ${known ? 'disabled' : ''}>${known ? '✓ Na ficha' : '+ Aprender'}</button>
            ${(char.spells || []).length ? `<button class="btn btn-sm btn-muted" data-catalog-swap="${spell.id}">Trocar magia</button>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('') || '<p class="spell-catalog-empty">Nenhuma magia corresponde aos filtros.</p>';
}

function catalogSpellForCharacter(spell) {
  return {
    ...spell,
    id: `spell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    catalog_id: spell.id,
    active_effects: ''
  };
}

function learnCatalogSpell(spell, replaceId = null) {
  if (!char.spells) char.spells = [];
  if (replaceId) {
    const index = char.spells.findIndex(item => item.id === replaceId);
    if (index >= 0) {
      char.spells[index] = catalogSpellForCharacter(spell);
      char.active_spells = (char.active_spells || []).filter(id => id !== replaceId);
    }
  } else if (!isCatalogSpellKnown(spell)) {
    char.spells.push(catalogSpellForCharacter(spell));
  }
  renderSpells();
  renderSpellCatalog();
  const submundoLearn = document.querySelector('#submundo-result [data-catalog-learn]');
  if (submundoLearn?.dataset.catalogLearn === spell.id && isCatalogSpellKnown(spell)) {
    submundoLearn.disabled = true;
    submundoLearn.textContent = '✓ Na ficha';
    submundoLearn.closest('.catalog-spell-card')?.classList.add('catalog-spell-known');
  }
  triggerAutosave();
  showToast(replaceId ? `${spell.name} substituiu a magia selecionada.` : `${spell.name} adicionada à ficha.`);
}

function openSpellSwapModal(spell) {
  const known = char.spells || [];
  if (!known.length) {
    learnCatalogSpell(spell);
    return;
  }
  const options = known.map(item =>
    `<option value="${item.id}">${esc(item.name)} (${item.circle === 0 ? 'Truque' : `C${item.circle}`})</option>`
  ).join('');
  openModal(`
    <h3>Trocar por ${esc(spell.name)}</h3>
    <p class="modal-help">Escolha qual magia da ficha será substituída. A troca não gasta espaço de magia.</p>
    <div class="form-row"><label>Magia atual</label><select id="spell-swap-current">${options}</select></div>
    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="modal-swap-btn">Confirmar troca</button>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('modal-swap-btn').onclick = () => {
    const replaceId = document.getElementById('spell-swap-current')?.value;
    learnCatalogSpell(spell, replaceId);
    closeModal();
  };
}

function initSpells() {
  if (!char.spells) char.spells = [];
  if (!char.active_spells) char.active_spells = [];
  if (!char.spell_effects) char.spell_effects = [];
  char.spell_effects = char.spell_effects.filter(effect => isSpellBuffOrDebuff(effect));
  renderSpells();
  renderSpellEffects();
  initSpellSectionCollapsibles();
  document.getElementById('spell-effects-list')?.addEventListener('click', event => {
    const button = event.target.closest('[data-end-spell-effect]');
    if (!button) {
      const card = event.target.closest('.active-spell-effect');
      if (!card) return;
      const expanded = card.classList.toggle('active-spell-effect-expanded');
      card.querySelector('.active-spell-effect-details')?.classList.toggle('expanded', expanded);
      card.setAttribute('aria-expanded', String(expanded));
      return;
    }
    const effect = (char.spell_effects || []).find(item => item.id === button.dataset.endSpellEffect);
    char.spell_effects = (char.spell_effects || []).filter(item => item.id !== button.dataset.endSpellEffect);
    if (effect) {
      const known = (char.spells || []).find(spell =>
        (spell.catalog_id || spell.id) === effect.spell_id || normalizeSpellText(spell.name) === normalizeSpellText(effect.name)
      );
      if (known) char.active_spells = (char.active_spells || []).filter(id => id !== known.id);
    }
    renderSpellEffects();
    renderSpells();
    recalcAll();
    triggerAutosave();
  });
  initSpellCatalog();
}

function initSpellSectionCollapsibles() {
  if (!char.ui_state) char.ui_state = {};
  if (!char.ui_state.spell_sections) char.ui_state.spell_sections = {};
  document.querySelectorAll('[data-spell-section]').forEach(section => {
    const key = section.dataset.spellSection;
    const header = section.querySelector('.spell-collapsible-header');
    const stored = char.ui_state.spell_sections[key];
    const expanded = stored === undefined ? true : Boolean(stored);
    section.classList.toggle('expanded', expanded);
    header?.setAttribute('aria-expanded', String(expanded));
    const toggle = event => {
      if (event.type === 'click' && event.target.closest('button')) return;
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      const next = !section.classList.contains('expanded');
      section.classList.toggle('expanded', next);
      header?.setAttribute('aria-expanded', String(next));
      char.ui_state.spell_sections[key] = next;
      triggerAutosave();
    };
    if (header) {
      header.onclick = toggle;
      header.onkeydown = toggle;
    }
  });
}

function renderSpells() {
  const container = document.getElementById('spells-list');
  if (!container) return;
  if (!char.spells) char.spells = [];
  if (!char.active_spells) char.active_spells = [];
  container.innerHTML = '';

  if (char.spells.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;padding:8px">Nenhuma magia cadastrada.</p>';
  }

  // Group by circle
  const byCircle = {};
  char.spells.forEach(sp => {
    const c = sp.circle ?? 0;
    if (!byCircle[c]) byCircle[c] = [];
    byCircle[c].push(sp);
  });

  Object.keys(byCircle).sort((a,b) => a-b).forEach(circle => {
    const circNum = parseInt(circle);
    const header = document.createElement('div');
    header.className = 'spell-circle-header';
    header.textContent = circNum === 0 ? 'Truques' : `${CIRCLE_LABELS[circNum]} Círculo`;
    container.appendChild(header);

    byCircle[circle].forEach(sp => {
      const isActive = (char.active_spells || []).includes(sp.id);
      const schoolLabel = spellSchoolLabel(sp.school);
      const damageFormula = spellDamageFormula(sp);
      const card = document.createElement('div');
      card.className = `spell-card${isActive ? ' spell-card-active' : ''}`;
      card.dataset.spellId = sp.id;
      card.innerHTML = `
        <div class="spell-card-header" title="Clique para ver os detalhes">
          <div class="spell-header-left">
            <span class="spell-name">${esc(sp.name)}</span>
            <div class="spell-tags">
              ${schoolLabel ? `<span class="ability-tag tag-action">${schoolLabel}</span>` : ''}
              ${sp.casting_time ? `<span class="ability-tag">${esc(sp.casting_time)}</span>` : ''}
              ${damageFormula ? `<span class="ability-tag tag-damage">Dano ${esc(damageFormula)}</span>` : ''}
            </div>
          </div>
          <div class="spell-header-right">
            <button class="expand-toggle" data-expand-spell="${sp.id}">▼</button>
            <button class="delete-btn-small" data-del-spell="${sp.id}">✕</button>
          </div>
        </div>
        <div class="spell-card-body" id="spell-body-${sp.id}">
          <div class="spell-meta-grid">
            ${sp.range    ? `<div><span class="spell-meta-label">Alcance</span><span>${esc(sp.range)}</span></div>` : ''}
            ${sp.duration ? `<div><span class="spell-meta-label">Duração</span><span>${esc(sp.duration)}</span></div>` : ''}
            ${sp.components ? `<div><span class="spell-meta-label">Componentes</span><span>${esc(sp.components)}</span></div>` : ''}
          </div>
          ${sp.description ? `<div class="spell-desc"><span class="spell-meta-label">Descrição</span><br>${esc(sp.description)}</div>` : ''}
          ${sp.active_effects ? `<div class="spell-effects ${isActive ? 'effects-active' : ''}"><span class="spell-meta-label">Efeitos Ativos</span><br>${esc(sp.active_effects)}</div>` : ''}
          <div class="spell-actions">
            <button class="btn btn-sm btn-cast-spell" data-cast-spell="${sp.id}" data-cast-circle="${sp.circle}" title="${sp.circle > 0 ? `Gastar 1 espaço de Círculo ${sp.circle}` : 'Truques não gastam espaço'}">${esc(spellCastLabel(sp))}${sp.circle > 0 ? ` · C${sp.circle}` : ''}</button>
            <button class="btn btn-sm" data-edit-spell="${sp.id}">✎ Editar</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  });

  if (container.dataset.spellEventsBound) return;
  container.dataset.spellEventsBound = 'true';
  container.addEventListener('click', e => {
    const header = e.target.closest('.spell-card-header');
    if (header && !e.target.closest('button')) {
      const card = header.closest('.spell-card');
      const body = card?.querySelector('.spell-card-body');
      const expanded = body?.classList.toggle('expanded') || false;
      card?.classList.toggle('spell-card-expanded', expanded);
      const arrow = header.querySelector('[data-expand-spell]');
      arrow?.setAttribute('aria-expanded', String(expanded));
      return;
    }
    const castBtn = e.target.closest('[data-cast-spell]');
    if (castBtn) {
      const sp = (char.spells || []).find(s => s.id === castBtn.dataset.castSpell);
      if (sp) castSpell(sp, castBtn);
      return;
    }
    const expBtn = e.target.closest('[data-expand-spell]');
    if (expBtn) {
      const id = expBtn.dataset.expandSpell;
      const body = document.getElementById(`spell-body-${id}`);
      const expanded = body?.classList.toggle('expanded') || false;
      expBtn.closest('.spell-card')?.classList.toggle('spell-card-expanded', expanded);
      expBtn.setAttribute('aria-expanded', String(expanded));
      return;
    }
    const delBtn = e.target.closest('[data-del-spell]');
    if (delBtn) {
      const delId = delBtn.dataset.delSpell;
      char.spells = char.spells.filter(s => s.id !== delId);
      char.active_spells = (char.active_spells || []).filter(id => id !== delId);
      renderSpells();
      triggerAutosave();
      return;
    }
    const editBtn = e.target.closest('[data-edit-spell]');
    if (editBtn) { openEditSpellModal(editBtn.dataset.editSpell); return; }
  });

  document.getElementById('btn-add-spell')?.addEventListener('click', openAddSpellModal, { once: true });
}

function spellModalForm(sp) {
  const circOpts = [0,1,2,3,4,5,6,7,8,9].map(i =>
    `<option value="${i}" ${sp.circle===i?'selected':''}>${i===0?'Truque':`Círculo ${i}`}</option>`
  ).join('');
  const schoolOpts = Object.entries(SPELL_SCHOOL_LABELS).map(([k,v]) =>
    `<option value="${k}" ${sp.school===k?'selected':''}>${v}</option>`
  ).join('');
  return `
    <div class="form-row"><label>Nome</label><input id="msp-name" type="text" value="${esc(sp.name)}"></div>
    <div class="form-row"><label>Círculo</label><select id="msp-circle">${circOpts}</select></div>
    <div class="form-row"><label>Escola</label><select id="msp-school"><option value="">—</option>${schoolOpts}</select></div>
    <div class="form-row"><label>Tempo de Conjuração</label><input id="msp-cast" type="text" value="${esc(sp.casting_time)}" placeholder="1 Ação, Ação Bônus…"></div>
    <div class="form-row"><label>Alcance</label><input id="msp-range" type="text" value="${esc(sp.range)}" placeholder="9 metros, Toque…"></div>
    <div class="form-row"><label>Duração</label><input id="msp-dur" type="text" value="${esc(sp.duration)}" placeholder="Instantâneo, 1 hora…"></div>
    <div class="form-row"><label>Componentes</label><input id="msp-comp" type="text" value="${esc(sp.components)}" placeholder="V, S, M (material)"></div>
    <div class="form-row"><label>Descrição</label><textarea id="msp-desc" rows="4">${esc(sp.description)}</textarea></div>
    <div class="form-row"><label>Efeitos Ativos (aparece ao ativar a magia)</label><textarea id="msp-effects" rows="3" placeholder="Ex: +1d6 dano fogo, alvo fica Abalado…">${esc(sp.active_effects||'')}</textarea></div>
  `;
}

function collectSpellForm(sp) {
  sp.name         = document.getElementById('msp-name')?.value.trim() || 'Magia';
  sp.circle       = parseInt(document.getElementById('msp-circle')?.value) || 0;
  sp.school       = document.getElementById('msp-school')?.value || '';
  sp.casting_time = document.getElementById('msp-cast')?.value || '';
  sp.range        = document.getElementById('msp-range')?.value || '';
  sp.duration     = document.getElementById('msp-dur')?.value || '';
  sp.components   = document.getElementById('msp-comp')?.value || '';
  sp.description    = document.getElementById('msp-desc')?.value || '';
  sp.active_effects = document.getElementById('msp-effects')?.value || '';
}

function openAddSpellModal() {
  const sp = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    name:'', circle:0, school:'', casting_time:'', range:'', duration:'', components:'', description:'' };
  openModal(`<h3>Nova Magia</h3>${spellModalForm(sp)}<div class="form-actions">
    <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
    <button class="btn" id="modal-save-btn">Salvar</button></div>`);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('modal-save-btn').onclick = () => {
    collectSpellForm(sp);
    if (!char.spells) char.spells = [];
    char.spells.push(sp);
    renderSpells();
    triggerAutosave();
    closeModal();
  };
}

function openEditSpellModal(id) {
  const sp = (char.spells || []).find(s => s.id === id);
  if (!sp) return;
  openModal(`<h3>Editar Magia</h3>${spellModalForm(sp)}<div class="form-actions">
    <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
    <button class="btn" id="modal-save-btn">Salvar</button></div>`);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('modal-save-btn').onclick = () => {
    collectSpellForm(sp);
    renderSpells();
    triggerAutosave();
    closeModal();
  };
}

// ── SPELL SLOTS ───────────────────────────────────
function ensureSpellSlots() {
  if (!char.spell_slots) char.spell_slots = {};
  for (let i = 1; i <= 9; i++) {
    if (!char.spell_slots[i]) char.spell_slots[i] = { max: 0, current: 0 };
  }
}

const CIRCLE_LABELS = ['','I','II','III','IV','V','VI','VII','VIII','IX'];

function renderSpellSlots() {
  ensureSpellSlots();
  const container = document.getElementById('spell-slots-list');
  if (!container) return;
  container.innerHTML = '';

  for (let lvl = 1; lvl <= 9; lvl++) {
    const slot = char.spell_slots[lvl];
    if (slot.max === 0) {
      const row = document.createElement('div');
      row.className = 'spell-slot-row spell-slot-empty';
      row.innerHTML = `
        <div class="spell-circle-label"><strong>${CIRCLE_LABELS[lvl]}</strong><span>Círculo</span></div>
        <span class="spell-empty-dash">Não configurado</span>
        <button class="btn btn-sm btn-muted spell-set-max" data-lvl="${lvl}">Ativar</button>
      `;
      container.appendChild(row);
      continue;
    }

    // used = max - current; pips 0..(used-1) are filled, rest hollow
    const used = slot.max - slot.current;
    const pips = Array.from({ length: slot.max }, (_, i) => {
      const isUsed = i < used;
      return `<button class="spell-pip-btn ${isUsed ? 'pip-used' : 'pip-free'}" data-pip-lvl="${lvl}" data-pip-idx="${i}" title="${isUsed ? 'Recuperar espaço' : 'Gastar espaço'}" aria-label="${isUsed ? 'Espaço gasto; clique para recuperar' : 'Espaço disponível; clique para gastar'}">${isUsed ? '×' : '✓'}</button>`;
    }).join('');

    const row = document.createElement('div');
    row.className = `spell-slot-row${slot.current === 0 ? ' spell-slot-depleted' : ''}`;
    row.innerHTML = `
      <div class="spell-slot-card-top">
        <div class="spell-circle-label"><strong>${CIRCLE_LABELS[lvl]}</strong><span>Círculo</span></div>
        <div class="spell-slot-card-actions">
          <span class="spell-slot-count ${slot.current === 0 ? 'slot-empty' : ''}"><strong>${slot.current}</strong> de ${slot.max}<small> disponíveis</small></span>
          <button type="button" class="btn btn-sm spell-slot-use" data-spell-use="${lvl}" aria-label="Usar espaço de magia do ${lvl}º círculo" ${slot.current === 0 ? 'disabled' : ''}>Usar</button>
        </div>
      </div>
      <div class="spell-pips-row">${pips}</div>
      <label class="spell-max-control">Máximo <input class="spell-max-input" type="number" min="0" max="20" value="${slot.max}" data-spell-max="${lvl}" title="Máximo de espaços"></label>
    `;
    container.appendChild(row);
  }

  container.onclick = e => {
    const useBtn = e.target.closest('[data-spell-use]');
    if (useBtn) {
      const slot = char.spell_slots[useBtn.dataset.spellUse];
      if (slot.current > 0) {
        slot.current--;
        renderSpellSlots();
        triggerAutosave();
      }
      return;
    }
    const pip = e.target.closest('[data-pip-lvl]');
    if (pip) {
      const lvl = pip.dataset.pipLvl;
      const idx = parseInt(pip.dataset.pipIdx);
      const s = char.spell_slots[lvl];
      const used = s.max - s.current;
      if (idx < used) s.current = Math.min(s.max, s.current + 1); // recover
      else             s.current = Math.max(0, s.current - 1);     // spend
      renderSpellSlots();
      triggerAutosave();
      return;
    }
    const setBtn = e.target.closest('.spell-set-max');
    if (setBtn) {
      const lvl = setBtn.dataset.lvl;
      char.spell_slots[lvl].max = 1;
      char.spell_slots[lvl].current = 1;
      renderSpellSlots();
      triggerAutosave();
    }
  };

  container.onchange = e => {
    const input = e.target.closest('[data-spell-max]');
    if (!input) return;
    const lvl = input.dataset.spellMax;
    const val = Math.max(0, parseInt(input.value) || 0);
    char.spell_slots[lvl].max = val;
    char.spell_slots[lvl].current = Math.min(char.spell_slots[lvl].current, val);
    renderSpellSlots();
    triggerAutosave();
  };

  const restButton = document.getElementById('btn-spell-long-rest');
  if (restButton) restButton.onclick = () => {
    ensureSpellSlots();
    for (let i = 1; i <= 9; i++) char.spell_slots[i].current = char.spell_slots[i].max;
    renderSpellSlots();
    triggerAutosave();
  };
}

function openSpellRecoveryModal() {
  ensureSpellSlots();
  const available = [1,2,3].filter(lvl => {
    const s = char.spell_slots[lvl];
    return s && s.max > 0 && s.current < s.max;
  });
  if (available.length === 0) {
    showToast('Nenhum espaço de magia (círculos 1-3) disponível para recuperar.', 'warning');
    return;
  }
  const opts = available.map(lvl =>
    `<button class="btn" data-recover-lvl="${lvl}" style="margin:4px">Círculo ${lvl}</button>`
  ).join('');
  openModal(`
    <h3>Recuperar Espaço de Magia</h3>
    <p style="font-size:0.84rem;color:var(--muted);margin-bottom:12px">Recarga Sinfônica recupera 1 espaço até círculo 3. Escolha:</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${opts}</div>
    <div class="form-actions"><button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button></div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.querySelectorAll('[data-recover-lvl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lvl = parseInt(btn.dataset.recoverLvl);
      char.spell_slots[lvl].current = Math.min(char.spell_slots[lvl].max, char.spell_slots[lvl].current + 1);
      renderSpellSlots();
      triggerAutosave();
      closeModal();
    });
  });
}

// ── NOTES ─────────────────────────────────────────
function initNotes() {
  document.querySelectorAll('[data-field^="notes."]').forEach(el => {
    el.addEventListener('input', onFieldChange);
  });
  document.querySelectorAll('[data-field^="currency."]').forEach(el => {
    el.addEventListener('input', onFieldChange);
  });
}

// ── ROLL PANEL ────────────────────────────────────
function initRollPanel() {
  const btn = document.getElementById('btn-free-roll');
  const input = document.getElementById('roll-expr');

  btn?.addEventListener('click', performFreeRoll);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') performFreeRoll();
  });

  document.querySelectorAll('.dice-quick-btn').forEach(b => {
    b.addEventListener('click', () => {
      const result = parseAndRoll(b.dataset.dice);
      performRoll(b.dataset.dice, result);
    });
  });

  document.getElementById('btn-dice-float')?.addEventListener('click', () => {
    document.querySelector('.col-rolls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('btn-clear-rolls')?.addEventListener('click', () => {
    char.roll_history = [];
    renderRollHistory();
    triggerAutosave();
  });
}

function performFreeRoll() {
  const input = document.getElementById('roll-expr');
  const expr = (input?.value || '').trim();
  if (!expr) return;
  const result = parseAndRoll(expr);
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }
  performRoll(expr, result);
  if (input) input.select();
}

function performRoll(name, result) {
  const entry = createRollEntry(name, result);
  char.roll_history.unshift(entry);
  if (char.roll_history.length > 50) char.roll_history.pop();
  renderRollHistory();
  triggerAutosave();
}

function renderRollHistory() {
  const container = document.getElementById('roll-history');
  if (!container) return;
  container.innerHTML = '';

  char.roll_history.forEach((entry, i) => {
    const diceStr = entry.rolls && entry.rolls.length
      ? `[${entry.rolls.join(', ')}]`
      : '';
    const div = document.createElement('div');
    div.className = 'roll-entry' + (i === 0 ? ' latest' : '');
    div.innerHTML = `
      <div class="roll-entry-header">
        <span class="roll-entry-name">${esc(entry.name)}</span>
        <span>${entry.timestamp || ''}</span>
      </div>
      <div class="roll-entry-body">
        <span class="roll-entry-expr">${esc(entry.expression)}</span>
        ${diceStr ? `<span class="roll-entry-dice">${diceStr}</span>` : ''}
        <span class="roll-entry-total">${entry.total}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

// ── TABS ──────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add('active');

      if (tab === 'notes') layoutStickyBoard();
      if (tab === 'abilities') {
        document.getElementById('btn-add-ability')?.addEventListener('click', openAddAbilityModal, { once: true });
        document.getElementById('btn-restore-all-uses')?.addEventListener('click', () => {
          restoreAllAbilityUses(char);
          renderAbilities();
          triggerAutosave();
        }, { once: true });
      }
      if (tab === 'spells') {
        document.getElementById('btn-add-spell')?.addEventListener('click', openAddSpellModal, { once: true });
        document.getElementById('btn-spell-long-rest')?.addEventListener('click', () => {
          ensureSpellSlots();
          for (let i = 1; i <= 9; i++) char.spell_slots[i].current = char.spell_slots[i].max;
          renderSpellSlots();
          triggerAutosave();
        }, { once: true });
      }
    });
  });
}

// ── IMPORT ────────────────────────────────────────
function initImport() {
  document.getElementById('import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/character/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        const details = (data.details || []).join('\n');
        openModal(`<h3>Erro na importação</h3><pre style="font-size:0.8rem;white-space:pre-wrap;color:var(--accent)">${esc(details || data.error || 'Erro desconhecido')}</pre><div class="form-actions"><button class="btn" id="modal-cancel-btn">Fechar</button></div>`);
        document.getElementById('modal-cancel-btn').onclick = closeModal;
        return;
      }
      window.location.href = `/character/${data.id}`;
    } catch (err) {
      showToast('Erro ao importar: ' + err.message, 'error');
    }
  });
}

// ── MODAL ─────────────────────────────────────────
function openModal(htmlContent) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  if (!overlay || !content) return;
  content.innerHTML = htmlContent;
  overlay.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
}

document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// ── STICKY NOTES ──────────────────────────────────
let stickyDrag = null;
let stickyLayer;

function initStickyNotes() {
  char.sticky_notes ||= [];
  stickyLayer = document.createElement('div');
  stickyLayer.id = 'sticky-floating-layer';
  stickyLayer.setAttribute('aria-label', 'Anotações fixadas');
  document.body.appendChild(stickyLayer);
  const board = document.getElementById('sticky-board');
  [board, stickyLayer].filter(Boolean).forEach(surface => {
    surface.addEventListener('input', event => {
      const ta = event.target.closest('.sticky-textarea');
      const note = ta && char.sticky_notes.find(n => n.id === ta.dataset.noteId);
      if (note) { note.text = ta.value; triggerAutosave(); }
    });
    surface.addEventListener('click', event => {
      const button = event.target.closest('[data-note-action]');
      if (!button) return;
      const note = char.sticky_notes.find(n => n.id === button.closest('.sticky-note').dataset.noteId);
      if (!note) return;
      if (button.dataset.noteAction === 'delete') char.sticky_notes = char.sticky_notes.filter(n => n !== note);
      if (button.dataset.noteAction === 'return') returnStickyNote(note);
      if (['previous', 'next'].includes(button.dataset.noteAction)) {
        const notes = char.sticky_notes.filter(n => !n.position);
        const other = notes[notes.indexOf(note) + (button.dataset.noteAction === 'previous' ? -1 : 1)];
        if (other) {
          const i = char.sticky_notes.indexOf(note), j = char.sticky_notes.indexOf(other);
          [char.sticky_notes[i], char.sticky_notes[j]] = [other, note];
        }
      }
      renderStickyNotes(); triggerAutosave();
    });
    surface.addEventListener('pointerdown', startStickyDrag);
  });
  document.addEventListener('pointermove', moveStickyDrag);
  document.addEventListener('pointerup', event => finishStickyDrag(event, false));
  document.addEventListener('pointercancel', event => finishStickyDrag(event, true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && stickyDrag) finishStickyDrag(null, true);
  });
  window.addEventListener('blur', () => { if (stickyDrag) finishStickyDrag(null, true); });
  window.addEventListener('resize', () => {
    if (stickyDrag) finishStickyDrag(null, true);
    stickyLayer.querySelectorAll('.sticky-note').forEach(el => {
      const note = char.sticky_notes.find(n => n.id === el.dataset.noteId);
      positionStickyNote(el, note.position, note.size);
    });
    layoutStickyBoard();
  });
  document.querySelectorAll('.sticky-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const note = { id: crypto.randomUUID(), color: btn.dataset.color || 'yellow', text: '' };
      char.sticky_notes.push(note);
      renderStickyNotes(); triggerAutosave();
      board.querySelectorAll('.sticky-textarea')[board.querySelectorAll('.sticky-textarea').length - 1]?.focus();
    });
  });
  renderStickyNotes();
}

function stickyNoteArea(note) {
  return (note.size?.width || 240) * (note.size?.height || 190);
}

function returnStickyNote(note) {
  delete note.position;
  // Apply size priority only on return; later manual moves keep their order.
  const boardNotes = char.sticky_notes.filter(n => !n.position).sort((a, b) => stickyNoteArea(b) - stickyNoteArea(a));
  char.sticky_notes = [...boardNotes, ...char.sticky_notes.filter(n => n.position)];
}

function layoutStickyBoard() {
  const board = document.getElementById('sticky-board');
  if (!board || !board.clientWidth) return;
  const available = Math.max(1, board.clientWidth - 24);
  const columns = Math.max(1, Math.floor((available + 18) / 218));
  const columnWidth = (available - (columns - 1) * 18) / columns;
  board.querySelectorAll('.sticky-note:not(.sticky-dragging)').forEach(el => {
    const note = char.sticky_notes.find(n => n.id === el.dataset.noteId);
    const span = Math.min(columns, Math.max(1, Math.ceil(((note.size?.width || 200) + 18) / (columnWidth + 18))));
    el.style.gridColumn = 'span ' + span;
    if (note.size) {
      el.style.height = Math.max(190, note.size.height) + 'px';
      el.style.width = Math.min(available, Math.max(200, note.size.width)) + 'px';
    }
  });
}

function positionStickyNote(el, position, size) {
  const width = Math.min(size?.width || 240, window.innerWidth - 24);
  el.style.width = width + 'px';
  el.style.height = Math.min(size?.height || 190, window.innerHeight - 24) + 'px';
  el.style.left = Math.max(12, Math.min(1, Math.max(0, position.x || 0)) * Math.max(0, window.innerWidth - width - 24) + 12) + 'px';
  el.style.top = Math.max(12, Math.min(1, Math.max(0, position.y || 0)) * Math.max(0, window.innerHeight - el.offsetHeight - 24) + 12) + 'px';
}

function renderStickyNotes() {
  const board = document.getElementById('sticky-board');
  if (!board || !stickyLayer) return;
  board.replaceChildren(); stickyLayer.replaceChildren();
  const colors = ['yellow', 'blue', 'green', 'pink', 'purple'];
  char.sticky_notes.forEach(note => {
    const el = document.createElement('article');
    el.className = 'sticky-note sticky-' + (colors.includes(note.color) ? note.color : 'yellow');
    el.dataset.noteId = note.id;
    el.innerHTML = '<div class="sticky-note-header"><span class="sticky-grip" title="Segure para arrastar">⠿ <span>Anotação</span></span><div class="sticky-actions">' +
      (note.position ? '<button data-note-action="return" title="Voltar para a aba Anotações" aria-label="Voltar para a aba Anotações">↩</button>' : '<button data-note-action="previous" title="Mover para antes" aria-label="Mover para antes">←</button><button data-note-action="next" title="Mover para depois" aria-label="Mover para depois">→</button>') +
      '<button class="sticky-del-btn" data-note-action="delete" title="Remover" aria-label="Remover anotação">×</button></div></div><textarea class="sticky-textarea" aria-label="Texto da anotação" placeholder="Escreva aqui…"></textarea>';
el.insertAdjacentHTML('beforeend', '<span class="sticky-resize sticky-resize-right" data-resize="right" title="Arraste para ajustar a largura"></span><span class="sticky-resize sticky-resize-bottom" data-resize="bottom" title="Arraste para ajustar a altura"></span><span class="sticky-resize sticky-resize-corner" data-resize="both" title="Arraste para ajustar o tamanho">◢</span>');
    const ta = el.querySelector('textarea'); ta.dataset.noteId = note.id; ta.value = note.text || '';
    if (note.position) {
      el.classList.add('sticky-floating');

      stickyLayer.appendChild(el); positionStickyNote(el, note.position, note.size);
    } else board.appendChild(el);
  });
  layoutStickyBoard();
  if (!board.children.length) {
    const empty = document.createElement('p'); empty.className = 'sticky-empty';
    empty.textContent = char.sticky_notes.length ? 'Suas anotações estão fixadas na tela. Arraste-as de volta para este quadro quando quiser.' : 'Crie uma anotação e arraste pela alça para organizar ou fixar na tela.';
    board.appendChild(empty);
  }
}

function startStickyDrag(event) {
  const resize = event.target.closest('[data-resize]');
  if (event.button !== 0 || stickyDrag || event.target.closest('button') || (!resize && !event.target.closest('.sticky-note-header'))) return;
  const el = event.target.closest('.sticky-note');
  const rect = el.getBoundingClientRect();
  stickyDrag = { el, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, dx: event.clientX - rect.left, dy: event.clientY - rect.top, rect, resize: resize?.dataset.resize, wasFloating: el.classList.contains('sticky-floating'), originalParent: el.parentElement, originalNext: el.nextSibling, moved: false };
  el.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function moveStickyDrag(event) {
  const drag = stickyDrag;
  if (!drag || drag.pointer !== event.pointerId) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
  if (!drag.moved) {
    drag.moved = true;
    if (!drag.resize && !drag.el.classList.contains('sticky-floating')) {
      drag.placeholder = document.createElement('div'); drag.placeholder.className = 'sticky-placeholder';
      drag.placeholder.style.height = drag.rect.height + 'px'; drag.placeholder.style.gridColumn = drag.el.style.gridColumn; drag.el.before(drag.placeholder);
    }
    drag.el.classList.add('sticky-dragging');
    if (!drag.resize || drag.wasFloating) {
      Object.assign(drag.el.style, {position: 'fixed', width: drag.rect.width + 'px', height: drag.rect.height + 'px', margin: '0'});
    }
    document.body.classList.add(drag.resize ? 'sticky-is-resizing' : 'sticky-is-dragging');
    if (drag.resize) document.body.dataset.stickyResize = drag.resize;
  }
  event.preventDefault();
  if (drag.resize) {
    const board = document.getElementById('sticky-board');
    const available = Math.max(1, board.clientWidth - 24);
    const maxWidth = drag.wasFloating ? window.innerWidth - drag.rect.left - 12 : available;
    const maxHeight = drag.wasFloating ? window.innerHeight - drag.rect.top - 12 : Math.max(2000, drag.rect.height);
    const width = drag.resize === 'bottom' ? drag.rect.width : Math.max(Math.min(200, maxWidth), Math.min(maxWidth, drag.rect.width + event.clientX - drag.startX));
    const height = drag.resize === 'right' ? drag.rect.height : Math.max(Math.min(190, maxHeight), Math.min(maxHeight, drag.rect.height + event.clientY - drag.startY));
    drag.el.style.width = width + 'px'; drag.el.style.height = height + 'px';
    if (drag.wasFloating) {
      drag.el.style.left = drag.rect.left + 'px'; drag.el.style.top = drag.rect.top + 'px';
    } else {
      const columns = Math.max(1, Math.floor((available + 18) / 218));
      const columnWidth = (available - (columns - 1) * 18) / columns;
      drag.el.style.gridColumn = 'span ' + Math.min(columns, Math.max(1, Math.ceil((width + 18) / (columnWidth + 18))));
    }
    return;
  }
  const left = Math.max(12, Math.min(window.innerWidth - drag.rect.width - 12, event.clientX - drag.dx));
  const top = Math.max(12, Math.min(window.innerHeight - drag.rect.height - 12, event.clientY - drag.dy));
  drag.el.style.left = left + 'px'; drag.el.style.top = top + 'px';
  const board = document.getElementById('sticky-board'), rect = board.getBoundingClientRect();
  drag.inBoard = rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  board.classList.toggle('sticky-drop-active', drag.inBoard);
  if (drag.inBoard) {
    if (!drag.placeholder) { drag.placeholder = document.createElement('div'); drag.placeholder.className = 'sticky-placeholder'; drag.placeholder.style.height = drag.rect.height + 'px'; }
    const cards = [...board.querySelectorAll('.sticky-note:not(.sticky-dragging)')];
    const next = cards.find(card => { const r = card.getBoundingClientRect(); return event.clientY < r.top || (event.clientY <= r.bottom && event.clientX < r.left + r.width / 2); });
    if (drag.placeholder.nextSibling !== (next || null) || drag.placeholder.parentElement !== board) {
      const previous = new Map(cards.map(card => [card, card.getBoundingClientRect()]));
      board.insertBefore(drag.placeholder, next || null);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) cards.forEach(card => {
        const before = previous.get(card), after = card.getBoundingClientRect();
        if (before.x !== after.x || before.y !== after.y) card.animate([{transform: 'translate(' + (before.x - after.x) + 'px,' + (before.y - after.y) + 'px)'}, {transform: 'none'}], {duration: 160, easing: 'ease-out'});
      });
    }
  } else if (drag.placeholder) drag.placeholder.remove();
}

function finishStickyDrag(event, cancel) {
  const drag = stickyDrag;
  if (!drag || (event && event.pointerId !== drag.pointer)) return;
  stickyDrag = null;
  if (drag.el.hasPointerCapture(drag.pointer)) drag.el.releasePointerCapture(drag.pointer);
  if (drag.moved && !cancel) {
    const note = char.sticky_notes.find(n => n.id === drag.el.dataset.noteId);
    if (drag.resize) {
      const r = drag.el.getBoundingClientRect();
      note.size = {width: Math.round(r.width), height: Math.round(r.height)};
      if (drag.wasFloating) {
        note.position = { x: (r.left - 12) / Math.max(1, window.innerWidth - r.width - 24), y: (r.top - 12) / Math.max(1, window.innerHeight - r.height - 24) };
      }
    } else if (drag.inBoard && drag.wasFloating) {
      returnStickyNote(note);
    } else if (drag.inBoard) {
      let next = drag.placeholder?.nextElementSibling;
      while (next && !next.matches('.sticky-note:not(.sticky-dragging)')) next = next.nextElementSibling;
      const nextNote = next && char.sticky_notes.find(n => n.id === next.dataset.noteId);
      delete note.position;
      char.sticky_notes = char.sticky_notes.filter(n => n !== note);
      char.sticky_notes.splice(nextNote ? char.sticky_notes.indexOf(nextNote) : char.sticky_notes.length, 0, note);
    } else {
      const r = drag.el.getBoundingClientRect();
      note.position = { x: (r.left - 12) / Math.max(1, window.innerWidth - r.width - 24), y: (r.top - 12) / Math.max(1, window.innerHeight - r.height - 24) };
    }
    triggerAutosave();
  }
  drag.placeholder?.remove();
  document.body.classList.remove('sticky-is-dragging', 'sticky-is-resizing');
  delete document.body.dataset.stickyResize;
  document.getElementById('sticky-board')?.classList.remove('sticky-drop-active');
  if (drag.moved) renderStickyNotes();
}

// ── REST ──────────────────────────────────────────
function initRest() {
  document.getElementById('btn-long-rest')?.addEventListener('click', doLongRest);
  document.getElementById('btn-short-rest')?.addEventListener('click', doShortRest);
}

function doLongRest() {
  restoreBardInspiration(char, true);
  resetBladeFlourish(char);
  // HP total
  char.hit_points.current = char.hit_points.max || 0;
  char.hit_points.temporary = 0;

  // Spell slots
  ensureSpellSlots();
  for (let i = 1; i <= 9; i++) {
    char.spell_slots[i].current = char.spell_slots[i].max;
  }

  // Habilidades: recupera long_rest e unlimited
  (char.abilities || []).forEach(ab => {
    if (ab.uses_max > 0 && (ab.recovery_type === 'long_rest' || ab.recovery_type === 'unlimited')) {
      ab.uses_current = ab.uses_max;
    }
  });

  // Talentos ativos: recupera long_rest e unlimited
  (char.talentos || []).filter(t => t.type === 'ativo' && t.uses_max > 0).forEach(t => {
    if (t.recovery_type === 'long_rest' || t.recovery_type === 'unlimited') t.uses_current = t.uses_max;
  });

  // Sinfonia kit
  if (char.sinfonia?.kit) {
    Object.values(char.sinfonia.kit).forEach(k => { if (k.max) k.uses = k.max; });
    char.sinfonia.energizacao_stacks = 0;
    char.sinfonia.sincronizacao_active = false;
    char.sinfonia.vantagem_active = false;
  }

  syncHPInputs();
  renderSpellSlots();
  renderAbilities();
  renderTalentos();
  renderSinfonia();
  recalcAll();
  triggerAutosave();

  showToast('★ Descanso Longo completo — PV, espaços e habilidades restaurados.');
}

function doShortRest() {
  const hitDice = char.hit_points.hit_dice || '1d8';
  openModal(`
    <h3>☽ Descanso Curto</h3>
    <p style="font-size:0.83rem;color:var(--muted);margin-bottom:12px">Gaste dados de vida para recuperar PV. Dado de vida: <strong>${esc(hitDice)}</strong></p>
    <div class="form-row">
      <label>Quantos dados de vida gastar?</label>
      <input id="sr-dice-count" type="number" min="1" max="20" value="1" style="width:70px">
    </div>
    <div id="sr-result" style="font-size:0.85rem;min-height:24px;color:var(--green);font-weight:700"></div>
    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="sr-roll-btn">🎲 Rolar e Recuperar</button>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('sr-roll-btn').onclick = () => {
    const count = parseInt(document.getElementById('sr-dice-count')?.value) || 1;
    const conMod = modifier(getEffectiveAttr(char, 'con'));
    const formula = `${count}${hitDice}`;
    const roll = parseAndRoll(formula);
    const total = Math.max(1, roll.total + count * conMod);
    applyHeal(char, total);
    syncHPInputs();

    // Habilidades short_rest
    (char.abilities || []).forEach(ab => {
      if (ab.uses_max > 0 && (ab.recovery_type === 'short_rest' || ab.recovery_type === 'unlimited')) {
        ab.uses_current = ab.uses_max;
      }
    });

    // Talentos ativos: recupera short_rest e unlimited
    (char.talentos || []).filter(t => t.type === 'ativo' && t.uses_max > 0).forEach(t => {
      if (t.recovery_type === 'short_rest' || t.recovery_type === 'unlimited') t.uses_current = t.uses_max;
    });

    // Sinfonia kit (se algum for short_rest)
    if (char.sinfonia?.kit) {
      Object.values(char.sinfonia.kit).forEach(k => { if (k.max) k.uses = k.max; });
    }

    renderAbilities();
    renderTalentos();
    renderSinfonia();
    recalcAll();
    triggerAutosave();

    document.getElementById('sr-result').textContent =
      `Recuperou ${total} PV (${roll.rolls.join('+')} + CON×${count}: ${count * conMod})`;
    document.getElementById('sr-roll-btn').disabled = true;
  };
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `rest-toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('rest-toast-show'));
  setTimeout(() => { t.classList.remove('rest-toast-show'); setTimeout(() => t.remove(), 400); }, 3500);
}

function showConfirm(msg, onConfirm) {
  openModal(`
    <div class="confirm-dialog">
      <p class="confirm-message">${esc(msg)}</p>
      <div class="form-actions">
        <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
        <button class="btn btn-danger" id="confirm-ok-btn">Confirmar</button>
      </div>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('confirm-ok-btn').onclick = () => { closeModal(); onConfirm(); };
}

// ── SHEET PARSER ──────────────────────────────────
function initParseSheet() {
  document.getElementById('btn-parse-sheet')?.addEventListener('click', openParseSheetModal);
}

function openParseSheetModal() {
  openModal(`
    <h3>🤖 Ler Ficha com IA</h3>
    <p style="font-size:0.82rem;color:var(--muted);margin-bottom:12px">
      Cole o texto da ficha ou envie um arquivo (PDF, PNG, JPG). A IA extrai os dados e preenche a ficha automaticamente.
    </p>
    <div class="form-row">
      <label>Arquivo (PDF ou imagem)</label>
      <input type="file" id="parse-file-input" accept=".pdf,.png,.jpg,.jpeg,.webp" style="font-size:0.82rem">
    </div>
    <div style="text-align:center;font-size:0.78rem;color:var(--muted);margin:6px 0">— ou —</div>
    <div class="form-row">
      <label>Cole o texto da ficha</label>
      <textarea id="parse-text-input" rows="8" placeholder="Cole aqui o conteúdo da ficha (texto copiado de PDF, site, etc.)…"></textarea>
    </div>
    <div id="parse-status" style="font-size:0.82rem;color:var(--muted);min-height:20px;margin-bottom:8px"></div>
    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="btn-parse-send">🤖 Analisar</button>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('btn-parse-send').onclick = sendParseSheet;
}

async function sendParseSheet() {
  const fileInput = document.getElementById('parse-file-input');
  const textInput = document.getElementById('parse-text-input');
  const status    = document.getElementById('parse-status');
  const btn       = document.getElementById('btn-parse-send');

  const file = fileInput?.files?.[0];
  const text = textInput?.value?.trim();

  if (!file && !text) {
    status.textContent = 'Envie um arquivo ou cole o texto da ficha.';
    status.style.color = 'var(--accent)';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Analisando…';
  status.style.color = 'var(--muted)';
  status.textContent = 'Enviando para IA…';

  try {
    let response;
    if (file) {
      const form = new FormData();
      form.append('file', file);
      response = await fetch(`/api/character/${char.id}/parse-sheet`, { method: 'POST', body: form });
    } else {
      response = await fetch(`/api/character/${char.id}/parse-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    }

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Erro desconhecido');
    }

    closeModal();
    showParsePreview(result.data);
  } catch (err) {
    status.textContent = `Erro: ${err.message}`;
    status.style.color = 'var(--accent)';
    btn.disabled = false;
    btn.textContent = '🤖 Analisar';
  }
}

function showParsePreview(data) {
  const lines = buildPreviewLines(data);
  openModal(`
    <h3>✅ Dados Extraídos</h3>
    <p style="font-size:0.82rem;color:var(--muted);margin-bottom:10px">
      Revise o que foi encontrado. Clique em "Aplicar" para preencher a ficha.
    </p>
    <div class="parse-preview-list">${lines}</div>
    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="btn-parse-apply">Aplicar à Ficha</button>
    </div>
  `);
  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('btn-parse-apply').onclick = () => {
    applyParsedData(data);
    closeModal();
  };
}

function buildPreviewLines(data) {
  const rows = [];
  const add = (label, val) => rows.push(`<div class="parse-preview-row"><span class="parse-label">${label}</span><span class="parse-val">${esc(String(val))}</span></div>`);

  if (data.name)       add('Nome',        data.name);
  if (data.class_name) add('Classe',      data.class_name);
  if (data.level)      add('Nível',       data.level);
  if (data.origin)     add('Raça/Origem', data.origin);
  if (data.background) add('Antecedente', data.background);
  if (data.alignment)  add('Tendência',   data.alignment);
  if (data.speed)      add('Deslocamento', `${data.speed}m`);

  if (data.attributes) {
    const attrs = Object.entries(data.attributes).map(([k,v]) => `${k.toUpperCase()} ${v}`).join(' · ');
    add('Atributos', attrs);
  }
  if (data.hit_points) {
    const hp = data.hit_points;
    add('HP', `${hp.current ?? hp.max ?? '?'} / ${hp.max ?? '?'}${hp.hit_dice ? ` (${hp.hit_dice})` : ''}`);
  }

  const profSkills = (data.skills || []).filter(s => s.proficient).map(s => s.name);
  if (profSkills.length) add('Perícias (prof.)', profSkills.join(', '));

  const profSaves = (data.saving_throws || []).filter(s => s.proficient).map(s => s.attr?.toUpperCase());
  if (profSaves.length) add('Resistências (prof.)', profSaves.join(', '));

  if ((data.inventory || []).length) add('Itens', `${data.inventory.length} item(ns)`);
  if ((data.abilities || []).length) add('Habilidades', `${data.abilities.length} habilidade(s)`);
  if ((data.spells || []).length)    add('Magias',      `${data.spells.length} magia(s)`);

  if (data.spell_slots) {
    const slots = Object.entries(data.spell_slots)
      .filter(([, v]) => v.max > 0)
      .map(([k, v]) => `C${k}:${v.max}`)
      .join(' ');
    if (slots) add('Espaços de Magia', slots);
  }

  return rows.join('');
}

function applyParsedData(data) {
  const DIRECT = ['name','level','class_name','origin','background','alignment','speed','proficiency_bonus'];
  DIRECT.forEach(f => { if (data[f] !== undefined) char[f] = data[f]; });

  if (data.attributes) Object.assign(char.attributes, data.attributes);
  if (data.hit_points) Object.assign(char.hit_points, data.hit_points);

  if (data.currency) Object.assign(char.currency, data.currency);
  if (data.notes)    Object.assign(char.notes, data.notes);

  if (data.saving_throws?.length) {
    data.saving_throws.forEach(parsed => {
      const existing = char.saving_throws.find(s => s.attr === parsed.attr);
      if (existing) existing.proficient = parsed.proficient ?? false;
    });
  }

  if (data.skills?.length) {
    data.skills.forEach(parsed => {
      const existing = char.skills.find(s => s.id === parsed.id);
      if (existing) {
        existing.proficient   = parsed.proficient   ?? false;
        existing.expertise    = parsed.expertise    ?? false;
        existing.manual_bonus = parsed.manual_bonus ?? 0;
      }
    });
  }

  if (data.inventory?.length)   char.inventory  = [...(char.inventory || []),  ...data.inventory];
  if (data.abilities?.length)   char.abilities  = [...(char.abilities || []),  ...data.abilities];
  if (data.spells?.length)      char.spells     = [...(char.spells    || []),  ...data.spells];

  if (data.spell_slots) {
    if (!char.spell_slots) char.spell_slots = {};
    Object.entries(data.spell_slots).forEach(([k, v]) => {
      char.spell_slots[k] = v;
    });
  }

  // Sync all inputs
  document.querySelectorAll('[data-field]').forEach(el => {
    const val = el.dataset.field.split('.').reduce((o, k) => o?.[k], char);
    if (val !== undefined) {
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val;
    }
  });

  recalcAll();
  renderAbilities();
  renderInventory();
  renderSpellSlots();
  renderSpells();
  renderSaves();
  renderSkills();
  triggerAutosave();
}

// ── TALENTOS ──────────────────────────────────────
const TALENTO_MOD_TARGETS = {
  str: 'Força', dex: 'Destreza', con: 'Constituição',
  int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma',
  ca: 'CA', initiative: 'Iniciativa', prof: 'Proficiência',
  spell_dc: 'CD de Magia', spell_atk: 'Ataque Mágico',
};

const TALENTO_MOD_FORMULAS = {
  prof:          'Proficiência',
  cha_mod:       'Mod. Carisma',
  str_mod:       'Mod. Força',
  dex_mod:       'Mod. Destreza',
  con_mod:       'Mod. Constituição',
  int_mod:       'Mod. Inteligência',
  wis_mod:       'Mod. Sabedoria',
  half_cha_attr: 'Metade de CAR (atributo)',
  half_str_attr: 'Metade de FOR (atributo)',
  half_dex_attr: 'Metade de DES (atributo)',
  half_cha_mod:  'Metade do Mod. CAR',
  half_str_mod:  'Metade do Mod. FOR',
  half_dex_mod:  'Metade do Mod. DES',
};

function initTalentos() {
  if (!char.talentos) char.talentos = [];
  renderTalentos();
  renderTalentoToggles();
  document.getElementById('btn-add-talento')?.addEventListener('click', openAddTalentoModal);
}

function renderTalentoToggles() {
  const container = document.getElementById('talento-toggles');
  const defenseContainer = document.getElementById('defense-talent-toggles');
  if (!container) return;
  container.innerHTML = '';
  if (defenseContainer) defenseContainer.innerHTML = '';
  const toggleables = (char.talentos || []).filter(t => t.type === 'ativo' && t.toggleable);
  if (toggleables.length === 0) return;

  toggleables.forEach(tal => {
    const btn = document.createElement('button');
    const isDefense = (tal.modifiers || []).some(mod => mod.target === 'ca');
    btn.className = 'btn btn-talento-toggle'
      + (isDefense ? ' btn-defense-toggle' : '')
      + (tal.active ? ' tal-toggle-on' : '');
    btn.dataset.talToggle = tal.id;
    btn.title = tal.description || tal.name;
    const modSummary = (tal.modifiers || []).map(m => {
      const tgt = TALENTO_MOD_TARGETS[m.target] || m.target;
      const val = m.formula ? `(${TALENTO_MOD_FORMULAS[m.formula]||m.formula})` : (parseInt(m.value)>=0?'+':'')+m.value;
      return `${tgt} ${val}`;
    }).join(', ');
    btn.innerHTML = `<span class="tal-tog-name">${esc(tal.name)}</span>${modSummary ? `<span class="tal-tog-mods">${esc(modSummary)}</span>` : ''}`;
    (isDefense && defenseContainer ? defenseContainer : container).appendChild(btn);
  });

  const handleToggle = e => {
    const btn = e.target.closest('[data-tal-toggle]');
    if (!btn) return;
    const tal = char.talentos.find(t => t.id === btn.dataset.talToggle);
    if (!tal) return;
    tal.active = !tal.active;
    btn.classList.toggle('tal-toggle-on', tal.active);
    recalcAll();
    triggerAutosave();
  };
  container.onclick = handleToggle;
  if (defenseContainer) defenseContainer.onclick = handleToggle;
}

function renderTalentos() {
  if (!char.talentos) char.talentos = [];
  const list = document.getElementById('talentos-list');
  if (!list) return;
  list.innerHTML = '';

  if (char.talentos.length === 0) {
    list.innerHTML = '<p class="talentos-empty">Nenhum talento cadastrado.</p>';
    return;
  }

  char.talentos.forEach(tal => {
    const card = document.createElement('div');
    card.className = `talento-card talento-${tal.type}`;

    const typeLabel = tal.type === 'ativo' ? 'Ativo' : 'Passivo';
    const actionTag = tal.type === 'ativo'
      ? `<span class="talento-action-tag">${ACTION_LABELS[tal.action_type] || tal.action_type}</span>` : '';
    const usesHtml = (tal.type === 'ativo' && tal.uses_max > 0) ? `
      <div class="talento-uses">
        <button class="uses-btn" data-tal-use="${tal.id}" ${tal.uses_current <= 0 ? 'disabled' : ''}>−</button>
        <span class="uses-counter">${tal.uses_current}/${tal.uses_max}</span>
        <button class="uses-btn" data-tal-restore="${tal.id}" ${tal.uses_current >= tal.uses_max ? 'disabled' : ''}>+</button>
      </div>` : '';
    const showMods = tal.modifiers?.length && (tal.type === 'passivo' || tal.toggleable);
    const modsHtml = showMods ? `
      <div class="talento-mods${tal.type==='ativo'?' talento-mods-toggle':''}">
        ${tal.modifiers.map(m => {
          const valLabel = m.formula
            ? TALENTO_MOD_FORMULAS[m.formula] || m.formula
            : (parseInt(m.value) >= 0 ? '+' : '') + m.value;
          return `<span class="talento-mod-badge">${TALENTO_MOD_TARGETS[m.target] || m.target} ${valLabel}</span>`;
        }).join('')}
      </div>` : '';

    card.innerHTML = `
      <div class="talento-card-header">
        <div class="talento-card-left">
          <span class="talento-name">${esc(tal.name)}</span>
          <span class="talento-type-badge talento-badge-${tal.type}">${typeLabel}</span>
          ${actionTag}
        </div>
        <div class="talento-card-actions">
          ${usesHtml}
          <button class="delete-btn-small" data-tal-edit="${tal.id}" title="Editar">✎</button>
          <button class="delete-btn-small" data-tal-del="${tal.id}" title="Remover">✕</button>
        </div>
      </div>
      ${modsHtml}
      ${tal.description ? `<div class="talento-desc">${esc(tal.description)}</div>` : ''}
    `;
    list.appendChild(card);
  });

  list.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-tal-edit]');
    if (editBtn) { openEditTalentoModal(editBtn.dataset.talEdit); return; }

    const delBtn = e.target.closest('[data-tal-del]');
    if (delBtn) {
      char.talentos = char.talentos.filter(t => t.id !== delBtn.dataset.talDel);
      renderTalentos();
      recalcAll();
      triggerAutosave();
      return;
    }

    const useBtn = e.target.closest('[data-tal-use]');
    if (useBtn) {
      const tal = char.talentos.find(t => t.id === useBtn.dataset.talUse);
      if (tal && tal.uses_current > 0) { tal.uses_current--; renderTalentos(); triggerAutosave(); }
      return;
    }

    const restoreBtn = e.target.closest('[data-tal-restore]');
    if (restoreBtn) {
      const tal = char.talentos.find(t => t.id === restoreBtn.dataset.talRestore);
      if (tal && tal.uses_current < tal.uses_max) { tal.uses_current++; renderTalentos(); triggerAutosave(); }
    }
  });
}

function openAddTalentoModal() {
  showTalentoModal(newTalento(), true);
}

function openEditTalentoModal(id) {
  const tal = char.talentos.find(t => t.id === id);
  if (tal) showTalentoModal(tal, false);
}

let _talMods = [];

function showTalentoModal(tal, isNew) {
  _talMods = (tal.modifiers || []).map(m => ({ ...m }));
  let currentType = tal.type;

  const needsMods = tal.type === 'passivo' || (tal.type === 'ativo' && tal.toggleable);
  const content = `
    <h3>${isNew ? 'Novo Talento' : 'Editar Talento'}</h3>
    <div class="form-row">
      <label>Nome</label>
      <input id="mtal-name" type="text" value="${esc(tal.name)}">
    </div>
    <div class="form-row">
      <label>Tipo</label>
      <div class="talento-type-toggle">
        <button type="button" class="type-toggle-btn ${tal.type==='ativo'?'active':''}" data-type="ativo">⚔ Ativo</button>
        <button type="button" class="type-toggle-btn ${tal.type==='passivo'?'active':''}" data-type="passivo">✦ Passivo</button>
      </div>
    </div>
    <div id="mtal-ativo-fields" class="${tal.type==='ativo'?'':'hidden'}">
      <div class="form-row"><label>Tipo de Ação</label>
        <select id="mtal-action">
          ${Object.entries(ACTION_LABELS).map(([k,v]) =>
            `<option value="${k}" ${tal.action_type===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Usos Máximos <small>(0 = ilimitado)</small></label>
        <input id="mtal-uses-max" type="number" min="0" value="${tal.uses_max}">
      </div>
      <div class="form-row"><label>Recuperação</label>
        <select id="mtal-rec">
          ${Object.entries(RECOVERY_LABELS).map(([k,v]) =>
            `<option value="${k}" ${tal.recovery_type===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label class="mtal-toggle-label">
          <input type="checkbox" id="mtal-toggleable" ${tal.toggleable?'checked':''}>
          <span>Ativável com toggle (aplica modificadores quando ligado)</span>
        </label>
      </div>
    </div>
    <div id="mtal-mods-section" class="${needsMods?'':'hidden'}">
      <div class="form-row form-row-col">
        <label id="mtal-mods-label">${tal.type==='ativo'?'Modificadores quando ativo':'Modificadores automáticos'}</label>
        <div id="mtal-mods-list" class="mtal-mods-list"></div>
        <div class="mtal-add-mod">
          <select class="mtal-mod-target">
            ${Object.entries(TALENTO_MOD_TARGETS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
          <select class="mtal-vtype">
            <option value="fixed">Número</option>
            <option value="formula">Fórmula</option>
          </select>
          <input class="mtal-val-fixed" type="number" value="1" style="width:52px">
          <select class="mtal-val-formula hidden">
            ${Object.entries(TALENTO_MOD_FORMULAS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-sm mtal-add-mod-btn">+ Add</button>
        </div>
      </div>
    </div>
    <div class="form-row form-row-col">
      <label>Descrição</label>
      <textarea id="mtal-desc" rows="3">${esc(tal.description)}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-muted" id="modal-cancel-btn">Cancelar</button>
      <button class="btn" id="modal-save-btn">Salvar</button>
    </div>
  `;
  openModal(content);
  renderTalentoModalMods();

  const updateModsVisibility = () => {
    const isPassivo = currentType === 'passivo';
    const isToggleable = document.getElementById('mtal-toggleable')?.checked;
    const show = isPassivo || isToggleable;
    document.getElementById('mtal-mods-section').classList.toggle('hidden', !show);
    const lbl = document.getElementById('mtal-mods-label');
    if (lbl) lbl.textContent = isPassivo ? 'Modificadores automáticos' : 'Modificadores quando ativo';
  };

  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.type === currentType));
      document.getElementById('mtal-ativo-fields').classList.toggle('hidden', currentType !== 'ativo');
      updateModsVisibility();
    });
  });

  document.getElementById('mtal-toggleable')?.addEventListener('change', updateModsVisibility);

  document.querySelector('.mtal-vtype')?.addEventListener('change', e => {
    const wrap = e.target.closest('.mtal-add-mod');
    wrap.querySelector('.mtal-val-fixed').classList.toggle('hidden', e.target.value !== 'fixed');
    wrap.querySelector('.mtal-val-formula').classList.toggle('hidden', e.target.value !== 'formula');
  });

  document.querySelector('.mtal-add-mod-btn')?.addEventListener('click', () => {
    const wrap = document.querySelector('.mtal-add-mod');
    const target = wrap.querySelector('.mtal-mod-target').value;
    const vtype  = wrap.querySelector('.mtal-vtype').value;
    if (vtype === 'formula') {
      _talMods.push({ target, formula: wrap.querySelector('.mtal-val-formula').value });
    } else {
      _talMods.push({ target, value: parseInt(wrap.querySelector('.mtal-val-fixed').value) || 1 });
    }
    renderTalentoModalMods();
  });

  document.getElementById('modal-cancel-btn').onclick = closeModal;
  document.getElementById('modal-save-btn').onclick = () => {
    tal.name = document.getElementById('mtal-name').value.trim() || 'Talento';
    tal.type = currentType;
    tal.description = document.getElementById('mtal-desc').value;
    if (currentType === 'ativo') {
      tal.action_type = document.getElementById('mtal-action').value;
      tal.uses_max = parseInt(document.getElementById('mtal-uses-max').value) || 0;
      tal.uses_current = Math.min(tal.uses_current || 0, tal.uses_max || 999);
      tal.recovery_type = document.getElementById('mtal-rec').value;
      tal.toggleable = document.getElementById('mtal-toggleable')?.checked || false;
      tal.modifiers = tal.toggleable ? [..._talMods] : [];
    } else {
      tal.modifiers = [..._talMods];
    }
    if (isNew) char.talentos.push(tal);
    renderTalentos();
    renderTalentoToggles();
    recalcAll();
    triggerAutosave();
    closeModal();
  };
}

function modAddHtml() {
  return `
    <div class="mtal-add-mod">
      <select class="mtal-mod-target">
        ${Object.entries(TALENTO_MOD_TARGETS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <select class="mtal-vtype">
        <option value="fixed">Número</option>
        <option value="formula">Fórmula</option>
      </select>
      <input class="mtal-val-fixed" type="number" value="1" style="width:52px">
      <select class="mtal-val-formula hidden">
        ${Object.entries(TALENTO_MOD_FORMULAS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <button type="button" class="btn btn-sm mtal-add-mod-btn">+ Add</button>
    </div>
  `;
}

function renderTalentoModalMods() {
  const list = document.getElementById('mtal-mods-list');
  if (!list) return;
  list.innerHTML = '';
  if (_talMods.length === 0) {
    list.innerHTML = '<p class="mtal-mods-empty">Nenhum modificador.</p>';
    return;
  }
  _talMods.forEach((mod, i) => {
    const row = document.createElement('div');
    row.className = 'mtal-mod-row';
    const valLabel = mod.formula
      ? TALENTO_MOD_FORMULAS[mod.formula] || mod.formula
      : (parseInt(mod.value) >= 0 ? '+' : '') + mod.value;
    row.innerHTML = `
      <span class="mtal-mod-label">${TALENTO_MOD_TARGETS[mod.target] || mod.target}</span>
      <span class="mtal-mod-val">${valLabel}</span>
      <button type="button" class="delete-btn-small" data-del-mod="${i}" title="Remover">✕</button>
    `;
    list.appendChild(row);
  });
  list.querySelectorAll('[data-del-mod]').forEach(btn => {
    btn.addEventListener('click', () => {
      _talMods.splice(parseInt(btn.dataset.delMod), 1);
      renderTalentoModalMods();
    });
  });
}

// ── CONDITIONS ────────────────────────────────────
const ALL_CONDITIONS = [
  'Envenenado','Agarrado','Atordoado','Caído','Inconsciente',
  'Assustado','Cego','Surdo','Abalado','Exausto',
];

function initConditions() {
  if (!char.conditions) char.conditions = [];
  renderConditions();
  const bar = document.getElementById('conditions-bar');
  bar?.addEventListener('click', e => {
    const chip = e.target.closest('.condition-chip');
    if (!chip) return;
    const cond = chip.dataset.cond;
    if (!cond) return;
    if (!char.conditions) char.conditions = [];
    const idx = char.conditions.indexOf(cond);
    if (idx >= 0) char.conditions.splice(idx, 1);
    else char.conditions.push(cond);
    renderConditions();
    triggerAutosave();
  });
}

function renderConditions() {
  const bar = document.getElementById('conditions-bar');
  if (!bar) return;
  if (!char.conditions) char.conditions = [];
  bar.innerHTML = '<span class="conditions-label">Condições:</span>';
  ALL_CONDITIONS.forEach(cond => {
    const chip = document.createElement('button');
    chip.className = 'condition-chip' + (char.conditions.includes(cond) ? ' condition-active' : '');
    chip.dataset.cond = cond;
    chip.textContent = cond;
    bar.appendChild(chip);
  });
}

// ── PRINT ─────────────────────────────────────────
function initPrint() {
  document.getElementById('btn-print')?.addEventListener('click', () => window.print());
}

// ── HELPERS ───────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
