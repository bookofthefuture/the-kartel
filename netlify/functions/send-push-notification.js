const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');

// Configure web-push with VAPID keys (these should be in environment variables)
webpush.setVapidDetails(
  'mailto:admin@thekartel.co.uk', // Replace with your email
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event, context) => {
  console.log('Push notification send request received');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Verify admin authentication
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Missing or invalid authorization header' })
    };
  }

  const token = authHeader.substring(7);
  if (token !== process.env.ADMIN_TOKEN) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid admin token' })
    };
  }

  try {
    const { 
      title, 
      body, 
      userType = 'all', // 'member', 'admin', or 'all'
      data = {},
      icon,
      badge,
      requireInteraction = true
    } = JSON.parse(event.body);
    
    if (!title || !body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing title or body' })
      };
    }

    // Get push subscriptions
    const subscriptionsStore = getStore('push-subscriptions');
    let allSubscriptions = [];
    
    try {
      const subscriptionsList = await subscriptionsStore.get('all-subscriptions');
      if (subscriptionsList) {
        allSubscriptions = JSON.parse(subscriptionsList);
      }
    } catch (error) {
      console.log('No subscriptions found');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'No subscriptions to send to',
          sent: 0,
          failed: 0
        })
      };
    }

    // Filter subscriptions based on userType
    let targetSubscriptions = allSubscriptions;
    if (userType !== 'all') {
      targetSubscriptions = allSubscriptions.filter(sub => sub.userType === userType);
    }

    if (targetSubscriptions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: `No ${userType} subscriptions found`,
          sent: 0,
          failed: 0
        })
      };
    }

    // Prepare notification payload
    const notificationPayload = {
      title,
      body,
      icon: icon || '/icons/icon-192x192.svg',
      badge: badge || '/icons/icon-96x96.svg',
      data: {
        ...data,
        timestamp: Date.now(),
        isAdmin: userType === 'admin'
      },
      requireInteraction,
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    // Send notifications
    const results = await Promise.allSettled(
      targetSubscriptions.map(async (subscriptionData) => {
        try {
          await webpush.sendNotification(
            subscriptionData.subscription,
            JSON.stringify(notificationPayload)
          );
          console.log(`Notification sent to ${subscriptionData.id}`);
          return { success: true, id: subscriptionData.id };
        } catch (error) {
          console.error(`Failed to send notification to ${subscriptionData.id}:`, error);
          
          // If subscription is invalid (410 Gone), remove it
          if (error.statusCode === 410) {
            console.log(`Removing invalid subscription: ${subscriptionData.id}`);
            await subscriptionsStore.delete(subscriptionData.id);
            
            // Update the all-subscriptions list
            const updatedSubscriptions = allSubscriptions.filter(
              sub => sub.id !== subscriptionData.id
            );
            await subscriptionsStore.set('all-subscriptions', JSON.stringify(updatedSubscriptions));
          }
          
          return { success: false, id: subscriptionData.id, error: error.message };
        }
      })
    );

    // Count successes and failures
    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    const failed = results.length - successful;

    console.log(`Push notifications sent: ${successful} successful, ${failed} failed`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true,
        message: `Notifications sent to ${userType} users`,
        sent: successful,
        failed: failed,
        total: results.length
      })
    };

  } catch (error) {
    console.error('Error sending push notifications:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send notifications' })
    };
  }
};