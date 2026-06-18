/**
 * AI Lead Magnet — UI flow, API integration, dynamic SVG donut.
 */

const API_REPORT = "/api/report";

const QUESTIONS = [
  { id: "goal", label: "What is your primary goal?", options: [{ value: "grow revenue", label: "Grow revenue" }, { value: "launch new products", label: "Launch new products" }, { value: "reduce costs", label: "Reduce costs" }, { value: "brand awareness", label: "Brand awareness" }] },
  { id: "platform", label: "What platform do you use?", options: [{ value: "shopify", label: "Shopify" }, { value: "woocommerce", label: "WooCommerce" }, { value: "custom", label: "Custom stack" }, { value: "other", label: "Other" }] },
  { id: "traffic", label: "How much traffic do you get?", options: [{ value: "100k+", label: "100k+ / month" }, { value: "10k-100k", label: "10k – 100k / month" }, { value: "1k-10k", label: "1k – 10k / month" }, { value: "under 1k", label: "Under 1k / month" }] },
  { id: "ads", label: "Do you run paid ads?", options: [{ value: "yes, actively", label: "Yes, actively" }, { value: "sometimes", label: "Sometimes" }, { value: "no", label: "No" }] },
  { id: "revenue", label: "What is your monthly revenue?", options: [{ value: "under 10k", label: "Under $10k" }, { value: "10k-50k", label: "$10k – $50k" }, { value: "50k-200k", label: "$50k – $200k" }, { value: "200k+", label: "$200k+" }] },
];

function $(id) {
  return document.getElementById(id);
}

function formatMoney(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function polar(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutSlicePath(cx, cy, rInner, rOuter, startDeg, endDeg) {
  const [x1, y1] = polar(cx, cy, rOuter, startDeg);
  const [x2, y2] = polar(cx, cy, rOuter, endDeg);
  const [x3, y3] = polar(cx, cy, rInner, endDeg);
  const [x4, y4] = polar(cx, cy, rInner, startDeg);
  const sweep = endDeg - startDeg;
  const large = sweep > 180 ? 1 : 0;
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function renderDonut(svgEl, segments) {
  if (!svgEl || !segments || !segments.length) return;
  const cx = 60;
  const cy = 60;
  const rOuter = 52;
  const rInner = 34;
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0) || 1;
  let angle = 0;
  const paths = [];
  segments.forEach((seg) => {
    const delta = ((Number(seg.value) || 0) / total) * 360;
    if (delta <= 0.05) return;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", donutSlicePath(cx, cy, rInner, rOuter, angle, angle + delta));
    path.setAttribute("fill", seg.color || "#0052CC");
    path.setAttribute("stroke", "#fff");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linejoin", "round");
    paths.push(path);
    angle += delta;
  });
  svgEl.replaceChildren(...paths);
}

function normalizeLeadCategory(raw) {
  const s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (s === "hot" || s === "warm" || s === "cold") return s;
  return "";
}

function setLeadPill(category) {
  const pill = $("lead-pill");
  if (!pill) return;
  const key = normalizeLeadCategory(category);
  const labels = { hot: "Hot", warm: "Warm", cold: "Cold" };
  const label = key ? labels[key] : "—";
  pill.textContent = key ? `Lead: ${label}` : "Lead: —";

  const base =
    "inline-block text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full ";
  const styles = {
    hot: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200/80",
    warm: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200/80",
    cold: "bg-slate-200 text-slate-800 ring-1 ring-inset ring-slate-300/80",
  };
  pill.className = base + (styles[key] || "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80");
}

function fillOpportunitiesList(opportunities) {
  const list = $("opportunities-list");
  if (!list) return;
  list.replaceChildren();
  const items = Array.isArray(opportunities) ? opportunities : [];
  const frag = document.createDocumentFragment();
  items.forEach((raw) => {
    const o = raw && typeof raw === "object" ? raw : {};
    const li = document.createElement("li");
    li.className =
      "flex items-start justify-between gap-3 rounded-xl bg-white border border-slate-100 px-4 py-3 text-sm";
    const title = document.createElement("span");
    title.className = "flex items-start gap-2 text-slate-700";
    title.innerHTML = '<span class="text-amber-400 mt-0.5" aria-hidden="true">★</span><span></span>';
    title.lastElementChild.textContent = o.title || "";
    const val = document.createElement("span");
    val.className = "shrink-0 font-semibold text-success text-xs sm:text-sm";
    val.innerHTML = `${formatMoney(Number(o.monthly_value) || 0)}<span class="font-normal text-slate-400"> / mo</span>`;
    li.appendChild(title);
    li.appendChild(val);
    frag.appendChild(li);
  });
  list.appendChild(frag);
}

function applyReport(data) {
  const d = data && typeof data === "object" ? data : {};

  const score = Number(d.shop_health_score) || 0;
  const revenue = Number(d.estimated_monthly_revenue) || 0;
  const pct = d.percentile_comparison != null ? Number(d.percentile_comparison) : score;
  const pot = Number(d.potential_increase_pct) || 0;

  const trafficScore = Number(d.traffic_score);
  const conversionRate = Number(d.conversion_rate);
  const siteSpeed = Number(d.site_speed);

  const metrics = [
    ["metric-traffic", String(Number.isFinite(trafficScore) ? trafficScore : 0)],
    ["metric-conversion", `${Number.isFinite(conversionRate) ? conversionRate : 0}%`],
    ["metric-speed", String(Number.isFinite(siteSpeed) ? siteSpeed : 0)],
  ];
  for (let i = 0; i < metrics.length; i += 1) {
    const el = $(metrics[i][0]);
    if (el) el.textContent = metrics[i][1];
  }

  const elExp = $("metric-experience");
  if (elExp) {
    const label = d.experience_label;
    elExp.textContent = label != null && String(label).trim() !== "" ? String(label) : "—";
  }

  const elScore = $("metric-score");
  if (elScore) elScore.textContent = String(score);

  const elRev = $("metric-revenue");
  if (elRev) elRev.textContent = formatMoney(revenue);

  const elRevSub = $("metric-revenue-sub");
  if (elRevSub) elRevSub.textContent = `+${pot}% potential increase vs. baseline`;

  const elScoreSub = $("metric-score-sub");
  if (elScoreSub) {
    elScoreSub.textContent = `Great! Your store is performing better than ${pct}% of similar stores.`;
  }

  fillOpportunitiesList(d.opportunities);

  const donutCenter = $("donut-center");
  if (donutCenter) donutCenter.textContent = `+${formatMoney(Number(d.donut_center_monthly) || 0)}`;

  renderDonut($("donut-svg"), d.donut_segments || []);

  setLeadPill(data && typeof data === "object" ? data.lead_category : undefined);
}

function buildQuestions() {
  const root = $("questions-root");
  if (!root) return;
  root.innerHTML = "";
  QUESTIONS.forEach((q) => {
    const wrap = document.createElement("div");
    wrap.className = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
    wrap.innerHTML = `<p class="text-sm font-semibold text-navy mb-3">${q.label}</p>`;
    const opts = document.createElement("div");
    opts.className = "space-y-2";
    q.options.forEach((opt, oi) => {
      const id = `q-${q.id}-${oi}`;
      const row = document.createElement("div");
      row.className = "relative";
      row.innerHTML = `
        <input class="q-option peer sr-only" type="radio" name="${q.id}" id="${id}" value="${opt.value}" />
        <label for="${id}" class="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition hover:border-primary/40 peer-checked:border-primary peer-checked:bg-primary/5">
          <span>${opt.label}</span>
          <span class="check-reveal text-primary font-semibold">✓</span>
        </label>`;
      opts.appendChild(row);
    });
    wrap.appendChild(opts);
    root.appendChild(wrap);
  });
}

function collectAnswers() {
  const out = {};
  QUESTIONS.forEach((q) => {
    const el = document.querySelector(`input[name="${q.id}"]:checked`);
    out[q.id] = el ? el.value : "";
  });
  return out;
}

async function submitReport(url, answers) {
  const res = await fetch(API_REPORT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, answers }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function show(el, on) {
  if (el) el.classList.toggle("hidden", !on);
}

function validateUrl(t) {
  const s = String(t || "").trim();
  if (s.length < 4 || !s.includes(".")) return false;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    return Boolean(u.hostname && u.hostname.includes("."));
  } catch {
    return false;
  }
}

function init() {
  buildQuestions();

  const btn1 = $("btn-step1");
  if (btn1) {
    btn1.onclick = () => {
      const raw = $("store-url") && $("store-url").value;
      const err = $("url-error");
      if (!validateUrl(raw)) {
        if (err) {
          err.textContent = "Enter a valid store URL (e.g. yourstore.com).";
          err.classList.remove("hidden");
        }
        return;
      }
      if (err) err.classList.add("hidden");
      const display = String(raw).trim().replace(/^https?:\/\//i, "");
      const su = $("summary-url");
      const du = $("dash-url");
      if (su) su.textContent = display;
      if (du) du.textContent = display;
      show($("panel-step1"), false);
      show($("panel-step2"), true);
    };
  }

  const btnGen = $("btn-generate");
  if (btnGen) {
    btnGen.onclick = async () => {
      const quizErr = $("quiz-error");
      const answers = collectAnswers();
      const missing = QUESTIONS.filter((q) => !answers[q.id]);
      if (missing.length) {
        if (quizErr) {
          quizErr.textContent = "Please select an answer for every question.";
          quizErr.classList.remove("hidden");
        }
        return;
      }
      if (quizErr) quizErr.classList.add("hidden");

      show($("panel-step2"), false);
      show($("panel-loading"), true);

      try {
        const url = ($("store-url") && $("store-url").value) || "";
        const data = await submitReport(url, answers);
        applyReport(data);
        show($("panel-loading"), false);
        show($("panel-step3"), true);
      } catch (e) {
        show($("panel-loading"), false);
        show($("panel-step2"), true);
        if (quizErr) {
          quizErr.textContent = e.message || "Something went wrong.";
          quizErr.classList.remove("hidden");
        }
      }
    };
  }

  const btnReset = $("btn-reset");
  if (btnReset) {
    btnReset.onclick = () => {
      const inp = $("store-url");
      if (inp) inp.value = "";
      document.querySelectorAll(".q-option").forEach((r) => {
        r.checked = false;
      });
      show($("panel-step3"), false);
      show($("panel-loading"), false);
      show($("panel-step2"), false);
      show($("panel-step1"), true);
    };
  }
}

document.addEventListener("DOMContentLoaded", init);
