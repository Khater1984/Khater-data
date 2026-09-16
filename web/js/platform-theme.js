/* Platform theme bridge — reads identity from platform-shell.css :root.
 * Charts, numbers, and decorative strokes must use KHATER_THEME — not hard-coded hex.
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
    var muted = css('--shell-muted', '#607477');
    var surface = css('--shell-surface', '#ffffff');
    var soft = css('--shell-surface-soft', '#f8fafb');
    var border = css('--shell-border', '#d9e2e1');
    var ink = css('--shell-ink', '#10262a');
    var caution = css('--shell-caution', '#9a7112');
    var fontAr = css('--font-arabic', 'Cairo, system-ui, sans-serif').replace(/^["']|["']$/g, '');
    var fontMono = css('--font-mono', 'IBM Plex Mono, ui-monospace, monospace').replace(/^["']|["']$/g, '');

    var palette = [green, gold, css('--shell-info', '#3d6b8a'), caution, muted, red, '#14B891', '#5D6E9A'];

    return {
      color: {
        bg: css('--shell-bg', '#f5f7f8'),
        surface: surface,
        surfaceSoft: soft,
        ink: ink,
        muted: muted,
        border: border,
        borderStrong: css('--shell-border-strong', '#bccdca'),
        up: green,
        down: red,
        gold: gold,
        caution: caution,
        chartPrimary: css('--chart-primary', green),
        chartSecondary: css('--chart-secondary', gold),
        chartGrid: css('--chart-grid', '#e3ebe9'),
        chartAxis: css('--chart-axis', muted)
      },
      font: {
        arabic: fontAr,
        mono: fontMono,
        chart: fontMono + ', ' + fontAr
      },
      series: {
        purchasing: red,
        usd_egp_mid: green,
        gold_egp_oz: gold,
        silver_egp_oz: muted,
        qqq_egp: css('--shell-info', '#3d6b8a'),
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
      chartLayout: function () {
        return {
          background: { color: surface },
          textColor: muted,
          fontFamily: fontMono + ', Cairo, system-ui, sans-serif'
        };
      },
      chartGrid: function () {
        return {
          vertLines: { color: css('--chart-grid', soft) },
          horzLines: { color: css('--chart-grid', soft) }
        };
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
  } else {
    window.KHATER_THEME = build();
  }
})(window, document);
