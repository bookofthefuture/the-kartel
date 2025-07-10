// Push Notification Manager for The Kartel PWA
// Handles notification permissions, subscriptions, and messaging

class NotificationManager {
    constructor(userType = 'member') {
        this.userType = userType; // 'member' or 'admin'
        this.vapidPublicKey = null;
        this.subscription = null;
        this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        
        if (this.isSupported) {
            this.init();
        }
    }

    async init() {
        try {
            // Get VAPID public key
            await this.getVapidKey();
            
            // Check existing subscription
            await this.checkExistingSubscription();
            
            // Show permission prompt if needed
            this.checkPermissionStatus();
            
        } catch (error) {
            console.error('NotificationManager init error:', error);
        }
    }

    async getVapidKey() {
        try {
            const response = await fetch('/.netlify/functions/get-vapid-key');
            if (response.ok) {
                const data = await response.json();
                this.vapidPublicKey = data.publicKey;
                console.log('VAPID key retrieved successfully');
            } else {
                throw new Error('Failed to get VAPID key');
            }
        } catch (error) {
            console.error('Error getting VAPID key:', error);
        }
    }

    async checkExistingSubscription() {
        if (!this.isSupported) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                this.subscription = subscription;
                console.log('Existing push subscription found');
                
                // Verify subscription is still valid on server
                await this.updateSubscriptionOnServer(subscription);
            }
        } catch (error) {
            console.error('Error checking existing subscription:', error);
        }
    }

    checkPermissionStatus() {
        if (!this.isSupported) return;

        const permission = Notification.permission;
        console.log('Notification permission status:', permission);

        if (permission === 'default' && !localStorage.getItem(`kartel_${this.userType}_notifications_dismissed`)) {
            // Show custom permission prompt after a delay
            setTimeout(() => {
                this.showPermissionPrompt();
            }, this.userType === 'admin' ? 15000 : 10000); // Longer delay for admin
        } else if (permission === 'granted' && !this.subscription) {
            // Permission granted but no subscription, create one
            this.subscribe();
        }
    }

    showPermissionPrompt() {
        const promptId = `notificationPrompt_${this.userType}`;
        
        // Don't show if already exists
        if (document.getElementById(promptId)) return;

        const isAdmin = this.userType === 'admin';
        const bgColor = isAdmin ? '#e74c3c' : '#2c3e50';
        const accentColor = isAdmin ? '#c0392b' : '#3498db';
        
        const prompt = document.createElement('div');
        prompt.id = promptId;
        prompt.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; background: ${bgColor}; color: white;
            padding: 20px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000; max-width: 350px; font-family: 'League Spartan', sans-serif;
            animation: slideInUp 0.3s ease-out;
        `;
        
        // Add CSS animation
        if (!document.getElementById('notificationPromptStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationPromptStyles';
            style.textContent = `
                @keyframes slideInUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes slideOutDown {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        prompt.innerHTML = `
            <div style="margin-bottom: 15px;">
                <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">
                    🔔 Stay Updated
                </div>
                <div style="font-size: 0.9rem; line-height: 1.4; opacity: 0.9;">
                    ${isAdmin 
                        ? 'Get instant notifications for new applications, events, and system alerts.' 
                        : 'Get notified about new events, updates, and important announcements.'
                    }
                </div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="enableNotifications_${this.userType}" style="
                    background: ${accentColor}; color: white; border: none; 
                    padding: 10px 16px; border-radius: 5px; cursor: pointer; 
                    font-family: inherit; font-weight: 600; flex: 1;
                ">Enable Notifications</button>
                <button id="dismissNotifications_${this.userType}" style="
                    background: transparent; color: #ecf0f1; border: 1px solid #bdc3c7; 
                    padding: 10px 16px; border-radius: 5px; cursor: pointer; 
                    font-family: inherit; flex: 1;
                ">Maybe Later</button>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        // Add event listeners
        document.getElementById(`enableNotifications_${this.userType}`).addEventListener('click', () => {
            this.requestPermission();
            this.dismissPrompt(promptId);
        });
        
        document.getElementById(`dismissNotifications_${this.userType}`).addEventListener('click', () => {
            localStorage.setItem(`kartel_${this.userType}_notifications_dismissed`, 'true');
            this.dismissPrompt(promptId);
        });
    }

    dismissPrompt(promptId) {
        const prompt = document.getElementById(promptId);
        if (prompt) {
            prompt.style.animation = 'slideOutDown 0.3s ease-in';
            setTimeout(() => prompt.remove(), 300);
        }
    }

    async requestPermission() {
        if (!this.isSupported) {
            console.log('Push notifications not supported');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            console.log('Notification permission result:', permission);
            
            if (permission === 'granted') {
                await this.subscribe();
                this.showSuccessMessage();
                return true;
            } else {
                this.showErrorMessage('Notifications were not enabled. You can enable them later in your browser settings.');
                return false;
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            this.showErrorMessage('Failed to enable notifications. Please try again.');
            return false;
        }
    }

    async subscribe() {
        if (!this.isSupported || !this.vapidPublicKey) {
            console.log('Cannot subscribe: missing requirements');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
            });

            console.log('Push subscription created:', subscription);
            this.subscription = subscription;

            // Send subscription to server
            await this.updateSubscriptionOnServer(subscription);
            
        } catch (error) {
            console.error('Error creating push subscription:', error);
            this.showErrorMessage('Failed to set up notifications. Please try again.');
        }
    }

    async updateSubscriptionOnServer(subscription) {
        try {
            const userId = this.userType === 'admin' ? 'admin' : 
                          (window.currentMember ? window.currentMember.id : null);
            
            const response = await fetch('/.netlify/functions/subscribe-notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscription: subscription,
                    userType: this.userType,
                    userId: userId
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Subscription stored on server:', data);
                localStorage.setItem(`kartel_${this.userType}_subscription_id`, data.subscriptionId);
            } else {
                throw new Error('Failed to store subscription on server');
            }
        } catch (error) {
            console.error('Error updating subscription on server:', error);
        }
    }

    async unsubscribe() {
        if (!this.subscription) return;

        try {
            await this.subscription.unsubscribe();
            this.subscription = null;
            
            // Remove from server would be implemented here
            localStorage.removeItem(`kartel_${this.userType}_subscription_id`);
            
            console.log('Push subscription removed');
            this.showSuccessMessage('Notifications have been disabled.');
        } catch (error) {
            console.error('Error unsubscribing:', error);
            this.showErrorMessage('Failed to disable notifications.');
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type = 'info') {
        const messageId = `notificationMessage_${Date.now()}`;
        const isSuccess = type === 'success';
        const bgColor = isSuccess ? '#27ae60' : '#e74c3c';
        
        const messageEl = document.createElement('div');
        messageEl.id = messageId;
        messageEl.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: ${bgColor}; color: white; padding: 15px 25px;
            border-radius: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10001; font-family: 'League Spartan', sans-serif;
            font-weight: 600; animation: slideInDown 0.3s ease-out;
        `;
        
        messageEl.textContent = message;
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.style.animation = 'slideOutUp 0.3s ease-in';
            setTimeout(() => messageEl.remove(), 300);
        }, 4000);
    }

    // Check if notifications are enabled
    isEnabled() {
        return Notification.permission === 'granted' && this.subscription !== null;
    }

    // Get current status
    getStatus() {
        return {
            supported: this.isSupported,
            permission: Notification.permission,
            subscribed: !!this.subscription,
            userType: this.userType
        };
    }
}

// Export for use in both member and admin apps
window.NotificationManager = NotificationManager;