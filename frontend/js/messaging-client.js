/**
 * Real-time Messaging Client
 * Handles WebSocket connection for instant messaging, read receipts, and typing indicators
 */

class MessagingClient {
    constructor(authManager) {
        this.authManager = authManager;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
        this.listeners = {
            message: [],
            typing: [],
            read: [],
            connected: [],
            disconnected: [],
            error: []
        };
        this.currentUserId = null;
    }

    /**
     * Connect to WebSocket server
     */
    async connect(userId) {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.currentUserId = userId;
        this.isConnecting = true;

        try {
            const token = this.authManager.getToken();
            if (!token) {
                throw new Error('No authentication token available');
            }

            // Connect to WebSocket endpoint with auth token
            const wsUrl = `ws://localhost:5008/ws?token=${encodeURIComponent(token)}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.emit('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnecting = false;
                this.emit('disconnected');
                this.attemptReconnect();
            };

        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.isConnecting = false;
            this.emit('error', error);
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(data) {
        switch (data.type) {
            case 'new_message':
                this.emit('message', data.message);
                break;
            case 'typing_start':
                this.emit('typing', { userId: data.userId, isTyping: true });
                break;
            case 'typing_stop':
                this.emit('typing', { userId: data.userId, isTyping: false });
                break;
            case 'message_read':
                this.emit('read', { messageIds: data.messageIds, userId: data.userId });
                break;
            case 'connected':
                console.log('WebSocket handshake complete');
                break;
            case 'error':
                console.error('Server error:', data.error);
                this.emit('error', data.error);
                break;
            default:
                console.warn('Unknown message type:', data.type);
        }
    }

    /**
     * Send a message
     */
    sendMessage(receiverId, content) {
        if (!this.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        this.ws.send(JSON.stringify({
            type: 'send_message',
            receiverId,
            content
        }));
    }

    /**
     * Send typing indicator
     */
    sendTypingIndicator(receiverId, isTyping) {
        if (!this.isConnected()) {
            return; // Silently fail for typing indicators
        }

        this.ws.send(JSON.stringify({
            type: 'typing_indicator',
            receiverId,
            isTyping
        }));
    }

    /**
     * Mark messages as read
     */
    markAsRead(otherUserId) {
        if (!this.isConnected()) {
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'mark_read',
            otherUserId
        }));
    }

    /**
     * Event listener registration
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event to all listeners
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    /**
     * Check if WebSocket is connected
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Attempt to reconnect
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            if (this.currentUserId) {
                this.connect(this.currentUserId);
            }
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.currentUserId = null;
        this.reconnectAttempts = 0;
    }
}

// Export for use in other scripts
window.MessagingClient = MessagingClient;