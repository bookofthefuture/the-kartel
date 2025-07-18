// auth-module.js - Unified Authentication System
class KartelAuth {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.isAdmin = false;
        // Check for unified token first, then legacy tokens
        this.token = localStorage.getItem('kartel_auth_token') || 
                     localStorage.getItem('kartel_member_token') || 
                     localStorage.getItem('kartel_admin_token');
        
        // Initialize when DOM is ready - with better debugging
        console.log('🔧 Auth constructor - DOM state:', document.readyState);
        if (document.readyState === 'loading') {
            console.log('⏳ DOM loading, waiting for DOMContentLoaded...');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('✅ DOMContentLoaded fired, initializing auth...');
                this.init();
            });
        } else {
            console.log('✅ DOM already ready, initializing auth with delay...');
            setTimeout(() => this.init(), 50);
        }
    }

    async init() {
        console.log('🚀 Initializing Kartel Authentication System v2.0');
        
        // Check for password reset token first
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('reset');
        
        console.log('🔍 URL search params:', window.location.search);
        console.log('🔍 Reset token from URL:', resetToken);
        
        if (resetToken) {
            console.log('🔑 Password reset token found, showing reset form...');
            this.showPasswordResetForm(resetToken);
            return;
        }
        
        // Check for magic link token in URL (but not if it's a registration token)
        const magicToken = urlParams.get('token');
        const isRegistrationLink = urlParams.has('register') && urlParams.has('email');
        
        if (magicToken && !isRegistrationLink) {
            console.log('🔗 Magic link token found in URL, verifying...');
            await this.verifyMagicToken(magicToken);
            return;
        } else if (magicToken && isRegistrationLink) {
            console.log('🎫 Registration token found in URL, skipping magic link verification');
        }
        
        // Check for existing authentication
        if (this.token) {
            console.log('🔍 Found existing token, checking stored user data...');
            console.log('🔍 Token source:', this.token.substring(0, 10) + '...');
            
            const storedUserData = localStorage.getItem('kartel_user_data');
            const storedIsAdmin = localStorage.getItem('kartel_is_admin') === 'true';
            const storedIsSuperAdmin = localStorage.getItem('kartel_is_super_admin') === 'true';
            
            console.log('🔍 Stored data check:', {
                hasUserData: !!storedUserData,
                isAdmin: storedIsAdmin,
                isSuperAdmin: storedIsSuperAdmin,
                userDataLength: storedUserData?.length || 0
            });
            
            if (storedUserData) {
                console.log('✅ Found stored user data, restoring session...');
                try {
                    this.currentUser = JSON.parse(storedUserData);
                    this.isLoggedIn = true;
                    this.isAdmin = storedIsAdmin;
                    this.isSuperAdmin = storedIsSuperAdmin;
                    console.log('✅ Session restored for:', this.currentUser.email);
                    this.onAuthSuccess();
                } catch (error) {
                    console.error('❌ Error parsing stored user data:', error);
                    this.clearAuth();
                    this.showLogin();
                }
            } else {
                console.log('❌ No stored user data, requiring fresh login...');
                this.clearAuth();
                this.showLogin();
            }
        } else {
            console.log('🔄 No existing token found, showing login form now...');
            this.showLogin();
        }
    }

    async verifyToken() {
        try {
            console.log('🔐 Verifying token:', this.token ? `Token exists (${this.token.substring(0,10)}...)` : 'No token');
            console.log('🔍 Token source check:', {
                auth_token: !!localStorage.getItem('kartel_auth_token'),
                member_token: !!localStorage.getItem('kartel_member_token'),
                admin_token: !!localStorage.getItem('kartel_admin_token')
            });
            
            if (!this.token) {
                console.log('❌ No token to verify');
                this.showLogin();
                return;
            }
            
            const response = await fetch('/.netlify/functions/member-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: this.token })
            });

            console.log('📊 Verify response:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Token valid, user data:', data.memberEmail);
                this.setUserData(data);
                this.onAuthSuccess();
            } else {
                console.log('❌ Token verification failed:', response.status);
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
            const response = await fetch('/.netlify/functions/member-login', {
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
        this.isSuperAdmin = data.isSuperAdmin || false;
        
        // Store in localStorage for persistence - use ALL storage methods to ensure compatibility
        localStorage.setItem('kartel_auth_token', this.token);
        localStorage.setItem('kartel_user_data', JSON.stringify(this.currentUser));
        localStorage.setItem('kartel_is_admin', this.isAdmin.toString());
        localStorage.setItem('kartel_is_super_admin', this.isSuperAdmin.toString());
        
        // Store in legacy locations for full compatibility
        localStorage.setItem('kartel_member_token', this.token);
        localStorage.setItem('kartel_member_email', this.currentUser.email);
        localStorage.setItem('kartel_member_id', this.currentUser.id);
        localStorage.setItem('kartel_member_firstName', this.currentUser.firstName || '');
        localStorage.setItem('kartel_member_lastName', this.currentUser.lastName || '');
        localStorage.setItem('kartel_member_isAdmin', this.isAdmin.toString());
        
        // For admin users, also store in legacy admin token location
        if (this.isAdmin) {
            localStorage.setItem('kartel_admin_token', this.token);
            localStorage.setItem('kartel_admin_user', JSON.stringify(this.currentUser));
            console.log('✅ Admin legacy tokens stored for compatibility');
        }
        
        console.log('✅ User authenticated:', {
            name: this.currentUser.fullName,
            email: this.currentUser.email,
            isAdmin: this.isAdmin
        });
    }

    async login(email, password = null) {
        console.log(`🔐 Attempting login for: ${email} (method: ${password ? 'password' : 'magic link'})`);
        
        try {
            // Use different endpoints based on authentication method
            const endpoint = password ? 
                '/.netlify/functions/member-login' : 
                '/.netlify/functions/request-login-link';
            
            const response = await fetch(endpoint, {
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

    async requestPasswordReset(email) {
        console.log(`🔄 Requesting password reset for: ${email}`);
        
        try {
            const response = await fetch('/.netlify/functions/reset-member-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return { success: true, message: data.message };
            } else {
                return { success: false, error: data.error || 'Password reset failed' };
            }
        } catch (error) {
            console.error('💥 Password reset error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    async completePasswordReset(email, resetToken, newPassword) {
        console.log(`🔄 Completing password reset for: ${email}`);
        
        try {
            const response = await fetch('/.netlify/functions/reset-member-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, resetToken, newPassword })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return { success: true, message: data.message };
            } else {
                return { success: false, error: data.error || 'Password reset failed' };
            }
        } catch (error) {
            console.error('💥 Password reset completion error:', error);
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
        this.isSuperAdmin = false;
        this.token = null;
        
        // Clear localStorage - both unified and legacy tokens
        localStorage.removeItem('kartel_auth_token');
        localStorage.removeItem('kartel_user_data');
        localStorage.removeItem('kartel_is_admin');
        localStorage.removeItem('kartel_is_super_admin');
        
        // Clear legacy tokens if they exist
        localStorage.removeItem('kartel_admin_token');
        localStorage.removeItem('kartel_admin_user');
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
        console.log('🔑 Showing login form...');
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const loadingSection = document.getElementById('loadingSection');
        
        console.log('📍 Elements found:', {
            loginSection: !!loginSection,
            dashboardSection: !!dashboardSection,
            loadingSection: !!loadingSection
        });
        
        if (loginSection) loginSection.classList.remove('hidden');
        if (dashboardSection) dashboardSection.classList.add('hidden');
        if (loadingSection) loadingSection.classList.add('hidden');
        
        this.renderLoginForm();
    }

    showPasswordResetForm(resetToken) {
        console.log('🔑 Showing password reset form...');
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show login section
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const loadingSection = document.getElementById('loadingSection');
        
        if (loginSection) loginSection.classList.remove('hidden');
        if (dashboardSection) dashboardSection.classList.add('hidden');
        if (loadingSection) loadingSection.classList.add('hidden');
        
        // Render password reset form
        this.renderPasswordResetForm(resetToken);
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
        const loginContainer = document.getElementById('loginContainer');
        const dashboardSection = document.getElementById('dashboardSection');
        const loadingSection = document.getElementById('loadingSection');
        
        if (loginSection) loginSection.classList.add('hidden');
        if (loginContainer) loginContainer.classList.add('hidden');
        if (loadingSection) loadingSection.classList.add('hidden');
        if (dashboardSection) dashboardSection.classList.remove('hidden');
        
        // Update top bar after dashboard is visible
        if (window.kartelTopBar) {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                window.kartelTopBar.render();
                window.kartelTopBar.updateUser(this.currentUser, this.isAdmin);
            }, 100);
        }
        
        // Trigger page-specific initialization
        if (typeof window.onAuthSuccess === 'function') {
            window.onAuthSuccess(this.currentUser, this.isAdmin);
        }
    }

    renderLoginForm() {
        const loginContainer = document.getElementById('loginContainer');
        if (!loginContainer) {
            console.error('❌ loginContainer element not found - cannot render login form');
            return;
        }
        
        console.log('📝 Rendering login form in container:', loginContainer);
        
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

    renderPasswordResetForm(resetToken) {
        const loginContainer = document.getElementById('loginContainer');
        if (!loginContainer) {
            console.error('❌ loginContainer element not found - cannot render password reset form');
            return;
        }
        
        console.log('📝 Rendering password reset form in container:', loginContainer);
        
        loginContainer.innerHTML = `
            <div class="login-card">
                <h1 class="login-title">Reset Your Password</h1>
                <p style="margin-bottom: 20px; color: #7f8c8d;">Enter your email and new password</p>
                
                <form id="passwordResetForm" data-reset-token="${resetToken}">
                    <div class="form-group">
                        <label for="resetEmail">Email Address</label>
                        <input type="email" id="resetEmail" name="resetEmail" required placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label for="newPassword">New Password</label>
                        <input type="password" id="newPassword" name="newPassword" required placeholder="Enter new password" minlength="8">
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">Confirm Password</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" required placeholder="Confirm new password" minlength="8">
                    </div>
                    <button type="submit" id="resetPasswordBtn" class="login-btn">Reset Password</button>
                </form>
                
                <div id="resetMessage" class="hidden"></div>
            </div>
        `;
        
        this.attachPasswordResetEventListeners();
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
                
                // Check if this is a password reset request
                const isResetMode = magicLinkForm.getAttribute('data-reset-mode') === 'true';
                
                if (isResetMode) {
                    // Call password reset function
                    const result = await this.requestPasswordReset(email);
                    this.showMessage(result.error || result.message, result.success ? 'success' : 'error');
                } else {
                    // Normal magic link login
                    const result = await this.login(email);
                    this.showMessage(result.error || result.message, result.success ? 'success' : 'error');
                }
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
                
                // Only show message for errors or magic link requests
                if (!result.success || result.checkEmail) {
                    this.showMessage(result.error || result.message, result.success ? 'success' : 'error');
                }
                // For successful password login, onAuthSuccess() already handles the transition
            });
        }
    }

    attachPasswordResetEventListeners() {
        const passwordResetForm = document.getElementById('passwordResetForm');
        if (passwordResetForm) {
            passwordResetForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('resetEmail').value;
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                const resetToken = passwordResetForm.getAttribute('data-reset-token');
                
                // Validate passwords match
                if (newPassword !== confirmPassword) {
                    this.showResetMessage('Passwords do not match. Please try again.', 'error');
                    return;
                }
                
                // Validate password length
                if (newPassword.length < 8) {
                    this.showResetMessage('Password must be at least 8 characters long.', 'error');
                    return;
                }
                
                // Call password reset completion
                const result = await this.completePasswordReset(email, resetToken, newPassword);
                this.showResetMessage(result.message, result.success ? 'success' : 'error');
                
                // If successful, redirect to login after 3 seconds
                if (result.success) {
                    setTimeout(() => {
                        window.location.href = '/members.html';
                    }, 3000);
                }
            });
        }
    }

    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('loginMessage');
        if (messageContainer) {
            // Clear previous type classes and add new type
            messageContainer.className = `message ${type}`;
            messageContainer.textContent = message;
            messageContainer.classList.remove('hidden');
            
            setTimeout(() => {
                messageContainer.classList.add('hidden');
            }, 5000);
        }
    }

    showResetMessage(message, type = 'info') {
        const messageContainer = document.getElementById('resetMessage');
        if (messageContainer) {
            // Clear previous type classes and add new type
            messageContainer.className = `message ${type}`;
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
    isUserSuperAdmin() { return this.isSuperAdmin; }
    isUserLoggedIn() { return this.isLoggedIn; }
}

// ES Module export - no global instance creation here
// Global instances are created in bundle entry points (src/*.js)
export default KartelAuth;
export { KartelAuth };

// CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KartelAuth;
}