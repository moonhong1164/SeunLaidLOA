const RAIDS = [
  { name: '벨가르딘', difficulties: ['노말', '하드', '나이트메어'] },
  { name: '지평의 성당', difficulties: ['노말', '하드', '나이트메어'] },
  { name: '종막', difficulties: ['노말', '하드'] },
  { name: '세르카', difficulties: ['노말', '하드', '나이트메어'] },
];

const STORAGE_KEY = 'lostarkRaidChecker_v1';
const charactersEl = document.getElementById('characters');
const emptyStateEl = document.getElementById('emptyState');
const addBtn = document.getElementById('addCharacterBtn');
const nameInput = document.getElementById('characterName');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const weekBadge = document.getElementById('weekBadge');
const template = document.getElementById('characterTemplate');

let state = loadState();

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToThursday = (day - 4 + 7) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - diffToThursday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const fmt = (d) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return { start, end, label: `${fmt(start)} ~ ${fmt(end)}` };
}

function currentWeekKey() {
  const { start } = getWeekRange();
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

function defaultChecks() {
  const checks = {};
  RAIDS.forEach((raid) => {
    checks[raid.name] = {};
    raid.difficulties.forEach((difficulty) => {
      checks[raid.name][difficulty] = false;
    });
  });
  return checks;
}

function loadState() {
  const fallback = { weekKey: currentWeekKey(), characters: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed.weekKey !== currentWeekKey()) {
      return {
        weekKey: currentWeekKey(),
        characters: (parsed.characters || []).map((c) => ({ ...c, checks: defaultChecks() })),
      };
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addCharacter() {
  const name = nameInput.value.trim();
  if (!name) return showToast('캐릭터 이름을 입력해 주세요.');
  if (state.characters.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return showToast('이미 같은 이름의 캐릭터가 있어요.');
  }

  state.characters.push({ id: createId(), name, checks: defaultChecks() });
  nameInput.value = '';
  saveState();
  render();
  showToast(`${name} 캐릭터를 추가했어요.`);
}

function deleteCharacter(id) {
  const target = state.characters.find((c) => c.id === id);
  if (!target) return;
  if (!confirm(`${target.name} 캐릭터를 삭제할까요?`)) return;
  state.characters = state.characters.filter((c) => c.id !== id);
  saveState();
  render();
}

function updateCheck(characterId, raidName, difficulty, checked) {
  const character = state.characters.find((c) => c.id === characterId);
  if (!character) return;
  character.checks[raidName][difficulty] = checked;
  saveState();
  updateProgressUI();
  updateCardProgress(characterId);
  updateRaidCounts(characterId);
}

function countCharacter(character) {
  let checked = 0;
  let total = 0;
  RAIDS.forEach((raid) => {
    raid.difficulties.forEach((difficulty) => {
      total += 1;
      if (character.checks?.[raid.name]?.[difficulty]) checked += 1;
    });
  });
  return { checked, total };
}

function updateCardProgress(characterId) {
  const character = state.characters.find((c) => c.id === characterId);
  const card = charactersEl.querySelector(`[data-character-id="${characterId}"]`);
  if (!character || !card) return;
  const { checked, total } = countCharacter(character);
  card.querySelector('.character-progress-text').textContent = `${checked} / ${total} 완료`;
  card.querySelector('.mini-progress-fill').style.width = `${total ? (checked / total) * 100 : 0}%`;
}

function updateRaidCounts(characterId) {
  const character = state.characters.find((c) => c.id === characterId);
  const card = charactersEl.querySelector(`[data-character-id="${characterId}"]`);
  if (!character || !card) return;
  card.querySelectorAll('.raid-block').forEach((block) => {
    const raidName = block.dataset.raid;
    const raid = RAIDS.find((r) => r.name === raidName);
    const completed = raid.difficulties.filter((d) => character.checks[raidName][d]).length;
    block.querySelector('.raid-count').textContent = `${completed}/${raid.difficulties.length}`;
  });
}

function updateProgressUI() {
  let checked = 0;
  let total = 0;
  state.characters.forEach((character) => {
    const count = countCharacter(character);
    checked += count.checked;
    total += count.total;
  });
  progressText.textContent = `${checked} / ${total}`;
  progressFill.style.width = `${total ? (checked / total) * 100 : 0}%`;
}

function buildCharacterCard(character) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.characterId = character.id;
  node.querySelector('.character-name').textContent = character.name;
  node.querySelector('.delete-character').addEventListener('click', () => deleteCharacter(character.id));

  const raidList = node.querySelector('.raid-list');
  RAIDS.forEach((raid) => {
    const block = document.createElement('section');
    block.className = 'raid-block';
    block.dataset.raid = raid.name;

    const title = document.createElement('div');
    title.className = 'raid-title';
    const completed = raid.difficulties.filter((d) => character.checks?.[raid.name]?.[d]).length;
    title.innerHTML = `<strong>${raid.name}</strong><span class="raid-count">${completed}/${raid.difficulties.length}</span>`;

    const row = document.createElement('div');
    row.className = `difficulty-row${raid.difficulties.length === 2 ? ' two' : ''}`;

    raid.difficulties.forEach((difficulty) => {
      const item = document.createElement('div');
      item.className = 'check-item';
      const inputId = `${character.id}-${raid.name}-${difficulty}`.replace(/\s+/g, '-');
      const checked = Boolean(character.checks?.[raid.name]?.[difficulty]);
      item.innerHTML = `
        <input type="checkbox" id="${inputId}" ${checked ? 'checked' : ''}>
        <label for="${inputId}">${difficulty}</label>
      `;
      item.querySelector('input').addEventListener('change', (e) => {
        updateCheck(character.id, raid.name, difficulty, e.target.checked);
      });
      row.appendChild(item);
    });

    block.append(title, row);
    raidList.appendChild(block);
  });

  const { checked, total } = countCharacter(character);
  node.querySelector('.character-progress-text').textContent = `${checked} / ${total} 완료`;
  node.querySelector('.mini-progress-fill').style.width = `${total ? (checked / total) * 100 : 0}%`;
  return node;
}

function render() {
  weekBadge.textContent = getWeekRange().label;
  charactersEl.innerHTML = '';
  emptyStateEl.hidden = state.characters.length > 0;
  state.characters.forEach((character) => charactersEl.appendChild(buildCharacterCard(character)));
  updateProgressUI();
}

function makeCopyText() {
  const range = getWeekRange().label;
  const lines = [`📋 로스트아크 주간 레이드 현황`, `📅 ${range}`, ''];

  if (!state.characters.length) {
    lines.push('등록된 캐릭터가 없습니다.');
    return lines.join('\n');
  }

  state.characters.forEach((character) => {
    lines.push(`【${character.name}】`);
    RAIDS.forEach((raid) => {
      const cleared = raid.difficulties.filter((d) => character.checks?.[raid.name]?.[d]);
      const status = raid.difficulties
        .map((d) => `${character.checks?.[raid.name]?.[d] ? '✅' : '⬜'} ${d}`)
        .join(' / ');
      lines.push(`${raid.name} : ${status}`);
    });
    lines.push('');
  });

  let checked = 0;
  let total = 0;
  state.characters.forEach((character) => {
    const count = countCharacter(character);
    checked += count.checked;
    total += count.total;
  });
  lines.push(`전체 진행도 : ${checked} / ${total}`);
  return lines.join('\n');
}

async function copyStatus() {
  const text = makeCopyText();
  try {
    await navigator.clipboard.writeText(text);
    showToast('현재 현황을 클립보드에 복사했어요.');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast('현재 현황을 복사했어요.');
  }
}

function resetWeek() {
  if (!state.characters.length) return showToast('초기화할 캐릭터가 없어요.');
  if (!confirm('이번 주 모든 레이드 체크를 초기화할까요?')) return;
  state.characters = state.characters.map((c) => ({ ...c, checks: defaultChecks() }));
  state.weekKey = currentWeekKey();
  saveState();
  render();
  showToast('이번 주 체크를 모두 초기화했어요.');
}

let toastTimer;
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
}

addBtn.addEventListener('click', addCharacter);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addCharacter();
});
copyBtn.addEventListener('click', copyStatus);
resetBtn.addEventListener('click', resetWeek);

render();
