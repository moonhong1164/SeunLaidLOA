import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, onSnapshot, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const RAIDS = [
  { id: 'belgardin', name: '벨가르딘', difficulties: [
    { id: 'normal', name: '노말' }, { id: 'hard', name: '하드' }, { id: 'nightmare', name: '나이트메어' }
  ]},
  { id: 'cathedral', name: '지평의 성당', difficulties: [
    { id: 'stage1', name: '1단계' }, { id: 'stage2', name: '2단계' }, { id: 'stage3', name: '3단계' }
  ]},
  { id: 'finale', name: '종막', difficulties: [
    { id: 'normal', name: '노말' }, { id: 'hard', name: '하드' }
  ]},
  { id: 'serka', name: '세르카', difficulties: [
    { id: 'normal', name: '노말' }, { id: 'hard', name: '하드' }, { id: 'nightmare', name: '나이트메어' }
  ]},
];

const $ = (id) => document.getElementById(id);
const charactersEl = $('characters');
const emptyStateEl = $('emptyState');
const progressText = $('progressText');
const progressFill = $('progressFill');
const weekBadge = $('weekBadge');
const template = $('characterTemplate');
const roomLobby = $('roomLobby');
const roomActive = $('roomActive');
const appContent = $('appContent');
const syncBadge = $('syncBadge');
const roomCodeInput = $('roomCodeInput');
const firebaseNotice = $('firebaseNotice');

let db = null;
let currentRoom = null;
let characters = [];
let unsubscribeCharacters = null;
let unsubscribeRoom = null;
let firebaseReady = false;

function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

function getWeekRange() {
  const now = new Date();
  const diffToThursday = (now.getDay() - 4 + 7) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - diffToThursday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  return { start, end, label: `${fmt(start)} ~ ${fmt(end)}` };
}

function currentWeekKey() {
  const { start } = getWeekRange();
  return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
}

function defaultChecks() {
  const checks = {};
  RAIDS.forEach((raid) => {
    checks[raid.id] = {};
    raid.difficulties.forEach((difficulty) => checks[raid.id][difficulty.id] = false);
  });
  return checks;
}

function normalizeChecks(checks = {}) {
  const normalized = defaultChecks();
  RAIDS.forEach((raid) => raid.difficulties.forEach((difficulty) => {
    normalized[raid.id][difficulty.id] = Boolean(checks?.[raid.id]?.[difficulty.id]);
  }));
  return normalized;
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function sanitizeRoomCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

async function initFirebase() {
  weekBadge.textContent = getWeekRange().label;
  if (!isFirebaseConfigured()) {
    firebaseNotice.hidden = false;
    firebaseNotice.innerHTML = '실시간 공유를 사용하려면 <strong>firebase-config.js</strong>에 Firebase 설정값을 입력해야 합니다. README의 설정 방법을 따라 주세요.';
    $('createRoomBtn').disabled = true;
    $('joinRoomBtn').disabled = true;
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await signInAnonymously(auth);
    db = getFirestore(app);
    firebaseReady = true;
    syncBadge.textContent = '실시간 연결';
    syncBadge.classList.add('online');

    const urlRoom = sanitizeRoomCode(new URLSearchParams(location.search).get('room') || '');
    const lastRoom = sanitizeRoomCode(localStorage.getItem('lostarkLastRoom') || '');
    if (urlRoom.length === 6) await joinRoom(urlRoom, false);
    else if (lastRoom.length === 6) roomCodeInput.value = lastRoom;
  } catch (error) {
    console.error(error);
    firebaseNotice.hidden = false;
    firebaseNotice.textContent = 'Firebase 연결에 실패했습니다. 설정값과 Anonymous Authentication / Firestore 설정을 확인해 주세요.';
  }
}

async function roomExists(code) {
  return (await getDoc(doc(db, 'rooms', code))).exists();
}

async function createRoom() {
  if (!firebaseReady) return showToast('Firebase 설정이 필요해요.');
  try {
    let code;
    do code = createRoomCode(); while (await roomExists(code));
    await setDoc(doc(db, 'rooms', code), {
      weekKey: currentWeekKey(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await joinRoom(code, true);
    showToast(`공격대 ${code}를 만들었어요.`);
  } catch (error) {
    console.error(error);
    showToast('공격대 생성에 실패했어요.');
  }
}

async function joinRoom(rawCode, created = false) {
  if (!firebaseReady) return showToast('Firebase 설정이 필요해요.');
  const code = sanitizeRoomCode(rawCode || roomCodeInput.value);
  if (code.length !== 6) return showToast('공격대 코드 6자리를 입력해 주세요.');

  try {
    const roomRef = doc(db, 'rooms', code);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return showToast('존재하지 않는 공격대 코드예요.');

    leaveSubscriptions();
    currentRoom = code;
    localStorage.setItem('lostarkLastRoom', code);
    $('currentRoomCode').textContent = code;
    roomLobby.hidden = true;
    roomActive.hidden = false;
    appContent.hidden = false;
    history.replaceState(null, '', `${location.pathname}?room=${code}`);
    syncBadge.textContent = '실시간 연결';
    syncBadge.classList.add('online');

    await ensureCurrentWeek(roomRef, roomSnap.data());
    subscribeRoom(code);
    if (!created) showToast(`${code} 공격대에 입장했어요.`);
  } catch (error) {
    console.error(error);
    showToast('공격대 입장에 실패했어요.');
  }
}

async function ensureCurrentWeek(roomRef, roomData) {
  if (roomData.weekKey === currentWeekKey()) return;
  const charsSnap = await getDocsCompat(collection(db, 'rooms', currentRoom, 'characters'));
  const batch = writeBatch(db);
  charsSnap.forEach((snap) => batch.update(snap.ref, { checks: defaultChecks(), updatedAt: serverTimestamp() }));
  batch.update(roomRef, { weekKey: currentWeekKey(), updatedAt: serverTimestamp() });
  await batch.commit();
}

// 작은 헬퍼: 정적 import 수를 줄이면서 collection 1회 조회
async function getDocsCompat(ref) {
  const { getDocs } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
  return getDocs(ref);
}

function subscribeRoom(code) {
  unsubscribeRoom = onSnapshot(doc(db, 'rooms', code), (snap) => {
    if (!snap.exists()) {
      showToast('이 공격대가 더 이상 존재하지 않아요.');
      leaveRoom();
    }
  });

  unsubscribeCharacters = onSnapshot(collection(db, 'rooms', code, 'characters'), (snapshot) => {
    characters = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), checks: normalizeChecks(d.data().checks) }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    render();
  }, (error) => {
    console.error(error);
    syncBadge.textContent = '연결 오류';
    syncBadge.classList.remove('online');
  });
}

function leaveSubscriptions() {
  if (unsubscribeCharacters) unsubscribeCharacters();
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeCharacters = null;
  unsubscribeRoom = null;
}

function leaveRoom() {
  leaveSubscriptions();
  currentRoom = null;
  characters = [];
  roomLobby.hidden = false;
  roomActive.hidden = true;
  appContent.hidden = true;
  charactersEl.innerHTML = '';
  history.replaceState(null, '', location.pathname);
}

async function addCharacter() {
  const input = $('characterName');
  const name = input.value.trim();
  if (!currentRoom) return showToast('먼저 공격대에 입장해 주세요.');
  if (!name) return showToast('캐릭터 이름을 입력해 주세요.');
  if (characters.some((c) => c.name.toLowerCase() === name.toLowerCase())) return showToast('이미 같은 이름의 캐릭터가 있어요.');

  const id = createId();
  await setDoc(doc(db, 'rooms', currentRoom, 'characters', id), {
    name,
    checks: defaultChecks(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  input.value = '';
  showToast(`${name} 캐릭터를 추가했어요.`);
}

async function deleteCharacter(id) {
  const target = characters.find((c) => c.id === id);
  if (!target || !confirm(`${target.name} 캐릭터를 삭제할까요?`)) return;
  await deleteDoc(doc(db, 'rooms', currentRoom, 'characters', id));
}

async function updateCheck(characterId, raidId, difficultyId, checked) {
  const charRef = doc(db, 'rooms', currentRoom, 'characters', characterId);
  await updateDoc(charRef, {
    [`checks.${raidId}.${difficultyId}`]: checked,
    updatedAt: serverTimestamp()
  });
}

function countCharacter(character) {
  let checked = 0, total = 0;
  RAIDS.forEach((raid) => raid.difficulties.forEach((difficulty) => {
    total++;
    if (character.checks?.[raid.id]?.[difficulty.id]) checked++;
  }));
  return { checked, total };
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
    const completed = raid.difficulties.filter((d) => character.checks?.[raid.id]?.[d.id]).length;
    block.innerHTML = `<div class="raid-title"><strong>${raid.name}</strong><span class="raid-count">${completed}/${raid.difficulties.length}</span></div>`;

    const row = document.createElement('div');
    row.className = `difficulty-row${raid.difficulties.length === 2 ? ' two' : ''}`;
    raid.difficulties.forEach((difficulty) => {
      const item = document.createElement('div');
      item.className = 'check-item';
      const inputId = `${character.id}-${raid.id}-${difficulty.id}`;
      const checked = Boolean(character.checks?.[raid.id]?.[difficulty.id]);
      item.innerHTML = `<input type="checkbox" id="${inputId}" ${checked ? 'checked' : ''}><label for="${inputId}">${difficulty.name}</label>`;
      item.querySelector('input').addEventListener('change', async (e) => {
        try { await updateCheck(character.id, raid.id, difficulty.id, e.target.checked); }
        catch { e.target.checked = !e.target.checked; showToast('체크 저장에 실패했어요.'); }
      });
      row.appendChild(item);
    });
    block.appendChild(row);
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
  emptyStateEl.hidden = characters.length > 0;
  characters.forEach((character) => charactersEl.appendChild(buildCharacterCard(character)));
  let checked = 0, total = 0;
  characters.forEach((character) => { const c = countCharacter(character); checked += c.checked; total += c.total; });
  progressText.textContent = `${checked} / ${total}`;
  progressFill.style.width = `${total ? (checked / total) * 100 : 0}%`;
}

function makeCopyText() {
  const lines = ['📋 로스트아크 주간 레이드 현황', `👥 공격대 코드 : ${currentRoom}`, `📅 ${getWeekRange().label}`, ''];
  if (!characters.length) lines.push('등록된 캐릭터가 없습니다.');
  characters.forEach((character) => {
    lines.push(`【${character.name}】`);
    RAIDS.forEach((raid) => {
      const status = raid.difficulties.map((d) => `${character.checks?.[raid.id]?.[d.id] ? '✅' : '⬜'} ${d.name}`).join(' / ');
      lines.push(`${raid.name} : ${status}`);
    });
    lines.push('');
  });
  let checked = 0, total = 0;
  characters.forEach((character) => { const c = countCharacter(character); checked += c.checked; total += c.total; });
  lines.push(`전체 진행도 : ${checked} / ${total}`);
  return lines.join('\n');
}

async function copyText(text, successMessage) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  showToast(successMessage);
}

async function copyInvite() {
  const url = `${location.origin}${location.pathname}?room=${currentRoom}`;
  await copyText(`로스트아크 공격대 체크표\n공격대 코드: ${currentRoom}\n${url}`, '초대 링크와 공격대 코드를 복사했어요.');
}

async function resetWeek() {
  if (!characters.length) return showToast('초기화할 캐릭터가 없어요.');
  if (!confirm('이 공격대의 이번 주 모든 레이드 체크를 초기화할까요?')) return;
  const batch = writeBatch(db);
  characters.forEach((c) => batch.update(doc(db, 'rooms', currentRoom, 'characters', c.id), { checks: defaultChecks(), updatedAt: serverTimestamp() }));
  batch.update(doc(db, 'rooms', currentRoom), { weekKey: currentWeekKey(), updatedAt: serverTimestamp() });
  await batch.commit();
  showToast('이번 주 체크를 모두 초기화했어요.');
}

let toastTimer;
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
  toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
}

roomCodeInput.addEventListener('input', (e) => e.target.value = sanitizeRoomCode(e.target.value));
roomCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
$('createRoomBtn').addEventListener('click', createRoom);
$('joinRoomBtn').addEventListener('click', () => joinRoom());
$('leaveRoomBtn').addEventListener('click', leaveRoom);
$('copyInviteBtn').addEventListener('click', copyInvite);
$('addCharacterBtn').addEventListener('click', addCharacter);
$('characterName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCharacter(); });
$('copyBtn').addEventListener('click', () => copyText(makeCopyText(), '현재 현황을 복사했어요.'));
$('resetBtn').addEventListener('click', resetWeek);

initFirebase();
