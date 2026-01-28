export class DerivConnection {
    constructor(appId) {
        this.appId = appId;
        this.socket = null;
        this.callbacks = {
            onOpen: null,
            onTick: null,
            onAuthorize: null,
            onError: null,
            onContract: null
        };
    }

    connect() {
        const endpoint = `wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`;
        this.socket = new WebSocket(endpoint);

        this.socket.onopen = (e) => {
            if (this.callbacks.onOpen) this.callbacks.onOpen(e);
        };

        this.socket.onmessage = (e) => {
            const data = JSON.parse(e.data);

            if (data.error) {
                if (this.callbacks.onError) this.callbacks.onError(data.error);
                return;
            }

            if (data.msg_type === 'authorize') {
                if (this.callbacks.onAuthorize) this.callbacks.onAuthorize(data.authorize);
            } else if (data.msg_type === 'candles') {
                if (this.callbacks.onHistory) this.callbacks.onHistory(data.candles);
            } else if (data.msg_type === 'tick') {
                if (this.callbacks.onTick) this.callbacks.onTick(data.tick);
            } else if (data.msg_type === 'proposal_open_contract') {
                if (this.callbacks.onContract) this.callbacks.onContract(data.proposal_open_contract);
            } else if (data.msg_type === 'buy') {
                if (this.callbacks.onContract) this.callbacks.onContract(data.buy);
            } else if (data.msg_type === 'balance') {
                if (this.callbacks.onBalance) this.callbacks.onBalance(data.balance);
            }
        };

        this.socket.onerror = (e) => {
            if (this.callbacks.onError) this.callbacks.onError(e);
        };

        this.socket.onclose = (e) => {
            console.log('WebSocket closed', e);
        };
    }

    authorize(token) {
        this.send({ authorize: token });
    }

    subscribeBalance() {
        this.send({ balance: 1, subscribe: 1 });
    }

    subscribeContracts() {
        this.send({ proposal_open_contract: 1, subscribe: 1 });
    }

    subscribeSpecificContract(contractId) {
        this.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
    }

    subscribeTicks(symbol) {
        this.send({ ticks: symbol, subscribe: 1 });
    }

    forgetAll(type) {
        this.send({ forget_all: type });
    }

    getHistory(symbol, count = 300) {
        this.send({
            ticks_history: symbol,
            adjust_start_time: 1,
            count: count,
            end: 'latest',
            start: 1,
            style: 'candles'
        });
    }

    buy(params) {
        this.send({
            buy: 1,
            price: params.amount,
            parameters: {
                amount: params.amount,
                basis: 'stake',
                contract_type: params.contract_type,
                currency: 'USD',
                duration: params.duration,
                duration_unit: params.duration_unit || 't',
                symbol: params.symbol
            }
        });
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    on(event, callback) {
        const mapping = {
            'open': 'onOpen',
            'tick': 'onTick',
            'authorize': 'onAuthorize',
            'history': 'onHistory',
            'balance': 'onBalance',
            'error': 'onError',
            'contract': 'onContract'
        };
        if (mapping[event]) {
            this.callbacks[mapping[event]] = callback;
        }
    }
}
