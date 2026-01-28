// TraderKing Indicators Library - Ported from VB.NET
// V1.3.0 - Final Master Migration

export const Indicators = {
    // --- BASIC & CORE ---
    calculateSMA(prices, period) {
        if (prices.length < period) return 0;
        let sum = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            sum += prices[i];
        }
        return sum / period;
    },

    calculateEMA(prices, period) {
        if (prices.length < period) return 0;
        const k = 2 / (period + 1);
        // Improved initialization: first period as SMA
        let sum = 0;
        for (let i = 0; i < period; i++) sum += prices[i];
        let ema = sum / period;
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] * k) + (ema * (1 - k));
        }
        return ema;
    },

    // --- SECONDARY INDICATORS ---
    calculateRSI(prices, period) {
        if (prices.length <= period) return 50;
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= period; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }
        let avgGains = gains / period;
        let avgLosses = losses / period;
        for (let i = period + 1; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
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

    calculateATR(prices, period) {
        if (prices.length < period + 1) return 0;
        let sum = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            sum += Math.abs(prices[i] - prices[i - 1]);
        }
        return sum / period;
    },

    calculateADX(highs, lows, closes, period) {
        if (highs.length < period * 2) return 0;
        let tr = [], dmPlus = [], dmMinus = [];

        for (let i = 1; i < highs.length; i++) {
            const h = highs[i], l = lows[i], cPrev = closes[i - 1];
            const trVal = Math.max(h - l, Math.abs(h - cPrev), Math.abs(l - cPrev));
            tr.push(trVal);
            const upMove = highs[i] - highs[i - 1];
            const downMove = lows[i - 1] - lows[i];
            dmPlus.push((upMove > downMove && upMove > 0) ? upMove : 0);
            dmMinus.push((downMove > upMove && downMove > 0) ? downMove : 0);
        }

        let trSmooth = 0, dmPlusSmooth = 0, dmMinusSmooth = 0;
        for (let i = 0; i < period; i++) {
            trSmooth += tr[i];
            dmPlusSmooth += dmPlus[i];
            dmMinusSmooth += dmMinus[i];
        }

        let dxValues = [];
        const calcDX = (p, m, t) => {
            if (t === 0) return 0;
            const diPlus = (p / t) * 100;
            const diMinus = (m / t) * 100;
            const sum = diPlus + diMinus;
            return sum === 0 ? 0 : (Math.abs(diPlus - diMinus) / sum) * 100;
        };

        dxValues.push(calcDX(dmPlusSmooth, dmMinusSmooth, trSmooth));
        for (let i = period; i < tr.length; i++) {
            trSmooth = trSmooth - (trSmooth / period) + tr[i];
            dmPlusSmooth = dmPlusSmooth - (dmPlusSmooth / period) + dmPlus[i];
            dmMinusSmooth = dmMinusSmooth - (dmMinusSmooth / period) + dmMinus[i];
            dxValues.push(calcDX(dmPlusSmooth, dmMinusSmooth, trSmooth));
        }

        if (dxValues.length < period) return 0;
        let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < dxValues.length; i++) {
            adx = ((adx * (period - 1)) + dxValues[i]) / period;
        }
        return adx;
    },

    calculatePSAR(prices, step = 0.02, maxStep = 0.2) {
        if (prices.length < 2) return prices[0];
        let sar = prices[0];
        let ep = prices[0];
        let af = step;
        let trend = 1;
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
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return { middle: sma, upper: sma + (deviation * stdDev), lower: sma - (deviation * stdDev) };
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

    calculateZScore(prices, period) {
        if (prices.length < period) return 0;
        const slice = prices.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return stdDev === 0 ? 0 : (prices[prices.length - 1] - mean) / stdDev;
    },

    calculateRSILaguerre(prices, gamma = 0.2) {
        if (prices.length < 4) return 0;
        const last = prices[prices.length - 1];
        const prev1 = prices[prices.length - 2];
        const prev2 = prices[prices.length - 3];
        const l0 = (1 - gamma) * last + gamma * prev1;
        const l1 = -gamma * l0 + prev1 + gamma * prev2;
        const rsiLaguerre = l1 !== 0 ? l0 / l1 : 0;
        return Math.min(100, Math.max(0, rsiLaguerre * 100));
    },

    calculateSuperTrend(prices, period, factor) {
        const atr = this.calculateATR(prices, period);
        const medium = (Math.max(...prices.slice(-period)) + Math.min(...prices.slice(-period))) / 2;
        return medium - (factor * atr);
    },

    calculateChandelierExit(prices, period, factor) {
        if (prices.length < period) return 0;
        const atr = this.calculateATR(prices, period);
        const max = Math.max(...prices.slice(-period));
        return max - (factor * atr);
    },

    detectSMC(prices) {
        if (prices.length < 2) return "Neutral";
        const last = prices[prices.length - 1];
        const prev = prices[prices.length - 2];
        if (last > prev) return "Alcista";
        if (last < prev) return "Bajista";
        return "Neutral";
    },

    calculateSafariTrend(prices) {
        if (prices.length < 6) return "Neutro";
        let upCount = 0, downCount = 0;
        for (let i = prices.length - 5; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) upCount++;
            else if (prices[i] < prices[i - 1]) downCount++;
        }
        if (upCount >= 4) return "Alcista";
        if (downCount >= 4) return "Bajista";
        return "Neutro";
    },

    detectSwings(prices) {
        const peaks = [];
        const valleys = [];
        for (let i = 1; i < prices.length - 1; i++) {
            if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) peaks.push(i);
            else if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) valleys.push(i);
        }
        return { peaks, valleys };
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

    detectSniperWick(candle) {
        const open = candle.open, close = candle.close, high = candle.high, low = candle.low;
        const body = Math.max(0.000001, Math.abs(close - open));
        const upperWick = high - Math.max(open, close);
        const lowerWick = Math.min(open, close) - low;
        const totalRange = high - low;
        const upperRatio = upperWick / body;
        const lowerRatio = lowerWick / body;
        const upperPct = totalRange > 0 ? (upperWick / totalRange) : 0;
        const lowerPct = totalRange > 0 ? (lowerWick / totalRange) : 0;
        if (upperRatio > 2.5 || upperPct > 0.6) return "UPPER_REJECTION";
        if (lowerRatio > 2.5 || lowerPct > 0.6) return "LOWER_REJECTION";
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

    calculateDonchian(prices, period) {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        const max = Math.max(...slice), min = Math.min(...slice);
        return { upper: max, lower: min, middle: (max + min) / 2 };
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

    detectOlympRejection(candles, ema36, ema51, sma20, rsi) {
        if (candles.length < 15) return "NONE";

        const vSignal = candles[candles.length - 2];
        const vPrev1 = candles[candles.length - 3];
        const vPrev2 = candles[candles.length - 4];

        const emaGap = Math.abs(ema36 - ema51) / (sma20 || vSignal.close);
        const emaBullish = ema36 > ema51;
        const emaBearish = ema36 < ema51;

        // --- PATRÓN 1 POR 1 (RELAXED) ---
        // Exigencia: Colores alternados + cerca de la SMA 20 + mercado relativamente lateral
        const isUnoCall = (vPrev2.close < vPrev2.open && vPrev1.close > vPrev1.open && vSignal.close < vSignal.open);
        const isUnoPut = (vPrev2.close > vPrev2.open && vPrev1.close < vPrev1.open && vSignal.close > vSignal.open);

        if (isUnoCall || isUnoPut) {
            const nearSMA = Math.abs(vSignal.close - sma20) / sma20 < 0.007; // Zona del 0.7% (más alcance)
            const isLateral = emaGap < 0.0015; // Menos de 0.15% de apertura (más permisivo)

            if (nearSMA && isLateral) {
                if (isUnoCall && rsi < 70) return "WYSE_UNO_CALL";
                if (isUnoPut && rsi > 30) return "WYSE_UNO_PUT";
            }
        }

        // --- PATRÓN ESCALERA (RELAXED) ---
        const isHealthyTrend = emaGap > 0.0002; // Mínima apertura para confirmar fuerza (0.02%)
        const last4 = [candles[candles.length - 5], vPrev2, vPrev1, vSignal];

        if (isHealthyTrend) {
            if (emaBullish) {
                const hasPullback = last4.some(c => c.close < c.open && c.low <= ema36 * 1.008);
                if (hasPullback && vSignal.close > vSignal.open && rsi < 85) return "WYSE_ESCALERA_CALL";
            }
            if (emaBearish) {
                const hasPullback = last4.some(c => c.close > c.open && c.high >= ema36 * 0.992);
                if (hasPullback && vSignal.close < vSignal.open && rsi > 15) return "WYSE_ESCALERA_PUT";
            }
        }

        return "NONE";
    },

    calculateFibonacci(highs, lows, period = 100) {
        if (highs.length < period || lows.length < period) return null;
        const hSlice = highs.slice(-period);
        const lSlice = lows.slice(-period);
        const max = Math.max(...hSlice);
        const min = Math.min(...lSlice);
        const diff = max - min;
        return {
            max: max,
            min: min,
            l618: max - (diff * 0.618),
            l500: max - (diff * 0.5),
            l382: max - (diff * 0.382),
            l236: max - (diff * 0.236)
        };
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
