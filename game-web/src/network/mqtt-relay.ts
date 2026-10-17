const BROKER_URLS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

function encodeConnect(clientId: string): Uint8Array {
  const enc = new TextEncoder();
  const idBytes = enc.encode(clientId);
  const protoBytes = enc.encode('MQTT');
  const varHeader = [0, 4, ...protoBytes, 4, 2, 0, 60];
  const payload = [0, idBytes.length, ...idBytes];
  const remLen = varHeader.length + payload.length;
  return new Uint8Array([0x10, remLen, ...varHeader, ...payload]);
}

function encodeSubscribe(packetId: number, topic: string): Uint8Array {
  const enc = new TextEncoder();
  const topicBytes = enc.encode(topic);
  const varHeader = [(packetId >> 8) & 0xff, packetId & 0xff];
  const payload = [0, topicBytes.length, ...topicBytes, 0];
  const remLen = varHeader.length + payload.length;
  return new Uint8Array([0x82, remLen, ...varHeader, ...payload]);
}

function encodePublish(topic: string, message: string): Uint8Array {
  const enc = new TextEncoder();
  const topicBytes = enc.encode(topic);
  const msgBytes = enc.encode(message);
  const remLen = 2 + topicBytes.length + msgBytes.length;
  const lenBytes: number[] = [];
  let x = remLen;
  do {
    let b = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) b |= 128;
    lenBytes.push(b);
  } while (x > 0);
  return new Uint8Array([
    0x30,
    ...lenBytes,
    (topicBytes.length >> 8) & 0xff,
    topicBytes.length & 0xff,
    ...topicBytes,
    ...msgBytes,
  ]);
}

function decodePublish(bytes: Uint8Array): { topic: string; payload: string } {
  let idx = 1;
  let multiplier = 1;
  let b = 0;
  do {
    b = bytes[idx++] ?? 0;
    multiplier *= 128;
  } while ((b & 128) !== 0);
  const tLen = ((bytes[idx] ?? 0) << 8) | (bytes[idx + 1] ?? 0);
  idx += 2;
  const topic = new TextDecoder().decode(bytes.subarray(idx, idx + tLen));
  idx += tLen;
  const payload = new TextDecoder().decode(bytes.subarray(idx));
  return { topic, payload };
}

export class MqttRelay {
  #ws: WebSocket | null = null;
  #pingTimer?: number;
  #packetId = 0;
  #subscriptions = new Set<string>();
  #connected = false;
  #closed = false;
  #brokerIndex = 0;

  onMessage?: (topic: string, payload: string) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;

  get connected(): boolean {
    return this.#connected && this.#ws?.readyState === WebSocket.OPEN;
  }

  connect(clientId = `pf-${Math.random().toString(36).slice(2, 10)}`): void {
    this.close();
    this.#closed = false;
    const url = BROKER_URLS[this.#brokerIndex % BROKER_URLS.length] ?? BROKER_URLS[0]!;

    try {
      const ws = new WebSocket(url, ['mqtt']);
      ws.binaryType = 'arraybuffer';
      this.#ws = ws;

      const connTimeout = window.setTimeout(() => {
        if (!this.#connected && this.#ws === ws) {
          ws.close();
          this.#tryNextBroker(clientId);
        }
      }, 5000);

      ws.onopen = () => {
        ws.send(encodeConnect(clientId));
      };

      ws.onmessage = (event) => {
        const bytes = new Uint8Array(event.data as ArrayBuffer);
        const type = (bytes[0] ?? 0) >> 4;

        if (type === 2) {
          // CONNACK
          window.clearTimeout(connTimeout);
          this.#connected = true;
          this.#startPing();
          // Resubscribe any registered topics
          for (const topic of this.#subscriptions) {
            ws.send(encodeSubscribe(++this.#packetId, topic));
          }
          this.onConnect?.();
        } else if (type === 3) {
          // PUBLISH
          try {
            const { topic, payload } = decodePublish(bytes);
            this.onMessage?.(topic, payload);
          } catch {
            // Ignore malformed packet
          }
        }
      };

      ws.onerror = () => {
        if (!this.#connected) {
          window.clearTimeout(connTimeout);
          this.#tryNextBroker(clientId);
        }
      };

      ws.onclose = () => {
        window.clearTimeout(connTimeout);
        this.#stopPing();
        const wasConnected = this.#connected;
        this.#connected = false;
        if (wasConnected && !this.#closed) {
          this.onDisconnect?.();
        }
      };
    } catch (err) {
      this.#tryNextBroker(clientId);
    }
  }

  #tryNextBroker(clientId: string): void {
    if (this.#closed) return;
    this.#brokerIndex++;
    if (this.#brokerIndex < BROKER_URLS.length * 2) {
      window.setTimeout(() => this.connect(clientId), 500);
    } else {
      this.onError?.(new Error('Could not connect to online multiplayer servers.'));
    }
  }

  subscribe(topic: string): void {
    this.#subscriptions.add(topic);
    if (this.connected) {
      this.#ws?.send(encodeSubscribe(++this.#packetId, topic));
    }
  }

  publish(topic: string, message: string): void {
    if (this.connected) {
      try {
        this.#ws?.send(encodePublish(topic, message));
      } catch {
        // Ignore send error
      }
    }
  }

  #startPing(): void {
    this.#stopPing();
    this.#pingTimer = window.setInterval(() => {
      if (this.connected) {
        this.#ws?.send(new Uint8Array([0xc0, 0x00])); // PINGREQ
      }
    }, 25_000);
  }

  #stopPing(): void {
    if (this.#pingTimer) {
      clearInterval(this.#pingTimer);
      this.#pingTimer = undefined;
    }
  }

  close(): void {
    this.#closed = true;
    this.#connected = false;
    this.#stopPing();
    if (this.#ws) {
      this.#ws.onopen = null;
      this.#ws.onmessage = null;
      this.#ws.onerror = null;
      this.#ws.onclose = null;
      try {
        this.#ws.close();
      } catch {
        // Ignore
      }
      this.#ws = null;
    }
    this.#subscriptions.clear();
  }
}
