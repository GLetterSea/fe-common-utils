const { parseJSON } = require('json/index');
class WebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.messageHandlers = new Set();
  }

  connect() {
    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = (event) => {
        console.log('WebSocket connected');
        if (this.options.onOpen) {
          this.options.onOpen(event);
        }
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      };

      this.socket.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          data = event.data;
        }
        this.messageHandlers.forEach(handler => handler(data));
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.options.onError) {
          this.options.onError(error);
        }
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket connection closed');
        if (this.options.onClose) {
          this.options.onClose(event);
        }
        this._handleReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this._handleReconnect();
    }
  }

  _handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(), this.reconnectInterval);
    } else if (this.options.onMaxReconnect) {
      this.options.onMaxReconnect();
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.socket.send(message);
      return true;
    }
    console.warn('WebSocket is not connected');
    return false;
  }

  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
