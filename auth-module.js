// auth-module.js - Unified Authentication System
class KartelAuth {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.isAdmin = false;
        this.token = localStorage.getItem('kartel_auth_token');
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('🚀 Initializing Kartel Authentication System');
        
        // Check for magic link token in URL first
        const urlParams = new URLSearchParams(window.location.search);
        const magicToken = urlParams.get('token');
        
        if (magicToken) {
            console.log('🔗 Magic link token found in URL, verifying...');
            await this.verifyMagicToken(magicToken);
            return;
        }
        
        // Check for existing authentication
        if (this.token) {
            console.log('🔍 Found existing token, verifying...');
            await this.verifyToken();
        } else {
            console.log('🔄 No existing token found');
            this.showLogin();
        }
    }

    async verifyToken() {
        try {
            const response = await fetch('/.netlify/functions/verify-login-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ token: this.token })
            });

            if (response.ok) {
                const data = await response.json();
                this.setUserData(data);
                this.onAuthSuccess();
            } else {
                console.log('❌ Token verification failed');
                this.clearAuth();
                this.showLogin();
            }
        } catch (error) {
            console.error('💥 Token verification error:', error);
            this.clearAuth();
            this.showLogin();
        }
    }

    async verifyMagicToken(magicToken) {
        try {
            console.log('🔐 Verifying magic link token...');
            const response = await fetch('/.netlify/functions/verify-login-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: magicToken })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.token = data.token;
                    this.setUserData(data);
                    
                    // Clear URL parameters
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    this.onAuthSuccess();
                    return;
                }
            }
            
            console.log('❌ Magic token verification failed');
            this.showMessage('Invalid or expired login link', 'error');
            this.showLogin();
        } catch (error) {
            console.error('💥 Magic token verification error:', error);
            this.showMessage('Login verification failed', 'error');
            this.showLogin();
        }
    }

    setUserData(data) {
        this.currentUser = {
            id: data.memberId,
            email: data.memberEmail,
            firstName: data.memberProfile?.firstName || '',
            lastName: data.memberProfile?.lastName || '',
            fullName: data.memberFullName,
            company: data.memberProfile?.company || '',
            position: data.memberProfile?.position || '',
            phone: data.memberProfile?.phone || '',
            linkedin: data.memberProfile?.linkedin || '',
            hasPassword: data.memberProfile?.hasPassword || false
        };
        
        this.isLoggedIn = true;
        this.isAdmin = data.isAdmin || false;
        
        // Store in localStorage for persistence
        localStorage.setItem('kartel_auth_token', this.token);
        localStorage.setItem('kartel_user_data', JSON.stringify(this.currentUser));
        localStorage.setItem('kartel_is_admin', this.isAdmin.toString());
        
        console.log('✅ User authenticated:', {
            name: this.currentUser.fullName,
            email: this.currentUser.email,
            isAdmin: this.isAdmin
        });
    }

    async login(email, password = null) {
        console.log(`🔐 Attempting login for: ${email} (method: ${password ? 'password' : 'magic link'})`);
        
        try {
            const response = await fetch('/.netlify/functions/member-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.token = data.token;
                this.setUserData(data);
                
                if (password) {
                    // Password login - immediate success
                    this.onAuthSuccess();
                    return { success: true, message: 'Login successful!' };
                } else {
                    // Magic link - show check email message
                    this.showCheckEmail(email);
                    return { success: true, checkEmail: true, message: 'Check your email for the login link!' };
                }
            } else {
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('💥 Login error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    logout() {
        console.log('👋 User logging out');
        this.clearAuth();
        this.showLogin();
        
        // Redirect to appropriate page based on current location
        const currentPath = window.location.pathname;
        if (currentPath.includes('admin')) {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/members.html';
        }
    }

    clearAuth() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.isAdmin = false;
        this.token = null;
        
        // Clear localStorage
        localStorage.removeItem('kartel_auth_token');
        localStorage.removeItem('kartel_user_data');
        localStorage.removeItem('kartel_is_admin');
        
        // Clear legacy tokens if they exist
        localStorage.removeItem('kartel_admin_token');
        localStorage.removeItem('kartel_member_token');
        localStorage.removeItem('kartel_member_email');
        localStorage.removeItem('kartel_member_id');
        localStorage.removeItem('kartel_member_firstName');
        localStorage.removeItem('kartel_member_lastName');
        localStorage.removeItem('kartel_member_company');
        localStorage.removeItem('kartel_member_position');
        localStorage.removeItem('kartel_member_phone');
        localStorage.removeItem('kartel_member_linkedin');
        localStorage.removeItem('kartel_member_hasPassword');
    }

    showLogin() {
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const loadingSection = document.getElementById('loadingSection');
        
        if (loginSection) loginSection.classList.remove('hidden');
        if (dashboardSection) dashboardSection.classList.add('hidden');
        if (loadingSection) loadingSection.classList.add('hidden');
        
        this.renderLoginForm();
    }

    showCheckEmail(email) {
        const checkEmailMessage = document.getElementById('checkEmailMessage');
        if (checkEmailMessage) {
            checkEmailMessage.innerHTML = `
                <h3>Check Your Email!</h3>
                <p>We've sent a secure login link to <strong>${email}</strong></p>
                <p>Click the link in your email to access your account.</p>
                <div class="sub-text">Didn't receive it? Check your spam folder or try again.</div>
            `;
            checkEmailMessage.classList.remove('hidden');
        }
        
        // Hide login form
        const magicLinkForm = document.getElementById('magicLinkForm');
        const passwordForm = document.getElementById('passwordForm');
        if (magicLinkForm) magicLinkForm.classList.add('hidden');
        if (passwordForm) passwordForm.classList.add('hidden');
    }

    onAuthSuccess() {
        console.log('🎉 Authentication successful, showing dashboard');
        
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const loadingSection = document.getElementById('loadingSection');
        
        if (loginSection) loginSection.classList.add('hidden');
        if (loadingSection) loadingSection.classList.add('hidden');
        if (dashboardSection) dashboardSection.classList.remove('hidden');
        
        // Update top bar
        if (window.kartelTopBar) {
            window.kartelTopBar.updateUser(this.currentUser, this.isAdmin);
        }
        
        // Trigger page-specific initialization
        if (typeof window.onAuthSuccess === 'function') {
            window.onAuthSuccess(this.currentUser, this.isAdmin);
        }
    }

    renderLoginForm() {
        const loginContainer = document.getElementById('loginContainer');
        if (!loginContainer) return;
        
        loginContainer.innerHTML = `
            <div class="login-card">
                <h1 class="login-title">The Kartel</h1>
                <p style="margin-bottom: 30px; color: #7f8c8d;">Access your account</p>
                
                <!-- Login Method Tabs -->
                <div class="login-tabs">
                    <button type="button" class="login-tab active" onclick="kartelAuth.showMagicLinkTab()">Magic Link</button>
                    <button type="button" class="login-tab" onclick="kartelAuth.showPasswordTab()">Password</button>
                </div>
                
                <!-- Magic Link Form -->
                <form id="magicLinkForm" class="login-form">
                    <div class="form-group">
                        <label for="magicLinkEmail">Email Address</label>
                        <input type="email" id="magicLinkEmail" name="email" required placeholder="your@email.com">
                    </div>
                    <button type="submit" class="login-btn">Send Magic Link</button>
                </form>
                
                <!-- Password Form -->
                <form id="passwordForm" class="login-form hidden">
                    <div class="form-group">
                        <label for="passwordEmail">Email Address</label>
                        <input type="email" id="passwordEmail" name="email" required placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" required placeholder="Your password">
                    </div>
                    <button type="submit" class="login-btn">Sign In</button>
                    <button type="button" class="forgot-password-btn" onclick="kartelAuth.showForgotPassword()">Forgot Password?</button>
                </form>
                
                <!-- Check Email Message -->
                <div id="checkEmailMessage" class="check-email-message hidden"></div>
                
                <!-- Messages -->
                <div id="loginMessage" class="hidden"></div>
            </div>
        `;
        
        this.attachLoginEventListeners();
    }

    showMagicLinkTab() {
        document.querySelectorAll('.login-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.login-form').forEach(form => form.classList.add('hidden'));
        
        document.querySelector('.login-tab:first-child').classList.add('active');
        document.getElementById('magicLinkForm').classList.remove('hidden');
        document.getElementById('checkEmailMessage').classList.add('hidden');
    }

    showPasswordTab() {
        document.querySelectorAll('.login-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.login-form').forEach(form => form.classList.add('hidden'));
        
        document.querySelector('.login-tab:last-child').classList.add('active');
        document.getElementById('passwordForm').classList.remove('hidden');
        document.getElementById('checkEmailMessage').classList.add('hidden');
    }

    showForgotPassword() {
        this.showMagicLinkTab();
        const emailInput = document.getElementById('magicLinkEmail');
        const passwordEmailInput = document.getElementById('passwordEmail');
        
        if (passwordEmailInput.value) {
            emailInput.value = passwordEmailInput.value;
        }
        
        // Update form for password reset
        const submitBtn = document.querySelector('#magicLinkForm button[type="submit"]');
        submitBtn.textContent = 'Send Reset Link';
        
        const form = document.getElementById('magicLinkForm');
        form.setAttribute('data-reset-mode', 'true');
    }

    attachLoginEventListeners() {
        // Magic Link Form
        const magicLinkForm = document.getElementById('magicLinkForm');
        if (magicLinkForm) {
            magicLinkForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('magicLinkEmail').value;
                const result = await this.login(email);
                this.showMessage(result.message, result.success ? 'success' : 'error');
            });
        }

        // Password Form
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('passwordEmail').value;
                const password = document.getElementById('password').value;
                const result = await this.login(email, password);
                this.showMessage(result.message, result.success ? 'success' : 'error');
            });
        }
    }

    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('loginMessage');
        if (messageContainer) {
            messageContainer.className = type;
            messageContainer.textContent = message;
            messageContainer.classList.remove('hidden');
            
            setTimeout(() => {
                messageContainer.classList.add('hidden');
            }, 5000);
        }
    }

    // Helper methods for page-specific access control
    requireAuth(redirectTo = '/members.html') {
        if (!this.isLoggedIn) {
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }

    requireAdmin(redirectTo = '/members.html') {
        if (!this.isLoggedIn || !this.isAdmin) {
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }

    // Public API
    getUser() { return this.currentUser; }
    getToken() { return this.token; }
    getUserFullName() { return this.currentUser?.fullName || this.currentUser?.email || 'User'; }
    isUserAdmin() { return this.isAdmin; }
    isUserLoggedIn() { return this.isLoggedIn; }
}

// Create global instance
window.kartelAuth = new KartelAuth();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KartelAuth;
}