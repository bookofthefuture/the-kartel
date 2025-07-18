// netlify/functions/import-members.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { sanitizeApplication } = require('./input-sanitization');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate JWT token and require admin role
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
  }

  try {
    console.log('📥 Starting CSV import');
    
    const { csvData } = JSON.parse(event.body);
    
    if (!csvData || !Array.isArray(csvData)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid CSV data format' })
      };
    }

    // Check environment variables first
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Manual configuration with explicit credentials
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get existing applications
    let existingApplications = [];
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      if (applicationsList && Array.isArray(applicationsList)) {
        existingApplications = applicationsList;
      }
    } catch (error) {
      console.log('📝 No existing applications list found');
      existingApplications = [];
    }

    const importResults = {
      imported: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    const timestamp = new Date().toISOString();

    // Process each row from CSV
    for (const row of csvData) {
      try {
        // Sanitize the row data first
        const sanitizedRow = sanitizeApplication(row);
        
        // Validate required fields after sanitization
        if (!sanitizedRow.email || !sanitizedRow.firstName || !sanitizedRow.lastName) {
          importResults.errors++;
          importResults.details.push({
            row: row,
            status: 'error',
            message: 'Missing required fields (email, firstName, lastName) after sanitization'
          });
          continue;
        }

        // Check if member already exists
        const existingMember = existingApplications.find(app => 
          app.email.toLowerCase() === sanitizedRow.email.toLowerCase()
        );

        if (existingMember) {
          importResults.skipped++;
          importResults.details.push({
            row: row,
            status: 'skipped',
            message: 'Member already exists'
          });
          continue;
        }

        // Create application object with sanitized data
        const application = {
          id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          firstName: sanitizedRow.firstName,
          lastName: sanitizedRow.lastName,
          fullName: `${sanitizedRow.firstName} ${sanitizedRow.lastName}`.trim(),
          email: sanitizedRow.email,
          company: sanitizedRow.company,
          position: sanitizedRow.position,
          phone: sanitizedRow.phone,
          linkedin: sanitizedRow.linkedin,
          experience: sanitizedRow.experience,
          interests: sanitizedRow.interests,
          referral: sanitizedRow.referral,
          status: 'approved', // Imported members are pre-approved
          submittedAt: timestamp,
          reviewedAt: timestamp,
          reviewedBy: 'Admin (CSV Import)',
          approveToken: crypto.randomBytes(16).toString('hex'),
          rejectToken: crypto.randomBytes(16).toString('hex'),
          importedAt: timestamp
        };

        // Store individual application
        await applicationsStore.setJSON(application.id, application);
        
        // Add to existing applications list
        existingApplications.push(application);

        importResults.imported++;
        importResults.details.push({
          row: row,
          status: 'imported',
          message: 'Successfully imported',
          applicationId: application.id
        });

        console.log(`✅ Imported: ${application.fullName} (${application.email})`);

      } catch (error) {
        console.error(`❌ Error importing row:`, error);
        importResults.errors++;
        importResults.details.push({
          row: row,
          status: 'error',
          message: error.message
        });
      }
    }

    // Update the applications list
    try {
      await applicationsStore.setJSON('_list', existingApplications);
      console.log('✅ Applications list updated');
    } catch (listError) {
      console.log('⚠️ Failed to update applications list:', listError.message);
    }

    console.log(`📊 Import completed: ${importResults.imported} imported, ${importResults.skipped} skipped, ${importResults.errors} errors`);

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        success: true, 
        message: 'CSV import completed',
        results: importResults
      })
    };

  } catch (error) {
    console.error('💥 Error importing CSV:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};