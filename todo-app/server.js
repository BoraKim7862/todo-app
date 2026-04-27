/**
 * 경영전략그룹 Daily To do List - Backend Server
 * Node.js + Express + better-sqlite3 + WebSocket
 */

const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new Database('./todolist.db');

// Initialize database tables
function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'in-progress',
            priority TEXT DEFAULT 'medium',
            dueDate TEXT,
            description TEXT,
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS assignees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS task_assignees (
            task_id TEXT,
            assignee_name TEXT,
            PRIMARY KEY (task_id, assignee_name),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS action_items (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            text TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            createdAt TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            createdAt TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS comment_replies (
            id TEXT PRIMARY KEY,
            comment_id TEXT NOT NULL,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            createdAt TEXT,
            FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS comment_reactions (
            comment_id TEXT,
            emoji TEXT,
            count INTEGER DEFAULT 1,
            PRIMARY KEY (comment_id, emoji),
            FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
        );
    `);

    // Insert default assignees if empty
    const count = db.prepare('SELECT COUNT(*) as count FROM assignees').get();
    if (count.count === 0) {
        const defaultAssignees = ['김성욱', '김보라', '변정은', '정현찬', '김동현', '정다현'];
        const insert = db.prepare('INSERT INTO assignees (name) VALUES (?)');
        defaultAssignees.forEach(name => insert.run(name));
        console.log('Default assignees added');
    }
}

initDatabase();

// Store connected clients for real-time updates
const clients = new Set();

// Send updates to all connected clients
function broadcastUpdate(event, data) {
    const message = JSON.stringify({ event, data });
    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(message);
        }
    });
}

// ========================================
// API Routes
// ========================================

// Get all tasks
app.get('/api/tasks', (req, res) => {
    try {
        const tasks = db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all();
        const tasksWithDetails = tasks.map(task => {
            const assignees = db.prepare('SELECT assignee_name FROM task_assignees WHERE task_id = ?').all(task.id);
            const actionItems = db.prepare('SELECT * FROM action_items WHERE task_id = ?').all(task.id);
            const comments = db.prepare('SELECT * FROM comments WHERE task_id = ?').all(task.id);

            return {
                id: task.id,
                name: task.name,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                description: task.description,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                assignees: assignees.map(a => a.assignee_name),
                actionItems: actionItems.map(item => ({
                    id: item.id,
                    text: item.text,
                    completed: item.completed === 1,
                    createdAt: item.createdAt
                })),
                comments: comments.map(comment => {
                    const replies = db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').all(comment.id);
                    const reactions = db.prepare('SELECT * FROM comment_reactions WHERE comment_id = ?').all(comment.id);
                    
                    const reactionsObj = {};
                    reactions.forEach(r => { reactionsObj[r.emoji] = r.count; });

                    return {
                        id: comment.id,
                        author: comment.author,
                        text: comment.text,
                        createdAt: comment.createdAt,
                        replies: replies.map(r => ({
                            id: r.id,
                            author: r.author,
                            text: r.text,
                            createdAt: r.createdAt
                        })),
                        reactions: reactionsObj
                    };
                })
            };
        });

        res.json(tasksWithDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a new task
app.post('/api/tasks', (req, res) => {
    try {
        const { id, name, status, priority, dueDate, description, assignees, createdAt, updatedAt } = req.body;

        db.prepare('INSERT INTO tasks (id, name, status, priority, dueDate, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, name, status, priority, dueDate, description, createdAt, updatedAt);

        if (assignees && assignees.length > 0) {
            const insertAssignee = db.prepare('INSERT INTO task_assignees (task_id, assignee_name) VALUES (?, ?)');
            assignees.forEach(assignee => insertAssignee.run(id, assignee));
        }

        broadcastUpdate('taskAdded', req.body);
        res.json({ success: true, task: req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a task
app.put('/api/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, status, priority, dueDate, description, assignees, updatedAt } = req.body;

        db.prepare('UPDATE tasks SET name = ?, status = ?, priority = ?, dueDate = ?, description = ?, updatedAt = ? WHERE id = ?')
            .run(name, status, priority, dueDate, description, updatedAt, id);

        db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(id);
        
        if (assignees && assignees.length > 0) {
            const insertAssignee = db.prepare('INSERT INTO task_assignees (task_id, assignee_name) VALUES (?, ?)');
            assignees.forEach(assignee => insertAssignee.run(id, assignee));
        }

        broadcastUpdate('taskUpdated', req.body);
        res.json({ success: true, task: req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a task
app.delete('/api/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        broadcastUpdate('taskDeleted', { id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add action item
app.post('/api/tasks/:taskId/action-items', (req, res) => {
    try {
        const { taskId } = req.params;
        const { id, text, completed, createdAt } = req.body;

        db.prepare('INSERT INTO action_items (id, task_id, text, completed, createdAt) VALUES (?, ?, ?, ?, ?)')
            .run(id, taskId, text, completed ? 1 : 0, createdAt);

        broadcastUpdate('actionItemAdded', { taskId, actionItem: req.body });
        res.json({ success: true, actionItem: req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle action item
app.put('/api/action-items/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { completed } = req.body;

        db.prepare('UPDATE action_items SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
        broadcastUpdate('actionItemUpdated', { id, completed });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete action item
app.delete('/api/action-items/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM action_items WHERE id = ?').run(id);
        broadcastUpdate('actionItemDeleted', { id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add comment
app.post('/api/tasks/:taskId/comments', (req, res) => {
    try {
        const { taskId } = req.params;
        const { id, author, text, createdAt } = req.body;

        db.prepare('INSERT INTO comments (id, task_id, author, text, createdAt) VALUES (?, ?, ?, ?, ?)')
            .run(id, taskId, author, text, createdAt);

        broadcastUpdate('commentAdded', { taskId, comment: req.body });
        res.json({ success: true, comment: req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add reply
app.post('/api/comments/:commentId/replies', (req, res) => {
    try {
        const { commentId } = req.params;
        const { id, author, text, createdAt } = req.body;

        db.prepare('INSERT INTO comment_replies (id, comment_id, author, text, createdAt) VALUES (?, ?, ?, ?, ?)')
            .run(id, commentId, author, text, createdAt);

        broadcastUpdate('replyAdded', { commentId, reply: req.body });
        res.json({ success: true, reply: req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle reaction
app.post('/api/comments/:commentId/reactions', (req, res) => {
    try {
        const { commentId } = req.params;
        const { emoji } = req.body;

        const existing = db.prepare('SELECT * FROM comment_reactions WHERE comment_id = ? AND emoji = ?').get(commentId, emoji);

        if (existing) {
            db.prepare('DELETE FROM comment_reactions WHERE comment_id = ? AND emoji = ?').run(commentId, emoji);
            broadcastUpdate('reactionToggled', { commentId, emoji, removed: true });
            res.json({ success: true, removed: true });
        } else {
            db.prepare('INSERT INTO comment_reactions (comment_id, emoji, count) VALUES (?, ?, 1)').run(commentId, emoji);
            broadcastUpdate('reactionToggled', { commentId, emoji, count: 1 });
            res.json({ success: true, count: 1 });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete comment
app.delete('/api/comments/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM comments WHERE id = ?').run(id);
        broadcastUpdate('commentDeleted', { id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all assignees
app.get('/api/assignees', (req, res) => {
    try {
        const rows = db.prepare('SELECT name FROM assignees ORDER BY name').all();
        res.json(rows.map(r => r.name));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add assignee
app.post('/api/assignees', (req, res) => {
    try {
        const { name } = req.body;
        db.prepare('INSERT INTO assignees (name) VALUES (?)').run(name);
        broadcastUpdate('assigneeAdded', { name });
        res.json({ success: true, name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update assignee
app.put('/api/assignees/:oldName', (req, res) => {
    try {
        const { oldName } = req.params;
        const { newName } = req.body;

        db.prepare('UPDATE assignees SET name = ? WHERE name = ?').run(newName, oldName);
        db.prepare('UPDATE task_assignees SET assignee_name = ? WHERE assignee_name = ?').run(newName, oldName);

        broadcastUpdate('assigneeUpdated', { oldName, newName });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete assignee
app.delete('/api/assignees/:name', (req, res) => {
    try {
        const { name } = req.params;

        db.prepare('DELETE FROM assignees WHERE name = ?').run(name);
        db.prepare('DELETE FROM task_assignees WHERE assignee_name = ?').run(name);

        broadcastUpdate('assigneeDeleted', { name });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// WebSocket server for real-time updates
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New client connected');
    clients.add(ws);

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close();
    server.close();
    process.exit();
});