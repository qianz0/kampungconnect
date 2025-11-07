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

        const userNameElement = document.getElementById('headerUserName');
        if (userNameElement) {
            userNameElement.textContent = displayName;
        }

        const avatarElement = document.getElementById('headerUserAvatar');
        if (avatarElement) {
            const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6c757d&color=fff`;
            
            // If user has a picture URL and it's valid, use it; otherwise use fallback
            let avatarUrl = fallbackUrl;
            if (user.picture && typeof user.picture === 'string' && user.picture.trim().length > 0 && user.picture !== 'null') {
                avatarUrl = user.picture;
            }
            
            console.log('[Header] User picture value:', user.picture);
            console.log('[Header] Using avatar URL:', avatarUrl);
            
            avatarElement.alt = displayName;
            
            // Set fallback first to ensure something always displays
            avatarElement.src = fallbackUrl;
            
            // Add error handler before setting the actual URL
            avatarElement.onerror = function() {
                console.warn('[Header] Failed to load profile picture, using fallback');
                this.onerror = null; // Prevent infinite loop
                this.src = fallbackUrl;
            };
            
            // Now set the actual URL (might be same as fallback)
            avatarElement.src = avatarUrl;
        }

        // Role-based visibility
        const myRequestsItem = document.getElementById('headerMyRequestsMenuItem');
        if (myRequestsItem && user.role === 'senior') {
            myRequestsItem.style.display = 'block';
        }

        const adminItem = document.getElementById('headerAdminMenuItem');
        if (adminItem && user.role === 'admin') {
            adminItem.style.display = 'block';
        }
    }

    /**
     * Setup event listeners for header actions
     */
    setupEventListeners() {
        const logoutBtn = document.getElementById('headerLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                this.showConfirmModal('Are you sure you want to log out?', async () => {
                    await this.handleLogout();
                });
            });
        }

        const switchAccountBtn = document.getElementById('headerSwitchAccountBtn');
        if (switchAccountBtn) {
            switchAccountBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                this.showConfirmModal('Are you sure you want to switch accounts?', async () => {
                    await this.handleSwitchAccount();
                });
            });
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