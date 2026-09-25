// Debounced auto-save with exponential-backoff retry.

let _saveTimer = null;
const MAX_RETRIES = 3;
const STATUS_EL = () => document.getElementById('save-status');

function showSaveStatus(state) {
  const el = STATUS_EL();
  if (!el) return;
  el.className = 'save-status';
  if (state === 'ok') {
    el.textContent = 'Salvo';
    el.classList.add('save-ok');
  } else if (state === 'pending') {
    el.textContent = 'Salvando…';
    el.classList.add('save-pending');
  } else if (state === 'retrying') {
    el.textContent = '⚠ Retentar…';
    el.classList.add('save-error');
  } else {
    el.textContent = '✕ Falha ao salvar';
    el.classList.add('save-error');
  }
}

async function performSave(retry = 0) {
  if (typeof char === 'undefined') return;
  try {
    const res = await fetch(`/api/character/${char.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(char),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.updated_at) char.updated_at = data.updated_at;
    showSaveStatus('ok');
  } catch (err) {
    console.error('Auto-save failed:', err);
    if (retry < MAX_RETRIES) {
      showSaveStatus('retrying');
      setTimeout(() => performSave(retry + 1), 3000 * (retry + 1));
    } else {
      showSaveStatus('error');
    }
  }
}

function triggerAutosave(delay = 1800) {
  clearTimeout(_saveTimer);
  showSaveStatus('pending');
  _saveTimer = setTimeout(() => performSave(0), delay);
}
