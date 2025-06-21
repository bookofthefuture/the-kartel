# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Kartel is a static website for an exclusive business networking group based in Manchester that combines karting events with professional networking. The site serves as a marketing and membership application platform.

## Architecture

**Hybrid Application Structure:**
- `index.html` - Public website with embedded CSS and JavaScript
- `admin.html` - Admin dashboard for member and event management
- `netlify/functions/` - Serverless functions for backend operations
- `photos/` - Event photography and branding assets
- `favicon.svg` - Site icon
- `assets/League_Spartan/` - Custom font files (League Spartan)
- `package.json` - Node.js dependencies for Netlify functions

**Key Design Patterns:**
- **Frontend**: Monolithic structure for public site, component-based admin dashboard
- **Backend**: Serverless architecture using Netlify Functions with Netlify Blobs storage
- **Component-Based CSS**: Modular section-based styling (hero, about, event-format, contact, faq, gallery)
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Mobile-First Responsive Design**: CSS Grid and Flexbox with comprehensive breakpoints

## Development Commands

**Frontend Development:**
- Open `index.html` in browser for public site development
- Open `admin.html` in browser for admin dashboard development

**Backend Development:**
- `npm install` - Install Netlify Functions dependencies
- Functions are deployed automatically via Netlify
- Local testing requires Netlify CLI for function simulation

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
- **Form Integration**: Netlify-based contact form submission
- **Intersection Observer**: Scroll-triggered animations for cards and timeline items

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
- **Venue Management**: Manage karting venues and their details
- **Photo Gallery**: Upload and manage event photography
- **Statistics Dashboard**: Member counts, application status tracking
- **Data Import/Export**: CSV import for member data

## File Organization

```
/the-kartel/
├── index.html              # Public website
├── admin.html              # Admin dashboard
├── favicon.svg             # Site icon
├── package.json            # Node.js dependencies
├── netlify.toml            # Netlify configuration
├── assets/
│   ├── League_Spartan/     # Font files
│   │   ├── LeagueSpartan-VariableFont_wght.ttf
│   │   └── static/         # Individual font weights
│   └── the-kartel-logo.png # Logo asset
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
│       ├── create-venue.js
│       ├── get-venues.js
│       ├── update-venue.js
│       ├── delete-venue.js
│       ├── upload-photo.js
│       ├── get-gallery.js
│       ├── get-photo.js
│       ├── import-members.js
│       ├── quick-action.js
│       └── seed-venues.js
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
- **SendGrid**: Email notifications for admin actions
- **Vimeo**: Video player embed (video ID: 1092055210)
- **Google Fonts**: League Spartan font family

## Important Notes

- **Public Site**: Single HTML file (~1080 lines) with embedded CSS and JavaScript
- **Admin Dashboard**: Separate HTML file with comprehensive management interface
- **Backend**: Serverless functions handle all data operations via Netlify Blobs
- **Dependencies**: Node.js packages for @netlify/blobs and @sendgrid/mail
- **Storage**: All member data, events, and venues stored in Netlify Blobs
- **Authentication**: Simple admin login system for dashboard access
- **Performance**: Optimized with inline assets and minimal dependencies
- **Accessibility**: Semantic HTML5 structure throughout both interfaces