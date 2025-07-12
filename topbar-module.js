// topbar-module.js - Unified Top Bar Navigation
class KartelTopBar {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.currentPage = this.detectCurrentPage();
        
        console.log('🎯 Initializing Kartel Top Bar for page:', this.currentPage);
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }

    detectCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('super-admin')) return 'super-admin';
        if (path.includes('admin')) return 'admin';
        if (path.includes('members')) return 'members';
        return 'public';
    }

    updateUser(userData, isAdmin) {
        this.currentUser = userData;
        this.isAdmin = isAdmin;
        this.isSuperAdmin = userData && userData.isSuperAdmin;
        this.updateUserDisplay();
        this.updateNavigation();
    }

    render() {
        const header = document.querySelector('.header');
        if (!header) {
            console.log('📍 No .header element found - skipping render');
            return;
        }

        header.innerHTML = `
            <div class="header-content">
                <div class="header-logo">
                    <img src="/photos/the-kartel-logo.png" alt="The Kartel Logo">
                    <h1 class="header-title">The Kartel${this.isSuperAdmin ? ' <span class="super-admin-badge">Super Admin</span>' : ''}</h1>
                </div>
                <div class="header-navigation">
                    ${this.renderNavigation()}
                    ${this.renderUserSection()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderNavigation() {
        if (!this.currentUser) return '';

        // Get current view name
        const viewNames = {
            'super-admin': 'Super Admin',
            'admin': 'Admin',
            'members': 'Members'
        };
        const currentViewName = viewNames[this.currentPage] || 'Dashboard';

        // Build available views based on user permissions
        const availableViews = [];
        
        if (this.isSuperAdmin) {
            availableViews.push({ key: 'super-admin', name: 'Super Admin', url: '/super-admin.html' });
        }
        
        if (this.isAdmin || this.isSuperAdmin) {
            availableViews.push({ key: 'admin', name: 'Admin', url: '/admin.html' });
        }
        
        // All authenticated users can access members area
        availableViews.push({ key: 'members', name: 'Members', url: '/members.html' });

        // If only one view available, show simple indicator
        if (availableViews.length <= 1) {
            return `<span class="page-indicator">${currentViewName}</span>`;
        }

        // Build dropdown for multiple views
        const dropdownOptions = availableViews
            .filter(view => view.key !== this.currentPage)
            .map(view => `<a href="${view.url}" class="view-option">${view.name}</a>`)
            .join('');

        return `
            <div class="view-switcher">
                <span class="current-view">${currentViewName}</span>
                <div class="view-dropdown">
                    <button class="dropdown-toggle" onclick="kartelTopBar.toggleViewDropdown()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                    </button>
                    <div class="dropdown-menu" id="viewDropdownMenu">
                        ${dropdownOptions}
                    </div>
                </div>
            </div>
        `;
    }

    renderUserSection() {
        if (!this.currentUser) return '';

        const userName = this.currentUser.fullName || this.currentUser.firstName || this.currentUser.email;
        const displayName = this.currentUser.firstName || this.currentUser.email;
        
        // Show clickable profile name on both member and admin pages
        const isMemberPage = this.currentPage === 'members';
        const profileAction = isMemberPage ? 'openProfileModal()' : 'kartelTopBar.switchToMembers()';
        const profileButton = `<span class="member-name-clickable" onclick="${profileAction}">${displayName}</span>`;
        
        return `
            <div class="user-info">
                ${profileButton}
                <button class="logout-btn" onclick="kartelTopBar.logout()">Logout</button>
            </div>
        `;
    }

    updateUserDisplay() {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement && this.currentUser) {
            const userName = this.currentUser.fullName || this.currentUser.firstName || this.currentUser.email;
            userNameElement.textContent = `Welcome, ${userName}`;
        }
    }

    updateNavigation() {
        const navigationContainer = document.querySelector('.header-navigation');
        if (navigationContainer) {
            // Update just the navigation part
            const userSection = navigationContainer.querySelector('.user-info');
            const newNavigation = this.renderNavigation();
            
            // Replace everything except user section
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newNavigation;
            
            // Remove old navigation elements
            navigationContainer.querySelectorAll('.page-indicator, .switch-btn').forEach(el => el.remove());
            
            // Insert new navigation before user section
            if (userSection) {
                userSection.insertAdjacentHTML('beforebegin', newNavigation);
            } else {
                navigationContainer.insertAdjacentHTML('beforeend', newNavigation);
            }
        }
    }

    switchToMembers() {
        console.log('🔄 Switching to Members view');
        window.location.href = '/members.html';
    }

    switchToAdmin() {
        console.log('🔄 Switching to Admin view');
        
        if (!this.isAdmin) {
            console.warn('⚠️ Non-admin user attempted to access admin view');
            return;
        }
        
        window.location.href = '/admin.html';
    }

    switchToSuperAdmin() {
        console.log('🔄 Switching to Super Admin view');
        
        if (!this.isSuperAdmin) {
            console.warn('⚠️ Non-super-admin user attempted to access super admin view');
            return;
        }
        
        window.location.href = '/super-admin.html';
    }

    toggleViewDropdown() {
        const dropdown = document.getElementById('viewDropdownMenu');
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
            
            // Close dropdown when clicking outside
            if (!isVisible) {
                setTimeout(() => {
                    document.addEventListener('click', this.closeDropdownOnClickOutside.bind(this), { once: true });
                }, 100);
            }
        }
    }

    closeDropdownOnClickOutside(event) {
        const dropdown = document.getElementById('viewDropdownMenu');
        const switcher = document.querySelector('.view-switcher');
        
        if (dropdown && switcher && !switcher.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    }

    logout() {
        console.log('👋 Logout initiated from top bar');
        if (window.kartelAuth) {
            window.kartelAuth.logout();
        } else {
            // Fallback if auth module not available
            localStorage.clear();
            window.location.href = '/members.html';
        }
    }

    attachEventListeners() {
        // Event listeners are handled via onclick attributes for simplicity
        // but could be enhanced to use addEventListener for better practice
    }

    // Helper method to show/hide the entire header
    show() {
        const header = document.querySelector('.header');
        if (header) header.style.display = 'block';
    }

    hide() {
        const header = document.querySelector('.header');
        if (header) header.style.display = 'none';
    }

    // Method to update just the logo if needed
    updateLogo(logoUrl, altText = 'The Kartel Logo') {
        const logoImg = document.querySelector('.header-logo img');
        if (logoImg) {
            logoImg.src = logoUrl;
            logoImg.alt = altText;
        }
    }

    // Method to update the title if needed
    updateTitle(title) {
        const titleElement = document.querySelector('.header-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
}

// Create global instance
window.kartelTopBar = new KartelTopBar();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KartelTopBar;
}