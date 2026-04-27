/**
 * 경영전략그룹 Daily To do List - Frontend
 * Real-time collaborative version with API integration
 */

let tasks = [];
let assignees = [];
let currentFilter = 'all';
let currentSort = 'date-desc';
let expandedTasks = new Set();
let websocket = null;

const API_URL = window.location.origin + '/api';

document.addEventListener('DOMContentLoaded', () => {
    loadAssignees();
    loadTasks();
    connectWebSocket();
    setCurrentDate();
    setupEventListeners();
});

function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    websocket = new WebSocket(`${wsProtocol}//${window.location.host}`);
    
    websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleRealtimeUpdate(message.event, message.data);
    };
    
    websocket.onclose = () => setTimeout(connectWebSocket, 3000);
}

function handleRealtimeUpdate(event, data) {
    if (event === 'taskAdded' && !tasks.find(t => t.id === data.id)) {
        tasks.unshift(data);
        renderTasks();
        updateStatistics();
    } else if (event === 'taskUpdated') {
        const i = tasks.findIndex(t => t.id === data.id);
        if (i !== -1) { tasks[i] = data; renderTasks(); updateStatistics(); }
    } else if (event === 'taskDeleted') {
        tasks = tasks.filter(t => t.id !== data.id);
        renderTasks();
        updateStatistics();
    } else if (['actionItemAdded', 'actionItemUpdated', 'actionItemDeleted', 'commentAdded', 'commentDeleted', 'replyAdded', 'reactionToggled'].includes(event)) {
        loadTasks();
    } else if (event === 'assigneeAdded' && !assignees.includes(data.name)) {
        assignees.push(data.name);
        updateAssigneeDropdowns();
    } else if (event === 'assigneeUpdated') {
        const i = assignees.indexOf(data.oldName);
        if (i !== -1) { assignees[i] = data.newName; updateAssigneeDropdowns(); loadTasks(); }
    } else if (event === 'assigneeDeleted') {
        assignees = assignees.filter(a => a !== data.name);
        updateAssigneeDropdowns();
        loadTasks();
    }
}

function setCurrentDate() {
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function setupEventListeners() {
    document.getElementById('taskName').addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });
    document.getElementById('taskModal').addEventListener('click', e => { if (e.target.id === 'taskModal') closeModal(); });
    document.getElementById('editModal').addEventListener('click', e => { if (e.target.id === 'editModal') closeEditModal(); });
    document.getElementById('assigneeModal').addEventListener('click', e => { if (e.target.id === 'assigneeModal') closeAssigneeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeEditModal(); closeAssigneeModal(); } });
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_URL}${endpoint}`, options);
    return res.json();
}

async function loadTasks() {
    try {
        tasks = await apiRequest('/tasks');
        renderTasks();
        updateStatistics();
    } catch (e) { showToast('업무 로딩 실패', 'error'); }
}

async function loadAssignees() {
    try {
        assignees = await apiRequest('/assignees');
        updateAssigneeDropdowns();
    } catch (e) {}
}

async function addTask() {
    const name = document.getElementById('taskName').value.trim();
    if (!name) { showToast('업무명을 입력해주세요.', 'error'); return; }
    
    const task = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name,
        status: document.getElementById('taskStatus').value,
        assignees: getSelectedAssignees(),
        priority: document.getElementById('taskPriority').value,
        dueDate: document.getElementById('taskDueDate').value,
        description: document.getElementById('taskDescription').value.trim(),
        actionItems: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        await apiRequest('/tasks', 'POST', task);
        clearForm();
        showToast('업무가 추가되었습니다.', 'success');
    } catch (e) { showToast('업무 추가 실패', 'error'); }
}

function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('editModalBody').innerHTML = `
        <div class="modal-form-group"><label>업무명</label><input type="text" id="editTaskName" value="${escapeHtml(task.name)}"></div>
        <div class="modal-form-group"><label>상태</label><select id="editTaskStatus">
            <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>진행 중</option>
            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>완료</option>
            <option value="on-hold" ${task.status === 'on-hold' ? 'selected' : ''}>보류</option>
        </select></div>
        <div class="modal-form-group"><label>담당자</label><div class="edit-assignee-checkboxes" id="editAssigneeCheckboxes">
            ${assignees.map(n => `<label class="edit-assignee-checkbox"><input type="checkbox" value="${escapeHtml(n)}" ${(task.assignees || []).includes(n) ? 'checked' : ''}>${escapeHtml(n)}</label>`).join('')}
        </div></div>
        <div class="modal-form-group"><label>우선순위</label><select id="editTaskPriority">
            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>높음</option>
            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>보통</option>
            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>낮음</option>
        </select></div>
        <div class="modal-form-group"><label>마감일</label><input type="date" id="editTaskDueDate" value="${task.dueDate}"></div>
        <div class="modal-form-group"><label>설명</label><textarea id="editTaskDescription" rows="3">${escapeHtml(task.description)}</textarea></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeEditModal()">취소</button><button class="btn btn-primary" onclick="saveTaskEdit('${taskId}')">저장</button></div>
    `;
    document.getElementById('editModal').classList.add('active');
}

async function saveTaskEdit(taskId) {
    const name = document.getElementById('editTaskName').value.trim();
    if (!name) { showToast('업무명을 입력해주세요.', 'error'); return; }
    
    const checked = document.querySelectorAll('#editAssigneeCheckboxes input:checked');
    
    try {
        await apiRequest(`/tasks/${taskId}`, 'PUT', {
            name,
            status: document.getElementById('editTaskStatus').value,
            assignees: Array.from(checked).map(c => c.value),
            priority: document.getElementById('editTaskPriority').value,
            dueDate: document.getElementById('editTaskDueDate').value,
            description: document.getElementById('editTaskDescription').value.trim(),
            updatedAt: new Date().toISOString()
        });
        closeEditModal();
        showToast('업무가 수정되었습니다.', 'success');
    } catch (e) { showToast('수정 실패', 'error'); }
}

async function deleteTask(taskId) {
    if (!confirm('정말 이 업무를 삭제하시겠습니까?')) return;
    try {
        await apiRequest(`/tasks/${taskId}`, 'DELETE');
        showToast('업무가 삭제되었습니다.', 'success');
    } catch (e) { showToast('삭제 실패', 'error'); }
}

function clearForm() {
    ['taskName', 'taskDueDate', 'taskDescription'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('taskStatus').value = 'in-progress';
    document.getElementById('taskPriority').value = 'medium';
    document.querySelectorAll('#assigneeDropdownContent input').forEach(c => c.checked = false);
    updateSelectedAssigneesText();
    document.getElementById('assigneeDropdown')?.classList.remove('open');
    document.getElementById('taskName').focus();
}

async function addActionItem(taskId, input) {
    const text = input.value.trim();
    if (!text) return;
    try {
        await apiRequest(`/tasks/${taskId}/action-items`, 'POST', { id: Date.now().toString(36), text, completed: false, createdAt: new Date().toISOString() });
        input.value = '';
    } catch (e) {}
}

async function toggleActionItem(taskId, actionId) {
    const task = tasks.find(t => t.id === taskId);
    const item = task?.actionItems.find(a => a.id === actionId);
    if (item) await apiRequest(`/action-items/${actionId}`, 'PUT', { completed: !item.completed });
}

async function deleteActionItem(taskId, actionId) {
    await apiRequest(`/action-items/${actionId}`, 'DELETE');
}

async function addComment(taskId, input) {
    const text = input.value.trim();
    if (!text) return;
    await apiRequest(`/tasks/${taskId}/comments`, 'POST', { id: Date.now().toString(36), text, author: '사용자', createdAt: new Date().toISOString() });
    input.value = '';
}

async function addReply(taskId, commentId, input) {
    const text = input.value.trim();
    if (!text) return;
    await apiRequest(`/comments/${commentId}/replies`, 'POST', { id: Date.now().toString(36), text, author: '사용자', createdAt: new Date().toISOString() });
}

async function toggleReaction(taskId, commentId, emoji) {
    await apiRequest(`/comments/${commentId}/reactions`, 'POST', { emoji });
}

async function deleteComment(taskId, commentId) {
    await apiRequest(`/comments/${commentId}`, 'DELETE');
}

function renderTasks() {
    const list = document.getElementById('taskList');
    const empty = document.getElementById('emptyState');
    const filtered = sortTasksList(filterTasksList(tasks));
    
    if (filtered.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    list.innerHTML = filtered.map(t => renderTaskCard(t)).join('');
}

function renderTaskCard(task) {
    const statusText = { 'in-progress': '진행 중', 'completed': '완료', 'on-hold': '보류' };
    const priorityText = { 'high': '높음', 'medium': '보통', 'low': '낮음' };
    const expanded = expandedTasks.has(task.id);
    const assigneesDisplay = (task.assignees || []).map(a => escapeHtml(a)).join(', ');
    
    return `
<div class="task-card ${task.status === 'completed' ? 'completed-task' : ''}">
    <div class="task-header">
        <div class="task-main-info" onclick="toggleTaskExpand('${task.id}')">
            <div class="task-title-row">
                <span class="task-title">${escapeHtml(task.name)}</span>
                <span class="status-badge ${task.status}">${statusText[task.status]}</span>
                <span class="priority-badge ${task.priority}">${priorityText[task.priority]}</span>
            </div>
            <div class="task-meta">
                ${assigneesDisplay ? `<span class="task-meta-item">👤 ${assigneesDisplay}</span>` : ''}
                ${task.dueDate ? `<span class="task-meta-item">📅 ${formatDate(task.dueDate)}</span>` : ''}
                <span class="task-meta-item">🕐 ${formatDate(task.createdAt)}</span>
                ${task.actionItems.length > 0 ? `<span class="task-meta-item">📝 ${task.actionItems.filter(a => a.completed).length}/${task.actionItems.length} 완료</span>` : ''}
                ${task.comments.length > 0 ? `<span class="task-meta-item">💬 ${task.comments.length}</span>` : ''}
            </div>
        </div>
        <div class="task-actions">
            <button class="task-expand-btn ${expanded ? 'expanded' : ''}" onclick="toggleTaskExpand('${task.id}')"><span class="arrow">▼</span></button>
            <button class="btn btn-sm btn-outline" onclick="editTask('${task.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTask('${task.id}')">🗑️</button>
        </div>
    </div>
    <div class="task-body ${expanded ? 'expanded' : ''}">
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        <div class="action-items-section">
            <div class="section-title">세부 Action Items</div>
            ${task.actionItems.map(item => `<div class="action-item ${item.completed ? 'completed' : ''}"><input type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleActionItem('${task.id}', '${item.id}')"><span>${escapeHtml(item.text)}</span><button class="btn btn-sm btn-outline" onclick="deleteActionItem('${task.id}', '${item.id}')" style="margin-left:auto;padding:2px 6px;">×</button></div>`).join('')}
            <div class="add-action-item"><input type="text" placeholder="세부 항목 추가..." onkeypress="if(event.key==='Enter')addActionItem('${task.id}',this)"><button class="btn btn-sm btn-primary" onclick="addActionItem('${task.id}',this.previousElementSibling)">추가</button></div>
        </div>
        <div class="comments-section">
            <div class="section-title">댓글 (${task.comments.length})</div>
            ${task.comments.map(c => `<div class="comment"><div class="comment-header"><span class="comment-author">${escapeHtml(c.author)}</span><span class="comment-time">${formatDate(c.createdAt)}</span></div><div class="comment-text">${escapeHtml(c.text)}</div><div class="comment-footer"><button class="reply-btn" onclick="toggleReplyInput('${task.id}','${c.id}')">답글</button><div class="emoji-reactions">${['👍','❤️','😊','🎉'].map(e=>`<button class="emoji-btn" onclick="toggleReaction('${task.id}','${c.id}','${e}')">${e} ${c.reactions[e]||''}</button>`).join('')}</div><button class="btn btn-sm btn-outline" onclick="deleteComment('${task.id}','${c.id}')">삭제</button></div><div class="reply-input" id="reply-${c.id}" style="display:none;"><div class="add-comment"><input type="text" placeholder="답글..." onkeypress="if(event.key==='Enter')addReply('${task.id}','${c.id}',this)"><button class="btn btn-sm btn-primary" onclick="addReply('${task.id}','${c.id}',this.previousElementSibling)">등록</button></div></div>${(c.replies||[]).map(r=>`<div class="reply"><div class="comment-header"><span class="comment-author">${escapeHtml(r.author)}</span><span class="comment-time">${formatDate(r.createdAt)}</span></div><div class="comment-text">${escapeHtml(r.text)}</div></div>`).join('')}</div>`).join('')}
            <div class="add-comment"><input type="text" placeholder="댓글 입력..." id="comment-input-${task.id}" onkeypress="if(event.key==='Enter')addComment('${task.id}',this)"><button class="btn btn-sm btn-primary" onclick="addComment('${task.id}',document.getElementById('comment-input-${task.id}'))">등록</button></div>
        </div>
    </div>
</div>`;
}

function toggleTaskExpand(id) { expandedTasks.has(id) ? expandedTasks.delete(id) : expandedTasks.add(id); renderTasks(); }
function toggleReplyInput(taskId, id) { const el = document.getElementById(`reply-${id}`); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

function setFilter(f) { currentFilter = f; document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f)); renderTasks(); }
function filterTasksList(list) { const s = document.getElementById('searchInput').value.toLowerCase(); return list.filter(t => (currentFilter === 'all' || t.status === currentFilter) && (!s || t.name.toLowerCase().includes(s) || t.description.toLowerCase().includes(s) || (t.assignees || []).join(' ').toLowerCase().includes(s))); }
function filterTasks() { renderTasks(); }
function sortTasksList(list) { const p = { high: 0, medium: 1, low: 2 }; return [...list].sort((a, b) => currentSort === 'date-desc' ? new Date(b.createdAt) - new Date(a.createdAt) : currentSort === 'date-asc' ? new Date(a.createdAt) - new Date(b.createdAt) : currentSort === 'priority' ? p[a.priority] - p[b.priority] : currentSort === 'due-date' ? (a.dueDate ? new Date(a.dueDate) : 1e15) - (b.dueDate ? new Date(b.dueDate) : 1e15) : 0); }
function sortTasks() { currentSort = document.getElementById('sortBy').value; renderTasks(); }

function updateStatistics() {
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('inProgressTasks').textContent = tasks.filter(t => t.status === 'in-progress').length;
    document.getElementById('completedTasks').textContent = tasks.filter(t => t.status === 'completed').length;
    document.getElementById('onHoldTasks').textContent = tasks.filter(t => t.status === 'on-hold').length;
}

function closeModal() { document.getElementById('taskModal').classList.remove('active'); }
function closeEditModal() { document.getElementById('editModal').classList.remove('active'); }
function closeAssigneeModal() { document.getElementById('assigneeModal').classList.remove('active'); }

function escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
function formatDate(ds) { if (!ds) return ''; const d = new Date(ds), diff = Date.now() - d; return diff < 60000 ? '방금 전' : diff < 3600000 ? `${Math.floor(diff/60000)}분 전` : diff < 86400000 ? `${Math.floor(diff/3600000)}시간 전` : diff < 604800000 ? `${Math.floor(diff/86400000)}일 전` : d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }); }
function showToast(msg, type = 'success') { const t = document.getElementById('toast'); t.textContent = msg; t.className = `toast ${type}`; setTimeout(() => t.classList.add('show'), 10); setTimeout(() => t.classList.remove('show'), 3000); }

function updateAssigneeDropdowns() { renderAssigneeDropdown(); }
function renderAssigneeDropdown(sel = []) {
    const c = document.getElementById('assigneeDropdownContent');
    if (!c) return;
    c.innerHTML = assignees.map(n => `<div class="assignee-checkbox-item" onclick="event.stopPropagation()"><input type="checkbox" id="assignee-cb-${escapeHtml(n)}" value="${escapeHtml(n)}" ${sel.includes(n) ? 'checked' : ''} onchange="updateSelectedAssigneesText()"><label for="assignee-cb-${escapeHtml(n)}">${escapeHtml(n)}</label></div>`).join('');
    updateSelectedAssigneesText();
}
function toggleAssigneeDropdown() { document.getElementById('assigneeDropdown')?.classList.toggle('open'); }
function getSelectedAssignees() { return Array.from(document.querySelectorAll('#assigneeDropdownContent input:checked')).map(c => c.value); }
function updateSelectedAssigneesText() { const s = getSelectedAssignees(); const el = document.getElementById('selectedAssigneesText'); if (el) el.textContent = s.length === 0 ? '담당자 선택' : s.join(', '); }

function openAssigneeManager() {
    document.getElementById('assigneeModalBody').innerHTML = assignees.length === 0 ? 
        `<div class="empty-assignees"><div class="empty-assignees-icon">👥</div><p>등록된 담당자가 없습니다.</p></div><div class="add-assignee-form"><input type="text" id="newAssigneeName" placeholder="담당자 이름..." onkeypress="if(event.key==='Enter')addNewAssignee()"><button class="btn btn-primary" onclick="addNewAssignee()">추가</button></div>` :
        `<div class="assignee-list">${assignees.map((n, i) => `<div class="assignee-item"><div class="assignee-info"><div class="assignee-avatar">${n.charAt(0)}</div><span class="assignee-name" id="assignee-name-${i}">${escapeHtml(n)}</span></div><div class="assignee-actions"><button class="btn btn-sm btn-outline" onclick="editAssigneeName(${i})">✏️</button><button class="btn btn-sm btn-danger" onclick="deleteAssigneeByName(${i})">🗑️</button></div></div>`).join('')}</div><div class="add-assignee-form"><input type="text" id="newAssigneeName" placeholder="새 담당자..." onkeypress="if(event.key==='Enter')addNewAssignee()"><button class="btn btn-primary" onclick="addNewAssignee()">추가</button></div>`;
    document.getElementById('assigneeModal').classList.add('active');
}

async function addNewAssignee() {
    const input = document.getElementById('newAssigneeName');
    const name = input.value.trim();
    if (!name) { showToast('이름을 입력해주세요.', 'error'); return; }
    if (assignees.includes(name)) { showToast('이미 존재합니다.', 'error'); return; }
    try { await apiRequest('/assignees', 'POST', { name }); openAssigneeManager(); showToast('추가되었습니다.', 'success'); }
    catch (e) { showToast('추가 실패', 'error'); }
}

function editAssigneeName(i) {
    const span = document.getElementById(`assignee-name-${i}`);
    const current = assignees[i];
    span.innerHTML = `<input type="text" value="${escapeHtml(current)}" style="width:120px;padding:4px 8px;border:1px solid var(--border-color);border-radius:4px;" onkeypress="if(event.key==='Enter')saveAssigneeEdit(${i},this.value)" onblur="saveAssigneeEdit(${i},this.value)" id="edit-input-${i}">`;
    document.getElementById(`edit-input-${i}`).focus();
}

async function saveAssigneeEdit(i, newName) {
    const name = newName.trim();
    if (!name) { showToast('이름은 비워둘 수 없습니다.', 'error'); openAssigneeManager(); return; }
    if (assignees.some((n, idx) => idx !== i && n === name)) { showToast('이미 존재합니다.', 'error'); openAssigneeManager(); return; }
    try { await apiRequest(`/assignees/${encodeURIComponent(assignees[i])}`, 'PUT', { newName }); openAssigneeManager(); showToast('수정되었습니다.', 'success'); }
    catch (e) { showToast('수정 실패', 'error'); }
}

async function deleteAssigneeByName(i) {
    const name = assignees[i];
    if (!confirm(`정말 "${name}" 담당자를 삭제하시겠습니까?`)) return;
    try { await apiRequest(`/assignees/${encodeURIComponent(name)}`, 'DELETE'); openAssigneeManager(); showToast('삭제되었습니다.', 'success'); }
    catch (e) { showToast('삭제 실패', 'error'); }
}