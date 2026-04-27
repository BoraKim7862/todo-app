/**
 * 경영전략그룹 Daily To do List
 * Main Application JavaScript
 */

// ========================================
// Application State
// ========================================
let tasks = [];
let assignees = [];
let currentFilter = 'all';
let currentSort = 'date-desc';
let expandedTasks = new Set();

// ========================================
// Local Storage Keys
// ========================================
const STORAGE_KEY = 'strategyGroupTodoList';
const ASSIGNEE_STORAGE_KEY = 'strategyGroupAssignees';

// Default assignees
const DEFAULT_ASSIGNEES = ['김성욱', '김보라', '변정은', '정현찬', '김동현', '정다현'];

// ========================================
// Initialization
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * Initialize the application
 */
function initializeApp() {
    loadAssignees();
    loadTasks();
    updateAssigneeDropdowns();
    renderTasks();
    updateStatistics();
    setCurrentDate();
    setupEventListeners();
}

/**
 * Set current date in header
 */
function setCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    const now = new Date();
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long' 
    };
    dateElement.textContent = now.toLocaleDateString('ko-KR', options);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Enter key for adding tasks
    document.getElementById('taskName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    // Close modals on outside click
    document.getElementById('taskModal').addEventListener('click', (e) => {
        if (e.target.id === 'taskModal') {
            closeModal();
        }
    });

    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            closeEditModal();
        }
    });

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeEditModal();
            closeAssigneeModal();
        }
    });

    // Close assignee modal on outside click
    document.getElementById('assigneeModal').addEventListener('click', (e) => {
        if (e.target.id === 'assigneeModal') {
            closeAssigneeModal();
        }
    });
}

// ========================================
// Task CRUD Operations
// ========================================

/**
 * Add a new task
 */
function addTask() {
    const nameInput = document.getElementById('taskName');
    const statusSelect = document.getElementById('taskStatus');
    const prioritySelect = document.getElementById('taskPriority');
    const dueDateInput = document.getElementById('taskDueDate');
    const descriptionInput = document.getElementById('taskDescription');

    const name = nameInput.value.trim();
    
    if (!name) {
        showToast('업무명을 입력해주세요.', 'error');
        nameInput.focus();
        return;
    }

    // Get selected assignees (multiple)
    const selectedAssignees = getSelectedAssignees();

    const task = {
        id: generateId(),
        name: name,
        status: statusSelect.value,
        assignees: selectedAssignees, // Changed from assignee to assignees (array)
        priority: prioritySelect.value,
        dueDate: dueDateInput.value,
        description: descriptionInput.value.trim(),
        actionItems: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    tasks.unshift(task);
    saveTasks();
    renderTasks();
    updateStatistics();
    clearForm();
    showToast('업무가 추가되었습니다.', 'success');
}

/**
 * Edit a task
 * @param {string} taskId - Task ID to edit
 */
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Get current assignees
    const currentAssignees = task.assignees || (task.assignee ? [task.assignee] : []);

    const modalBody = document.getElementById('editModalBody');
    modalBody.innerHTML = `
        <div class="modal-form-group">
            <label for="editTaskName">업무명</label>
            <input type="text" id="editTaskName" value="${escapeHtml(task.name)}" required>
        </div>
        <div class="modal-form-group">
            <label for="editTaskStatus">상태</label>
            <select id="editTaskStatus">
                <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>진행 중</option>
                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>완료</option>
                <option value="on-hold" ${task.status === 'on-hold' ? 'selected' : ''}>보류</option>
            </select>
        </div>
        <div class="modal-form-group">
            <label>담당자 (다중 선택 가능)</label>
            <div class="edit-assignee-checkboxes" id="editAssigneeCheckboxes">
                ${assignees.map(name => `
                    <label class="edit-assignee-checkbox">
                        <input type="checkbox" value="${escapeHtml(name)}" 
                               ${currentAssignees.includes(name) ? 'checked' : ''}>
                        ${escapeHtml(name)}
                    </label>
                `).join('')}
            </div>
        </div>
        <div class="modal-form-group">
            <label for="editTaskPriority">우선순위</label>
            <select id="editTaskPriority">
                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>높음</option>
                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>보통</option>
                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>낮음</option>
            </select>
        </div>
        <div class="modal-form-group">
            <label for="editTaskDueDate">마감일</label>
            <input type="date" id="editTaskDueDate" value="${task.dueDate}">
        </div>
        <div class="modal-form-group">
            <label for="editTaskDescription">설명</label>
            <textarea id="editTaskDescription" rows="3">${escapeHtml(task.description)}</textarea>
        </div>
        <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeEditModal()">취소</button>
            <button class="btn btn-primary" onclick="saveTaskEdit('${taskId}')">저장</button>
        </div>
    `;

    document.getElementById('editModal').classList.add('active');
}

/**
 * Save edited task
 * @param {string} taskId - Task ID to save
 */
function saveTaskEdit(taskId) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const name = document.getElementById('editTaskName').value.trim();
    
    if (!name) {
        showToast('업무명을 입력해주세요.', 'error');
        return;
    }

    // Get selected assignees from checkboxes
    const checkedBoxes = document.querySelectorAll('#editAssigneeCheckboxes input[type="checkbox"]:checked');
    const selectedAssignees = Array.from(checkedBoxes).map(cb => cb.value);

    tasks[taskIndex] = {
        ...tasks[taskIndex],
        name: name,
        status: document.getElementById('editTaskStatus').value,
        assignees: selectedAssignees,
        priority: document.getElementById('editTaskPriority').value,
        dueDate: document.getElementById('editTaskDueDate').value,
        description: document.getElementById('editTaskDescription').value.trim(),
        updatedAt: new Date().toISOString()
    };

    saveTasks();
    renderTasks();
    updateStatistics();
    closeEditModal();
    showToast('업무가 수정되었습니다.', 'success');
}

/**
 * Delete a task
 * @param {string} taskId - Task ID to delete
 */
function deleteTask(taskId) {
    if (!confirm('정말 이 업무를 삭제하시겠습니까?')) {
        return;
    }

    tasks = tasks.filter(t => t.id !== taskId);
    saveTasks();
    renderTasks();
    updateStatistics();
    showToast('업무가 삭제되었습니다.', 'success');
}

/**
 * Clear the add task form
 */
function clearForm() {
    document.getElementById('taskName').value = '';
    document.getElementById('taskStatus').value = 'in-progress';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskDescription').value = '';
    
    // Clear all assignee checkboxes
    const checkboxes = document.querySelectorAll('#assigneeDropdownContent input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateSelectedAssigneesText();
    
    // Close dropdown if open
    const dropdown = document.getElementById('assigneeDropdown');
    if (dropdown) {
        dropdown.classList.remove('open');
    }
    
    document.getElementById('taskName').focus();
}

// ========================================
// Action Items
// ========================================

/**
 * Add an action item to a task
 * @param {string} taskId - Task ID
 * @param {HTMLInputElement} inputElement - Input element for action item
 */
function addActionItem(taskId, inputElement) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const actionText = inputElement.value.trim();
    if (!actionText) return;

    const actionItem = {
        id: generateId(),
        text: actionText,
        completed: false,
        createdAt: new Date().toISOString()
    };

    task.actionItems.push(actionItem);
    task.updatedAt = new Date().toISOString();
    
    saveTasks();
    renderTasks();
    showToast('세부行动 항목이 추가되었습니다.', 'success');
}

/**
 * Toggle action item completion
 * @param {string} taskId - Task ID
 * @param {string} actionId - Action item ID
 */
function toggleActionItem(taskId, actionId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const actionItem = task.actionItems.find(a => a.id === actionId);
    if (!actionItem) return;

    actionItem.completed = !actionItem.completed;
    task.updatedAt = new Date().toISOString();
    
    saveTasks();
    renderTasks();
}

/**
 * Delete an action item
 * @param {string} taskId - Task ID
 * @param {string} actionId - Action item ID
 */
function deleteActionItem(taskId, actionId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.actionItems = task.actionItems.filter(a => a.id !== actionId);
    task.updatedAt = new Date().toISOString();
    
    saveTasks();
    renderTasks();
    showToast('세부行动 항목이 삭제되었습니다.', 'success');
}

// ========================================
// Comments
// ========================================

/**
 * Add a comment to a task
 * @param {string} taskId - Task ID
 * @param {HTMLInputElement} inputElement - Input element for comment
 */
function addComment(taskId, inputElement) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const commentText = inputElement.value.trim();
    if (!commentText) return;

    const comment = {
        id: generateId(),
        text: commentText,
        author: '사용자', // In a real app, this would be the logged-in user
        createdAt: new Date().toISOString(),
        replies: [],
        reactions: {}
    };

    task.comments.push(comment);
    task.updatedAt = new Date().toISOString();
    
    saveTasks();
    renderTasks();
    inputElement.value = '';
    showToast('댓글이 추가되었습니다.', 'success');
}

/**
 * Add a reply to a comment
 * @param {string} taskId - Task ID
 * @param {string} commentId - Comment ID
 * @param {HTMLInputElement} inputElement - Input element for reply
 */
function addReply(taskId, commentId, inputElement) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const comment = task.comments.find(c => c.id === commentId);
    if (!comment) return;

    const replyText = inputElement.value.trim();
    if (!replyText) return;

    const reply = {
        id: generateId(),
        text: replyText,
        author: '사용자',
        createdAt: new Date().toISOString()
    };

    comment.replies.push(reply);
    task.updatedAt = new Date().toISOString();
    
    saveTasks();
    renderTasks();
    showToast('답글이 추가되었습니다.', 'success');
}

/**
 * Toggle emoji reaction on a comment
 * @param {string} taskId - Task ID
 * @param {string} commentId - Comment ID
 * @param {string} emoji - Emoji to toggle
 */
function toggleReaction(taskId, commentId, emoji) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const comment = task.comments.find(c => c.id === commentId);
    if (!comment) return;

    if (!comment.reactions[emoji]) {
        comment.reactions[emoji] = 1;
    } else {
        delete comment.reactions[emoji];
    }
    
    task.updatedAt = new Date().toISOString();
    saveTasks();
    renderTasks();
}

/**
 * Delete a comment
 * @param {string} taskId - Task ID
 * @param {string} commentId - Comment ID
 */
function deleteComment(taskId, commentId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.comments = task.comments.filter(c => c.id !== commentId);
    task.updatedAt = new Date().toISOString();
    
    saveTasks();
    renderTasks();
    showToast('댓글이 삭제되었습니다.', 'success');
}

// ========================================
// Rendering
// ========================================

/**
 * Render all tasks
 */
function renderTasks() {
    const taskList = document.getElementById('taskList');
    const emptyState = document.getElementById('emptyState');
    
    let filteredTasks = filterTasksList(tasks);
    filteredTasks = sortTasksList(filteredTasks);

    if (filteredTasks.length === 0) {
        taskList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    taskList.innerHTML = filteredTasks.map(task => renderTaskCard(task)).join('');
}

/**
 * Render a single task card
 * @param {Object} task - Task object
 * @returns {string} HTML string
 */
function renderTaskCard(task) {
    const isExpanded = expandedTasks.has(task.id);
    const statusText = {
        'in-progress': '진행 중',
        'completed': '완료',
        'on-hold': '보류'
    };
    const priorityText = {
        'high': '높음',
        'medium': '보통',
        'low': '낮음'
    };

    const actionItemsHtml = task.actionItems.map(item => `
        <div class="action-item ${item.completed ? 'completed' : ''}">
            <input type="checkbox" ${item.completed ? 'checked' : ''} 
                   onchange="toggleActionItem('${task.id}', '${item.id}')">
            <span>${escapeHtml(item.text)}</span>
            <button class="btn btn-sm btn-outline" onclick="deleteActionItem('${task.id}', '${item.id}')" 
                    style="margin-left: auto; padding: 2px 6px;">×</button>
        </div>
    `).join('');

    const commentsHtml = task.comments.map(comment => `
        <div class="comment">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-time">${formatDate(comment.createdAt)}</span>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
            <div class="comment-footer">
                <button class="reply-btn" onclick="toggleReplyInput('${task.id}', '${comment.id}')">답글</button>
                <div class="emoji-reactions">
                    ${['👍', '❤️', '😊', '🎉'].map(emoji => `
                        <button class="emoji-btn" onclick="toggleReaction('${task.id}', '${comment.id}', '${emoji}')">
                            ${emoji} ${comment.reactions[emoji] || ''}
                        </button>
                    `).join('')}
                </div>
                <button class="btn btn-sm btn-outline" onclick="deleteComment('${task.id}', '${comment.id}')"
                        style="margin-left: auto;">삭제</button>
            </div>
            <div class="reply-input" id="reply-${comment.id}" style="display: none;">
                <div class="add-comment">
                    <input type="text" placeholder="답글을 입력하세요..." 
                           onkeypress="if(event.key === 'Enter') addReply('${task.id}', '${comment.id}', this)">
                    <button class="btn btn-sm btn-primary" 
                            onclick="addReply('${task.id}', '${comment.id}', this.previousElementSibling)">등록</button>
                </div>
            </div>
            ${comment.replies.map(reply => `
                <div class="reply">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHtml(reply.author)}</span>
                        <span class="comment-time">${formatDate(reply.createdAt)}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(reply.text)}</div>
                </div>
            `).join('')}
        </div>
    `).join('');

    // Handle assignees display (support both old 'assignee' and new 'assignees' array)
    const assigneesList = task.assignees || (task.assignee ? [task.assignee] : []);
    const assigneesDisplay = assigneesList.length > 0 
        ? assigneesList.map(a => escapeHtml(a)).join(', ')
        : '';

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
                    <button class="task-expand-btn ${isExpanded ? 'expanded' : ''}" onclick="toggleTaskExpand('${task.id}')">
                        <span class="arrow">▼</span>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="editTask('${task.id}')">✏️ 수정</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTask('${task.id}')">🗑️ 삭제</button>
                </div>
            </div>
            <div class="task-body ${isExpanded ? 'expanded' : ''}">
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                
                <div class="action-items-section">
                    <div class="section-title">세부 Action Items</div>
                    ${actionItemsHtml}
                    <div class="add-action-item">
                        <input type="text" placeholder="새로운 세부 항목 추가..." 
                               onkeypress="if(event.key === 'Enter') addActionItem('${task.id}', this)">
                        <button class="btn btn-sm btn-primary" 
                                onclick="addActionItem('${task.id}', this.previousElementSibling)">추가</button>
                    </div>
                </div>

                <div class="comments-section">
                    <div class="section-title">댓글 (${task.comments.length})</div>
                    ${commentsHtml}
                    <div class="add-comment">
                        <input type="text" placeholder="댓글을 입력하세요..." id="comment-input-${task.id}"
                               onkeypress="if(event.key === 'Enter') addComment('${task.id}', this)">
                        <button class="btn btn-sm btn-primary" 
                                onclick="addComment('${task.id}', document.getElementById('comment-input-${task.id}'))">등록</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Toggle task expansion
 * @param {string} taskId - Task ID
 */
function toggleTaskExpand(taskId) {
    if (expandedTasks.has(taskId)) {
        expandedTasks.delete(taskId);
    } else {
        expandedTasks.add(taskId);
    }
    renderTasks();
}

/**
 * Toggle reply input visibility
 * @param {string} taskId - Task ID
 * @param {string} commentId - Comment ID
 */
function toggleReplyInput(taskId, commentId) {
    const replyInput = document.getElementById(`reply-${commentId}`);
    if (replyInput) {
        replyInput.style.display = replyInput.style.display === 'none' ? 'block' : 'none';
    }
}

// ========================================
// Filtering and Sorting
// ========================================

/**
 * Set current filter
 * @param {string} filter - Filter value
 */
function setFilter(filter) {
    currentFilter = filter;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    renderTasks();
}

/**
 * Filter tasks list
 * @param {Array} tasksList - Tasks to filter
 * @returns {Array} Filtered tasks
 */
function filterTasksList(tasksList) {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    return tasksList.filter(task => {
        // Status filter
        const matchesFilter = currentFilter === 'all' || task.status === currentFilter;
        
        // Get assignees list for search
        const assigneesList = task.assignees || (task.assignee ? [task.assignee] : []);
        const assigneesText = assigneesList.join(' ').toLowerCase();
        
        // Search filter
        const matchesSearch = !searchTerm || 
            task.name.toLowerCase().includes(searchTerm) ||
            task.description.toLowerCase().includes(searchTerm) ||
            assigneesText.includes(searchTerm);
        
        return matchesFilter && matchesSearch;
    });
}

/**
 * Filter tasks (called from input event)
 */
function filterTasks() {
    renderTasks();
}

/**
 * Sort tasks list
 * @param {Array} tasksList - Tasks to sort
 * @returns {Array} Sorted tasks
 */
function sortTasksList(tasksList) {
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    
    return [...tasksList].sort((a, b) => {
        switch (currentSort) {
            case 'date-desc':
                return new Date(b.createdAt) - new Date(a.createdAt);
            case 'date-asc':
                return new Date(a.createdAt) - new Date(b.createdAt);
            case 'priority':
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            case 'due-date':
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            default:
                return 0;
        }
    });
}

/**
 * Sort tasks (called from select change event)
 */
function sortTasks() {
    currentSort = document.getElementById('sortBy').value;
    renderTasks();
}

// ========================================
// Statistics
// ========================================

/**
 * Update statistics display
 */
function updateStatistics() {
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('inProgressTasks').textContent = 
        tasks.filter(t => t.status === 'in-progress').length;
    document.getElementById('completedTasks').textContent = 
        tasks.filter(t => t.status === 'completed').length;
    document.getElementById('onHoldTasks').textContent = 
        tasks.filter(t => t.status === 'on-hold').length;
}

// ========================================
// Data Persistence
// ========================================

/**
 * Save tasks to localStorage
 */
function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        console.error('Failed to save tasks:', error);
        showToast('데이터 저장에 실패했습니다.', 'error');
    }
}

/**
 * Load tasks from localStorage
 */
function loadTasks() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            tasks = JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load tasks:', error);
        tasks = [];
    }
}

/**
 * Export data to JSON file
 */
function exportData() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `todo-list-${formatDateForFile(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('데이터가 내보내기 되었습니다.', 'success');
}

/**
 * Import data from JSON file
 * @param {Event} event - File input change event
 */
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedData)) {
                throw new Error('Invalid data format');
            }

            // Validate imported data
            importedData.forEach(task => {
                if (!task.id || !task.name) {
                    throw new Error('Invalid task data');
                }
            });

            if (confirm(`${importedData.length}개의 업무를 가져오시겠습니까?\n(기존 데이터는 유지됩니다)`)) {
                tasks = [...importedData, ...tasks];
                saveTasks();
                renderTasks();
                updateStatistics();
                showToast('데이터가 가져오기 되었습니다.', 'success');
            }
        } catch (error) {
            console.error('Import error:', error);
            showToast('데이터 가져오기에 실패했습니다. 올바른 JSON 파일인지 확인해주세요.', 'error');
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// ========================================
// Modal Management
// ========================================

/**
 * Close task detail modal
 */
function closeModal() {
    document.getElementById('taskModal').classList.remove('active');
}

/**
 * Close edit modal
 */
function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

// ========================================
// Utility Functions
// ========================================

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return '방금 전';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}분 전`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}시간 전`;
    }
    
    // Less than 7 days
    if (diff < 604800000) {
        return `${Math.floor(diff / 86400000)}일 전`;
    }
    
    // Default format
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format date for file name
 * @param {Date} date - Date object
 * @returns {string} Formatted date for file
 */
function formatDateForFile(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error)
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========================================
// Assignee Management
// ========================================

/**
 * Load assignees from localStorage
 */
function loadAssignees() {
    try {
        const data = localStorage.getItem(ASSIGNEE_STORAGE_KEY);
        if (data) {
            assignees = JSON.parse(data);
        } else {
            // Use default assignees if none saved
            assignees = [...DEFAULT_ASSIGNEES];
            saveAssignees();
        }
    } catch (error) {
        console.error('Failed to load assignees:', error);
        assignees = [...DEFAULT_ASSIGNEES];
    }
}

/**
 * Save assignees to localStorage
 */
function saveAssignees() {
    try {
        localStorage.setItem(ASSIGNEE_STORAGE_KEY, JSON.stringify(assignees));
    } catch (error) {
        console.error('Failed to save assignees:', error);
        showToast('담당자 저장에 실패했습니다.', 'error');
    }
}

/**
 * Update all assignee dropdowns in the page
 */
function updateAssigneeDropdowns() {
    renderAssigneeDropdown();
}

/**
 * Render the multi-select assignee dropdown
 */
function renderAssigneeDropdown(selectedAssignees = []) {
    const dropdownContent = document.getElementById('assigneeDropdownContent');
    if (!dropdownContent) return;

    dropdownContent.innerHTML = assignees.map(name => `
        <div class="assignee-checkbox-item" onclick="event.stopPropagation()">
            <input type="checkbox" id="assignee-cb-${escapeHtml(name)}" 
                   value="${escapeHtml(name)}" 
                   ${selectedAssignees.includes(name) ? 'checked' : ''}
                   onchange="updateSelectedAssigneesText()">
            <label for="assignee-cb-${escapeHtml(name)}">${escapeHtml(name)}</label>
        </div>
    `).join('');

    updateSelectedAssigneesText();
}

/**
 * Toggle assignee dropdown
 */
function toggleAssigneeDropdown() {
    const dropdown = document.getElementById('assigneeDropdown');
    if (dropdown) {
        dropdown.classList.toggle('open');
    }
}

/**
 * Get selected assignees from checkboxes
 * @returns {Array} Array of selected assignee names
 */
function getSelectedAssignees() {
    const checkboxes = document.querySelectorAll('#assigneeDropdownContent input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Update the selected assignees text in dropdown header
 */
function updateSelectedAssigneesText() {
    const selected = getSelectedAssignees();
    const textElement = document.getElementById('selectedAssigneesText');
    if (textElement) {
        if (selected.length === 0) {
            textElement.textContent = '담당자 선택';
        } else {
            textElement.textContent = selected.join(', ');
        }
    }
}

/**
 * Remove an assignee from selection
 * @param {string} name - Assignee name to remove
 */
function removeAssigneeFromSelection(name) {
    const checkbox = document.getElementById(`assignee-cb-${name}`);
    if (checkbox) {
        checkbox.checked = false;
        updateSelectedAssigneesText();
    }
}

/**
 * Get assignee options HTML for dropdowns
 * @param {string} selectedValue - Currently selected value
 * @returns {string} HTML string of options
 */
function getAssigneeOptionsHtml(selectedValue = '') {
    return '<option value="">담당자 선택</option>' + 
        assignees.map(name => 
            `<option value="${escapeHtml(name)}" ${name === selectedValue ? 'selected' : ''}>${escapeHtml(name)}</option>`
        ).join('');
}

/**
 * Open assignee manager modal
 */
function openAssigneeManager() {
    const modalBody = document.getElementById('assigneeModalBody');
    modalBody.innerHTML = renderAssigneeManagerContent();
    document.getElementById('assigneeModal').classList.add('active');
}

/**
 * Close assignee manager modal
 */
function closeAssigneeModal() {
    document.getElementById('assigneeModal').classList.remove('active');
}

/**
 * Render assignee manager content
 * @returns {string} HTML string
 */
function renderAssigneeManagerContent() {
    if (assignees.length === 0) {
        return `
            <div class="empty-assignees">
                <div class="empty-assignees-icon">👥</div>
                <p>등록된 담당자가 없습니다.</p>
                <p>새로운 담당자를 추가해보세요!</p>
            </div>
            <div class="add-assignee-form">
                <input type="text" id="newAssigneeName" placeholder="담당자 이름 입력..." 
                       onkeypress="if(event.key === 'Enter') addNewAssignee()">
                <button class="btn btn-primary" onclick="addNewAssignee()">추가</button>
            </div>
        `;
    }

    return `
        <div class="assignee-list">
            ${assignees.map((name, index) => `
                <div class="assignee-item" id="assignee-item-${index}">
                    <div class="assignee-info">
                        <div class="assignee-avatar">${name.charAt(0)}</div>
                        <span class="assignee-name" id="assignee-name-${index}">${escapeHtml(name)}</span>
                    </div>
                    <div class="assignee-actions">
                        <button class="btn btn-sm btn-outline" onclick="editAssigneeName(${index})" title="수정">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteAssigneeByName(${index})" title="삭제">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="add-assignee-form">
            <input type="text" id="newAssigneeName" placeholder="새로운 담당자 이름 입력..." 
                   onkeypress="if(event.key === 'Enter') addNewAssignee()">
            <button class="btn btn-primary" onclick="addNewAssignee()">추가</button>
        </div>
    `;
}

/**
 * Add a new assignee
 */
function addNewAssignee() {
    const input = document.getElementById('newAssigneeName');
    const name = input.value.trim();
    
    if (!name) {
        showToast('담당자 이름을 입력해주세요.', 'error');
        input.focus();
        return;
    }
    
    if (assignees.includes(name)) {
        showToast('이미 존재하는 담당자입니다.', 'error');
        return;
    }
    
    assignees.push(name);
    saveAssignees();
    updateAssigneeDropdowns();
    
    // Refresh the modal content
    document.getElementById('assigneeModalBody').innerHTML = renderAssigneeManagerContent();
    
    showToast('담당자가 추가되었습니다.', 'success');
}

/**
 * Edit assignee name
 * @param {number} index - Index of assignee in array
 */
function editAssigneeName(index) {
    const nameSpan = document.getElementById(`assignee-name-${index}`);
    const currentName = assignees[index];
    
    // Replace span with input
    nameSpan.innerHTML = `
        <input type="text" value="${escapeHtml(currentName)}" 
               style="width: 120px; padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px;"
               onkeypress="if(event.key === 'Enter') saveAssigneeEdit(${index}, this.value)"
               onblur="saveAssigneeEdit(${index}, this.value)"
               id="edit-input-${index}">
    `;
    
    // Focus the input
    document.getElementById(`edit-input-${index}`).focus();
}

/**
 * Save assignee edit
 * @param {number} index - Index of assignee in array
 * @param {string} newName - New name for assignee
 */
function saveAssigneeEdit(index, newName) {
    const trimmedName = newName.trim();
    
    if (!trimmedName) {
        showToast('담당자 이름은 비워둘 수 없습니다.', 'error');
        document.getElementById(`assigneeModalBody`).innerHTML = renderAssigneeManagerContent();
        return;
    }
    
    const oldName = assignees[index];
    
    // Check for duplicates (excluding current)
    if (assignees.some((name, i) => i !== index && name === trimmedName)) {
        showToast('이미 존재하는 담당자 이름입니다.', 'error');
        document.getElementById(`assigneeModalBody`).innerHTML = renderAssigneeManagerContent();
        return;
    }
    
    // Update assignee name
    assignees[index] = trimmedName;
    saveAssignees();
    
    // Update all tasks that had this assignee
    tasks.forEach(task => {
        if (task.assignee === oldName) {
            task.assignee = trimmedName;
        }
    });
    saveTasks();
    
    updateAssigneeDropdowns();
    renderTasks();
    
    // Refresh the modal content
    document.getElementById('assigneeModalBody').innerHTML = renderAssigneeManagerContent();
    
    showToast('담당자 이름이 수정되었습니다.', 'success');
}

/**
 * Delete assignee by name
 * @param {number} index - Index of assignee in array
 */
function deleteAssigneeByName(index) {
    const name = assignees[index];
    
    // Check if any tasks are assigned to this person
    const assignedTasks = tasks.filter(t => t.assignee === name);
    
    let confirmMessage = `정말 "${name}" 담당자를 삭제하시겠습니까?`;
    if (assignedTasks.length > 0) {
        confirmMessage += `\n\n${assignedTasks.length}개의 업무가 이 담당자에게 할당되어 있습니다.`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Remove assignee from list
    assignees.splice(index, 1);
    saveAssignees();
    
    // Clear assignee from tasks
    tasks.forEach(task => {
        if (task.assignee === name) {
            task.assignee = '';
        }
    });
    saveTasks();
    
    updateAssigneeDropdowns();
    renderTasks();
    
    // Refresh the modal content
    document.getElementById('assigneeModalBody').innerHTML = renderAssigneeManagerContent();
    
    showToast('담당자가 삭제되었습니다.', 'success');
}
