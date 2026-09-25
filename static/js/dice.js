// Client-side dice rolling.

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function parseAndRoll(expression) {
  const expr = expression.trim().toLowerCase().replace(/\s/g, '');

  // Tokenize on + / - boundaries (keep sign with the following token)
  const tokens = [];
  let buf = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if ((ch === '+' || ch === '-') && i > 0) {
      if (buf) tokens.push(buf);
      buf = ch;
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);

  if (tokens.length === 0) {
    return { expression, rolls: [], bonus: 0, total: 0, error: `Expressão inválida: ${expression}` };
  }

  const rolls = [];
  let total = 0;
  let flatBonus = 0;

  for (const tok of tokens) {
    const sign = tok.startsWith('-') ? -1 : 1;
    const t = tok.replace(/^[+-]/, '');
    const diceMatch = t.match(/^(\d+)d(\d+)$/);
    if (diceMatch) {
      const count = parseInt(diceMatch[1], 10);
      const sides = parseInt(diceMatch[2], 10);
      const rolled = Array.from({ length: count }, () => rollDie(sides));
      rolled.forEach(r => rolls.push(r));
      total += rolled.reduce((a, b) => a + b, 0) * sign;
    } else {
      const n = parseInt(t, 10);
      if (isNaN(n)) {
        return { expression, rolls: [], bonus: 0, total: 0, error: `Expressão inválida: ${expression}` };
      }
      flatBonus += n * sign;
      total += n * sign;
    }
  }

  return { expression, rolls, bonus: flatBonus, total };
}

function rollD20(bonus) {
  bonus = parseInt(bonus) || 0;
  const expr = bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`;
  return parseAndRoll(expr);
}

function createRollEntry(name, result) {
  return {
    id: Date.now().toString(36),
    name,
    expression: result.expression,
    rolls: result.rolls,
    bonus: result.bonus,
    total: result.total,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}
