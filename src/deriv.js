export class DerivConnection {
    constructor(appId) {
        this.appId = appId;
        this.ws = null;
        this.token = null;
        this.callbacks = {
            onOpen: () => { },
            onTick: () => { },
            onAuthorize: () => { },
            onError: () => { },
            onContract: () => { }
        };
        this.pingInterval = null;
    }

    connect() {
        this.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);

        this.ws.onopen = () => {
            console.log('Connected to Deriv WS');
            this.callbacks.onOpen();
            this.startPing();
        };

        this.ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            this.handleMessage(data);
        };

        this.ws.onclose = () => {
            console.log('Disconnected');
            this.stopPing();
        };

        this.ws.onerror = (error) => {
            console.error('WS Error', error);
            this.callbacks.onError(error);
        };
    }

    handleMessage(data) {
        if (data.msg_type === 'tick') {
            this.callbacks.onTick(data.tick);
        } else if (data.msg_type === 'authorize') {
            this.callbacks.onAuthorize(data.authorize);
        } else if (data.error) {
            this.callbacks.onError(data.error);
        } else if (data.msg_type === 'buy') {
            this.callbacks.onContract(data.buy);
        }
    }

    authorize(token) {
        this.token = token;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ authorize: token }));
        }
    }

    subscribeTicks(symbol) {
        // Unsubscribe from all ticks first (simplification)
        this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
        this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ ping: 1 }));
            }
        }, 10000);
    }

    stopPing() {
        clearInterval(this.pingInterval);
    }

    buyContract(contractType, amount, duration, symbol) {
        const req = {
            buy: 1,
            price: amount,
            parameters: {
                amount: amount,
                basis: 'stake',
                contract_type: contractType, // CALLE / PUT
                currency: 'USD',
                duration: duration,
                duration_unit: 't', // ticks
                symbol: symbol
            }
        };
        this.ws.send(JSON.stringify(req));
    }

    on(event, callback) {
        const mapping = {
            'open': 'onOpen',
            'tick': 'onTick',
            'authorize': 'onAuthorize',
            'error': 'onError',
            'contract': 'onContract'
        };
        if (mapping[event]) {
            this.callbacks[mapping[event]] = callback;
        }
    }
}
