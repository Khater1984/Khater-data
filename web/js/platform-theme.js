/* Platform theme bridge — reads identity from platform-shell.css :root.
 * Charts use Cairo and semantic up/down colors from the platform identity.
 * No chart vendor branding/watermark is requested by this bridge.
 */
(function (window, document) {
  'use strict';

  function css(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function rgbaFromHex(hex, alpha) {
    if (!hex || hex.charAt(0) !== '#') return 'rgba(8,127,99,' + alpha + ')';
    var h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!Number.isFinite(n)) return 'rgba(8,127,99,' + alpha + ')';
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function build() {
    var green = css('--shell-green', '#087f63');
    var red = css('--shell-red', '#c73538');
    var gold = css('--shell-gold', '#a9652b');
    var muted = css('--shell-muted', '#4a6063');
    var surface = css('--shell-surface', '#ffffff');
    var soft = css('--shell-surface-soft', '#f3f8f6');
    var border = css('--shell-border', '#c5d4d0');
    var ink = css('--shell-ink', '#0b1c1f');
    var caution = css('--shell-caution', '#9a7112');
    var info = css('--shell-info', '#3d6b8a');
    var fontAr = css('--font-arabic', 'Cairo, sans-serif').replace(/^[\"']|[\"']$/g, '');
    var chartFontSize = Math.round(parseFloat(css('--text-small', '12.5'))) || 12;

    var palette = [green, gold, info, caution, muted, red];

    return {
      color: {
        bg: css('--shell-bg', '#e7eeeb'),
        surface: surface,
        surfaceSoft: soft,
        ink: ink,
        muted: muted,
        border: border,
        borderStrong: css('--shell-border-strong', '#a7bdb7'),
        up: green,
        down: red,
        flat: muted,
        gold: gold,
        caution: caution,
        info: info,
        chartPrimary: css('--chart-primary', green),
        chartSecondary: css('--chart-secondary', gold),
        chartGrid: css('--chart-grid', '#dce8e4'),
        chartAxis: css('--chart-axis', muted)
      },
      font: {
        arabic: fontAr,
        mono: fontAr,
        chart: fontAr
      },
      series: {
        purchasing: red,
        usd_egp_mid: green,
        gold_egp_oz: gold,
        silver_egp_oz: muted,
        qqq_egp: info,
        spy_egp: green,
        egx30_close: green,
        deposit: caution,
        tbill: green,
        btc_egp: gold
      },
      palette: palette,
      fillUp: rgbaFromHex(green, 0.12),
      fillDown: rgbaFromHex(red, 0.12),
      fillFlat: rgbaFromHex(muted, 0.10),
      directionColor: function (direction) {
        var d = String(direction || '').toLowerCase();
        if (d === 'up' || d === 'positive' || d === 'gain') return green;
        if (d === 'down' || d === 'negative' || d === 'loss') return red;
        return muted;
      },
      directionFill: function (direction, alpha) {
        var color = this.directionColor(direction);
        return rgbaFromHex(color, Number.isFinite(Number(alpha)) ? Number(alpha) : 0.12);
      },
      seriesColor: function (key) {
        if (key && this.series[key]) return this.series[key];
        return green;
      },
      paletteAt: function (index) {
        var i = Number(index) || 0;
        return palette[((i % palette.length) + palette.length) % palette.length];
      },
      svgAppearance: function () {
        return {
          line: this.color.chartPrimary,
          fill: this.fillUp,
          axis: this.color.chartGrid,
          width: 2.5
        };
      },
      chartLayout: function () {
        return {
          background: { color: surface },
          textColor: ink,
          fontSize: chartFontSize,
          fontFamily: fontAr,
          attributionLogo: false
        };
      },
      chartGrid: function () {
        return {
          vertLines: { color: css('--chart-grid', '#dce8e4') },
          horzLines: { color: css('--chart-grid', '#dce8e4') }
        };
      },
      chartScale: function () {
        return {
          borderColor: border,
          textColor: muted,
          minimumWidth: 42,
          visible: true
        };
      },
      chartText: function () {
        return {
          color: ink,
          fontFamily: fontAr,
          fontSize: chartFontSize
        };
      },
      chartCrosshair: function () {
        var faint = rgbaFromHex(green, 0.28);
        return {
          vertLine: { color: faint, width: 1, style: 2, labelBackgroundColor: green },
          horzLine: { color: faint, width: 1, style: 2, labelBackgroundColor: green }
        };
      },
      lightweightChartOptions: function (overrides) {
        var scale = this.chartScale();
        var extra = overrides || {};
        var base = {
          layout: this.chartLayout(),
          grid: this.chartGrid(),
          rightPriceScale: {
            borderColor: scale.borderColor,
            textColor: scale.textColor,
            scaleMargins: { top: 0.08, bottom: 0.08 },
            minimumWidth: 72,
            visible: true
          },
          timeScale: {
            borderColor: scale.borderColor,
            rightOffset: 4,
            barSpacing: 8,
            minBarSpacing: 3
          },
          localization: { locale: 'en-US' },
          crosshair: this.chartCrosshair(),
          attributionLogo: false
        };
        var key;
        for (key in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, key)) base[key] = extra[key];
        }
        return base;
      },
      chartBorder: border,
      scoreColor: function (v) {
        if (v == null || !Number.isFinite(Number(v))) return muted;
        var x = Math.max(0, Math.min(100, Number(v))) / 100;
        if (x < 0.35) return red;
        if (x < 0.55) return caution;
        if (x < 0.75) return muted;
        return green;
      },
      interaction: {
        focusRing: css('--shell-focus-ring', 'rgba(8,127,99,.32)'),
        transitionFast: css('--transition-fast', '140ms cubic-bezier(.2,.7,.2,1)'),
        transitionNormal: css('--transition-normal', '220ms cubic-bezier(.2,.7,.2,1)'),
        hoverBorder: css('--shell-border-strong', '#a7bdb7'),
        activeBackground: css('--shell-green-soft', '#e6f4f0')
      },
      refresh: function () {
        window.KHATER_THEME = build();
        return window.KHATER_THEME;
      }
    };
  }

  window.KHATER_THEME = build();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.KHATER_THEME = build();
    }, { once: true });
  }
})(window, document);
