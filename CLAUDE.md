# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Kartel is a static website for an exclusive business networking group based in Manchester that combines karting events with professional networking. The site serves as a marketing and membership application platform.

## Architecture

**Hybrid Application Structure:**
- `index.html` - Public website with embedded CSS and JavaScript
- `admin.html` - Admin dashboard for member and event management
- `members.html` - Members-only area with event registration and networking
- `netlify/functions/` - Serverless functions for backend operations
- `photos/` - Event photography and branding assets
- `favicon.svg` - Site icon
- `assets/League_Spartan/` - Custom font files (League Spartan)
- `package.json` - Node.js dependencies for Netlify functions
- `scripts/` - Development and testing utilities
- `.env.example` - Environment variables template
- `DEVELOPMENT.md` - Local development setup guide

**Key Design Patterns:**
- **Frontend**: Monolithic structure for public site, component-based admin dashboard
- **Backend**: Serverless architecture using Netlify Functions with Netlify Blobs storage
- **Component-Based CSS**: Modular section-based styling (hero, about, event-format, contact, faq, gallery)
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Mobile-First Responsive Design**: CSS Grid and Flexbox with comprehensive breakpoints

## Development Commands

**Local Development Environment:**
- `npm run dev` - Start Netlify dev server with functions at localhost:8888
- `npm run test` - Run Jest test suite
- `npm run test:functions` - Test local Netlify functions
- `npm run test:watch` - Run tests in watch mode

**Git Workflow (IMPORTANT - ALWAYS FOLLOW):**
- **NEVER commit directly to main branch**
- For every new feature/fix, create a new branch: `git checkout -b feature/description`
- Work on the feature branch, commit changes locally
- Push branch to GitHub: `git push origin branch-name`
- Create Pull Request to merge branch to main
- All PRs must pass test suite before merging
- Use GitHub CLI: `gh pr create --title "Title" --body "Description"`

**Deployment:**
- `npm run deploy:preview` - Deploy to Netlify preview (commits locally, NO GitHub push)
- Work should be done on feature branches, NOT main
- `./scripts/deploy-preview.sh "Custom message"` - Deploy to preview with custom message
- `npm run functions:serve` - Serve functions only

**Setup:**
- `npm install` - Install all dependencies including Netlify CLI
- Create `.env` file and configure required environment variables
- See `DEVELOPMENT.md` for complete local setup guide

## CSS Formatting Convention

**Compact CSS Format:**
- Write CSS classes on single lines with properties separated by semicolons and spaces
- Example: `.hero { height: 100vh; background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); position: relative; }`
- This approach maintains readability while significantly reducing file size
- For complex multi-line properties (like gradients), keep them inline but ensure proper spacing
- Always maintain 8-space indentation for CSS selectors within `<style>` blocks

## Key Features & Implementation

### Interactive Elements (JavaScript)
- **Smooth Scrolling**: Anchor link navigation
- **Parallax Effects**: Hero section background movement on scroll
- **FAQ Accordion**: Expandable question/answer sections
- **Image Gallery Modal**: Lightbox-style photo viewer with keyboard navigation
- **Form Integration**: Netlify-based contact form submission with LinkedIn URL parsing
- **Intersection Observer**: Scroll-triggered animations for cards and timeline items
- **LinkedIn URL Parsing**: Automatically cleans and normalizes LinkedIn profile entries
- **Event Registration**: One-click registration from email announcements
- **Dual Authentication System**: Toggle between magic link and password login methods
- **Password Management**: Setup, change, and reset functionality through profile interface

### Styling Architecture
- **CSS Custom Properties**: Consistent color scheme (primary: #2c3e50, accent: #e74c3c, highlight: #f1c40f)
- **Animation System**: Keyframe animations for racing stripe, pulse effects, and hover states
- **Layout System**: CSS Grid for galleries and features, Flexbox for navigation and timelines
- **Responsive Design**: Three breakpoint system (768px, 480px) with mobile-first approach

### Content Sections (Public Site)
1. **Hero** - Landing with call-to-action and navigation
2. **Video Showcase** - Embedded Vimeo player
3. **About** - Three-column feature grid
4. **Event Format** - Four-step timeline visualization
5. **Contact** - Netlify form with validation
6. **FAQ** - Accordion-style frequently asked questions
7. **Gallery** - Grid layout with modal image viewer

### Admin Dashboard Features
- **Member Management**: Application review, approval, and member data management
- **Event Management**: Create, edit, and delete events with venue integration
- **Email Announcements**: Send event announcements to all approved members
- **Test Email System**: Send test emails to admin before mass distribution
- **Event Confirmation Modal**: Preview event details before creation and email sending
- **Venue Management**: Manage karting venues and their details
- **Photo Gallery**: Upload and manage event photography
- **Statistics Dashboard**: Member counts, application status tracking
- **Data Import/Export**: CSV import for member data

### Members Area Features
- **Dual Authentication**: Magic link and username/password login options
- **Event Registration**: Sign up for upcoming events
- **LinkedIn Networking**: Connect with fellow attendees after events
- **Profile Management**: Update member information and LinkedIn profiles with password setup
- **Event History**: View past and upcoming events
- **Quick Registration**: One-click signup from email announcements
- **Password Management**: Set, change, and reset passwords through secure email flow
- **Admin-Member Switching**: Seamless view switching for admin users between admin and member interfaces
- **Progressive Web App**: Installable app with offline functionality and push notifications

## Recent Major Features (2025)

### Email Registration System
- **One-Click Registration**: Direct registration links in event announcement emails
- **Smart Authentication Flow**: Auto-detects admin/member authentication status
- **Cross-Authentication Support**: Admin users can seamlessly register for events as members
- **URL Parameter Handling**: Clean registration flow with proper error/success messaging
- **Test Email Integration**: Real registration links in admin test emails for proper testing

### Progressive Web App (PWA)
- **Member PWA**: Installable member app with custom go-kart themed icons
- **Admin PWA**: Separate installable admin app with distinct branding
- **Push Notifications**: Web push notifications for event announcements and new applications
- **Offline Functionality**: Service worker caching for improved performance
- **Installation Prompts**: Native app-like installation experience

### Dual Authentication System
- **Magic Link Authentication**: Secure email-based login (original system)
- **Username/Password Authentication**: Traditional login with PBKDF2 password hashing
- **Password Reset Flow**: Secure email-based password reset with token validation
- **Backward Compatibility**: Existing members seamlessly transition between authentication methods
- **Cross-Platform Session Management**: Admin credentials detected in member area for easy switching

### Admin-Member Navigation
- **Smart View Switching**: Admin users can switch between admin and member views
- **Contextual UI**: Admin switch button only appears for authenticated admin users
- **Session Preservation**: Maintains authentication state across view switches
- **Visual Distinction**: Different colored buttons for admin→member vs member→admin navigation

### Data Recovery & Resilience
- **Application List Recovery**: System to rebuild corrupted application lists from individual records
- **Emergency Admin Access**: Fallback authentication using environment variables
- **Blob Storage Management**: Robust handling of Netlify Blobs storage with error recovery
- **Data Validation**: Comprehensive error handling and data integrity checks

## File Organization

```
/the-kartel/
├── index.html              # Public website
├── admin.html              # Admin dashboard
├── members.html            # Members-only area
├── favicon.svg             # Site icon
├── package.json            # Node.js dependencies and dev scripts
├── netlify.toml            # Netlify configuration with dev settings
├── .env.example            # Environment variables template
├── DEVELOPMENT.md          # Local development setup guide
├── assets/
│   ├── League_Spartan/     # Font files
│   │   ├── LeagueSpartan-VariableFont_wght.ttf
│   │   └── static/         # Individual font weights
│   └── the-kartel-logo.png # Logo asset
├── scripts/
│   ├── test-functions.js   # Local function testing utility
│   ├── deploy-preview.sh   # Preview deployment (commits locally, no GitHub push)
│   ├── deploy-prod.sh      # Production deployment (commits + pushes to GitHub)
│   ├── push-to-github.sh   # Manual GitHub push with confirmation
│   └── generate-icons.js   # PWA icon generation script
├── tests/                  # Jest test suite
│   ├── setup.js
│   ├── validation.test.js
│   └── frontend.test.js
├── netlify/
│   └── functions/          # Serverless functions
│       ├── admin-login.js
│       ├── submit-application.js
│       ├── get-applications.js
│       ├── update-application.js
│       ├── delete-application.js
│       ├── create-event.js
│       ├── get-events.js
│       ├── update-event.js
│       ├── delete-event.js
│       ├── send-event-announcement.js  # Email announcements
│       ├── send-test-email.js          # Test email functionality
│       ├── quick-register-event.js     # One-click registration
│       ├── create-venue.js
│       ├── get-venues.js
│       ├── update-venue.js
│       ├── delete-venue.js
│       ├── upload-photo.js
│       ├── get-gallery.js
│       ├── get-photo.js
│       ├── import-members.js
│       ├── quick-action.js
│       ├── member-login.js             # Dual authentication (magic link + password)
│       ├── sign-up-event.js           # Event registration
│       ├── password-utils.js          # NEW: Shared password hashing utilities
│       ├── reset-member-password.js   # NEW: Secure password reset system
│       ├── set-member-password.js     # NEW: Password setup for members
│       ├── recover-applications-list.js # NEW: Data recovery system
│       └── [20+ other functions]      # Various member and admin functions
└── photos/                 # Event photography
    ├── the-kartel-logo.png
    ├── 09-06-25-attendees.jpg
    ├── 09-06-25-board.jpg
    ├── 09-06-25-overtake.jpg
    ├── 09-06-25-pub.jpg
    └── 09-06-25-r[1-3].jpg # Race result boards
```

## External Integrations

- **Google Analytics**: GA4 tracking (G-V4HX7K4NX2)
- **Netlify Blobs**: File storage for member data, events, and photos
- **Netlify Forms**: Contact form submission handling
- **Netlify CLI**: Local development environment with function simulation
- **SendGrid**: Email notifications and event announcements
- **Vimeo**: Video player embed (video ID: 1092055210)
- **Google Fonts**: League Spartan font family
- **LinkedIn**: Profile URL parsing and networking integration

## Important Notes

- **Multi-Page Application**: Three main interfaces (public, admin, members)
- **Backend**: Serverless functions handle all data operations via Netlify Blobs
- **Local Development**: Full Netlify CLI setup with function simulation and testing
- **Email System**: Complete announcement system with test functionality and safety features
- **LinkedIn Integration**: Automatic URL parsing and member networking features
- **Dependencies**: Node.js packages for @netlify/blobs, @sendgrid/mail, web-push, and netlify-cli
- **Storage**: All member data, events, and venues stored in Netlify Blobs
- **Authentication**: Dual authentication system for admin and member access
- **Password Security**: PBKDF2 hashing with secure token-based reset system
- **PWA Implementation**: Full Progressive Web App with manifests, service workers, and push notifications
- **Data Recovery**: Built-in recovery system for applications list corruption
- **Performance**: Optimized with inline assets and minimal dependencies
- **Accessibility**: Semantic HTML5 structure throughout all interfaces
- **Testing**: Jest test suite with function testing utilities
- **Deployment**: Preview and production deployment workflows with safety checks

## Authentication System

### Member Authentication
- **Magic Link**: Email-based secure login with 30-minute expiry tokens
- **Password Login**: Traditional email/password authentication with Argon2id hashing
- **Dual Support**: Members can use either method or both
- **Password Reset**: Secure email-based password reset with token validation
- **Profile Setup**: Members can set/change passwords through profile interface
- **Auto-Upgrade**: Legacy PBKDF2 passwords transparently upgraded to Argon2id on login

### Admin Authentication  
- **Password Login**: Email/password authentication with Argon2id hashing
- **Legacy Fallback**: Environment variable-based credentials for emergency access
- **Token-based Sessions**: Persistent authentication across page reloads
- **Progressive Security**: Existing admin passwords upgraded to Argon2id automatically

### Security Features (2025 Standards)
- **Argon2id Hashing**: OWASP 2025 recommended parameters (19 MiB memory, 2 iterations, parallelism 1)
- **Legacy Support**: Backward compatible PBKDF2 verification with transparent upgrades
- **Memory-Hard Algorithm**: Resistant to GPU-based and ASIC cracking attempts
- **Secure Tokens**: Cryptographically strong random tokens for all authentication
- **Session Management**: localStorage-based token persistence for PWA compatibility
- **Password Validation**: Minimum 8 characters with confirmation matching
- **Email Security**: Reset tokens expire in 30 minutes with one-time use validation
- **Algorithm Detection**: Automatic detection of hash type for seamless migration

### CRITICAL SECURITY RULES
- **NEVER HARDCODE SECRETS**: NEVER hardcode email addresses, API keys, passwords, usernames, or any sensitive values directly in code. Always use environment variables (process.env.VARIABLE_NAME). Hardcoding secrets will trigger secret scanning failures and security vulnerabilities.
- **ENVIRONMENT VARIABLES ONLY**: For any sensitive data like email addresses (admin@domain.com), API keys, or credentials, always use process.env variables even if they seem "safe". What appears to be a simple email address may be flagged as a secret by automated scanning.
- **NO SECRETS IN COMMITS**: Never commit .env files, API keys, passwords, or any sensitive data to the repository. Use .env.example for templates only.
- **SECRET SCANNING**: All code is automatically scanned for secrets. Any hardcoded sensitive values will cause build failures and must be replaced with environment variables.

### Data Recovery
- **Applications List Recovery**: Built-in recovery system for blob storage corruption
- **Individual Record Scanning**: Rebuilds applications list from individual member records
- **Admin Interface**: One-click recovery button with detailed status reporting
- **Safe Operation**: Recovery process doesn't delete existing data

## Development Workflow

**CRITICAL: All development must follow feature branch workflow - NEVER commit directly to main**

1. **Create Feature Branch**: `git checkout -b feature/description-of-work` for each new task
2. **Local Development**: Use `npm run dev` for local testing with function simulation
3. **Testing**: Run `npm run test` and `npm run test:functions` before any commits
4. **Commit to Feature Branch**: Make commits locally on the feature branch
5. **Preview Deploy**: Use `npm run deploy:preview` for staging environment testing (commits locally, no GitHub push)
6. **Push Feature Branch**: `git push origin feature/branch-name` to push branch to GitHub
7. **Create Pull Request**: Use `gh pr create` to create PR for merging to main
8. **PR Review & Tests**: All PRs must pass automated test suite before merging
9. **Merge to Main**: Only merge via approved PR - production deployment happens automatically
10. **Environment Variables**: Configure via `.env` file using `.env.example` template
11. **Data Recovery**: Use admin recovery button if applications list becomes corrupted

## Progressive Web App (PWA) Features

### PWA Manifests
- **Members App**: `/manifest.json` with member-focused shortcuts and icons
- **Admin App**: `/admin-manifest.json` with admin-specific shortcuts and icons
- **App Icons**: Complete icon sets (72px to 512px) with maskable variants for both apps
- **Installation**: Browser-native install prompts with custom UI for enhanced UX
- **Shortcuts**: App-specific shortcuts for quick access to key features

### Service Worker Implementation
- **Caching Strategy**: Cache-first for static assets, network-first for dynamic content
- **Offline Support**: Core functionality available without internet connection
- **Auto-Updates**: Automatic service worker updates with user notification
- **Asset Management**: Separate caches for member and admin app resources
- **Background Sync**: Prepared for offline form submission capabilities

### Push Notifications
- **VAPID Authentication**: Secure push notification setup with environment variable keys
- **User Targeting**: Separate notification channels for members and admins
- **Event Announcements**: Automatic push notifications when new events are created
- **Application Alerts**: Instant admin notifications for new membership applications
- **Subscription Management**: Automatic cleanup of invalid subscriptions
- **Cross-Platform**: Works on mobile and desktop browsers supporting Web Push API

### PWA Infrastructure Files
```
/the-kartel/
├── manifest.json              # Members PWA manifest
├── admin-manifest.json        # Admin PWA manifest
├── sw.js                      # Service worker for both apps
├── notification-manager.js    # Push notification management class
├── icons/                     # PWA icons directory
│   ├── icon-*.svg            # Member app icons (72px-512px + maskable)
│   ├── admin-icon-*.svg      # Admin app icons (72px-512px + maskable)
│   └── *-shortcut-*.svg      # Shortcut icons for app features
├── scripts/
│   └── generate-icons.js     # Icon generation utility
└── netlify/functions/
    ├── subscribe-notifications.js    # Push subscription management
    ├── send-push-notification.js     # Manual push notification sending
    └── get-vapid-key.js             # VAPID public key distribution
```

### Enhanced Dependencies
- **web-push**: Server-side push notification delivery
- **@netlify/blobs**: Push subscription storage and management
- **@node-rs/argon2**: Modern Argon2id password hashing with OWASP 2025 standards
- **notification-manager.js**: Client-side notification permission and subscription handling

### PWA Environment Variables
Required for push notifications:
- `VAPID_PUBLIC_KEY`: Public VAPID key for client subscription
- `VAPID_PRIVATE_KEY`: Private VAPID key for server-side push sending
- `ADMIN_EMAIL`: Admin contact email for VAPID identification