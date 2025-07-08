// netlify/functions/send-event-announcement.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check authentication
  const authHeader = event.headers.authorization;
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
  }

  try {
    const { eventId } = JSON.parse(event.body);
    
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing eventId' })
      };
    }

    console.log(`📧 Sending event announcement for ${eventId}`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Get stores
    const eventsStore = getStore({
      name: 'events',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const venuesStore = getStore({
      name: 'venues',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get event details
    const eventDetails = await eventsStore.get(eventId, { type: 'json' });
    if (!eventDetails) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Event not found' })
      };
    }

    // Get venue details
    const venueDetails = await venuesStore.get(eventDetails.venue, { type: 'json' });
    
    // Get all approved members
    const applications = await applicationsStore.get('_list', { type: 'json' }) || [];
    const approvedMembers = applications.filter(app => app.status === 'approved');

    console.log(`📬 Found ${approvedMembers.length} approved members to email`);

    // Send emails to all approved members
    const emailPromises = approvedMembers.map(member => 
      sendEventAnnouncementEmail(member, eventDetails, venueDetails)
    );

    const results = await Promise.allSettled(emailPromises);
    
    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    console.log(`📧 Email results: ${successes} sent, ${failures} failed`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: `Event announcement sent to ${successes} members`,
        stats: {
          sent: successes,
          failed: failures,
          total: approvedMembers.length
        }
      })
    };

  } catch (error) {
    console.error('💥 Error sending event announcement:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

async function sendEventAnnouncementEmail(member, eventDetails, venueDetails) {
  const baseUrl = process.env.SITE_URL || 'https://the-kartel.com';
  
  // Generate secure registration token
  const registrationToken = crypto.createHash('sha256')
    .update(`${eventDetails.id}:${member.email}:${process.env.NETLIFY_ACCESS_TOKEN}`)
    .digest('hex')
    .substring(0, 32);

  const quickRegisterUrl = `${baseUrl}/.netlify/functions/quick-register-event`;
  
  // Format date and time
  const eventDate = new Date(eventDetails.date);
  const formattedDate = eventDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const formattedTime = eventDetails.time || 'TBC';
  
  // Get TeamSport booking link if available
  const teamSportLink = venueDetails?.website || '#';
  const venueName = venueDetails?.name || eventDetails.venue;
  const venueAddress = venueDetails?.address || eventDetails.venueAddress || '';
  
  const subject = `🏎️ New Kartel Event: ${eventDetails.name}`;
  
  const htmlBody = `
    <div style="font-family: 'League Spartan', 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); color: white; padding: 30px; text-align: center;">
        <img src="${baseUrl}/assets/the-kartel-logo.png" alt="The Kartel Logo" style="height: 60px; width: auto; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; font-family: 'League Spartan', 'Arial', sans-serif;">The Kartel</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; font-family: 'League Spartan', 'Arial', sans-serif;">New Event Announcement</p>
      </div>
      
      <!-- Event Details -->
      <div style="padding: 30px; background: white; border-left: 4px solid #3498db;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 24px; font-family: 'League Spartan', 'Arial', sans-serif;">${eventDetails.name}</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>📅 Date:</strong> ${formattedDate}</p>
          <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>🕐 Time:</strong> ${formattedTime}</p>
          <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>🏁 Venue:</strong> ${venueName}</p>
          ${venueAddress ? `<p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📍 ${venueAddress}</p>` : ''}
          ${eventDetails.maxAttendees ? `<p style="margin: 0; font-size: 14px; color: #666;">👥 Max Attendees: ${eventDetails.maxAttendees}</p>` : ''}
        </div>
        
        ${eventDetails.description ? `<p style="font-size: 16px; line-height: 1.6; color: #2c3e50; margin: 20px 0;">${eventDetails.description}</p>` : ''}
      </div>
      
      <!-- Quick Registration -->
      <div style="padding: 30px; background: #ecf0f1; text-align: center;">
        <h3 style="color: #2c3e50; margin-bottom: 20px; font-family: 'League Spartan', 'Arial', sans-serif;">Register Now</h3>
        
        <div style="margin-bottom: 30px;">
          <form action="${quickRegisterUrl}" method="POST" style="display: inline-block;">
            <input type="hidden" name="eventId" value="${eventDetails.id}">
            <input type="hidden" name="memberEmail" value="${member.email}">
            <input type="hidden" name="token" value="${registrationToken}">
            
            <button type="submit" style="background: #27ae60; color: white; padding: 15px 30px; font-size: 16px; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; font-family: 'League Spartan', 'Arial', sans-serif;">
              🎫 Register for Event
            </button>
          </form>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 0;">
          By clicking above, you'll be automatically registered for this event.
        </p>
      </div>
      
      <!-- TeamSport Booking -->
      <div style="padding: 30px; background: #fff3cd; border-left: 4px solid #f1c40f;">
        <h3 style="color: #8b6914; margin-top: 0; font-family: 'League Spartan', 'Arial', sans-serif;">⚠️ Important: TeamSport Booking Required</h3>
        <p style="color: #8b6914; margin-bottom: 20px; font-size: 16px; line-height: 1.6;">
          <strong>Don't forget:</strong> You also need to book directly with TeamSport to secure your karting session. 
          Registration with The Kartel is just the first step!
        </p>
        
        <div style="text-align: center;">
          <a href="${teamSportLink}" target="_blank" 
             style="background: #f1c40f; color: #8b6914; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'League Spartan', 'Arial', sans-serif;">
            🏎️ Book with TeamSport
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="padding: 20px; text-align: center; color: #666; font-size: 14px;">
        <p style="margin: 0;">
          Questions? Contact us via the 
          <a href="${baseUrl}/members.html" style="color: #3498db; text-decoration: none;">members area</a>
        </p>
      </div>
    </div>
  `;

  try {
    if (!process.env.SENDGRID_API_KEY || !process.env.FROM_EMAIL) {
      console.log('SendGrid not configured, skipping email');
      return;
    }

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.send({
      to: member.email,
      from: process.env.FROM_EMAIL,
      subject: subject,
      html: htmlBody,
    });

    console.log(`✅ Event announcement sent to ${member.email}`);
  } catch (emailError) {
    console.error(`❌ Failed to send to ${member.email}:`, emailError);
    throw emailError;
  }
}