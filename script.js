// ── RSVP backend ────────────────────────────────────────────────────────────
// Google Apps Script Web app attached to the wedding Google Sheet.
// The guest list lives in the sheet's "Guests" tab, not here.
// See apps-script/README.md.
var RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbzHms6_gv0LdcSwAqJw6LzvnXJR-7WcjsgE12CEFMcmQmKbuXKSrSNEvrlp2Km7TKX1/exec";

var PLUS_ONE = "+1";
function isPlusOne(g) { return g === PLUS_ONE; }

// ── Password gate ────────────────────────────────────────────────────────────
// Once the right password is entered, it's remembered in this browser
// (localStorage) so refreshing or coming back later skips the gate.
var UNLOCK_KEY = "ec-unlocked";

function checkPw() {
  var val = document.getElementById("pw-input").value.trim();
  if (val === "palmsprings") {
    try { localStorage.setItem(UNLOCK_KEY, "1"); } catch (e) {}
    document.documentElement.classList.add("unlocked");
    showPage("home");
    initCountdown();
  } else {
    document.getElementById("pw-err").style.display = "block";
    document.getElementById("pw-input").style.borderColor = "#b94040";
  }
}

document.addEventListener("DOMContentLoaded", function() {
  if (document.documentElement.classList.contains("unlocked")) initCountdown();
  document.getElementById("pw-input").addEventListener("keydown", function(e) {
    if (e.key === "Enter") checkPw();
  });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && document.activeElement === document.getElementById("lookup-name")) {
      lookupGuest();
    }
  });
});

// ── Page navigation ──────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("active"); });
  document.getElementById("page-" + id).classList.add("active");
  document.querySelectorAll(".nav-link").forEach(function(l) {
    l.classList.toggle("active", l.getAttribute("onclick") && l.getAttribute("onclick").includes("'" + id + "'"));
  });
  closeNav();
  document.getElementById("site").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Mobile menu ──────────────────────────────────────────────────────────────
function toggleNav(force) {
  var nav = document.querySelector("nav");
  var open = typeof force === "boolean" ? force : !nav.classList.contains("open");
  nav.classList.toggle("open", open);
  document.querySelector(".nav-toggle").setAttribute("aria-expanded", open ? "true" : "false");
}
function closeNav() { toggleNav(false); }

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") closeNav();
});
document.addEventListener("click", function(e) {
  var nav = document.querySelector("nav");
  if (nav.classList.contains("open") && !nav.contains(e.target)) closeNav();
});

// ── Countdown timer ──────────────────────────────────────────────────────────
function initCountdown() {
  var wedding = new Date("2027-03-07T17:00:00");
  function update() {
    var diff = wedding - new Date();
    if (diff < 0) {
      document.getElementById("countdown").innerHTML = '<p class="countdown-today">Today is the day!</p>';
      return;
    }
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    document.getElementById("countdown").innerHTML =
      '<div class="cd-unit"><div class="cd-num">' + d + '</div><div class="cd-label">Days</div></div>' +
      '<div class="cd-unit"><div class="cd-num">' + h + '</div><div class="cd-label">Hours</div></div>' +
      '<div class="cd-unit"><div class="cd-num">' + m + '</div><div class="cd-label">Mins</div></div>';
  }
  update();
  setInterval(update, 1000);
}

// ── RSVP: Step 1 — name lookup ───────────────────────────────────────────────
function onLookupInput() {
  document.getElementById("not-found-msg").style.display = "none";
  document.getElementById("match-list-wrap").style.display = "none";
}

var NOT_FOUND_TEXT = "We couldn't find that name on our guest list. Please double-check the spelling, or reach out to Cassie or Elliot directly.";
var LOOKUP_ERROR_TEXT = "Sorry — we couldn't look up your invitation just now. Please try again in a moment, or reach out to Cassie or Elliot directly.";

// Asks the Google Sheet for the party matching a first or last name.
function fetchMatches(name) {
  return fetch(RSVP_ENDPOINT + "?action=lookup&name=" + encodeURIComponent(name))
    .then(function(r) { return r.json(); })
    .then(function(res) { if (!res.ok) throw new Error(res.error || "Lookup failed"); return res.matches; });
}

function lookupGuest() {
  var input = document.getElementById("lookup-name").value.trim();
  var btn = document.getElementById("lookup-btn");
  if (!input || btn.disabled) return;

  var notFound = document.getElementById("not-found-msg");
  notFound.style.display = "none";
  document.getElementById("match-list-wrap").style.display = "none";
  btn.disabled = true;
  btn.textContent = "Searching…";

  fetchMatches(input).then(showMatches, function(err) {
    console.error("Lookup failed:", err);
    notFound.textContent = LOOKUP_ERROR_TEXT;
    notFound.style.display = "block";
  }).then(function() {
    btn.disabled = false;
    btn.textContent = "Find my invitation";
  });
}

function showMatches(matches) {
  var notFound = document.getElementById("not-found-msg");
  if (matches.length === 0) {
    notFound.textContent = NOT_FOUND_TEXT;
    notFound.style.display = "block";
  } else if (matches.length === 1) {
    buildPartyStep(matches[0].party, matches[0].guest);
  } else {
    // Multiple people share that first name — ask which one
    var wrap = document.getElementById("match-list-wrap");
    var list = document.getElementById("match-list");
    list.innerHTML = "";
    matches.forEach(function(m) {
      var btn = document.createElement("button");
      btn.className = "match-btn";
      btn.textContent = m.guest;
      btn.onclick = (function(match) {
        return function() {
          wrap.style.display = "none";
          buildPartyStep(match.party, match.guest);
        };
      })(m);
      list.appendChild(btn);
    });
    wrap.style.display = "block";
  }
}

// ── RSVP: Back to lookup ─────────────────────────────────────────────────────
function rsvpBack() {
  document.getElementById("step-party").style.display = "none";
  document.getElementById("step-lookup").style.display = "block";
  document.getElementById("guest-rows").innerHTML = "";
  document.getElementById("r-note").value = "";
  document.getElementById("submit-error").style.display = "none";
  window._currentParty = null;
}


function buildPartyStep(party, matchedGuest) {
  var first = matchedGuest.split(" ")[0];
  var named = party.filter(function(g) { return !isPlusOne(g); });
  var plusCount = party.length - named.length;
  document.getElementById("party-greeting").textContent = "Hi, " + first + "!";
  document.getElementById("party-sub").textContent = (named.length === 1
    ? "Please confirm whether you'll be able to join us."
    : "We found your party of " + named.length + ". Please confirm attendance for each person.") +
    (plusCount === 1 ? " You're welcome to bring a guest, too." :
     plusCount > 1 ? " You're welcome to bring " + plusCount + " guests, too." : "");

  var rows = document.getElementById("guest-rows");
  rows.innerHTML = "";
  party.forEach(function(guest, i) {
    var row = document.createElement("div");
    row.className = "guest-row";
    if (isPlusOne(guest)) {
      row.className += " plus-one-row";
      row.innerHTML =
        '<span class="guest-name">Plus one</span>' +
        '<div class="attend-toggle">' +
          '<button class="tog-btn yes" data-idx="' + i + '" onclick="toggleAttend(' + i + ',\'yes\')">Bringing a guest</button>' +
          '<button class="tog-btn no" data-idx="' + i + '" onclick="toggleAttend(' + i + ',\'no\')">No guest</button>' +
        '</div>' +
        '<div class="guest-detail-area" id="detail-' + i + '">' +
          '<input class="meal-input" id="plus-name-' + i + '" placeholder="Your guest\'s full name" autocomplete="off" />' +
          '<input class="meal-input" id="meal-' + i + '" placeholder="Dietary restrictions or notes (optional)" />' +
        '</div>';
      rows.appendChild(row);
      return;
    }
    row.innerHTML =
      '<span class="guest-name">' + guest + '</span>' +
      '<div class="attend-toggle">' +
        '<button class="tog-btn yes" data-idx="' + i + '" onclick="toggleAttend(' + i + ',\'yes\')">Attending</button>' +
        '<button class="tog-btn no" data-idx="' + i + '" onclick="toggleAttend(' + i + ',\'no\')">Declining</button>' +
      '</div>' +
      '<div class="guest-detail-area" id="detail-' + i + '">' +
        '<input class="meal-input" id="meal-' + i + '" placeholder="Dietary restrictions or notes (optional)" />' +
      '</div>';
    rows.appendChild(row);
  });

  document.getElementById("step-lookup").style.display = "none";
  document.getElementById("step-party").style.display = "block";
  window._currentParty = party;
  window._matchedGuest = matchedGuest;
}

function toggleAttend(idx, val) {
  document.querySelectorAll('.tog-btn.yes[data-idx="' + idx + '"]').forEach(function(b) {
    b.classList.toggle("selected", val === "yes");
  });
  document.querySelectorAll('.tog-btn.no[data-idx="' + idx + '"]').forEach(function(b) {
    b.classList.toggle("selected", val === "no");
  });
  var detail = document.getElementById("detail-" + idx);
  if (detail) detail.style.display = val === "yes" ? "block" : "none";
  document.getElementById("submit-error").style.display = "none";
}

// ── RSVP: Step 3 — submit ────────────────────────────────────────────────────
function submitRsvp() {
  var party = window._currentParty;

  var errorEl = document.getElementById("submit-error");
  function fail(msg, focusEl) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
    if (focusEl) focusEl.focus();
  }

  // Validate every row has a selection, and plus ones have a name
  for (var i = 0; i < party.length; i++) {
    var plus = isPlusOne(party[i]);
    var hasYes = document.querySelector('.tog-btn.yes[data-idx="' + i + '"].selected');
    var hasNo  = document.querySelector('.tog-btn.no[data-idx="' + i + '"].selected');
    if (!hasYes && !hasNo) {
      return fail(plus ? "Please let us know whether you're bringing a guest."
                       : "Please select attending or not attending for each guest.");
    }
    if (plus && hasYes) {
      var nameInput = document.getElementById("plus-name-" + i);
      if (!nameInput.value.trim()) return fail("Please enter your guest's name.", nameInput);
    }
  }

  // Names of everyone attending, using the typed name for plus ones.
  // A plus one only counts if someone from the invited party is coming.
  var attending = [];
  party.forEach(function(g, i) {
    if (isPlusOne(g) || !document.querySelector('.tog-btn.yes[data-idx="' + i + '"].selected')) return;
    attending.push(g);
  });
  if (attending.length > 0) {
    party.forEach(function(g, i) {
      if (isPlusOne(g) && document.querySelector('.tog-btn.yes[data-idx="' + i + '"].selected')) {
        attending.push(document.getElementById("plus-name-" + i).value.trim());
      }
    });
  }

  // One entry per row in the sheet, including plus ones
  var someoneAttending = attending.length > 0;
  var guests = party.map(function(g, i) {
    var yes = !!document.querySelector('.tog-btn.yes[data-idx="' + i + '"].selected');
    var notes = document.getElementById("meal-" + i);
    if (isPlusOne(g)) {
      return {
        name: yes ? document.getElementById("plus-name-" + i).value.trim() : "(no guest)",
        plusOne: true,
        attending: yes && someoneAttending,
        notes: yes && notes ? notes.value.trim() : ""
      };
    }
    return { name: g, plusOne: false, attending: yes, notes: yes && notes ? notes.value.trim() : "" };
  });
  var payload = {
    party: party.filter(function(g) { return !isPlusOne(g); }).join(", "),
    respondedBy: window._matchedGuest || "",
    note: document.getElementById("r-note").value.trim(),
    guests: guests
  };

  var btn = document.getElementById("rsvp-submit");
  btn.disabled = true;
  btn.textContent = "Sending…";
  errorEl.style.display = "none";

  sendRsvp(payload).then(function() {
    showRsvpSuccess(attending);
  }).catch(function(err) {
    console.error("RSVP failed:", err);
    fail("Sorry — we couldn't send your RSVP. Please try again in a moment, or reach out to Cassie or Elliot directly.");
  }).then(function() {
    btn.disabled = false;
    btn.textContent = "Send RSVP";
  });
}

// Posts as text/plain so the browser doesn't need a CORS preflight (Apps Script can't answer one).
function sendRsvp(payload) {
  if (!RSVP_ENDPOINT) return Promise.reject(new Error("RSVP_ENDPOINT is not set in script.js"));
  return fetch(RSVP_ENDPOINT, { method: "POST", body: JSON.stringify(payload) })
    .then(function(r) { return r.json(); })
    .then(function(res) { if (!res.ok) throw new Error(res.error || "RSVP rejected"); return res; });
}

function showRsvpSuccess(attending) {
  document.getElementById("step-party").style.display = "none";
  document.getElementById("rsvp-success").style.display = "block";
  document.getElementById("rsvp-msg").textContent = attending.length > 0 ? "We'll see you there!" : "We'll miss you!";
  document.getElementById("rsvp-detail").textContent = attending.length > 0
    ? "Your RSVP has been received — we're so excited to celebrate with " +
      (attending.length === 1 ? attending[0].split(" ")[0] : attending.length + " of you") + " in Palm Springs!"
    : "Thank you for letting us know. Your RSVP has been received — we'll miss you and hope to celebrate together another time.";
}
