// Global variables
let currentUser = null;
let notificationsPoller = null;
const expandedThreads = new Set();
let currentFilter = 'all-requests';

// Wait for AuthManager to be available, after 50 tried it will throw error
function waitForAuthManager() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;
        function check() {
            attempts++;
            if (window.AuthManager && typeof window.AuthManager.initialize === 'function') {
                resolve(window.AuthManager);
            } else if (attempts >= maxAttempts) {
                reject(new Error("AuthManager not available"));
            } else {
                setTimeout(check, 100);
            }
        }
        check();
    });
}

// Load notifications from the server
async function loadNotifications() {
    try {
        const authManager = await waitForAuthManager();

        // Get notifications using authenticatedFetch if available
        let response = null;
        if (authManager && typeof authManager.authenticatedFetch === 'function') {
            try {
                response = await authManager.authenticatedFetch('http://localhost:5002/notifications');
            } catch (innerErr) {
                console.warn('[Notifications] authenticatedFetch failed, will try plain fetch as fallback', innerErr);
                response = null;
            }
        }

        // If authenticatedFetch not available or failed, use plain fetch
        let data = null;
        let skipJsonParse = false;
        if (!response) {
            try {
                response = await fetch('http://localhost:5002/notifications', { credentials: 'include' });
            } catch (fetchErr) {
                console.error('[Notifications] Plain fetch failed:', fetchErr);
                // If running locally, inject dev mock so UI can still render for development
                if (window.location && window.location.hostname && window.location.hostname.includes('localhost')) {
                    console.info('[Notifications] Plain fetch failed — injecting dev mock for local development');
                    data = {
                        notifications: [
                            {
                                id: 9999,
                                type: 'request_replied',
                                category: 'responses',
                                title: 'Sample community response thread (dev mock)',
                                message: 'A sample thread for local UI testing',
                                created_at: new Date().toISOString(),
                                requestId: 555,
                                responses: [
                                    { id: 1, parent_id: null, responder_name: 'Alice', responder_role: 'helper', message: 'I can help with this request', created_at: new Date(Date.now()-1000*60*60).toISOString() },
                                    { id: 2, parent_id: 1, responder_name: 'Bob', responder_role: 'senior', message: 'Thanks — that would be great!', created_at: new Date(Date.now()-1000*60*30).toISOString() }
                                ]
                            }
                        ]
                    };
                    skipJsonParse = true;
                } else {
                    throw fetchErr;
                }
            }
        }

        //  Attempt to parse the response body as JSON, catch and log any errors
        if (!skipJsonParse) {
            try {
                data = await response.json();
            } catch (jsonErr) {
                console.error('[Notifications] Response JSON parse error:', jsonErr);
                data = null;
            }
        }

        // Handle non-OK responses
        if (!response.ok) {
            const statusMsg = `Failed to load notifications (status: ${response.status})`;
            console.warn('[Notifications] ' + statusMsg, data);

            // Dev fallback: if running on localhost, show a mocked sample so UI can be tested
            if (window.location && window.location.hostname && window.location.hostname.includes('localhost')) {
                console.info('[Notifications] Using dev mock notifications because backend returned non-OK');
                data = {
                    notifications: [
                        {
                            id: 9999,
                            type: 'request_replied',
                            category: 'responses',
                            title: 'Sample community response thread',
                            message: 'A sample thread for local UI testing',
                            created_at: new Date().toISOString(),
                            responses: [
                                { id: 1, parent_id: null, responder_name: 'Alice', responder_role: 'helper', message: 'I can help with this request', created_at: new Date(Date.now()-1000*60*60).toISOString() },
                                { id: 2, parent_id: 1, responder_name: 'Bob', responder_role: 'senior', message: 'Thanks — that would be great!', created_at: new Date(Date.now()-1000*60*30).toISOString() }
                            ]
                        }
                    ]
                };
            } else {
                const container = document.getElementById('notificationsList');
                if (container) {
                    container.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${statusMsg}. ${data && data.error ? data.error : ''}
                        </div>
                    `;
                }
                return;
            }
        }

        // If no notifications array present, inject fake data for testing
        if (!data || !Array.isArray(data.notifications) || data.notifications.length === 0) {
            if (window.location && window.location.hostname && window.location.hostname.includes('localhost')) {
                console.info('[Notifications] No notifications returned, injecting dev mock for UI testing');
                data = {
                    notifications: [
                        {
                            id: 10000,
                            type: 'new_response',
                            category: 'responses',
                            title: 'Dev sample response thread',
                            message: 'This is a developer mock notification',
                            created_at: new Date().toISOString(),
                            responses: [
                                { id: 11, parent_id: null, responder_name: 'Carol', responder_role: 'helper', message: 'I can pick this up tomorrow', created_at: new Date(Date.now()-1000*60*120).toISOString() },
                                { id: 12, parent_id: 11, responder_name: 'Dave', responder_role: 'senior', message: 'Appreciate it — please message me', created_at: new Date(Date.now()-1000*60*90).toISOString() }
                            ]
                        }
                    ]
                };
            } else {
                const container = document.getElementById('notificationsList');
                if (container) {
                    container.innerHTML = `
                        <div class="text-center text-muted py-5">
                            <i class="fas fa-bell-slash fa-3x mb-3"></i>
                            <h5>No notifications yet</h5>
                            <p>We'll notify you when there's new activity</p>
                        </div>
                    `;
                }
                return;
            }
        }

        // Render notifications
        const notificationsContainer = document.getElementById('notificationsList');
        const responsesContainer = document.getElementById('response_list');
        const responsesCard = document.getElementById('communityResponsesCard');

        // Clear containers
        if (notificationsContainer) notificationsContainer.innerHTML = '';
        if (responsesContainer) responsesContainer.innerHTML = '';

        // Process all notifications
        for (const notification of data.notifications) {
            const item = document.createElement('div');
            item.className = `notification-item ${notification.read ? '' : 'unread'}`;
            // Use category if provided, if not infer from type
            const category = notification.category || (notification.type ? (notification.type.includes('response') || notification.type.includes('replied') ? 'responses' : 'other') : 'other');
            item.setAttribute('data-type', category);

            // If notification is clearly addressed to another user and is not public, skip it
            const recipientId = notification.recipient_id || notification.user_id || notification.to_user_id || notification.target_user_id || notification.to;
            const isPublic = notification.public || notification.is_public || notification.visibility === 'public';
            try {
                if (recipientId && currentUser && String(recipientId) !== String(currentUser.id) && !isPublic) {
                    // Silently skip notifications that are clearly for someone else
                    // Use to avoids showing other users' chat threads in Community Responses)
                    continue;
                }
            } catch (e) { /* ignore comparison errors */ }

            // Define icon based on notification type
            let icon = 'fa-bell';
            let iconColor = 'primary';
            switch(notification.type) {
                case 'request_matched': icon = 'fa-handshake'; iconColor = 'success'; break;
                case 'new_offer': icon = 'fa-hands-helping'; iconColor = 'info'; break;
                case 'request_completed': icon = 'fa-check-circle'; iconColor = 'success'; break;
                case 'new_response': icon = 'fa-comment'; iconColor = 'warning'; break;
                case 'offer_accepted': icon = 'fa-check-double'; iconColor = 'success'; break;
                case 'request_replied': icon = 'fa-reply'; iconColor = 'info'; break;
            }

            item.innerHTML = `
                <div class="d-flex align-items-start">
                    <div class="notification-icon bg-${iconColor} bg-opacity-10">
                        <i class="fas ${icon} text-${iconColor}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <h6 class="mb-0">${notification.title}</h6>
                            <small class="notification-time">
                                ${new Date(notification.created_at).toLocaleString()}
                            </small>
                        </div>
                        <p class="mb-2">${notification.message}</p>
                        ${notification.actionUrl ? `
                            <a href="${notification.actionUrl}" class="btn btn-sm btn-outline-primary">
                                <i class="fas fa-external-link-alt me-1"></i>View Details
                            </a>
                        ` : ''}
                    </div>
                    ${!notification.read ? `
                        <button class="btn btn-sm btn-link text-muted" 
                                onclick="markAsRead(${notification.id})">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                </div>
            `;

            // If this notification includes a responses array, show threaded responses
            if (category === 'responses') {
            }

            if (notificationsContainer) notificationsContainer.appendChild(item);
        }

        // Show/hide the community responses card depending on whether there are response items
        try {
            if (responsesCard && responsesContainer) {
                responsesCard.style.display = (responsesContainer.children.length > 0) ? 'block' : 'none';
            }
        } catch(e) { /* ignore */ }

    } catch (err) {
        console.error('Error loading notifications (final):', err);
        const container = document.getElementById('notificationsList');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Failed to load notifications. Check console for details.
                </div>
            `;
        }
    } finally {
        // Always hide the loading overlay so user can see messages
        try { document.getElementById('loadingOverlay').style.display = 'none'; } catch(e){}
    }
}

// Mark a notification as read
async function markAsRead(notificationId) {
    try {
        const authManager = await waitForAuthManager();
        await authManager.authenticatedFetch(
            `http://localhost:5002/notifications/${notificationId}/read`,
            { method: 'POST' }
        );
        loadNotifications(); // Refresh the list
    } catch (err) {
        console.error('Error marking notification as read:', err);
    }
}

// Email preferences handling - Confirm with modal
function confirmWithModal({ title = 'Confirm', message = 'Are you sure?', confirmText = 'OK', confirmBtnClass = 'btn-primary' } = {}) {
    return new Promise((resolve) => {
        try {
            const titleEl = document.getElementById('confirmModalTitle');
            const bodyEl = document.getElementById('confirmModalBody');
            const actionBtn = document.getElementById('confirmModalActionBtn');
            if (!titleEl || !bodyEl || !actionBtn) {
                // Fallback to native confirm if modal elements are missing
                const ok = window.confirm(message);
                resolve(ok);
                return;
            }

            titleEl.textContent = title;
            bodyEl.textContent = message;
            actionBtn.textContent = confirmText;

            // Reset button classes and apply the requested style
            actionBtn.className = 'btn ' + confirmBtnClass;

            // Clean previous listeners
            const newActionBtn = actionBtn.cloneNode(true);
            actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

            const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
            newActionBtn.addEventListener('click', () => {
                modal.hide();
                resolve(true);
            });

            // If modal is closed via Cancel or X, resolve false
            const modalEl = document.getElementById('confirmModal');
            const handleHidden = () => {
                modalEl.removeEventListener('hidden.bs.modal', handleHidden);
                resolve(false);
            };
            modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

            modal.show();
        } catch (e) {
            const ok = window.confirm(message);
            resolve(ok);
        }
    });
}

// Load email preferences
async function loadEmailPreferences() {
    try {
        const authManager = await waitForAuthManager();
        const response = await authManager.authenticatedFetch('http://localhost:5004/notification-preferences');
        const data = await response.json();

        if (response.ok) {
            document.getElementById('emailNotificationsEnabled').checked = data.enabled;
            const emailEl = document.getElementById('notificationEmail');
            if (emailEl) {
                emailEl.value = data.email || currentUser?.email || '';
                emailEl.readOnly = true;
                emailEl.classList.add('bg-light');
            }

            const newResponsesEl = document.getElementById('notifyNewResponses');
            if (newResponsesEl) newResponsesEl.checked = data.preferences?.newResponses ?? true;

            const newOffersEl = document.getElementById('notifyNewOffers');
            if (newOffersEl) newOffersEl.checked = data.preferences?.newOffers ?? true;

            const requestUpdatesEl = document.getElementById('notifyRequestUpdates');
            if (requestUpdatesEl) requestUpdatesEl.checked = data.preferences?.requestUpdates ?? true;

            const repliesEl = document.getElementById('notifyReplies');
            if (repliesEl) repliesEl.checked = data.preferences?.replies ?? true;

            document.getElementById('emailPreferences').style.display = data.enabled ? 'block' : 'none';
        }
    } catch (err) {
        console.error('Error loading email preferences:', err);
    }
}

// Save email preferences
async function saveEmailPreferences() {
    try {
        const authManager = await waitForAuthManager();
        const enabledEl = document.getElementById('emailNotificationsEnabled');
        const emailEl = document.getElementById('notificationEmail');
        const preferences = {
            enabled: enabledEl ? enabledEl.checked : false,
            email: emailEl ? emailEl.value : (currentUser?.email || ''),
            preferences: {
                newResponses: (document.getElementById('notifyNewResponses') ? document.getElementById('notifyNewResponses').checked : true),
                newOffers: (document.getElementById('notifyNewOffers') ? document.getElementById('notifyNewOffers').checked : true),
                requestUpdates: (document.getElementById('notifyRequestUpdates') ? document.getElementById('notifyRequestUpdates').checked : true),
                replies: (document.getElementById('notifyReplies') ? document.getElementById('notifyReplies').checked : true)
            }
        };

        const response = await authManager.authenticatedFetch('http://localhost:5004/notification-preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preferences)
        });

        if (response.ok) {
            alert('Notification preferences saved successfully!');
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save preferences');
        }
    } catch (err) {
        console.error('Error saving preferences:', err);
        alert('Error: ' + err.message);
    }
}

// Filter notifications by type
function filterNotifications(type) {
    // Save current filter for reapplication after auto-refresh
    currentFilter = type;
    
    // Get all request cards in the Recently Matched Requests section
    const requestCards = document.querySelectorAll('#notificationsList .card[data-request-id]');
    const responseContainers = document.querySelectorAll('#notificationsList .matched-request-responses');
    const header = document.querySelector('#notificationsList h5');
    
    // Get response-type notifications, in community responses section
    const responseItems = document.querySelectorAll('#response_list .notification-item');
    const responsesCard = document.getElementById('communityResponsesCard');

    // Update button states - remove active class from all, add to selected
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-secondary');
    });
    
    // Add active class to selected button
    const activeButtonId = 'filter-' + type;
    const activeButton = document.getElementById(activeButtonId);
    if (activeButton) {
        activeButton.classList.remove('btn-outline-secondary');
        activeButton.classList.add('btn-primary');
    }

    if (type === 'all-requests') {
        // Show all requests (active and completed)
        requestCards.forEach(card => card.style.display = 'block');
        responseContainers.forEach(container => container.style.display = 'block');
        if (header) header.textContent = 'All Requests';
        // Hide response notifications
        responseItems.forEach(i => i.style.display = 'none');
        if (responsesCard) responsesCard.style.display = 'none';
    } else if (type === 'active') {
        // Show only active/matched requests
        requestCards.forEach((card, index) => {
            const status = card.querySelector('.status-indicator')?.textContent?.toLowerCase().trim();
            let isActive = false;

            if (currentUser && currentUser.role === 'senior') {
                isActive = status === 'matched';
            } else {
                isActive = status === 'matched' || status === 'active' || status === 'in-progress';
            }

            card.style.display = isActive ? 'block' : 'none';
            if (responseContainers[index]) {
                responseContainers[index].style.display = isActive ? 'block' : 'none';
            }
        });
        if (header) header.textContent = 'Active Requests';
        responseItems.forEach(i => i.style.display = 'none');
        if (responsesCard) responsesCard.style.display = 'none';
    } else if (type === 'completed') {
        // Show only completed/fulfilled requests
        requestCards.forEach((card, index) => {
            const status = card.querySelector('.status-indicator')?.textContent?.toLowerCase().trim();
            let isCompleted = false;

            if (currentUser && currentUser.role === 'senior') {
                isCompleted = status === 'fulfilled' || status === 'completed';
            } else {
                isCompleted = status === 'fulfilled' || status === 'completed' || status === 'closed';
            }

            card.style.display = isCompleted ? 'block' : 'none';
            if (responseContainers[index]) {
                responseContainers[index].style.display = isCompleted ? 'block' : 'none';
            }
        });
        if (header) header.textContent = 'Completed Requests';
        responseItems.forEach(i => i.style.display = 'none');
        if (responsesCard) responsesCard.style.display = 'none';
    } else if (type === 'pending-response') {
        // Show only pending requests for seniors
        requestCards.forEach((card, index) => {
            const status = card.querySelector('.status-indicator')?.textContent?.toLowerCase().trim();
            const isPending = status === 'pending' || status === 'open' || status === 'active';
            
            card.style.display = isPending ? 'block' : 'none';
            if (responseContainers[index]) {
                responseContainers[index].style.display = isPending ? 'block' : 'none';
            }
        });
        if (header) header.textContent = 'Pending Requests';
        responseItems.forEach(i => i.style.display = 'none');
        if (responsesCard) responsesCard.style.display = 'none';
    } else if (type === 'responses') {
        // Show requests that have responses
        requestCards.forEach((card, index) => {
            const responseContainer = responseContainers[index];
            const hasResponses = responseContainer && 
                                responseContainer.querySelectorAll('.response-item').length > 0;
            
            card.style.display = hasResponses ? 'block' : 'none';
            if (responseContainer) {
                responseContainer.style.display = hasResponses ? 'block' : 'none';
            }
        });
        if (header) header.textContent = 'Requests with Responses';
        responseItems.forEach(i => i.style.display = 'none');
        if (responsesCard) responsesCard.style.display = 'none';
    }
}

// Render threaded responses into a container
function renderResponseItems(responses, container, requestId = null) {
    if (!container) return;
    container.innerHTML = '';

    // Build a map of responses by id
    const responseMap = {};
    responses.forEach(r => {
        const id = Number(r.id);
        responseMap[id] = { ...r, id, replies: [] };
    });

    // Link children to parents
    const rootResponses = [];
    responses.forEach(r => {
        const id = Number(r.id);
        const pid = r.parent_id ? Number(r.parent_id) : null;
        if (pid && responseMap[pid]) {
            responseMap[pid].replies.push(responseMap[id]);
        } else {
            rootResponses.push(responseMap[id]);
        }
    });

    // Recursive render
    function renderResponse(res, depth = 0, parentEl = container) {
        const item = document.createElement('div');
        const roleClass = res.responder_role || '';
        item.className = `response-item depth-${depth} ${roleClass}`;
        item.style.setProperty('--indent', `${depth * 24}px`);

        // Determine who the responder is and show "Me" when it's the current user
        const responderId = res.user_id || res.responder_id || res.user || res.responder || res.userId || res.responderId;
        const responderEmail = res.responder_email || res.responderEmail || res.email || res.user_email || res.userEmail;
        const responderName = res.responder_name || res.name || res.displayName || res.username || 'Anonymous';

        let displayName = responderName;
        let roleBadge = '';

        // Collect possible current user identifiers
        const currentUserIds = new Set();
        const currentUserEmails = new Set();
        const currentUserNames = new Set();
        try {
            if (currentUser) {
                [ 'id', 'user_id', 'userId', 'sub' ].forEach(k => { if (currentUser[k]) currentUserIds.add(String(currentUser[k])); });
                if (currentUser.id) currentUserIds.add(String(currentUser.id));
                if (currentUser.email) currentUserEmails.add(String(currentUser.email).toLowerCase());
                if (currentUser.username) currentUserNames.add(String(currentUser.username));
                if (currentUser.name) currentUserNames.add(String(currentUser.name));
                if (currentUser.firstname || currentUser.lastname) currentUserNames.add(((currentUser.firstname||'') + ' ' + (currentUser.lastname||'')).trim());
            }
        } catch (e) { /* ignore */ }

        const isMe = (function() {
            try {
                if (!currentUser) return false;
                if (responderId && currentUserIds.has(String(responderId))) return true;
                if (responderEmail && currentUserEmails.has(String(responderEmail).toLowerCase())) return true;
                if (responderName && Array.from(currentUserNames).some(n => n && String(n).trim() === String(responderName).trim())) return true;
            } catch (e) { /* ignore */ }
            return false;
        })();

        // Normalize role and choose badge color/text
        const roleRaw = res.responder_role || res.role || (isMe && currentUser ? currentUser.role : '') || '';
        const roleNorm = String(roleRaw || '').toLowerCase();
        let roleLabelText = '';
        let badgeClassName = 'bg-secondary';

        if (roleNorm === 'senior') {
            roleLabelText = 'Senior';
            badgeClassName = 'bg-primary';
        } else if (['helper','volunteer','caregiver'].includes(roleNorm)) {
            roleLabelText = 'Helper';
            badgeClassName = 'bg-success';
        } else if (roleRaw) {
            roleLabelText = String(roleRaw).charAt(0).toUpperCase() + String(roleRaw).slice(1);
        } else {
            roleLabelText = 'User';
        }

        if (isMe) {
            displayName = 'You';
            roleBadge = `<span class="badge ${badgeClassName} ms-2">${roleLabelText}</span>`;
        } else {
            roleBadge = `<span class="badge ${badgeClassName} ms-2">${roleLabelText}</span>`;
        }

        // Determine CSS class for the display name based on role
        let nameClass = '';
        if (roleNorm === 'senior') {
            nameClass = 'text-primary fw-bold';
        } else if (['helper','volunteer','caregiver'].includes(roleNorm)) {
            nameClass = 'text-success fw-bold';
        }
        if (!isMe && nameClass) {
            nameClass = 'text-dark fw-bold';
        }

        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div>
                    <strong class="${nameClass}">
                        ${displayName}
                    </strong>
                    ${roleBadge}
                </div>
                <small class="text-muted">${new Date(res.created_at).toLocaleString()}</small>
            </div>
            <p class="mb-1">${res.message || ''}</p>
            <button class="btn btn-sm btn-outline-primary" onclick="replyToResponse(${res.id})">
                Reply
            </button>
        `;

        const repliesContainer = document.createElement('div');
        repliesContainer.classList.add('replies');
        item.appendChild(repliesContainer);

        parentEl.appendChild(item);

        res.replies.forEach(reply => renderResponse(reply, depth + 1, repliesContainer));
    }

    function sortReplies(node) {
        node.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        node.replies.forEach(sortReplies);
    }

    // sort root responses
    rootResponses.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    rootResponses.forEach(sortReplies);

    // Count total messages (including all nested replies)
    function countAllMessages(node) {
        let count = 1;
        if (node.replies && node.replies.length > 0) {
            node.replies.forEach(reply => {
                count += countAllMessages(reply);
            });
        }
        return count;
    }

    const totalMessages = rootResponses.reduce((sum, node) => sum + countAllMessages(node), 0);
    const maxInitialDisplay = 5;

    // Render all messages first
    rootResponses.forEach(r => renderResponse(r));

    // If there are more than 5 total messages, hide the extras and add expand button
    if (totalMessages > maxInitialDisplay) {
        const allResponseItems = Array.from(container.querySelectorAll('.response-item'));
        
        const isExpanded = requestId && expandedThreads.has(String(requestId));
        
        allResponseItems.forEach((item, index) => {
            if (index < maxInitialDisplay) {
                item.classList.add('initially-visible');
            } else {
                item.classList.add('initially-hidden');
                item.style.display = isExpanded ? 'block' : 'none';
            }
        });
        
        const hiddenCount = totalMessages - maxInitialDisplay;
        
        const toggleButton = document.createElement('button');
        toggleButton.className = 'btn btn-sm btn-outline-secondary mt-2';
        toggleButton.innerHTML = isExpanded 
            ? `<i class="fas fa-chevron-up me-1"></i>Show Less`
            : `<i class="fas fa-chevron-down me-1"></i>Show ${hiddenCount} More Messages`;
        toggleButton.onclick = function() {
            const hiddenItems = container.querySelectorAll('.initially-hidden');
            const isCurrentlyHidden = hiddenItems.length > 0 && hiddenItems[0].style.display === 'none';
            
            hiddenItems.forEach(item => {
                item.style.display = isCurrentlyHidden ? 'block' : 'none';
            });
            
            if (requestId) {
                if (isCurrentlyHidden) {
                    expandedThreads.add(String(requestId));
                    markRequestAsViewed(requestId);
                    setTimeout(() => refreshMatchedRequests(), 100);
                } else {
                    expandedThreads.delete(String(requestId));
                }
            }
            
            if (isCurrentlyHidden) {
                toggleButton.innerHTML = `<i class="fas fa-chevron-up me-1"></i>Show Less`;
            } else {
                toggleButton.innerHTML = `<i class="fas fa-chevron-down me-1"></i>Show ${hiddenCount} More Messages`;
            }
        };
        container.appendChild(toggleButton);
    }
}

// Calculate unread counts for a request
function calculateUnreadCounts(requestId, responses, offers, currentStatus, requestCreatedAt) {
    try {
        const viewKey = `request_${requestId}_lastView`;
        const lastViewStr = localStorage.getItem(viewKey);
        const lastViewTime = lastViewStr ? new Date(lastViewStr).getTime() : 0;
        
        const isNewRequest = lastViewTime === 0;

        // Count new replies
        let newReplies = 0;
        if (Array.isArray(responses)) {
            const myId = String(currentUser?.id || '');
            const myEmail = String(currentUser?.email || '').toLowerCase();
            
            newReplies = responses.filter(r => {
                const createdAt = new Date(r.created_at || r.createdAt).getTime();
                if (createdAt <= lastViewTime) return false;
                
                const responderId = String(r.user_id || r.responder_id || '');
                const responderEmail = String(r.responder_email || r.email || '').toLowerCase();
                
                const isMyMessage = (responderId && myId && responderId === myId) || 
                                   (responderEmail && myEmail && responderEmail === myEmail);
                
                return !isMyMessage;
            }).length;
        }

        // Count new offers
        let newOffers = 0;
        if (Array.isArray(offers)) {
            newOffers = offers.filter(o => {
                const createdAt = new Date(o.created_at || o.createdAt).getTime();
                return createdAt > lastViewTime && (o.status || '').toLowerCase() === 'pending';
            }).length;
        }

        // Check if status changed
        let statusChanged = 0;
        const statusKey = `request_${requestId}_lastStatus`;
        const currentStatusKey = `request_${requestId}_currentStatus`;
        const lastStatus = localStorage.getItem(statusKey);
        const normalizedCurrentStatus = (currentStatus || '').toLowerCase();
        
        if (normalizedCurrentStatus) {
            localStorage.setItem(currentStatusKey, normalizedCurrentStatus);
        }
        
        const notifiableStatuses = ['fulfilled', 'completed', 'matched'];
        
        if (notifiableStatuses.includes(normalizedCurrentStatus)) {
            if (!lastStatus || (lastStatus && lastStatus !== normalizedCurrentStatus)) {
                statusChanged = 1;
            }
        }
        
        if (normalizedCurrentStatus && statusChanged === 0) {
            localStorage.setItem(statusKey, normalizedCurrentStatus);
        }
        
        // Check if this is a new INSTANT MATCH request
        let newRequest = 0;
        if (isNewRequest && currentUser) {
            const normalizedCurrentStatus = (currentStatus || '').toLowerCase();
            const isInstantMatch = normalizedCurrentStatus === 'matched' && 
                                  Array.isArray(offers) && offers.length === 0;
            
            // console.log(`[DEBUG] calculateUnreadCounts for request ${requestId}:`, {
            //     isNewRequest,
            //     normalizedCurrentStatus,
            //     offersLength: offers?.length,
            //     isInstantMatch,
            //     userRole: currentUser.role
            // });
            
            // Show badge for:
            // 1. Helpers/caregivers who received an instant match assignment
            // 2. Seniors whose instant match request got matched (they see it was matched)
            if (isInstantMatch) {
                if (currentUser.role === 'volunteer' || currentUser.role === 'caregiver') {
                    // Helper/caregiver: show as "New Instance Request"
                    newRequest = 1;
                    // console.log(`[DEBUG] Setting newRequest=1 for helper/caregiver`);
                } else if (currentUser.role === 'senior') {
                    // Senior: show as "Matched" (via statusChanged instead)
                    // Don't set newRequest for seniors, let statusChanged handle it
                    newRequest = 0;
                    // console.log(`[DEBUG] Senior - using statusChanged instead of newRequest`);
                }
            }
        }

        return { newReplies, newOffers, statusChanged, newRequest };
    } catch (e) {
        console.warn('Error calculating unread counts:', e);
        return { newReplies: 0, newOffers: 0, statusChanged: 0, newRequest: 0 };
    }
}

// Mark a request as viewed
function markRequestAsViewed(requestId) {
    try {
        const viewKey = `request_${requestId}_lastView`;
        localStorage.setItem(viewKey, new Date().toISOString());
        
        const statusKey = `request_${requestId}_lastStatus`;
        const currentStatusKey = `request_${requestId}_currentStatus`;
        const currentStatus = localStorage.getItem(currentStatusKey);
        if (currentStatus) {
            localStorage.setItem(statusKey, currentStatus);
        }
    } catch (e) {
        console.warn('Error marking request as viewed:', e);
    }
}

// Render notification badges in the header
function renderNotificationBadges(actionsHost, newReplies, newOffers, statusChanged, currentStatus, newRequest) {
    try {
        if (!actionsHost) return;

        let badgesHTML = '';
        
        if (newReplies > 0) {
            badgesHTML += `
                <span class="badge bg-danger position-relative" style="font-size: 0.75rem;">
                    <i class="fas fa-comment me-1"></i>+${newReplies} ${newReplies === 1 ? 'Reply' : 'Replies'}
                </span>
            `;
        }
        
        if (newOffers > 0) {
            badgesHTML += `
                <span class="badge bg-success position-relative ms-1" style="font-size: 0.75rem;">
                    <i class="fas fa-hands-helping me-1"></i>+${newOffers} ${newOffers === 1 ? 'Offer' : 'Offers'}
                </span>
            `;
        }
        
        if (statusChanged > 0) {
            const status = (currentStatus || '').toLowerCase();
            let badgeText = '+1 Update';
            let badgeIcon = 'fa-check-circle';
            let badgeColor = 'bg-primary';
            
            if (status === 'matched') {
                badgeText = '+1 Matched';
                badgeIcon = 'fa-handshake';
                badgeColor = 'bg-info';
            } else if (status === 'fulfilled' || status === 'completed') {
                badgeText = '+1 Completed';
                badgeIcon = 'fa-check-circle';
                badgeColor = 'bg-primary';
            }
            
            badgesHTML += `
                <span class="badge ${badgeColor} position-relative ms-1" style="font-size: 0.75rem;">
                    <i class="fas ${badgeIcon} me-1"></i>${badgeText}
                </span>
            `;
        }
        
        if (newRequest > 0) {
            badgesHTML += `
                <span class="badge bg-warning position-relative ms-1" style="font-size: 0.75rem;">
                    <i class="fas fa-star me-1"></i>+1 New Instance Request
                </span>
            `;
        }

        actionsHost.innerHTML = badgesHTML;
    } catch (e) {
        console.warn('Error rendering notification badges:', e);
    }
}

// Render offers list for a request
async function renderOffersForRequest(requestData, container, authManager, actionsHostRef = null) {
    try {
        const requestId = requestData.id || requestData.request_id || requestData.requestId || requestData.request || null;
        if (!requestId || !authManager || typeof authManager.authenticatedFetch !== 'function') return [];

        const response = await authManager.authenticatedFetch(`http://localhost:5002/requests/${requestId}/offers`);
        const data = await response.json();
        console.debug('[Offers] Loaded for request', requestId, 'count:', Array.isArray(data.offers) ? data.offers.length : 0);

        return Array.isArray(data.offers) ? data.offers : [];
    } catch (err) {
        console.error('Error loading offers for request in notifications:', err);
        return [];
    }
}

// Accept an offer from a helper
async function acceptOffer(offerId) {
    if (!confirm('Accept this volunteer\'s help?')) return;

    try {
        const authManager = await waitForAuthManager();
        const response = await authManager.authenticatedFetch(`http://localhost:5002/offers/${offerId}/accept`, {
            method: 'POST',
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ Offer accepted! Helper assigned.');
            await refreshMatchedRequests();
        } else {
            alert(`⚠️ ${data.error || 'Failed to accept offer.'}`);
        }
    } catch (err) {
        console.error('Error accepting offer:', err);
        alert('Something went wrong. Please try again.');
    }
}

// Reply to a response
async function replyToResponse(responseId) {
    const message = prompt('Enter your reply:');
    if (!message) return;

    try {
        const authManager = await waitForAuthManager();
        const resp = await authManager.authenticatedFetch(`http://localhost:5002/responses/${responseId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        if (resp && resp.ok) {
            // Find which request this response belongs to by looking at DOM context
            const responseElement = document.querySelector(`button[onclick*="replyToResponse(${responseId})"]`);
            if (responseElement) {
                const responsesContainer = responseElement.closest('.matched-request-responses');
                if (responsesContainer) {
                    const requestId = responsesContainer.getAttribute('data-request-id');
                    if (requestId) {
                        // Mark request as viewed so our own reply doesn't show as notification
                        markRequestAsViewed(requestId);
                    }
                }
            }
            
            await refreshMatchedRequests();
        } else {
            const data = resp ? await resp.json().catch(()=>({})) : {};
            alert('Failed to send reply: ' + (data.error || 'server error'));
        }
    } catch (err) {
        console.error('Error replying to response:', err);
        alert('Failed to reply: ' + err.message);
    }
}

// Refresh matched requests section
async function refreshMatchedRequests() {
    try {
        const authManager = await waitForAuthManager();
        const notificationsContainer = document.getElementById('notificationsList');
        if (!notificationsContainer) return;

        const role = currentUser?.role;
        let requests = [];

        // Fetch responses for a single request
        async function fetchResponses(requestId) {
            try {
                if (!requestId || !authManager || typeof authManager.authenticatedFetch !== 'function') return [];
                const resp = await authManager.authenticatedFetch(`http://localhost:5002/requests/${requestId}/responses`);
                if (!resp || !resp.ok) return [];
                const json = await resp.json();
                return json.responses || [];
            } catch {
                return [];
            }
        }

        // Fetch latest status for a request (helpers sometimes get stale status from /matches)
        async function fetchRequestStatus(requestId) {
            try {
                if (!requestId || !authManager || typeof authManager.authenticatedFetch !== 'function') return null;
                const resp = await authManager.authenticatedFetch(`http://localhost:5002/requests/${requestId}`);
                if (!resp || !resp.ok) return null;
                const json = await resp.json();
                const req = json.request || json;
                return (req.status || '').toLowerCase();
            } catch {
                return null;
            }
        }

        // Fetch matched requests based on role
        if (role === 'volunteer' || role === 'caregiver' || role === 'admin') {
            try {
                const resp = await authManager.authenticatedFetch('http://localhost:5002/matches');
                if (resp && resp.ok) {
                    const json = await resp.json();
                    requests = (json.matches || []).map(m => ({
                        id: m.request?.id || m.request_id || m.id,
                        title: m.request?.title || m.title || 'Request',
                        description: m.request?.description || m.description || '',
                        status: m.request_status || m.request?.status || m.status || 'matched',
                        category: m.request?.category || m.category || '',
                        urgency: m.request?.urgency || m.urgency || '',
                        created_at: m.request?.created_at || m.request?.createdAt || m.created_at || m.createdAt || m.matched_at || m.matchedAt,
                        requester_name: m.request?.requester_name || m.requester_name,
                        requester_role: m.request?.requester_role || m.requester_role,
                        raw: m.request || m
                    }));
                }
            } catch {}
        } else if (role === 'senior') {
            try {
                const resp = await authManager.authenticatedFetch('http://localhost:5002/requests');
                if (resp && resp.ok) {
                    const json = await resp.json();
                    // Get all requests for the senior (don't filter by status here - let filter buttons handle it)
                    requests = (json.requests || []).map(r => ({
                        id: r.id,
                        title: r.title || r.name || 'Request',
                        description: r.description || '',
                        status: r.status,
                        category: r.category || '',
                        urgency: r.urgency || '',
                        created_at: r.created_at || r.createdAt,
                        requester_name: r.requester_name,
                        requester_role: r.requester_role,
                        user_id: r.user_id || r.requester_id,
                        raw: r
                    }));
                    // console.log('[DEBUG] Senior requests fetched:', requests.map(r => ({ id: r.id, title: r.title, status: r.status })));
                }
            } catch {}
        }

        if (!requests || requests.length === 0) return;

        // Remove duplicates based on request ID
        const uniqueRequests = [];
        const seenIds = new Set();
        for (const req of requests) {
            const id = String(req.id);
            if (!seenIds.has(id)) {
                seenIds.add(id);
                uniqueRequests.push(req);
            }
        }

        // Fetch responses for all requests and, for helpers/caregivers, detect if they are matched
        const enriched = await Promise.all(uniqueRequests.map(async (req) => {
            const responses = await fetchResponses(req.id);

            // Default to the status from the API
            let computedStatus = (req.status || '').toLowerCase();

            // For helpers/caregivers, the status from /matches can be stale.
            if (role === 'volunteer' || role === 'caregiver') {
                try {
                    const latestStatus = await fetchRequestStatus(req.id);
                    const terminalStatuses = ['fulfilled', 'completed', 'closed', 'cancelled', 'canceled'];
                    if (latestStatus && terminalStatuses.includes(latestStatus)) {
                        computedStatus = latestStatus;
                    } else {
                        // Not terminal — infer 'matched' when my offer is accepted
                        try {
                            const offersResp = await authManager.authenticatedFetch(`http://localhost:5002/requests/${req.id}/offers`);
                            if (offersResp && offersResp.ok) {
                                const offersData = await offersResp.json();
                                const myId = String(currentUser?.id || '');
                                const hasAcceptedForMe = (offersData.offers || []).some(o => {
                                    const status = String(o.status || '').toLowerCase();
                                    const helperId = String(
                                        o.helper_id || o.helperId || o.helper_user_id || o.user_id || o.user || ''
                                    );
                                    return status === 'accepted' && helperId && helperId === myId;
                                });
                                if (hasAcceptedForMe && !terminalStatuses.includes(computedStatus)) {
                                    computedStatus = 'matched';
                                }
                            }
                        } catch (e) {
                            console.debug('[Notifications] Offers check failed for request', req.id, e);
                        }
                    }
                } catch {}
            }

            // Fallback: if computedStatus is still empty, use original
            if (!computedStatus) computedStatus = (req.status || '').toLowerCase() || 'matched';

            const latestReplyTime = responses.length > 0
                ? Math.max(...responses.map(r => new Date(r.created_at).getTime() || 0))
                : 0;
            const createdAtTime = new Date(req.created_at || req.raw?.created_at || req.raw?.createdAt || Date.now()).getTime() || 0;
            const latestActivity = latestReplyTime || createdAtTime;
            return { ...req, status: computedStatus, responses, latestReplyTime, latestActivity, createdAtTime };
        }));

        // Sort by latest activity
        enriched.sort((a, b) => (b.latestActivity || 0) - (a.latestActivity || 0));

        // Build new content in a document fragment (avoid clearing screen until ready)
        const fragment = document.createDocumentFragment();
        const header = document.createElement('div');
        header.className = 'mb-3';
        header.innerHTML = `<h5>Recently Matched Requests</h5>`;
        fragment.appendChild(header);

        // Render each request
        for (const req of enriched) {
            try {
                // console.log('[DEBUG] Rendering request:', req.id, 'Status:', req.status, 'Title:', req.title);
                const compact = document.createElement('div');
                compact.className = 'card mb-2';
                
                const normStatus = (req.status || '').toLowerCase();
                const statusClass = (normStatus === 'fulfilled' || normStatus === 'completed') ? 'bg-success text-white' : 
                                   normStatus === 'matched' ? 'bg-info text-white' : 
                                   'bg-secondary text-white';
                let statusText = 'Active';
                if (normStatus) {
                    const isHelper = currentUser && (currentUser.role === 'volunteer' || currentUser.role === 'caregiver');
                    if (isHelper && (normStatus === 'fulfilled' || normStatus === 'completed')) {
                        statusText = 'Completed';
                    } else {
                        statusText = normStatus.charAt(0).toUpperCase() + normStatus.slice(1);
                    }
                }
                
                // Format date safely
                let dateText = '';
                try {
                    if (req.created_at) {
                        const date = new Date(req.created_at);
                        if (!isNaN(date.getTime())) {
                            dateText = date.toLocaleString();
                        }
                    }
                } catch (e) {
                    console.warn('Date parsing error:', e);
                }
                
                compact.innerHTML = `
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-8">
                                <h5 class="mb-1">
                                    <a href="request-details.html?id=${req.id}" class="text-decoration-none link-dark" aria-label="View details for ${req.title}">
                                        ${req.title}
                                    </a>
                                </h5>
                                <p class="mb-1 text-muted small">${(req.description || '').substring(0, 100)}${(req.description || '').length > 100 ? '...' : ''}</p>
                                <div>
                                    <span class="badge bg-light text-dark me-2"><i class="fas fa-tag me-1"></i>${req.category}</span>
                                    <span class="badge bg-info text-white"><i class="fas fa-exclamation-circle me-1"></i>${req.urgency}</span>
                                </div>
                            </div>
                            <div class="col-md-4 text-end">
                                <div class="mb-2 d-flex flex-column align-items-end gap-2">
                                    <div>
                                        <span class="status-indicator ${statusClass}" style="padding:0.35rem 0.75rem;border-radius:20px;font-size:0.875rem;">
                                            <i class="fas ${statusClass.includes('success') ? 'fa-check-circle' : statusClass.includes('info') ? 'fa-user-check' : 'fa-clock'} me-1"></i>${statusText}
                                        </span>
                                    </div>
                                    <div class="request-actions" data-request-id="${req.id || ''}"></div>
                                </div>
                                ${dateText ? `<small class="text-muted">${dateText}</small>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                compact.setAttribute('data-request-id', req.id || '');

                const responsesDiv = document.createElement('div');
                responsesDiv.className = 'matched-request-responses p-3';
                responsesDiv.setAttribute('data-request-id', req.id || '');

                fragment.appendChild(compact);
                fragment.appendChild(responsesDiv);

                // If this request is matched, surface contact info card
                // try {
                //     if (String(req.status).toLowerCase() === 'matched') {
                //         renderContactInfoForRequest(req, responsesDiv);
                //     }
                // } catch {}

                // Add click event to mark request as viewed when user clicks on the card
                compact.addEventListener('click', (e) => {
                    // Don't mark as viewed if clicking on buttons or links
                    if (e.target.closest('button') || e.target.closest('a')) {
                        return;
                    }
                    markRequestAsViewed(req.id);
                    // Small delay before refresh to avoid immediate re-render
                    setTimeout(() => refreshMatchedRequests(), 150);
                });

                // Prepare reference to the header actions host inside this card
                const actionsHost = compact.querySelector(`.request-actions[data-request-id="${req.id || ''}"]`);

                // Fetch offers for this request
                let offers = [];
                if (req.status === 'pending' || req.status === 'open' || req.status === 'matched') {
                    offers = await renderOffersForRequest(req, responsesDiv, authManager, actionsHost);
                }

                // Calculate unread counts first, before auto-marking as viewed
                const { newReplies, newOffers, statusChanged, newRequest } = calculateUnreadCounts(req.id, req.responses, offers, req.status, req.created_at);
                
                // console.log(`[Badges] Request ${req.id} status: ${req.status}, badges: replies=${newReplies}, offers=${newOffers}, statusChanged=${statusChanged}, newRequest=${newRequest}`);

                // Auto-mark instant matches as viewed, mafter calculating badges
                // Instant matches have status='matched', no responses, and no offers
                // Also auto-mark for seniors viewing their own instant match requests
                const viewKey = `request_${req.id}_lastView`;
                const hasBeenViewed = localStorage.getItem(viewKey);
                const isInstantMatch = (req.status === 'matched') && 
                                      (req.responses.length === 0) && 
                                      (offers.length === 0);
                
                const isMyOwnRequest = currentUser && req.user_id && 
                                      String(req.user_id) === String(currentUser.id);
                
                const isSenior = currentUser && currentUser.role === 'senior';
                
                // Only auto-mark for seniors viewing their own instant match requests
                // Helpers/caregivers will keep the badge until they click on the request
                if (!hasBeenViewed && isInstantMatch && isSenior && isMyOwnRequest) {
                    // console.log(`[Auto-mark] Marking senior's own instant match ${req.id} as viewed`);
                    // Delay the mark so the badge shows on first render, then clears on next refresh
                    setTimeout(() => markRequestAsViewed(req.id), 1000);
                }

                // Render notification badges in the header
                // console.log(`[Badge Render] Request ${req.id}: replies=${newReplies}, offers=${newOffers}, statusChanged=${statusChanged}, newRequest=${newRequest}`);
                if (newReplies > 0 || newOffers > 0 || statusChanged > 0 || newRequest > 0) {
                    // console.log(`[Badge Render] Rendering badges for request ${req.id}`);
                    renderNotificationBadges(actionsHost, newReplies, newOffers, statusChanged, req.status, newRequest);
                } else {
                    // console.log(`[Badge Render] No badges to render for request ${req.id}`);
                    // If no new items, show Accept Offer button for seniors with pending offers
                    const pendingOffers = offers.filter(o => (o.status || '').toLowerCase() === 'pending');
                    const isOwner = String(req.user_id || req.requester_id) === String(currentUser?.id);
                    if (currentUser?.role === 'senior' && isOwner && pendingOffers.length > 0) {
                        if (pendingOffers.length === 1) {
                            const offer = pendingOffers[0];
                            actionsHost.innerHTML = `
                                <button class="btn btn-success btn-sm" onclick="acceptOffer(${offer.id})">
                                    <i class="fas fa-check me-1"></i>Accept Offer
                                </button>
                            `;
                        } else {
                            actionsHost.innerHTML = `
                                <span class="badge bg-primary">
                                    <i class="fas fa-hands-helping me-1"></i>${pendingOffers.length} Offers
                                </span>
                            `;
                        }
                    }
                }

                if (req.responses && req.responses.length > 0) {
                    renderResponseItems(req.responses, responsesDiv, req.id);
                } else {
                    // Show "no messages" for all requests without responses
                    responsesDiv.innerHTML = `<div class="text-muted small mb-3">No messages yet for this match.</div>`;
                }
            } catch (e) {
                console.warn('Error rendering matched request', req.id, e);
            }
        }
        
        // Clear container and append all content at once (prevents blank screen flicker)
        notificationsContainer.innerHTML = '';
        notificationsContainer.appendChild(fragment);
        
        // Reapply the current filter after refresh to maintain user's view
        if (currentFilter) {
            filterNotifications(currentFilter);
        }
    } catch (err) {
        console.error('Error refreshing matched requests:', err);
    }
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        localStorage.setItem('lastNotificationVisit', new Date().toISOString());

        const authManager = await waitForAuthManager();
        await authManager.initialize();

        const isAuthenticated = await authManager.checkAuthentication();
        if (!isAuthenticated) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = authManager.getCurrentUser();

        await Promise.all([
            loadNotifications(),
            loadEmailPreferences()
        ]);

        filterNotifications('all-requests');

        // Email preferences toggle handler
        const emailToggleEl = document.getElementById('emailNotificationsEnabled');
        if (emailToggleEl) {
            emailToggleEl.addEventListener('change', async function() {
                const turningOn = this.checked === true;
                const title = turningOn ? 'Enable Email Notifications' : 'Disable Email Notifications';
                const message = turningOn
                    ? 'Do you wish to enable email notifications?'
                    : 'Do you wish to disable email notifications?';
                const confirmText = turningOn ? 'Enable' : 'Disable';
                const confirmClass = turningOn ? 'btn-primary' : 'btn-danger';

                const confirmed = await confirmWithModal({ title, message, confirmText, confirmBtnClass: confirmClass });
                if (!confirmed) {
                    this.checked = !turningOn;
                    return;
                }

                const prefs = document.getElementById('emailPreferences');
                const emailInput = document.getElementById('notificationEmail');
                if (turningOn) {
                    prefs.style.display = 'block';
                    if (emailInput) {
                        if (!emailInput.value && currentUser && currentUser.email) {
                            emailInput.value = currentUser.email;
                        }
                        emailInput.readOnly = true;
                        emailInput.classList.add('bg-light');
                    }
                } else {
                    prefs.style.display = 'none';
                }

                saveEmailPreferences();
            });
        }

        // Role-based visibility
        try {
            const pendingResponseBtn = document.getElementById('filter-pending-response');
            if (pendingResponseBtn && currentUser) {
                pendingResponseBtn.style.display = (currentUser.role === 'senior') ? 'inline-block' : 'none';
            }
        } catch (e) {
            console.warn('Error setting role-based preference visibility:', e);
        }

        document.getElementById('loadingOverlay').style.display = 'none';

        // Logout handler
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to logout?')) {
                    await authManager.logout();
                }
            });
        }

        // Show My Requests menu item for seniors
        if (currentUser.role === 'senior') {
            const myRequestsMenuItem = document.getElementById('myRequestsMenuItem');
            if (myRequestsMenuItem) {
                myRequestsMenuItem.style.display = 'block';
            }
        }

        // Start auto-refresh polling
        if (!notificationsPoller) {
            refreshMatchedRequests();
            notificationsPoller = setInterval(() => {
                // console.log('[Auto-refresh] Checking for new replies in matched requests...');
                refreshMatchedRequests();
            }, 5000);
        }
    } catch (err) {
        console.error('Error initializing page:', err);
        document.getElementById('loadingOverlay').innerHTML = `
            <div class="text-center">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h4>Failed to Load</h4>
                <p class="text-muted">${err.message}</p>
                <a href="dashboard.html" class="btn btn-primary">
                    <i class="fas fa-home me-1"></i>Return to Dashboard
                </a>
            </div>
        `;
    }
});

// Clean up the poller when navigating away
window.addEventListener('beforeunload', () => {
    if (notificationsPoller) {
        clearInterval(notificationsPoller);
        notificationsPoller = null;
    }
});

// Make functions globally accessible for onclick handlers
window.filterNotifications = filterNotifications;
window.markAsRead = markAsRead;
window.markAllAsRead = markAllAsRead; // Commented out - function not defined
window.acceptOffer = acceptOffer;
window.replyToResponse = replyToResponse;