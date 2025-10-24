import { parseJSON, stringfyJSON } from '../json/index';

export type WebSocketMsgType = string | Blob | ArrayBufferLike | ArrayBufferView;

export interface Subscriber {
  type: string;
  callback: (msg: Record<string, any>) => any;
}

export class SocketClient {
  private url: string;
  private ws: WebSocket | undefined;
  private heartEnabled: boolean;
  private heartbeatInterval: number = 5000;
  private heartbeatTimeout: number = 10000;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private serverTimer: NodeJS.Timeout | null = null;
  private lockReconnect: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private maxReconnectDelay: number = 30000;
  private subscriber: Set<Subscriber> = new Set();
  private watingMessages: Set<WebSocketMsgType> = new Set();

  constructor(url: string, heartEnabled = true) {
    this.url = url;
    this.heartEnabled = heartEnabled;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onerror = this.onError.bind(this);
      this.ws.onclose = this.onClose.bind(this);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }

  private onOpen() {
    console.log(`[Log-${(new Date()).toLocaleString()}] WebSocket connected`);
    this.heartEnabled && this.sendHeartbeat();
    this.reconnectAttempts = 0; // reset reconnect attempts on successful connection

    this.watingMessages.forEach(msg => this._send(msg));
    this.watingMessages.clear();
  }

  private onMessage(evt: MessageEvent) {
    const msg = parseJSON(evt.data);
    const event = msg.event;
    switch(event) {
      case 'ping':
        this.sendMessage({ event: 'pong', timestamp: Date.now() });
        break;
      case 'pong':
        this.sendHeartbeat();
        break;
      default:
        this.subscriber.forEach(sub => sub.callback(msg));
    }
  }

  private onError(evt: Event) {
    console.log(`[Log-${(new Date()).toLocaleString()}] WebSocket error:`, evt);
    this.reconnect();
  }

  private onClose(evt: CloseEvent) {
    console.log(`[Log-${(new Date()).toLocaleString()}] WebSocket closed:`, evt);
  }

  private reconnect() {
    if(this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[Log-${(new Date()).toLocaleString()}] WebSocket max reconnect attempts reached`);
      return;
    }
    if(this.lockReconnect) return;
    this.lockReconnect = true;
    // 随机抖动, 避免所有客户端同时重连
    const jitter = Math.random() * 100;
    // 指数退避, 增加重连延迟, 设置最大重连延迟为30秒
    const delay = Math.min(Math.pow(2, ++this.reconnectAttempts) * 1000, this.maxReconnectDelay) + jitter;
    console.log(`[Log-${(new Date()).toLocaleString()}] WebSocket reconnecting ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    setTimeout(() => {
      this.lockReconnect = false;  // reset reconnect lock
      this.connect()
    }, delay);
  }

  private sendHeartbeat() {
    // 重置心跳计时器
    this.stopHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      this.sendMessage({ event: 'ping', timestamp: Date.now() });
      // 设置心跳超时计时器
      this.serverTimer = setTimeout(() => {
        console.warn(`[Log-${(new Date()).toLocaleString()}] WebSocket heartbeat timeout`);
        this.close(true)
      }, this.heartbeatTimeout);
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    this.heartbeatTimer && clearTimeout(this.heartbeatTimer);
    this.serverTimer && clearTimeout(this.serverTimer);
  }

  _send(data: WebSocketMsgType) {
    if(this.readyState !== WebSocket.OPEN) {
      this.watingMessages.add(data);
      return;
    }
    this.ws?.send(data);
  }

  sendMessage(data: Record<string, unknown>) {
    this._send(stringfyJSON(data));
  }

  get readyState() {
    return this.ws?.readyState;
  }

  close(rFlag = false) {
    this.ws?.close();
    if(rFlag) this.reconnect();
    else {
      this.stopHeartbeat();
      this.watingMessages.clear();
      this.subscriber.clear();
      this.ws = undefined;
    }
  }

  subscribe(sub: Subscriber) {
    this.subscriber.add(sub);
    return () => this.subscriber.delete(sub);
  }

  unsubscribe(sub: Subscriber) {
    return this.subscriber.delete(sub);
  }
}
