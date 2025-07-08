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

**Deployment:**
- `npm run deploy:preview` - Deploy to Netlify preview URL for testing
- `npm run deploy:prod` - Deploy to production
- `npm run functions:serve` - Serve functions only

**Setup:**
- `npm install` - Install all dependencies including Netlify CLI
- Copy `.env.example` to `.env` and configure environment variables
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
- **Event Registration**: Sign up for upcoming events
- **LinkedIn Networking**: Connect with fellow attendees after events
- **Profile Management**: Update member information and LinkedIn profiles
- **Event History**: View past and upcoming events
- **Quick Registration**: One-click signup from email announcements

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
│   └── test-functions.js   # Local function testing utility
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
│       ├── send-event-announcement.js  # NEW: Email announcements
│       ├── send-test-email.js          # NEW: Test email functionality
│       ├── quick-register-event.js     # NEW: One-click registration
│       ├── create-venue.js
│       ├── get-venues.js
│       ├── update-venue.js
│       ├── delete-venue.js
│       ├── upload-photo.js
│       ├── get-gallery.js
│       ├── get-photo.js
│       ├── import-members.js
│       ├── quick-action.js
│       ├── member-login.js             # NEW: Member authentication
│       ├── sign-up-event.js           # NEW: Event registration
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
- **Dependencies**: Node.js packages for @netlify/blobs, @sendgrid/mail, and netlify-cli
- **Storage**: All member data, events, and venues stored in Netlify Blobs
- **Authentication**: Dual authentication system for admin and member access
- **Performance**: Optimized with inline assets and minimal dependencies
- **Accessibility**: Semantic HTML5 structure throughout all interfaces
- **Testing**: Jest test suite with function testing utilities
- **Deployment**: Preview and production deployment workflows with safety checks

## Development Workflow

1. **Local Development**: Use `npm run dev` for local testing with function simulation
2. **Testing**: Run `npm run test` and `npm run test:functions` before deployment
3. **Preview Deploy**: Use `npm run deploy:preview` for staging environment testing
4. **Email Testing**: Use admin test email functionality before mass announcements
5. **Production**: Deploy with `npm run deploy:prod` after thorough testing
6. **Environment Variables**: Configure via `.env` file using `.env.example` template