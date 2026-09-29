/*
File Name: script.js
Version: 0.16.3
Description: Relocated Back to Today trigger, disabled modal event listeners temporarily.
*/

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

const PRAYERS_JSON_URL = "https://raw.githubusercontent.com/naqiuddinihsan/waktusolatbwn/main/data/brunei_prayers.json";
const FADHILAT_JSON_URL = "https://raw.githubusercontent.com/naqiuddinihsan/waktusolatbwn/main/data/fadhilat.json";

let currentLang = "ms";
let visualsEnabled = localStorage.getItem('bwn_visuals') === 'true';
let wakeLock = null;

let fullYearSchedule = {};
let fadhilatData = null;
let selectedDate = new Date();

const nightstandQuery = window.matchMedia('(orientation: landscape) and (max-height: 600px)');

async function evaluateWakeLock() {
  if (!('wakeLock' in navigator)) return;
  const isNightstand = nightstandQuery.matches;
  const isVisible = document.visibilityState === 'visible';

  if (isNightstand && isVisible) {
    if (wakeLock === null) {
      try { 
        wakeLock = await navigator.wakeLock.request('screen'); 
        console.log("Wake Lock acquired.");
      } catch (err) { console.warn('Wake Lock failed:', err.message); }
    }
  } else {
    if (wakeLock !== null) {
      wakeLock.release().then(() => { 
        wakeLock = null; 
        console.log("Wake Lock released.");
      });
    }
  }
}

nightstandQuery.addEventListener('change', evaluateWakeLock);
document.addEventListener('visibilitychange', evaluateWakeLock);
document.addEventListener('click', evaluateWakeLock);

const SVG_PULL = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="var(--text-secondary)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
const SVG_RELEASE = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="var(--text-secondary)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate(180deg);"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
const SVG_SPINNER = `<span class="ptr-spinner"></span>`;

function vibrateTap() {
  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch (e) {}
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

const I18N = {
  ms: {
    appTitle: "Waktu Solat BWN",
    nowLabel: "Sekarang:",
    enteredAt: "Masuk pada",
    toNext: "ke",
    localeDate: "ms-MY",
    yesterdaySuffix: "(Malam Tadi)",
    tomorrowSuffix: "(Esok)",
    viewingOtherDate: "Tarikh Pilihan:",
    resetToday: "Kembali ke Hari Ini", // Translated for the new prominent button
    noData: "Tiada Data",
    badges: { qabliyyah: "Qabliyyah", ba_diyyah: "Ba'diyyah", witir: "Witir", sunat: "Sunat" },
    districts: [
      { val: 0, text: "Brunei-Muara" },
      { val: 3, text: "Belait (+3 min)" },
      { val: 1, text: "Tutong (+1 min)" },
      { val: 0, text: "Temburong" }
    ],
    prayers: { imsak: "Imsak", subuh: "Subuh", syuruk: "Syuruk", duha: "Duha", zuhur: "Zuhur", asar: "Asar", maghrib: "Maghrib", isya: "Isya'" },
    about: { title: "Maklumat Aplikasi", sourceLabel: "Sumber Data Rasmi:", sourceName: "Kementerian Hal Ehwal Ugama (KHEU) Brunei", devLabel: "Dibangunkan oleh:", version: "Versi 0.16.3" }
  },
  en: {
    appTitle: "Waktu Solat BWN",
    nowLabel: "Now:",
    enteredAt: "Entered at",
    toNext: "to",
    localeDate: "en-GB",
    yesterdaySuffix: "(Last Night)",
    tomorrowSuffix: "(Tomorrow)",
    viewingOtherDate: "Selected Date:",
    resetToday: "Back to Today", // Translated for the new prominent button
    noData: "No Data Available",
    badges: { qabliyyah: "Qabliyyah", ba_diyyah: "Ba'diyyah", witir: "Witr", sunat: "Sunnah" },
    districts: [
      { val: 0, text: "Brunei-Muara" },
      { val: 3, text: "Belait (+3 min)" },
      { val: 1, text: "Tutong (+1 min)" },
      { val: 0, text: "Temburong" }
    ],
    prayers: { imsak: "Imsak", subuh: "Fajr", syuruk: "Sunrise", duha: "Dhuha", zuhur: "Zuhr", asar: "Asr", maghrib: "Maghrib", isya: "Isha'" },
    about: { title: "App Information", sourceLabel: "Official Data Source:", sourceName: "Ministry of Religious Affairs (MORA) Brunei", devLabel: "Developed by:", version: "Version 0.16.3" }
  }
};

const ALL_KEYS = ["imsak", "subuh", "syuruk", "duha", "zuhur", "asar", "maghrib", "isya"];

let cachedSchedule = {
  imsak: "04:42", subuh: "04:52", syuruk: "06:09", duha: "06:31",
  zuhur: "12:13", asar: "15:22", maghrib: "18:15", isya: "19:24"
};
let hijrahString = "13 Rabiulakhir 1448 H";

function timeStringToMinutes(str) {
  if (!str || str === "--:--") return NaN;
  const parts = str.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesToDisplay(mins) {
  if (isNaN(mins)) return "--:--";
  let normalized = (mins % 1440 + 1440) % 1440;
  let h = Math.floor(normalized / 60);
  let m = normalized % 60;
  let period = h >= 12 ? "PM" : "AM";
  let displayH = h % 12;
  displayH = displayH === 0 ? 12 : displayH;
  let displayM = m < 10 ? "0" + m : m;
  return displayH + ":" + displayM + " " + period;
}

function populateDistricts() {
  const sel = document.getElementById("district-select");
  if (!sel) return;
  const currentVal = sel.value || "0";
  sel.innerHTML = "";
  I18N[currentLang].districts.forEach(d => {
    let opt = document.createElement("option");
    opt.value = d.val;
    opt.textContent = d.text;
    if (d.val == currentVal) opt.selected = true;
    sel.appendChild(opt);
  });
}

function handleDistrictChange() {
  vibrateTap();
  updateTick();
}

function applyVisualState() {
  const toggleBtn = document.getElementById('visuals-toggle');
  if (toggleBtn) toggleBtn.textContent = visualsEnabled ? "BG ON" : "BG OFF";
  if (visualsEnabled) { document.body.classList.remove('visuals-off'); } 
  else { document.body.classList.add('visuals-off'); }
}

function toggleVisuals() {
  vibrateTap();
  visualsEnabled = !visualsEnabled;
  localStorage.setItem('bwn_visuals', visualsEnabled ? 'true' : 'false');
  applyVisualState();
  updateTick();
}

function setLanguage(lang) {
  vibrateTap();
  currentLang = lang;
  const btnMs = document.getElementById("lang-btn-ms");
  const btnEn = document.getElementById("lang-btn-en");
  if (btnMs) btnMs.classList.toggle("active", lang === "ms");
  if (btnEn) btnEn.classList.toggle("active", lang === "en");

  const t = I18N[currentLang];
  setText("ui-app-title", t.appTitle);
  document.title = t.appTitle;
  setText("reset-date-btn", t.resetToday);

  let sel = document.getElementById("district-select");
  let savedIndex = sel ? sel.selectedIndex : 0;
  populateDistricts();
  if (sel) sel.selectedIndex = savedIndex > -1 ? savedIndex : 0;

  setText("about-title", t.about.title);
  const aboutBody = document.getElementById("about-body-content");
  if (aboutBody) {
    aboutBody.innerHTML = `
      <p><strong>${t.about.sourceLabel}</strong><br><a href="https://www.mora.gov.bn/SitePages/WaktuSembahyang.aspx" target="_blank">${t.about.sourceName}</a></p>
      <p><strong>${t.about.devLabel}</strong><br><a href="https://www.qwamii.com" target="_blank">Qwamii</a> / <a href="https://www.behance.net/naqiuddinihsan" target="_blank">Naqiuddin Ihsan</a></p>
      <p class="about-version">${t.about.version}</p>
    `;
  }
  setDateHeaders();
  updateTick();
}

function checkDateStatus() {
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const resetBtnWrapper = document.getElementById('return-today-wrapper');
  const heroCard = document.getElementById('hero-tracker-card');
  const dateStacked = document.querySelector('.date-stacked');

  if (isToday) {
    if(resetBtnWrapper) resetBtnWrapper.classList.remove('is-visible');
    if(dateStacked) dateStacked.classList.remove('is-not-today');
    if(heroCard) heroCard.classList.remove('is-collapsed');
  } else {
    if(resetBtnWrapper) resetBtnWrapper.classList.add('is-visible');
    if(dateStacked) dateStacked.classList.add('is-not-today');
    if(heroCard) heroCard.classList.add('is-collapsed'); 
  }
}

function handleDateChange(e) {
  if (e.target.value) {
    const [y, m, d] = e.target.value.split('-');
    selectedDate = new Date(y, m - 1, d);
    animateDateUpdate();
  }
}

function resetDateToToday() {
  vibrateTap();
  selectedDate = new Date();
  document.getElementById('native-date-input').value = "";
  animateDateUpdate();
}

function animateDateUpdate() {
  const list = document.getElementById("prayer-list-container");
  if (list) list.classList.add("is-updating");
  
  setTimeout(() => {
    syncScheduleToSelectedDate();
    if (list) list.classList.remove("is-updating");
  }, 150);
}

function applyDatePickerLimits() {
  const keys = Object.keys(fullYearSchedule);
  if (keys.length > 0) {
    const parsedDates = keys.map(k => {
      const [d, m, y] = k.split('-');
      return new Date(y, m - 1, d);
    });
    parsedDates.sort((a, b) => a - b);
    
    const formatForInput = (dateObj) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    const input = document.getElementById("native-date-input");
    if (input) {
      input.min = formatForInput(parsedDates[0]);
      input.max = formatForInput(parsedDates[parsedDates.length - 1]);
    }
  }
}

function syncScheduleToSelectedDate() {
  const day = String(selectedDate.getDate()).padStart(2, "0");
  const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const year = selectedDate.getFullYear();
  const dateKey = `${day}-${month}-${year}`;
  const t = I18N[currentLang];

  if (fullYearSchedule && fullYearSchedule[dateKey]) {
    cachedSchedule = fullYearSchedule[dateKey];
    hijrahString = fullYearSchedule[dateKey].date_hijrah || hijrahString;
  } else {
    console.warn("Offline/Missing data for chosen date: " + dateKey);
    cachedSchedule = {
      imsak: "--:--", subuh: "--:--", syuruk: "--:--", duha: "--:--",
      zuhur: "--:--", asar: "--:--", maghrib: "--:--", isya: "--:--"
    };
    hijrahString = t.noData;
  }
  setDateHeaders();
  checkDateStatus();
  updateTick();
}

function getAdjustedSchedule() {
  const adjusted = {};
  const sel = document.getElementById("district-select");
  const offset = parseInt((sel ? sel.value : 0) || 0, 10);
  ALL_KEYS.forEach(function(key) {
    if (cachedSchedule[key] === "--:--") {
      adjusted[key] = NaN;
    } else {
      let baseMins = timeStringToMinutes(cachedSchedule[key]);
      adjusted[key] = baseMins + offset;
    }
  });
  return adjusted;
}

function openPrayerModal(key) {
  vibrateTap();
  const t = I18N[currentLang];
  const prayerName = t.prayers[key];
  
  let detail = { desc: "-", benefit: "-", source: "-" };
  if (fadhilatData && fadhilatData[currentLang] && fadhilatData[currentLang][key]) {
    detail = fadhilatData[currentLang][key];
  }

  const adjustedTimes = getAdjustedSchedule();
  const timeStr = minutesToDisplay(adjustedTimes[key]);

  const modalTitle = document.getElementById("modal-title");
  if (modalTitle) modalTitle.textContent = prayerName + " (" + timeStr + ")";

  let bodyHtml =
    '<p class="modal-desc"><strong>Waktu:</strong> ' + timeStr + '</p>' +
    '<p class="modal-desc">' + detail.desc + '</p>' +
    '<div class="modal-benefit-box">' +
      '<strong>Kelebihan / Fadilat:</strong><br>' + detail.benefit +
    '</div>' +
    '<p class="modal-source"><strong>Sumber Rujukan:</strong> ' + detail.source + '</p>';

  const modalBody = document.getElementById("modal-body-content");
  if (modalBody) modalBody.innerHTML = bodyHtml;

  const modal = document.getElementById("info-modal");
  if (modal) modal.classList.add("is-visible");
}

function openAboutModal() {
  vibrateTap();
  const modal = document.getElementById("about-modal");
  if (modal) modal.classList.add("is-visible");
}

function closeModal(event) {
  const modal = document.getElementById("info-modal");
  if (modal) modal.classList.remove("is-visible");
}

function closeAboutModal(event) {
  const modal = document.getElementById("about-modal");
  if (modal) modal.classList.remove("is-visible");
}

function renderPrayerList(adjustedTimes, activeKey) {
  const list = document.getElementById("prayer-list-container");
  if (!list) return;
  list.innerHTML = "";

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = selectedDate.toDateString() === now.toDateString();
  const b = I18N[currentLang].badges;

  const sequence = [
    { key: "imsak", type: "secondary" },
    { key: "subuh", type: "fardhu", badges: [{ text: b.qabliyyah + " &#10003;", type: "is-ok" }, { text: b.ba_diyyah + " &#10007;", type: "is-haram" }] },
    { key: "syuruk", type: "secondary" },
    { key: "duha", type: "secondary", badges: [{ text: b.sunat + " &#10003;", type: "is-ok" }] },
    { key: "zuhur", type: "fardhu", badges: [{ text: b.qabliyyah + " &#10003;", type: "is-ok" }, { text: b.ba_diyyah + " &#10003;", type: "is-ok" }] },
    { key: "asar", type: "fardhu", badges: [{ text: b.qabliyyah + " &#10003;", type: "is-ok" }, { text: b.ba_diyyah + " &#10007;", type: "is-haram" }] },
    { key: "maghrib", type: "fardhu", badges: [{ text: b.qabliyyah + " &#10003;", type: "is-ok" }, { text: b.ba_diyyah + " &#10003;", type: "is-ok" }] },
    { key: "isya", type: "fardhu", badges: [{ text: b.qabliyyah + " &#10003;", type: "is-ok" }, { text: b.ba_diyyah + " &#10003;", type: "is-ok" }, { text: b.witir + " &#10003;", type: "is-ok" }] }
  ];

  sequence.forEach(function(item) {
    const row = document.createElement("div");
    row.className = "prayer-row is-" + item.type;
    const prayerMins = adjustedTimes[item.key];
    const prayerName = I18N[currentLang].prayers[item.key];

    if (isToday && !isNaN(prayerMins)) {
      if (item.key === activeKey) { row.classList.add("is-active"); } 
      else if (prayerMins < currentMinutes) { row.classList.add("is-past"); }
    }

    // MODAL DISABLED TEMP: Uncomment the line below to restore Modal pop-ups.
    // row.addEventListener('click', () => openPrayerModal(item.key));

    let badgesHtml = '';
    if (item.badges) {
      item.badges.forEach(badge => { badgesHtml += `<span class="fiqh-badge ${badge.type}">${badge.text}</span>`; });
    }

    const nameClass = item.type === "fardhu" ? "row-left-fardhu" : "row-left-sec";
    const timeClass = item.type === "fardhu" ? "row-right-fardhu" : "row-right-sec";

    row.innerHTML =
      `<div class="${nameClass}">${prayerName}</div>` +
      `<div class="row-mid">${badgesHtml}</div>` +
      `<div class="${timeClass}">${minutesToDisplay(prayerMins)}</div>`;

    list.appendChild(row);
  });
}

function determinePrayerState(adjustedTimes) {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const currentSecs = now.getSeconds();
  const t = I18N[currentLang];

  if (isNaN(adjustedTimes["subuh"])) {
    return { active: null, next: null, currentMinutes: currentMins, currentSeconds: currentSecs };
  }

  const sequence = ALL_KEYS.map(key => ({ key: key, mins: adjustedTimes[key] }));

  let activeItem = null;
  let nextItem = null;

  if (currentMins < sequence[0].mins) {
    activeItem = { key: "isya", name: t.prayers["isya"] + " " + t.yesterdaySuffix, mins: sequence[sequence.length - 1].mins - 1440 };
    nextItem = { key: sequence[0].key, name: t.prayers[sequence[0].key], mins: sequence[0].mins };
  } else {
    for (let i = 0; i < sequence.length; i++) {
      if (i === sequence.length - 1) {
        activeItem = { key: sequence[i].key, name: t.prayers[sequence[i].key], mins: sequence[i].mins };
        nextItem = { key: sequence[0].key, name: t.prayers[sequence[0].key] + " " + t.tomorrowSuffix, mins: sequence[0].mins + 1440 };
      } else if (currentMins >= sequence[i].mins && currentMins < sequence[i + 1].mins) {
        activeItem = { key: sequence[i].key, name: t.prayers[sequence[i].key], mins: sequence[i].mins };
        nextItem = { key: sequence[i + 1].key, name: t.prayers[sequence[i + 1].key], mins: sequence[i + 1].mins };
        break;
      }
    }
  }

  return { active: activeItem, next: nextItem, currentMinutes: currentMins, currentSeconds: currentSecs };
}

function updateSkyVisuals(adjustedTimes, currentMins) {
  const skyBg = document.getElementById("sky-bg");
  const celestial = document.getElementById("celestial-body");
  const cloudsLayer = document.getElementById("clouds-layer");

  if (!skyBg || !celestial || !cloudsLayer) return;

  if (!visualsEnabled) {
    skyBg.style.background = "#050505";
    celestial.style.opacity = "0";
    cloudsLayer.style.opacity = "0";
    return;
  }

  const subuhMins = isNaN(adjustedTimes.subuh) ? 300 : adjustedTimes.subuh;
  const syurukMins = isNaN(adjustedTimes.syuruk) ? 360 : adjustedTimes.syuruk;
  const zuhurMins = isNaN(adjustedTimes.zuhur) ? 720 : adjustedTimes.zuhur;
  const asarMins = isNaN(adjustedTimes.asar) ? 900 : adjustedTimes.asar;
  const maghribMins = isNaN(adjustedTimes.maghrib) ? 1080 : adjustedTimes.maghrib;
  const isyaMins = isNaN(adjustedTimes.isya) ? 1140 : adjustedTimes.isya;

  let isDay = currentMins >= subuhMins && currentMins < maghribMins;
  celestial.style.opacity = "1";

  if (isDay) {
    cloudsLayer.style.opacity = "0.7";
    let dayDuration = Math.max(1, maghribMins - subuhMins);
    let dayProgress = Math.max(0, Math.min(1, (currentMins - subuhMins) / dayDuration));

    celestial.style.background = "radial-gradient(circle, #fffdf2 0%, #ffe484 50%, transparent 100%)";
    celestial.style.boxShadow = "0 0 50px 25px rgba(255, 228, 132, 0.45)";
    celestial.style.left = (5 + (dayProgress * 90)) + "vw";

    let heightMultiplier = Math.sin(dayProgress * Math.PI);
    celestial.style.top = (85 - (heightMultiplier * 70)) + "vh";

    if (currentMins >= subuhMins && currentMins < syurukMins) {
      skyBg.style.background = "linear-gradient(to bottom, #0f172a 0%, #312e81 50%, #db2777 100%)";
    } else if (currentMins >= syurukMins && currentMins < zuhurMins) {
      skyBg.style.background = "linear-gradient(to bottom, #0284c7 0%, #38bdf8 60%, #bae6fd 100%)";
    } else if (currentMins >= zuhurMins && currentMins < asarMins) {
      skyBg.style.background = "linear-gradient(to bottom, #0369a1 0%, #0ea5e9 100%)";
    } else if (currentMins >= asarMins && currentMins < maghribMins - 30) {
      skyBg.style.background = "linear-gradient(to bottom, #0284c7 0%, #60a5fa 100%)";
    } else {
      skyBg.style.background = "linear-gradient(to bottom, #4338ca 0%, #c2410c 65%, #9a3412 100%)";
    }
  } else {
    cloudsLayer.style.opacity = "0.15";
    let nightDuration = (1440 - maghribMins) + subuhMins;
    let elapsedNight = currentMins >= maghribMins ? (currentMins - maghribMins) : ((1440 - maghribMins) + currentMins);
    let nightProgress = Math.max(0, Math.min(1, elapsedNight / Math.max(1, nightDuration)));

    celestial.style.background = "radial-gradient(circle, #ffffff 0%, #cbd5e1 60%, transparent 100%)";
    celestial.style.boxShadow = "0 0 35px 12px rgba(255, 255, 255, 0.25)";
    celestial.style.left = (5 + (nightProgress * 90)) + "vw";

    let heightMultiplier = Math.sin(nightProgress * Math.PI);
    celestial.style.top = (80 - (heightMultiplier * 50)) + "vh";

    if (currentMins >= maghribMins && currentMins < isyaMins) {
      skyBg.style.background = "linear-gradient(to bottom, #090d16 0%, #1e1b4b 60%, #31102b 100%)";
    } else {
      skyBg.style.background = "linear-gradient(to bottom, #020617 0%, #000000 100%)";
    }
  }
}

function updateTick() {
  const adjustedTimes = getAdjustedSchedule();
  const state = determinePrayerState(adjustedTimes);
  const t = I18N[currentLang];
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const hasData = !isNaN(adjustedTimes["subuh"]);

  if (isToday) {
    if (!hasData) {
      setText("hero-current-name", t.noData);
      setText("hero-countdown-text", "--:--:--");
      setText("hero-current-range", "--:--");
      const progressFill = document.getElementById("hero-progress-fill");
      if (progressFill) progressFill.style.width = "0%";
    } else if (state.active && state.next) {
      setText("hero-current-name", state.active.name);
      let targetMins = state.next.mins;
      let currentTotalSecs = state.currentMinutes * 60 + state.currentSeconds;
      let targetTotalSecs = targetMins * 60;
      let diffSeconds = targetTotalSecs - currentTotalSecs;

      if (diffSeconds < 0) diffSeconds = 0;
      let hours = Math.floor(diffSeconds / 3600);
      let mins = Math.floor((diffSeconds % 3600) / 60);
      let secs = diffSeconds % 60;
      let hStr = hours < 10 ? "0" + hours : hours;
      let mStr = mins < 10 ? "0" + mins : mins;
      let sStr = secs < 10 ? "0" + secs : secs;

      let countdownString = hStr + ":" + mStr + ":" + sStr + " " + t.toNext + " " + state.next.name;
      setText("hero-countdown-text", countdownString);

      let activeMinsDisplay = adjustedTimes[state.active.key] ? minutesToDisplay(adjustedTimes[state.active.key]) : "-";
      setText("hero-current-range", t.enteredAt + " " + activeMinsDisplay);

      let startTotalSecs = state.active.mins * 60;
      let intervalSecs = targetTotalSecs - startTotalSecs;
      let progressPercent = 0;
      if (intervalSecs > 0) {
        let elapsedSecs = currentTotalSecs - startTotalSecs;
        progressPercent = Math.min(100, Math.max(0, (elapsedSecs / intervalSecs) * 100));
      }
      const progressFill = document.getElementById("hero-progress-fill");
      if (progressFill) progressFill.style.width = progressPercent.toFixed(1) + "%";
    }
  }

  const now = new Date();
  const nhh = String(now.getHours()).padStart(2, '0');
  const nmm = String(now.getMinutes()).padStart(2, '0');
  const nsTimeEl = document.getElementById("ns-time");
  if (nsTimeEl) nsTimeEl.innerHTML = `${nhh}<span class="blink-colon">:</span>${nmm}`;
  
  if (isToday && hasData && state.next) {
     setText("ns-next", document.getElementById("hero-countdown-text").textContent);
  } else {
     setText("ns-next", "-");
  }

  renderPrayerList(adjustedTimes, state.active ? state.active.key : null);
  const engineAdjustedTimes = getAdjustedSchedule();
  updateSkyVisuals(engineAdjustedTimes, (now.getHours() * 60) + now.getMinutes());
}

function setDateHeaders() {
  const gregorianOptions = { weekday: "long", day: "numeric", month: "short", year: "numeric" };
  const gregorianStr = selectedDate.toLocaleDateString(I18N[currentLang].localeDate, gregorianOptions);
  
  setText("gregorian-date", gregorianStr);
  setText("hijrah-date", hijrahString);
  setText("ns-date", gregorianStr + " | " + hijrahString);
}

function fetchRemoteData() {
  const prayerReq = fetch(PRAYERS_JSON_URL)
    .then(r => { if (!r.ok) throw new Error("Prayer fetch failed"); return r.json(); })
    .catch(e => null);

  const fadhilatReq = fetch(FADHILAT_JSON_URL)
    .then(r => { if (!r.ok) throw new Error("Fadhilat fetch failed"); return r.json(); })
    .catch(e => null);

  return Promise.all([prayerReq, fadhilatReq])
    .then(([prayers, fadhilat]) => {
      if (prayers) { 
        fullYearSchedule = prayers; 
        applyDatePickerLimits();
      } else { 
        console.warn("Prayer data empty/failed."); 
      }
      if (fadhilat) { fadhilatData = fadhilat; } 
      
      syncScheduleToSelectedDate();
    });
}

function initPullToRefresh() {
  const list = document.getElementById("prayer-list-container");
  const ptr = document.getElementById("ptr-indicator");
  if (!list || !ptr) return;

  let startY = 0;
  let isPulling = false;

  list.addEventListener('touchstart', (e) => {
    if (list.scrollTop === 0) {
      startY = e.touches[0].clientY;
      isPulling = true;
      ptr.style.transition = 'none';
    }
  }, { passive: true });

  list.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const dist = currentY - startY;
    
    if (dist > 0 && list.scrollTop === 0) {
      let ptrHeight = Math.min(dist * 0.4, 65);
      ptr.style.height = ptrHeight + 'px';
      if (ptrHeight >= 55) { ptr.innerHTML = SVG_RELEASE; } 
      else { ptr.innerHTML = SVG_PULL; }
    }
  }, { passive: true });

  const endPull = () => {
    if (!isPulling) return;
    isPulling = false;
    const currentHeight = parseInt(ptr.style.height || '0');
    ptr.style.transition = 'height 0.3s ease';
    
    if (currentHeight >= 55) {
      ptr.style.height = '40px';
      ptr.innerHTML = SVG_SPINNER;
      vibrateTap();
      fetchRemoteData().finally(() => { setTimeout(() => { ptr.style.height = '0px'; }, 600); });
    } else {
      ptr.style.height = '0px';
    }
  };

  list.addEventListener('touchend', endPull);
  list.addEventListener('touchcancel', endPull);
}

function bindEvents() {
  const toggleBtn = document.getElementById('visuals-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleVisuals);

  const btnMs = document.getElementById('lang-btn-ms');
  if (btnMs) btnMs.addEventListener('click', () => setLanguage('ms'));

  const btnEn = document.getElementById('lang-btn-en');
  if (btnEn) btnEn.addEventListener('click', () => setLanguage('en'));

  const distSel = document.getElementById('district-select');
  if (distSel) distSel.addEventListener('change', handleDistrictChange);

  const infoBtn = document.getElementById('info-btn-trigger');
  if (infoBtn) infoBtn.addEventListener('click', openAboutModal);
  
  const resetBtn = document.getElementById('reset-date-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetDateToToday);
  
  const dateInput = document.getElementById('native-date-input');
  if (dateInput) dateInput.addEventListener('change', handleDateChange);

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { closeModal(e); closeAboutModal(e); });
  });

  const infoModal = document.getElementById('info-modal');
  if (infoModal) infoModal.addEventListener('click', closeModal);

  const aboutModal = document.getElementById('about-modal');
  if (aboutModal) aboutModal.addEventListener('click', closeAboutModal);

  document.querySelectorAll('.modal-card').forEach(card => {
    card.addEventListener('click', (e) => e.stopPropagation());
  });
}

function initApp() {
  bindEvents();
  applyVisualState();
  setLanguage("ms");
  fetchRemoteData();
  initPullToRefresh();
  setInterval(updateTick, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
