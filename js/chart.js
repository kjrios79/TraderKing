import { Indicators } from './indicators.js?v=3.1.40';

export class ChartManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.chart = null;
        this.candleSeries = null;
        this.smaSeries = null;
        this.emaSeries = null;
        this.bbUpper = null;
        this.bbLower = null;
        this.psarSeries = null;

        this.currentCandle = null;
        this.allCandles = [];

        try {
            const Lib = window.LightweightCharts;
            if (!Lib) return;

            this.chart = Lib.createChart(this.container, {
                width: this.container.clientWidth - 50, // Reverted to 50px
                rightPriceScale: {
                    visible: true,
                    minimumWidth: 90, // Validated for 6-digit prices
                    borderColor: 'rgba(197, 203, 206, 0.8)',
                },
                layout: {
                    background: { color: '#000000' },
                    textColor: '#DDD',
                    fontFamily: 'Inter, sans-serif'
                },
                grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false, // Cleaner look
                    barSpacing: 6, // Optimal zoom: ~3 mins on desktop, ~1 min on mobile
                    minBarSpacing: 5,
                    rightBarStaysOnScroll: true,
                    tickMarkFormatter: (time, tickMarkType, locale) => {
                        const date = new Date(time * 1000);
                        if (date.getSeconds() === 0) {
                            return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                        }
                        return ""; // Hide intermediate ticks to enforce 1-minute intervals
                    }
                },
                crosshair: { mode: Lib.CrosshairMode.Normal }
            });

            if (this.chart) {
                // Candle Series
                this.candleSeries = this.chart.addCandlestickSeries({
                    upColor: '#4caf50',
                    downColor: '#ff444f',
                    borderVisible: false,
                    wickUpColor: '#4caf50',
                    wickDownColor: '#ff444f',
                });

                // Moving Averages (Thicker for visibility as requested)
                this.smaSeries = this.chart.addLineSeries({
                    color: '#2196f3',
                    lineWidth: 2,
                    title: 'SMA 20',
                    priceLineVisible: false
                });

                this.emaSeries = this.chart.addLineSeries({
                    color: '#f0b90b',
                    lineWidth: 2,
                    title: 'EMA 10',
                    priceLineVisible: false
                });

                // Elite Overlays (Faded for focus)
                this.bbUpper = this.chart.addLineSeries({
                    color: 'rgba(33, 150, 243, 0.2)',
                    lineWidth: 1,
                    title: 'BB'
                });
                this.bbLower = this.chart.addLineSeries({
                    color: 'rgba(33, 150, 243, 0.2)',
                    lineWidth: 1
                });
                this.psarSeries = this.chart.addLineSeries({
                    color: 'rgba(255, 255, 255, 0.4)',
                    lineWidth: 1,
                    title: 'PSAR',
                    lineStyle: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });

                // Legend Fix: Ensure legend is visible in the container
            }
        } catch (e) {
            console.error("Chart Startup Error:", e);
        }

        window.addEventListener('resize', () => {
            if (this.chart) {
                try {
                    try {
                        this.chart.applyOptions({ width: this.container.clientWidth - 50, height: this.container.clientHeight });
                    } catch (e) { }
                } catch (e) { }
            }
        });
    }

    setHistory(candles) {
        if (!this.candleSeries || !candles) return;
        try {
            const data = candles.map(c => ({
                time: parseInt(c.epoch),
                open: parseFloat(c.open),
                high: parseFloat(c.high),
                low: parseFloat(c.low),
                close: parseFloat(c.close),
            }));

            this.candleSeries.setData(data);
            this.allCandles = data;
            this.updateIndicators();

            if (data.length > 0) {
                const last = data[data.length - 1];
                this.currentCandle = { ...last };
            }
        } catch (e) { }
    }

    onTick(tick) {
        if (!this.candleSeries) return;
        try {
            const time = Math.floor(tick.epoch / 60) * 60;
            const price = parseFloat(tick.quote);

            if (!this.currentCandle || time > this.currentCandle.time) {
                this.currentCandle = { time: time, open: price, high: price, low: price, close: price };
            } else {
                this.currentCandle.high = Math.max(this.currentCandle.high, price);
                this.currentCandle.low = Math.min(this.currentCandle.low, price);
                this.currentCandle.close = price;
            }
            this.candleSeries.update(this.currentCandle);

            if (this.allCandles.length > 0 && this.allCandles[this.allCandles.length - 1].time === this.currentCandle.time) {
                this.allCandles[this.allCandles.length - 1] = { ...this.currentCandle };
            } else {
                this.allCandles.push({ ...this.currentCandle });
            }
            if (this.allCandles.length > 1500) this.allCandles.shift();
            this.updateIndicators();

            // V3.1.98: Strategic Auto-Scroll
            // Only scroll if we are near the edge to avoid fighting user scrolls
            const timeScale = this.chart.timeScale();
            const visibleRange = timeScale.getVisibleRange();
            if (visibleRange) {
                const lastTime = this.allCandles[this.allCandles.length - 1].time;
                if (lastTime >= visibleRange.to - 60) {
                    timeScale.scrollToPosition(0, true);
                }
            }
        } catch (e) { }
    }

    getCloses() {
        return this.allCandles.map(c => c.close);
    }

    clear() {
        if (this.candleSeries) {
            try {
                this.candleSeries.setData([]);
                if (this.smaSeries) this.smaSeries.setData([]);
                if (this.emaSeries) this.emaSeries.setData([]);
                if (this.bbUpper) this.bbUpper.setData([]);
                if (this.bbLower) this.bbLower.setData([]);
                if (this.psarSeries) this.psarSeries.setData([]);
            } catch (e) { }
        }
        this.currentCandle = null;
        this.allCandles = [];
    }

    updateIndicators() {
        if (!this.allCandles || this.allCandles.length < 5) return;

        const prices = this.allCandles.map(c => c.close);
        const smaData = [];
        const emaData = [];
        const bbUData = [];
        const bbLData = [];
        const psarData = [];

        const start = Math.max(0, this.allCandles.length - 150);

        for (let i = start; i < this.allCandles.length; i++) {
            const slice = prices.slice(0, i + 1);
            const time = this.allCandles[i].time;

            smaData.push({ time, value: Indicators.calculateSMA(slice, 20) });
            emaData.push({ time, value: Indicators.calculateEMA(slice, 10) });

            const bb = Indicators.calculateBollinger(slice, 20, 2);
            if (bb) {
                bbUData.push({ time, value: bb.upper });
                bbLData.push({ time, value: bb.lower });
            }

            const psar = Indicators.calculatePSAR(slice);
            psarData.push({ time, value: psar });
        }

        if (this.smaSeries) this.smaSeries.setData(smaData);
        if (this.emaSeries) this.emaSeries.setData(emaData);
        if (this.bbUpper) this.bbUpper.setData(bbUData);
        if (this.bbLower) this.bbLower.setData(bbLData);
        if (this.psarSeries) this.psarSeries.setData(psarData);
    }

    getLatestIndicators() {
        if (this.allCandles.length < 80) return null;

        const prices = this.allCandles.map(c => c.close);
        const highs = this.allCandles.map(c => c.high);
        const lows = this.allCandles.map(c => c.low);
        const lastCandle = this.allCandles[this.allCandles.length - 1];

        return {
            ema: Indicators.calculateEMA(prices, 10),
            sma: Indicators.calculateSMA(prices, 20),
            ema36: Indicators.calculateEMA(prices, 36),
            ema51: Indicators.calculateEMA(prices, 51),
            dema: Indicators.calculateDEMA(prices, 10),
            tema: Indicators.calculateTEMA(prices, 10),
            zScore: Indicators.calculateZScore(prices, 20),
            rsiLaguerre: Indicators.calculateRSILaguerre(prices, 0.2),
            superTrend: Indicators.calculateSuperTrend(prices, 10, 3),
            smc: Indicators.detectSMC(prices),
            crossover: Indicators.detectCrossover(
                this.allCandles.slice(-50).map(c => Indicators.calculateEMA(this.allCandles.slice(0, this.allCandles.indexOf(c) + 1).map(x => x.close), 10)),
                this.allCandles.slice(-50).map(c => Indicators.calculateSMA(this.allCandles.slice(0, this.allCandles.indexOf(c) + 1).map(x => x.close), 20))
            ),
            rsi: Indicators.calculateRSI(prices, 14),
            fisher: Indicators.calculateFisher(prices, 10),
            fibo: Indicators.calculateFibonacci(highs, lows, 100),
            safariTrend: Indicators.calculateSafariTrend(prices),
            bollinger: Indicators.calculateBollinger(prices, 20, 2),
            psar: Indicators.calculatePSAR(prices),
            ichimoku: Indicators.calculateIchimoku(highs, lows),
            alligator: Indicators.calculateAlligator(prices),
            candleForce: Indicators.detectCandleForce(lastCandle.open, lastCandle.close, lastCandle.high, lastCandle.low),
            sniperWick: Indicators.detectSniperWick(lastCandle),
            olympRejection: Indicators.detectOlympRejection(this.allCandles, Indicators.calculateEMA(prices, 36), Indicators.calculateEMA(prices, 51), Indicators.calculateSMA(prices, 20), Indicators.calculateRSI(prices, 14)),
            marketForce: Indicators.calculateMarketForce(highs, lows, 14),
            adx: Indicators.calculateADX(highs, lows, prices, 14),
            lastPrice: prices[prices.length - 1],
            lastCandle: lastCandle
        };
    }
}
