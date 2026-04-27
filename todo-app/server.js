/**
 * 경영전략그룹 Daily To do List - Backend Server
 * Node.js + Express + SQLite + WebSocket
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./todolist.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    // Tasks table
    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'in-progress',
            priority TEXT DEFAULT 'medium',
            dueDate TEXT,
            description TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )
    `);

    // Assignees table
    db.run(`
        CREATE TABLE IF NOT EXISTS assignees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    // Task assignees junction table (for multiple assignees)
    db.run(`
        CREATE TABLE IF NOT EXISTS task_assignees (
            task_id TEXT,
            assignee_name TEXT,
            PRIMARY KEY (task_id, assignee_name),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);

    // Action items table
    db.run(`
        CREATE TABLE IF NOT EXISTS action_items (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            text TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            createdAt TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);

    // Comments table
    db.run(`
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            createdAt TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);

    // Comment replies table
    db.run(`
        CREATE TABLE IF NOT EXISTS comment_replies (
            id TEXT PRIMARY KEY,
            comment_id TEXT NOT NULL,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            createdAt TEXT,
            FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
        )
    `);

    // Comment reactions table
    db.run(`
        CREATE TABLE IF NOT EXISTS comment_reactions (
            comment_id TEXT,
            emoji TEXT,
            count INTEGER DEFAULT 1,
            PRIMARY KEY (comment_id, emoji),
            FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
        )
    `);

    // Insert default assignees if empty
    db.get('SELECT COUNT(*) as count FROM assignees', (err, row) => {
        if (row && row.count === 0) {
            const defaultAssignees = ['김성욱', '김보라', '변정은', '정현찬', '김동현', '정다현'];
            defaultAssignees.forEach(name => {
                db.run('INSERT INTO assignees (name) VALUES (?)', [name]);
            });
            console.log('Default assignees added');
        }
    });
}

// Store connected clients for real-time updates
const clients = new Set();

// Send updates to all connected clients
function broadcastUpdate(event, data) {
    const message = JSON.stringify({ event, data });
    clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
}

// ========================================
// API Routes
// ========================================

// Get all tasks
app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks ORDER BY createdAt DESC', [], (err, tasks) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Get assignees, action items, and comments for each task
        const tasksWithDetails = [];
        let processed = 0;

        if (tasks.length === 0) {
            return res.json([]);
        }

        tasks.forEach((task, index) => {
            const taskObj = {
                id: task.id,
                name: task.name,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                description: task.description,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                assignees: [],
                actionItems: [],
                comments: []
            };

            // Get assignees
            db.all('SELECT assignee_name FROM task_assignees WHERE task_id = ?', [task.id], (err, assignees) => {
                if (!err) {
                    taskObj.assignees = assignees.map(a => a.assignee_name);
                }

                // Get action items
                db.all('SELECT * FROM action_items WHERE task_id = ?', [task.id], (err, items) => {
                    if (!err) {
                        taskObj.actionItems = items.map(item => ({
                            id: item.id,
                            text: item.text,
                            completed: item.completed === 1,
                            createdAt: item.createdAt
                        }));
                    }

                    // Get comments
                    db.all('SELECT * FROM comments WHERE task_id = ?', [task.id], (err, comments) => {
                        if (!err && comments) {
                            taskObj.comments = comments.map(comment => ({
                                id: comment.id,
                                author: comment.author,
                                text: comment.text,
                                createdAt: comment.createdAt,
                                replies: [],
                                reactions: {}
                            }));

                            // Get replies and reactions for each comment
                            let commentProcessed = 0;
                            if (comments.length === 0) {
                                tasksWithDetails[index] = taskObj;
                                processed++;
                                if (processed === tasks.length) {
                                    res.json(tasksWithDetails);
                                }
                                return;
                            }

                            comments.forEach((comment, cIndex) => {
                                // Get replies
                                db.all('SELECT * FROM comment_replies WHERE comment_id = ?', [comment.id], (err, replies) => {
                                    if (!err) {
                                        taskObj.comments[cIndex].replies = replies.map(r => ({
                                            id: r.id,
                                            author: r.author,
                                            text: r.text,
                                            createdAt: r.createdAt
                                        }));
                                    }

                                    // Get reactions
                                    db.all('SELECT * FROM comment_reactions WHERE comment_id = ?', [comment.id], (err, reactions) => {
                                        if (!err) {
                                            reactions.forEach(r => {
                                                taskObj.comments[cIndex].reactions[r.emoji] = r.count;
                                            });
                                        }

                                        commentProcessed++;
                                        if (commentProcessed === comments.length) {
                                            tasksWithDetails[index] = taskObj;
                                            processed++;
                                            if (processed === tasks.length) {
                                                res.json(tasksWithDetails);
                                            }
                                        }
                                    });
                                });
                            });
                        } else {
                            tasksWithDetails[index] = taskObj;
                            processed++;
                            if (processed === tasks.length) {
                                res.json(tasksWithDetails);
                            }
                        }
                    });
                });
            });
        });
    });
});

// Add a new task
app.post('/api/tasks', (req, res) => {
    const { id, name, status, priority, dueDate, description, assignees, createdAt, updatedAt } = req.body;

    db.run(
        'INSERT INTO tasks (id, name, status, priority, dueDate, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, name, status, priority, dueDate, description, createdAt, updatedAt],
        (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Add assignees
            if (assignees && assignees.length > 0) {
                assignees.forEach(assignee => {
                    db.run('INSERT INTO task_assignees (task_id, assignee_name) VALUES (?, ?)', [id, assignee]);
                });
            }

            // Broadcast update to all clients
            broadcastUpdate('taskAdded', req.body);
            res.json({ success: true, task: req.body });
        }
    );
});

// Update a task
app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { name, status, priority, dueDate, description, assignees, updatedAt } = req.body;

    db.run(
        'UPDATE tasks SET name = ?, status = ?, priority = ?, dueDate = ?, description = ?, updatedAt = ? WHERE id = ?',
        [name, status, priority, dueDate, description, updatedAt, id],
        (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Update assignees
            db.run('DELETE FROM task_assignees WHERE task_id = ?', [id], () => {
                if (assignees && assignees.length > 0) {
                    assignees.forEach(assignee => {
                        db.run('INSERT INTO task_assignees (task_id, assignee_name) VALUES (?, ?)', [id, assignee]);
                    });
                }

                // Broadcast update
                broadcastUpdate('taskUpdated', req.body);
                res.json({ success: true, task: req.body });
            });
        }
    );
});

// Delete a task
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM tasks WHERE id = ?', [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        broadcastUpdate('taskDeleted', { id });
        res.json({ success: true });
    });
});

// Add action item
app.post('/api/tasks/:taskId/action-items', (req, res) => {
    const { taskId } = req.params;
    const { id, text, completed, createdAt } = req.body;

    db.run(
        'INSERT INTO action_items (id, task_id, text, completed, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, taskId, text, completed ? 1 : 0, createdAt],
        (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            broadcastUpdate('actionItemAdded', { taskId, actionItem: req.body });
            res.json({ success: true, actionItem: req.body });
        }
    );
});

// Toggle action item
app.put('/api/action-items/:id', (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;

    db.run('UPDATE action_items SET completed = ? WHERE id = ?', [completed ? 1 : 0, id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        broadcastUpdate('actionItemUpdated', { id, completed });
        res.json({ success: true });
    });
});

// Delete action item
app.delete('/api/action-items/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM action_items WHERE id = ?', [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        broadcastUpdate('actionItemDeleted', { id });
        res.json({ success: true });
    });
});

// Add comment
app.post('/api/tasks/:taskId/comments', (req, res) => {
    const { taskId } = req.params;
    const { id, author, text, createdAt } = req.body;

    db.run(
        'INSERT INTO comments (id, task_id, author, text, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, taskId, author, text, createdAt],
        (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            broadcastUpdate('commentAdded', { taskId, comment: req.body });
            res.json({ success: true, comment: req.body });
        }
    );
});

// Add reply
app.post('/api/comments/:commentId/replies', (req, res) => {
    const { commentId } = req.params;
    const { id, author, text, createdAt } = req.body;

    db.run(
        'INSERT INTO comment_replies (id, comment_id, author, text, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, commentId, author, text, createdAt],
        (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            broadcastUpdate('replyAdded', { commentId, reply: req.body });
            res.json({ success: true, reply: req.body });
        }
    );
});

// Toggle reaction
app.post('/api/comments/:commentId/reactions', (req, res) => {
    const { commentId } = req.params;
    const { emoji } = req.body;

    db.get('SELECT * FROM comment_reactions WHERE comment_id = ? AND emoji = ?', [commentId, emoji], (err, row) => {
        if (row) {
            // Delete reaction
            db.run('DELETE FROM comment_reactions WHERE comment_id = ? AND emoji = ?', [commentId, emoji], (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                broadcastUpdate('reactionToggled', { commentId, emoji, removed: true });
                res.json({ success: true, removed: true });
            });
        } else {
            // Add reaction
            db.run(
                'INSERT INTO comment_reactions (comment_id, emoji, count) VALUES (?, ?, 1)',
                [commentId, emoji],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    broadcastUpdate('reactionToggled', { commentId, emoji, count: 1 });
                    res.json({ success: true, count: 1 });
                }
            );
        }
    });
});

// Delete comment
app.delete('/api/comments/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM comments WHERE id = ?', [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        broadcastUpdate('commentDeleted', { id });
        res.json({ success: true });
    });
});

// Get all assignees
app.get('/api/assignees', (req, res) => {
    db.all('SELECT name FROM assignees ORDER BY name', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows.map(r => r.name));
    });
});

// Add assignee
app.post('/api/assignees', (req, res) => {
    const { name } = req.body;

    db.run('INSERT INTO assignees (name) VALUES (?)', [name], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        broadcastUpdate('assigneeAdded', { name });
        res.json({ success: true, name });
    });
});

// Update assignee
app.put('/api/assignees/:oldName', (req, res) => {
    const { oldName } = req.params;
    const { newName } = req.body;

    db.run('UPDATE assignees SET name = ? WHERE name = ?', [newName, oldName], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Update task_assignees
        db.run('UPDATE task_assignees SET assignee_name = ? WHERE assignee_name = ?', [newName, oldName]);

        broadcastUpdate('assigneeUpdated', { oldName, newName });
        res.json({ success: true });
    });
});

// Delete assignee
app.delete('/api/assignees/:name', (req, res) => {
    const { name } = req.params;

    db.run('DELETE FROM assignees WHERE name = ?', [name], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        db.run('DELETE FROM task_assignees WHERE assignee_name = ?', [name]);

        broadcastUpdate('assigneeDeleted', { name });
        res.json({ success: true });
    });
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