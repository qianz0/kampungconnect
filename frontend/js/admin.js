/**
 * Admin Dashboard Manager
 * Handles all admin operations including data viewing, filtering, and management
 */
class AdminDashboard {
    constructor() {
        this.adminServiceUrl = 'http://localhost:5007';
        this.currentTab = 'users';
        this.currentPage = {
            users: 1,
            requests: 1,
            matches: 1,
            ratings: 1
        };
        this.filters = {
            users: {},
            requests: {},
            matches: {},
            ratings: {}
        };
        this.sortConfig = {
            users: { column: 'created_at', order: 'DESC' },
            requests: { column: 'created_at', order: 'DESC' },
            matches: { column: 'matched_at', order: 'DESC' },
            ratings: { column: 'created_at', order: 'DESC' }
        };
    }

    /**
     * Initialize the admin dashboard
     */
    async init() {
        console.log('[AdminDashboard] Initializing...');
        
        // Set up tab switching
        this.setupTabs();
        
        // Load initial data
        await this.loadStats();
        await this.loadUsers();
        
        console.log('[AdminDashboard] Initialized successfully');
    }

    /**
     * Set up tab switching functionality
     */
    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs and content
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Show corresponding content
                const tabName = tab.dataset.tab;
                this.currentTab = tabName;
                document.getElementById(`${tabName}Tab`).classList.add('active');
                
                // Load data for the tab
                this.loadTabData(tabName);
            });
        });
    }

    /**
     * Load data for specific tab
     */
    async loadTabData(tabName) {
        switch(tabName) {
            case 'users':
                await this.loadUsers();
                break;
            case 'requests':
                await this.loadRequests();
                break;
            case 'matches':
                await this.loadMatches();
                break;
            case 'ratings':
                await this.loadRatings();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
        }
    }

    /**
     * Load dashboard statistics
     */
    async loadStats() {
        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/stats/overview`
            );
            const stats = await response.json();

            document.getElementById('totalUsers').textContent = stats.total_users || 0;
            document.getElementById('totalRequests').textContent = stats.total_requests || 0;
            document.getElementById('pendingRequests').textContent = stats.pending_requests || 0;
            document.getElementById('activeMatches').textContent = stats.active_matches || 0;
            document.getElementById('avgRating').textContent = stats.average_rating 
                ? parseFloat(stats.average_rating).toFixed(2) 
                : 'N/A';
        } catch (error) {
            console.error('[AdminDashboard] Error loading stats:', error);
        }
    }

    /**
     * Load users with current filters and pagination
     */
    async loadUsers(page = 1) {
        try {
            const container = document.getElementById('usersTableContainer');
            container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Loading...</div>';

            const params = new URLSearchParams({
                page,
                limit: 50,
                sort_by: this.sortConfig.users.column,
                sort_order: this.sortConfig.users.order,
                ...this.filters.users
            });

            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/users?${params}`
            );
            const data = await response.json();

            this.renderUsersTable(data.users, data.pagination);
            this.currentPage.users = page;
        } catch (error) {
            console.error('[AdminDashboard] Error loading users:', error);
            document.getElementById('usersTableContainer').innerHTML = 
                '<div class="error">Failed to load users. Please try again.</div>';
        }
    }

    /**
     * Render users table
     */
    renderUsersTable(users, pagination) {
        const container = document.getElementById('usersTableContainer');
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="loading">No users found.</div>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th onclick="adminDashboard.sortUsers('id')">
                            ID <i class="fas fa-sort sort-icon"></i>
                        </th>
                        <th onclick="adminDashboard.sortUsers('email')">
                            Email <i class="fas fa-sort sort-icon"></i>
                        </th>
                        <th onclick="adminDashboard.sortUsers('firstName')">
                            Name <i class="fas fa-sort sort-icon"></i>
                        </th>
                        <th onclick="adminDashboard.sortUsers('role')">
                            Role <i class="fas fa-sort sort-icon"></i>
                        </th>
                        <th onclick="adminDashboard.sortUsers('provider')">
                            Provider <i class="fas fa-sort sort-icon"></i>
                        </th>
                        <th>Status</th>
                        <th onclick="adminDashboard.sortUsers('created_at')">
                            Created <i class="fas fa-sort sort-icon"></i>
                        </th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach(user => {
            html += `
                <tr>
                    <td>${user.id}</td>
                    <td>${this.escapeHtml(user.email)}</td>
                    <td>${this.escapeHtml(user.firstname || '')} ${this.escapeHtml(user.lastname || '')}</td>
                    <td><span class="badge ${user.role}">${user.role || 'N/A'}</span></td>
                    <td>${user.provider}</td>
                    <td>
                        <span class="badge ${user.is_active ? 'active' : 'cancelled'}">
                            ${user.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon btn-view" onclick="adminDashboard.viewUser(${user.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon btn-edit" 
                                onclick="adminDashboard.toggleUserStatus(${user.id}, ${!user.is_active})">
                                <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        html += this.renderPagination(pagination, 'users');

        container.innerHTML = html;
    }

    /**
     * Load requests with current filters and pagination
     */
    async loadRequests(page = 1) {
        try {
            const container = document.getElementById('requestsTableContainer');
            container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Loading...</div>';

            const params = new URLSearchParams({
                page,
                limit: 50,
                sort_by: this.sortConfig.requests.column,
                sort_order: this.sortConfig.requests.order,
                ...this.filters.requests
            });

            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/requests?${params}`
            );
            const data = await response.json();

            this.renderRequestsTable(data.requests, data.pagination);
            this.currentPage.requests = page;
        } catch (error) {
            console.error('[AdminDashboard] Error loading requests:', error);
            document.getElementById('requestsTableContainer').innerHTML = 
                '<div class="error">Failed to load requests. Please try again.</div>';
        }
    }

    /**
     * Render requests table
     */
    renderRequestsTable(requests, pagination) {
        const container = document.getElementById('requestsTableContainer');
        
        if (!requests || requests.length === 0) {
            container.innerHTML = '<div class="loading">No requests found.</div>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Urgency</th>
                        <th>Status</th>
                        <th>Requester</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        requests.forEach(req => {
            html += `
                <tr>
                    <td>${req.id}</td>
                    <td>${this.escapeHtml(req.title || 'N/A')}</td>
                    <td>${req.category || 'N/A'}</td>
                    <td><span class="badge ${req.urgency}">${req.urgency}</span></td>
                    <td><span class="badge ${req.status}">${req.status}</span></td>
                    <td>${this.escapeHtml(req.user_firstname || '')} ${this.escapeHtml(req.user_lastname || '')}</td>
                    <td>${new Date(req.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon btn-view" onclick="adminDashboard.viewRequest(${req.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        html += this.renderPagination(pagination, 'requests');

        container.innerHTML = html;
    }

    /**
     * Load matches with current filters and pagination
     */
    async loadMatches(page = 1) {
        try {
            const container = document.getElementById('matchesTableContainer');
            container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Loading...</div>';

            const params = new URLSearchParams({
                page,
                limit: 50,
                sort_by: this.sortConfig.matches.column,
                sort_order: this.sortConfig.matches.order,
                ...this.filters.matches
            });

            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/matches?${params}`
            );
            const data = await response.json();

            this.renderMatchesTable(data.matches, data.pagination);
            this.currentPage.matches = page;
        } catch (error) {
            console.error('[AdminDashboard] Error loading matches:', error);
            document.getElementById('matchesTableContainer').innerHTML = 
                '<div class="error">Failed to load matches. Please try again.</div>';
        }
    }

    /**
     * Render matches table
     */
    renderMatchesTable(matches, pagination) {
        const container = document.getElementById('matchesTableContainer');
        
        if (!matches || matches.length === 0) {
            container.innerHTML = '<div class="loading">No matches found.</div>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Request</th>
                        <th>Category</th>
                        <th>Requester</th>
                        <th>Helper</th>
                        <th>Status</th>
                        <th>Matched At</th>
                    </tr>
                </thead>
                <tbody>
        `;

        matches.forEach(match => {
            html += `
                <tr>
                    <td>${match.id}</td>
                    <td>${this.escapeHtml(match.request_title || 'N/A')}</td>
                    <td>${match.request_category || 'N/A'}</td>
                    <td>${this.escapeHtml(match.requester_firstname || '')} ${this.escapeHtml(match.requester_lastname || '')}</td>
                    <td>${this.escapeHtml(match.helper_firstname || '')} ${this.escapeHtml(match.helper_lastname || '')}</td>
                    <td><span class="badge ${match.status}">${match.status}</span></td>
                    <td>${new Date(match.matched_at).toLocaleDateString()}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        html += this.renderPagination(pagination, 'matches');

        container.innerHTML = html;
    }

    /**
     * Load ratings with current filters and pagination
     */
    async loadRatings(page = 1) {
        try {
            const container = document.getElementById('ratingsTableContainer');
            container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Loading...</div>';

            const params = new URLSearchParams({
                page,
                limit: 50,
                sort_by: this.sortConfig.ratings.column,
                sort_order: this.sortConfig.ratings.order,
                ...this.filters.ratings
            });

            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/ratings?${params}`
            );
            const data = await response.json();

            this.renderRatingsTable(data.ratings, data.pagination);
            this.currentPage.ratings = page;
        } catch (error) {
            console.error('[AdminDashboard] Error loading ratings:', error);
            document.getElementById('ratingsTableContainer').innerHTML = 
                '<div class="error">Failed to load ratings. Please try again.</div>';
        }
    }

    /**
     * Render ratings table
     */
    renderRatingsTable(ratings, pagination) {
        const container = document.getElementById('ratingsTableContainer');
        
        if (!ratings || ratings.length === 0) {
            container.innerHTML = '<div class="loading">No ratings found.</div>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Rater</th>
                        <th>Rated User</th>
                        <th>Score</th>
                        <th>Comment</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
        `;

        ratings.forEach(rating => {
            const stars = '⭐'.repeat(rating.score);
            html += `
                <tr>
                    <td>${rating.id}</td>
                    <td>${this.escapeHtml(rating.rater_firstname || '')} ${this.escapeHtml(rating.rater_lastname || '')}</td>
                    <td>${this.escapeHtml(rating.ratee_firstname || '')} ${this.escapeHtml(rating.ratee_lastname || '')}</td>
                    <td>${stars} (${rating.score})</td>
                    <td>${this.escapeHtml(rating.comment || 'No comment')}</td>
                    <td>${new Date(rating.created_at).toLocaleDateString()}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        html += this.renderPagination(pagination, 'ratings');

        container.innerHTML = html;
    }

    /**
     * Load analytics data
     */
    async loadAnalytics() {
        try {
            // Load urgency distribution
            const urgencyResponse = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/stats/urgency-distribution`
            );
            const urgencyData = await urgencyResponse.json();
            this.renderUrgencyChart(urgencyData);

            // Load category distribution
            const categoryResponse = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/stats/category-distribution`
            );
            const categoryData = await categoryResponse.json();
            this.renderCategoryChart(categoryData);

            // Load activity timeline
            const activityResponse = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/stats/activity-timeline`
            );
            const activityData = await activityResponse.json();
            this.renderActivityChart(activityData);

            // Load additional charts
            await this.loadRoleDistribution();
            await this.loadStatusDistribution();
            await this.loadRatingDistribution();
        } catch (error) {
            console.error('[AdminDashboard] Error loading analytics:', error);
        }
    }

    /**
     * Load role distribution
     */
    async loadRoleDistribution() {
        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/stats/role-distribution`
            );
            const data = await response.json();
            this.renderRoleChart(data);
        } catch (error) {
            console.error('[AdminDashboard] Error loading role distribution:', error);
        }
    }

    /**
     * Load status distribution
     */
    async loadStatusDistribution() {
        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/stats/status-distribution`
            );
            const data = await response.json();
            this.renderStatusChart(data);
        } catch (error) {
            console.error('[AdminDashboard] Error loading status distribution:', error);
        }
    }

    /**
     * Load rating distribution
     */
    async loadRatingDistribution() {
        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/stats/rating-distribution`
            );
            const data = await response.json();
            this.renderRatingDistChart(data);
        } catch (error) {
            console.error('[AdminDashboard] Error loading rating distribution:', error);
        }
    }

    /**
     * Refresh all data
     */
    async refreshAllData() {
        console.log('[AdminDashboard] Refreshing all data...');
        await this.loadStats();
        await this.loadTabData(this.currentTab);
        console.log('[AdminDashboard] Data refreshed');
    }

    /**
     * Render urgency distribution chart
     */
    renderUrgencyChart(data) {
        const ctx = document.getElementById('urgencyChart');
        if (this.urgencyChart) {
            this.urgencyChart.destroy();
        }

        this.urgencyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.urgency.toUpperCase()),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: [
                        '#dc3545',  // Urgent - Red
                        '#ffc107',  // High - Yellow
                        '#17a2b8',  // Medium - Cyan
                        '#28a745'   // Low - Green
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12,
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render category distribution chart
     */
    renderCategoryChart(data) {
        const ctx = document.getElementById('categoryChart');
        if (this.categoryChart) {
            this.categoryChart.destroy();
        }

        this.categoryChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.category || 'N/A'),
                datasets: [{
                    label: 'Requests by Category',
                    data: data.map(d => d.count),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: '#667eea',
                    borderWidth: 2,
                    borderRadius: 8,
                    hoverBackgroundColor: 'rgba(102, 126, 234, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    /**
     * Render activity timeline chart
     */
    renderActivityChart(data) {
        const ctx = document.getElementById('activityChart');
        if (this.activityChart) {
            this.activityChart.destroy();
        }

        this.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Requests Created',
                    data: data.map(d => d.requests_count),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    /**
     * Render role distribution chart
     */
    renderRoleChart(data) {
        const ctx = document.getElementById('roleChart');
        if (this.roleChart) {
            this.roleChart.destroy();
        }

        this.roleChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map(d => d.role.toUpperCase()),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: [
                        '#667eea',  // Primary
                        '#764ba2',  // Secondary
                        '#28a745',  // Success
                        '#dc3545'   // Danger
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12,
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render status distribution chart
     */
    renderStatusChart(data) {
        const ctx = document.getElementById('statusChart');
        if (this.statusChart) {
            this.statusChart.destroy();
        }

        this.statusChart = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: data.map(d => d.status.toUpperCase()),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: [
                        'rgba(255, 193, 7, 0.8)',   // Pending - Yellow
                        'rgba(23, 162, 184, 0.8)',  // Matched - Cyan
                        'rgba(40, 167, 69, 0.8)',   // Completed - Green
                        'rgba(220, 53, 69, 0.8)'    // Cancelled - Red
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12,
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render rating distribution chart
     */
    renderRatingDistChart(data) {
        const ctx = document.getElementById('ratingDistChart');
        if (this.ratingDistChart) {
            this.ratingDistChart.destroy();
        }

        this.ratingDistChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
                datasets: [{
                    label: 'Number of Ratings',
                    data: [1, 2, 3, 4, 5].map(score => {
                        const item = data.find(d => d.score === score);
                        return item ? item.count : 0;
                    }),
                    backgroundColor: [
                        'rgba(220, 53, 69, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(23, 162, 184, 0.8)',
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(102, 126, 234, 0.8)'
                    ],
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    /**
     * Render pagination controls
     */
    renderPagination(pagination, type) {
        if (!pagination) return '';

        const { page, totalPages } = pagination;
        
        return `
            <div class="pagination">
                <button ${page === 1 ? 'disabled' : ''} 
                    onclick="adminDashboard.load${type.charAt(0).toUpperCase() + type.slice(1)}(${page - 1})">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span class="page-info">Page ${page} of ${totalPages}</span>
                <button ${page === totalPages ? 'disabled' : ''} 
                    onclick="adminDashboard.load${type.charAt(0).toUpperCase() + type.slice(1)}(${page + 1})">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    /**
     * Apply user filters
     */
    applyUserFilters() {
        this.filters.users = {
            search: document.getElementById('userSearch').value,
            role: document.getElementById('userRoleFilter').value,
            provider: document.getElementById('userProviderFilter').value,
            is_active: document.getElementById('userStatusFilter').value
        };
        
        // Remove empty filters
        Object.keys(this.filters.users).forEach(key => {
            if (!this.filters.users[key]) delete this.filters.users[key];
        });

        this.loadUsers(1);
    }

    /**
     * Reset user filters
     */
    resetUserFilters() {
        document.getElementById('userSearch').value = '';
        document.getElementById('userRoleFilter').value = '';
        document.getElementById('userProviderFilter').value = '';
        document.getElementById('userStatusFilter').value = '';
        this.filters.users = {};
        this.loadUsers(1);
    }

    /**
     * Apply request filters
     */
    applyRequestFilters() {
        this.filters.requests = {
            search: document.getElementById('requestSearch').value,
            status: document.getElementById('requestStatusFilter').value,
            urgency: document.getElementById('requestUrgencyFilter').value,
            category: document.getElementById('requestCategoryFilter').value
        };
        
        Object.keys(this.filters.requests).forEach(key => {
            if (!this.filters.requests[key]) delete this.filters.requests[key];
        });

        this.loadRequests(1);
    }

    /**
     * Reset request filters
     */
    resetRequestFilters() {
        document.getElementById('requestSearch').value = '';
        document.getElementById('requestStatusFilter').value = '';
        document.getElementById('requestUrgencyFilter').value = '';
        document.getElementById('requestCategoryFilter').value = '';
        this.filters.requests = {};
        this.loadRequests(1);
    }

    /**
     * Apply match filters
     */
    applyMatchFilters() {
        this.filters.matches = {
            status: document.getElementById('matchStatusFilter').value
        };
        
        Object.keys(this.filters.matches).forEach(key => {
            if (!this.filters.matches[key]) delete this.filters.matches[key];
        });

        this.loadMatches(1);
    }

    /**
     * Reset match filters
     */
    resetMatchFilters() {
        document.getElementById('matchStatusFilter').value = '';
        this.filters.matches = {};
        this.loadMatches(1);
    }

    /**
     * Apply rating filters
     */
    applyRatingFilters() {
        this.filters.ratings = {
            min_score: document.getElementById('ratingMinFilter').value,
            max_score: document.getElementById('ratingMaxFilter').value
        };
        
        Object.keys(this.filters.ratings).forEach(key => {
            if (!this.filters.ratings[key]) delete this.filters.ratings[key];
        });

        this.loadRatings(1);
    }

    /**
     * Reset rating filters
     */
    resetRatingFilters() {
        document.getElementById('ratingMinFilter').value = '';
        document.getElementById('ratingMaxFilter').value = '';
        this.filters.ratings = {};
        this.loadRatings(1);
    }

    /**
     * Sort users by column
     */
    sortUsers(column) {
        if (this.sortConfig.users.column === column) {
            this.sortConfig.users.order = this.sortConfig.users.order === 'ASC' ? 'DESC' : 'ASC';
        } else {
            this.sortConfig.users.column = column;
            this.sortConfig.users.order = 'ASC';
        }
        this.loadUsers(this.currentPage.users);
    }

    /**
     * View user details
     */
    async viewUser(userId) {
        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/users/${userId}`
            );
            const data = await response.json();

            const content = document.getElementById('userDetailContent');
            content.innerHTML = `
                <div class="detail-row">
                    <div class="detail-label">ID:</div>
                    <div class="detail-value">${data.user.id}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Email:</div>
                    <div class="detail-value">${this.escapeHtml(data.user.email)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Name:</div>
                    <div class="detail-value">${this.escapeHtml(data.user.firstname || '')} ${this.escapeHtml(data.user.lastname || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Role:</div>
                    <div class="detail-value"><span class="badge ${data.user.role}">${data.user.role}</span></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Provider:</div>
                    <div class="detail-value">${data.user.provider}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Rating:</div>
                    <div class="detail-value">${data.user.rating ? parseFloat(data.user.rating).toFixed(2) : 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Location:</div>
                    <div class="detail-value">${this.escapeHtml(data.user.location || 'N/A')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Active:</div>
                    <div class="detail-value"><span class="badge ${data.user.is_active ? 'active' : 'cancelled'}">${data.user.is_active ? 'Yes' : 'No'}</span></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Email Verified:</div>
                    <div class="detail-value">${data.user.email_verified ? 'Yes' : 'No'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Created:</div>
                    <div class="detail-value">${new Date(data.user.created_at).toLocaleString()}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Last Login:</div>
                    <div class="detail-value">${data.user.last_login ? new Date(data.user.last_login).toLocaleString() : 'N/A'}</div>
                </div>
                <h4 style="margin-top: 20px;">Requests (${data.requests.length})</h4>
                <p>${data.requests.length === 0 ? 'No requests' : data.requests.map(r => r.title || 'Untitled').join(', ')}</p>
                <h4 style="margin-top: 20px;">Matches (${data.matches.length})</h4>
                <p>${data.matches.length === 0 ? 'No matches' : data.matches.length + ' match(es)'}</p>
                <h4 style="margin-top: 20px;">Ratings Received (${data.ratings.length})</h4>
                <p>${data.ratings.length === 0 ? 'No ratings' : 'Average: ' + (data.ratings.reduce((sum, r) => sum + r.score, 0) / data.ratings.length).toFixed(2)}</p>
            `;

            this.openModal('userModal');
        } catch (error) {
            console.error('[AdminDashboard] Error viewing user:', error);
            alert('Failed to load user details');
        }
    }

    /**
     * View request details
     */
    async viewRequest(requestId) {
        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/requests/${requestId}`
            );
            const data = await response.json();

            const content = document.getElementById('requestDetailContent');
            content.innerHTML = `
                <div class="detail-row">
                    <div class="detail-label">ID:</div>
                    <div class="detail-value">${data.request.id}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Title:</div>
                    <div class="detail-value">${this.escapeHtml(data.request.title || 'N/A')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Category:</div>
                    <div class="detail-value">${data.request.category || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Description:</div>
                    <div class="detail-value">${this.escapeHtml(data.request.description || 'N/A')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Urgency:</div>
                    <div class="detail-value"><span class="badge ${data.request.urgency}">${data.request.urgency}</span></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value"><span class="badge ${data.request.status}">${data.request.status}</span></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Requester:</div>
                    <div class="detail-value">${this.escapeHtml(data.request.user_firstname || '')} ${this.escapeHtml(data.request.user_lastname || '')} (${this.escapeHtml(data.request.user_email)})</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Location:</div>
                    <div class="detail-value">${this.escapeHtml(data.request.user_location || 'N/A')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Created:</div>
                    <div class="detail-value">${new Date(data.request.created_at).toLocaleString()}</div>
                </div>
                <h4 style="margin-top: 20px;">Matches (${data.matches.length})</h4>
                ${data.matches.length === 0 ? '<p>No matches</p>' : data.matches.map(m => `
                    <p>Helper: ${this.escapeHtml(m.helper_firstname)} ${this.escapeHtml(m.helper_lastname)} - Status: ${m.status}</p>
                `).join('')}
                <h4 style="margin-top: 20px;">Responses (${data.responses.length})</h4>
                ${data.responses.length === 0 ? '<p>No responses</p>' : data.responses.map(r => `
                    <p>${this.escapeHtml(r.responder_firstname)} ${this.escapeHtml(r.responder_lastname)}: ${this.escapeHtml(r.message)}</p>
                `).join('')}
            `;

            this.openModal('requestModal');
        } catch (error) {
            console.error('[AdminDashboard] Error viewing request:', error);
            alert('Failed to load request details');
        }
    }

    /**
     * Toggle user active status
     */
    async toggleUserStatus(userId, newStatus) {
        if (!confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this user?`)) {
            return;
        }

        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/users/${userId}/status`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ is_active: newStatus })
                }
            );

            if (response.ok) {
                alert(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
                this.loadUsers(this.currentPage.users);
            } else {
                const error = await response.json();
                alert(`Failed to update user: ${error.error}`);
            }
        } catch (error) {
            console.error('[AdminDashboard] Error toggling user status:', error);
            alert('Failed to update user status');
        }
    }

    /**
     * Export users as CSV
     */
    async exportUsers() {
        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/export/users`
            );

            if (!response.ok) {
                throw new Error('Failed to export users');
            }

            // Get CSV content
            const csvContent = await response.text();
            
            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('[AdminDashboard] Users exported successfully');
        } catch (error) {
            console.error('[AdminDashboard] Error exporting users:', error);
            alert('Failed to export users. Please try again.');
        }
    }

    /**
     * Export requests as CSV
     */
    async exportRequests() {
        try {
            const response = await window.AuthManager.authenticatedFetch(
                `${this.adminServiceUrl}/api/admin/export/requests`
            );

            if (!response.ok) {
                throw new Error('Failed to export requests');
            }

            // Get CSV content
            const csvContent = await response.text();
            
            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `requests_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('[AdminDashboard] Requests exported successfully');
        } catch (error) {
            console.error('[AdminDashboard] Error exporting requests:', error);
            alert('Failed to export requests. Please try again.');
        }
    }

    /**
     * Open modal
     */
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    /**
     * Close modal
     */
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const adminDashboard = new AdminDashboard();
