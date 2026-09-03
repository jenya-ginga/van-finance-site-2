/* =========================================================
   My VanFinance — shared front-end logic
   Nav toggle, calculators, VIN/tool demos.
   All figures are illustrative estimates only (see disclaimers).
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {
  initNavToggle();
  initYear();
  initHPCalculator();
  initAffordabilityCalculator();
  initBalloonCalculator();
  initSettlementCalculator();
  initVinCheck();
  initLicenceCheck();
  initFilterChips();
});

/* ---------- Mobile nav ---------- */
function initNavToggle () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('nav-open');
    if (open) {
      nav.style.display = 'flex';
      nav.style.flexDirection = 'column';
      nav.style.position = 'absolute';
      nav.style.top = '64px';
      nav.style.left = '0';
      nav.style.right = '0';
      nav.style.background = '#0A1024';
      nav.style.padding = '12px 24px 20px';
      nav.style.borderBottom = '1px solid rgba(255,255,255,.08)';
    } else {
      nav.style.display = 'none';
    }
  });
}

function initYear () {
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
}

/* ---------- Helpers ---------- */
function gbp (n) {
  if (isNaN(n)) n = 0;
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function gbp0 (n) {
  if (isNaN(n)) n = 0;
  return '£' + Math.round(n).toLocaleString('en-GB');
}
function num (el) { return parseFloat(el && el.value) || 0; }

/* Standard amortising monthly payment (HP / PCP with optional balloon) */
function monthlyPayment (principal, annualRatePct, months, balloon) {
  balloon = balloon || 0;
  var r = (annualRatePct / 100) / 12;
  if (months <= 0) return 0;
  if (r === 0) return (principal - balloon) / months;
  var pv = principal - balloon * Math.pow(1 + r, -months);
  return (pv * r) / (1 - Math.pow(1 + r, -months));
}

/* ---------- 1. HP Van Finance Calculator ---------- */
function initHPCalculator () {
  var form = document.getElementById('hp-calc-form');
  if (!form) return;
  var price = document.getElementById('hp-price');
  var deposit = document.getElementById('hp-deposit');
  var term = document.getElementById('hp-term');
  var apr = document.getElementById('hp-apr');
  var termOut = document.getElementById('hp-term-out');
  var aprOut = document.getElementById('hp-apr-out');

  function render () {
    var p = num(price), d = num(deposit), t = parseInt(term.value, 10), a = num(apr);
    var principal = Math.max(p - d, 0);
    var m = monthlyPayment(principal, a, t, 0);
    var total = m * t + d;
    var interest = total - p;
    if (termOut) termOut.textContent = t + ' months';
    if (aprOut) aprOut.textContent = a.toFixed(1) + '% APR';
    setText('hp-monthly', gbp0(m));
    setText('hp-total', gbp0(total));
    setText('hp-interest', gbp0(Math.max(interest, 0)));
    setText('hp-borrowed', gbp0(principal));
  }
  form.addEventListener('input', render);
  render();
}

/* ---------- 2. Affordability Calculator ---------- */
function initAffordabilityCalculator () {
  var form = document.getElementById('afford-calc-form');
  if (!form) return;
  var income = document.getElementById('afford-income');
  var expenses = document.getElementById('afford-expenses');
  var commitments = document.getElementById('afford-commitments');

  function render () {
    var inc = num(income), exp = num(expenses), com = num(commitments);
    var disposable = Math.max(inc - exp - com, 0);
    // conservative guideline: lenders typically want van finance payment
    // to sit within ~35-40% of disposable income
    var suggestedLow = disposable * 0.25;
    var suggestedHigh = disposable * 0.4;
    var impliedAt8pct60m = suggestedHigh > 0 ? loanFromPayment(suggestedHigh, 8.9, 60) : 0;
    setText('afford-disposable', gbp0(disposable));
    setText('afford-range', gbp0(suggestedLow) + ' – ' + gbp0(suggestedHigh));
    setText('afford-implied', gbp0(impliedAt8pct60m));
  }
  form.addEventListener('input', render);
  render();
}

function loanFromPayment (payment, annualRatePct, months) {
  var r = (annualRatePct / 100) / 12;
  if (r === 0) return payment * months;
  return payment * (1 - Math.pow(1 + r, -months)) / r;
}

/* ---------- 3. Balloon / PCP Calculator ---------- */
function initBalloonCalculator () {
  var form = document.getElementById('balloon-calc-form');
  if (!form) return;
  var price = document.getElementById('bal-price');
  var deposit = document.getElementById('bal-deposit');
  var term = document.getElementById('bal-term');
  var apr = document.getElementById('bal-apr');
  var gfvPct = document.getElementById('bal-gfv');
  var termOut = document.getElementById('bal-term-out');
  var gfvOut = document.getElementById('bal-gfv-out');

  function render () {
    var p = num(price), d = num(deposit), t = parseInt(term.value, 10), a = num(apr), gPct = num(gfvPct);
    var principal = Math.max(p - d, 0);
    var balloon = p * (gPct / 100);
    var m = monthlyPayment(principal, a, t, balloon);
    var totalPaid = m * t + d + balloon;
    var interest = totalPaid - p;
    if (termOut) termOut.textContent = t + ' months';
    if (gfvOut) gfvOut.textContent = gPct + '% GFV';
    setText('bal-monthly', gbp0(m));
    setText('bal-balloon', gbp0(balloon));
    setText('bal-total', gbp0(totalPaid));
    setText('bal-interest', gbp0(Math.max(interest, 0)));
  }
  form.addEventListener('input', render);
  render();
}

/* ---------- 4. Early Settlement Estimator ---------- */
function initSettlementCalculator () {
  var form = document.getElementById('settle-calc-form');
  if (!form) return;
  var loan = document.getElementById('settle-loan');
  var apr = document.getElementById('settle-apr');
  var term = document.getElementById('settle-term');
  var paid = document.getElementById('settle-paid');

  function render () {
    var L = num(loan), a = num(apr), t = parseInt(term.value, 10) || 1, p = parseInt(paid.value, 10) || 0;
    p = Math.min(p, t);
    var m = monthlyPayment(L, a, t, 0);
    var r = (a / 100) / 12;
    // remaining balance after p payments on a standard amortising loan
    var balance;
    if (r === 0) {
      balance = L - m * p;
    } else {
      balance = L * Math.pow(1 + r, p) - m * ((Math.pow(1 + r, p) - 1) / r);
    }
    balance = Math.max(balance, 0);
    // Consumer Credit (Early Settlement) Regs allow a small rebate-style
    // interest reduction; we show balance plus an indicative 1-month rebate cap.
    var estimateLow = balance * 0.97;
    var estimateHigh = balance * 1.0;
    setText('settle-balance', gbp0(balance));
    setText('settle-range', gbp0(estimateLow) + ' – ' + gbp0(estimateHigh));
    setText('settle-paid-count', p + ' of ' + t + ' payments');
  }
  form.addEventListener('input', render);
  render();
}

function setText (id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ---------- VIN Check demo tool ---------- */
function initVinCheck () {
  var form = document.getElementById('vin-check-form');
  if (!form) return;
  var input = document.getElementById('vin-input');
  var resultBox = document.getElementById('vin-result');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var vin = (input.value || '').toUpperCase().replace(/\s+/g, '');
    var valid = /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
    resultBox.style.display = 'block';
    if (!valid) {
      resultBox.innerHTML =
        '<div class="tag tag-coral">Format not recognised</div>' +
        '<p class="mt-16">That doesn’t look like a valid 17-character VIN (letters I, O and Q are never used). ' +
        'Double-check the number on your V5C logbook, chassis plate, or windscreen, then try again.</p>';
      return;
    }
    resultBox.innerHTML =
      '<div class="tag tag-green">Valid VIN format</div>' +
      '<h4 class="mt-16 mb-8">' + vin + '</h4>' +
      '<p>This is a structural check of the VIN format only — it confirms the number is well-formed, not what it is registered against. ' +
      'For a full history (mileage, write-off/insurance status, outstanding finance, stolen marker, plate changes), run a paid HPI/finance check with one of our accredited partners below before you buy or lend against this vehicle.</p>';
  });
}

/* ---------- Driving licence penalty-points helper ---------- */
function initLicenceCheck () {
  var form = document.getElementById('licence-points-form');
  if (!form) return;
  var points = document.getElementById('licence-points');
  var years = document.getElementById('licence-years');
  var out = document.getElementById('licence-result');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pts = parseInt(points.value, 10) || 0;
    var yrs = parseFloat(years.value) || 0;
    out.style.display = 'block';
    var risk, cls;
    if (pts >= 12) { risk = 'High — 12+ points can trigger a totting-up disqualification, which most van finance lenders treat as a serious adverse marker.'; cls = 'tag-coral'; }
    else if (pts >= 6) { risk = 'Moderate — some specialist lenders will still consider you, usually with a higher APR or larger deposit.'; cls = 'tag-amber'; }
    else if (pts >= 1) { risk = 'Low — most mainstream van finance lenders are comfortable with a handful of points, especially if they’re several years old.'; cls = 'tag-amber'; }
    else { risk = 'None recorded — a clean licence works in your favour on both approval odds and the rate you’re offered.'; cls = 'tag-green'; }
    out.innerHTML = '<div class="tag ' + cls + '">' + pts + ' points on file</div><p class="mt-16">' + risk + ' Points expire from your licence after 4–11 years depending on the offence — always check the current position on the official GOV.UK “View your driving licence” service before applying.</p>';
  });
}

/* ---------- Generic filter chips (lenders hub / compare) ---------- */
function initFilterChips () {
  document.querySelectorAll('[data-chip-group]').forEach(function (group) {
    var chips = group.querySelectorAll('.chip');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var filter = chip.getAttribute('data-filter');
        var targetSelector = group.getAttribute('data-chip-group');
        document.querySelectorAll(targetSelector + ' [data-tags]').forEach(function (card) {
          var tags = (card.getAttribute('data-tags') || '').split(',');
          card.style.display = (filter === 'all' || tags.indexOf(filter) !== -1) ? '' : 'none';
        });
      });
    });
  });
}
