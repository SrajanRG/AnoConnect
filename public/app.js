class AnoConnect {
    constructor() {
        this.ws = null;
        this.userId = null;
        this.username = null;
        this.chatId = null;
        this.partnerId = null;
        this.partnerName = null;
        this.isConnected = false;
        this.isInChat = false;

        this.initElements();
        this.bindEvents();
        this.showUsernamePrompt();
    }

    initElements() {
        this.statusDiv = document.getElementById('status');
        this.chatWindow = document.getElementById('chat-window');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.endChatBtn = document.getElementById('endChatBtn');
        this.usernamePrompt = document.getElementById('username-prompt');
        this.usernameInput = document.getElementById('usernameInput');
        this.usernameBtn = document.getElementById('usernameBtn');
    }

    bindEvents() {
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.messageInput.value.trim() && this.isInChat) {
                this.sendMessage(this.messageInput.value.trim());
                this.messageInput.value = '';
            }
        });
        this.sendBtn.addEventListener('click', () => {
            if (this.messageInput.value.trim() && this.isInChat) {
                this.sendMessage(this.messageInput.value.trim());
                this.messageInput.value = '';
            }
        });
        this.newChatBtn.addEventListener('click', () => {
            this.findNewChat();
        });
        this.endChatBtn.addEventListener('click', () => {
            this.endChat();
        });
        this.usernameBtn.addEventListener('click', () => {
            this.submitUsername();
        });
        this.usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.submitUsername();
            }
        });
    }

    showUsernamePrompt() {
        this.usernamePrompt.style.display = 'block';
        this.chatWindow.style.display = 'none';
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        this.newChatBtn.disabled = true;
        this.endChatBtn.disabled = true;
        this.usernameInput.focus();
    }

    submitUsername() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.statusDiv.textContent = 'Please enter a username.';
            return;
        }
        this.username = username;
        this.usernamePrompt.style.display = 'none';
        this.chatWindow.style.display = 'flex';
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            if (this.username) {
                this.ws.send(JSON.stringify({ type: 'set_username', username: this.username }));
            }
            console.log('Connected to server');
            this.isConnected = true;
            this.updateStatus('Connected! Click "New Chat" to start chatting.');
            this.newChatBtn.disabled = false;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.updateStatus('Disconnected. Trying to reconnect...');
            this.disableControls();
            // Try to reconnect after 3 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connect();
                }
            }, 3000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('Connection error. Please refresh the page.');
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'connected':
                this.userId = data.userId;
                this.username = data.username;
                break;

            case 'waiting':
                this.updateStatus(data.message);
                this.isInChat = false;
                this.clearChat();
                this.disableChat();
                break;

            case 'chat_started':
                this.chatId = data.chatId;
                this.partnerId = data.partnerId;
                this.isInChat = true;
                this.updateStatus('Connected! Start chatting...');
                this.enableChat();
                this.addSystemMessage('You are now connected. Say hi!');
                break;

            case 'message':
                this.partnerName = data.isOwn ? data.partnerName : data.senderName;
                this.displayMessage(data.message, data.isOwn, data.timestamp, data.senderName, data.partnerName);
                break;

            case 'chat_ended':
                this.isInChat = false;
                this.chatId = null;
                this.partnerId = null;
                this.partnerName = null;
                this.updateStatus('Chat ended. Click "New Chat" to find another user.');
                this.disableChat();
                this.addSystemMessage(data.message);
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isInChat) {
            this.ws.send(JSON.stringify({
                type: 'send_message',
                message: message
            }));
        }
    }

    findNewChat() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: this.isInChat ? 'new_chat' : 'find_partner'
            }));
            
            this.updateStatus('Looking for a stranger...');
            this.newChatBtn.disabled = true;
            this.endChatBtn.disabled = false;
        }
    }

    endChat() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'end_chat'
            }));
        }
        
        this.isInChat = false;
        this.chatId = null;
        this.partnerId = null;
        this.updateStatus('Chat ended. Click "New Chat" to find another stranger.');
        this.disableChat();
        this.addSystemMessage('You have ended the chat.');
    }

    displayMessage(message, isOwn, timestamp, senderName, partnerName) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
        const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userLabel = isOwn ? `You (${senderName || this.username})` : `User (${senderName || partnerName || 'User'})`;
        messageDiv.innerHTML = `
            <div class="message-label">${userLabel}</div>
            <div class="message-bubble">${this.escapeHtml(message)}</div>
            <div class="message-time">${time}</div>
        `;
        this.chatWindow.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.textContent = message;
        this.chatWindow.appendChild(messageDiv);
        this.scrollToBottom();
    }

    clearChat() {
        this.chatWindow.innerHTML = '';
    }

    updateStatus(status) {
        this.statusDiv.textContent = status;
    }

    enableChat() {
        this.messageInput.disabled = false;
        this.sendBtn.disabled = false;
        this.messageInput.placeholder = 'Type your message...';
        this.newChatBtn.disabled = false;
        this.endChatBtn.disabled = false;
        this.messageInput.focus();
    }

    disableChat() {
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        this.messageInput.placeholder = 'Click "New Chat" to start chatting...';
        this.newChatBtn.disabled = false;
        this.endChatBtn.disabled = true;
    }

    disableControls() {
        this.messageInput.disabled = true;
        this.newChatBtn.disabled = true;
        this.endChatBtn.disabled = true;
    }

    scrollToBottom() {
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AnoConnect();
});
