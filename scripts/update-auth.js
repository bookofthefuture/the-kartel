#!/usr/bin/env node
// scripts/update-auth.js
const fs = require('fs');
const path = require('path');

const functionsDir = path.join(__dirname, '../netlify/functions');

// Functions that require admin role
const adminOnlyFunctions = [
  'send-event-announcement.js',
  'create-venue.js', 
  'send-admin-invitation.js',
  'get-venues.js',
  'update-applicant-details.js', 
  'delete-application.js',
  'get-applications.js',
  'delete-event.js',
  'delete-venue.js',
  'update-application.js',
  'send-test-email.js',
  'update-venue.js',
  'get-events.js',
  'import-members.js',
  'update-event.js',
  'upload-video-vimeo.js',
  'upload-photo.js',
  'send-push-notification.js',
  'get-faqs.js',
  'recover-applications-list.js',
  'delete-faq.js',
  'seed-faqs.js',
  'update-faq.js',
  'get-gallery.js',
  'update-gallery.js',
  'get-experience-video.js',
  'update-experience-video.js'
];

// Functions that require member role (includes admins)
const memberFunctions = [
  'get-venues-member.js',
  'get-events-member.js',
  'cancel-sign-up.js',
  'sign-up-event.js',
  'set-member-password.js'
];

// Old insecure auth pattern to replace
const oldAuthPattern = `  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.length < 32) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }`;

// New secure auth patterns
const adminAuthPattern = `  // Validate JWT token and require admin role
  const authResult = validateAuthHeader(event.headers.authorization);
  if (!authResult.success) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error })
    };
  }

  // Check if user has admin role
  const roleCheck = requireRole(['admin', 'super-admin'])(authResult.payload);
  if (!roleCheck.success) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }`;

const memberAuthPattern = `  // Validate JWT token
  const authResult = validateAuthHeader(event.headers.authorization);
  if (!authResult.success) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error })
    };
  }

  // Require member role (includes admins)
  const roleCheck = requireRole(['member', 'admin', 'super-admin'])(authResult.payload);
  if (!roleCheck.success) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }`;

function updateFunction(filename) {
  const filepath = path.join(functionsDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return;
  }

  let content = fs.readFileSync(filepath, 'utf8');
  
  // Skip if already updated
  if (content.includes('validateAuthHeader')) {
    console.log(`✅ Already updated: ${filename}`);
    return;
  }

  // Skip if no auth pattern found
  if (!content.includes('token.length < 32')) {
    console.log(`⏭️  No auth pattern found: ${filename}`);
    return;
  }

  // Add import at the top
  if (!content.includes('jwt-auth')) {
    content = content.replace(
      /const \{ getStore \} = require\('@netlify\/blobs'\);/,
      `const { getStore } = require('@netlify/blobs');\nconst { validateAuthHeader, requireRole } = require('./jwt-auth');`
    );
  }

  // Replace auth pattern
  if (adminOnlyFunctions.includes(filename)) {
    content = content.replace(oldAuthPattern, adminAuthPattern);
    console.log(`🔧 Updated admin function: ${filename}`);
  } else if (memberFunctions.includes(filename)) {
    content = content.replace(oldAuthPattern, memberAuthPattern);
    console.log(`🔧 Updated member function: ${filename}`);
  } else {
    console.log(`❓ Unknown function type: ${filename}`);
    return;
  }

  fs.writeFileSync(filepath, content);
}

// Update all functions
console.log('🚀 Starting authentication update...\n');

[...adminOnlyFunctions, ...memberFunctions].forEach(updateFunction);

console.log('\n✅ Authentication update complete!');