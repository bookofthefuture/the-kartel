# The Kartel Project - Context Document

## Project Overview
**The Kartel** is an exclusive networking collective for ambitious professionals in Greater Manchester that combines high-speed karting with strategic business networking. The project consists of a public website, admin dashboard, and supporting infrastructure.

## Architecture & Infrastructure

### Platform
- **Hosting**: Netlify
- **Backend**: Netlify Functions (serverless)
- **Storage**: Netlify Blobs (edge storage)
- **Authentication**: JWT tokens for admin access
- **Frontend**: Vanilla HTML/CSS/JavaScript (no frameworks)

### File Structure
```
/
├── index.html                    # Main public website
├── admin.html                   # Admin dashboard
├── photos/                      # Static gallery images
├── netlify/functions/           # Serverless backend functions
│   ├── submit-application.js    # Handle membership applications
│   ├── get-applications.js      # Fetch applications for admin
│   ├── update-application.js    # Approve/reject applications
│   ├── delete-application.js    # Remove applications
│   ├── import-members.js        # Bulk import from CSV
│   ├── admin-login.js          # Admin authentication
│   ├── create-event.js         # Create karting events
│   ├── get-events.js           # Fetch events
│   ├── update-event.js         # Modify events
│   ├── delete-event.js         # Remove events
│   ├── get-venues.js           # Fetch venues
│   ├── create-venue.js         # Add new venues
│   ├── update-venue.js         # Edit venues
│   ├── delete-venue.js         # Remove venues
│   ├── seed-venues.js          # Create default venues
│   ├── get-gallery.js          # Dynamic photo gallery
│   └── upload-photo.js         # Event photo uploads
└── _redirects                   # Netlify routing rules
```

## Technical Conventions

### Netlify Functions Pattern
All functions follow this consistent structure:

```javascript
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // 1. HTTP method validation
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // 2. Authentication check
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // 3. Token validation
  const token = authHeader.split(' ')[1];
  if (!token || token.length < 32) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  try {
    // 4. Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
    }

    // 5. Create store with consistent config
    const dataStore = getStore({
      name: 'store-name',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // 6. Business logic here
    
    // 7. Standard success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, message: 'Operation successful' })
    };

  } catch (error) {
    // 8. Standard error response
    console.error('💥 Error description:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
```

### Data Storage Patterns

#### Dual Storage System
All major entities use both individual records and master lists:

```javascript
// Store individual record
await dataStore.setJSON(item.id, item);

// Update master list
const items = await dataStore.get('_list', { type: 'json' }) || [];
items.push(item);
await dataStore.setJSON('_list', items);
```

#### Store Names
- `applications` - Membership applications
- `events` - Karting events
- `venues` - Event venues
- `gallery` - Photo gallery
- `photos` - Individual photo files

#### ID Generation Pattern
```javascript
const id = `prefix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

### Frontend Conventions

#### Admin Dashboard Structure
- **Tabs**: Applications, Events, Venues (using `switchTab()` function)
- **Stats**: Grid of metric cards at top of each tab
- **Tables**: Consistent styling with action buttons
- **Modals**: For add/edit operations
- **Messages**: Success/error notifications with auto-hide

#### Styling Approach
- **Colors**: Primary #e74c3c (red), Secondary #2c3e50 (dark blue)
- **Design**: Modern, racing-inspired with gradients and animations
- **Responsive**: Mobile-first with CSS Grid and Flexbox
- **Icons**: Emoji-based for simplicity

#### JavaScript Patterns
- Vanilla JS with async/await
- Global functions for onclick handlers
- localStorage for auth token persistence
- Fetch API for all HTTP requests
- No external frameworks or libraries

## Data Models

### Application
```javascript
{
  id: "app_1703123456789_abc123def",
  firstName: "John",
  lastName: "Smith", 
  email: "john@company.com",
  company: "Tech Corp",
  position: "CEO",
  phone: "+44123456789",
  message: "Looking to expand my network...",
  status: "pending|approved|rejected",
  submittedAt: "2024-01-01T12:00:00.000Z",
  reviewedAt: "2024-01-02T10:00:00.000Z", // if reviewed
  reviewedBy: "Admin",
  importedAt: "2024-01-01T12:00:00.000Z" // if bulk imported
}
```

### Event
```javascript
{
  id: "evt_1703123456789_abc123def",
  name: "Monthly Championship Round",
  description: "Competitive racing with prizes...",
  date: "2024-02-15",
  time: "18:00",
  venue: "TeamSport Victoria",
  venueId: "venue_1703123456789_abc123def",
  venueAddress: "Great Ducie Street, Manchester M3 1PR",
  maxAttendees: 20,
  attendees: [
    { id: "member123", name: "John Smith", registeredAt: "2024-01-01T12:00:00.000Z" }
  ],
  photos: [
    { path: "event-photos/photo123.jpg", caption: "Winner's podium" }
  ],
  status: "upcoming|completed|cancelled",
  createdAt: "2024-01-01T12:00:00.000Z",
  createdBy: "Admin"
}
```

### Venue
```javascript
{
  id: "venue_1703123456789_abc123def",
  name: "TeamSport Victoria",
  address: "Great Ducie Street, Manchester M3 1PR",
  phone: "0161 637 0637",
  website: "https://www.team-sport.co.uk/go-karting/manchester-city-centre/",
  notes: "Our primary venue. Use code GET10 for 10% off.",
  createdAt: "2024-01-01T12:00:00.000Z",
  updatedAt: "2024-01-01T12:00:00.000Z",
  createdBy: "Admin"
}
```

## Key Features

### Public Website (index.html)
- **Hero Section**: Branding and call-to-action
- **Video Showcase**: Embedded Vimeo player
- **Application Form**: Membership request submission
- **Dynamic Gallery**: Loads from Netlify Functions + static fallback
- **FAQ Section**: Expandable accordion
- **Mobile Responsive**: Full mobile optimization

### Admin Dashboard (admin.html)
- **Authentication**: JWT-based login system
- **Applications Management**: Review, approve, reject, bulk import
- **Events Management**: Create events with venue selection
- **Venues Management**: CRUD operations for karting venues
- **Photo Management**: Upload and organize event photos
- **Stats Dashboard**: Real-time metrics for each section

### Gallery System
- **Static Photos**: Hardcoded in HTML for reliability
- **Dynamic Photos**: Loaded via API when available
- **Fallback Strategy**: Graceful degradation to static content
- **Modal View**: Click to enlarge with captions

## Environment Setup

### Required Environment Variables
```
NETLIFY_SITE_ID=your-site-id
NETLIFY_ACCESS_TOKEN=your-access-token
ADMIN_USERNAME=admin-username
ADMIN_PASSWORD=admin-password-hash
JWT_SECRET=your-jwt-secret
```

### Deployment
- **Platform**: Netlify
- **Build**: No build process (static files)
- **Functions**: Auto-deployed from `/netlify/functions/`
- **Redirects**: Configured in `_redirects` file

## Business Logic

### Application Workflow
1. User submits application via public form
2. Admin reviews in dashboard
3. Admin approves/rejects with automatic email notification
4. Approved members gain access to private WhatsApp group

### Event Workflow
1. Admin creates event selecting from available venues
2. Event appears in admin dashboard
3. Admin can mark as completed and upload photos
4. Photos automatically appear in public gallery

### Venue Management
1. Admin adds venues with full details
2. Venues populate dropdown in event creation
3. Safety checks prevent deletion of venues used by events
4. "Seed Venues" feature for initial setup

## Integration Points

### Email System
- Application status notifications
- Admin email alerts for new applications
- WhatsApp group invitation for approved members

### Photo Management
- Upload to Netlify Blobs storage
- Automatic gallery integration
- Event-based organization

### Security
- Admin authentication via JWT
- Token validation on all admin endpoints
- CORS headers for cross-origin requests

## Debugging & Monitoring

### Console Logging Pattern
Functions use emoji-prefixed logging:
```javascript
console.log('📅 Creating new event');        // Info
console.log('✅ Event created successfully'); // Success  
console.log('⚠️ Warning message');            // Warning
console.error('💥 Error occurred:', error);   // Error
```

### Common Issues
- **Blob Storage**: Check environment variables and store configuration
- **Authentication**: Verify JWT token format and length
- **CORS**: Ensure proper headers in function responses
- **Mobile**: Test responsive design on actual devices

## Future Development Areas

### Planned Features
- Member attendance tracking for events
- Enhanced venue management with photos and capacity
- Event registration system for members
- Analytics dashboard with engagement metrics
- Integration with payment systems for event fees

### Technical Debt
- Consider migrating to React for complex UI interactions
- Implement proper database for better data relationships
- Add automated testing for critical functions
- Improve error handling and user feedback

---

*This document should be referenced when working on The Kartel project to maintain consistency and understanding of the existing architecture and conventions.*