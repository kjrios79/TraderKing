// TraderKing Indicators Library - Ported from VB.NET
// V1.4.0 - Performance & Precision Optimization (V3.1.99)

export const Indicators = {
    // --- LOOKBACK LIMITER ---
    limit(arr, period = 300) {
        if (!arr || !Array.isArray(arr)) return [];
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

    calculateDEMA(prices, period) {
        if (prices.length < period + 1) return 0;
        const ema1 = this.calculateEMA(prices, period);
        const ema2 = this.calculateEMA(prices.slice(0, -1), period);
        return 2 * ema1 - ema2;
    },

    calculateTEMA(prices, period) {
        if (prices.length < period + 2) return 0;
        const ema1 = this.calculateEMA(prices, period);
        const ema2 = this.calculateEMA(prices.slice(0, -1), period);
        const ema3 = this.calculateEMA(prices.slice(0, -2), period);
        return 3 * (ema1 - ema2) + ema3;
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

    calculatePSAR(prices, step = 0.02, maxStep = 0.2) {
        if (prices.length < 5) return 0;
        let sar = prices[0], ep = prices[0], af = step, trend = 1;
        for (let i = 1; i < prices.length; i++) {
            const price = prices[i];
            sar = sar + af * (ep - sar);
            if (trend === 1) {
                if (price < sar) { trend = -1; sar = ep; ep = price; af = step; }
                else if (price > ep) { ep = price; af = Math.min(af + step, maxStep); }
            } else {
                if (price > sar) { trend = 1; sar = ep; ep = price; af = step; }
                else if (price < ep) { ep = price; af = Math.min(af + step, maxStep); }
            }
        }
        return sar;
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
        if (prices.length < 2) return "Neutral";
        const last = prices[prices.length - 1];
        const prev = prices[prices.length - 2];
        return last > prev ? "Alcista" : (last < prev ? "Bajista" : "Neutral");
    },

    calculateSuperTrend(highs, lows, closes, period, factor) {
        const atr = this.calculateATR(highs, lows, closes, period);
        const slice = closes.slice(-period);
        if (slice.length < period) return 0;
        const medium = (Math.max(...highs.slice(-period)) + Math.min(...lows.slice(-period))) / 2;
        return medium - (factor * atr);
    },

    detectCrossover(shortValues, longValues) {
        if (shortValues.length < 2 || longValues.length < 2) return null;
        const s0 = shortValues[shortValues.length - 1];
        const s1 = shortValues[shortValues.length - 2];
        const l0 = longValues[longValues.length - 1];
        const l1 = longValues[longValues.length - 2];
        if (s1 <= l1 && s0 > l0) return "UP";
        if (s1 >= l1 && s0 < l0) return "DOWN";
        return null;
    },

    calculateFisher(prices, period) {
        if (prices.length < period) return 0;
        const slice = prices.slice(-period);
        const min = Math.min(...slice), max = Math.max(...slice);
        if (max === min) return 0;
        let val = 2 * ((prices[prices.length - 1] - min) / (max - min) - 0.5);
        if (val > 0.99) val = 0.999;
        if (val < -0.99) val = -0.999;
        return 0.5 * Math.log((1 + val) / (1 - val));
    },

    detectCandleForce(open, close, high, low) {
        const body = Math.abs(close - open);
        const upperWick = high - Math.max(open, close);
        const lowerWick = Math.min(open, close) - low;
        const threshold = body * 0.5;
        if (body > upperWick && body > lowerWick) return close > open ? "Fuerza Alcista" : "Fuerza Bajista";
        else if (upperWick > threshold) return "Fuerza Bajista";
        else if (lowerWick > threshold) return "Fuerza Alcista";
        return "Sin Fuerza Clara";
    },

    calculateIchimoku(highs, lows, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52) {
        if (highs.length < senkouBPeriod) return null;
        const getMid = (h, l, p) => {
            const hSlice = h.slice(-p);
            const lSlice = l.slice(-p);
            return (Math.max(...hSlice) + Math.min(...lSlice)) / 2;
        };
        return { tenkan: getMid(highs, lows, tenkanPeriod), kijun: getMid(highs, lows, kijunPeriod), senkouB: getMid(highs, lows, senkouBPeriod) };
    },

    calculateAlligator(prices, jawP = 13, teethP = 8, lipsP = 5) {
        if (prices.length < jawP) return null;
        return { jaw: this.calculateSMA(prices, jawP), teeth: this.calculateSMA(prices, teethP), lips: this.calculateSMA(prices, lipsP) };
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
        if (!candle) return "NONE";
        const body = Math.abs(candle.close - candle.open);
        const total = candle.high - candle.low;
        if (total === 0) return "NONE";
        const upper = candle.high - Math.max(candle.open, candle.close);
        const lower = Math.min(candle.open, candle.close) - candle.low;
        if (upper / total > 0.65) return "UPPER_REJECTION";
        if (lower / total > 0.65) return "LOWER_REJECTION";
        return "NONE";
    },

    calculateMarketForce(highs, lows, period = 14) {
        if (highs.length < period) return 1.0;
        let sumRange = 0;
        for (let i = highs.length - period; i < highs.length; i++) {
            sumRange += (highs[i] - lows[i]);
        }
        const avgRange = sumRange / period;
        return avgRange > 0 ? ((highs[highs.length - 1] - lows[lows.length - 1]) / avgRange) : 1.0;
    },

    calculateMACDSignal(macdValues, period) {
        if (macdValues.length < period) return 0;
        const k = 2 / (period + 1);
        let signal = macdValues[macdValues.length - period];
        for (let i = macdValues.length - period + 1; i < macdValues.length; i++) {
            signal = (macdValues[i] * k) + (signal * (1 - k));
        }
        return signal;
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
    },

    scanPatternHistory(candles, lookback = 100) {
        if (candles.length < lookback) lookback = candles.length;
        let count = 0;
        for (let i = candles.length - lookback; i < candles.length - 3; i++) {
            const h1 = candles[i], h2 = candles[i + 1], h3 = candles[i + 2];
            const successUnoCall = (h1.close > h1.open && h2.close < h2.open && h2.low >= h1.open && h3.close > h3.open);
            const successUnoPut = (h1.close < h1.open && h2.close > h2.open && h2.high <= h1.open && h3.close < h3.open);
            if (successUnoCall || successUnoPut) count++;
        }
        return count;
    }
};
