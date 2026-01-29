// TraderKing Indicators Library - Ported from VB.NET
// V1.4.0 - Performance & Precision Optimization (V3.1.99)

export const Indicators = {
    // --- LOOKBACK LIMITER ---
    limit(arr, period = 300) {
        return arr.length > period ? arr.slice(-period) : arr;
    },

    // --- BASIC & CORE ---
    calculateSMA(prices, period) {
        const slice = this.limit(prices, period + 50).slice(-period);
        if (slice.length < period) return 0;
        return slice.reduce((a, b) => a + b, 0) / period;
    },

    calculateEMA(prices, period) {
        const slice = this.limit(prices, period + 100);
        if (slice.length < period) return 0;
        const k = 2 / (period + 1);
        let ema = slice.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < slice.length; i++) {
            ema = (slice[i] * k) + (ema * (1 - k));
        }
        return ema;
    },

    // --- SECONDARY INDICATORS ---
    calculateRSI(prices, period) {
        const slice = this.limit(prices, period + 150);
        if (slice.length <= period) return 50;

        let gains = 0; let losses = 0;
        for (let i = 1; i <= period; i++) {
            const diff = slice[i] - slice[i - 1];
            if (diff > 0) gains += diff; else losses += Math.abs(diff);
        }
        let avgGains = gains / period;
        let avgLosses = losses / period;

        for (let i = period + 1; i < slice.length; i++) {
            const diff = slice[i] - slice[i - 1];
            if (diff > 0) {
                avgGains = (avgGains * (period - 1) + diff) / period;
                avgLosses = (avgLosses * (period - 1)) / period;
            } else {
                avgGains = (avgGains * (period - 1)) / period;
                avgLosses = (avgLosses * (period - 1) + Math.abs(diff)) / period;
            }
        }
        if (avgLosses === 0) return 100;
        const rs = avgGains / avgLosses;
        return 100 - (100 / (1 + rs));
    },

    calculateATR(highs, lows, closes, period) {
        const h = this.limit(highs, period + 50);
        const l = this.limit(lows, period + 50);
        const c = this.limit(closes, period + 51);
        if (h.length < period) return 0;

        let sumTR = 0;
        for (let i = h.length - period; i < h.length; i++) {
            const tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
            sumTR += tr;
        }
        return sumTR / period;
    },

    calculateADX(highs, lows, closes, period) {
        const h = this.limit(highs, period * 3);
        const l = this.limit(lows, period * 3);
        const c = this.limit(closes, period * 3);
        if (h.length < period * 2) return 20;

        let tr = [], dmPlus = [], dmMinus = [];
        for (let i = 1; i < h.length; i++) {
            const trVal = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
            tr.push(trVal);
            const upMove = h[i] - h[i - 1], downMove = l[i - 1] - l[i];
            dmPlus.push((upMove > downMove && upMove > 0) ? upMove : 0);
            dmMinus.push((downMove > upMove && downMove > 0) ? downMove : 0);
        }

        let trS = tr.slice(0, period).reduce((a, b) => a + b, 0);
        let dmPS = dmPlus.slice(0, period).reduce((a, b) => a + b, 0);
        let dmMS = dmMinus.slice(0, period).reduce((a, b) => a + b, 0);

        let dxValues = [];
        for (let i = period; i < tr.length; i++) {
            trS = trS - (trS / period) + tr[i];
            dmPS = dmPS - (dmPS / period) + dmPlus[i];
            dmMS = dmMS - (dmMS / period) + dmMinus[i];
            const dp = (dmPS / trS) * 100, dm = (dmMS / trS) * 100;
            dxValues.push(Math.abs(dp - dm) / (dp + dm) * 100);
        }
        return dxValues.slice(-period).reduce((a, b) => a + b, 0) / period;
    },

    calculateBollinger(prices, period, deviation) {
        const slice = this.limit(prices, period);
        if (slice.length < period) return null;
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return { middle: sma, upper: sma + (deviation * stdDev), lower: sma - (deviation * stdDev) };
    },

    calculateZScore(prices, period) {
        const slice = this.limit(prices, period);
        if (slice.length < period) return 0;
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return stdDev === 0 ? 0 : (slice[slice.length - 1] - mean) / stdDev;
    },

    calculateRSILaguerre(prices, gamma = 0.2) {
        const slice = this.limit(prices, 200);
        if (slice.length < 5) return 50;
        let l0 = 0, l1 = 0, l2 = 0, l3 = 0, l0P = 0, l1P = 0, l2P = 0, l3P = 0;
        for (const p of slice) {
            l0 = (1 - gamma) * p + gamma * l0P;
            l1 = -gamma * l0 + l0P + gamma * l1P;
            l2 = -gamma * l1 + l1P + gamma * l2P;
            l3 = -gamma * l2 + l2P + gamma * l3P;
            l0P = l0; l1P = l1; l2P = l2; l3P = l3;
        }
        const cu = (l0 >= l1 ? l0 - l1 : 0) + (l1 >= l2 ? l1 - l2 : 0) + (l2 >= l3 ? l2 - l3 : 0);
        const cd = (l1 > l0 ? l1 - l0 : 0) + (l2 > l1 ? l2 - l1 : 0) + (l3 > l2 ? l3 - l2 : 0);
        return (cu + cd === 0) ? 0 : (cu / (cu + cd)) * 100;
    },

    detectSMC(prices) {
        // V3.1.99: Balanced SMC using 5-period average to filter tick noise
        const slice = prices.slice(-6);
        if (slice.length < 6) return "Neutral";
        const avgNow = (slice[5] + slice[4] + slice[3]) / 3;
        const avgPrev = (slice[2] + slice[1] + slice[0]) / 3;
        return avgNow > avgPrev ? "Alcista" : (avgNow < avgPrev ? "Bajista" : "Neutral");
    },

    calculateSafariTrend(prices) {
        const slice = prices.slice(-10);
        if (slice.length < 10) return "Neutro";
        let up = 0, down = 0;
        for (let i = 1; i < slice.length; i++) {
            if (slice[i] > slice[i - 1]) up++; else if (slice[i] < slice[i - 1]) down++;
        }
        return up >= 7 ? "Alcista" : (down >= 7 ? "Bajista" : "Neutro");
    },

    detectSniperWick(candle) {
        const body = Math.abs(candle.close - candle.open);
        const total = candle.high - candle.low;
        if (total === 0) return "NONE";
        const upper = candle.high - Math.max(candle.open, candle.close);
        const lower = Math.min(candle.open, candle.close) - candle.low;
        if (upper / total > 0.65) return "UPPER_REJECTION";
        if (lower / total > 0.65) return "LOWER_REJECTION";
        return "NONE";
    },

    detectOlympRejection(candles, ema36, ema51, sma20, rsi) {
        if (candles.length < 15) return "NONE";
        const last = candles[candles.length - 2];
        const prev = candles[candles.length - 3];
        const isLateral = Math.abs(ema36 - ema51) / sma20 < 0.0008; // Tightened V3.1.99

        // Pattern 1x1: High accuracy required
        if (isLateral) {
            if (prev.close > prev.open && last.close < last.open && last.close > sma20 && rsi > 55) return "WYSE_UNO_PUT";
            if (prev.close < prev.open && last.close > last.open && last.close < sma20 && rsi < 45) return "WYSE_UNO_CALL";
        }
        return "NONE";
    },

    calculateFibonacci(highs, lows, period = 100) {
        const h = highs.slice(-period), l = lows.slice(-period);
        if (h.length < period) return null;
        const max = Math.max(...h), min = Math.min(...l), diff = max - min;
        return { max, min, l618: max - (diff * 0.618), l500: max - (diff * 0.5), l382: max - (diff * 0.382) };
    }
};
