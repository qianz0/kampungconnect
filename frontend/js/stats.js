// Function to view helper stats
async function viewHelperStats(helperId, helperName, offerId, canAccept) {
    try {
        const modal = new bootstrap.Modal(document.getElementById('helperStatsModal'));
        const modalContent = document.getElementById('helperStatsContent');
        const acceptBtn = document.getElementById('acceptOfferFromModal');

        // Show loading
        modalContent.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading helper statistics...</p>
            </div>
        `;
        modal.show();

        // Fetch helper stats
        const authManager = await waitForAuthManager();
        const response = await authManager.authenticatedFetch(`http://localhost:5009/stats/helper/${helperId}`);

        if (!response.ok) {
            throw new Error('Failed to load helper stats');
        }

        const stats = await response.json();

        // Build badges html
        let badgesHtml = '';
        if (stats.badges && stats.badges.length > 0) {
            badgesHtml = `
                <div class="row mb-4">
                    <div class="col-12">
                        <h6 class="mb-3">
                            <i class="fas fa-trophy me-2 text-warning"></i>
                            Badges Earned 
                            <span class="badge bg-primary ms-2">${stats.badges.length}</span>
                        </h6>
                        <div class="row">
                            ${stats.badges.map(badge => `
                                <div class="col-md-4 col-6 mb-3">
                                    <div class="text-center p-2 border rounded" style="background: ${badge.color}10; border-color: ${badge.color}!important;">
                                        <i class="fas ${badge.icon} fa-2x mb-2" style="color: ${badge.color};"></i>
                                        <div class="fw-bold" style="font-size: 0.85rem;">${badge.name}</div>
                                        <small class="text-muted" style="font-size: 0.75rem;">${badge.description}</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Streak html
        let streakHtml = '';
        if (stats.streak) {
            const currentStreak = stats.streak.current_streak || 0;
            const longestStreak = stats.streak.longest_streak || 0;
            const isActive = stats.streak.is_active;
            streakHtml = `
                <div class="row mb-4">
                    <div class="col-6">
                        <div class="text-center p-3 border rounded" style="background: ${isActive ? '#ff6b6b10' : '#f8f9fa'};">
                            <i class="fas fa-fire fa-2x mb-2" style="color: #ff6b6b;"></i>
                            <div class="fw-bold">Current Streak</div>
                            <h4 class="mb-0 ${isActive ? 'text-danger' : 'text-muted'}">${currentStreak} days</h4>
                            ${isActive && currentStreak > 0 ? '<small class="text-success">🔥 Active!</small>' : '<small class="text-muted">Not active</small>'}
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="text-center p-3 border rounded" style="background: #ffc10710;">
                            <i class="fas fa-crown fa-2x mb-2 text-warning"></i>
                            <div class="fw-bold">Longest Streak</div>
                            <h4 class="mb-0">${longestStreak} days</h4>
                            <small class="text-muted">Personal best</small>
                        </div>
                    </div>
                </div>
            `;
        }

        // Display stats
        modalContent.innerHTML = `
            <div class="row mb-3">
                <div class="col-12">
                    <h5 class="mb-3">
                        <i class="fas fa-user-circle me-2"></i>${helperName || 'Helper'}
                    </h5>
                </div>
            </div>
            ${badgesHtml}
            ${streakHtml} 
            <div class="row mb-3">
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Completed Requests</small>
                        <h4 class="mb-0 text-success">${stats.request_stats.total_completed}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Completion Rate</small>
                        <h4 class="mb-0 text-primary">${stats.request_stats.completion_rate}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Average Rating</small>
                        <h4 class="mb-0 text-warning">
                            <i class="fas fa-star"></i> ${stats.rating_stats.avg_rating}
                        </h4>
                        <small class="text-muted">${stats.rating_stats.total_ratings} ratings</small>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Average Completion Time</small>
                        <h4 class="mb-0">${stats.time_stats.avg_completion_time}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Response Time</small>
                        <h4 class="mb-0">${stats.performance.avg_response_time}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Rank</small>
                        <h4 class="mb-0 text-info">${stats.performance.rank}</h4>
                    </div>
                </div>
            </div>
            ${Object.keys(stats.category_breakdown).length > 0 ? `
                <div class="row">
                    <div class="col-12">
                        <h6 class="mb-2"><i class="fas fa-list me-2"></i>Help by Category</h6>
                        ${Object.entries(stats.category_breakdown).map(([cat, count]) => `
                            <div class="d-flex justify-content-between mb-2">
                                <span>${cat}</span>
                                <span class="badge bg-primary">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Show accept button if offer is pending and user can accept
        if (offerId && canAccept) {
            acceptBtn.style.display = 'block';
            acceptBtn.onclick = () => {
                modal.hide();
                acceptOffer(offerId);
            };
        } else {
            acceptBtn.style.display = 'none';
        }
    } catch (err) {
        console.error('Error loading helper stats:', err);
        document.getElementById('helperStatsContent').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load helper statistics. Please try again.
            </div>
        `;
    }
}

// Function to view senior stats
async function viewSeniorStats(seniorId, seniorName) {
    try {
        const modal = new bootstrap.Modal(document.getElementById('seniorStatsModal'));
        const modalContent = document.getElementById('seniorStatsContent');

        // Show loading
        modalContent.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading senior statistics...</p>
            </div>
        `;
        modal.show();

        // Fetch senior stats
        const authManager = await waitForAuthManager();
        const response = await authManager.authenticatedFetch(`http://localhost:5009/stats/senior/${seniorId}`);
        if (!response.ok) {
            throw new Error('Failed to load senior stats');
        }
        const stats = await response.json();

        // Display stats
        modalContent.innerHTML = `
            <div class="row mb-3">
                <div class="col-12">
                    <h5 class="mb-3">
                        <i class="fas fa-user-circle me-2"></i>${seniorName || 'Senior'}
                    </h5>
                </div>
            </div>
            <div class="row mb-3">
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Total Requests Posted</small>
                        <h4 class="mb-0 text-primary">${stats.request_stats.total_posted}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Fulfilled Requests</small>
                        <h4 class="mb-0 text-success">${stats.request_stats.total_fulfilled}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Pending Requests</small>
                        <h4 class="mb-0 text-warning">${stats.request_stats.total_pending}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Success Rate</small>
                        <h4 class="mb-0 text-info">${stats.request_stats.fulfillment_rate}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Average Rating Given</small>
                        <h4 class="mb-0 text-warning">
                            <i class="fas fa-star"></i> ${stats.rating_stats.avg_rating_given}
                        </h4>
                        <small class="text-muted">${stats.rating_stats.total_ratings_given} ratings given</small>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-item">
                        <small class="text-muted d-block">Ongoing Requests</small>
                        <h4 class="mb-0">${stats.request_stats.total_ongoing}</h4>
                    </div>
                </div>
            </div>
            <div class="row mb-3">
                <div class="col-12">
                    <h6 class="mb-2"><i class="fas fa-chart-line me-2"></i>Activity Trends</h6>
                    <div class="stat-item">
                        <div class="d-flex justify-content-between mb-2">
                            <span>This Month</span>
                            <span class="badge bg-primary">${stats.trends.requests_this_month}</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>Last Month</span>
                            <span class="badge bg-secondary">${stats.trends.requests_last_month}</span>
                        </div>
                    </div>
                </div>
            </div>
            ${stats.category_breakdown.breakdown && Object.keys(stats.category_breakdown.breakdown).length > 0 ? `
                <div class="row">
                    <div class="col-12">
                        <h6 class="mb-2"><i class="fas fa-list me-2"></i>Requests by Category</h6>
                        <p class="mb-2"><strong>Most Requested:</strong> ${stats.category_breakdown.most_requested}</p>
                        ${Object.entries(stats.category_breakdown.breakdown).map(([cat, count]) => `
                            <div class="d-flex justify-content-between mb-2">
                                <span>${cat}</span>
                                <span class="badge bg-info">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    } catch (err) {
        console.error('Error loading senior stats:', err);
        document.getElementById('seniorStatsContent').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load senior statistics. Please try again.
            </div>
        `;
    }
}

// Function to view user stats from leaderboard
async function viewUserStats(userId, userName) {
    try {
        const modal = new bootstrap.Modal(document.getElementById('userStatsModal'));
        const modalContent = document.getElementById('userStatsContent');

        // Show loading
        modalContent.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading user statistics...</p>
            </div>
        `;
        modal.show();

        // Fetch user stats
        const authManager = await waitForAuthManager();
        const response = await authManager.authenticatedFetch(`http://localhost:5009/stats/helper/${userId}`);
        if (!response.ok) {
            throw new Error('Failed to load user stats');
        }
        const stats = await response.json();

        // Build badges html
        let badgesHtml = '';
        if (stats.badges && stats.badges.length > 0) {
            badgesHtml = `
                <div class="row mb-4">
                    <div class="col-12">
                        <h6 class="mb-3">
                            <i class="fas fa-trophy me-2 text-warning"></i>
                            Badges Earned 
                            <span class="badge bg-primary ms-2">${stats.badges.length}</span>
                        </h6>
                        <div class="row">
                            ${stats.badges.map(badge => `
                                <div class="col-md-4 col-6 mb-3">
                                    <div class="text-center p-2 border rounded" style="background: ${badge.color}10; border-color: ${badge.color}!important;">
                                        <i class="fas ${badge.icon} fa-2x mb-2" style="color: ${badge.color};"></i>
                                        <div class="fw-bold" style="font-size: 0.85rem;">${badge.name}</div>
                                        <small class="text-muted" style="font-size: 0.75rem;">${badge.description}</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Build streak html
        let streakHtml = '';
        if (stats.streak) {
            const currentStreak = stats.streak.current_streak || 0;
            const longestStreak = stats.streak.longest_streak || 0;
            const isActive = stats.streak.is_active;
            streakHtml = `
                <div class="row mb-4">
                    <div class="col-6">
                        <div class="text-center p-3 border rounded" style="background: ${isActive ? '#ff6b6b10' : '#f8f9fa'};">
                            <i class="fas fa-fire fa-2x mb-2" style="color: #ff6b6b;"></i>
                            <div class="fw-bold">Current Streak</div>
                            <h4 class="mb-0 ${isActive ? 'text-danger' : 'text-muted'}">${currentStreak} days</h4>
                            ${isActive && currentStreak > 0 ? '<small class="text-success">🔥 Active!</small>' : '<small class="text-muted">Not active</small>'}
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="text-center p-3 border rounded" style="background: #ffc10710;">
                            <i class="fas fa-crown fa-2x mb-2" style="color: #ffd700;"></i>
                            <div class="fw-bold">Longest Streak</div>
                            <h4 class="mb-0">${longestStreak} days</h4>
                            <small class="text-muted">Personal best</small>
                        </div>
                    </div>
                </div>
            `;
        }

        // Display stats
        modalContent.innerHTML = `
            <div class="row mb-3">
                <div class="col-12">
                    <h5 class="mb-3">
                        <i class="fas fa-user-circle me-2"></i>${userName || 'User'}
                    </h5>
                </div>
            </div>            
            ${badgesHtml}
            ${streakHtml}            
            <div class="row mb-3">
                <div class="col-md-6 mb-3">
                    <div class="stat-card p-3 bg-light rounded">
                        <small class="text-muted d-block">Completed Requests</small>
                        <h4 class="mb-0 text-success">${stats.request_stats.total_completed}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-card p-3 bg-light rounded">
                        <small class="text-muted d-block">Completion Rate</small>
                        <h4 class="mb-0 text-primary">${stats.request_stats.completion_rate}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-card p-3 bg-light rounded">
                        <small class="text-muted d-block">Average Rating</small>
                        <h4 class="mb-0 text-warning">
                            <i class="fas fa-star"></i> ${stats.rating_stats.avg_rating}
                        </h4>
                        <small class="text-muted">${stats.rating_stats.total_ratings} ratings</small>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-card p-3 bg-light rounded">
                        <small class="text-muted d-block">Average Completion Time</small>
                        <h4 class="mb-0">${stats.time_stats.avg_completion_time}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-card p-3 bg-light rounded">
                        <small class="text-muted d-block">Response Time</small>
                        <h4 class="mb-0">${stats.performance.avg_response_time}</h4>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="stat-card p-3 bg-light rounded">
                        <small class="text-muted d-block">Rank</small>
                        <h4 class="mb-0 text-info">${stats.performance.rank}</h4>
                    </div>
                </div>
            </div>            
            ${Object.keys(stats.category_breakdown).length > 0 ? `
                <div class="row">
                    <div class="col-12">
                        <h6 class="mb-2"><i class="fas fa-list me-2"></i>Help by Category</h6>
                        ${Object.entries(stats.category_breakdown).map(([cat, count]) => `
                            <div class="d-flex justify-content-between mb-2 p-2 bg-light rounded">
                                <span>${cat}</span>
                                <span class="badge bg-primary">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    } catch (err) {
        console.error('Error loading user stats:', err);
        document.getElementById('userStatsContent').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load user statistics. Please try again.
            </div>
        `;
    }
}