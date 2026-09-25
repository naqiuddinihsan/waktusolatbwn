/*
File Name: script.js
Version: 9.0.0
Description: Hardcoded badge arrays to prevent JSON crashes, and pure text button toggles.
*/

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

const GITHUB_JSON_URL = "https://raw.githubusercontent.com/naqiuddinihsan/waktu-solat-brunei/main/brunei_prayers.json";

let currentLang = "ms";
let visualsEnabled = localStorage.getItem('bwn_visuals') === 'true';

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
    districts: [
      { val: 0, text: "Brunei-Muara" },
      { val: 3, text: "Belait (+3 min)" },
      { val: 1, text: "Tutong (+1 min)" },
      { val: 0, text: "Temburong" }
    ],
    prayers: { imsak: "Imsak", subuh: "Subuh", syuruk: "Syuruk", duha: "Duha", zuhur: "Zuhur", asar: "Asar", maghrib: "Maghrib", isya: "Isya'" },
    details: {
      subuh: { desc: "Solat Sunat Qabliyah Subuh amat dituntut.", benefit: "'Dua rakaat Fajar lebih baik dari dunia dan seisinya' (HR. Muslim).", source: "Hadis Sahih Muslim, No. 725" },
      zuhur: { desc: "Bermula bila matahari tergelincir dari puncak langit.", benefit: "Allah haramkan api neraka bagi yang memelihara 4 rakaat sebelum dan selepas Zuhur.", source: "Sunan Tirmizi, No. 428" },
      asar: { desc: "Waktu solat pertengahan yang disejukkan.", benefit: "Siapa menunaikan solat Subuh dan Asar dijanjikan syurga (HR. Bukhari & Muslim).", source: "Sahih al-Bukhari, No. 574" },
      maghrib: { desc: "Bermula sejurus matahari terbenam sepenuhnya.", benefit: "Solat Sunat Ba'diyyah Maghrib mendatangkan keberkatan dan cahaya malam.", source: "Al-Fiqh al-Manhaji" },
      isya: { desc: "Bermula selepas hilangnya mega merah di ufuk.", benefit: "Disunatkan menutup ibadah malam dengan Solat Sunat Witir.", source: "Sahih al-Bukhari, No. 998" },
      syuruk: { desc: "Detik matahari terbit di ufuk timur. Dilarang solat pada waktu ini.", benefit: "Dianjurkan berzikir hingga matahari naik untuk solat Sunat Duha.", source: "Pejabat Mufti Kerajaan Brunei" },
      duha: { desc: "Waktu pagi setelah matahari meninggi segalah hingga sebelum Zuhur.", benefit: "Mencukupi sedekah bagi seluruh 360 sendi tubuh badan.", source: "Hadis Sahih Muslim, No. 720" },
      imsak: { desc: "Waktu berjaga-jaga (~10 minit sebelum Subuh) untuk tamat sahur.", benefit: "Memastikan ibadah puasa dimulakan dengan penuh yakin dan tertib.", source: "KHEU Brunei" }
    }
  },
  en: {
    appTitle: "Waktu Solat BWN",
    nowLabel: "Now:",
    enteredAt: "Entered at",
    toNext: "to",
    localeDate: "en-GB",
    yesterdaySuffix: "(Last Night)",
    tomorrowSuffix: "(Tomorrow)",
    districts: [
      { val: 0, text: "Brunei-Muara" },
      { val: 3, text: "Belait (+3 min)" },
      { val: 1, text: "Tutong (+1 min)" },
      { val: 0, text: "Temburong" }
    ],
    prayers: { imsak: "Imsak", subuh: "Fajr", syuruk: "Sunrise", duha: "Dhuha", zuhur: "Zuhr", asar: "Asr", maghrib: "Maghrib", isya: "Isha'" },
    details: {
      subuh: { desc: "Fajr marks the true dawn light on the horizon.", benefit: "'Two rak'ahs before Fajr are better than the entire world' (Sahih Muslim).", source: "Sahih Muslim, No. 725" },
      zuhur: { desc: "Starts after the sun passes its highest point.", benefit: "Maintaining Sunnah prayers around Zuhr shields against the Hellfire.", source: "Sunan Tirmidhi, No. 428" },
      asar: { desc: "The middle prayer during afternoon hours.", benefit: "Whoever guards Fajr and Asr enters Paradise without delay.", source: "Sahih al-Bukhari, No. 574" },
      maghrib: { desc: "Begins immediately upon sunset until dusk fades.", benefit: "Performing Sunnah rak'ahs after Maghrib brings divine peace into the home.", source: "Al-Fiqh al-Manhaji" },
      isya: { desc: "Commences once the twilight glow completely fades.", benefit: "The Prophet SAW encouraged concluding night prayers with Witr.", source: "Sahih al-Bukhari, No. 998" },
      syuruk: { desc: "The exact sunrise interval. Voluntary prayers are prohibited.", benefit: "Engage in morning remembrance until Dhuha time begins.", source: "State Mufti Department Brunei" },
      duha: { desc: "From mid-morning until shortly before Zuhr.", benefit: "Suffices as daily charity for every joint in your body.", source: "Sahih Muslim, No. 720" },
      imsak: { desc: "Precautionary interval (~10 mins before Fajr) to conclude Sahur.", benefit: "Allows fasting to begin with accuracy and reassurance.", source: "MORA Brunei" }
    }
  }
};

const ALL_KEYS = ["imsak", "subuh", "syuruk", "duha", "zuhur", "asar", "maghrib", "isya"];

let cachedSchedule = { imsak: "04:42", subuh: "04:52", syuruk: "06:09", duha: "06:31", zuhur: "12:13", asar: "15:22", maghrib: "18:15", isya: "19:24" };
let hijrahString = "13 Rabiulakhir 1448 H";

function timeStringToMinutes(str) {
  if (!str) return 0;
  const parts = str.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesToDisplay(mins) {
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
  if (toggleBtn) {
    toggleBtn.textContent = visualsEnabled ? "BG ON" : "BG OFF";
  }
  if (visualsEnabled) {
    document.body.classList.remove('visuals-off');
  } else {
    document.body.classList.add('visuals-off');
  }
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
  setText("ui-now-label", t.nowLabel);

  let sel = document.getElementById("district-select");
  let savedIndex = sel ? sel.selectedIndex : 0;
  populateDistricts();
  if (sel) sel.selectedIndex = savedIndex > -1 ? savedIndex : 0;

  setDateHeaders();
  updateTick();
}

function getAdjustedSchedule() {
  const adjusted = {};
  const sel = document.getElementById("district-select");
  const offset = parseInt((sel ? sel.value : 0) || 0, 10);
  ALL_KEYS.forEach(function(key) {
    let baseMins = timeStringToMinutes(cachedSchedule[key]);
    adjusted[key] = baseMins + offset;
  });
  return adjusted;
}

function openPrayerModal(key) {
  vibrateTap();
  const t = I18N[currentLang];
  const prayerName = t.prayers[key];
  const detail = t.details[key] || { desc: "-", benefit: "-", source: "-" };
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

function closeModal(event) {
  if (!event || event.target.id === "info-modal" || event.target.classList.contains("modal-close-btn")) {
    const modal = document.getElementById("info-modal");
    if (modal) modal.classList.remove("is-visible");
  }
}

function renderPrayerList(adjustedTimes, activeKey) {
  const list = document.getElementById("prayer-list-container");
  if (!list) return;
  list.innerHTML = "";

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const t = I18N[currentLang];

  // Crash-Proof Hardcoded Fiqh Badges
  const sequence = [
    { key: "imsak", type: "secondary" },
    { key: "subuh", type: "fardhu", badges: [{ text: "Qabliyyah &#10003;", type: "is-ok" }, { text: "Ba'diyyah &#10007;", type: "is-haram" }] },
    { key: "syuruk", type: "secondary" },
    { key: "duha", type: "secondary" },
    { key: "zuhur", type: "fardhu", badges: [{ text: "Qabliyyah &#10003;", type: "is-ok" }, { text: "Ba'diyyah &#10003;", type: "is-ok" }] },
    { key: "asar", type: "fardhu", badges: [{ text: "Qabliyyah &#10003;", type: "is-ok" }, { text: "Ba'diyyah &#10007;", type: "is-haram" }] },
    { key: "maghrib", type: "fardhu", badges: [{ text: "Qabliyyah &#10003;", type: "is-ok" }, { text: "Ba'diyyah &#10003;", type: "is-ok" }] },
    { key: "isya", type: "fardhu", badges: [{ text: "Qabliyyah &#10003;", type: "is-ok" }, { text: "Ba'diyyah &#10003;", type: "is-ok" }, { text: "Witir &#10003;", type: "is-ok" }] }
  ];

  sequence.forEach(function(item) {
    const row = document.createElement("div");
    row.className = "prayer-row is-" + item.type;

    const prayerMins = adjustedTimes[item.key];
    const prayerName = t.prayers[item.key];

    if (item.key === activeKey) {
      row.classList.add("is-active");
    } else if (prayerMins < currentMinutes) {
      row.classList.add("is-past");
    }

    row.addEventListener('click', () => openPrayerModal(item.key));

    let badgesHtml = '';
    if (item.badges) {
      item.badges.forEach(b => {
        badgesHtml += '<span class="fiqh-badge ' + b.type + '">' + b.text + '</span>';
      });
    }

    const nameClass = item.type === "fardhu" ? "row-left-fardhu" : "row-left-sec";
    const timeClass = item.type === "fardhu" ? "row-right-fardhu" : "row-right-sec";

    row.innerHTML =
      '<div class="' + nameClass + '">' + prayerName + '</div>' +
      '<div class="row-mid">' + badgesHtml + '</div>' +
      '<div class="' + timeClass + '">' + minutesToDisplay(prayerMins) + '</div>';

    list.appendChild(row);
  });
}

function determinePrayerState(adjustedTimes) {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const currentSecs = now.getSeconds();
  const t = I18N[currentLang];

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

  const subuhMins = adjustedTimes.subuh;
  const syurukMins = adjustedTimes.syuruk;
  const zuhurMins = adjustedTimes.zuhur;
  const asarMins = adjustedTimes.asar;
  const maghribMins = adjustedTimes.maghrib;
  const isyaMins = adjustedTimes.isya;

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

  if (!state.active || !state.next) return;

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

  const now = new Date();
  const nhh = String(now.getHours()).padStart(2, '0');
  const nmm = String(now.getMinutes()).padStart(2, '0');
  const nsTimeEl = document.getElementById("ns-time");
  if (nsTimeEl) nsTimeEl.innerHTML = `${nhh}<span class="blink-colon">:</span>${nmm}`;
  setText("ns-next", countdownString);

  renderPrayerList(adjustedTimes, state.active.key);
  updateSkyVisuals(adjustedTimes, state.currentMinutes);
}

function setDateHeaders() {
  const now = new Date();
  const gregorianOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
  const dateStr = now.toLocaleDateString(I18N[currentLang].localeDate, gregorianOptions) + " | " + hijrahString;
  setText("gregorian-date", dateStr);
  setText("ns-date", dateStr);
}

function fetchRemoteData() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const dateKey = day + "-" + month + "-" + year;

  fetch(GITHUB_JSON_URL)
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(data => {
      if (data && data[dateKey]) {
        cachedSchedule = {
          imsak: data[dateKey].imsak, subuh: data[dateKey].subuh, syuruk: data[dateKey].syuruk,
          duha: data[dateKey].duha, zuhur: data[dateKey].zuhur, asar: data[dateKey].asar,
          maghrib: data[dateKey].maghrib, isya: data[dateKey].isya
        };
        if (data[dateKey].date_hijrah) {
          hijrahString = data[dateKey].date_hijrah;
          setDateHeaders();
        }
        updateTick();
      }
    })
    .catch(() => console.warn("Using offline fallback schedule"));
}

function initApp() {
  const toggleBtn = document.getElementById('visuals-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleVisuals);
  }
  applyVisualState();
  setLanguage("ms");
  fetchRemoteData();
  setInterval(updateTick, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
