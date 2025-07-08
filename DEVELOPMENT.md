# The Kartel - Development Guide

## Local Development Setup

### Prerequisites
- Node.js 18+ 
- npm
- Git

### Initial Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-username/the-kartel.git
   cd the-kartel
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Link to Netlify (if not already done):**
   ```bash
   npx netlify link --id YOUR_SITE_ID_HERE
   ```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server with functions |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run deploy:preview` | Deploy to Netlify preview |
| `npm run deploy:prod` | Deploy to production |
| `npm run functions:serve` | Serve functions only |
| `npm run test:functions` | Test functions locally |

### Local Development Server

```bash
npm run dev
```

This starts the Netlify dev server at `http://localhost:8888` with:
- ✅ Static file serving
- ✅ Serverless functions at `/.netlify/functions/`
- ✅ Environment variable injection
- ✅ Live reloading

### Testing Functions Locally

Functions are available at `http://localhost:8888/.netlify/functions/[function-name]`

Example:
```bash
# Test the get-applications function
curl http://localhost:8888/.netlify/functions/get-applications \
  -H "Authorization: Bearer your_token_here"
```

### Preview Deployments

Create a preview deployment for testing:
```bash
npm run deploy:preview
```

This creates a temporary preview URL for testing changes before going live.

### File Structure

```
/the-kartel/
├── index.html              # Public website
├── admin.html              # Admin dashboard  
├── members.html            # Members area
├── netlify/functions/      # Serverless functions
├── assets/                 # Static assets
├── photos/                 # Event photos
├── tests/                  # Test files
├── package.json            # Dependencies and scripts
├── netlify.toml           # Netlify configuration
└── .env.example           # Environment variables template
```

### Environment Variables

Required for local development:

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NETLIFY_SITE_ID` | Your site ID | Netlify dashboard or `netlify status` |
| `NETLIFY_ACCESS_TOKEN` | Personal access token | Netlify user settings |
| `SENDGRID_API_KEY` | Email service key | SendGrid dashboard |
| `FROM_EMAIL` | Sender email address | Your domain email |
| `ADMIN_EMAIL` | Admin notification email | Your admin email |

### Common Development Tasks

#### Adding New Features
1. Create feature branch: `git checkout -b feature/new-feature`
2. Develop locally using `npm run dev`
3. Test with `npm test`
4. Create preview: `npm run deploy:preview`
5. Test preview thoroughly
6. Create PR for review

#### Testing Email Functions
Set up development email variables in `.env` and test functions locally:
```bash
# Test event announcement
curl -X POST http://localhost:8888/.netlify/functions/send-event-announcement \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{"eventId": "test_event_id"}'
```

#### Working with Netlify Blobs
All data is stored in Netlify Blobs. For local development:
1. Use development environment variables
2. Functions automatically connect to production data
3. Be careful with test data affecting live site

### Troubleshooting

#### Functions Not Working Locally
- Check environment variables in `.env`
- Verify Netlify CLI is linked: `npx netlify status`
- Check function logs in terminal

#### Authentication Issues
- Re-authenticate: `npx netlify logout && npx netlify login`
- Check personal access token in Netlify dashboard

#### Build Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)

### Deployment Workflow

1. **Development**: `npm run dev` for local testing
2. **Preview**: `npm run deploy:preview` for staging
3. **Production**: `npm run deploy:prod` for live deployment

### Getting Help

- Check function logs in Netlify dashboard
- Use `npx netlify logs` for deployment logs
- Review this guide and CLAUDE.md for project details