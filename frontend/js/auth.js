/**
 * Authentication Manager for OIDC/SSO and Email/Password
 * Handles authentication flow, token management, and user sessions
 */

class AuthManager {
    constructor() {
        //this.authServiceUrl = 'http://localhost:5001';
        this.authServiceUrl = window?.API_BASE?.AUTH_SERVICE || 'http://localhost:5001';
        this.currentUser = null;
        this.authConfig = null;
    }

    /**
     * Initialize authentication system
     */
    async initialize() {
        try {
            console.log('[AuthManager] Initializing authentication system...');
            this.showLoading(true);
            await this.loadAuthConfig();
            await this.setupAuthButtons();
            console.log('[AuthManager] Authentication system initialized successfully');
        } catch (error) {
            console.error('[AuthManager] Auth initialization error:', error);
            this.showError('Failed to initialize authentication system');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Load authentication configuration from server
     */
    async loadAuthConfig() {
        try {
            console.log('[AuthManager] Loading auth config from:', `${this.authServiceUrl}/auth-config`);
            const response = await fetch(`${this.authServiceUrl}/auth-config`);
            console.log('[AuthManager] Auth config response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const rawConfig = await response.json();
            console.log('[AuthManager] Raw auth config response:', rawConfig);
            
            // Handle both old and new config formats
            if (rawConfig.oidc && rawConfig.emailPassword) {
                // New format
                this.authConfig = rawConfig;
            } else if (rawConfig.provider) {
                // Old format - convert to new format
                this.authConfig = {
                    oidc: {
                        provider: rawConfig.provider,
                        providers: [rawConfig.provider],
                        auth_url: rawConfig.auth_url,
                        available: rawConfig.available
                    },
                    emailPassword: {
                        enabled: true,
                        endpoints: {
                            register: '/register',
                            login: '/login',
                            changePassword: '/change-password'
                        }
                    }
                };
            } else {
                // Fallback - assume email password is available
                this.authConfig = {
                    emailPassword: {
                        enabled: true,
                        endpoints: {
                            register: '/register',
                            login: '/login', 
                            changePassword: '/change-password'
                        }
                    }
                };
            }
            
            console.log('[AuthManager] Processed auth config:', this.authConfig);
        } catch (error) {
            console.error('[AuthManager] Failed to load auth config:', error);
            // Default to email/password only
            this.authConfig = {
                emailPassword: {
                    enabled: true,
                    endpoints: {
                        register: '/register',
                        login: '/login',
                        changePassword: '/change-password'
                    }
                }
            };
        }
    }

    /**
     * Set up authentication options (OIDC and Email/Password)
     */
    async setupAuthButtons() {
        const container = document.getElementById('authContainer');
        const oidcButtonsContainer = document.getElementById('oidcButtons');
        const oidcMainContainer = document.getElementById('oidcContainer');
        const emailContainer = document.getElementById('emailAuthContainer');
        const devNotice = document.getElementById('devNotice');
        
        console.log('[AuthManager] Setting up auth options with config:', this.authConfig);
        
        // Check if we have any authentication methods available
        const hasOIDC = this.authConfig?.oidc?.available && this.authConfig?.oidc?.providers?.length > 0;
        const hasEmailAuth = this.authConfig?.emailPassword?.enabled;
        
        if (!hasOIDC && !hasEmailAuth) {
            console.log('[AuthManager] No authentication methods available');
            if (devNotice) {
                devNotice.style.display = 'block';
            }
            return;
        }

        // Set up OIDC buttons if available
        if (hasOIDC && oidcButtonsContainer) {
            console.log('[AuthManager] Creating OIDC buttons for providers:', this.authConfig.oidc.providers);
            
            // Clear any existing buttons
            oidcButtonsContainer.innerHTML = '';
            
            // Create a button for each available provider
            this.authConfig.oidc.providers.forEach(provider => {
                const routes = this.authConfig.oidc.routes[provider];
                if (routes) {
                    console.log(`[AuthManager] Creating button for ${provider}:`, routes);
                    const button = this.createOIDCButton(provider, routes.auth);
                    oidcButtonsContainer.appendChild(button);
                }
            });
            
            // Show both the buttons container and its parent
            oidcButtonsContainer.style.display = 'block';
            if (oidcMainContainer) {
                oidcMainContainer.style.display = 'block';
            }
        }

        // Set up email/password form if available
        if (hasEmailAuth && emailContainer) {
            console.log('[AuthManager] Email/password authentication available');
            this.setupEmailAuthForm();
            emailContainer.style.display = 'block';
        }

        // Show divider if both methods are available
        const divider = document.getElementById('authDivider');
        if (divider && hasOIDC && hasEmailAuth) {
            divider.style.display = 'block';
        }
    }

    /**
     * Set up email/password authentication form
     */
    setupEmailAuthForm() {
        // Set up login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.loginWithEmail();
            });
        }

        // Set up register form submission  
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            console.log('[AuthManager] Register form found, adding event listener');
            registerForm.addEventListener('submit', async (e) => {
                console.log('[AuthManager] Register form submitted!');
                e.preventDefault();
                await this.registerWithEmail();
            });
        } else {
            console.error('[AuthManager] Register form not found!');
        }

        // Set up form switching
        const showRegisterBtn = document.getElementById('showRegister');
        const showLoginBtn = document.getElementById('showLogin');
        
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', () => this.showRegisterForm());
        }
        
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', () => this.showLoginForm());
        }
    }

    /**
     * Create OIDC authentication button for specific provider
     */
    createOIDCButton(provider, authUrl) {
        console.log('[AuthManager] Creating OIDC button for provider:', provider, 'with URL:', authUrl);
        
        const button = document.createElement('a');
        button.className = 'oidc-button';
        
        // Add account selection prompt for both Google and Microsoft to force account picker
        let finalAuthUrl = `${this.authServiceUrl}${authUrl}`;
        if (provider === 'azure' || provider === 'google') {
            // Add prompt parameter to force account selection for switching accounts
            const separator = authUrl.includes('?') ? '&' : '?';
            finalAuthUrl += `${separator}prompt=select_account`;
        }
        
        button.href = finalAuthUrl;
        
        const config = this.getProviderConfig(provider);
        button.classList.add(config.className);
        
        button.innerHTML = `
            <i class="${config.icon}"></i>
            ${config.text}
        `;
        
        console.log('[AuthManager] OIDC button created with href:', button.href);
        
        // Add click tracking
        button.addEventListener('click', () => {
            this.trackAuthAttempt(provider);
        });
        
        return button;
    }

    /**
     * Login with email and password
     */
    async loginWithEmail() {
        try {
            const email = document.getElementById('email')?.value;
            const password = document.getElementById('password')?.value;

            if (!email || !password) {
                this.showError('Please enter both email and password');
                return;
            }

            this.showLoading(true);
            this.clearError();

            const response = await fetch(`${this.authServiceUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('[AuthManager] Email login successful:', data);
                this.currentUser = data.user;
                
                // Redirect based on user role
                if (data.user.role === 'admin') {
                    window.location.href = '/admin.html?authenticated=true';
                } else {
                    window.location.href = '/dashboard.html?authenticated=true';
                }
            } else {
                this.showError(data.error || 'Login failed');
            }

        } catch (error) {
            console.error('[AuthManager] Email login error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Register with email and password
     */
    async registerWithEmail() {
        console.log('[AuthManager] registerWithEmail() called');
        try {
            // Check if form elements exist
            const firstnameEl = document.getElementById('regFirstName');
            const lastnameEl = document.getElementById('reglastname');
            const emailEl = document.getElementById('regEmail');
            const passwordEl = document.getElementById('regPassword');
            const confirmPasswordEl = document.getElementById('regConfirmPassword');
            const roleEl = document.getElementById('regRole');
            const locationEl = document.getElementById('regLocation');
            
            console.log('[AuthManager] Form elements found:', {
                firstname: !!firstnameEl,
                lastname: !!lastnameEl,
                email: !!emailEl,
                password: !!passwordEl,
                confirmPassword: !!confirmPasswordEl,
                role: !!roleEl,
                location: !!locationEl
            });

            const firstname = firstnameEl?.value?.trim();
            const lastname = lastnameEl?.value?.trim();
            const email = emailEl?.value?.trim();
            const password = passwordEl?.value;
            const confirmPassword = confirmPasswordEl?.value;
            const role = roleEl?.value || 'senior';
            const location = locationEl?.value?.trim();

            // Client-side validation
            console.log('[AuthManager] Form values:', { firstname, lastname, email, password: '***', confirmPassword: '***', role, location });
            
            const missingFields = [];
            if (!firstname) missingFields.push('First Name');
            if (!lastname) missingFields.push('Last Name');
            if (!email) missingFields.push('Email');
            if (!password) missingFields.push('Password');
            if (!confirmPassword) missingFields.push('Confirm Password');
            if (!location) missingFields.push('Postal Code');
            
            if (missingFields.length > 0) {
                this.showError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
                return;
            }

            if (password !== confirmPassword) {
                this.showError('Passwords do not match');
                return;
            }

            // Validate postal code format (6 digits)
            const postalCodeRegex = /^\d{6}$/;
            if (!postalCodeRegex.test(location)) {
                this.showError('Please enter a valid 6-digit postal code');
                return;
            }

            // Validate password strength on frontend as well
            const passwordValidation = this.validatePasswordStrength(password);
            if (!passwordValidation.isValid) {
                this.showError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                this.showError('Please enter a valid email address');
                return;
            }

            this.showLoading(true);
            this.clearError();

            const response = await fetch(`${this.authServiceUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    firstname: firstname.trim(), 
                    lastname: lastname.trim(),
                    email: email.trim(), 
                    password: password, 
                    role: role || 'senior', 
                    location: location.trim() || null 
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('[AuthManager] Registration initiated, requires verification:', data);
                
                if (data.requiresVerification) {
                    // Redirect to verification page
                    window.location.href = `/verify-email.html?email=${encodeURIComponent(email)}&type=signup`;
                } else {
                    // Old flow - direct registration (backward compatibility)
                    this.currentUser = data.user;
                    this.showSuccess('Registration successful! Welcome to KampungConnect.');
                    setTimeout(() => {
                        // Redirect based on user role
                        if (data.user.role === 'admin') {
                            window.location.href = '/admin.html?authenticated=true';
                        } else {
                            window.location.href = '/dashboard.html?authenticated=true';
                        }
                    }, 1500);
                }
            } else {
                if (data.messages && Array.isArray(data.messages)) {
                    this.showError(data.messages.join('<br>'));
                } else {
                    this.showError(data.error || 'Registration failed');
                }
            }

        } catch (error) {
            console.error('[AuthManager] Email registration error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Show login form and hide register form
     */
    showLoginForm() {
        const loginForm = document.getElementById('loginFormContainer');
        const registerForm = document.getElementById('registerFormContainer');
        
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        
        this.clearError();
    }

    /**
     * Show register form and hide login form  
     */
    showRegisterForm() {
        const loginForm = document.getElementById('loginFormContainer');
        const registerForm = document.getElementById('registerFormContainer');
        
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        
        this.clearError();
    }

    /**
     * Get provider-specific configuration
     */
    getProviderConfig(provider) {
        const configs = {
            google: {
                text: 'Continue with Google',
                icon: 'fab fa-google',
                className: 'google-btn'
            },
            azure: {
                text: 'Continue with Microsoft',
                icon: 'fab fa-microsoft',
                className: 'microsoft-btn'
            },
        };
        
        return configs[provider] || {
            text: `Continue with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
            icon: 'fas fa-sign-in-alt',
            className: 'generic-btn'
        };
    }

    /**
     * Check if user is authenticated
     */
    async checkAuthentication() {
        try {
            console.log('[AuthManager] Checking authentication...');
            const token = this.getToken();
            console.log('[AuthManager] Token found:', !!token);
            
            if (!token) {
                console.log('[AuthManager] No token found, user not authenticated');
                return false;
            }

            // First check if token format is valid
            if (!this.isTokenFormatValid(token)) {
                console.log('[AuthManager] Token format invalid, removing...');
                this.removeToken();
                return false;
            }

            console.log('[AuthManager] Validating token with server...');
            const response = await fetch(`${this.authServiceUrl}/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                // Add timeout to prevent hanging
                signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
            });

            console.log('[AuthManager] Server response status:', response.status);

            if (response.ok) {
                this.currentUser = await response.json();
                console.log('[AuthManager] User authenticated successfully:', this.currentUser);
                return true;
            }
            
            // Check if account is suspended
            if (response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                console.log('[AuthManager] Account suspended, removing token');
                this.removeToken();
                
                // Show error message if available
                if (errorData.message) {
                    alert(errorData.message);
                } else {
                    alert('Your account has been suspended. Please contact the administrator.');
                }
                
                // Redirect to login
                window.location.href = '/login.html?error=account_suspended';
                return false;
            }
            
            // Token is invalid, remove it
            console.log('[AuthManager] Token invalid (status: ' + response.status + '), removing...');
            this.removeToken();
            return false;
        } catch (error) {
            console.error('[AuthManager] Authentication check error:', error);
            
            // Only remove token if it's an authentication error, not a network error
            if (error.message === 'Authentication expired') {
                console.log('[AuthManager] Authentication expired, removing token');
                this.removeToken();
                return false;
            }
            
            // For network errors (timeout or connection), keep the token and assume still authenticated
            if (error.name === 'AbortError' || 
                error.name === 'TypeError' || 
                error.name === 'TimeoutError' ||
                (error.message && (error.message.includes('timed out') || error.message.includes('aborted')))) {
                console.warn('[AuthManager] Network/timeout error during auth check, keeping token');
                return this.currentUser !== null; // Return true if we have cached user
            }
            
            // For other errors, remove token to be safe
            console.log('[AuthManager] Unknown error during auth check, removing token');
            this.removeToken();
            return false;
        }
    }

    /**
     * Get current user information
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Wait for authentication and return user
     * This is useful for pages that need to wait for auth to complete
     */
    async waitForAuth() {
        console.log('[AuthManager] waitForAuth called');
        const isAuthenticated = await this.checkAuthentication();
        if (!isAuthenticated) {
            console.log('[AuthManager] User not authenticated, redirecting to login');
            window.location.href = '/login.html';
            throw new Error('Not authenticated');
        }
        console.log('[AuthManager] User authenticated:', this.currentUser);
        return this.currentUser;
    }

    /**
     * Get authentication token from cookie or localStorage
     */
    getToken() {
        // Try cookie first
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'auth_token') {
                return value;
            }
        }
        
        // Fallback to localStorage
        const localToken = localStorage.getItem('auth_token');
        if (!localToken) {
            console.log('[AuthManager] No token found in cookie or localStorage');
        }
        return localToken;
    }

    /**
     * Remove authentication token
     */
    removeToken() {
        console.log('[AuthManager] Removing authentication tokens...');
        // Remove from cookie
        document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        // Remove from localStorage
        localStorage.removeItem('auth_token');
        // Clear current user
        this.currentUser = null;
    }

    /**
     * Check if token appears valid (basic format check)
     */
    isTokenFormatValid(token) {
        if (!token || typeof token !== 'string') {
            return false;
        }
        
        // JWT tokens have 3 parts separated by dots
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.log('[AuthManager] Token format invalid - not a JWT');
            return false;
        }
        
        try {
            // Try to decode the payload (second part)
            const payload = JSON.parse(atob(parts[1]));
            
            // Check if token is expired
            if (payload.exp && payload.exp < Date.now() / 1000) {
                console.log('[AuthManager] Token expired');
                return false;
            }
            
            return true;
        } catch (error) {
            console.log('[AuthManager] Token format invalid - cannot decode:', error);
            return false;
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await fetch(`${this.authServiceUrl}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.removeToken();
            this.currentUser = null;
            window.location.href = '/login.html';
        }
    }

    /**
     * Make authenticated API request
     */
    async authenticatedFetch(url, options = {}) {
        const token = this.getToken();
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeout = options.timeout || 10000; // 10 seconds default
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Handle token expiration
            if (response.status === 401 || response.status === 403) {
                this.removeToken();
                window.location.href = '/login.html';
                throw new Error('Authentication expired');
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            // Don't redirect on timeout or network errors
            if (error.name === 'AbortError' || error.name === 'TypeError') {
                console.warn('[AuthManager] Request failed:', error.message);
                throw error;
            }
            
            throw error;
        }
    }

    /**
     * Track authentication attempt for analytics
     */
    trackAuthAttempt(provider) {
        console.log(`Authentication attempt with provider: ${provider}`);
        // Add analytics tracking here if needed
    }

    /**
     * Show/hide loading state
     */
    showLoading(show) {
        const loading = document.getElementById('loadingState');
        const options = document.getElementById('loginOptions');
        
        console.log('[AuthManager] showLoading called:', show, 'loading element:', loading, 'options element:', options);
        
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
        if (options) {
            options.style.display = show ? 'none' : 'block';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorAlert && errorMessage) {
            errorMessage.textContent = message;
            errorAlert.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorAlert.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorAlert && errorMessage) {
            errorMessage.textContent = message;
            errorAlert.className = 'alert alert-success';
            errorAlert.style.display = 'block';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                errorAlert.style.display = 'none';
                errorAlert.className = 'alert alert-danger'; // Reset to default
            }, 3000);
        }
    }

    /**
     * Clear error message
     */
    clearError() {
        const errorAlert = document.getElementById('errorAlert');
        if (errorAlert) {
            errorAlert.style.display = 'none';
        }
    }

    /**
     * Validate password strength
     */
    validatePasswordStrength(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        const isValid = password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;

        return {
            isValid,
            messages: isValid ? [] : [
                password.length < minLength ? `Password must be at least ${minLength} characters long` : '',
                !hasUpperCase ? 'Password must contain at least one uppercase letter' : '',
                !hasLowerCase ? 'Password must contain at least one lowercase letter' : '',
                !hasNumbers ? 'Password must contain at least one number' : '',
                !hasSpecialChar ? 'Password must contain at least one special character' : ''
            ].filter(msg => msg !== '')
        };
    }
}

// Create global instance - ensure it's available
if (typeof window !== 'undefined') {
    try {
        // Ensure we don't create multiple instances
        if (!window.AuthManager) {
            console.log('[AuthManager] Creating new instance...');
            const authManagerInstance = new AuthManager();
            
            // Verify the instance has the expected methods
            const requiredMethods = ['initialize', 'checkAuthentication', 'removeToken', 'logout'];
            const missingMethods = requiredMethods.filter(method => typeof authManagerInstance[method] !== 'function');
            
            if (missingMethods.length > 0) {
                console.error('[AuthManager] Missing methods:', missingMethods);
                throw new Error('AuthManager instance missing required methods: ' + missingMethods.join(', '));
            }
            
            window.AuthManager = authManagerInstance;
            console.log('[AuthManager] Global instance created successfully:', window.AuthManager);
        } else {
            console.log('[AuthManager] Global instance already exists');
        }
    } catch (error) {
        console.error('[AuthManager] Failed to create instance:', error);
        // Create a fallback object to prevent errors
        window.AuthManager = {
            error: error.message,
            initialize: () => Promise.reject(new Error('AuthManager failed to initialize: ' + error.message)),
            checkAuthentication: () => Promise.resolve(false),
            removeToken: () => {
                document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                localStorage.removeItem('auth_token');
            },
            logout: () => {
                document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                localStorage.removeItem('auth_token');
                window.location.href = '/login.html';
            }
        };
    }
} else {
    console.error('[AuthManager] Window object not available');
}

// Export for module compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}