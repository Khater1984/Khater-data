(function () {
  'use strict';

  // Financial display guard: future-dated observations must never enter the
  // fund profile calculations, charts, rankings, or SmartScore inputs.
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function notFuture(value) {
    return value && String(value).slice(0, 10) <= todayISO();
  }

  function filterRows(rows, dateField) {
    return (rows || []).filter(function (row) {
      return row && notFuture(row[dateField]);
    });
  }

  window.KHATER_DATA_POLICY = {
    todayISO: todayISO,
    notFuture: notFuture,
    filterPerformance: function (rows) { return filterRows(rows, 'report_date'); },
    filterPrices: function (rows) { return filterRows(rows, 'as_of_date'); }
  };
})();
