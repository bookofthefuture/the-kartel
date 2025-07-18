// netlify/functions/member-login.js
const { getStore } = require('@netlify/blobs');
const { verifyPasswordAsync, shouldUpgradeHash, hashPasswordAsync } = require('./password-utils');
const { generateToken } = require('./jwt-auth');
const { verifySuperAdminCredentials } = require('./timing-safe-utils');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { findItemByField } = require('./blob-list-utils');

async function handlePasswordAuth(event, email, password, storeConfig) {
  // Use efficient field search to find member by email
  const memberApplication = await findItemByField(storeConfig, 'app_', 'email', email.toLowerCase());

  if (!memberApplication || memberApplication.status !== 'approved') {
    console.log(`❌ Failed login attempt for: ${email.split('@')[1]} domain (Not found or not approved)`);
    return {
      statusCode: 401,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ error: 'Invalid credentials or application not approved' })
    };
  }

  // Check if member has password set
  if (!memberApplication.memberPasswordHash || !memberApplication.memberPasswordSalt) {
    console.log(`❌ Password login attempted for ${email.split('@')[1]} domain but no password set`);
    return {
      statusCode: 401,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ error: 'Password not set. Please use magic link login or contact admin.' })
    };
  }

  // Verify password with auto-detection of algorithm
  const algorithm = memberApplication.memberPasswordAlgorithm || 'pbkdf2';
  const isValid = await verifyPasswordAsync(
    password,
    memberApplication.memberPasswordHash,
    memberApplication.memberPasswordSalt,
    algorithm
  );

  if (!isValid) {
    console.log(`❌ Invalid password for member: ${email.split('@')[1]} domain`);
    return {
      statusCode: 401,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ error: 'Invalid credentials' })
    };
  }

  // Check if password hash should be upgraded to Argon2id
  if (shouldUpgradeHash(algorithm)) {
    console.log(`🔄 Password hash upgrade recommended for: ${email.split('@')[1]} domain (${algorithm} -> argon2id)`);
    try {
      const { hash: newHash, algorithm: newAlgorithm } = await hashPasswordAsync(password);
      const applicationsStore = getStore(storeConfig);
      const memberKey = `member_${memberApplication.id}`;
      const updatedMember = {
        ...memberApplication,
        memberPasswordHash: newHash,
        memberPasswordAlgorithm: newAlgorithm,
        memberPasswordSalt: newAlgorithm === 'argon2id' ? undefined : memberApplication.memberPasswordSalt,
        passwordUpgradedAt: new Date().toISOString()
      };
      await applicationsStore.set(memberKey, JSON.stringify(updatedMember));
      console.log(`✅ Password hash upgraded successfully for: ${email.split('@')[1]} domain`);
    } catch (upgradeError) {
      console.error(`❌ Failed to upgrade password hash for ${email.split('@')[1]} domain:`, upgradeError);
    }
  }

  return { memberApplication };
}

async function handleMagicLinkAuth(event, token, storeConfig) {
  const tokenStore = getStore({ ...storeConfig, name: 'login-tokens' });
  const applicationsStore = getStore(storeConfig);

  const tokenData = await tokenStore.get(token, { type: 'json' });

  if (!tokenData) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired login link' }) };
  }

  if (new Date() > new Date(tokenData.expiresAt)) {
    await tokenStore.delete(token);
    return { statusCode: 401, body: JSON.stringify({ error: 'Login link has expired' }) };
  }

  if (tokenData.used) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Login link has already been used' }) };
  }

  const memberApplication = await applicationsStore.get(tokenData.memberId, { type: 'json' });

  if (!memberApplication || memberApplication.status !== 'approved') {
    return { statusCode: 401, body: JSON.stringify({ error: 'Member account not found or not active' }) };
  }

  tokenData.used = true;
  tokenData.usedAt = new Date().toISOString();
  await tokenStore.setJSON(token, tokenData);

  return { memberApplication };
}

exports.handler = async (event, context) => {
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email, password, token } = JSON.parse(event.body);

    if (!email && !token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email or token is required' }) };
    }
    
    if (email && password) {
        if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD && verifySuperAdminCredentials(email, password, process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_PASSWORD)) {
            console.log('✅ Super admin authenticated successfully');
            const tokenPayload = { userId: 'super-admin', email: process.env.SUPER_ADMIN_EMAIL, roles: ['super-admin', 'admin'], type: 'super-admin' };
            const jwtToken = generateToken(tokenPayload);
            return {
                statusCode: 200,
                headers: createSecureHeaders(event),
                body: JSON.stringify({
                    success: true,
                    token: jwtToken,
                    memberId: 'super-admin',
                    memberEmail: process.env.SUPER_ADMIN_EMAIL,
                    memberFullName: 'Super Administrator',
                    memberProfile: { firstName: 'Super', lastName: 'Administrator', company: 'The Kartel Franchise', position: 'Super Administrator', hasPassword: true },
                    isAdmin: true,
                    isSuperAdmin: true
                })
            };
        }
    }

    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
    }

    const storeConfig = {
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    };

    let authResult;
    if (token) {
      console.log(`🔗 Magic link authentication attempt`);
      authResult = await handleMagicLinkAuth(event, token, storeConfig);
    } else if (email && password) {
      console.log(`🔒 Password authentication attempt for: ${email.split('@')[1]} domain`);
      authResult = await handlePasswordAuth(event, email, password, storeConfig);
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request. Provide email and password, or a magic link token.' }) };
    }

    if (authResult.statusCode) {
      return authResult;
    }

    const { memberApplication } = authResult;
    const roles = ['member'];
    if (memberApplication.isAdmin) roles.push('admin');
    if (memberApplication.isSuperAdmin) roles.push('super-admin');

    const tokenPayload = {
      userId: memberApplication.id,
      email: memberApplication.email,
      roles: roles,
      type: 'member'
    };
    const jwtToken = generateToken(tokenPayload);

    console.log(`✅ Login successful for: ${memberApplication.email}`);

    const response = {
      success: true,
      token: jwtToken,
      memberId: memberApplication.id,
      memberEmail: memberApplication.email,
      memberFullName: memberApplication.fullName || `${memberApplication.firstName || ''} ${memberApplication.lastName || ''}`.trim() || memberApplication.email,
      isAdmin: !!memberApplication.isAdmin,
      isSuperAdmin: !!memberApplication.isSuperAdmin,
      roles: roles,
      memberProfile: {
        firstName: memberApplication.firstName,
        lastName: memberApplication.lastName,
        company: memberApplication.company,
        position: memberApplication.position,
        phone: memberApplication.phone,
        linkedin: memberApplication.linkedin,
        hasPassword: !!(memberApplication.memberPasswordHash && memberApplication.memberPasswordSalt)
      },
      message: 'Login successful'
    };
    
    if (memberApplication.isAdmin) {
      response.adminUser = {
        id: memberApplication.id,
        email: memberApplication.email,
        name: response.memberFullName,
        firstName: memberApplication.firstName,
        lastName: memberApplication.lastName
      };
    }

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('💥 Error during member login:', error);
    return {
      statusCode: 500,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};