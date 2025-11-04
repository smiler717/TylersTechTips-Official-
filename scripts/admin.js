/**
 * Admin Dashboard Script
 * Manages admin interface for user management, content moderation, audit logs, and analytics
 */

const ADMIN_KEY = prompt('Enter admin key:');
if (!ADMIN_KEY) {
    alert('Admin key required');
    window.location.href = 'index.html';
}

// Tab switching
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Update tabs
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update panels
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        const panelId = `panel-${tab.dataset.panel}`;
        document.getElementById(panelId).classList.add('active');
        
        // Load data for panel
        loadPanelData(tab.dataset.panel);
    });
});

// Load stats on page load
loadStats();
loadPanelData('users');
checkEmailHealth();

// Health re-test
document.getElementById('health-retest')?.addEventListener('click', () => {
    checkEmailHealth(true);
});

/**
 * Check email delivery health by invoking the admin test endpoint.
 * Note: This will send one test message to MAIL_TO_FEEDBACK.
 */
async function checkEmailHealth(force = false) {
    const badge = document.getElementById('health-email');
    if (!badge) return;
    try {
        badge.className = 'badge badge-warning';
        badge.textContent = 'Email: checking…';
        const res = await fetch('/api/feedback?action=test-email' + (force ? '&force=1' : ''), {
            headers: { 'x-admin-key': ADMIN_KEY }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.email?.sent) {
            badge.className = 'badge badge-success';
            badge.textContent = 'Email: OK';
        } else {
            badge.className = 'badge badge-danger';
            const reason = data?.email?.reason || data?.email?.status || res.status || 'error';
            badge.textContent = `Email: fail (${reason})`;
        }
    } catch (e) {
        badge.className = 'badge badge-danger';
        badge.textContent = 'Email: error';
        console.error('Email health check error:', e);
    }
}

/**
 * Load overall statistics
 */
async function loadStats() {
    try {
        // Load user count
        const usersRes = await fetch('/api/admin/stats/users', {
            headers: { 'x-admin-key': ADMIN_KEY }
        });
        if (usersRes.ok) {
            const data = await usersRes.json();
            document.getElementById('stat-users').textContent = data.total || 0;
        }

        // Load topic count
        const topicsRes = await fetch('/api/topics?limit=1');
        if (topicsRes.ok) {
            const data = await topicsRes.json();
            document.getElementById('stat-topics').textContent = data.topics?.length > 0 ? '...' : 0;
        }

        // These endpoints would need to be created for full functionality
        document.getElementById('stat-comments').textContent = '...';
        document.getElementById('stat-reports').textContent = '0';
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

/**
 * Load panel-specific data
 */
function loadPanelData(panel) {
    switch(panel) {
        case 'users':
            loadUsers();
            break;
        case 'content':
            loadContent();
            break;
        case 'reports':
            loadReports();
            break;
        case 'audit':
            loadAuditLogs();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

/**
 * Load users table
 */
async function loadUsers(page = 0) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';

    try {
        const response = await fetch(`/api/admin/users?limit=20&offset=${page * 20}`, {
            headers: { 'x-admin-key': ADMIN_KEY }
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        const users = data.users || [];

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td><strong>${escapeHtml(user.username)}</strong></td>
                <td>${escapeHtml(user.email)}</td>
                <td>${user.email_verified ? '<span class="badge badge-success">Verified</span>' : '<span class="badge badge-warning">Unverified</span>'}</td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <button onclick="viewUser(${user.id})" class="action-btn btn-primary">View</button>
                    <button onclick="deleteUser(${user.id})" class="action-btn btn-danger">Delete</button>
                </td>
            </tr>
        `).join('');

        renderPagination('users-pagination', page, data.total, 20, loadUsers);
    } catch (error) {
        console.error('Load users error:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading users</td></tr>';
    }
}

/**
 * Load content table
 */
async function loadContent(page = 0) {
    const tbody = document.getElementById('content-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';

    try {
        const response = await fetch(`/api/topics?limit=20&offset=${page * 20}`);
        if (!response.ok) throw new Error('Failed to load topics');

        const data = await response.json();
        const topics = data.topics || [];

        if (topics.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No topics found</td></tr>';
            return;
        }

        tbody.innerHTML = topics.map(topic => `
            <tr>
                <td><strong>${escapeHtml(topic.title)}</strong></td>
                <td>${escapeHtml(topic.author || 'Unknown')}</td>
                <td><span class="badge badge-info">${escapeHtml(topic.category || 'General')}</span></td>
                <td>${topic.comments?.length || 0}</td>
                <td>${formatDate(topic.createdAt)}</td>
                <td>
                    <button onclick="viewTopic('${topic.id}')" class="action-btn btn-primary">View</button>
                    <button onclick="deleteTopic('${topic.id}')" class="action-btn btn-danger">Delete</button>
                </td>
            </tr>
        `).join('');

        renderPagination('content-pagination', page, 100, 20, loadContent);
    } catch (error) {
        console.error('Load content error:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading content</td></tr>';
    }
}

/**
 * Load reports table
 */
async function loadReports() {
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No reports found</td></tr>';
    // This would need a /api/admin/reports endpoint
}

/**
 * Load audit logs
 */
async function loadAuditLogs(page = 0) {
    const tbody = document.getElementById('audit-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading...</td></tr>';

    const userId = document.getElementById('audit-user')?.value || '';
    const action = document.getElementById('audit-action')?.value || '';
    
    try {
        let url = `/api/admin/audit-logs?limit=50&offset=${page * 50}`;
        if (userId) url += `&userId=${userId}`;
        if (action) url += `&action=${action}`;

        const response = await fetch(url, {
            headers: { 'x-admin-key': ADMIN_KEY }
        });

        if (!response.ok) throw new Error('Failed to load audit logs');

        const data = await response.json();
        const logs = data.logs || [];

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No audit logs found</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${formatDateTime(log.created_at)}</td>
                <td>${log.user_id || 'System'}</td>
                <td><span class="badge badge-info">${escapeHtml(log.action)}</span></td>
                <td>${log.resource_type ? `${log.resource_type}:${log.resource_id}` : '-'}</td>
                <td>${escapeHtml(log.ip_address || 'unknown')}</td>
            </tr>
        `).join('');

        renderPagination('audit-pagination', page, data.total, 50, loadAuditLogs);
    } catch (error) {
        console.error('Load audit logs error:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Error loading audit logs</td></tr>';
    }
}

/**
 * Load analytics
 */
function loadAnalytics() {
    // Placeholder for analytics charts
    // Would integrate with a charting library like Chart.js
    console.log('Analytics loading...');
}

/**
 * Load settings
 */
async function loadSettings() {
    try {
        const response = await fetch('/api/admin/migrate', {
            headers: { 'x-admin-key': ADMIN_KEY }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('migration-version').textContent = data.current || 0;
            document.getElementById('migration-latest').textContent = data.latest || 0;
        }
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

/**
 * Run database migrations
 */
async function runMigrations() {
    const btn = document.getElementById('migration-btn');
    const resultDiv = document.getElementById('migration-result');
    
    btn.disabled = true;
    btn.textContent = 'Running...';
    resultDiv.innerHTML = '<p style="color: var(--secondary-text);">Running migrations...</p>';

    try {
        const response = await fetch('/api/admin/migrate', {
            method: 'POST',
            headers: { 'x-admin-key': ADMIN_KEY }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <p style="color: #28a745;">✓ Migrations completed successfully!</p>
                <p style="color: var(--secondary-text);">${data.message}</p>
                ${data.results ? `<pre>${JSON.stringify(data.results, null, 2)}</pre>` : ''}
            `;
        } else {
            resultDiv.innerHTML = `<p style="color: #dc3545;">✗ Migration failed: ${data.error || data.message}</p>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<p style="color: #dc3545;">✗ Error: ${error.message}</p>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-database"></i> Run Migrations';
    }
}

/**
 * Send system notification
 */
async function sendSystemNotification() {
    const message = document.getElementById('notification-message').value;
    if (!message) {
        alert('Please enter a notification message');
        return;
    }

    try {
        const response = await fetch('/api/admin/system-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-key': ADMIN_KEY
            },
            body: JSON.stringify({
                title: 'System Announcement',
                body: message
            })
        });

        if (response.ok) {
            alert('Notification sent to all users!');
            document.getElementById('notification-message').value = '';
        } else {
            alert('Failed to send notification');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

/**
 * Delete user (with confirmation)
 */
async function deleteUser(userId) {
    if (!confirm(`Delete user ${userId}? This action cannot be undone.`)) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'x-admin-key': ADMIN_KEY }
        });

        if (response.ok) {
            alert('User deleted successfully');
            loadUsers();
        } else {
            alert('Failed to delete user');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

/**
 * Delete topic
 */
async function deleteTopic(topicId) {
    if (!confirm('Delete this topic and all its comments? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/api/topics/${topicId}`, {
            method: 'DELETE',
            headers: { 'x-admin-key': ADMIN_KEY }
        });

        if (response.ok) {
            alert('Topic deleted successfully');
            loadContent();
        } else {
            alert('Failed to delete topic');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

/**
 * View user details
 */
function viewUser(userId) {
    // Would open a modal or new page with user details
    alert(`View user ${userId} - Feature coming soon`);
}

/**
 * View topic
 */
function viewTopic(topicId) {
    window.open(`community.html?topic=${topicId}`, '_blank');
}

/**
 * Render pagination controls
 */
function renderPagination(containerId, currentPage, total, perPage, loadFunction) {
    const container = document.getElementById(containerId);
    const totalPages = Math.ceil(total / perPage);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button ${currentPage === 0 ? 'disabled' : ''} onclick="${loadFunction.name}(${currentPage - 1})">Previous</button>`;
    
    for (let i = 0; i < Math.min(totalPages, 5); i++) {
        const page = i;
        html += `<button class="${page === currentPage ? 'active' : ''}" onclick="${loadFunction.name}(${page})">${page + 1}</button>`;
    }
    
    html += `<button ${currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="${loadFunction.name}(${currentPage + 1})">Next</button>`;
    
    container.innerHTML = html;
}

/**
 * Utility functions
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString();
}

function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString();
}
