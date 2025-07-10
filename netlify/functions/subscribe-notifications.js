const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  console.log('Push subscription request received');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { subscription, userType, userId } = JSON.parse(event.body);
    
    if (!subscription || !userType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing subscription or userType' })
      };
    }

    // Get push subscriptions store
    const subscriptionsStore = getStore('push-subscriptions');
    
    // Create subscription object
    const subscriptionData = {
      id: `${userType}-${userId || Date.now()}`,
      subscription: subscription,
      userType: userType, // 'member' or 'admin'
      userId: userId,
      createdAt: new Date().toISOString(),
      active: true
    };

    // Store the subscription
    await subscriptionsStore.set(subscriptionData.id, JSON.stringify(subscriptionData));

    // Also maintain a list of all active subscriptions
    let allSubscriptions = [];
    try {
      const existingList = await subscriptionsStore.get('all-subscriptions');
      if (existingList) {
        allSubscriptions = JSON.parse(existingList);
      }
    } catch (error) {
      console.log('No existing subscriptions list found, creating new one');
    }

    // Add to list if not already present
    const existingIndex = allSubscriptions.findIndex(sub => sub.id === subscriptionData.id);
    if (existingIndex >= 0) {
      allSubscriptions[existingIndex] = subscriptionData;
    } else {
      allSubscriptions.push(subscriptionData);
    }

    // Clean up inactive subscriptions (older than 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    allSubscriptions = allSubscriptions.filter(sub => 
      new Date(sub.createdAt) > ninetyDaysAgo
    );

    await subscriptionsStore.set('all-subscriptions', JSON.stringify(allSubscriptions));

    console.log(`Push subscription stored for ${userType} user:`, subscriptionData.id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Subscription stored successfully',
        subscriptionId: subscriptionData.id
      })
    };

  } catch (error) {
    console.error('Error storing push subscription:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to store subscription' })
    };
  }
};