/**
 * POST /api/book
 *
 * Accepts a validated appointment request from the booking wizard, then
 * delivers it to the clinic inbox through Resend (https://resend.com).
 *
 * Environment variables (Cloudflare Pages → Settings → Environment variables):
 *   RESEND_API_KEY  required to deliver mail
 *   BOOKING_TO      optional, defaults to my.dentacure@gmail.com (comma separated)
 *   BOOKING_FROM    optional, defaults to "Denta Cure Website <onboarding@resend.dev>"
 *
 * Optional KV binding named BOOKINGS: when present, a copy of every delivered
 * request is archived there for 180 days (key: booking:<timestamp>:<id>).
 *
 * If RESEND_API_KEY is absent the route answers 503 and the website falls back
 * to the pre-filled mailto flow, so the form never dead-ends.
 */

const MAX_BODY_BYTES = 16 * 1024;
const MIN_FILL_MS = 1500;
const RATE_LIMIT = 3;
const RATE_WINDOW_SECONDS = 120;

const TREATMENTS = new Set([
  "General check-up & consultation",
  "Oral prophylaxis (cleaning)",
  "Teeth whitening",
  "Orthodontic consultation",
  "Tooth filling / restoration",
  "Root canal treatment",
  "Tooth extraction",
  "Children's dentistry",
  "Something else / not sure",
]);

const WEEKDAY_SLOTS = new Set([
  "9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM",
  "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
]);

const SUNDAY_SLOTS = new Set(["1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"]);

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function clean(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function manilaToday() {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function validateBooking(data) {
  const errors = {};
  const today = manilaToday();
  const latest = addDays(today, 90);

  const name = clean(data.name, 80);
  if (name.length < 2) errors.name = "Please add your full name.";

  const phoneRaw = clean(data.phone, 24);
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  if (!/^[+\d\s().-]{7,24}$/.test(phoneRaw) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = "Please add a mobile number we can reach you on.";
  }

  const email = clean(data.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "That email address looks incomplete.";
  }

  const treatment = clean(data.treatment, 80);
  if (!TREATMENTS.has(treatment)) errors.treatment = "Choose a treatment.";

  const firstVisit = data.firstVisit === "no" ? "Returning patient" : "First visit";
  const flexible = data.flexible === true;

  let date = clean(data.date, 10);
  let time = clean(data.time, 12);

  if (flexible) {
    if (date && (date < today || date > latest || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      errors.date = "That date is outside the booking window.";
    }
    time = "";
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.date = "Choose a preferred date.";
    } else if (date < today || date > latest) {
      errors.date = "That date is outside the booking window.";
    } else {
      const [y, m, d] = date.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const valid =
        dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
      if (!valid) {
        errors.date = "That date does not exist.";
      } else {
        const dow = dt.getUTCDay();
        const slots = dow === 0 ? SUNDAY_SLOTS : WEEKDAY_SLOTS;
        if (!slots.has(time)) {
          errors.time = dow === 0
            ? "On Sundays choose a time between 1:00 and 5:00 PM."
            : "Choose a time between 9:00 AM and 5:00 PM.";
        }
      }
    }
  }

  const notes = cleanMultiline(data.notes, 1000);
  if (data.consent !== true && data.consent !== "true" && data.consent !== "on") {
    errors.consent = "Please confirm the request.";
  }

  const elapsed = Number(data.elapsed);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    errors.elapsed = "Please take a moment to complete the form.";
  }

  const booking = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    name,
    phone: phoneRaw,
    email,
    treatment,
    firstVisit,
    flexible,
    date: flexible ? date : date,
    time,
    notes,
    consent: true,
    source: "website",
  };

  const ok = Object.keys(errors).length === 0;
  return { ok, errors, booking };
}

/* ------------------------------------------------------------------ */
/* Rate limiting + archive (optional KV)                               */
/* ------------------------------------------------------------------ */

async function checkRateLimit(env, ip) {
  if (!env.BOOKINGS || typeof env.BOOKINGS.get !== "function") return { ok: true };
  try {
    const key = `rl:${await sha256Hex(ip)}`;
    const current = Number(await env.BOOKINGS.get(key)) || 0;
    if (current >= RATE_LIMIT) return { ok: false };
    await env.BOOKINGS.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_SECONDS });
    return { ok: true };
  } catch (error) {
    console.error("rate_limit_failed", error && error.message);
    return { ok: true };
  }
}

async function archive(env, booking) {
  if (!env.BOOKINGS || typeof env.BOOKINGS.put !== "function") return false;
  try {
    const key = `booking:${booking.receivedAt}:${booking.id}`;
    await env.BOOKINGS.put(key, JSON.stringify(booking), { expirationTtl: 60 * 60 * 24 * 180 });
    return true;
  } catch (error) {
    console.error("archive_failed", error && error.message);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

export function composeEmail(booking) {
  const day = booking.date
    ? DAY_NAMES[new Date(`${booking.date}T00:00:00Z`).getUTCDay()]
    : "";
  const dateLabel = booking.flexible
    ? booking.date
      ? `${booking.date} (${day}) — flexible`
      : "Flexible — suggest a date"
    : `${booking.date} (${day})`;
  const timeLabel = booking.flexible
    ? booking.time || "Flexible — suggest a time"
    : booking.time;

  const subject = `New booking · ${booking.name} · ${
    booking.flexible ? "flexible" : `${booking.date} ${booking.time}`
  }`;

  const rows = [
    ["Name", booking.name],
    ["Mobile", booking.phone],
    ["Email", booking.email || "—"],
    ["Treatment", booking.treatment],
    ["Patient", booking.firstVisit],
    ["Date", dateLabel],
    ["Time", timeLabel],
    ["Notes", booking.notes || "—"],
  ];

  const text = [
    "New appointment request — Denta Cure Dental Clinic",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `Request ID: ${booking.id}`,
    "Sent from the website booking form.",
  ].join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #e8ece2;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6e4a;vertical-align:top;width:34%">${escapeHtml(label)}</td>
          <td style="padding:9px 0;border-bottom:1px solid #e8ece2;font-size:15px;line-height:1.5;color:#2a3a44">${escapeHtml(String(value)).replace(/\n/g, "<br>")}</td>
        </tr>`
    )
    .join("");

  const phoneHref = `tel:${booking.phone.replace(/[^\d+]/g, "")}`;
  const mailHref = booking.email ? `mailto:${encodeURIComponent(booking.email)}` : "";

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f7f1;">
  <div style="padding:28px 14px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e3e8db;overflow:hidden;">
      <tr>
        <td style="background:#2a3a44;padding:22px 26px;">
          <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#a9bc97;">Denta Cure Dental Clinic</div>
          <div style="margin-top:6px;font-size:22px;font-weight:600;color:#ffffff;">New appointment request</div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 26px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            ${htmlRows}
          </table>
          <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#5e6c74;">
            Reply to this email${
              booking.email ? " or tap the patient's address above" : ""
            } to confirm the slot. Call or text
            <a href="${phoneHref}" style="color:#2a3a44;font-weight:600;">${escapeHtml(booking.phone)}</a>.
          </p>
          ${
            mailHref
              ? `<p style="margin:10px 0 0;"><a href="${escapeHtml(mailHref)}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#99ac86;color:#1f2c34;font-size:13px;font-weight:600;text-decoration:none;">Email the patient</a></p>`
              : ""
          }
        </td>
      </tr>
      <tr>
        <td style="padding:16px 26px 22px;font-size:11px;line-height:1.7;color:#8a969d;">
          Request ${escapeHtml(booking.id)}<br>
          Sent from the Denta Cure website booking form.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

async function deliver(env, booking) {
  if (!env.RESEND_API_KEY) return { configured: false, sent: false };

  const to = String(env.BOOKING_TO || "my.dentacure@gmail.com")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const from = env.BOOKING_FROM || "Denta Cure Website <onboarding@resend.dev>";
  const endpoint = env.RESEND_API_URL || "https://api.resend.com/emails";
  const { subject, text, html } = composeEmail(booking);

  const payload = { from, to, subject, text, html };
  if (booking.email) payload.reply_to = booking.email;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error("resend_unreachable", error && error.message);
    return { configured: true, sent: false };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("resend_rejected", response.status, detail.slice(0, 300));
    return { configured: true, sent: false, status: response.status };
  }

  const result = await response.json().catch(() => ({}));
  return { configured: true, sent: true, id: result && result.id };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, code: "unsupported_media_type" }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, code: "payload_too_large" }, 413);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ ok: false, code: "invalid_json" }, 400);
  }

  // Honeypot: browsers never fill this, bots usually do. Pretend success.
  if (typeof data.company === "string" && data.company.trim() !== "") {
    return json({ ok: true, id: null, delivered: false });
  }

  const { ok, errors, booking } = validateBooking(data);
  if (!ok) {
    return json({ ok: false, code: "invalid", errors }, 400);
  }

  const ip =
    request.headers.get("cf-connecting-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";

  const limit = await checkRateLimit(env, ip);
  if (!limit.ok) {
    return json({ ok: false, code: "rate_limited" }, 429, { "retry-after": "120" });
  }

  const result = await deliver(env, booking);

  if (!result.configured) {
    return json({ ok: false, code: "not_configured" }, 503);
  }
  if (!result.sent) {
    return json({ ok: false, code: "send_failed" }, 502);
  }

  const archived = await archive(env, booking);
  console.log(
    JSON.stringify({
      event: "booking_delivered",
      id: booking.id,
      archived,
      date: booking.date || null,
      flexible: booking.flexible,
    })
  );

  return json({ ok: true, id: booking.id, delivered: true });
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { allow: "POST, OPTIONS", "cache-control": "no-store" },
    });
  }
  return json({ ok: false, code: "method_not_allowed" }, 405, { allow: "POST, OPTIONS" });
}
