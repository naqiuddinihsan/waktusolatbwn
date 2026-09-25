/*
File Name: script.js
Version: 6.1.0
Description: Core logic for Waktu Solat BWN. Handles prayer calculations, district offsets, i18n localization, dynamic celestial sky rendering, and interactive modal displays.
*/

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

const GITHUB_JSON_URL = "https://raw.githubusercontent.com/naqiuddinihsan/waktu-solat-brunei/main/brunei_prayers.json";

let currentLang = "ms";
let visualsEnabled = false; 

if (localStorage.getItem('bwn_visuals') !== null) {
  visualsEnabled = localStorage.getItem('bwn_visuals') === 'true';
} else {
  localStorage.setItem('bwn_visuals', 'false');
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('visuals-toggle');
  if (btn) btn.textContent = visualsEnabled ? "☀️" : "🌙";
});

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
    prayers: {
      imsak: "Imsak", subuh: "Subuh", syuruk: "Syuruk", duha: "Duha",
      zuhur: "Zuhur", asar: "Asar", maghrib: "Maghrib", isya: "Isya'"
    },
    fiqh: { qabliyyah: "Qabliyyah", ba_diyyah: "Ba'diyyah", witir: "Witir" },
    details: {
      subuh: {
        desc: "Waktu Subuh menandakan fajar صادق (Sadiq) menerangi ufuk. Solat Sunat Rawatib Qabliyah Subuh (2 rakaat) mempunyai keutamaan yang sangat besar.",
        benefit: "Daripada Aisyah R.anha, Nabi SAW bersabda: 'Dua rakaat Fajar (Subuh) adalah lebih baik daripada dunia dan sekelilingnya.' (HR. Muslim).",
        source: "Hadis Sahih Muslim, No. 725"
      },
      zuhur: {
        desc: "Waktu Zuhur bermula apabila matahari tergelincir dari zenit ke arah barat. Dianjurkan menunaikan Solat Sunat Qabliyah dan Ba'diyyah.",
        benefit: "Siapa yang menjaga solat sunat 4 rakaat sebelum dan selepas Zuhur, Allah haramkan jasadnya daripada api neraka (HR. Tirmizi & Abu Daud).",
        source: "Sunan Tirmizi, No. 428 (Sahih)"
      },
      asar: {
        desc: "Waktu Asar bermula apabila bayang-bayang sesuatu objek sama panjang dengan objek tersebut ditambah bayang tergelincir.",
        benefit: "Sabda Nabi SAW: 'Sesiapa yang solat pada dua kes sejuk (Subuh dan Asar), dia akan masuk syurga.' (HR. Bukhari & Muslim).",
        source: "Sahih al-Bukhari, No. 574"
      },
      maghrib: {
        desc: "Waktu Maghrib bermula sejurus terbenamnya matahari hingga hilang cahaya mega merah di ufuk.",
        benefit: "Menunaikan Solat Sunat Ba'diyyah Maghrib (2 rakaat) menyempurnakan pahala malam dan mendatangkan keberkatan rumah.",
        source: "Al-Fiqh al-Manhaji ala Madhhab al-Imam al-Syafii"
      },
      isya: {
        desc: "Waktu Isya' bermula selepas hilangnya mega merah. Digalakkan menutup malam dengan Solat Sunat Witir (ganjil).",
        benefit: "Nabi SAW bersabda: 'Jadikan solat malam kamu yang terakhir adalah Witir.' (HR. Bukhari & Muslim). Witir adalah penutup ibadah malam yang sangat dianjurkan.",
        source: "Sahih al-Bukhari, No. 998"
      },
      syuruk: {
        desc: "Waktu Syuruk adalah detik terbitnya matahari. Haram menunaikan solat fardhu atau sunat mutlak pada detik ini.",
        benefit: "Dianjurkan duduk berzikir hingga terbit matahari sepenuhnya, disusuli solat sunat Duha.",
        source: "Himpunan Irsyad Al-Fatwa, Pejabat Mufti Kerajaan Brunei"
      },
      duha: {
        desc: "Waktu Solat Sunat Duha bermula dari tinggi matahari selemparan lembing (selepas Syuruk) hingga menjelang Zohor.",
        benefit: "Solat Duha mencukupkan sedekah bagi seluruh sendi tubuh badan manusia (HR. Muslim).",
        source: "Hadis Sahih Muslim, No. 720"
      },
      imsak: {
        desc: "Waktu Imsak adalah masa berjaga-jaga (sunat kira-kira 10 minit sebelum Subuh) sebagai persediaan bersahur.",
        benefit: "Membantu umat Islam berhenti makan dan minum sebelum masuk azan Subuh dengan yakin.",
        source: "Panduan Imsakiah KHEU Brunei"
      }
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
    prayers: {
      imsak: "Imsak", subuh: "Fajr", syuruk: "Sunrise", duha: "Dhuha",
      zuhur: "Zuhr", asar: "Asr", maghrib: "Maghrib", isya: "Isha'"
    },
    fiqh: { qabliyyah: "Qabliyyah", ba_diyyah: "Ba'diyyah", witir: "Witir" },
    details: {
      subuh: {
        desc: "Fajr marks the true dawn light on the horizon. Performing Qabliyyah Fajr (2 Sunnah rak'ahs before Fajr) carries immense spiritual reward.",
        benefit: "The Prophet SAW said: 'The two rak'ahs before Fajr are better than this world and all that it contains.' (Sahih Muslim).",
        source: "Sahih Muslim, No. 725"
      },
      zuhur: {
        desc: "Zuhr begins when the sun passes its zenith. Emphasized Sunnah prayers include Rawatib before and after Zuhr.",
        benefit: "Whoever maintains 4 rak'ahs before and 4 after Zuhr, Allah forbids the Fire from touching them (Tirmidhi & Abu Dawud).",
        source: "Sunan Tirmidhi, No. 428 (Sahih)"
      },
      asar: {
        desc: "Asr begins when an object's shadow matches its length plus its noon shadow.",
        benefit: "The Prophet SAW said: 'Whoever prays the two cool prayers (Fajr and Asr) will enter Paradise.' (Bukhari & Muslim).",
        source: "Sahih al-Bukhari, No. 574"
      },
      maghrib: {
        desc: "Maghrib begins immediately after sunset until twilight disappears.",
        benefit: "Performing 2 Sunnah rak'ahs after Maghrib brings divine light and blessings into the household.",
        source: "Al-Fiqh al-Manhaji ala Madhhab al-Imam al-Syafii"
      },
      isya: {
        desc: "Isha begins after twilight fades. It is highly recommended to conclude the night with Witr prayer.",
        benefit: "The Prophet SAW said: 'Make Witr the last of your prayers at night.' (Bukhari & Muslim).",
        source: "Sahih al-Bukhari, No. 998"
      },
      syuruk: {
        desc: "Sunrise marks the moment the upper limb of the sun appears. Prayer is prohibited at this exact moment.",
        benefit: "Sitting in remembrance of Allah until sunrise, followed by Dhuha prayer, carries the reward of Hajj and Umrah.",
        source: "Brunei State Mufti Fatwa Office Guidance"
      },
      duha: {
        desc: "Dhuha prayer time spans from after sunrise until shortly before Zuhr.",
        benefit: "Performing Dhuha suffices as charity for every joint in the human body (Sahih Muslim).",
        source: "Sahih Muslim, No. 720"
      },
      imsak: {
        desc: "Imsak serves as a precautionary buffer (~10 minutes before Fajr) to finish Sahur.",
        benefit: "Ensures believers finish eating and drinking with certainty before the Fajr call to prayer.",
        source: "KHEU Brunei Official Imsakiah Guide"
      }
    }
  }
};

const ALL_KEYS = ["imsak", "subuh", "syuruk", "duha", "zuhur", "asar", "maghrib", "isya"];

let cachedSchedule = {
  imsak: "04:42", subuh: "04:52", syuruk: "06:09", duha: "06:31",
  zuhur: "12:13", asar: "15:22", maghrib: "18:15", isya: "19:24"
};
let hijrahString = "13 Rabiulakhir 1448 H";

function timeStringToMinutes(str) {
  const parts = str.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesToDisplay(mins) {
  let normalized = mins % 1440;
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
  const currentVal = sel.value || "0";
  sel.innerHTML = "";
  I18N[currentLang].districts.forEach(d => {
    let opt = document.createElement("option");
    opt.value = d.val;
    opt.textContent = d.text;
    if (d.val == currentVal && d.text === sel.options[sel.selectedIndex]?.text) opt.selected = true;
    sel.appendChild(opt);
  });
}

function handleDistrictChange() {
  updateTick();
}

function toggleVisuals() {
  visualsEnabled = !visualsEnabled;
  localStorage.setItem('bwn_visuals', visualsEnabled ? 'true' : 'false');
  
  const btn = document.getElementById('visuals-toggle');
  if (btn) btn.textContent = visualsEnabled ? "☀️" : "🌙";
  
  updateTick();
}

function setLanguage(lang) {
  currentLang = lang;
  document.getElementById("lang-btn-ms").classList.toggle("active", lang === "ms");
  document.getElementById("lang-btn-en").classList.toggle("active", lang === "en");

  const t = I18N[currentLang];
  setText("ui-app-title", t.appTitle);
  document.title = t.appTitle;
  setText("ui-now-label", t.nowLabel);
  
  let savedIndex = document.getElementById("district-select").selectedIndex;
  populateDistricts();
  document.getElementById("district-select").selectedIndex = savedIndex > -1 ? savedIndex : 0;

  setDateHeaders();
  updateTick();
}

function getAdjustedSchedule() {
  const adjusted = {};
  const offset = parseInt(document.getElementById("district-select").value || 0);
  ALL_KEYS.forEach(function(key) {
    let baseMins = timeStringToMinutes(cachedSchedule[key]);
    adjusted[key] = baseMins + offset;
  });
  return adjusted;
}

function openPrayerModal(key) {
  const t = I18N[currentLang];
  const prayerName = t.prayers[key];
  const detail = t.details[key];
  const adjustedTimes = getAdjustedSchedule();
  const timeStr = minutesToDisplay(adjustedTimes[key]);

  document.getElementById("modal-title").textContent = prayerName + " (" + timeStr + ")";
  
  let bodyHtml = 
    '<p class="modal-desc"><strong>Waktu:</strong> ' + timeStr + '</p>' +
    '<p class="modal-desc">' + detail.desc + '</p>' +
    '<div class="modal-benefit-box">' +
      '<strong>Kelebihan / Fadilat:</strong><br>' + detail.benefit +
    '</div>' +
    '<p class="modal-source"><strong>Sumber Rujukan:</strong> ' + detail.source + '</p>';

  document.getElementById("modal-body-content").innerHTML = bodyHtml;
  document.getElementById("info-modal").classList.add("is-visible");
}

function closeModal(event) {
  if (!event || event.target.id === "info-modal" || event.target.classList.contains("modal-close-btn")) {
    document.getElementById("info-modal").classList.remove("is-visible");
  }
}

function renderPrayerList(adjustedTimes, activeKey) {
  const list = document.getElementById("prayer-list-container");
  if (!list) return;
  list.innerHTML = "";

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const t = I18N[currentLang];

  const sequence = [
    { key: "imsak", type: "secondary" },
    { key: "subuh", type: "fardhu", badges: [{ text: t.fiqh.qabliyyah + " &#10003;", type: "is-ok" }, { text: t.fiqh.ba_diyyah + " &#10007;", type: "is-haram" }] },
    { key: "syuruk", type: "secondary" },
    { key: "duha", type: "secondary" },
    { key: "zuhur", type: "fardhu", badges: [{ text: t.fiqh.qabliyyah + " &#10003;", type: "is-ok" }, { text: t.fiqh.ba_diyyah + " &#10003;", type: "is-ok" }] },
    { key: "asar", type: "fardhu", badges: [{ text: t.fiqh.qabliyyah + " &#10003;", type: "is-ok" }, { text: t.fiqh.ba_diyyah + " &#10007;", type: "is-haram" }] },
    { key: "maghrib", type: "fardhu", badges: [{ text: t.fiqh.qabliyyah + " &#10003;", type: "is-ok" }, { text: t.fiqh.ba_diyyah + " &#10003;", type: "is-ok" }] },
    { key: "isya", type: "fardhu", badges: [{ text: t.fiqh.qabliyyah + " &#10003;", type: "is-ok" }, { text: t.fiqh.ba_diyyah + " &#10003;", type: "is-ok" }, { text: t.fiqh.witir + " &#10003;", type: "is-ok" }] }
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

    row.onclick = () => openPrayerModal(item.key);

    let badgesHtml = '';
    if (item.badges) {
      item.badges.forEach(b => { badgesHtml += '<span class="fiqh-badge ' + b.type + '">' + b.text + '</span>'; });
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

  if (!visualsEnabled) {
    skyBg.style.background = "var(--bg-base)";
    celestial.style.opacity = "0";
    if (cloudsLayer) cloudsLayer.style.opacity = "0";
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
    if (cloudsLayer) cloudsLayer.style.opacity = "0.7"; 
    
    let dayDuration = maghribMins - subuhMins;
    let dayProgress = (currentMins - subuhMins) / dayDuration;

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
    if (cloudsLayer) cloudsLayer.style.opacity = "0.15"; 
    
    let nightDuration = (1440 - maghribMins) + subuhMins;
    let elapsedNight = currentMins >= maghribMins ? (currentMins - maghribMins) : ((1440 - maghribMins) + currentMins);
    let nightProgress = elapsedNight / nightDuration;

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

  renderPrayerList(adjustedTimes, state.active.key);
  updateSkyVisuals(adjustedTimes, state.currentMinutes);
}

function setDateHeaders() {
  const now = new Date();
  const gregorianOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
  setText("gregorian-date", now.toLocaleDateString(I18N[currentLang].localeDate, gregorianOptions) + " | " + hijrahString);
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

setLanguage("ms");
fetchRemoteData();
setInterval(updateTick, 1000);
