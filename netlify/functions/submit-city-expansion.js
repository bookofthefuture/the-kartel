// netlify/functions/submit-city-expansion.js
const sgMail = require('@sendgrid/mail');

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse form data
    const body = new URLSearchParams(event.body);
    const formData = {
      name: body.get('name'),
      email: body.get('email'),
      phone: body.get('phone'),
      city: body.get('city'),
      track: body.get('track'),
      experience: body.get('experience'),
      message: body.get('message')
    };

    // Validate required fields
    if (!formData.name || !formData.email || !formData.city || !formData.message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Please fill in all required fields' })
      };
    }

    // Email to admin
    const adminEmail = {
      to: process.env.ADMIN_EMAIL,
      from: process.env.FROM_EMAIL,
      subject: `New City Expansion Interest - ${formData.city}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">The Kartel</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">City Expansion Interest</p>
          </div>
          
          <div style="padding: 40px; background: #f8f9fa;">
            <h2 style="color: #e74c3c; margin-bottom: 30px; font-size: 24px;">New Group Leader Application</h2>
            
            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
              <h3 style="color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Contact Information</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Phone:</strong> ${formData.phone || 'Not provided'}</p>
              <p><strong>City/Town:</strong> ${formData.city}</p>
            </div>

            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
              <h3 style="color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Local Details</h3>
              <p><strong>Local Kart Track:</strong> ${formData.track || 'Not specified'}</p>
              <p><strong>Experience:</strong> ${formData.experience || 'Not specified'}</p>
            </div>

            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h3 style="color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Their Vision</h3>
              <p style="background: #f8f9fa; padding: 20px; border-left: 4px solid #e74c3c; margin: 0; white-space: pre-wrap;">${formData.message}</p>
            </div>
          </div>
          
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; font-size: 14px;">
            <p style="margin: 0;">The Kartel - Where Business Meets the Track</p>
            <p style="margin: 5px 0 0 0; opacity: 0.8;">New city expansion inquiry from ${formData.city}</p>
          </div>
        </div>
      `
    };

    // Confirmation email to applicant
    const confirmationEmail = {
      to: formData.email,
      from: process.env.FROM_EMAIL,
      subject: 'Thank you for your interest in The Kartel',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">The Kartel</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank You for Your Interest</p>
          </div>
          
          <div style="padding: 40px; background: #f8f9fa;">
            <h2 style="color: #e74c3c; margin-bottom: 20px;">Hello ${formData.name},</h2>
            
            <p>Thank you for your interest in bringing The Kartel to <strong>${formData.city}</strong>!</p>
            
            <p>We're excited to learn about your vision for creating a premium business networking experience in your area. Our team will review your application and get back to you within 2-3 business days to discuss the next steps.</p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin: 30px 0;">
              <h3 style="color: #2c3e50; margin-bottom: 15px;">What Happens Next?</h3>
              <ul style="color: #5d6d7e; margin: 0; padding-left: 20px;">
                <li>We'll review your application and local market potential</li>
                <li>If it's a good fit, we'll arrange a call to discuss the opportunity</li>
                <li>We'll provide you with our group leader resources and guidelines</li>
                <li>Together, we'll plan the launch of The Kartel in ${formData.city}</li>
              </ul>
            </div>
            
            <p>In the meantime, feel free to reach out if you have any questions.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Kartel Team</strong>
            </p>
          </div>
          
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; font-size: 14px;">
            <p style="margin: 0;">The Kartel - Where Business Meets the Track</p>
            <p style="margin: 5px 0 0 0; opacity: 0.8;">Building premium networking communities across the UK</p>
          </div>
        </div>
      `
    };

    // Send emails
    await Promise.all([
      sgMail.send(adminEmail),
      sgMail.send(confirmationEmail)
    ]);

    console.log(`✅ City expansion inquiry sent for ${formData.city} from ${formData.email}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Thank you! We\'ll be in touch soon to discuss bringing The Kartel to your city.'
      })
    };

  } catch (error) {
    console.error('💥 Error processing city expansion form:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Sorry, there was an error sending your message. Please try again.'
      })
    };
  }
};