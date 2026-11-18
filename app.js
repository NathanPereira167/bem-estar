const STORAGE_KEY = 'bem-estar-symptom-records-v1';
const form = document.querySelector('#symptom-form');
const list = document.querySelector('#history-list');
const emptyState = document.querySelector('#empty-state');
const clearButton = document.querySelector('#clear-history');
const toast = document.querySelector('#toast');
const profileForm = document.querySelector('#profile-form');
const profileDeleteButton = document.querySelector('#delete-profile');
const PROFILE_KEY = 'bem-estar-profile-v1';
const MANAGEMENT_DATA_KEY = 'bem-estar-management-private-v1';
const SHARING_KEY = 'bem-estar-sharing-demo-v1';
const PREP_KEY = 'bem-estar-consultation-prep-v1';
const FAVORITES_KEY = 'bem-estar-guide-favorites-v1';
let activeUserId = 'guest';
let activeRole = null;
let selectedManagementPatientId = 'ana';
let selectedManagementRecordId = null;
const historyFilter = document.querySelector('#history-filter');
const historySymptomFilter = document.querySelector('#history-symptom-filter');
const summaryContainer = document.querySelector('#consultation-summary');
const themeToggle = document.querySelector('#theme-toggle');
const THEME_KEY = 'bem-estar-theme-v1';
const guideSearch = document.querySelector('#guide-search');
const guideResults = document.querySelector('#guide-results');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');
const chatLog = document.querySelector('#chat-log');
const chatChoices = document.querySelector('#chat-choices');
const chatEndActions = document.querySelector('.chat-end-actions');
let chatStage = 'symptom';
let chatSymptom = '';
let chatIntensity = '';
let chatDuration = '';
let chatDetails = '';

function recordsStorageKey(userId = activeUserId) { return `${STORAGE_KEY}-${userId}`; }
function profileStorageKey(userId = activeUserId) { return `${PROFILE_KEY}-${userId}`; }
function prepStorageKey(userId = activeUserId) { return `${PREP_KEY}-${userId}`; }
function favoritesStorageKey(userId = activeUserId) { return `${FAVORITES_KEY}-${userId}`; }
function sharingStorageKey(userId = activeUserId) { return `${SHARING_KEY}-${userId}`; }

function getSharingState() {
  try {
    const data = JSON.parse(localStorage.getItem(sharingStorageKey()) || '{}');
    return {grants:Array.isArray(data.grants) ? data.grants : [], activity:Array.isArray(data.activity) ? data.activity : []};
  } catch { return {grants:[], activity:[]}; }
}

function saveSharingState(data) {
  localStorage.setItem(sharingStorageKey(), JSON.stringify(data));
}

function getPrepState() {
  try {
    const state = JSON.parse(localStorage.getItem(prepStorageKey()) || '{}');
    return {questions:Array.isArray(state.questions) ? state.questions : [], checks:state.checks && typeof state.checks === 'object' ? state.checks : {}};
  } catch { return {questions:[], checks:{}}; }
}

function savePrepState(state) {
  localStorage.setItem(prepStorageKey(), JSON.stringify(state));
}

function getFavoriteIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(favoritesStorageKey()) || '[]');
    return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}

function getManagementData() {
  try {
    const data = JSON.parse(localStorage.getItem(MANAGEMENT_DATA_KEY) || '{}');
    return {
      patientNotes:data.patientNotes && typeof data.patientNotes === 'object' ? data.patientNotes : {},
      reviewedRecords:Array.isArray(data.reviewedRecords) ? data.reviewedRecords : [],
      recordStatuses:data.recordStatuses && typeof data.recordStatuses === 'object' ? data.recordStatuses : {},
      recordUpdates:data.recordUpdates && typeof data.recordUpdates === 'object' ? data.recordUpdates : {},
      activityLog:Array.isArray(data.activityLog) ? data.activityLog : []
    };
  } catch { return {patientNotes:{}, reviewedRecords:[], recordStatuses:{}, recordUpdates:{}, activityLog:[]}; }
}

function saveManagementData(data) {
  localStorage.setItem(MANAGEMENT_DATA_KEY, JSON.stringify(data));
}

const managementStatusLabels = {new:'Novo', in_progress:'Em acompanhamento', reviewed:'Conferido'};
function getManagementRecordStatus(data, recordKey) {
  return data.recordStatuses[recordKey] || (data.reviewedRecords.includes(recordKey) ? 'reviewed' : 'new');
}
function seedManagementDemoStatuses() {
  const data = getManagementData();
  if (Object.keys(data.recordStatuses).length || data.reviewedRecords.length || data.activityLog.length) return;
  const initialStatuses = {lucas:'in_progress', mariana:'reviewed', rafael:'in_progress', diego:'reviewed'};
  for (const userId of Object.keys(demoAccounts)) {
    const firstRecord = getDemoPatientData(userId).records[0];
    if (firstRecord && initialStatuses[userId]) data.recordStatuses[`${userId}::${firstRecord.id}`] = initialStatuses[userId];
  }
  saveManagementData(data);
}
function logManagementActivity(data, message, recordKey = '') {
  data.activityLog.unshift({id:createId(), actor:'Coordenação (demonstração)', message, recordKey, createdAt:new Date().toISOString()});
  data.activityLog = data.activityLog.slice(0, 100);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getRecords() {
  try {
    const stored = JSON.parse(localStorage.getItem(recordsStorageKey()) || '[]');
    return Array.isArray(stored) ? stored.filter(item => item && typeof item === 'object').map((item, index) => ({...item, id: item.id || `legacy-${index}-${item.createdAt || ''}`})) : [];
  } catch {
    return [];
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function renderRecords() {
  const allRecords = getRecords();
  const days = Number(historyFilter.value);
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
  const selectedSymptom = historySymptomFilter.value;
  const symptomNames = [...new Set(allRecords.map(record => String(record.symptom || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  historySymptomFilter.replaceChildren(new Option('Todos', 'all'));
  for (const symptom of symptomNames) historySymptomFilter.add(new Option(symptom, symptom));
  historySymptomFilter.value = symptomNames.includes(selectedSymptom) ? selectedSymptom : 'all';
  const records = allRecords.filter(record => (!cutoff || new Date(record.createdAt).getTime() >= cutoff) && (historySymptomFilter.value === 'all' || record.symptom === historySymptomFilter.value));
  document.querySelector('#history-result-count').textContent = String(records.length);
  emptyState.hidden = records.length > 0;
  emptyState.querySelector('p').textContent = allRecords.length && !records.length ? 'Nenhum registro nesse período.' : 'Seus registros aparecerão aqui.';
  emptyState.querySelector('small').textContent = allRecords.length && !records.length ? 'Escolha outro filtro para ver mais registros.' : 'Anotar como você se sente pode ajudar em uma conversa com um profissional.';
  clearButton.hidden = allRecords.length === 0;
  list.innerHTML = records.slice(0, 12).map(record => {
    const date = new Date(record.createdAt);
    const formatted = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'}).format(date);
    const details = [record.intensity, `Há ${record.duration}`, record.location ? `Local: ${record.location}` : '', record.notes].filter(Boolean).map(escapeHTML).join(' · ');
    return `<article class="history-item"><h3>${escapeHTML(record.symptom)}</h3><time>${escapeHTML(formatted)}</time><p>${details}</p><button class="remove-record" type="button" data-remove-record="${escapeHTML(record.id)}" aria-label="Apagar registro de ${escapeHTML(record.symptom)}">Apagar</button></article>`;
  }).join('');
  updateDashboard(allRecords);
  renderHomeOverview(allRecords);
  renderHistoryChart(records);
  renderConsultationSummary(allRecords);
  renderPrepOverview(allRecords);
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function loadProfile() {
  let profile = {};
  try {
    profile = JSON.parse(localStorage.getItem(profileStorageKey()) || 'null') || {};
    if (typeof profile !== 'object') profile = {};
    for (const [name, value] of Object.entries(profile)) {
      const field = profileForm.elements.namedItem(name);
      if (field && typeof value === 'string') field.value = value;
    }
  } catch {
    // Ignore invalid or unavailable local profile data.
  }
  updateWelcome(profile);
  updateSidebarProfile(profile);
  updateProfileCompletion(profile);
}

profileForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(profileForm);
  const profile = Object.fromEntries(['fullName', 'birthDate', 'email', 'phone', 'emergencyName', 'emergencyPhone', 'postalCode', 'street', 'streetNumber', 'addressComplement', 'neighborhood', 'city', 'state', 'allergies', 'medications', 'conditions'].map(name => [name, String(data.get(name) || '').trim()]));
  try {
    localStorage.setItem(profileStorageKey(), JSON.stringify(profile));
    updateWelcome(profile);
    updateSidebarProfile(profile);
    updateProfileCompletion(profile);
    renderConsultationSummary(getRecords());
    showToast('Perfil salvo neste navegador.');
  } catch {
    showToast('Não foi possível salvar neste dispositivo.');
  }
});

profileDeleteButton.addEventListener('click', () => {
  localStorage.removeItem(profileStorageKey());
  profileForm.reset();
  updateWelcome(null);
  updateSidebarProfile(null);
  updateProfileCompletion({});
  renderConsultationSummary(getRecords());
  showToast('Dados do perfil apagados.');
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const record = {
    id: createId(),
    symptom: data.get('symptom').trim(),
    intensity: data.get('intensity'),
    duration: data.get('duration').trim(),
    location: data.get('location').trim(),
    notes: data.get('notes').trim(),
    createdAt: new Date().toISOString()
  };
  if (!record.symptom || !record.duration) return;
  const records = getRecords();
  records.unshift(record);
  try {
    localStorage.setItem(recordsStorageKey(), JSON.stringify(records));
  } catch {
    showToast('Não foi possível salvar neste dispositivo.');
    return;
  }
  form.reset();
  renderRecords();
  showSupportGuidance(record);
  updateSymptomPreview();
  showToast('Registro salvo neste dispositivo.');
});

function updateSymptomPreview() {
  const data = new FormData(form);
  const values = [data.get('symptom') || 'Seu sintoma', data.get('intensity') || 'intensidade não selecionada', data.get('duration') ? `há ${data.get('duration')}` : 'duração não informada', data.get('location') ? `local: ${data.get('location')}` : ''].filter(Boolean);
  document.querySelector('#symptom-preview-text').textContent = values.join(' · ');
}

form.addEventListener('input', updateSymptomPreview);
form.addEventListener('change', updateSymptomPreview);

clearButton.addEventListener('click', () => {
  localStorage.removeItem(recordsStorageKey());
  renderRecords();
  showToast('Histórico apagado.');
});

historyFilter.addEventListener('change', renderRecords);
historySymptomFilter.addEventListener('change', renderRecords);

list.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-record]');
  if (!button) return;
  const id = button.dataset.removeRecord;
  const records = getRecords().filter(record => record.id !== id);
  localStorage.setItem(recordsStorageKey(), JSON.stringify(records));
  renderRecords();
  showToast('Registro apagado.');
});

document.querySelector('#load-demo').addEventListener('click', () => {
  const existingRecords = getRecords();
  if (existingRecords.some(record => record.isDemo)) {
    showToast('Os dados fictícios já estão no histórico.');
    return;
  }
  const sampleRecords = [
    {id:createId(), isDemo:true, symptom:'Dor de cabeça', intensity:'Leve', duration:'algumas horas', notes:'Exemplo fictício para demonstração.', createdAt:new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()},
    {id:createId(), isDemo:true, symptom:'Cansaço', intensity:'Moderada', duration:'desde ontem', notes:'Exemplo fictício para demonstração.', createdAt:new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()},
    {id:createId(), isDemo:true, symptom:'Febre', intensity:'Leve', duration:'hoje', notes:'Exemplo fictício para demonstração.', createdAt:new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()}
  ];
  localStorage.setItem(recordsStorageKey(), JSON.stringify([...sampleRecords, ...existingRecords]));
  renderRecords();
  showToast('Exemplos fictícios adicionados.');
});

document.querySelector('#print-summary').addEventListener('click', () => window.print());

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
  themeToggle.title = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';
  themeToggle.textContent = isDark ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#171316' : '#fff7fa';
}

themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
});

function updateWelcome(profile) {
  const fullName = profile?.fullName?.trim();
  document.querySelector('#welcome-name').textContent = fullName ? fullName.split(/\s+/)[0] : 'que bom ter você';
}

function updateSidebarProfile(profile) {
  const fullName = profile?.fullName?.replace(/\s*\(perfil fictício\)/i, '').trim();
  const displayName = fullName || 'Perfil do paciente';
  const initials = fullName ? fullName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() : 'P';
  document.querySelector('#patient-name-label').textContent = displayName;
  document.querySelector('#patient-initials').textContent = initials;
}

function updateDashboard(records) {
  document.querySelector('#record-count').textContent = String(records.length);
  const mostRecent = records.map(record => new Date(record.createdAt)).filter(date => !Number.isNaN(date.getTime())).sort((a, b) => b - a)[0];
  document.querySelector('#last-record-date').textContent = mostRecent ? new Intl.DateTimeFormat('pt-BR', {day:'2-digit', month:'short'}).format(mostRecent) : '—';
}

function renderHomeOverview(records) {
  const container = document.querySelector('#home-recent-records');
  const recent = [...records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  container.replaceChildren();
  if (!recent.length) {
    const empty = document.createElement('p');
    empty.className = 'summary-empty';
    empty.textContent = 'Seus registros mais recentes aparecerão aqui.';
    container.append(empty);
  } else {
    for (const record of recent) {
      const row = document.createElement('div');
      row.className = 'home-recent-row';
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = record.symptom || 'Sintoma';
      const meta = document.createElement('small');
      meta.textContent = [record.intensity, `Há ${record.duration}`].filter(Boolean).join(' · ');
      copy.append(name, meta);
      const date = document.createElement('time');
      const created = new Date(record.createdAt);
      date.textContent = Number.isNaN(created.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {day:'2-digit', month:'short'}).format(created);
      row.append(copy, date);
      container.append(row);
    }
  }
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  document.querySelector('#weekly-record-count').textContent = String(records.filter(record => new Date(record.createdAt).getTime() >= weekAgo).length);
}

function renderHistoryChart(records) {
  const chart = document.querySelector('#history-chart');
  chart.replaceChildren();
  const sorted = [...records].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-7);
  if (!sorted.length) {
    const empty = document.createElement('span');
    empty.className = 'chart-empty';
    empty.textContent = 'Registre sintomas para ver seus relatos aqui.';
    chart.append(empty);
    return;
  }
  for (const record of sorted) {
    const level = record.intensity === 'Intensa' ? 3 : record.intensity === 'Moderada' ? 2 : 1;
    const item = document.createElement('div');
    item.className = `chart-bar level-${level}`;
    item.title = `${record.symptom} · ${record.intensity || 'intensidade não informada'}`;
    const bar = document.createElement('span');
    bar.style.height = `${level * 27}%`;
    const label = document.createElement('small');
    label.textContent = record.intensity === 'Intensa' ? 'Int.' : record.intensity === 'Moderada' ? 'Mod.' : 'Leve';
    item.append(bar, label);
    chart.append(item);
  }
}

function updateProfileCompletion(profile) {
  const required = ['fullName', 'email'];
  const completedRequired = required.filter(key => String(profile?.[key] || '').trim()).length;
  const optional = ['birthDate', 'phone', 'emergencyName', 'emergencyPhone', 'postalCode', 'street', 'neighborhood', 'city', 'state', 'allergies', 'medications', 'conditions'];
  const completedOptional = optional.filter(key => String(profile?.[key] || '').trim()).length;
  const percent = Math.round((completedRequired / required.length) * 100);
  document.querySelector('#profile-completion').innerHTML = `<div class="completion-copy"><strong>Informações básicas: ${completedRequired} de ${required.length}</strong><span>${completedOptional} informações opcionais preenchidas</span></div><div class="completion-track" aria-label="${percent}% das informações básicas preenchidas"><span style="width:${percent}%"></span></div><small>Preencher itens opcionais é escolha sua. O site não precisa de todos os dados para funcionar.</small>`;
}

function renderPrepOverview(records) {
  const prep = getPrepState();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCount = records.filter(record => new Date(record.createdAt).getTime() >= weekAgo).length;
  document.querySelector('#prep-overview').innerHTML = `<span>Você tem <strong>${recentCount}</strong> relato(s) recente(s) e <strong>${prep.questions.length}</strong> lembrete(s) para conversar.</span><a href="#resumo">Abrir resumo →</a>`;
}

function renderQuestionList() {
  const state = getPrepState();
  const list = document.querySelector('#question-list');
  list.replaceChildren();
  state.questions.forEach((question, index) => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = question;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-record';
    remove.dataset.removeQuestion = String(index);
    remove.textContent = 'Remover';
    item.append(text, remove);
    list.append(item);
  });
  document.querySelector('#question-empty').hidden = state.questions.length > 0;
  document.querySelectorAll('[data-prep-check]').forEach(input => { input.checked = Boolean(state.checks[input.dataset.prepCheck]); });
}

function loadPrepPanel() {
  renderQuestionList();
  renderPrepOverview(getRecords());
}

function showSupportGuidance(record) {
  const supportBox = document.querySelector('#symptom-support');
  const level = record.intensity;
  const normalizedSymptom = String(record.symptom).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isHeadache = normalizedSymptom.includes('dor de cabeca') || normalizedSymptom.includes('cefaleia');
  const title = document.querySelector('#support-title');
  const message = document.querySelector('#support-message');
  const nextStep = document.querySelector('#support-next-step');
  const source = document.querySelector('#support-source');
  const callButton = document.querySelector('#call-samu');

  callButton.hidden = true;
  supportBox.className = `support-result ${level === 'Intensa' ? 'level-intense' : level === 'Moderada' ? 'level-moderate' : 'level-mild'}`;
  if (isHeadache && level === 'Leve') {
    title.textContent = 'Apoio para dor de cabeça leve';
    message.textContent = 'A Biblioteca Virtual em Saúde do Ministério da Saúde cita hidratação e sono adequado entre hábitos relacionados à prevenção de cefaleias. São informações gerais, não um tratamento para a sua dor. Evite escolher ou aumentar medicamentos com base no app.';
    nextStep.textContent = 'Anote quando começou, quanto durou e o que pareceu piorar ou aliviar. Se persistir, piorar ou voltar com frequência, procure orientação de um profissional.';
    source.textContent = 'Fonte: Biblioteca Virtual em Saúde do Ministério da Saúde · conteúdo conferido em 17/11/2026.';
  } else if (isHeadache && level === 'Moderada') {
    title.textContent = 'Dor moderada: apoio e próximo passo';
    message.textContent = 'Este site não consegue avaliar a causa nem indicar um tratamento individual. Como você marcou dor moderada, considere conversar com um profissional de saúde, especialmente se for uma dor nova, recorrente ou que esteja piorando.';
    nextStep.textContent = 'Se deslocar for difícil, pergunte à sua UBS ou à Secretaria Municipal de Saúde se há atendimento por Telessaúde disponível na sua região. A oferta depende da organização local.';
    source.textContent = 'Fonte: Ministério da Saúde · Telessaúde no SUS complementa o cuidado presencial; disponibilidade conforme a rede local.';
  } else if (isHeadache && level === 'Intensa') {
    title.textContent = 'Dor intensa: veja quando buscar ajuda urgente';
    message.textContent = 'Dor de início súbito e muito forte, “a pior da vida”, ou acompanhada de fraqueza, dificuldade para falar ou enxergar, confusão, convulsão, febre com rigidez na nuca ou após trauma precisa de avaliação urgente.';
    nextStep.textContent = 'Se algum desses sinais estiver presente, procure um serviço de urgência. Em uma emergência, ligue 192; a central do SAMU pode orientar e avaliar o envio de atendimento. Se não houver esses sinais, uma dor intensa ou diferente do habitual ainda merece avaliação profissional.';
    source.textContent = 'Fontes: Protocolos de Neurologia da BVS/MS · SAMU 192 do Ministério da Saúde · conferidos em 17/11/2026.';
    callButton.hidden = false;
  } else {
    title.textContent = `Apoio para sintoma ${level.toLowerCase()}`;
    message.textContent = 'Ainda não temos uma orientação específica, revisada para este sintoma. Para não inventar recomendações, o app vai ajudar você a registrar intensidade, duração e detalhes para conversar com um profissional.';
    nextStep.textContent = level === 'Leve'
      ? 'Acompanhe como o sintoma evolui. Se persistir, piorar ou preocupar você, procure orientação profissional.'
      : 'Como você marcou intensidade moderada ou intensa, considere buscar orientação de um profissional. Se o deslocamento for difícil, pergunte à sua UBS se oferece Telessaúde. Em risco imediato, procure emergência ou ligue 192.';
    source.textContent = 'Orientação geral do protótipo · não é uma recomendação clínica específica.';
  }
  supportBox.hidden = false;
  supportBox.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function renderConsultationSummary(records) {
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem(profileStorageKey()) || '{}') || {}; } catch { profile = {}; }
  const dateLabel = value => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short'}).format(date);
  };
  const profileItems = [
    ['Nome', profile.fullName], ['Nascimento', dateLabel(profile.birthDate)], ['Telefone', profile.phone],
    ['Alergias', profile.allergies], ['Medicamentos em uso', profile.medications], ['Condições de saúde', profile.conditions]
  ].filter(([, value]) => value);
  const prep = getPrepState();
  const profileHTML = profileItems.length ? `<dl class="summary-details">${profileItems.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>` : '<p class="summary-empty">Preencha seu perfil para incluir informações adicionais.</p>';
  const recordsHTML = records.length ? `<ol class="summary-records">${records.map(record => `<li><strong>${escapeHTML(record.symptom || 'Sintoma')}</strong><span>${escapeHTML(record.intensity || '')} · ${escapeHTML(record.duration || '')} · ${escapeHTML(dateLabel(record.createdAt))}</span>${record.location ? `<small>Local: ${escapeHTML(record.location)}</small>` : ''}${record.notes ? `<small>${escapeHTML(record.notes)}</small>` : ''}</li>`).join('')}</ol>` : '<p class="summary-empty">Ainda não há sintomas registrados.</p>';
  const prepLabels = {start:'Quando começou e como mudou', other:'Outros sintomas que apareceram juntos', meds:'Medicamentos e alergias para mencionar', questions:'Perguntas que quero fazer'};
  const checkedPrep = Object.keys(prepLabels).filter(key => prep.checks[key]).map(key => prepLabels[key]);
  const prepChecklistHTML = checkedPrep.length ? `<p><strong>Itens para lembrar:</strong> ${checkedPrep.map(escapeHTML).join(' · ')}</p>` : '';
  const prepQuestionsHTML = prep.questions.length ? `<ul>${prep.questions.map(question => `<li>${escapeHTML(question)}</li>`).join('')}</ul>` : '<p class="summary-empty">Nenhuma pergunta adicionada ainda.</p>';
  const prepHTML = `${prepChecklistHTML}${prepQuestionsHTML}`;
  const missingBasics = ['fullName', 'email'].filter(key => !String(profile[key] || '').trim()).length;
  document.querySelector('#summary-readiness').innerHTML = `<strong>${records.length} relato(s) incluído(s)</strong><span>${missingBasics ? `${missingBasics} dado(s) básico(s) faltando` : 'Dados básicos do perfil preenchidos'}</span><a href="#consulta">Organizar perguntas →</a>`;
  summaryContainer.innerHTML = `<div class="summary-block"><h3>Informações do perfil</h3>${profileHTML}</div><div class="summary-block"><h3>Sintomas registrados (${records.length})</h3>${recordsHTML}</div><div class="summary-block"><h3>Perguntas para conversar</h3>${prepHTML}</div><p class="summary-disclaimer">Resumo organizado por você. Confira os dados antes de imprimir. Não representa diagnóstico nem avaliação clínica.</p>`;
}

const demoAccounts = {
  ana: {
    profile: {fullName:'Ana Souza (perfil fictício)', birthDate:'2002-04-16', email:'ana.souza@example.test', phone:'(00) 00000-0000', emergencyName:'Contato de demonstração', emergencyPhone:'(00) 00000-0000', postalCode:'00000-000', street:'Rua de Exemplo', streetNumber:'100', addressComplement:'Apto 1', neighborhood:'Bairro Modelo', city:'Cidade Exemplo', state:'SP', allergies:'Informação fictícia para demonstração', medications:'Informação fictícia para demonstração', conditions:'Informação fictícia para demonstração'},
    records: [
      {symptom:'Dor de cabeça', intensity:'Leve', duration:'algumas horas', notes:'Registro de demonstração; não é um dado real.', ageHours:2},
      {symptom:'Cansaço', intensity:'Moderada', duration:'desde ontem', notes:'Registro de demonstração; não é um dado real.', ageHours:24},
      {symptom:'Febre', intensity:'Leve', duration:'hoje', notes:'Registro de demonstração; não é um dado real.', ageHours:48}
    ]
  },
  lucas: {
    profile: {fullName:'Lucas Lima (perfil fictício)', birthDate:'1998-09-03', email:'lucas.lima@example.test', phone:'(00) 00000-0000', emergencyName:'Contato de demonstração', emergencyPhone:'(00) 00000-0000', postalCode:'00000-000', street:'Avenida de Exemplo', streetNumber:'250', addressComplement:'Casa', neighborhood:'Bairro Modelo', city:'Cidade Exemplo', state:'RJ', allergies:'Informação fictícia para demonstração', medications:'Informação fictícia para demonstração', conditions:'Informação fictícia para demonstração'},
    records: [
      {symptom:'Tosse', intensity:'Leve', duration:'desde ontem', notes:'Registro de demonstração; não é um dado real.', ageHours:5},
      {symptom:'Dor de garganta', intensity:'Moderada', duration:'há dois dias', notes:'Registro de demonstração; não é um dado real.', ageHours:36}
    ]
  },
  mariana: {
    profile: {fullName:'Mariana Costa (perfil fictício)', birthDate:'1987-06-22', email:'mariana.costa@example.test', phone:'(00) 00000-0000', emergencyName:'Paulo Costa · contato fictício', emergencyPhone:'(00) 00000-0000', postalCode:'00000-000', street:'Rua das Flores (fictícia)', streetNumber:'42', addressComplement:'Casa 2', neighborhood:'Jardim Modelo', city:'Cidade Exemplo', state:'MG', allergies:'Nenhuma informada (dado fictício)', medications:'Vitamina fictícia para demonstração', conditions:'Enxaqueca informada no perfil fictício'},
    records: [
      {symptom:'Náusea', intensity:'Moderada', duration:'desde esta manhã', location:'Estômago', notes:'Relato fictício: começou após o café da manhã; sem outros detalhes informados.', ageHours:3},
      {symptom:'Dor de cabeça', intensity:'Leve', duration:'algumas horas', location:'Região frontal', notes:'Relato fictício: episódio anterior registrado para demonstrar o histórico.', ageHours:72},
      {symptom:'Cansaço', intensity:'Leve', duration:'há dois dias', location:'Geral', notes:'Relato fictício: paciente deseja acompanhar a evolução.', ageHours:120}
    ]
  },
  rafael: {
    profile: {fullName:'Rafael Oliveira (perfil fictício)', birthDate:'1975-11-08', email:'rafael.oliveira@example.test', phone:'(00) 00000-0000', emergencyName:'Lúcia Oliveira · contato fictício', emergencyPhone:'(00) 00000-0000', postalCode:'00000-000', street:'Avenida Central (fictícia)', streetNumber:'315', addressComplement:'Bloco B', neighborhood:'Vila de Demonstração', city:'Município Exemplo', state:'PR', allergies:'Alergia fictícia a poeira', medications:'Nenhum informado (dado fictício)', conditions:'Pressão alta informada no perfil fictício'},
    records: [
      {symptom:'Dor nas costas', intensity:'Moderada', duration:'há três dias', location:'Região lombar', notes:'Relato fictício: desconforto percebido ao se movimentar; informação apenas para demonstração.', ageHours:8},
      {symptom:'Tontura', intensity:'Leve', duration:'por alguns minutos', location:'Não especificado', notes:'Relato fictício: episódio breve anotado no histórico.', ageHours:30},
      {symptom:'Dor nas costas', intensity:'Leve', duration:'há uma semana', location:'Região lombar', notes:'Relato fictício anterior para ilustrar a evolução dos registros.', ageHours:168}
    ]
  },
  beatriz: {
    profile: {fullName:'Beatriz Almeida (perfil fictício)', birthDate:'2006-02-14', email:'beatriz.almeida@example.test', phone:'(00) 00000-0000', emergencyName:'Renata Almeida · responsável fictícia', emergencyPhone:'(00) 00000-0000', postalCode:'00000-000', street:'Travessa do Ipê (fictícia)', streetNumber:'18', addressComplement:'Casa', neighborhood:'Parque Modelo', city:'Cidade Exemplo', state:'BA', allergies:'Informação não preenchida no perfil fictício', medications:'Nenhum informado (dado fictício)', conditions:'Nenhuma condição informada (dado fictício)'},
    records: [
      {symptom:'Cólicas', intensity:'Intensa', duration:'desde a noite passada', location:'Abdômen', notes:'Relato fictício: intensidade descrita pela paciente; demonstrar prioridade de conferência, sem avaliação clínica.', ageHours:1},
      {symptom:'Dor de cabeça', intensity:'Moderada', duration:'desde ontem', location:'Não especificado', notes:'Relato fictício: sem outros detalhes registrados.', ageHours:26},
      {symptom:'Náusea', intensity:'Leve', duration:'algumas horas', location:'Estômago', notes:'Relato fictício anterior para completar o histórico da demonstração.', ageHours:96}
    ]
  },
  diego: {
    profile: {fullName:'Diego Martins (perfil fictício)', birthDate:'1991-08-30', email:'diego.martins@example.test', phone:'(00) 00000-0000', emergencyName:'Carla Martins · contato fictício', emergencyPhone:'(00) 00000-0000', postalCode:'00000-000', street:'Rua do Horizonte (fictícia)', streetNumber:'105', addressComplement:'Fundos', neighborhood:'Bairro das Palmeiras (fictício)', city:'Município Exemplo', state:'CE', allergies:'Nenhuma informada (dado fictício)', medications:'Informação não preenchida no perfil fictício', conditions:'Asma informada no perfil fictício'},
    records: [
      {symptom:'Falta de ar', intensity:'Moderada', duration:'desde há cerca de uma hora', location:'Peito', notes:'Relato fictício para demonstração de prioridade. Não representa triagem ou orientação clínica.', ageHours:0.5},
      {symptom:'Tosse', intensity:'Leve', duration:'há quatro dias', location:'Garganta', notes:'Relato fictício anterior; detalhes adicionais não informados.', ageHours:48},
      {symptom:'Febre', intensity:'Moderada', duration:'desde ontem', location:'Geral', notes:'Relato fictício: anotado para acompanhar a evolução no histórico.', ageHours:20}
    ]
  }
};

function seedDemoAccounts() {
  const historicalExamples = {
    ana:['Dor muscular','Leve'], lucas:['Congestão nasal','Leve'], mariana:['Dor abdominal','Moderada'],
    rafael:['Tontura','Leve'], beatriz:['Cansaço','Leve'], diego:['Tosse','Moderada']
  };
  const profileSelect = document.querySelector('#demo-profile-select');
  if (profileSelect) {
    const existingIds = new Set([...profileSelect.options].map(option => option.value));
    for (const [userId, account] of Object.entries(demoAccounts)) {
      if (existingIds.has(userId)) continue;
      const option = new Option(`${account.profile.fullName.replace(/\s*\(perfil fictício\)/i, '')} · paciente de teste`, userId);
      profileSelect.add(option);
    }
  }
  for (const [userId, account] of Object.entries(demoAccounts)) {
    const savedProfile = localStorage.getItem(profileStorageKey(userId));
    const savedRecords = localStorage.getItem(recordsStorageKey(userId));
    if (!savedProfile) localStorage.setItem(profileStorageKey(userId), JSON.stringify(account.profile));
    if (!savedRecords) {
      const records = account.records.map(({ageHours, ...record}) => ({...record, id:createId(), isDemo:true, createdAt:new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString()}));
      localStorage.setItem(recordsStorageKey(userId), JSON.stringify(records));
    }
    let demoRecords = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(recordsStorageKey(userId)) || '[]');
      demoRecords = Array.isArray(parsed) ? parsed : [];
    } catch { demoRecords = []; }
    if (!demoRecords.some(record => record.id === `historical-${userId}`)) {
      const [symptom, intensity] = historicalExamples[userId];
      demoRecords.push({id:`historical-${userId}`, isDemo:true, isDemoArchive:true, symptom, intensity, duration:'registro anterior de demonstração', location:'Não especificado', notes:'Exemplo histórico fictício incluído para demonstrar o filtro por período.', createdAt:new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()});
      localStorage.setItem(recordsStorageKey(userId), JSON.stringify(demoRecords));
    }
    if (localStorage.getItem(prepStorageKey(userId)) === null) {
      const questions = userId === 'ana'
        ? ['O que pode estar relacionado a este sintoma?', 'Quais mudanças devo observar?']
        : ['Por quanto tempo devo acompanhar a tosse?', 'Em que situação devo procurar atendimento?'];
      localStorage.setItem(prepStorageKey(userId), JSON.stringify({questions, checks:{start:true, questions:true}}));
    }
    if (localStorage.getItem(favoritesStorageKey(userId)) === null) {
      const favorites = userId === 'ana' ? ['guide-headache', 'guide-stomach'] : ['guide-flu', 'guide-heat'];
      localStorage.setItem(favoritesStorageKey(userId), JSON.stringify(favorites));
    }
  }
}

const patientRouteIds = ['inicio', 'chat', 'registrar', 'historico', 'guia', 'favoritos', 'resumo', 'consulta', 'perfil', 'compartilhamento', 'emergencia', 'ajuda'];
const managementRouteIds = ['management-dashboard', 'management-queue', 'management-patients', 'management-followups', 'management-reports', 'management-content'];

function showWorkspaceRoute(routeId, scrollToTop = true) {
  if (activeRole === 'patient') {
    const route = patientRouteIds.includes(routeId) ? routeId : 'inicio';
    for (const id of ['inicio', 'patient-notice', 'home-overview', 'chat', 'guia', 'favoritos', 'resumo', 'consulta', 'perfil', 'compartilhamento', 'emergencia', 'ajuda', 'patient-next-step']) {
      document.getElementById(id).hidden = true;
    }
    const contentGrid = document.querySelector('#patient-view .content-grid');
    contentGrid.hidden = true;
    contentGrid.classList.remove('single-panel');
    document.querySelector('#registrar').hidden = true;
    document.querySelector('#historico').hidden = true;

    if (route === 'inicio') {
      document.querySelector('#inicio').hidden = false;
      document.querySelector('#patient-notice').hidden = false;
      document.querySelector('#home-overview').hidden = false;
      document.querySelector('#patient-next-step').hidden = false;
    } else if (route === 'registrar' || route === 'historico') {
      contentGrid.hidden = false;
      contentGrid.classList.add('single-panel');
      document.querySelector('#registrar').hidden = route !== 'registrar';
      document.querySelector('#historico').hidden = route !== 'historico';
    } else {
      contentGrid.classList.remove('single-panel');
      document.getElementById(route).hidden = false;
    }

    document.querySelectorAll('#patient-sidebar .sidebar-nav a, #patient-sidebar .sidebar-profile').forEach(link => {
      const target = link.getAttribute('href')?.slice(1);
      if (target === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  } else if (activeRole === 'management') {
    const route = managementRouteIds.includes(routeId) ? routeId : 'management-dashboard';
    for (const id of ['management-dashboard', 'management-metrics', 'management-overview', 'management-queue', 'management-patients', 'management-followups', 'management-reports', 'management-content']) {
      document.getElementById(id).hidden = true;
    }
    if (route === 'management-dashboard') {
      document.querySelector('#management-dashboard').hidden = false;
      document.querySelector('#management-metrics').hidden = false;
      document.querySelector('#management-overview').hidden = false;
    } else {
      document.getElementById(route).hidden = false;
    }
    document.querySelectorAll('#management-sidebar .sidebar-nav a').forEach(link => {
      const target = link.getAttribute('href')?.slice(1);
      if (target === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  if (scrollToTop) window.scrollTo({top:0, behavior:'smooth'});
}

function activateView(role, userId = 'guest') {
  activeRole = role;
  activeUserId = userId;
  document.body.classList.add('is-authenticated');
  document.querySelector('#access-screen').hidden = true;
  document.querySelector('#workspace-shell').hidden = false;
  document.querySelector('#patient-view').hidden = role !== 'patient';
  document.querySelector('#management-view').hidden = role !== 'management';
  document.querySelector('#patient-sidebar').hidden = role !== 'patient';
  document.querySelector('#management-sidebar').hidden = role !== 'management';
  document.querySelector('#return-to-entry').hidden = false;
  document.querySelector('#quick-emergency-link').hidden = role !== 'patient';
  document.querySelector('#mobile-menu-toggle').hidden = false;
  if (role === 'patient') {
    loadProfile();
    renderRecords();
    loadPrepPanel();
    renderFavorites();
    renderSharingPanel();
  } else {
    selectedManagementPatientId = 'ana';
    updateManagementMetrics();
    renderManagementTopics();
    renderManagementPatients();
    renderManagementDashboard();
  }
  const startRoute = role === 'patient' ? 'inicio' : 'management-dashboard';
  window.history.replaceState(null, '', `#${startRoute}`);
  showWorkspaceRoute(startRoute);
}

function updateManagementMetrics() {
  const patients = Object.keys(demoAccounts).map(getDemoPatientData);
  const total = patients.reduce((sum, patient) => sum + patient.records.length, 0);
  const data = getManagementData();
  const pending = patients.reduce((sum, patient) => sum + patient.records.filter(record => getManagementRecordStatus(data, `${patient.id}::${record.id}`) !== 'reviewed').length, 0);
  document.querySelector('#demo-user-count').textContent = String(Object.keys(demoAccounts).length);
  document.querySelector('#demo-record-count').textContent = String(total);
  document.querySelector('#manager-pending-count').textContent = String(pending);
}

function getDemoPatientData(userId) {
  const account = demoAccounts[userId];
  if (!account) return {id:userId, profile:{}, records:[]};
  let profile = account.profile;
  let records = [];
  try { profile = JSON.parse(localStorage.getItem(profileStorageKey(userId)) || 'null') || account.profile; } catch { profile = account.profile; }
  try {
    const stored = JSON.parse(localStorage.getItem(recordsStorageKey(userId)) || '[]');
    records = Array.isArray(stored) ? stored.filter(item => item && typeof item === 'object') : [];
  } catch { records = []; }
  return {id:userId, profile, records};
}

function renderManagementTopics() {
  const cards = [...document.querySelectorAll('#guide-results .guide-card')];
  document.querySelector('#management-guide-count').textContent = String(cards.length);
  const list = document.querySelector('#management-guide-topics');
  list.replaceChildren();
  for (const card of cards) {
    const item = document.createElement('li');
    item.className = 'management-topic-row';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = card.querySelector('h3')?.textContent || 'Tema do guia';
    const source = document.createElement('small');
    source.textContent = card.querySelector('.guide-detail small')?.textContent || 'Fonte institucional indicada no resumo.';
    details.append(title, source);
    const status = document.createElement('span');
    status.className = 'review-pending';
    status.textContent = 'Revisão profissional pendente';
    item.append(details, status);
    list.append(item);
  }
}

function renderManagementDashboard() {
  const data = getManagementData();
  const cases = Object.keys(demoAccounts).flatMap(id => {
    const patient = getDemoPatientData(id);
    return patient.records.map(record => ({...record, patientId:id, patientName:patient.profile.fullName || 'Paciente de demonstração', status:getManagementRecordStatus(data, `${id}::${record.id}`)}));
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const list = document.querySelector('#manager-recent-cases');
  list.replaceChildren();
  const groups = [
    {status:'new', className:'status-new'},
    {status:'in_progress', className:'status-progress'},
    {status:'reviewed', className:'status-reviewed'}
  ];
  for (const group of groups) {
    const matchingCases = cases.filter(item => item.status === group.status);
    const section = document.createElement('section');
    section.className = `manager-status-group ${group.className}`;
    const heading = document.createElement('h3');
    heading.textContent = managementStatusLabels[group.status];
    const count = document.createElement('span');
    count.className = 'manager-status-count';
    count.textContent = `${matchingCases.length} relato(s)`;
    const groupHeader = document.createElement('div');
    groupHeader.className = 'manager-status-heading';
    const groupLabel = document.createElement('div');
    groupLabel.append(heading);
    groupHeader.append(groupLabel, count);
    section.append(groupHeader);
    for (const item of matchingCases) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'manager-recent-case';
      row.dataset.openDemoPatient = item.patientId;
      row.dataset.openDemoIntensity = item.intensity;
      row.dataset.openDemoRecord = item.id;
      row.dataset.openDemoStatus = item.status;
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = `${item.patientName.replace(/\s*\(perfil fictício\)/i, '')} · ${item.symptom}`;
      const meta = document.createElement('small');
      const date = new Date(item.createdAt);
      const dateText = Number.isNaN(date.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short'}).format(date);
      meta.textContent = `${item.intensity} · duração: ${item.duration || 'não informada'} · ${dateText}`;
      const status = document.createElement('em');
      status.className = `manager-case-status status-${item.status}`;
      status.textContent = managementStatusLabels[item.status];
      const badges = document.createElement('span');
      badges.className = 'manager-case-badges';
      badges.append(status);
      if (item.intensity === 'Intensa') {
        const priority = document.createElement('small');
        priority.className = 'manager-priority-flag';
        priority.textContent = 'Intensidade intensa informada';
        badges.append(priority);
      }
      if (!Number.isNaN(date.getTime()) && Date.now() - date.getTime() < 24 * 60 * 60 * 1000) {
        const recent = document.createElement('small');
        recent.className = 'manager-recent-flag';
        recent.textContent = 'Relato recente';
        badges.append(recent);
      }
      copy.append(name, meta);
      row.append(copy, badges);
      section.append(row);
    }
    if (!matchingCases.length) {
      const empty = document.createElement('p');
      empty.className = 'manager-status-empty';
      empty.textContent = 'Nenhum relato nesta situação.';
      section.append(empty);
    }
    list.append(section);
  }
  updateManagementMetrics();
  document.querySelector('#manager-new-count').textContent = String(cases.filter(item => item.status === 'new').length);
  document.querySelector('#manager-followup-count').textContent = String(cases.filter(item => item.status === 'in_progress').length);
  renderManagementFollowups(cases);
  renderManagementReports(cases);
  renderManagementActivity();
}

function renderManagementFollowups(cases) {
  const list = document.querySelector('#manager-followup-list');
  const empty = document.querySelector('#manager-followup-empty');
  const ongoing = cases.filter(item => item.status === 'in_progress');
  list.replaceChildren();
  empty.hidden = ongoing.length > 0;
  for (const item of ongoing) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'manager-followup-row';
    row.dataset.openDemoPatient = item.patientId;
    row.dataset.openDemoIntensity = item.intensity;
    row.dataset.openDemoRecord = item.id;
    row.dataset.openDemoStatus = item.status;
    const person = document.createElement('strong');
    person.textContent = `${String(item.patientName).replace(/\s*\(perfil fictício\)/i, '')} · ${item.symptom}`;
    const detail = document.createElement('small');
    const date = new Date(item.createdAt);
    detail.textContent = `${item.intensity} informada · ${item.duration || 'duração não informada'} · ${Number.isNaN(date.getTime()) ? 'sem data' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short'}).format(date)}`;
    const action = document.createElement('span');
    action.textContent = 'Abrir ficha →';
    row.append(person, detail, action);
    list.append(row);
  }
}

function renderManagementReports(cases) {
  const cards = document.querySelector('#manager-report-cards');
  const symptomList = document.querySelector('#manager-symptom-summary');
  const total = cases.length;
  const values = [
    ['Pacientes fictícios', Object.keys(demoAccounts).length],
    ['Relatos registrados', total],
    ['Novos para conferência', cases.filter(item => item.status === 'new').length],
    ['Em acompanhamento', cases.filter(item => item.status === 'in_progress').length]
  ];
  cards.replaceChildren();
  for (const [label, value] of values) {
    const card = document.createElement('article');
    card.className = 'manager-report-card';
    const name = document.createElement('span');
    name.textContent = label;
    const count = document.createElement('strong');
    count.textContent = String(value);
    card.append(name, count);
    cards.append(card);
  }
  const symptomCounts = new Map();
  for (const item of cases) {
    const label = String(item.symptom || 'Não informado');
    symptomCounts.set(label, (symptomCounts.get(label) || 0) + 1);
  }
  symptomList.replaceChildren();
  const topSymptoms = [...symptomCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 6);
  for (const [symptom, count] of topSymptoms) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = symptom;
    const total = document.createElement('strong');
    total.textContent = `${count} relato(s)`;
    item.append(name, total);
    symptomList.append(item);
  }
  if (!topSymptoms.length) {
    const empty = document.createElement('li');
    empty.className = 'summary-empty';
    empty.textContent = 'Ainda não há relatos para resumir.';
    symptomList.append(empty);
  }
}

function renderManagementActivity() {
  const list = document.querySelector('#manager-activity-list');
  list.replaceChildren();
  const activity = getManagementData().activityLog;
  for (const event of activity.slice(0, 12)) {
    const item = document.createElement('li');
    const details = document.createElement('span');
    const message = document.createElement('strong');
    message.textContent = event.message;
    const actor = document.createElement('small');
    actor.textContent = event.actor || 'Coordenação (demonstração)';
    details.append(message, actor);
    const date = new Date(event.createdAt);
    const time = document.createElement('time');
    time.textContent = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'}).format(date);
    item.append(details, time);
    list.append(item);
  }
  if (!activity.length) {
    const empty = document.createElement('li');
    empty.className = 'manager-activity-empty';
    empty.textContent = 'As mudanças de situação e atualizações dos relatos aparecerão aqui.';
    list.append(empty);
  }
}

function renderManagementPatients() {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const query = normalize(document.querySelector('#manager-patient-search').value.trim());
  const intensity = document.querySelector('#manager-patient-intensity').value;
  const statusFilter = document.querySelector('#manager-patient-status').value;
  const period = document.querySelector('#manager-patient-period').value;
  const data = getManagementData();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const cutoff = period === 'today' ? todayStart : period === '7' ? Date.now() - 7 * 24 * 60 * 60 * 1000 : period === '30' ? Date.now() - 30 * 24 * 60 * 60 * 1000 : 0;
  const list = document.querySelector('#manager-patient-list');
  list.replaceChildren();
  let matches = 0;
  let firstMatchId = null;
  for (const id of Object.keys(demoAccounts)) {
    const patient = getDemoPatientData(id);
    const profileMatchesQuery = normalize(`${patient.profile.fullName} ${patient.profile.city} ${patient.profile.state}`).includes(query);
    const recordMatch = patient.records.filter(record => {
      const recordDate = new Date(record.createdAt).getTime();
      const recordStatus = getManagementRecordStatus(data, `${id}::${record.id}`);
      return (intensity === 'all' || record.intensity === intensity)
        && (statusFilter === 'all' || recordStatus === statusFilter)
        && (!cutoff || (period === 'today' ? recordDate >= cutoff : recordDate >= cutoff))
        && (!query || profileMatchesQuery || normalize(record.symptom).includes(query));
    });
    if (!profileMatchesQuery && query && !recordMatch.length) continue;
    if (!query && !recordMatch.length) continue;
    matches++;
    if (!firstMatchId) firstMatchId = id;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `manager-patient-card${id === selectedManagementPatientId ? ' selected' : ''}`;
    button.dataset.openDemoPatient = id;
    const name = document.createElement('strong');
    name.textContent = String(patient.profile.fullName || 'Paciente').replace(/\s*\(perfil fictício\)/i, '');
    const location = document.createElement('span');
    location.textContent = [patient.profile.city, patient.profile.state].filter(Boolean).join(' · ') || 'Local não informado';
    const meta = document.createElement('small');
    meta.textContent = `${recordMatch.length} relato(s) correspondem aos filtros`;
    button.append(name, location, meta);
    list.append(button);
  }
  document.querySelector('#manager-patient-count').textContent = `${matches} paciente(s) encontrado(s) · busca, intensidade, período e situação aplicados`;
  const visibleIds = [...list.querySelectorAll('[data-open-demo-patient]')].map(button => button.dataset.openDemoPatient);
  if (!visibleIds.includes(selectedManagementPatientId)) selectedManagementPatientId = firstMatchId;
  if (selectedManagementPatientId) renderManagementPatientDetail(selectedManagementPatientId, selectedManagementRecordId);
  else {
    const detail = document.querySelector('#manager-patient-detail');
    detail.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'summary-empty';
    empty.textContent = 'Nenhum perfil corresponde à busca e ao filtro selecionados.';
    detail.append(empty);
  }
}

function renderManagementPatientDetail(userId, focusedRecordId = null) {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const patient = getDemoPatientData(userId);
  const profile = patient.profile;
  const data = getManagementData();
  const savedNotes = data.patientNotes[userId];
  const notes = Array.isArray(savedNotes) ? savedNotes : [];
  const detail = document.querySelector('#manager-patient-detail');
  detail.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'manager-detail-heading';
  const title = document.createElement('h3');
  title.textContent = String(profile.fullName || 'Paciente').replace(/\s*\(perfil fictício\)/i, '');
  const label = document.createElement('span');
  label.textContent = 'Perfil fictício';
  heading.append(title, label);
  detail.append(heading);

  const identityHeading = document.createElement('h4');
  identityHeading.className = 'manager-subheading';
  identityHeading.textContent = 'Identificação e contato';
  detail.append(identityHeading);
  const profileGrid = document.createElement('dl');
  profileGrid.className = 'manager-profile-grid';
  const fields = [
    ['Nome completo', String(profile.fullName || '').replace(/\s*\(perfil fictício\)/i, '')], ['Nascimento', profile.birthDate], ['E-mail', profile.email], ['Telefone', profile.phone],
    ['Cidade', [profile.city, profile.state].filter(Boolean).join(' · ')],
    ['Endereço', [profile.street, profile.streetNumber, profile.addressComplement, profile.neighborhood, profile.postalCode].filter(Boolean).join(', ')],
    ['Contato de emergência', [profile.emergencyName, profile.emergencyPhone].filter(Boolean).join(' · ')]
  ].filter(([, value]) => value);
  for (const [key, value] of fields) {
    const pair = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = key;
    const description = document.createElement('dd');
    description.textContent = value;
    pair.append(term, description);
    profileGrid.append(pair);
  }
  detail.append(profileGrid);

  const healthHeading = document.createElement('h4');
  healthHeading.className = 'manager-subheading';
  healthHeading.textContent = 'Informações de saúde informadas';
  detail.append(healthHeading);
  const healthGrid = document.createElement('dl');
  healthGrid.className = 'manager-profile-grid manager-health-grid';
  const healthFields = [['Alergias', profile.allergies], ['Medicamentos em uso', profile.medications], ['Condições informadas', profile.conditions]].filter(([, value]) => value);
  for (const [key, value] of healthFields) {
    const pair = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = key;
    const description = document.createElement('dd');
    description.textContent = value;
    pair.append(term, description);
    healthGrid.append(pair);
  }
  detail.append(healthGrid);

  const recordHeading = document.createElement('h4');
  recordHeading.className = 'manager-subheading';
  const selectedIntensity = document.querySelector('#manager-patient-intensity').value;
  const selectedStatus = document.querySelector('#manager-patient-status').value;
  const selectedPeriod = document.querySelector('#manager-patient-period').value;
  const searchQuery = normalize(document.querySelector('#manager-patient-search').value.trim());
  const profileMatchesQuery = normalize(`${profile.fullName} ${profile.city} ${profile.state}`).includes(searchQuery);
  const today = new Date();
  const cutoff = selectedPeriod === 'today' ? new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() : selectedPeriod === '7' ? Date.now() - 7 * 24 * 60 * 60 * 1000 : selectedPeriod === '30' ? Date.now() - 30 * 24 * 60 * 60 * 1000 : 0;
  const visibleRecords = patient.records.filter(record => {
    const recordKey = `${userId}::${record.id}`;
    const recordDate = new Date(record.createdAt).getTime();
    return (selectedIntensity === 'all' || record.intensity === selectedIntensity)
      && (selectedStatus === 'all' || getManagementRecordStatus(data, recordKey) === selectedStatus)
      && (!cutoff || recordDate >= cutoff)
      && (!searchQuery || profileMatchesQuery || normalize(record.symptom).includes(searchQuery));
  });
  recordHeading.textContent = `Relatos de sintomas (${visibleRecords.length})`;
  detail.append(recordHeading);
  const records = [...visibleRecords].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (focusedRecordId && !records.some(record => record.id === focusedRecordId)) selectedManagementRecordId = null;
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'summary-empty';
    empty.textContent = patient.records.length ? 'Nenhum relato deste perfil corresponde aos filtros selecionados.' : 'Este perfil ainda não tem relatos.';
    detail.append(empty);
  }
  for (const record of records) {
    const key = `${userId}::${record.id}`;
    const statusValue = getManagementRecordStatus(data, key);
    const card = document.createElement('article');
    card.className = `manager-symptom-record${focusedRecordId === record.id ? ' manager-record-focused' : ''}`;
    const recordTop = document.createElement('div');
    recordTop.className = 'manager-record-top';
    const symptom = document.createElement('strong');
    symptom.textContent = record.symptom || 'Sintoma';
    const status = document.createElement('span');
    status.className = `manager-case-status status-${statusValue}`;
    status.textContent = managementStatusLabels[statusValue];
    recordTop.append(symptom, status);
    const facts = document.createElement('p');
    const created = new Date(record.createdAt);
    const dateText = Number.isNaN(created.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'medium', timeStyle:'short'}).format(created);
    facts.textContent = [record.intensity, `Duração: ${record.duration || 'não informada'}`, record.location ? `Local: ${record.location}` : '', dateText].filter(Boolean).join(' · ');
    card.append(recordTop, facts);
    if (record.notes) {
      const notesText = document.createElement('p');
      notesText.className = 'manager-record-notes';
      notesText.textContent = record.notes;
      card.append(notesText);
    }
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'text-button manager-open-record';
    open.dataset.toggleCaseDetail = record.id;
    open.textContent = focusedRecordId === record.id ? 'Fechar detalhe do relato' : 'Abrir detalhe e acompanhamento →';
    card.append(open);
    if (focusedRecordId === record.id) {
      const caseDetail = document.createElement('div');
      caseDetail.className = 'manager-case-detail';
      const caseLabel = document.createElement('label');
      caseLabel.htmlFor = `manager-case-status-${record.id}`;
      caseLabel.textContent = 'Situação administrativa';
      const caseStatus = document.createElement('select');
      caseStatus.id = caseLabel.htmlFor;
      caseStatus.dataset.caseStatus = record.id;
      caseStatus.innerHTML = '<option value="new">Novo</option><option value="in_progress">Em acompanhamento</option><option value="reviewed">Conferido</option>';
      caseStatus.value = statusValue;
      caseDetail.append(caseLabel, caseStatus);
      const updatesHeading = document.createElement('h5');
      updatesHeading.textContent = 'Atualizações de acompanhamento';
      caseDetail.append(updatesHeading);
      const updates = document.createElement('ol');
      updates.className = 'manager-case-updates';
      const recordUpdates = Array.isArray(data.recordUpdates[key]) ? data.recordUpdates[key] : [];
      for (const update of recordUpdates) {
        const updateItem = document.createElement('li');
        const updateText = document.createElement('span');
        updateText.textContent = update.text;
        const updateMeta = document.createElement('small');
        const updateDate = new Date(update.createdAt);
        const updateDateText = Number.isNaN(updateDate.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'}).format(updateDate);
        updateMeta.textContent = `${update.actor || 'Coordenação'} · ${updateDateText}`;
        updateItem.append(updateText, updateMeta);
        updates.append(updateItem);
      }
      if (!recordUpdates.length) {
        const emptyUpdate = document.createElement('li');
        emptyUpdate.className = 'manager-case-update-empty';
        emptyUpdate.textContent = 'Nenhuma atualização registrada neste relato.';
        updates.append(emptyUpdate);
      }
      caseDetail.append(updates);
      const updateForm = document.createElement('form');
      updateForm.dataset.caseUpdateForm = record.id;
      const updateLabel = document.createElement('label');
      updateLabel.htmlFor = `manager-case-update-${record.id}`;
      updateLabel.textContent = 'Registrar próximo passo ou contato';
      const updateInput = document.createElement('textarea');
      updateInput.id = updateLabel.htmlFor;
      updateInput.name = 'caseUpdate';
      updateInput.maxLength = 300;
      updateInput.rows = 2;
      updateInput.placeholder = 'Ex.: contato realizado pela coordenação';
      updateInput.required = true;
      const updateSubmit = document.createElement('button');
      updateSubmit.type = 'submit';
      updateSubmit.className = 'button button-primary';
      updateSubmit.textContent = 'Salvar atualização';
      updateForm.append(updateLabel, updateInput, updateSubmit);
      caseDetail.append(updateForm);
      card.append(caseDetail);
    }
    detail.append(card);
  }

  const notesHeading = document.createElement('h4');
  notesHeading.className = 'manager-subheading';
  notesHeading.textContent = 'Notas internas de acompanhamento';
  detail.append(notesHeading);
  const noteList = document.createElement('ul');
  noteList.className = 'manager-case-notes';
  notes.forEach(note => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = note.text;
    const time = document.createElement('small');
    const date = new Date(note.createdAt);
    time.textContent = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'}).format(date);
    item.append(text, time);
    noteList.append(item);
  });
  detail.append(noteList);
  if (!notes.length) {
    const empty = document.createElement('p');
    empty.className = 'summary-empty';
    empty.textContent = 'Nenhuma nota interna para este perfil.';
    detail.append(empty);
  }
  const form = document.createElement('form');
  form.id = 'manager-case-note-form';
  form.className = 'manager-case-note-form';
  const formLabel = document.createElement('label');
  formLabel.htmlFor = 'manager-case-note';
  formLabel.textContent = 'Adicionar nota interna (não visível ao paciente)';
  const inputRow = document.createElement('div');
  inputRow.className = 'question-entry';
  const input = document.createElement('input');
  input.id = 'manager-case-note';
  input.maxLength = 240;
  input.placeholder = 'Ex.: verificar se o relato foi encaminhado à equipe';
  input.required = true;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button button-primary';
  submit.textContent = 'Salvar nota';
  inputRow.append(input, submit);
  form.append(formLabel, inputRow);
  detail.append(form);
}

function setupGuideCards() {
  for (const card of document.querySelectorAll('#guide-results .guide-card')) {
    const detail = card.querySelector('.guide-detail');
    if (!detail) continue;
    const guideId = detail.id;
    card.dataset.guideId = guideId;
    if (!card.querySelector('.guide-favorite-toggle')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'guide-favorite-toggle';
      button.dataset.guideFavorite = guideId;
      card.append(button);
    }
  }
  updateGuideFavoriteButtons();
}

function updateGuideFavoriteButtons() {
  const favorites = new Set(getFavoriteIds());
  document.querySelectorAll('.guide-favorite-toggle').forEach(button => {
    const saved = favorites.has(button.dataset.guideFavorite);
    button.textContent = saved ? '♥ Salvo nos favoritos' : '♡ Salvar nos favoritos';
    button.setAttribute('aria-pressed', String(saved));
  });
}

function renderFavorites() {
  const ids = new Set(getFavoriteIds());
  const list = document.querySelector('#favorites-list');
  list.replaceChildren();
  for (const card of document.querySelectorAll('#guide-results .guide-card')) {
    const guideId = card.dataset.guideId || card.querySelector('.guide-detail')?.id;
    if (!ids.has(guideId)) continue;
    const savedCard = document.createElement('article');
    savedCard.className = 'saved-guide-card';
    const category = document.createElement('span');
    category.className = 'guide-category';
    category.textContent = card.querySelector('.guide-category')?.textContent || 'GUIA DE SAÚDE';
    const title = document.createElement('h3');
    title.textContent = card.querySelector('h3')?.textContent || 'Tema do Guia';
    const summary = document.createElement('p');
    summary.textContent = [...card.querySelectorAll('.guide-detail p, .guide-detail small')].map(node => node.textContent.trim()).filter(Boolean).join('\n\n');
    const actions = document.createElement('div');
    actions.className = 'saved-guide-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'button button-secondary';
    open.dataset.openGuide = guideId;
    open.textContent = 'Abrir no Guia →';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.dataset.guideFavorite = guideId;
    remove.textContent = 'Remover dos favoritos';
    actions.append(open, remove);
    savedCard.append(category, title, summary, actions);
    list.append(savedCard);
  }
  document.querySelector('#favorites-empty').hidden = list.children.length > 0;
}

function toggleGuideFavorite(guideId) {
  const favorites = new Set(getFavoriteIds());
  if (favorites.has(guideId)) favorites.delete(guideId);
  else favorites.add(guideId);
  localStorage.setItem(favoritesStorageKey(), JSON.stringify([...favorites]));
  updateGuideFavoriteButtons();
  renderFavorites();
  showToast(favorites.has(guideId) ? 'Tema salvo nos favoritos.' : 'Tema removido dos favoritos.');
}

const sharingScopeLabels = {
  contact:'Dados básicos de contato',
  health:'Informações de saúde informadas',
  records:'Relatos de sintomas'
};

function renderSharingPanel() {
  const state = getSharingState();
  const list = document.querySelector('#sharing-access-list');
  list.replaceChildren();
  const grants = [...state.grants].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!grants.length) {
    const empty = document.createElement('p');
    empty.className = 'summary-empty';
    empty.textContent = 'Você ainda não autorizou nenhum acesso de demonstração.';
    list.append(empty);
  }
  for (const grant of grants) {
    const isRevoked = Boolean(grant.revokedAt);
    const expiration = new Date(grant.expiresAt);
    const isExpired = Number.isNaN(expiration.getTime()) || expiration.getTime() <= Date.now();
    const isActive = !isRevoked && !isExpired;
    const card = document.createElement('article');
    card.className = `sharing-access-card${isActive ? ' sharing-active' : ''}`;
    const heading = document.createElement('div');
    heading.className = 'sharing-access-heading';
    const name = document.createElement('strong');
    name.textContent = grant.professionalName || 'Profissional fictício';
    const status = document.createElement('span');
    status.className = isActive ? 'sharing-status-active' : 'sharing-status-closed';
    status.textContent = isRevoked ? 'Acesso revogado' : isExpired ? 'Autorização expirada' : 'Autorização ativa';
    heading.append(name, status);
    const scopeList = document.createElement('p');
    scopeList.className = 'sharing-card-scopes';
    scopeList.textContent = `Dados selecionados: ${(grant.scopes || []).map(scope => sharingScopeLabels[scope]).filter(Boolean).join(' · ')}`;
    const dates = document.createElement('small');
    const created = new Date(grant.createdAt);
    const createdText = Number.isNaN(created.getTime()) ? 'data não informada' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'}).format(created);
    const expiryText = Number.isNaN(expiration.getTime()) ? 'data não informada' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short'}).format(expiration);
    dates.textContent = `Autorizado em ${createdText} · válido até ${expiryText}`;
    card.append(heading, scopeList, dates);
    if (isActive) {
      const actions = document.createElement('div');
      actions.className = 'sharing-card-actions';
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'button button-secondary';
      preview.dataset.previewSharing = grant.id;
      preview.textContent = 'Simular visão profissional';
      const revoke = document.createElement('button');
      revoke.type = 'button';
      revoke.className = 'text-button';
      revoke.dataset.revokeSharing = grant.id;
      revoke.textContent = 'Revogar acesso';
      actions.append(preview, revoke);
      card.append(actions);
    }
    list.append(card);
  }

  const activityList = document.querySelector('#sharing-activity');
  activityList.replaceChildren();
  for (const item of state.activity.slice(0, 10)) {
    const row = document.createElement('li');
    const message = document.createElement('span');
    message.textContent = item.message;
    const date = new Date(item.createdAt);
    const time = document.createElement('time');
    time.textContent = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'}).format(date);
    row.append(message, time);
    activityList.append(row);
  }
  if (!state.activity.length) {
    const empty = document.createElement('li');
    empty.className = 'sharing-activity-empty';
    empty.textContent = 'As autorizações e revogações aparecerão aqui.';
    activityList.append(empty);
  }
}

function renderProfessionalPreview(grantId) {
  const state = getSharingState();
  const grant = state.grants.find(item => item.id === grantId);
  const preview = document.querySelector('#professional-preview');
  const isActive = grant && !grant.revokedAt && new Date(grant.expiresAt).getTime() > Date.now();
  if (!isActive) {
    preview.hidden = true;
    showToast('Essa autorização não está ativa.');
    return;
  }
  preview.replaceChildren();
  preview.hidden = false;
  const heading = document.createElement('div');
  heading.className = 'section-heading';
  const titleGroup = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'PRÉVIA FICTÍCIA · SOMENTE LEITURA';
  const title = document.createElement('h3');
  title.textContent = `Visão simulada para ${grant.professionalName}`;
  titleGroup.append(eyebrow, title);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'text-button';
  close.dataset.closeProfessionalPreview = 'true';
  close.textContent = 'Fechar prévia';
  heading.append(titleGroup, close);
  preview.append(heading);
  const note = document.createElement('p');
  note.className = 'preview-simulation-note';
  note.textContent = 'Demonstração local: nenhum profissional recebeu estes dados.';
  preview.append(note);

  let profile = {};
  try { profile = JSON.parse(localStorage.getItem(profileStorageKey()) || '{}'); } catch { profile = {}; }
  if (grant.scopes.includes('contact')) {
    const section = document.createElement('section');
    section.className = 'professional-preview-section';
    const subheading = document.createElement('h4');
    subheading.textContent = 'Dados básicos de contato';
    const copy = document.createElement('p');
    copy.textContent = [profile.fullName || 'Nome não preenchido', profile.phone || 'Telefone não preenchido', [profile.city, profile.state].filter(Boolean).join(' · ') || 'Cidade não preenchida'].join(' · ');
    section.append(subheading, copy);
    preview.append(section);
  }
  if (grant.scopes.includes('health')) {
    const section = document.createElement('section');
    section.className = 'professional-preview-section';
    const subheading = document.createElement('h4');
    subheading.textContent = 'Informações de saúde informadas';
    section.append(subheading);
    const fields = [['Alergias', profile.allergies], ['Medicamentos', profile.medications], ['Condições', profile.conditions]];
    const available = fields.filter(([, value]) => String(value || '').trim());
    if (!available.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Nenhuma informação preenchida.';
      section.append(empty);
    } else {
      const details = document.createElement('dl');
      details.className = 'preview-health-fields';
      for (const [label, value] of available) {
        const pair = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        pair.append(term, description);
        details.append(pair);
      }
      section.append(details);
    }
    preview.append(section);
  }
  if (grant.scopes.includes('records')) {
    const section = document.createElement('section');
    section.className = 'professional-preview-section';
    const subheading = document.createElement('h4');
    const records = getRecords().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    subheading.textContent = `Relatos de sintomas (${records.length})`;
    section.append(subheading);
    if (!records.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Ainda não há relatos registrados.';
      section.append(empty);
    }
    for (const record of records) {
      const item = document.createElement('article');
      item.className = 'professional-preview-record';
      const symptom = document.createElement('strong');
      symptom.textContent = record.symptom || 'Sintoma';
      const date = new Date(record.createdAt);
      const dateText = Number.isNaN(date.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', {dateStyle:'medium', timeStyle:'short'}).format(date);
      const facts = document.createElement('p');
      facts.textContent = [record.intensity, record.duration, record.location, dateText].filter(Boolean).join(' · ');
      item.append(symptom, facts);
      if (record.notes) {
        const notes = document.createElement('small');
        notes.textContent = record.notes;
        item.append(notes);
      }
      section.append(item);
    }
    preview.append(section);
  }
  preview.scrollIntoView({behavior:'smooth', block:'start'});
}

function openGuideFromFavorite(guideId) {
  const card = document.querySelector(`#guide-results [data-guide-id="${CSS.escape(guideId)}"]`);
  if (!card) return;
  if (window.location.hash !== '#guia') window.history.pushState(null, '', '#guia');
  showWorkspaceRoute('guia');
  guideSearch.value = '';
  guideSearch.dispatchEvent(new Event('input'));
  const detail = card.querySelector('.guide-detail');
  const button = card.querySelector('.guide-open');
  detail.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  button.innerHTML = 'Fechar resumo <span aria-hidden="true">⌃</span>';
  card.scrollIntoView({behavior:'smooth', block:'center'});
}

document.querySelector('#enter-patient').addEventListener('click', () => {
  const userId = document.querySelector('#demo-profile-select').value;
  activateView('patient', userId);
});

document.querySelector('#enter-management').addEventListener('click', () => activateView('management'));

document.querySelector('#return-to-entry').addEventListener('click', () => {
  setMobileMenuOpen(false);
  activeRole = null;
  activeUserId = 'guest';
  document.body.classList.remove('is-authenticated');
  document.querySelector('#access-screen').hidden = false;
  document.querySelector('#workspace-shell').hidden = true;
  document.querySelector('#patient-sidebar').hidden = true;
  document.querySelector('#management-sidebar').hidden = true;
  document.querySelector('#mobile-menu-toggle').hidden = true;
  document.querySelector('#return-to-entry').hidden = true;
  window.scrollTo({top:0, behavior:'smooth'});
});

const mobileMenuToggle = document.querySelector('#mobile-menu-toggle');
const sidebarBackdrop = document.querySelector('#sidebar-backdrop');

function setMobileMenuOpen(isOpen) {
  document.querySelector('.workspace-shell').classList.toggle('sidebar-open', isOpen);
  document.querySelector('.sidebar:not([hidden])')?.classList.toggle('sidebar-visible', isOpen);
  sidebarBackdrop.hidden = !isOpen;
  mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
  mobileMenuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  mobileMenuToggle.textContent = isOpen ? '×' : '☰';
}

mobileMenuToggle.addEventListener('click', () => setMobileMenuOpen(mobileMenuToggle.getAttribute('aria-expanded') !== 'true'));
sidebarBackdrop.addEventListener('click', () => setMobileMenuOpen(false));
document.querySelectorAll('.sidebar-nav a, .sidebar-profile').forEach(link => link.addEventListener('click', () => setMobileMenuOpen(false)));

document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || !activeRole) return;
  const routeId = link.getAttribute('href').slice(1);
  const validRoute = activeRole === 'patient' ? patientRouteIds.includes(routeId) : managementRouteIds.includes(routeId);
  if (!validRoute) return;
  event.preventDefault();
  if (window.location.hash !== `#${routeId}`) window.history.pushState(null, '', `#${routeId}`);
  showWorkspaceRoute(routeId);
});

window.addEventListener('popstate', () => {
  if (activeRole) showWorkspaceRoute(window.location.hash.slice(1), false);
});
window.addEventListener('hashchange', () => {
  if (activeRole) showWorkspaceRoute(window.location.hash.slice(1), false);
});

document.querySelector('#manager-patient-search').addEventListener('input', renderManagementPatients);
document.querySelector('#manager-patient-intensity').addEventListener('change', renderManagementPatients);
document.querySelector('#manager-patient-period').addEventListener('change', renderManagementPatients);
document.querySelector('#manager-patient-status').addEventListener('change', renderManagementPatients);

document.querySelector('#manager-patient-list').addEventListener('click', event => {
  const button = event.target.closest('[data-open-demo-patient]');
  if (!button) return;
  selectedManagementPatientId = button.dataset.openDemoPatient;
  selectedManagementRecordId = null;
  renderManagementPatients();
});

document.querySelector('#manager-recent-cases').addEventListener('click', event => {
  const button = event.target.closest('[data-open-demo-patient]');
  if (!button) return;
  selectedManagementPatientId = button.dataset.openDemoPatient;
  selectedManagementRecordId = button.dataset.openDemoRecord;
  document.querySelector('#manager-patient-search').value = '';
  document.querySelector('#manager-patient-intensity').value = button.dataset.openDemoIntensity || 'all';
  document.querySelector('#manager-patient-status').value = button.dataset.openDemoStatus || 'all';
  document.querySelector('#manager-patient-period').value = 'all';
  if (window.location.hash !== '#management-patients') window.history.pushState(null, '', '#management-patients');
  showWorkspaceRoute('management-patients');
  renderManagementPatients();
});

document.querySelector('#manager-followup-list').addEventListener('click', event => {
  const button = event.target.closest('[data-open-demo-patient]');
  if (!button) return;
  selectedManagementPatientId = button.dataset.openDemoPatient;
  selectedManagementRecordId = button.dataset.openDemoRecord;
  document.querySelector('#manager-patient-search').value = '';
  document.querySelector('#manager-patient-intensity').value = button.dataset.openDemoIntensity || 'all';
  document.querySelector('#manager-patient-status').value = button.dataset.openDemoStatus || 'in_progress';
  document.querySelector('#manager-patient-period').value = 'all';
  if (window.location.hash !== '#management-patients') window.history.pushState(null, '', '#management-patients');
  showWorkspaceRoute('management-patients');
  renderManagementPatients();
});

document.querySelector('#manager-patient-detail').addEventListener('click', event => {
  const button = event.target.closest('[data-toggle-case-detail]');
  if (!button) return;
  selectedManagementRecordId = selectedManagementRecordId === button.dataset.toggleCaseDetail ? null : button.dataset.toggleCaseDetail;
  renderManagementPatientDetail(selectedManagementPatientId, selectedManagementRecordId);
});

document.querySelector('#manager-patient-detail').addEventListener('change', event => {
  const select = event.target.closest('[data-case-status]');
  if (!select) return;
  const recordId = select.dataset.caseStatus;
  const recordKey = `${selectedManagementPatientId}::${recordId}`;
  const data = getManagementData();
  const nextStatus = select.value;
  const previousStatus = getManagementRecordStatus(data, recordKey);
  if (nextStatus === previousStatus) return;
  data.recordStatuses[recordKey] = nextStatus;
  const reviewed = new Set(data.reviewedRecords);
  if (nextStatus === 'reviewed') reviewed.add(recordKey);
  else reviewed.delete(recordKey);
  data.reviewedRecords = [...reviewed];
  const patient = getDemoPatientData(selectedManagementPatientId);
  const record = patient.records.find(item => item.id === recordId);
  logManagementActivity(data, `Situação de “${record?.symptom || 'relato'}” de ${String(patient.profile.fullName || 'paciente').replace(/\s*\(perfil fictício\)/i, '')}: ${managementStatusLabels[previousStatus]} → ${managementStatusLabels[nextStatus]}.`, recordKey);
  saveManagementData(data);
  renderManagementPatients();
  renderManagementDashboard();
  showToast(`Relato atualizado: ${managementStatusLabels[nextStatus]}.`);
});

document.querySelector('#manager-patient-detail').addEventListener('submit', event => {
  const caseForm = event.target.closest('[data-case-update-form]');
  if (caseForm) {
    event.preventDefault();
    const recordId = caseForm.dataset.caseUpdateForm;
    const input = caseForm.querySelector('[name="caseUpdate"]');
    const text = input.value.trim();
    if (!text) return;
    const recordKey = `${selectedManagementPatientId}::${recordId}`;
    const data = getManagementData();
    if (!Array.isArray(data.recordUpdates[recordKey])) data.recordUpdates[recordKey] = [];
    const now = new Date().toISOString();
    data.recordUpdates[recordKey].unshift({text, actor:'Coordenação (demonstração)', createdAt:now});
    data.recordUpdates[recordKey] = data.recordUpdates[recordKey].slice(0, 30);
    const patient = getDemoPatientData(selectedManagementPatientId);
    const record = patient.records.find(item => item.id === recordId);
    logManagementActivity(data, `Atualização registrada em “${record?.symptom || 'relato'}” de ${String(patient.profile.fullName || 'paciente').replace(/\s*\(perfil fictício\)/i, '')}.`, recordKey);
    saveManagementData(data);
    renderManagementPatientDetail(selectedManagementPatientId, recordId);
    renderManagementDashboard();
    showToast('Atualização administrativa salva.');
    return;
  }
  if (event.target.id !== 'manager-case-note-form') return;
  event.preventDefault();
  const input = event.target.querySelector('#manager-case-note');
  const note = input.value.trim();
  if (!note || !selectedManagementPatientId) return;
  const data = getManagementData();
  const notes = Array.isArray(data.patientNotes[selectedManagementPatientId]) ? data.patientNotes[selectedManagementPatientId] : [];
  const now = new Date().toISOString();
  notes.unshift({text:note, createdAt:now});
  data.patientNotes[selectedManagementPatientId] = notes.slice(0, 30);
  logManagementActivity(data, `Nota interna adicionada à ficha de ${String(getDemoPatientData(selectedManagementPatientId).profile.fullName || 'paciente').replace(/\s*\(perfil fictício\)/i, '')}.`);
  saveManagementData(data);
  renderManagementPatientDetail(selectedManagementPatientId, selectedManagementRecordId);
  renderManagementDashboard();
  showToast('Nota interna salva nesta demonstração.');
});

document.querySelector('#sharing-form').addEventListener('submit', event => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const scopes = formData.getAll('share-scope');
  if (!scopes.length) {
    showToast('Selecione pelo menos um tipo de informação.');
    return;
  }
  const professionalSelect = document.querySelector('#sharing-professional');
  const professionalId = professionalSelect.value;
  const professionalName = professionalSelect.options[professionalSelect.selectedIndex].textContent;
  const state = getSharingState();
  const hasActiveAccess = state.grants.some(grant => grant.professionalId === professionalId && !grant.revokedAt && new Date(grant.expiresAt).getTime() > Date.now());
  if (hasActiveAccess) {
    showToast('Já existe uma autorização ativa para esse profissional fictício.');
    return;
  }
  const now = new Date();
  const durationDays = Number(document.querySelector('#sharing-duration').value);
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const grant = {id:createId(), professionalId, professionalName, scopes, consentAcceptedAt:now.toISOString(), createdAt:now.toISOString(), expiresAt, revokedAt:null};
  state.grants.unshift(grant);
  state.activity.unshift({createdAt:now.toISOString(), message:`Autorização simulada concedida a ${professionalName}; validade de ${durationDays} dias.`});
  state.activity = state.activity.slice(0, 50);
  saveSharingState(state);
  event.currentTarget.reset();
  document.querySelector('#professional-preview').hidden = true;
  renderSharingPanel();
  showToast('Autorização de demonstração registrada neste dispositivo.');
});

document.querySelector('#sharing-access-list').addEventListener('click', event => {
  const previewButton = event.target.closest('[data-preview-sharing]');
  const revokeButton = event.target.closest('[data-revoke-sharing]');
  if (previewButton) {
    renderProfessionalPreview(previewButton.dataset.previewSharing);
    return;
  }
  if (revokeButton) {
    const state = getSharingState();
    const grant = state.grants.find(item => item.id === revokeButton.dataset.revokeSharing);
    if (!grant || grant.revokedAt) return;
    const now = new Date().toISOString();
    grant.revokedAt = now;
    state.activity.unshift({createdAt:now, message:`Acesso de demonstração revogado: ${grant.professionalName}.`});
    state.activity = state.activity.slice(0, 50);
    saveSharingState(state);
    document.querySelector('#professional-preview').hidden = true;
    renderSharingPanel();
    showToast('Acesso de demonstração revogado.');
    return;
  }
});

document.querySelector('#professional-preview').addEventListener('click', event => {
  if (event.target.closest('[data-close-professional-preview]')) document.querySelector('#professional-preview').hidden = true;
});

document.querySelector('#question-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#question-input');
  const question = input.value.trim();
  if (!question) return;
  const state = getPrepState();
  if (state.questions.length >= 20) {
    showToast('Você já adicionou o limite de 20 lembretes.');
    return;
  }
  state.questions.push(question);
  savePrepState(state);
  input.value = '';
  renderQuestionList();
  renderPrepOverview(getRecords());
  renderConsultationSummary(getRecords());
  showToast('Lembrete adicionado ao seu resumo.');
});

document.querySelector('#question-list').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-question]');
  if (!button) return;
  const state = getPrepState();
  state.questions.splice(Number(button.dataset.removeQuestion), 1);
  savePrepState(state);
  renderQuestionList();
  renderPrepOverview(getRecords());
  renderConsultationSummary(getRecords());
});

document.querySelector('.prep-checklist').addEventListener('change', event => {
  const input = event.target.closest('[data-prep-check]');
  if (!input) return;
  const state = getPrepState();
  state.checks[input.dataset.prepCheck] = input.checked;
  savePrepState(state);
  renderConsultationSummary(getRecords());
});

guideSearch.addEventListener('input', () => {
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const query = normalize(guideSearch.value.trim());
  const cards = [...document.querySelectorAll('.guide-card')];
  let visible = 0;
  for (const card of cards) {
    const matches = normalize(`${card.dataset.search} ${card.textContent}`).includes(query);
    card.hidden = !matches;
    if (matches) visible++;
  }
  document.querySelector('#guide-empty').hidden = visible > 0;
});

guideResults.addEventListener('click', event => {
  const button = event.target.closest('.guide-open');
  if (!button) return;
  const detail = document.getElementById(button.getAttribute('aria-controls'));
  const opening = detail.hidden;
  detail.hidden = !opening;
  button.setAttribute('aria-expanded', String(opening));
  button.innerHTML = opening ? 'Fechar resumo <span aria-hidden="true">⌃</span>' : 'Ler no guia <span aria-hidden="true">⌄</span>';
});

document.querySelectorAll('[data-guide-search]').forEach(button => button.addEventListener('click', () => {
  guideSearch.value = button.dataset.guideSearch;
  guideSearch.dispatchEvent(new Event('input'));
  guideSearch.focus();
}));

document.addEventListener('click', event => {
  const favoriteButton = event.target.closest('[data-guide-favorite]');
  if (favoriteButton) {
    toggleGuideFavorite(favoriteButton.dataset.guideFavorite);
    return;
  }
  const openButton = event.target.closest('[data-open-guide]');
  if (openButton) openGuideFromFavorite(openButton.dataset.openGuide);
});

function appendChatMessage(text, sender = 'bot', source = '', urgent = false) {
  const bubble = document.createElement('div');
  bubble.className = `chat-message ${sender === 'user' ? 'user-message' : 'bot-message'}`;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  bubble.append(paragraph);
  if (source) {
    const attribution = document.createElement('small');
    attribution.textContent = source;
    bubble.append(attribution);
  }
  if (urgent) {
    const callLink = document.createElement('a');
    callLink.href = 'tel:192';
    callLink.className = 'chat-call-link';
    callLink.textContent = 'Ligar para o SAMU · 192';
    bubble.append(callLink);
  }
  chatLog.append(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function showChatIntensityChoices() {
  chatChoices.replaceChildren();
  for (const intensity of ['Leve', 'Moderada', 'Intensa']) {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'chat-choice';
    choice.textContent = intensity;
    choice.addEventListener('click', () => {
      chatIntensity = intensity;
      appendChatMessage(intensity, 'user');
      chatChoices.hidden = true;
      chatStage = 'duration';
      document.querySelector('#chat-progress').textContent = 'Etapa 3 de 4 · há quanto tempo?';
      chatForm.hidden = false;
      chatForm.querySelector('label').textContent = 'Há quanto tempo está sentindo isso?';
      chatInput.placeholder = 'Ex.: começou agora, desde ontem...';
      chatInput.value = '';
      chatInput.focus();
      appendChatMessage('Obrigado. Há quanto tempo você está sentindo isso?');
    });
    chatChoices.append(choice);
  }
  chatChoices.hidden = false;
  chatForm.hidden = true;
}

function answerChat() {
  const normalizedSymptom = chatSymptom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normalizedDetails = chatDetails.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normalizedContext = `${normalizedSymptom} ${normalizedDetails}`;
  const isHeadache = normalizedSymptom.includes('dor de cabeca') || normalizedSymptom.includes('cefaleia');
  const isHeatIllness = /insolacao|golpe de calor|exposicao ao calor|exposicao ao sol|calor extremo/.test(normalizedContext);
  const isDiarrhea = /diarreia|fezes liquidas/.test(normalizedContext);
  const isVomiting = /vomito|vomitando|nausea|enjo(o|ada|ado)/.test(normalizedContext);
  const isRespiratory = /tosse|resfriado|gripe|nariz entupido|coriza|dor de garganta/.test(normalizedContext);
  const isFever = /febre|temperatura alta/.test(normalizedContext);
  const isBurn = /queimadura|queimei|queimado/.test(normalizedContext);
  const isSprain = /torci|entorse|torcao|mau jeito|inchaco no tornozelo/.test(normalizedContext);
  const isBackPain = /dor nas costas|dor lombar|lombalgia/.test(normalizedContext);
  const hasSamuEmergencySign = /falta de ar|dificuldade para respirar|dor (forte )?no peito|desmai\w*|perda de consciencia|perdeu a consciencia|perdi a consciencia|confus(a|o)|convuls(a|ao)|fala enrolada|dificuldade para falar|alteracao subita na fala|fraqueza subita|fraqueza em um lado|perda de forca|desvio na boca|pior da vida|inicio subito e muito forte/.test(normalizedContext);
  const hasEmergencySign = hasSamuEmergencySign || /sangue nas fezes|vomito com sangue|nao consigo beber|nao consigo manter liquidos|pouca urina|muita sede/.test(normalizedContext);
  let answer;
  let source;
  let urgent = false;

  if (isHeatIllness) {
    answer = 'Suspeita de insolação precisa de avaliação urgente: peça ajuda para ir a uma UPA agora. Enquanto isso, vá para um local fresco e à sombra, retire o excesso de roupas e resfrie a pele com panos úmidos. Se houver confusão, desmaio ou dificuldade para chegar, ligue SAMU 192.';
    source = 'Primeiros socorros: Ministério da Saúde, “Insolação” · SAMU 192 · conferidos em 17/11/2026.';
    urgent = hasSamuEmergencySign || /desmai|convuls|nao consegue chegar|dificuldade para chegar/.test(normalizedContext);
  } else if (hasEmergencySign) {
    answer = 'O que você relatou precisa de avaliação de saúde sem demora. Peça ajuda para chegar a uma unidade de pronto atendimento. Se também houver falta de ar, dor forte no peito, desmaio, convulsão ou piora rápida, ligue SAMU 192.';
    source = 'SAMU 192 · Ministério da Saúde.';
    urgent = hasSamuEmergencySign;
  } else if (isDiarrhea || isVomiting) {
    answer = 'Tome pequenos goles frequentes de água ou soro de reidratação oral e mantenha alimentação leve conforme tolerar. Procure atendimento se os vômitos forem repetidos, houver sangue, muita sede ou pouca urina; crianças, idosos e gestantes precisam de atenção mais cedo.';
    source = 'Ministério da Saúde, “Doenças diarreicas agudas” · orientação geral; não use remédios por conta própria.';
    urgent = hasSamuEmergencySign;
  } else if (isRespiratory) {
    answer = 'Descanse e beba líquidos. Para tosse, uma bebida morna com mel pode aliviar (nunca dê mel a menores de 1 ano). Procure atendimento se piorar ou não melhorar; falta de ar ou dor no peito é urgência: ligue 192.';
    source = 'NHS, “Respiratory tract infections” e “Common cold” · orientação geral.';
    urgent = hasSamuEmergencySign;
  } else if (isBurn) {
    answer = 'Coloque a queimadura sob água corrente fria, sem gelo, por cerca de 10 minutos. Não passe pasta, óleo ou pomada e não estoure bolhas. Queimadura extensa, profunda, elétrica ou química precisa de atendimento urgente.';
    source = 'Biblioteca Virtual em Saúde do Ministério da Saúde, “Queimaduras”.';
    urgent = hasSamuEmergencySign || /queimadura (extensa|grave|profunda|eletrica|quimica)/.test(normalizedContext);
  } else if (isSprain) {
    answer = 'Nas primeiras 48–72 horas, proteja e descanse a região, aplique gelo envolto em pano por até 20 minutos e mantenha-a elevada. Procure atendimento se não conseguir apoiar, houver deformidade, dormência ou dor/inchaço forte.';
    source = 'NHS, “Sprains and strains” · orientação geral.';
    urgent = hasSamuEmergencySign;
  } else if (isBackPain) {
    answer = 'Se não houve trauma e não há sinais de alerta, tente manter movimentos leves e as atividades possíveis, sem forçar. Procure atendimento se houver fraqueza ou dormência nas pernas, perda do controle da urina/fezes, febre, trauma ou dor que impeça tarefas simples.';
    source = 'Ministério da Saúde, Linha de Cuidado da Dor Lombar · orientação geral.';
    urgent = hasSamuEmergencySign;
  } else if (isFever) {
    answer = 'Descanse, beba líquidos e acompanhe a evolução. Procure uma unidade de saúde se a febre persistir, piorar ou vier com outros sintomas preocupantes; dificuldade para respirar, confusão ou convulsão é urgência: ligue 192.';
    source = 'Ministério da Saúde · SAMU 192.';
    urgent = hasSamuEmergencySign;
  } else if (isHeadache && chatIntensity === 'Leve') {
    answer = 'Você marcou intensidade leve. Para dor de cabeça, a Biblioteca Virtual em Saúde do Ministério da Saúde cita hidratação e sono adequado entre hábitos relacionados à prevenção. Isso não identifica a causa nem garante alívio da dor atual. Evite começar ou aumentar medicamentos com base no app. Anote a evolução e procure orientação se persistir, piorar ou voltar com frequência.';
    source = 'Fonte: Biblioteca Virtual em Saúde do Ministério da Saúde · conferido em 17/11/2026.';
  } else if (isHeadache && chatIntensity === 'Moderada') {
    answer = 'Você marcou intensidade moderada. Este chat não consegue avaliar a causa nem indicar um tratamento individual. Considere conversar com um profissional, especialmente se a dor for nova, recorrente ou estiver piorando. Se o deslocamento for difícil, pergunte à sua UBS se há Telessaúde disponível na sua região; a oferta depende da rede local.';
    source = 'Fonte: Ministério da Saúde · Telessaúde no SUS complementa o cuidado presencial; disponibilidade conforme a rede local.';
  } else if (isHeadache && chatIntensity === 'Intensa') {
    answer = 'Você marcou intensidade intensa. Dor de início súbito e muito forte (“a pior da vida”), ou acompanhada de fraqueza, dificuldade para falar ou enxergar, confusão, convulsão, febre com rigidez na nuca ou após trauma pode exigir avaliação urgente. Se algum desses sinais estiver presente, procure urgência. Em uma emergência, ligue 192. Se não houver esses sinais, uma dor intensa ou diferente do habitual ainda merece avaliação profissional.';
    source = 'Fontes: Protocolos de Neurologia da BVS/MS · SAMU 192 do Ministério da Saúde · conferidos em 17/11/2026.';
    urgent = hasSamuEmergencySign;
  } else {
    answer = chatIntensity === 'Intensa'
      ? 'Ainda não temos orientação revisada para este sintoma, então não vou inventar um método. Como você marcou intensidade intensa, procure avaliação de um profissional com brevidade. Se houver falta de ar, dor no peito, desmaio, convulsão ou alteração súbita da fala ou força, ligue SAMU 192.'
      : chatIntensity === 'Moderada'
        ? 'Ainda não temos orientação revisada para este sintoma, então não vou inventar um método. Anote como evolui e considere conversar com um profissional, especialmente se persistir ou piorar; se deslocar for difícil, pergunte à sua UBS se há Telessaúde.'
        : 'Ainda não temos orientação revisada para este sintoma, então não vou inventar um método. Anote como evolui; se persistir, piorar ou preocupar você, procure orientação profissional.';
    source = 'Orientação geral · Telessaúde disponível conforme a rede local.';
    urgent = hasSamuEmergencySign;
  }

  const detailsText = chatDetails ? ` Outros detalhes que você contou: ${chatDetails}.` : '';
  appendChatMessage(`Resumo do que você contou: ${chatSymptom}; intensidade ${chatIntensity.toLowerCase()}; há ${chatDuration}.${detailsText} ${answer}`, 'bot', source, urgent);
  chatForm.hidden = true;
  chatChoices.hidden = true;
  document.querySelector('#chat-progress').textContent = 'Conversa concluída · você escolhe se quer salvar o relato';
  chatEndActions.hidden = false;
}

chatForm.addEventListener('submit', event => {
  event.preventDefault();
  const value = chatInput.value.trim();
  if (!value) return;
  appendChatMessage(value, 'user');
  chatInput.value = '';
  if (chatStage === 'symptom') {
    chatSymptom = value;
    chatStage = 'intensity';
    document.querySelector('#chat-quick-starts').hidden = true;
    document.querySelector('#chat-progress').textContent = 'Etapa 2 de 4 · escolha a intensidade relatada';
    appendChatMessage('Qual intensidade melhor descreve o que você está sentindo agora? Essa escolha é apenas o seu relato, não uma avaliação clínica.');
    showChatIntensityChoices();
    return;
  }
  if (chatStage === 'duration') {
    chatDuration = value;
    chatStage = 'details';
    document.querySelector('#chat-progress').textContent = 'Etapa 4 de 4 · outros sinais (opcional)';
    chatForm.querySelector('label').textContent = 'Outros sinais ou detalhes (opcional)';
    chatInput.placeholder = 'Ex.: também percebi..., ou escreva “pular”';
    document.querySelector('#skip-chat-details').hidden = false;
    appendChatMessage('Há mais algum sinal ou detalhe que você queira registrar? Essa parte é opcional; você pode pular.');
    return;
  }
  if (chatStage === 'details') {
    chatDetails = /^(pular|não|nao|nenhum)$/i.test(value) ? '' : value;
    chatStage = 'done';
    document.querySelector('#skip-chat-details').hidden = true;
    answerChat();
  }
});

document.querySelector('#skip-chat-details').addEventListener('click', () => {
  chatDetails = '';
  chatStage = 'done';
  appendChatMessage('Prefiro pular', 'user');
  document.querySelector('#skip-chat-details').hidden = true;
  answerChat();
});

document.querySelector('#save-chat-report').addEventListener('click', event => {
  const notes = chatDetails ? `Relato pelo chat. Outros detalhes: ${chatDetails}` : 'Relato salvo a partir do chat de apoio.';
  const record = {id:createId(), symptom:chatSymptom, intensity:chatIntensity, duration:chatDuration, notes, createdAt:new Date().toISOString()};
  const records = getRecords();
  records.unshift(record);
  try {
    localStorage.setItem(recordsStorageKey(), JSON.stringify(records));
    renderRecords();
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Relato salvo no histórico';
    showToast('Relato adicionado ao histórico.');
  } catch {
    showToast('Não foi possível salvar neste dispositivo.');
  }
});

document.querySelector('#new-chat').addEventListener('click', () => {
  chatSymptom = '';
  chatIntensity = '';
  chatDuration = '';
  chatDetails = '';
  chatStage = 'symptom';
  chatLog.replaceChildren();
  appendChatMessage('Oi! Me conte, em poucas palavras, o que está sentindo. Posso ajudar a organizar seu relato e mostrar orientações gerais revisadas. Não faço diagnósticos nem indico remédios.');
  chatChoices.hidden = true;
  chatEndActions.hidden = true;
  document.querySelector('#chat-quick-starts').hidden = false;
  document.querySelector('#chat-progress').textContent = 'Etapa 1 de 4 · conte o que está sentindo';
  document.querySelector('#skip-chat-details').hidden = true;
  const saveButton = document.querySelector('#save-chat-report');
  saveButton.disabled = false;
  saveButton.textContent = 'Salvar relato no histórico';
  chatForm.hidden = false;
  chatForm.querySelector('label').textContent = 'Sua mensagem';
  chatInput.placeholder = 'Escreva seu sintoma...';
  chatInput.value = '';
  chatInput.focus();
});

document.querySelector('#chat-quick-starts').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || chatStage !== 'symptom') return;
  chatInput.value = button.textContent;
  chatForm.requestSubmit();
});

setupGuideCards();
renderRecords();
loadProfile();
renderConsultationSummary(getRecords());
applyTheme(localStorage.getItem(THEME_KEY) || 'light');
seedDemoAccounts();
seedManagementDemoStatuses();
