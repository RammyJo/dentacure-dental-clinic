/* ==========================================================================
   Denta Cure Dental Clinic — interactions
   Vanilla JS. No dependencies.
   ========================================================================== */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     Year
  ------------------------------------------------------------------ */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------------
     Scroll progress + sticky header state
  ------------------------------------------------------------------ */
  const progress = $("#scrollProgress");
  const header = $("#siteHeader");
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
      if (header) header.classList.toggle("is-scrolled", y > 12);
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------
     Mobile menu
  ------------------------------------------------------------------ */
  const menuToggle = $("#menuToggle");
  const mobileMenu = $("#mobileMenu");
  const body = document.body;
  let lastFocused = null;

  function setMenu(open) {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (header) header.classList.toggle("menu-open", open);
    mobileMenu.classList.toggle("is-open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    body.classList.toggle("menu-open", open);

    if (open) {
      lastFocused = document.activeElement;
      const first = mobileMenu.querySelector("a");
      if (first) setTimeout(() => first.focus(), 120);
    } else if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      setMenu(!mobileMenu.classList.contains("is-open"));
    });
  }

  if (mobileMenu) {
    $$("a", mobileMenu).forEach((link) => link.addEventListener("click", () => setMenu(false)));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileMenu && mobileMenu.classList.contains("is-open")) {
      setMenu(false);
      menuToggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && mobileMenu && mobileMenu.classList.contains("is-open")) setMenu(false);
  });

  /* ------------------------------------------------------------------
     Active nav link
  ------------------------------------------------------------------ */
  const navLinks = $$(".nav-links a");
  const sectionIds = ["treatments", "clinic", "standard", "stories", "visit"];
  const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = `#${entry.target.id}`;
          navLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === id);
          });
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );
    sections.forEach((section) => navObserver.observe(section));
  }

  /* ------------------------------------------------------------------
     Reveal on scroll
  ------------------------------------------------------------------ */
  const revealItems = $$("[data-reveal]");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealItems.forEach((el) => revealObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     Counters
  ------------------------------------------------------------------ */
  const counters = $$("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = Number(el.dataset.count) || 0;
          if (prefersReduced) {
            el.textContent = target.toLocaleString("en-US");
          } else {
            const start = performance.now();
            const duration = 1500;
            const tick = (now) => {
              const t = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - t, 3);
              el.textContent = Math.round(target * eased).toLocaleString("en-US");
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
          counterObserver.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => counterObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     Opening hours — live, Asia/Manila
  ------------------------------------------------------------------ */
  function manilaNow() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());

      const get = (type) => parts.find((p) => p.type === type)?.value;
      const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return {
        day: dayMap[get("weekday")] ?? new Date().getDay(),
        minutes: Number(get("hour")) * 60 + Number(get("minute")),
      };
    } catch {
      const d = new Date();
      return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function formatMinutes(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function openStatus() {
    const { day, minutes } = manilaNow();
    const sunday = day === 0;
    const openAt = sunday ? 13 * 60 : 9 * 60;
    const closeAt = sunday ? 18 * 60 : 17 * 60 + 30;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    if (minutes >= openAt && minutes < closeAt) {
      return { open: true, text: `Open now · closes ${formatMinutes(closeAt)}` };
    }

    if (minutes < openAt) {
      return { open: false, text: `Closed · opens ${formatMinutes(openAt)}` };
    }

    for (let add = 1; add <= 7; add += 1) {
      const nextDay = (day + add) % 7;
      const nextOpen = nextDay === 0 ? 13 * 60 : 9 * 60;
      if (add === 1) return { open: false, text: `Closed · opens tomorrow ${formatMinutes(nextOpen)}` };
      return { open: false, text: `Closed · opens ${dayNames[nextDay]} ${formatMinutes(nextOpen)}` };
    }

    return { open: false, text: "Closed · opens soon" };
  }

  const status = openStatus();
  $$("[data-open-status]").forEach((el) => {
    el.classList.toggle("is-closed", !status.open);
    const textEl = el.querySelector("span:last-child") || el;
    textEl.textContent = status.text;
  });

  const today = manilaNow().day;
  $$(".hours-table tr[data-days]").forEach((row) => {
    const days = row.dataset.days.split(",").map(Number);
    row.classList.toggle("is-today", days.includes(today));
  });

  /* ------------------------------------------------------------------
     Service prefill (delegated)
  ------------------------------------------------------------------ */
  const defaultService = "General check-up & consultation";
  const picks = $$(".pick");
  const successPanel = $("#bookingSuccess");
  const bookingForm = $("#bookingForm");

  function setService(value) {
    let matched = false;
    picks.forEach((pick) => {
      const active = pick.dataset.pick === value;
      pick.classList.toggle("is-active", active);
      pick.setAttribute("aria-pressed", String(active));
      if (active) matched = true;
    });
    if (matched) state.service = value;
  }

  document.addEventListener("click", (event) => {
    const bookEl = event.target.closest("[data-book]");
    if (!bookEl) return;
    setService(bookEl.dataset.book);
    if (successPanel && !successPanel.hidden) {
      successPanel.hidden = true;
      if (bookingForm) bookingForm.hidden = false;
    }
    if (step !== 1) setStep(1);
  });

  /* ------------------------------------------------------------------
     Smile matcher
  ------------------------------------------------------------------ */
  const matches = {
    clean: {
      icon: "i-cleaning",
      kicker: "Preventive care · routine visit",
      title: "Oral prophylaxis",
      desc: "A professional clean removes the plaque and tartar that brushing can miss — the simplest way to keep small issues from becoming big ones.",
      service: "Oral prophylaxis (cleaning)",
    },
    stains: {
      icon: "i-sparkles",
      kicker: "Cosmetic care · consult first",
      title: "Teeth whitening",
      desc: "Professional whitening lifts surface stains and brightens your natural shade. We check your enamel and sensitivity first, so the result looks like you — only brighter.",
      service: "Teeth whitening",
    },
    crooked: {
      icon: "i-braces",
      kicker: "Smile planning · consultation",
      title: "Orthodontic treatment",
      desc: "Braces or aligners, planned around your bite and your day-to-day life. We'll talk through timelines, options and what progress will look like.",
      service: "Orthodontic consultation",
    },
    pain: {
      icon: "i-root",
      kicker: "Urgent assessment · exam first",
      title: "Root canal assessment",
      desc: "Constant or throbbing pain can mean the pulp is involved. We'll examine first, calm the discomfort, and only recommend a root canal if it's the right way to save the tooth.",
      service: "Root canal treatment",
    },
    cavity: {
      icon: "i-shield",
      kicker: "Restorative care · planned with you",
      title: "Tooth-coloured filling",
      desc: "A discreet composite restoration repairs chips and decay while keeping the tooth looking natural. Small problems are easiest — and kindest to your budget — when caught early.",
      service: "Tooth filling / restoration",
    },
    damaged: {
      icon: "i-extract",
      kicker: "Assessment first · we try to save it",
      title: "Gentle extraction",
      desc: "If a tooth is badly damaged, we'll check whether it can still be saved. If removal is the right call, we make it calm, numb and predictable — and explain the next step.",
      service: "Tooth extraction",
    },
    child: {
      icon: "i-child",
      kicker: "Little patients · big courage",
      title: "Children's dentistry",
      desc: "A first visit is mostly about trust: a look, a chat, a little fun. We coach kids through what's happening and keep parents close by the whole time.",
      service: "Children's dentistry",
    },
  };

  const matchChips = $$(".match-chip");
  const matchResult = $(".matcher-result");
  const matchIcon = $("#matchIcon");
  const matchKicker = $("#matchKicker");
  const matchTitle = $("#matchTitle");
  const matchDesc = $("#matchDesc");
  const matchCta = $("#matchCta");

  function applyMatch(key) {
    const data = matches[key];
    if (!data) return;
    if (matchIcon) matchIcon.innerHTML = `<svg class="ico"><use href="#${data.icon}"></use></svg>`;
    if (matchKicker) matchKicker.textContent = data.kicker;
    if (matchTitle) matchTitle.textContent = data.title;
    if (matchDesc) matchDesc.textContent = data.desc;
    if (matchCta) {
      matchCta.dataset.book = data.service;
      matchCta.setAttribute("aria-label", `Book ${data.title}`);
    }
  }

  matchChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      matchChips.forEach((c) => {
        c.classList.remove("is-active");
        c.setAttribute("aria-pressed", "false");
      });
      chip.classList.add("is-active");
      chip.setAttribute("aria-pressed", "true");

      if (!matchResult) return;
      if (prefersReduced) {
        applyMatch(chip.dataset.match);
        return;
      }
      matchResult.classList.add("is-swapping");
      setTimeout(() => {
        applyMatch(chip.dataset.match);
        matchResult.classList.remove("is-swapping");
      }, 170);
    });
  });

  /* ------------------------------------------------------------------
     Gallery lightbox
  ------------------------------------------------------------------ */
  const galleryItems = $$(".gallery-item");
  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightboxImg");
  const lightboxCaption = $("#lightboxCaption");
  const lightboxCount = $("#lightboxCount");
  let galleryIndex = 0;

  function showPhoto(index) {
    if (!galleryItems.length || !lightboxImg) return;
    galleryIndex = (index + galleryItems.length) % galleryItems.length;
    const item = galleryItems[galleryIndex];
    lightboxImg.src = item.dataset.full;
    lightboxImg.alt = item.querySelector("img")?.alt || "";
    if (lightboxCaption) lightboxCaption.textContent = item.dataset.caption || "";
    if (lightboxCount) lightboxCount.textContent = `${galleryIndex + 1} / ${galleryItems.length}`;
  }

  function openLightbox(index) {
    if (!lightbox || typeof lightbox.showModal !== "function") return;
    showPhoto(index);
    lightbox.showModal();
    body.classList.add("menu-open");
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.close();
    body.classList.remove("menu-open");
  }

  galleryItems.forEach((item, index) => {
    item.addEventListener("click", () => openLightbox(index));
  });

  $("#lightboxClose")?.addEventListener("click", closeLightbox);
  $("#lightboxPrev")?.addEventListener("click", () => showPhoto(galleryIndex - 1));
  $("#lightboxNext")?.addEventListener("click", () => showPhoto(galleryIndex + 1));

  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  lightbox?.addEventListener("close", () => body.classList.remove("menu-open"));

  lightbox?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showPhoto(galleryIndex - 1);
    if (event.key === "ArrowRight") showPhoto(galleryIndex + 1);
  });

  /* ------------------------------------------------------------------
     FAQ accordion
  ------------------------------------------------------------------ */
  $$(".faq-item").forEach((item) => {
    const button = $(".faq-question", item);
    if (!button) return;
    button.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");
      $$(".faq-item").forEach((other) => {
        other.classList.remove("is-open");
        $(".faq-question", other)?.setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* ------------------------------------------------------------------
     Booking wizard
  ------------------------------------------------------------------ */
  const state = {
    service: defaultService,
    firstVisit: "yes",
    date: "",
    time: "",
    flexible: false,
  };

  let step = 1;

  const dateInput = $("#preferredDate");
  const flexibleInput = $("#flexibleDate");
  const timeGrid = $("#timeGrid");
  const sundayNote = $("#sundayNote");
  const step2Error = $("#step2Error");
  const step3Error = $("#step3Error");
  const consentError = $("#consentError");
  const nameInput = $("#fullName");
  const phoneInput = $("#phone");
  const emailInput = $("#email");
  const notesInput = $("#notes");
  const consentInput = $("#consent");
  const wizardBack = $("#wizardBack");
  const wizardNext = $("#wizardNext");
  const wizardSubmit = $("#wizardSubmit");
  const wizardCount = $("#wizardCount");
  const wizardBar = $("#wizardBar");
  const summaryEl = $("#bookingSummary");
  const successSummary = $("#successSummary");
  const emailAgain = $("#emailAgain");
  const copyButton = $("#copyRequest");
  const resetButton = $("#resetBooking");

  const times = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
  const timesSunday = ["1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

  function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function maxDateString() {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  if (dateInput) {
    dateInput.min = todayString();
    dateInput.max = maxDateString();
  }

  function parseDate(value) {
    if (!value) return null;
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDateLong(value) {
    const d = parseDate(value);
    if (!d) return "Flexible date";
    return d.toLocaleDateString("en-PH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function renderTimes() {
    if (!timeGrid) return;
    const d = parseDate(dateInput?.value || "");
    const isSunday = d?.getDay() === 0;
    const slots = isSunday ? timesSunday : times;
    timeGrid.innerHTML = "";
    slots.forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "time-slot";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(state.time === label));
      if (state.time === label) button.classList.add("is-active");
      button.addEventListener("click", () => {
        state.time = label;
        $$(".time-slot", timeGrid).forEach((b) => {
          b.classList.toggle("is-active", b === button);
          b.setAttribute("aria-pressed", String(b === button));
        });
        hideError(step2Error);
      });
      timeGrid.appendChild(button);
    });

    if (isSunday) {
      if (!timesSunday.includes(state.time)) state.time = "";
      if (sundayNote) sundayNote.hidden = false;
    } else if (sundayNote) {
      sundayNote.hidden = true;
    }
  }

  function hideError(el) {
    if (el) el.hidden = true;
  }

  function setStep(nextStep) {
    step = Math.min(3, Math.max(1, nextStep));

    $$(".form-step").forEach((panel) => {
      const active = Number(panel.dataset.step) === step;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });

    $$("[data-step-indicator]").forEach((indicator) => {
      const n = Number(indicator.dataset.stepIndicator);
      indicator.classList.toggle("is-active", n === step);
      indicator.classList.toggle("is-done", n < step);
    });

    if (wizardCount) wizardCount.textContent = `Step ${step} of 3`;
    if (wizardBar) wizardBar.style.width = `${(step / 3) * 100}%`;
    if (wizardBack) wizardBack.hidden = step === 1;
    if (wizardNext) wizardNext.hidden = step === 3;
    if (wizardSubmit) wizardSubmit.hidden = step !== 3;

    if (step === 3) updateSummary();
    hideError(step2Error);
    hideError(step3Error);
    hideError(consentError);
  }

  function updateSummary() {
    if (!summaryEl) return;
    const timeText = state.flexible && !state.time ? "Flexible — suggest a time" : state.time || "No time selected";
    const dateText = state.date
      ? `${formatDateLong(state.date)}${state.flexible ? " (flexible)" : ""}`
      : "Flexible date";
    summaryEl.innerHTML = `
      <div class="summary-row"><span>Treatment</span><strong>${escapeHtml(state.service)}</strong></div>
      <div class="summary-row"><span>Patient</span><strong>${state.firstVisit === "yes" ? "First visit" : "Returning patient"}</strong></div>
      <div class="summary-row"><span>Preferred date</span><strong>${escapeHtml(dateText)}</strong></div>
      <div class="summary-row"><span>Preferred time</span><strong>${escapeHtml(timeText)}</strong></div>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function validateStep2() {
    const date = dateInput?.value || "";
    const flexible = Boolean(flexibleInput?.checked);
    state.date = date;
    state.flexible = flexible;

    if (step2Error) {
      step2Error.textContent = "Please choose a date and a time, or let us know you're flexible.";
    }

    if (!date && !flexible) {
      if (step2Error) step2Error.hidden = false;
      return false;
    }

    if (date && !flexible && !state.time) {
      if (step2Error) step2Error.hidden = false;
      return false;
    }

    if (date) {
      const parsed = parseDate(date);
      if (parsed) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (parsed < today) {
          if (step2Error) {
            step2Error.textContent = "That date has already passed — please choose an upcoming day.";
            step2Error.hidden = false;
          }
          return false;
        }
      }
    }

    return true;
  }

  function validateStep3() {
    let valid = true;
    const name = nameInput?.value.trim() || "";
    const phone = phoneInput?.value.trim() || "";
    const email = emailInput?.value.trim() || "";

    if (name.length < 2 || phone.replace(/\D/g, "").length < 7) {
      if (step3Error) step3Error.hidden = false;
      valid = false;
    } else if (step3Error) {
      step3Error.hidden = true;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (step3Error) {
        step3Error.textContent = "That email address doesn't look quite right — please check it.";
        step3Error.hidden = false;
      }
      valid = false;
    }

    if (!consentInput?.checked) {
      if (consentError) consentError.hidden = false;
      valid = false;
    } else if (consentError) {
      consentError.hidden = true;
    }

    return valid;
  }

  function requestBody() {
    const timeText = state.flexible && !state.time ? "Flexible — please suggest a time" : state.time || "Flexible";
    const dateText = state.date
      ? `${formatDateLong(state.date)}${state.flexible ? " (flexible)" : ""}`
      : "Flexible — please suggest a date";
    return [
      "Appointment request — Denta Cure Dental Clinic",
      "",
      `Name: ${nameInput?.value.trim() || ""}`,
      `Mobile: ${phoneInput?.value.trim() || ""}`,
      `Email: ${emailInput?.value.trim() || "—"}`,
      `Treatment: ${state.service}`,
      `Patient: ${state.firstVisit === "yes" ? "First visit" : "Returning patient"}`,
      `Preferred date: ${dateText}`,
      `Preferred time: ${timeText}`,
      `Notes: ${notesInput?.value.trim() || "—"}`,
      "",
      "Sent from the Denta Cure website.",
    ].join("\n");
  }

  function requestHref() {
    const subject = `Appointment request — ${state.service}`;
    return `mailto:my.dentacure@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(requestBody())}`;
  }

  function showSuccess() {
    if (!bookingForm || !successPanel) return;
    bookingForm.hidden = true;
    successPanel.hidden = false;

    if (successSummary) {
      const timeText = state.flexible && !state.time ? "Flexible — suggest a time" : state.time || "Flexible";
      const dateText = state.date
        ? `${formatDateLong(state.date)}${state.flexible ? " (flexible)" : ""}`
        : "Flexible date";
      successSummary.innerHTML = `
        <div class="summary-row"><span>Treatment</span><strong>${escapeHtml(state.service)}</strong></div>
        <div class="summary-row"><span>Date</span><strong>${escapeHtml(dateText)}</strong></div>
        <div class="summary-row"><span>Time</span><strong>${escapeHtml(timeText)}</strong></div>
        <div class="summary-row"><span>Name</span><strong>${escapeHtml(nameInput?.value.trim() || "")}</strong></div>
      `;
    }

    if (emailAgain) emailAgain.href = requestHref();
    successPanel.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
  }

  function resetBooking() {
    if (bookingForm) {
      bookingForm.hidden = false;
      bookingForm.reset();
    }
    if (successPanel) successPanel.hidden = true;

    state.service = defaultService;
    state.firstVisit = "yes";
    state.date = "";
    state.time = "";
    state.flexible = false;

    picks.forEach((pick) => {
      const active = pick.dataset.pick === defaultService;
      pick.classList.toggle("is-active", active);
      pick.setAttribute("aria-pressed", String(active));
    });
    $$(".toggle").forEach((toggle) => {
      const active = toggle.dataset.first === "yes";
      toggle.classList.toggle("is-active", active);
      toggle.setAttribute("aria-pressed", String(active));
    });
    if (dateInput) dateInput.value = "";
    if (flexibleInput) flexibleInput.checked = false;
    if (consentInput) consentInput.checked = false;
    renderTimes();
    setStep(1);
  }

  picks.forEach((pick) => {
    pick.addEventListener("click", () => {
      picks.forEach((p) => {
        p.classList.remove("is-active");
        p.setAttribute("aria-pressed", "false");
      });
      pick.classList.add("is-active");
      pick.setAttribute("aria-pressed", "true");
      state.service = pick.dataset.pick;
    });
  });

  $$(".toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      $$(".toggle").forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-pressed", "false");
      });
      toggle.classList.add("is-active");
      toggle.setAttribute("aria-pressed", "true");
      state.firstVisit = toggle.dataset.first;
    });
  });

  dateInput?.addEventListener("change", () => {
    state.date = dateInput.value;
    state.time = "";
    renderTimes();
    hideError(step2Error);
  });

  flexibleInput?.addEventListener("change", () => {
    state.flexible = flexibleInput.checked;
    hideError(step2Error);
  });

  wizardNext?.addEventListener("click", () => {
    if (step === 1) {
      setStep(2);
      renderTimes();
      return;
    }
    if (step === 2 && validateStep2()) {
      setStep(3);
    }
  });

  wizardBack?.addEventListener("click", () => {
    if (step === 2) state.date = dateInput?.value || "";
    setStep(step - 1);
  });

  bookingForm?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || step === 3) return;
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      event.preventDefault();
      wizardNext?.click();
    }
  });

  bookingForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateStep3()) return;
    const href = requestHref();
    if (emailAgain) emailAgain.href = href;
    window.location.href = href;
    showSuccess();
  });

  copyButton?.addEventListener("click", async () => {
    const text = requestBody();
    const done = () => {
      const original = copyButton.textContent;
      copyButton.textContent = "Copied ✓";
      setTimeout(() => {
        copyButton.textContent = original;
      }, 2200);
    };
    try {
      await navigator.clipboard.writeText(text);
      done();
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        done();
      } catch {
        /* Clipboard not available — leave the button unchanged. */
      }
      area.remove();
    }
  });

  resetButton?.addEventListener("click", resetBooking);

  renderTimes();
  setStep(1);

  /* ------------------------------------------------------------------
     Subtle hero parallax (fine pointers only)
  ------------------------------------------------------------------ */
  const heroFrame = $("#heroFrame");
  const hero = $(".hero");
  const canParallax =
    heroFrame && hero && !prefersReduced && window.matchMedia("(pointer: fine)").matches;

  if (canParallax) {
    let frame = 0;
    hero.addEventListener("pointermove", (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        heroFrame.style.transform = `perspective(1000px) rotateX(${(-y * 2.4).toFixed(2)}deg) rotateY(${(x * 3).toFixed(2)}deg) translate3d(${(x * 5).toFixed(2)}px, ${(y * 5).toFixed(2)}px, 0)`;
        frame = 0;
      });
    });
    hero.addEventListener("pointerleave", () => {
      heroFrame.style.transform = "";
    });
  }

  /* ------------------------------------------------------------------
     If an anchor is loaded with a hash, keep section clear of header
  ------------------------------------------------------------------ */
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: "auto", block: "start" }), 40);
    }
  }
})();
