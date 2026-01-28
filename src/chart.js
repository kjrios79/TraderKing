import { createChart } from 'lightweight-charts';

export class ChartManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.chart = null;
        this.candleSeries = null;
        this.currentCandle = null;

        try {
            this.chart = createChart(this.container, {
                layout: {
                    background: { color: '#000000' },
                    textColor: '#DDD'
                },
                grid: {
                    vertLines: { color: '#1a1a1a' },
                    horzLines: { color: '#1a1a1a' }
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: true,
                    borderColor: '#333',
                },
                rightPriceScale: {
                    borderColor: '#333',
                }
            });

            if (this.chart) {
                console.log("Chart created. Available methods:", Object.keys(this.chart));

                // Try to find the method even if it's renamed or hidden
                const addMethod = this.chart.addCandlestickSeries ||
                    this.chart.addSeries ||
                    Object.values(this.chart).find(v => typeof v === 'function' && v.name.includes('Candlestick'));

                if (typeof addMethod === 'function') {
                    console.log("Found series addition method.");
                    this.candleSeries = addMethod.call(this.chart, {
                        upColor: '#4caf50',
                        downColor: '#ff444f',
                        borderVisible: false,
                        wickUpColor: '#4caf50',
                        wickDownColor: '#ff444f',
                    });
                } else {
                    console.error("Critical: Could not find any candlestick series method on chart object.");
                    // Last resort: try to log the first few functions to see obfuscated names
                    const funcs = Object.entries(this.chart).filter(([k, v]) => typeof v === 'function');
                    console.log("Available functions on chart object:", funcs.map(([k]) => k));
                }
            }
        } catch (e) {
            console.error("Fatal Chart Error:", e);
        }



        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.applyOptions({
                    width: this.container.clientWidth,
                    height: this.container.clientHeight,
                });
            }
        });
    }

    onTick(tick) {
        // Critical safety check to prevent entire app from crashing
        if (!this.candleSeries) return;

        try {
            const time = Math.floor(tick.epoch / 60) * 60;
            const price = parseFloat(tick.quote);

            if (!this.currentCandle || time > this.currentCandle.time) {
                this.currentCandle = {
                    time: time,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                };
            } else {
                this.currentCandle.high = Math.max(this.currentCandle.high, price);
                this.currentCandle.low = Math.min(this.currentCandle.low, price);
                this.currentCandle.close = price;
            }

            this.candleSeries.update(this.currentCandle);
        } catch (e) {
            console.error("Error updating chart:", e);
        }
    }

    clear() {
        if (this.candleSeries) {
            try {
                this.candleSeries.setData([]);
            } catch (e) { }
        }
        this.currentCandle = null;
    }
}
