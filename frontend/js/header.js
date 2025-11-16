/**
 * Common Header Component
 * Loads and manages the navigation header for all pages
 */

class HeaderManager {
    constructor() {
        this.headerLoaded = false;
        this.authManager = null;
    }

    /**
     * Wait for AuthManager to be available
     */
    async waitForAuthManager() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;

            const checkAuthManager = () => {
                attempts++;
                
                if (window.AuthManager && 
                    typeof window.AuthManager === 'object' && 
                    typeof window.AuthManager.initialize === 'function') {
                    resolve(window.AuthManager);
                } else if (attempts >= maxAttempts) {
                    reject(new Error('AuthManager not available'));
                } else {
                    setTimeout(checkAuthManager, 100);
                }
            };
            
            checkAuthManager();
        });
    }

    /**
     * Load the header HTML into the page
     */
    async loadHeader() {
        try {
            // Create header container if it doesn't exist
            let headerContainer = document.getElementById('commonHeader');
            if (!headerContainer) {
                headerContainer = document.createElement('div');
                headerContainer.id = 'commonHeader';
                document.body.insertBefore(headerContainer, document.body.firstChild);
            }

            // Fetch header HTML
            const response = await fetch('/components/header.html');
            if (!response.ok) {
                throw new Error('Failed to load header');
            }

            const headerHTML = await response.text();
            headerContainer.innerHTML = headerHTML;
            this.headerLoaded = true;

            // ✅ Move modal to body to fix z-index / overlay issues
            const modal = document.getElementById('headerConfirmModal');
            if (modal && !document.body.contains(modal)) {
                document.body.appendChild(modal);
            }

            // Initialize header after loading
            await this.initializeHeader();

        } catch (error) {
            console.error('Error loading header:', error);
            this.headerLoaded = false;
        }
    }

    /**
     * Initialize header with user data and event listeners
     */
    async initializeHeader() {
        try {
            // Wait for AuthManager
            this.authManager = await this.waitForAuthManager();
            await this.authManager.initialize();

            // Check authentication
            const isAuthenticated = await this.authManager.checkAuthentication();
            if (!isAuthenticated) {
                return; // Don't show header on login pages
            }

            // Get current user
            const currentUser = this.authManager.getCurrentUser();
            if (currentUser) {
                this.updateHeaderUserInfo(currentUser);
                this.setupEventListeners();
            }

        } catch (error) {
            console.error('Error initializing header:', error);
        }
    }

    /**
     * Update header with user information
     */
    updateHeaderUserInfo(user) {
        if (!user) return;

        const displayName = user.firstname && user.lastname
            ? `${user.firstname} ${user.lastname}`
            : user.firstname || user.email || 'User';

        // Update desktop header
        const userNameElement = document.getElementById('headerUserName');
        if (userNameElement) {
            userNameElement.textContent = displayName;
        }

        const avatarElement = document.getElementById('headerUserAvatar');
        if (avatarElement) {
            this.setAvatarImage(avatarElement, user.picture, displayName);
        }

        // Update mobile side panel
        const mobileNameElement = document.getElementById('mobileSidePanelName');
        if (mobileNameElement) {
            mobileNameElement.textContent = displayName;
        }

        const mobileAvatarElement = document.getElementById('mobileSidePanelAvatar');
        if (mobileAvatarElement) {
            this.setAvatarImage(mobileAvatarElement, user.picture, displayName);
        }

        // Role-based visibility for desktop
        const myRequestsItem = document.getElementById('headerMyRequestsMenuItem');
        if (myRequestsItem && user.role === 'senior') {
            myRequestsItem.style.display = 'block';
        }

        const adminItem = document.getElementById('headerAdminMenuItem');
        if (adminItem && user.role === 'admin') {
            adminItem.style.display = 'block';
        }

        // Show messages and friends links for seniors (desktop)
        if (user.role === 'senior') {
            const messagesLink = document.getElementById('messagesLink');
            const friendsLink = document.getElementById('friendsLink');
            
            if (messagesLink) messagesLink.style.display = 'block';
            if (friendsLink) friendsLink.style.display = 'block';
        }

        // Role-based visibility for mobile side panel
        const mobileMyRequests = document.getElementById('mobileSidePanelMyRequests');
        if (mobileMyRequests && user.role === 'senior') {
            mobileMyRequests.style.display = 'flex';
        }

        const mobileAdmin = document.getElementById('mobileSidePanelAdmin');
        if (mobileAdmin && user.role === 'admin') {
            mobileAdmin.style.display = 'flex';
        }

        const mobileMessages = document.getElementById('mobileSidePanelMessages');
        const mobileFriends = document.getElementById('mobileSidePanelFriends');
        if (user.role === 'senior') {
            if (mobileMessages) mobileMessages.style.display = 'flex';
            if (mobileFriends) mobileFriends.style.display = 'flex';
        }
        
        // Load unread counts for all users
        this.loadUnreadCounts();
    }

    /**
     * Set avatar image with fallback
     */
    setAvatarImage(element, pictureUrl, displayName) {
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6c757d&color=fff`;
        
        let avatarUrl = fallbackUrl;
        if (pictureUrl && typeof pictureUrl === 'string' && pictureUrl.trim().length > 0 && pictureUrl !== 'null') {
            avatarUrl = pictureUrl;
        }
        
        element.alt = displayName;
        element.src = fallbackUrl;
        
        element.onerror = function() {
            console.warn('[Header] Failed to load profile picture, using fallback');
            this.onerror = null;
            this.src = fallbackUrl;
        };
        
        element.src = avatarUrl;
    }

    /**
     * Load unread messages, friend requests, and notification counts
     */
    async loadUnreadCounts() {
        try {
            if (!this.authManager) return;

            // Load notification count
            try {
                const notifResponse = await this.authManager.authenticatedFetch('http://localhost:5002/notifications');
                const notifData = await notifResponse.json();
                
                if (notifResponse.ok && notifData.notifications) {
                    const unreadCount = this.calculateUnreadNotifications(notifData.notifications);
                    
                    // Update desktop badge
                    const badge = document.getElementById('notificationCount');
                    if (badge) {
                        if (unreadCount > 0) {
                            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                            badge.style.display = 'inline';
                        } else {
                            badge.style.display = 'none';
                        }
                    }

                    // Update mobile badge
                    const mobileBadge = document.getElementById('mobileNotificationCount');
                    if (mobileBadge) {
                        if (unreadCount > 0) {
                            mobileBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                            mobileBadge.style.display = 'inline';
                        } else {
                            mobileBadge.style.display = 'none';
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading notification count:', error);
            }

            // Load unread messages count
            try {
                const messagesResponse = await this.authManager.authenticatedFetch('http://localhost:5008/messages/unread/count');
                const messagesData = await messagesResponse.json();
                
                if (messagesResponse.ok && messagesData.unreadCount > 0) {
                    // Update desktop badge
                    const badge = document.getElementById('unreadMessagesCount');
                    if (badge) {
                        badge.textContent = messagesData.unreadCount;
                        badge.style.display = 'inline';
                    }

                    // Update mobile badge
                    const mobileBadge = document.getElementById('mobileUnreadMessagesCount');
                    if (mobileBadge) {
                        mobileBadge.textContent = messagesData.unreadCount;
                        mobileBadge.style.display = 'inline';
                    }
                }
            } catch (error) {
                console.error('Error loading unread messages count:', error);
            }

            // Load friend requests count
            try {
                const requestsResponse = await this.authManager.authenticatedFetch('http://localhost:5008/friends/requests');
                const requestsData = await requestsResponse.json();
                
                if (requestsResponse.ok && requestsData.count > 0) {
                    // Update desktop badge
                    const badge = document.getElementById('friendRequestsCount');
                    if (badge) {
                        badge.textContent = requestsData.count;
                        badge.style.display = 'inline';
                    }

                    // Update mobile badge
                    const mobileBadge = document.getElementById('mobileFriendRequestsCount');
                    if (mobileBadge) {
                        mobileBadge.textContent = requestsData.count;
                        mobileBadge.style.display = 'inline';
                    }
                }
            } catch (error) {
                console.error('Error loading friend requests count:', error);
            }

            // Refresh counts every 30 seconds
            setTimeout(() => this.loadUnreadCounts(), 30000);
        } catch (error) {
            console.error('Error in loadUnreadCounts:', error);
        }
    }

    /**
     * Calculate unread notification count from notification data
     */
    calculateUnreadNotifications(notifications) {
        try {
            if (!Array.isArray(notifications)) return 0;

            const lastVisit = localStorage.getItem('lastNotificationVisit');
            const lastVisitDate = lastVisit ? new Date(lastVisit) : new Date(0);
            
            let unreadCount = 0;

            for (const notification of notifications) {
                // Count new offers
                if (notification.offers && Array.isArray(notification.offers)) {
                    const newOffers = notification.offers.filter(offer => 
                        new Date(offer.created_at) > lastVisitDate
                    );
                    unreadCount += newOffers.length;
                }

                // Count new responses
                if (notification.responses && Array.isArray(notification.responses)) {
                    const newResponses = notification.responses.filter(response => 
                        new Date(response.created_at) > lastVisitDate
                    );
                    unreadCount += newResponses.length;
                }

                // Count status changes
                if (notification.status_changed_at && 
                    new Date(notification.status_changed_at) > lastVisitDate) {
                    unreadCount += 1;
                }
            }

            return unreadCount;
        } catch (error) {
            console.error('Error calculating unread notifications:', error);
            return 0;
        }
    }

    /**
     * Setup event listeners for header actions
     */
    setupEventListeners() {
        // Desktop logout
        const logoutBtn = document.getElementById('headerLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                this.showConfirmModal('Are you sure you want to log out?', async () => {
                    await this.handleLogout();
                });
            });
        }

        // Desktop switch account
        const switchAccountBtn = document.getElementById('headerSwitchAccountBtn');
        if (switchAccountBtn) {
            switchAccountBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                this.showConfirmModal('Are you sure you want to switch accounts?', async () => {
                    await this.handleSwitchAccount();
                });
            });
        }

        // Mobile menu button
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileSidePanel = document.getElementById('mobileSidePanel');
        const mobileSidePanelOverlay = document.getElementById('mobileSidePanelOverlay');
        
        if (mobileMenuBtn && mobileSidePanel && mobileSidePanelOverlay) {
            mobileMenuBtn.addEventListener('click', () => {
                this.openMobilePanel();
            });

            // Close panel button
            const closePanelBtn = document.getElementById('closePanelBtn');
            if (closePanelBtn) {
                closePanelBtn.addEventListener('click', () => {
                    this.closeMobilePanel();
                });
            }

            // Close panel when clicking overlay
            mobileSidePanelOverlay.addEventListener('click', () => {
                this.closeMobilePanel();
            });
        }

        // Mobile logout
        const mobileLogoutBtn = document.getElementById('mobileSidePanelLogout');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                this.closeMobilePanel();
                this.showConfirmModal('Are you sure you want to log out?', async () => {
                    await this.handleLogout();
                });
            });
        }

        // Mobile switch account
        const mobileSwitchAccountBtn = document.getElementById('mobileSidePanelSwitchAccount');
        if (mobileSwitchAccountBtn) {
            mobileSwitchAccountBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                this.closeMobilePanel();
                this.showConfirmModal('Are you sure you want to switch accounts?', async () => {
                    await this.handleSwitchAccount();
                });
            });
        }
    }

    /**
     * Open mobile side panel
     */
    openMobilePanel() {
        const mobileSidePanel = document.getElementById('mobileSidePanel');
        const mobileSidePanelOverlay = document.getElementById('mobileSidePanelOverlay');
        
        if (mobileSidePanel && mobileSidePanelOverlay) {
            mobileSidePanel.classList.add('open');
            mobileSidePanelOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close mobile side panel
     */
    closeMobilePanel() {
        const mobileSidePanel = document.getElementById('mobileSidePanel');
        const mobileSidePanelOverlay = document.getElementById('mobileSidePanelOverlay');
        
        if (mobileSidePanel && mobileSidePanelOverlay) {
            mobileSidePanel.classList.remove('open');
            mobileSidePanelOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Handle logout action
     */
    async handleLogout() {
        if (!this.authManager) return;

        try {
            await this.authManager.logout();
            this.showMessage('You have been logged out successfully.', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            localStorage.removeItem('auth_token');
            window.location.href = '/login.html';
        }
    }

    /**
     * Handle switch account action
     */
    async handleSwitchAccount() {
        if (!this.authManager) return;

        try {
            this.authManager.removeToken();
            this.showMessage('Switching account...', 'info');
            setTimeout(() => {
                window.location.href = '/login.html?switch_account=true';
            }, 1000);
        } catch (error) {
            console.error('Switch account error:', error);
            document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            localStorage.removeItem('auth_token');
            window.location.href = '/login.html?switch_account=true';
        }
    }

    /**
     * Show confirmation modal
     */
    showConfirmModal(message, onConfirm) {
        const modalElement = document.getElementById('headerConfirmModal');
        const modalBody = document.getElementById('headerConfirmModalBody');
        const confirmBtn = document.getElementById('headerConfirmBtn');
        
        if (!modalElement || !modalBody || !confirmBtn) {
            console.error('Confirmation modal elements not found');
            return;
        }

        modalBody.textContent = message;
        const modal = new bootstrap.Modal(modalElement);

        // Remove old event listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newConfirmBtn.addEventListener('click', async () => {
            modal.hide();
            if (typeof onConfirm === 'function') {
                await onConfirm();
            }
        });

        modal.show();
    }

    /**
     * Show message to user
     */
    showMessage(message, type = 'info') {
        const alertClass = type === 'success' ? 'alert-success' : 
                          type === 'error' ? 'alert-danger' : 'alert-info';
        
        const alert = document.createElement('div');
        alert.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; min-width: 300px;';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alert);

        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }
}

// Create global instance
window.HeaderManager = new HeaderManager();

// Auto-load header when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.HeaderManager.loadHeader();
});