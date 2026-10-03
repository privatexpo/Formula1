(function () {
  const { races, drivers, teams } = window.APEX;
  const CART_KEY = "apex-cart";
  const BOOK_KEY = "apex-booking";
  const WAIT_KEY = "apex-waitlist";
  const euro = (amount) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
  const fromPrice = (race) => {
    const prices = (race.tickets || []).filter((ticket) => !ticket.sold && ticket.price != null).map((ticket) => ticket.price);
    return prices.length ? Math.min(...prices) : null;
  };
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);
  const fromLabel = (race) => t("card.from", { price: euro(fromPrice(race)) });
  const ticketOf = (race, id) => (race?.tickets || []).find((ticket) => ticket.id === id);
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const regions = [
    { id: "all", key: "region.all" },
    { id: "americas", key: "region.americas" },
    { id: "europe", key: "region.europe" },
    { id: "asia", key: "region.asia" },
    { id: "middle-east", key: "region.middle" },
  ];
  if (window.I18N) I18N.apply(document);
  const page = document.body.dataset.page;
  const params = new URLSearchParams(location.search);

  const marks = {
    Bahrain: { code: "BHR", tone: "#6e1c22", accent: "#f0c14a" },
    "Saudi Arabia": { code: "KSA", tone: "#0c2438", accent: "#d4af77" },
    Australia: { code: "AUS", tone: "#0b4f3a", accent: "#ffcd00" },
    Japan: { code: "JPN", tone: "#9a3b1a", accent: "#ffcc00" },
    China: { code: "CHN", tone: "#9b1218", accent: "#ffde00" },
    Miami: { code: "MIA", tone: "#9a2340", accent: "#5ce1ff" },
    Canada: { code: "CAN", tone: "#8e1828", accent: "#111111" },
    Monaco: { code: "MON", tone: "#163e78", accent: "#e8d5a3" },
    Portugal: { code: "POR", tone: "#8a6412", accent: "#1f7a3a" },
    "Great Britain": { code: "GBR", tone: "#1a3f72", accent: "#cf142b" },
    Austria: { code: "AUT", tone: "#1f5a32", accent: "#ed2939" },
    Belgium: { code: "BEL", tone: "#2c4a30", accent: "#fdda24" },
    Hungary: { code: "HUN", tone: "#a34a10", accent: "#3d6b4f" },
    Italy: { code: "ITA", tone: "#1a4a28", accent: "#009246" },
    Spain: { code: "ESP", tone: "#9a1820", accent: "#f1bf00" },
    Azerbaijan: { code: "AZE", tone: "#0c5c72", accent: "#ef3340" },
    "Türkiye": { code: "TUR", tone: "#9a1c24", accent: "#ffcc00" },
    Singapore: { code: "SGP", tone: "#07162e", accent: "#ef3340" },
    "United States": { code: "USA", tone: "#8e1a2c", accent: "#3c3b6e" },
    Mexico: { code: "MEX", tone: "#0c5a38", accent: "#ce1126" },
    Brazil: { code: "BRA", tone: "#0d6a32", accent: "#ffdf00" },
    "Las Vegas": { code: "LVG", tone: "#3a1858", accent: "#ffd100" },
    Qatar: { code: "QAT", tone: "#5c1230", accent: "#c5a572" },
    "Abu Dhabi": { code: "ABU", tone: "#0a4e52", accent: "#c5a572" },
  };

  const flags = {
    Bahrain: "bahrain.svg",
    "Saudi Arabia": "saudi.svg",
    Australia: "australia.svg",
    Japan: "japan.svg",
    China: "china.svg",
    Miami: "usa.svg",
    Canada: "canada.svg",
    Monaco: "monaco.svg",
    Portugal: "portugal.svg",
    "Great Britain": "britain.svg",
    Austria: "austria.svg",
    Belgium: "belgium.svg",
    Hungary: "hungary.svg",
    Italy: "italy.svg",
    Spain: "spain.svg",
    Azerbaijan: "azerbaijan.svg",
    "Türkiye": "turkey.svg",
    Singapore: "singapore.svg",
    "United States": "usa.svg",
    Mexico: "mexico.svg",
    Brazil: "brazil.svg",
    "Las Vegas": "usa.svg",
    Qatar: "qatar.svg",
    "Abu Dhabi": "abudhabi.svg",
  };

  const photos = {
    Bahrain: "bahrain.webp",
    "Saudi Arabia": "saudi.webp",
    Australia: "australia.webp",
    Japan: "japan.webp",
    China: "china.webp",
    Miami: "miami.webp",
    Canada: "canada.webp",
    Monaco: "monaco.webp",
    Portugal: "portugal.webp",
    "Great Britain": "britain.webp",
    Austria: "austria.webp",
    Belgium: "belgium.webp",
    Hungary: "hungary.webp",
    Italy: "italy.webp",
    Spain: "spain.webp",
    Azerbaijan: "azerbaijan.webp",
    "Türkiye": "turkey.webp",
    Singapore: "singapore.webp",
    "United States": "usa.webp",
    Mexico: "mexico.webp",
    Brazil: "brazil.webp",
    "Las Vegas": "vegas.webp",
    Qatar: "qatar.webp",
    "Abu Dhabi": "abudhabi.webp",
  };

  const season = 2027;
  let region = "all";
  let countriesOpen = false;
  let pinnedId = "";
  let selectedId = params.get("course") || "";
  let standingsTab = "drivers";
  let hospFilter = "all";
  let qty = {};
  let selectedTier = "";
  const svgCache = new Map();
  let mapToken = 0;
  const seatSpot = {
    bhr: { ga: ["GA"], main: ["main", "main-2"], club: ["paddock_club"], batelco: ["batelco"], turn1: ["turn1"], universitygs: ["university_gs"], victorygrandstand: ["victory_grandstand"], viptent: ["vip_tent"], thedome: ["The_Dome"], podiumview: ["podium_view"], sectionpr: ["section_p_r"] },
    sau: { ga: [], central: ["Central"], main: ["Main"], paddockclub: ["Paddock_Club"], premiumhospitality: ["Premium_hospitality"] },
    aus: { ga: ["GA"], jones: ["T8_Lakeside"], club: ["Paddock_Club"], thepalms: ["THE_PALMS"], thealbert: ["The_ALBERT", "The_Albert"], theapex: ["The_Apex"], racecube: ["RaceCube"], theatrium: ["The_Atrium"] },
    jpn: { a: ["A1", "A2"], v2: ["V2"], club: ["VIP_Suite_Premium"], ga: ["GA"], q2: ["Q2"], q1: ["Q1"], b1: ["B1"], c: ["C"], e: ["E"], r: ["R"], s: ["S"], v1: ["V1"], i: ["I"], p: ["P"], m: ["M"], d: ["D"], doasis: ["D_Oasis"], g: ["G"], o: ["O"], b2: ["B2"], h: ["H"] },
    chn: { ga: ["GA"], main: ["[idGrandstand='10055']"], club: ["[idGrandstand='10035']"], gashangai: ["GA_Shangai"], gs1234242: ["[idGrandstand='1234242']"], gs9965: ["[idGrandstand='9965']"], gs8768689: ["[idGrandstand='8768689']"], gs2627362: ["[idGrandstand='2627362']"] },
    mia: { beach: ["North_Beach"], t18: ["Turn18"], sf: ["Start_Finish"], turn1: ["Turn1"], beachsouth: ["Beach_South"], paddockclub: ["Paddock_Club"], marina: ["Marina"], boathouse: ["Boat_House"], miahospitalityvillagec: ["MIA_Hospitality_Village_Club"] },
    can: { ga: ["GA"], gs12: ["_15"], club: ["Podium_Club"], g16: ["_16"], family: ["family"], g32: ["_32"], eliterestaurant: ["Elite_Restaurant"], vipfanselitesuite: ["VIP_Fan_s_Elite_Suite"], sennaclub: ["Senna_Club"], g1978terrace: ["_1978_Terrace"], latoundra: ["La_Toundra"], privilege: ["Privilege"], g31: ["_31"], g21: ["_21"], stroll: ["Stroll"], g46: ["_46"], g34: ["_34"], main: ["Main"], platinegs: ["Platine_GS"], g47: ["_47"], cgvterrace: ["CGV_terrace"], g1: ["_1"], cgvexperience: ["CGV_Experience"], privilege17: ["Privilege_17"], lajamaque: ["La_Jama\u00efque"], terrace21: ["Terrace_21"], cosmosclub: ["Cosmos_club"] },
    mon: { rocher: ["O"], k: ["K"], club: ["Paddock_Club"], ga: ["GA"], romaitalianrivieraloun: ["Roma_Italian_Riviera_Lounge"], l: ["L"], v1: ["V1"], x2: ["X2"], x1: ["X1"], b: ["B"], c: ["C"], a1: ["A1"], z1: ["Z1"], m: ["M"], n: ["N"], e: ["E"], p: ["P"], t: ["T"], belvedere: ["Belvedere"], terraces: ["terraces"], shangrila: ["shangri-la"], albatros: ["albatros"], hirondele: ["hirondele"], panorama: ["panorama"], caravelle: ["caravelle"], trackside: ["trackside"], ermano: ["ermano"], heracles: ["heracles"], panoramafanclub: ["panorama_fan_club"], bronze: ["bronze"], platiniumheracles: ["platinium_heracles"], silver: ["silver"], platinium: ["platinium"], gold: ["gold"], gs23898: ["[idGrandstand='23898']"], gs11967: ["[idGrandstand='11967']"] },
    por: { ga: ["ga"], main: ["main"], club: ["club"] },
    gbr: { ga: ["GA"], chapel: ["[idGrandstand='18207']"], hamilton: ["[idGrandstand='8375']"], gasilverstone: ["GA_Silverstone"], redbullpoleposition: ["Red_bull_pole_position"], gs25308: ["[idGrandstand='25308']"], gs25318: ["[idGrandstand='25318']"], gs25328: ["[idGrandstand='25328']"], gs25338: ["[idGrandstand='25338']"], gs25348: ["[idGrandstand='25348']"], gs27179: ["[idGrandstand='27179']"], gs27239: ["[idGrandstand='27239']"], gs27279: ["[idGrandstand='27279']"], gs27289: ["[idGrandstand='27289']"], gs27299: ["[idGrandstand='27299']"], gs27309: ["[idGrandstand='27309']"], gs27319: ["[idGrandstand='27319']"], gs27329: ["[idGrandstand='27329']"], gs8205: ["[idGrandstand='8205']"], gs8225: ["[idGrandstand='8225']"], gs8265: ["[idGrandstand='8265']"], gs8275: ["[idGrandstand='8275']"], gs8285: ["[idGrandstand='8285']"], gs8315: ["[idGrandstand='8315']"], gs8325: ["[idGrandstand='8325']"], gs8365: ["[idGrandstand='8365']"], gs8385: ["[idGrandstand='8385']"], gs8395: ["[idGrandstand='8395']"], gs8405: ["[idGrandstand='8405']"], gs8415: ["[idGrandstand='8415']"] },
    aut: { ga: ["GA"], jk: ["t9", "t10"], sz: ["[idGrandstand='9355']"], gs17417: ["[idGrandstand='17417']"], gs9375: ["[idGrandstand='9375']"], gs9345: ["[idGrandstand='9345']"], gs9315: ["[idGrandstand='9315']"], gs9325: ["[idGrandstand='9325']"], gs9335: ["[idGrandstand='9335']"] },
    bel: { ga: ["GA"], gs: ["_17-27"], gold: ["gold1"], paddockclub: ["paddock_club"], logedome: ["loge_dome"], sourceofgold: ["Source_of_Gold"], mezzanine: ["mezzanine"], gold6: ["gold6"], gold9bis: ["gold9bis"], gold9: ["gold9"], gold8: ["gold8"], gold7: ["gold7"], gold7ter: ["gold7ter"], silver2: ["silver2"], gold2: ["gold2"], silver1: ["silver1"], gold4: ["gold4"], gold3: ["gold3"], silver4: ["silver4"], combes1: ["Combes_1"], combes2: ["Combes_2"], combes3: ["Combes_3"], combes4: ["Combes_4"], silver7: ["Silver7"], gold5: ["gold5"], silver3: ["silver3"], silver6: ["silver6"], speedcorner: ["speedcorner"], orange: ["orange"], fanareadoublegauche: ["Fan_Area_Double_Gauche_"], gs25258: ["[idGrandstand='25258']"], gs10385: ["[idGrandstand='10385']"], gs26809: ["[idGrandstand='26809']"], gs10375: ["[idGrandstand='10375']"], gs10395: ["[idGrandstand='10395']"] },
    hun: { ga: ["GA"], chicane: ["silver3"], plat: ["P"], silver5: ["silver5"], bronze1: ["bronze1"], bronze2: ["bronze2"], redbull: ["redbull"], silver4: ["silver4"], fanlounge: ["Fan_Lounge"], gs24228: ["[idGrandstand='24228']"], gs9215: ["[idGrandstand='9215']"], gs9205: ["[idGrandstand='9205']"], gs24958: ["[idGrandstand='24958']"], gs24198: ["[idGrandstand='24198']"], gs24208: ["[idGrandstand='24208']"], gs24938: ["[idGrandstand='24938']"], gs24218: ["[idGrandstand='24218']"], gs24948: ["[idGrandstand='24948']"] },
    ita: { para: ["Curva_parabollica", "Curva_parabollica-2"], ascari: ["_23A"], centrale: ["_23B"], ultimatehospitality: ["Ultimate_Hospitality"], greenhouse: ["Green_house"], dolcevitalounge: ["Dolce_vita_lounge"], gs22438: ["[idGrandstand='22438']"], gs26679: ["[idGrandstand='26679']"], gs27819: ["[idGrandstand='27819']"], gs29209: ["[idGrandstand='29209']"], gs8955: ["[idGrandstand='8955']"], gs8715: ["[idGrandstand='8715']"], gs8705: ["[idGrandstand='8705']"], gs18677: ["[idGrandstand='18677']"], gs8805: ["[idGrandstand='8805']"], gs8815: ["[idGrandstand='8815']"], gs8825: ["[idGrandstand='8825']"], gs8835: ["[idGrandstand='8835']"], gs8935: ["[idGrandstand='8935']"], gs27129: ["[idGrandstand='27129']"], gs8725: ["[idGrandstand='8725']"], gs8745: ["[idGrandstand='8745']"], gs8755: ["[idGrandstand='8755']"], gs8765: ["[idGrandstand='8765']"], gs8775: ["[idGrandstand='8775']"], gs8675: ["[idGrandstand='8675']"], gs8665: ["[idGrandstand='8665']"], gs8655: ["[idGrandstand='8655']"], gs14147: ["[idGrandstand='14147']"], gs12324324: ["[idGrandstand='12324324']"], gs28909: ["[idGrandstand='28909']"], gs28919: ["[idGrandstand='28919']"], gs3546645: ["[idGrandstand='3546645']"], gs8925: ["[idGrandstand='8925']"], gs18567: ["[idGrandstand='18567']"], gs8615: ["[idGrandstand='8615']"], gs8645: ["[idGrandstand='8645']"], gs8695: ["[idGrandstand='8695']"], gs8885: ["[idGrandstand='8885']"], gs8895: ["[idGrandstand='8895']"], gs8905: ["[idGrandstand='8905']"], gs8915: ["[idGrandstand='8915']"], gs8635: ["[idGrandstand='8635']"], gs8685: ["[idGrandstand='8685']"] },
    esp: { ga: ["GA"], main: ["[idGrandstand='27219']"], club: ["[idGrandstand='29539']"], gs27199: ["[idGrandstand='27199']"], gs27209: ["[idGrandstand='27209']"], gs29579: ["[idGrandstand='29579']"] },
    aze: { ga: ["GA"], absheron: ["absheron_A", "absheron_B", "absheron_C", "absheron_D", "absheron_E"], club: ["PaddockClub"], champions: ["Champions"], khazar: ["khazar"], bulvar: ["bulvar"], sahil: ["sahil"], mugham: ["mugham"], gizgalasi: ["giz_galasi"], icherisheher: ["icheri_sheher"], azneft: ["azneft"], filarmoniya: ["filarmoniya"], marineloungeexperience: ["Marine_Lounge_Experience"], marinegrandstand: ["Marine_Grandstand"], gs25848: ["[idGrandstand='25848']"] },
    tur: { ga: ["@28,36"], gs7: ["@52,48"], club: ["@70,62"] },
    sgp: { walk: ["Premier_Walkabout", "GASingapore"], bay: ["Bayfront"], club: ["Paddock_Club"], zone4: ["zone4"], zone3: ["zone3"], zone2: ["zone2"], zone1: ["zone1"], lougeturn3: ["Louge-turn3"], skysuite: ["Skysuite"], greenroom: ["GreenRoom"], observ3: ["Observ_3"], twenty3: ["twenty3"], pitexit: ["Pit_Exit"], promenade: ["Promenade"], pit: ["Pit"], superpitgs: ["SuperPit_GS"], stamford: ["Stamford"], connaught: ["Connaught"], padang: ["Padang"], empress: ["empress"], turn2: ["turn2"], turn1: ["turn1"], republicgrandstand: ["Republic_Grandstand"], rafles: ["Rafles"], paulanerbruhaus: ["PAULANER_Br\u00e4uhaus"], dirversrightlounge: ["Dirver_s_right_lounge"], skyline: ["Skyline"] },
    usa: { ga: ["GA"], t15: ["Turn15"], club: ["Club_Podium"], clubsi: ["Club_Si"], theterrace: ["the_terrace"], plazaclub: ["Plaza_Club"], turn9: ["Turn9"], turn4: ["Turn4"], turn6: ["Turn6"], turn2: ["Turn2"], main: ["main"], turn12: ["Turn12"], turn13cabanas: ["Turn13_Cabanas"], turn1: ["Turn1"], pf: ["P_F"], turn19: ["Turn19"], pt: ["P_T"] },
    mex: { ga: ["main"], foro: ["_14-15", "_14", "_15"], club: ["MainGS_Club"], skyview: ["Skyview"], tracksideboxes: ["Trackside_boxes"], tracksideboxc: ["Trackside_boxC"], skyboxg9: ["Skybox_G9"], skyboxg10: ["Skybox_G10"], skyboxg11: ["Skybox_G11"], skyboxg1: ["Skybox_g1"], speedloungegreen: ["Speed_lounge_green"], speedloungeyellow: ["Speed_lounge_yellow"], platiniumplus: ["Platinium_Plus"], g11: ["_11"], g6a: ["_6A"], g7: ["_7"], g8: ["_8"], g9: ["_9"], g6: ["_6"], g5: ["_5"], g5a: ["_5A"], g4: ["_4"], g3: ["_3"], g3a: ["_3A"], g10: ["_10"], terrazza: ["terrazza"] },
    bra: { ga: [], a: ["A"], club: ["PremiumPC"], orangetreeclub: ["OrangeTreeClub"], grandprixclub: ["GrandPrixClub"], pitstopclub: ["PitStopClub"], g: ["G"], m: ["M"], b: ["B"], heineken: ["heineken"], r: ["R"], n: ["N"], d: ["D"], h: ["H"], v: ["V"], premiums: ["PremiumS"] },
    lvg: { ga: ["GA"], sphere: ["Skybox"], club: ["Trackside_Tavern_at_Paddock_Club_Rooftop"], gs23388: ["[idGrandstand='23388']"], gs13232323: ["[idGrandstand='13232323']"], gs26449: ["[idGrandstand='26449']"], gs2222222: ["[idGrandstand='2222222']"], gs26439: ["[idGrandstand='26439']"], gs23398: ["[idGrandstand='23398']"] },
    qat: { club: ["champions_club"], hill: ["ga_Lusail"], main: ["main"], north: ["north"], t16: ["t16"], t2: ["t2"], t3: ["t3"], premirehospitality: ["premi\u00e8re_hospitality"], lusaillounge: ["lusail_lounge"], paddockclub: ["Paddock_Club"], gs25138: ["[idGrandstand='25138']"] },
    abu: { ga: ["GA"], north: ["North_GS"], club: ["West_club"], g36016: ["_360_16"], gardenonyas: ["garden_on_yas", "garden_on_yas-3"], shamssuite: ["Shams_suite"], marinaviewssuite: ["Marina_Views_Suite"], southclub: ["South_Club"], deck9: ["deck_9"], deck2: ["deck_2"], turnwest: ["Turn_west"], lunalounge: ["Luna_lounge"], sunsetlounge: ["Sunset_lounge"], mainyassuitepremium: ["Main_Yas_Suite_Premium"], sunsetgarage: ["Sunset_garage"], northstraight: ["North_Straight"], yassuitewest: ["Yas_Suite_West"], yassuitenorth: ["Yas_Suite_North"], yassuitemain: ["Yas_Suite_Main"], g360sixteen: ["_360_Sixteen"], marinags: ["Marina_GS"], westgs: ["West_GS"], weststraightgs: ["West_Straight_GS"], southgs: ["South_GS"], maings: ["Main_GS"], club58: ["Club58"] },
  };

  const bySeason = (year) => races.filter((race) => race.season === year);

  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  let cart = loadCart();
  let placedName = "";
  let orderPaid = false;

  const langCode = (window.I18N ? I18N.lang : "en").toUpperCase();
  const langItems = (window.I18N ? I18N.codes : ["en"]).map((code) => `<button type="button" data-action="set-lang" data-lang="${code}"${window.I18N && I18N.lang === code ? ' aria-current="true"' : ""}>${code.toUpperCase()}</button>`).join("");

  document.getElementById("header").innerHTML = `
    <a class="skip" href="#contenu">${t("skip")}</a>
    <div class="topbar">
      <div class="container topbar-row">
        <nav class="top-mid" aria-label="Sections">
          <a href="billets.html">${t("nav.tickets")}</a>
          <a href="hospitality.html" ${page === "hospitality" ? 'aria-current="page"' : ""}>${t("nav.hospitality")}</a>
        </nav>
        <a class="tv-mark" href="https://f1tv.formula1.com/" aria-label="F1 TV">
          <img class="tv-for-light" src="assets/f1-tv-logo.svg" alt="F1 TV" width="144" height="24">
          <img class="tv-for-dark" src="assets/f1-tv-logo-light.svg" alt="" width="144" height="24" aria-hidden="true">
        </a>
      </div>
    </div>
    <div class="redbar">
      <div class="container nav-row">
        <button class="menu-toggle" type="button" data-action="menu" aria-expanded="false" aria-controls="nav" aria-label="${t("nav.menu")}"><span></span></button>
        <a class="brand${page === "hospitality" ? " brand--hosp" : ""}" href="${page === "hospitality" ? "hospitality.html" : "index.html"}" aria-label="${page === "hospitality" ? "F1 Hospitality" : "F1 Tickets"}">
          ${page === "hospitality"
            ? `<span class="brand-f1"><img src="assets/f1-tickets-logo.svg?v=hd1" alt=""></span><span class="brand-word">${t("nav.hospitality")}</span>`
            : `<img src="assets/f1-tickets-logo.svg?v=hd1" alt="F1 Tickets">`}
        </a>
        <nav id="nav" class="nav-links" aria-label="Primary">
          <a href="index.html#calendar" ${page === "home" || page === "calendar" ? 'aria-current="page"' : ""}>${t("nav.calendar")} <i class="caret" aria-hidden="true"></i></a>
          <a href="faq.html" ${page === "faq" ? 'aria-current="page"' : ""}>${t("nav.faq")}</a>
          <a class="mobile-only" href="billets.html">${t("nav.tickets")}</a>
          <a class="mobile-only" href="hospitality.html" ${page === "hospitality" ? 'aria-current="page"' : ""}>${t("nav.hospitality")}</a>
          <a class="mobile-only" href="classements.html">${t("nav.standings")}</a>
          <a class="mobile-only" href="https://f1tv.formula1.com/">F1 TV</a>
          <button class="text-btn" type="button" data-action="contact">${t("nav.contact")}</button>
          <button class="text-btn" type="button" data-action="safe">${t("nav.safe")}</button>
        </nav>
        <div class="nav-tools">
          <div class="lang-menu">
            <button class="lang-toggle" type="button" data-action="lang" aria-expanded="false" aria-controls="lang-panel" aria-label="${t("lang.label")}">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 12h16M12 4c2.2 2.4 3.3 5.1 3.3 8S14.2 17.6 12 20c-2.2-2.4-3.3-5.1-3.3-8S9.8 6.4 12 4z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
              ${langCode}
            </button>
            <div class="lang-panel" id="lang-panel" hidden>${langItems}</div>
          </div>
          <div class="account-menu">
            <button class="icon-account" type="button" data-action="account" aria-expanded="false" aria-controls="account-panel" aria-label="${t("nav.account")}">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 19.2c1.4-3 3.8-4.4 7-4.4s5.6 1.4 7 4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
              <span class="cart-badge" data-cart-count hidden>0</span>
            </button>
            <div class="account-panel" id="account-panel" hidden>
              <a href="basket.html">${t("account.basket")}</a>
              <a href="booking.html">${t("account.tickets")}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("footer").innerHTML = `
    <div class="container footer-main">
      <div class="footer-social">
          <a href="https://www.facebook.com/Formula1" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M14.5 8.5V6.8c0-.7.5-1 1.2-1H17V3h-2.1C12.2 3 11 4.4 11 6.6v1.9H9v2.7h2V21h3.5v-9.8h2.3l.4-2.7h-2.7z"/></svg></a>
          <a href="https://x.com/F1" target="_blank" rel="noopener noreferrer" aria-label="X"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M17.6 3h2.8l-6.1 7 7.2 11h-5.6l-4.4-6.6L6.4 21H3.6l6.6-7.6L3.2 3h5.8l4 6L17.6 3zm-1 16.2h1.6L7.5 4.7H5.8l10.8 14.5z"/></svg></a>
          <a href="https://www.instagram.com/f1" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5z"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="0.9" fill="currentColor"/></svg></a>
          <a href="https://www.youtube.com/@F1" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M22 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C18.2 5.4 12 5.4 12 5.4s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 9 2 12.2 2 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6zM10 15.5v-6.6l5.2 3.3-5.2 3.3z"/></svg></a>
        </div>
      <div class="footer-cols">
        <ul class="footer-brand">
          <li><a href="index.html">${t("foot.tickets")}</a></li>
          <li><a href="hospitality.html">${t("foot.hospitality")}</a></li>
          <li><a href="hospitality.html">${t("foot.experiences")}</a></li>
        </ul>
        <ul class="footer-meta">
          <li><a href="terms.html">${t("foot.terms")}</a></li>
          <li><a href="privacy.html">${t("foot.privacy")}</a></li>
          <li><a href="privacy.html#cookies">${t("foot.cookies")}</a></li>
        </ul>
        <ul class="footer-meta">
          <li><button type="button" data-action="contact">${t("nav.contact")}</button></li>
          <li><a href="faq.html">${t("foot.faqs")}</a></li>
        </ul>
      </div>
      <div class="footer-legal">
        <p class="footer-note">${t("foot.note")}</p>
        <p class="footer-copy">© 2026 FEVER</p>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="backdrop hidden" data-modal="safe">
      <div class="modal modal-safe" role="dialog" aria-modal="true" aria-labelledby="safe-title">
        <header><h2 id="safe-title">${t("safe.title")}</h2><button class="icon-btn" type="button" data-action="close-modal" aria-label="${t("safe.close")}">×</button></header>
        <div class="sheet sheet-safe">
          <p>${t("safe.p1")}</p>
          <p>${t("safe.p2")}</p>
          <img class="shop-safe-banner" src="assets/shop-safe.png" alt="${t("safe.alt")}" width="540" height="250">
        </div>
      </div>
    </div>
    <div class="backdrop hidden" data-modal="contact">
      <div class="modal modal-contact" role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <header><h2 id="contact-title">${t("contact.title")}</h2><button class="icon-btn" type="button" data-action="close-modal" aria-label="${t("safe.close")}">×</button></header>
        <form id="contact-form">
          <p class="contact-lead">${t("contact.lead")}</p>
          <p class="contact-mail">
            <img src="assets/icon-mail.svg" alt="" width="16" height="16">
            <a href="mailto:support@ticketing-formula1.com">support@ticketing-formula1.com</a>
          </p>
          <label>${t("contact.topic")}
            <select name="topic" required>
              <option value="" selected disabled>${t("contact.choose")}</option>
              <option value="order">${t("contact.orderTopic")}</option>
              <option value="tickets">${t("contact.ticketsTopic")}</option>
              <option value="hospitality">${t("contact.hospTopic")}</option>
              <option value="other">${t("contact.otherTopic")}</option>
            </select>
          </label>
          <label>
            <span class="contact-cap">${t("contact.order")} <span class="opt">${t("contact.optional")}</span></span>
            <input name="reference" type="text" autocomplete="off" placeholder="F1-1042">
          </label>
          <div class="contact-pair">
            <label>${t("contact.name")}<input name="name" type="text" required autocomplete="name"></label>
            <label>${t("contact.email")}<input name="email" type="email" required autocomplete="email"></label>
          </div>
          <label>${t("contact.message")}<textarea name="message" rows="4" required placeholder="${t("contact.placeholder")}"></textarea></label>
          <button class="button" type="submit">${t("contact.send")}</button>
        </form>
        <div class="success hidden" data-contact-success>
          <p class="contact-done">${t("contact.received")}</p>
          <p data-contact-reply></p>
          <p class="contact-mail">
            <img src="assets/icon-mail.svg" alt="" width="16" height="16">
            <a href="mailto:support@ticketing-formula1.com">support@ticketing-formula1.com</a>
          </p>
          <button class="button" type="button" data-action="close-modal">${t("safe.close")}</button>
        </div>
      </div>
    </div>
    <div class="backdrop hidden" data-modal="wait">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="wait-title">
        <header><h2 id="wait-title">${t("wait.title")}</h2><button class="icon-btn" type="button" data-action="close-modal" aria-label="${t("safe.close")}">×</button></header>
        <form id="wait-form">
          <p class="empty" data-wait-race></p>
          <label>${t("contact.name")}<input name="name" type="text" required></label>
          <label>${t("contact.email")}<input name="email" type="email" required></label>
          <button class="button" type="submit">${t("wait.join")}</button>
        </form>
        <div class="success hidden" data-wait-success>
          <p>${t("wait.success")}</p>
          <button class="button" type="button" data-action="close-modal">${t("safe.close")}</button>
        </div>
      </div>
    </div>
    <div class="backdrop hidden" data-modal="hosp-pack">
      <div class="modal modal-packs" role="dialog" aria-modal="true" aria-labelledby="packs-title">
        <div class="pack-hero">
          <img class="pack-hero__photo" data-packs-photo alt="">
          <button class="icon-btn pack-close" type="button" data-action="close-modal" aria-label="${t("safe.close")}">×</button>
          <div class="pack-hero__copy">
            <p class="pack-kicker"><img data-packs-flag alt="">${t("nav.hospitality")}</p>
            <h2 id="packs-title">Packages</h2>
            <p data-packs-meta></p>
          </div>
        </div>
        <div class="sheet" data-packs-list></div>
      </div>
    </div>
    <div class="toast hidden" data-toast role="status"></div>
    `
  );

  let waitRaceId = "";

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  }

  function cartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function cartTotalLabel() {
    const sum = cart.reduce((total, item) => {
      const race = races.find((entry) => entry.id === item.raceId);
      const ticket = ticketOf(race, item.tierId);
      return race && ticket ? total + ticket.price * item.qty : total;
    }, 0);
    return euro(sum);
  }

  function toast(message) {
    const node = document.querySelector("[data-toast]");
    node.textContent = message;
    node.classList.remove("hidden");
    window.setTimeout(() => node.classList.add("hidden"), 2200);
  }

  function openModal(name) {
    const node = document.querySelector(`[data-modal="${name}"]`);
    node.classList.remove("hidden");
    const form = node.querySelector("form");
    const success = node.querySelector(".success");
    if (form) form.classList.remove("hidden");
    if (success) success.classList.add("hidden");
  }

  function closeModals() {
    document.querySelectorAll(".backdrop").forEach((node) => node.classList.add("hidden"));
  }

  function renderCart() {
    const tickets = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = String(tickets);
      node.hidden = tickets < 1;
    });
    const root = document.getElementById("basket-root");
    if (!root) return;
    if (!cart.length) {
      root.innerHTML = orderPaid || placedName ? basketDone(placedName) : basketEmpty();
      return;
    }
    placedName = "";
    orderPaid = false;
    const countLabel = tickets === 1 ? t("basket.countOne") : t("basket.countMany", { n: tickets });
    const noteLabel = tickets === 1 ? t("basket.noteOne") : t("basket.noteMany", { n: tickets });
    root.innerHTML = `
      <div class="basket-grid">
        <div class="basket-main">
          <div class="basket-head">
            <h2 class="basket-count">${countLabel}</h2>
            <button class="basket-clear" type="button" data-action="clear-cart">${t("basket.emptyBtn")}</button>
          </div>
          ${cart.map(basketLine).join("")}
        </div>
        <aside class="basket-recap">
          <p class="basket-kicker">${t("basket.ready")}</p>
          <h2>${t("basket.summary")}</h2>
          <p class="basket-note">${noteLabel}</p>
          <dl class="basket-rows">
            <div><dt>${t("basket.subtotal")}</dt><dd>${cartTotalLabel()}</dd></div>
            <div><dt>${t("basket.fees")}</dt><dd class="basket-off">${t("basket.included")}</dd></div>
            <div class="basket-total"><dt>${t("basket.total")}</dt><dd>${cartTotalLabel()}</dd></div>
          </dl>
          <form id="checkout-form">
            <button class="button" type="submit">${t("basket.place")}</button>
            <p class="basket-legal">${t("basket.legal")}</p>
          </form>
          <div class="pay-cards">
            <p>${t("basket.cards")}</p>
            <ul>
              <li><img src="assets/cards/visa.svg" alt="Visa" width="56" height="36"></li>
              <li><img src="assets/cards/mastercard.svg" alt="Mastercard" width="56" height="36"></li>
              <li><img src="assets/cards/amex.svg" alt="American Express" width="56" height="36"></li>
            </ul>
          </div>
          <a class="basket-continue" href="index.html#calendar">${t("basket.continue")}</a>
          <ul class="basket-guarantees">
            <li>${t("basket.g1")}</li>
            <li>${t("basket.g2")}</li>
            <li>${t("basket.g3")}</li>
          </ul>
        </aside>
      </div>`;
  }

  function basketLine(item) {
    const race = races.find((entry) => entry.id === item.raceId);
    const ticket = ticketOf(race, item.tierId);
    if (!race || !ticket) return "";
    const flag = flags[race.country] || "bahrain.svg";
    const photo = photos[race.country] || "bahrain.webp";
    const key = `${item.raceId}:${item.tierId}`;
    return `
      <article class="basket-line">
        <a class="basket-thumb" href="billets.html?course=${race.id}" aria-label="${esc(race.country)}, ${esc(ticket.name)}">
          <img src="assets/races/${photo}?v=cards1" alt="" width="96" height="96">
        </a>
        <div class="basket-copy">
          <h3 class="basket-title"><img src="assets/flags/${flag}" alt="" width="28" height="18">${esc(race.country)}</h3>
          <p class="basket-meta">${esc(race.dates)}</p>
          <p class="basket-venue">${esc(race.circuit)}</p>
          <div class="basket-facts">
            <span>${esc(ticket.name)}</span>
            <span>${t("basket.each", { price: euro(ticket.price) })}</span>
          </div>
        </div>
        <div class="basket-actions">
          <span class="stepper" aria-label="${t("basket.qty")}">
            <button type="button" data-action="cart-qty" data-key="${key}" data-dir="-1" aria-label="${t("basket.less")}" ${item.qty <= 1 ? "disabled" : ""}>−</button>
            <output>${item.qty}</output>
            <button type="button" data-action="cart-qty" data-key="${key}" data-dir="1" aria-label="${t("basket.more")}" ${item.qty >= 8 ? "disabled" : ""}>+</button>
          </span>
          <strong class="basket-line-total">${euro(ticket.price * item.qty)}</strong>
          <button class="basket-remove" type="button" data-action="remove" data-key="${key}" aria-label="${t("basket.remove")}">×</button>
        </div>
      </article>`;
  }

  function basketEmpty() {
    return `
      <div class="basket-empty">
        <div class="basket-empty-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5.2 4H3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="20" r="1.3" fill="currentColor"/><circle cx="18" cy="20" r="1.3" fill="currentColor"/></svg>
        </div>
        <h2>${t("basket.emptyTitle")}</h2>
        <p>${t("basket.emptyCopy")}</p>
        <div class="basket-empty-actions">
          <a class="button" href="index.html#calendar">${t("basket.seeCal")}</a>
          <a class="basket-secondary" href="hospitality.html">${t("nav.hospitality")}</a>
        </div>
      </div>`;
  }

  function basketDone(name) {
    const line = name ? t("basket.doneNamed", { name: esc(name) }) : t("basket.done");
    return `
      <div class="basket-empty">
        <div class="basket-empty-mark" aria-hidden="true">✓</div>
        <h2>${t("basket.doneTitle")}</h2>
        <p>${line}</p>
        <a class="button" href="index.html">${t("basket.back")}</a>
      </div>`;
  }

  function addToCart(raceId, tierId, amount) {
    const existing = cart.find((item) => item.raceId === raceId && item.tierId === tierId);
    if (existing) existing.qty = Math.min(8, existing.qty + amount);
    else cart.push({ raceId, tierId, qty: amount });
    saveCart();
    const race = races.find((entry) => entry.id === raceId);
    toast(t("toast.added", { n: amount, place: race.country }));
  }

  function card(race, index) {
    const href = `billets.html?course=${race.id}`;
    return `
      <article class="tcard" id="race-${race.id}" data-region="${race.region}" style="--i:${index}">
        <a class="tcard__media" href="${href}" aria-label="${race.country}">
          <img class="tcard__photo" src="assets/races/${photos[race.country] || "bahrain.webp"}?v=cards1" alt="">
        </a>
        <div class="tcard__meta">
          <strong class="tcard__place">${race.country}</strong>
          <img class="tcard__flag" src="assets/flags/${flags[race.country] || "bahrain.svg"}" alt="">
          <span class="tcard__when">${race.dates}</span>
          <span class="tcard__price">${fromLabel(race)}</span>
        </div>
        <h3><a href="${href}">Formula 1 ${race.name} ${race.season}</a></h3>
        <a class="tcard__circuit" href="${href}">${race.circuit}</a>
        <div class="tcard__foot">
          <a class="button" href="${href}">${t("card.book")}</a>
          <a class="see-more" href="${href}">${t("card.more")}</a>
        </div>
      </article>`;
  }

  function raceOption(race, index) {
    return `<button class="race-option${race.id === pinnedId ? " is-on" : ""}" type="button" data-action="jump" data-race="${race.id}" style="--i:${index}"><img src="assets/flags/${flags[race.country] || "bahrain.svg"}" alt="" width="29" height="22"><span class="race-option__body"><span class="race-option__name">${race.country}</span><span class="race-option__meta">${race.dates}</span><span class="race-option__price">${fromLabel(race)}</span></span></button>`;
  }

  function countryGroups() {
    const seasonRaces = bySeason(season);
    return regions
      .filter((item) => item.id !== "all" && (region === "all" || region === item.id))
      .map((item) => {
        const list = seasonRaces.filter((race) => race.region === item.id);
        if (!list.length) return "";
        return `<section class="race-group"><p class="race-group__title">${t(item.key)}</p>${list.map(raceOption).join("")}</section>`;
      })
      .join("");
  }

  function visibleRaces() {
    return bySeason(season).filter((race) => region === "all" || race.region === region);
  }

  function renderCalendar() {
    const filters = document.getElementById("calendar-filters");
    const root = document.getElementById("calendar-root");
    if (!root) return;
    const list = visibleRaces();
    const showCountries = countriesOpen && region !== "all";
    const choices = `
      <p class="race-note">${t("cal.note")}</p>
      <p class="race-lead">${t("cal.lead")}</p>
      <div class="region-row" role="tablist" aria-label="${t("region.label")}">
        ${regions
          .map((item) => {
            const expanded = item.id !== "all" ? ` aria-expanded="${showCountries && region === item.id}"` : "";
            return `<button class="region-btn" type="button" data-action="region" data-region="${item.id}" aria-pressed="${region === item.id}"${expanded}>${t(item.key)}</button>`;
          })
          .join("")}
      </div>
      ${showCountries ? `<div class="race-options is-open" aria-label="${t("region.countries")}">${countryGroups()}</div>` : ""}`;
    const cards = `<div class="cards">${list.map(card).join("") || `<p class="empty">${t("cal.empty")}</p>`}</div>`;
    if (filters) {
      filters.innerHTML = choices;
      root.innerHTML = cards;
    } else {
      root.innerHTML = choices + cards;
    }
  }

  function renderHero() {
    const hero = document.getElementById("hero");
    if (!hero) return;
    hero.innerHTML = `
      <video class="hero-video" autoplay muted loop playsinline>
        <source src="assets/hero.mp4?v=2" type="video/mp4">
      </video>
      <div class="hero-inner">
        <p class="hero-copy">${t("hero.copy")}</p>
        <div class="hero-actions">
          <button class="button" type="button" data-action="season-jump" data-season="2027">${t("hero.cta")}</button>
        </div>
      </div>`;
  }

  function spotNodes(svg, keys) {
    const nodes = [];
    keys.forEach((key) => {
      if (key.startsWith("@")) return;
      const found = key.startsWith("[") ? svg.querySelectorAll(key) : svg.querySelectorAll(`[id="${key}"]`);
      found.forEach((node) => nodes.push(node));
    });
    return nodes;
  }

  function showSpot(race) {
    const host = document.querySelector(".buy__map");
    const canvas = host?.querySelector(".buy__canvas");
    const svg = canvas?.querySelector("svg");
    const ticket = race.tickets.find((entry) => entry.id === selectedTier);
    if (!host || !canvas || !svg || !ticket) return;
    canvas.querySelectorAll(".is-spot").forEach((node) => node.classList.remove("is-spot"));
    canvas.querySelector(".map-dot")?.remove();
    const caption = host.querySelector(".map-caption");
    if (caption) caption.textContent = ticket.name;
    const keys = (seatSpot[race.id] || {})[ticket.id] || [];
    const nodes = spotNodes(svg, keys);
    nodes.forEach((node) => node.classList.add("is-spot"));
    const hostRect = canvas.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    let x;
    let y;
    const pinKey = keys.find((key) => key.startsWith("@"));
    if (pinKey) {
      const [px, py] = pinKey.slice(1).split(",").map(Number);
      x = svgRect.left - hostRect.left + (svgRect.width * px) / 100;
      y = svgRect.top - hostRect.top + (svgRect.height * py) / 100;
    } else if (nodes.length) {
      const box = nodes.reduce(
        (acc, node) => {
          const rect = node.getBoundingClientRect();
          return {
            left: Math.min(acc.left, rect.left),
            top: Math.min(acc.top, rect.top),
            right: Math.max(acc.right, rect.right),
            bottom: Math.max(acc.bottom, rect.bottom),
          };
        },
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
      );
      x = (box.left + box.right) / 2 - hostRect.left;
      y = (box.top + box.bottom) / 2 - hostRect.top;
    }
    if (x == null) return;
    const dot = document.createElement("span");
    dot.className = "map-dot";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    canvas.appendChild(dot);
  }

  function mountMap(race) {
    const token = ++mapToken;
    const host = document.querySelector(".buy__map");
    if (!host) return;
    const draw = (text) => {
      if (token !== mapToken) return;
      host.innerHTML = `<div class="buy__canvas"></div>`;
      const canvas = host.querySelector(".buy__canvas");
      canvas.innerHTML = text.replace(/<\?xml[^?]*\?>/, "");
      canvas.insertAdjacentHTML("beforeend", `<p class="map-caption"></p>`);
      const svg = canvas.querySelector("svg");
      if (svg) {
        svg.classList.add("circuit");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", race.circuit);
        try {
          const box = svg.getBBox();
          if (box.width && box.height) {
            const pad = Math.max(box.width, box.height) * 0.08;
            svg.setAttribute("viewBox", `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`);
          }
        } catch (error) {
          /* keep the original view */
        }
      }
      showSpot(race);
    };
    const cached = svgCache.get(race.id);
    if (cached) {
      draw(cached);
      return;
    }
    fetch(`assets/circuits/${race.id}.svg?v=spot5`)
      .then((response) => response.text())
      .then((text) => {
        svgCache.set(race.id, text);
        draw(text);
      })
      .catch(() => {});
  }

  function pickSpot(tierId) {
    selectedTier = tierId;
    document.querySelectorAll(".opt").forEach((el) => el.classList.toggle("is-on", el.dataset.tier === selectedTier));
    const race = races.find((entry) => entry.id === selectedId);
    if (race) showSpot(race);
    if (window.matchMedia("(max-width: 860px)").matches) {
      document.querySelector(".buy__map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderTickets() {
    const picker = document.getElementById("race-picker");
    const panel = document.getElementById("ticket-panel");
    if (!picker || !panel) return;
    const pool = races.filter((race) => race.season === season || race.id === selectedId);
    const race = races.find((entry) => entry.id === selectedId) || pool[0];
    selectedId = race.id;
    const options = [...race.tickets].sort((a, b) => {
      if (!!a.sold !== !!b.sold) return a.sold ? 1 : -1;
      return (a.price || 0) - (b.price || 0);
    });
    if (!options.some((ticket) => ticket.id === selectedTier)) {
      selectedTier = (options.find((ticket) => !ticket.sold) || options[0]).id;
    }

    picker.innerHTML = bySeason(season)
      .map(
        (entry) => `
        <button class="picker-item" type="button" data-action="select-race" data-race="${entry.id}" aria-pressed="${entry.id === race.id}">
          <img src="assets/flags/${flags[entry.country] || "bahrain.svg"}" alt="">
          <span class="picker-copy">
            <strong>${entry.country}</strong>
            <em>${entry.dates}</em>
          </span>
        </button>`
      )
      .join("");
    const currentPick = picker.querySelector('[aria-pressed="true"]');
    if (currentPick) {
      if (picker.scrollWidth > picker.clientWidth + 8) picker.scrollLeft = Math.max(0, currentPick.offsetLeft - 12);
      else picker.scrollTop = Math.max(0, currentPick.offsetTop - 8);
    }
    const openCount = options.filter((ticket) => !ticket.sold).length;
    const soldCount = options.length - openCount;

    panel.innerHTML = `
      <section class="buy">
        <div class="buy__head">
          <img class="buy__photo" src="assets/races/${photos[race.country] || "bahrain.webp"}?v=cards1" alt="">
          <img class="buy__flag" src="assets/flags/${flags[race.country] || "bahrain.svg"}" alt="">
          <div class="buy__id">
            <h2 class="buy__title">${race.country}</h2>
            <p>${race.dates} · ${t("buy.weekend")}</p>
          </div>
          <p class="buy__from"><span>${t("buy.from")}</span><b>${euro(fromPrice(race))}</b></p>
        </div>
        <div class="buy__grid">
          <div class="buy__list">
            <div class="buy__list-head">
              <h3>${race.circuit}</h3>
              <p class="buy__count">${t("buy.available", { n: openCount })}${soldCount ? t("buy.soldSep", { n: soldCount }) : ""}</p>
            </div>
            ${options
              .map(
                (ticket) => `
              <article class="opt${ticket.sold ? " is-sold" : ""}${ticket.id === selectedTier ? " is-on" : ""}" data-tier="${ticket.id}">
                <h4>${ticket.name}</h4>
                <p class="opt__when">${t("buy.days")}</p>
                ${
                  ticket.sold
                    ? `<span class="opt__sold">${t("buy.soldOut")}</span>`
                    : `<b class="opt__price">${euro(ticket.price)}</b>
                <button class="button buy-go" type="button" data-action="book" data-race="${race.id}" data-tier="${ticket.id}">${t("buy.select")}</button>`
                }
              </article>`
              )
              .join("")}
          </div>
          <div class="buy__map"></div>
        </div>
      </section>`;
    mountMap(race);
  }

  function renderStandings() {
    const table = document.getElementById("standings-table");
    if (!table) return;
    const rows = standingsTab === "drivers" ? drivers : teams;
    table.innerHTML = rows
      .map(
        (row) => `
        <article class="table-row">
          <span class="pos">${row.pos}</span>
          <span class="swatch" style="background:${row.color}"></span>
          <strong>${row.name}</strong>
          <span class="team-col">${row.team || t("stand.constructor")}</span>
          <span class="pts">${row.pts} ${t("stand.pts")}</span>
        </article>`
      )
      .join("");
    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tab === standingsTab));
    });
  }

  function openWait(raceId) {
    waitRaceId = raceId;
    const race = races.find((entry) => entry.id === raceId);
    openModal("wait");
    document.querySelector("[data-wait-race]").textContent = race ? `${race.name} ${race.season}` : "";
  }

  document.getElementById("nav").addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    document.getElementById("nav").classList.remove("open");
    document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
  });

  function closeAccount() {
    const panel = document.getElementById("account-panel");
    const button = document.querySelector("[data-action='account']");
    if (panel) panel.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  function closeLang() {
    const panel = document.getElementById("lang-panel");
    const button = document.querySelector("[data-action='lang']");
    if (panel) panel.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".account-menu")) closeAccount();
    if (!event.target.closest(".lang-menu")) closeLang();
    const card = event.target.closest(".opt");
    if (card && !event.target.closest(".buy-go")) pickSpot(card.dataset.tier);
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;

    if (action === "menu") {
      const nav = document.getElementById("nav");
      const open = nav.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
    }
    if (button.closest("#nav") && action !== "menu") {
      document.getElementById("nav").classList.remove("open");
      document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
    }
    if (action === "close-modal") closeModals();
    if (action === "safe") openModal("safe");
    if (action === "contact") {
      const form = document.getElementById("contact-form");
      if (form) form.reset();
      openModal("contact");
    }
    if (action === "lang") {
      const panel = document.getElementById("lang-panel");
      const open = panel.hidden;
      closeAccount();
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    }
    if (action === "set-lang" && window.I18N) I18N.set(button.dataset.lang);
    if (action === "account") {
      const panel = document.getElementById("account-panel");
      const open = panel.hidden;
      closeLang();
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    }
    if (action === "wait") openWait(button.dataset.race);

    if (action === "season-jump") {
      region = "all";
      countriesOpen = false;
      pinnedId = "";
      renderCalendar();
      document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth" });
    }

    if (action === "region") {
      const next = button.dataset.region;
      if (next === "all" || (region === next && countriesOpen)) {
        region = next;
        countriesOpen = false;
      } else {
        region = next;
        countriesOpen = true;
      }
      pinnedId = "";
      renderCalendar();
    }

    if (action === "jump") {
      pinnedId = button.dataset.race;
      renderCalendar();
      const cardNode = document.getElementById(`race-${button.dataset.race}`);
      document.querySelectorAll(".tcard").forEach((node) => node.classList.remove("is-target"));
      cardNode?.classList.add("is-target");
      cardNode?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (action === "select-race") {
      selectedId = button.dataset.race;
      selectedTier = "";
      history.replaceState(null, "", `billets.html?course=${selectedId}`);
      renderTickets();
    }

    if (action === "qty") {
      const id = button.dataset.tier;
      qty[id] = Math.min(8, Math.max(1, qty[id] + Number(button.dataset.dir)));
      const output = document.getElementById(`qty-${id}`);
      if (output) output.textContent = String(qty[id]);
    }

    if (action === "add") addToCart(button.dataset.race, button.dataset.tier, qty[button.dataset.tier]);
    if (action === "book") {
      pickSpot(button.dataset.tier);
      addToCart(button.dataset.race, button.dataset.tier, 1);
      location.href = "basket.html";
    }

    if (action === "clear-cart") {
      placedName = "";
      cart = [];
      saveCart();
    }

    if (action === "remove") {
      const [raceId, tierId] = button.dataset.key.split(":");
      cart = cart.filter((item) => !(item.raceId === raceId && item.tierId === tierId));
      saveCart();
    }

    if (action === "cart-qty") {
      const [raceId, tierId] = button.dataset.key.split(":");
      const item = cart.find((entry) => entry.raceId === raceId && entry.tierId === tierId);
      if (!item) return;
      const next = item.qty + Number(button.dataset.dir);
      if (next < 1 || next > 8) return;
      item.qty = next;
      saveCart();
    }

    if (action === "hosp-filter") {
      hospFilter = button.dataset.filter;
      renderHospitality();
    }

    if (action === "hosp-packs") openPacks(button.dataset.race);
    if (action === "hosp-add") addToCart(button.dataset.race, button.dataset.tier, 1);
    if (action === "tickets-print") window.print();
    if (action === "tickets-other") showBookingLookup();
    if (action === "tickets-out") {
      localStorage.removeItem(BOOK_KEY);
      const form = document.getElementById("retrieve-form");
      if (form) form.reset();
      const result = document.querySelector("[data-retrieve-result]");
      if (result) result.innerHTML = "";
      showBookingLookup();
    }

    if (action === "tab") {
      standingsTab = button.dataset.tab;
      renderStandings();
    }
  });

  document.querySelectorAll(".backdrop").forEach((node) => {
    node.addEventListener("click", (event) => {
      if (event.target === node) closeModals();
    });
  });

  document.addEventListener("submit", async (event) => {
    if (event.target?.id !== "checkout-form") return;
    event.preventDefault();
    if (!cart.length) return;
    const form = event.target;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = t("checkout.redirect");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang: window.I18N ? I18N.lang : "en",
          items: cart.map((item) => ({ raceId: item.raceId, tierId: item.tierId, qty: item.qty })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) throw new Error(payload.error || t("checkout.fail"));
      location.href = payload.url;
    } catch (error) {
      button.disabled = false;
      button.textContent = t("basket.place");
      toast(error instanceof Error ? error.message : t("checkout.fail"));
    }
  });

  document.getElementById("wait-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const list = JSON.parse(localStorage.getItem(WAIT_KEY) || "[]");
    list.push({
      raceId: waitRaceId,
      name: data.get("name"),
      email: data.get("email"),
    });
    localStorage.setItem(WAIT_KEY, JSON.stringify(list));
    event.currentTarget.classList.add("hidden");
    document.querySelector("[data-wait-success]").classList.remove("hidden");
  });

  document.getElementById("contact-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const list = JSON.parse(localStorage.getItem("apex-contact") || "[]");
    list.push({
      topic: data.get("topic"),
      reference: data.get("reference"),
      name: data.get("name"),
      email,
      message: data.get("message"),
      at: new Date().toISOString(),
    });
    localStorage.setItem("apex-contact", JSON.stringify(list));
    const reply = document.querySelector("[data-contact-reply]");
    if (reply) reply.textContent = t("contact.reply", { email });
    event.currentTarget.reset();
    event.currentTarget.classList.add("hidden");
    document.querySelector("[data-contact-success]").classList.remove("hidden");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAccount();
      closeLang();
      closeModals();
    }
  });

  const DEMO_EMAIL = "alex@example.com";
  const DEMO_PASSWORD = "K7NP-4RQM";

  function demoOrder() {
    return {
      reference: "F1-1042",
      status: "processing",
      statusLabel: "Paid",
      total: "2 422,00 €",
      placed: "1 October 2026",
      tickets: [
        { id: "F1-1042-01", event: "Bahrain", category: "General admission", when: "12 – 14 Mar 2027", raceDate: "2027-03-14", issued: true, code: "F1-1042-01.A1B2C3D4" },
        { id: "F1-1042-02", event: "Bahrain", category: "General admission", when: "12 – 14 Mar 2027", raceDate: "2027-03-14", issued: true, code: "F1-1042-02.B2C3D4E5" },
        { id: "F1-1042-03", event: "Monaco", category: "Paddock Club", when: "4 – 6 Jun 2027", raceDate: "2027-06-06", issued: true, code: "F1-1042-03.C3D4E5F6" },
      ],
    };
  }

  function savedBooking() {
    try {
      const value = JSON.parse(localStorage.getItem(BOOK_KEY) || "null");
      if (value && value.email && value.payload) return value;
    } catch { /* ignore a broken saved booking */ }
    return null;
  }

  function showBookingLookup() {
    const lookup = document.getElementById("booking-lookup");
    const wallet = document.getElementById("booking-wallet");
    const lead = document.getElementById("booking-lead");
    if (lookup) lookup.hidden = false;
    if (wallet) wallet.hidden = true;
    if (!lead) return;
    lead.classList.remove("is-account");
    lead.querySelector(".booking-kicker").textContent = t("book.kicker");
    lead.querySelector("h1").textContent = t("book.title");
    lead.querySelector("p:last-of-type").textContent = t("book.lead");
  }

  function dayStamp(iso) {
    const [year, month, date] = String(iso || "").split("-").map(Number);
    if (!year || !month || !date) return null;
    return new Date(year, month - 1, date);
  }

  function gateFor(ticket) {
    if (ticket.state) return { state: ticket.state, opens: ticket.opens || "" };
    const race = dayStamp(ticket.raceDate);
    if (!race) return { state: ticket.code ? "ready" : "unpaid", opens: "" };
    const opens = new Date(race);
    opens.setDate(opens.getDate() - 12);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let state = "upcoming";
    if (today > race) state = "closed";
    else if (today >= opens) state = "ready";
    const label = new Intl.DateTimeFormat(window.I18N ? I18N.locale : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(opens);
    return { state, opens: label };
  }

  function showTicketWallet(payload, email) {
    const lookup = document.getElementById("booking-lookup");
    const wallet = document.getElementById("booking-wallet");
    const lead = document.getElementById("booking-lead");
    if (!wallet || !lead) return;
    if (lookup) lookup.hidden = true;
    wallet.hidden = false;
    const tickets = payload.tickets || [];
    const gates = tickets.map((ticket) => gateFor(ticket));
    const issued = gates.some((gate, index) => gate.state === "ready" && tickets[index].code);
    const tone = /cancel|refund|fail/i.test(payload.status || "") ? "is-stop" : /pending|hold/i.test(payload.status || "") ? "is-wait" : "";
    lead.classList.add("is-account");
    lead.querySelector(".booking-kicker").textContent = t("book.account");
    lead.querySelector("h1").textContent = t("book.yours");
    lead.querySelector("p:last-of-type").textContent = email || payload.reference || "";
    const cards = tickets.map((ticket, index) => {
      const gate = gates[index];
      const ready = gate.state === "ready" && ticket.code && typeof qrSvg === "function";
      const stub = ready
        ? `<div class="pass__qr">${qrSvg(ticket.code)}</div>`
        : `<div class="pass__wait"><p>${gate.state === "closed" ? t("pass.closed") : gate.state === "unpaid" ? t("pass.after") : t("pass.opens")}</p><strong>${esc(gate.state === "upcoming" ? gate.opens : gate.state === "closed" ? t("pass.finished") : gate.state === "unpaid" ? t("pass.unlock") : "")}</strong></div>`;
      const raw = String(ready ? ticket.code : ticket.id || "");
      const split = raw.lastIndexOf(".");
      const serial = split > 0 ? raw.slice(0, split) : raw;
      const check = ready && split > 0 ? raw.slice(split + 1) : "";
      return `<article class="pass${ready ? "" : " is-locked"}">
        <div class="pass__spine" aria-hidden="true"></div>
        <div class="pass__body">
          <div class="pass__top">
            <p class="pass__kicker">${t("pass.admit")}</p>
            <p class="pass__index">${t("pass.of", { i: index + 1, n: tickets.length })}</p>
          </div>
          <h2>${esc(ticket.event)}</h2>
          <p class="pass__cat">${esc(ticket.category)}</p>
          <dl class="pass__meta">
            <div><dt>${t("pass.weekend")}</dt><dd>${esc(ticket.when || "—")}</dd></div>
            <div><dt>${t("pass.holder")}</dt><dd>${esc(email)}</dd></div>
          </dl>
          <p class="pass__code"><span>${esc(serial)}</span>${check ? `<span>${esc(check)}</span>` : ""}</p>
        </div>
        <div class="pass__stub">${stub}</div>
      </article>`;
    }).join("");
    const note = issued ? t("pass.noteOpen") : t("pass.noteWait");
    const statusKey = {
      pending: "status.pending",
      processing: "status.paid",
      completed: "status.confirmed",
      "on-hold": "status.hold",
      cancelled: "status.cancelled",
      refunded: "status.refunded",
      failed: "status.failed",
    }[payload.status];
    const access = payload.password
      ? `<section class="account-card"><p class="booking-kicker">${esc(t("book.password"))}</p><p class="pass__code"><span>${esc(payload.password)}</span></p><p class="pass-note">${esc(t("book.hint"))}</p></section>`
      : "";
    wallet.innerHTML = `
      ${access}
      <section class="account-card">
        <div class="account-card__top">
          <div class="account-card__id">
            <p>${esc(payload.reference || t("pass.order"))}</p>
            <span class="booking-pill ${tone}">${esc(statusKey ? t(statusKey) : payload.statusLabel || t("pass.booking"))}</span>
          </div>
          <div class="wallet-actions">
            ${issued ? `<button type="button" data-action="tickets-print">${t("pass.print")}</button>` : ""}
            <button type="button" data-action="tickets-other">${t("pass.other")}</button>
            <button type="button" data-action="tickets-out">${t("pass.out")}</button>
          </div>
        </div>
        <dl class="account-facts">
          <div><dt>${t("pass.passes")}</dt><dd>${tickets.length}</dd></div>
          <div><dt>${t("pass.total")}</dt><dd>${esc(payload.total || "—")}</dd></div>
          <div><dt>${t("pass.placed")}</dt><dd>${esc(payload.placed || "—")}</dd></div>
        </dl>
      </section>
      <h2 class="account-label">${t("pass.passes")}</h2>
      <div class="pass-list">${cards || `<p class="pass-note">${t("pass.none")}</p>`}</div>
      <p class="pass-note">${note}</p>`;
  }

  function rememberBooking(email, payload) {
    localStorage.setItem(BOOK_KEY, JSON.stringify({ email, payload }));
    const result = document.querySelector("[data-retrieve-result]");
    if (result) result.innerHTML = "";
    showTicketWallet(payload, email);
  }

  async function lookupBooking(email, password, submit) {
    const result = document.querySelector("[data-retrieve-result]");
    if (!result) return;
    if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      rememberBooking(DEMO_EMAIL, demoOrder());
      return;
    }
    if (submit) submit.disabled = true;
    result.textContent = t("book.looking");
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || t("book.miss"));
      rememberBooking(email, payload);
    } catch (error) {
      showBookingLookup();
      result.innerHTML = `<p class="booking-miss">${esc(error instanceof Error ? error.message : t("book.miss"))}</p>`;
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  const retrieveForm = document.getElementById("retrieve-form");
  if (retrieveForm) {
    retrieveForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      lookupBooking(String(data.get("email") || ""), String(data.get("password") || ""), event.currentTarget.querySelector("button[type=submit]"));
    });
    const params = new URLSearchParams(location.search);
    const saved = savedBooking();
    const paidOrder = params.get("order") || "";
    if (params.get("demo") === "1") rememberBooking(DEMO_EMAIL, demoOrder());
    else if (params.get("paid") === "1" && /^F1-\d+$/.test(paidOrder)) openPaidReturn(paidOrder, params.get("key") || "");
    else if (saved) rememberBooking(saved.email, saved.payload);
    if (saved) retrieveForm.email.value = saved.email;
  }

  async function openPaidReturn(order, key) {
    const result = document.querySelector("[data-retrieve-result]");
    if (result) result.textContent = t("book.looking");
    try {
      const response = await fetch("/api/retour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order, key }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.booking) throw new Error(t("book.paidNote"));
      const view = payload.booking;
      if (payload.password) view.password = payload.password;
      rememberBooking(payload.email || "", view);
    } catch {
      if (result) result.textContent = t("book.paidNote");
    }
  }

  const editions = {
    chn: "Paddock pop-up",
    mon: "Gordon Ramsay at F1 La Terrasse",
    ita: "Monza Special Edition",
    esp: "Madrid Special Edition",
    usa: "Austin Special Edition",
    mex: "House 44 at Paddock Club™",
  };

  function renderHospitality() {
    const root = document.getElementById("hosp-list");
    if (!root) return;
    document.querySelectorAll("[data-action='hosp-filter']").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.filter === hospFilter));
    });
    const list = races
      .filter((race) => race.season === season)
      .filter((race) => {
        const clubs = (race.tickets || []).filter((ticket) => ticket.kind === "club");
        const local = clubs.some((ticket) => !/paddock/i.test(ticket.name));
        if (hospFilter === "paddock") return true;
        if (hospFilter === "local") return local || !clubs.length;
        if (hospFilter === "edition") return Boolean(editions[race.id]);
        return true;
      });
    root.innerHTML = list.map((race, index) => {
      const clubs = (race.tickets || []).filter((ticket) => ticket.kind === "club").slice().sort((a, b) => a.price - b.price);
      const names = clubs.slice(0, 3).map((ticket) => ticket.name);
      const extra = clubs.length - names.length;
      const from = clubs.length ? t("card.from", { price: euro(clubs[0].price) }) : t("hosp.request");
      const packs = names.length ? `${names.join(" · ")}${extra > 0 ? ` · +${extra}` : ""}` : t("hosp.fallback");
      const title = editions[race.id] || "Paddock Club";
      return `<article class="tcard" style="--i:${index}">
        <button class="tcard__media" type="button" data-action="hosp-packs" data-race="${race.id}" aria-label="${race.country}">
          <img class="tcard__photo" src="assets/races/${photos[race.country] || "bahrain.webp"}?v=cards1" alt="">
        </button>
        <div class="tcard__meta">
          <strong class="tcard__place">${race.country}</strong>
          <img class="tcard__flag" src="assets/flags/${flags[race.country] || "bahrain.svg"}" alt="">
          <span class="tcard__when">${race.dates}</span>
          <span class="tcard__price">${from}</span>
        </div>
        <h3><button type="button" data-action="hosp-packs" data-race="${race.id}">${title}</button></h3>
        <button class="tcard__circuit" type="button" data-action="hosp-packs" data-race="${race.id}">${packs}</button>
        <div class="tcard__foot">
          <button class="button" type="button" data-action="hosp-packs" data-race="${race.id}">${t("hosp.view")}</button>
          <button class="see-more" type="button" data-action="hosp-packs" data-race="${race.id}">${t("card.more")}</button>
        </div>
      </article>`;
    }).join("") || `<p class="empty">${t("hosp.noneRound")}</p>`;
  }

  const packsByKind = {
    track: ["entrance", "garage", "track"],
    view: ["terrace", "track"],
    dining: ["dine-room", "dining", "restaurant", "dine-dark"],
    water: ["yacht", "marina"],
    lounge: ["terrace", "beach", "pool", "bar-cocktails", "bar"],
    suite: ["restaurant", "dine-room", "dine-dark", "beach", "pool", "terrace"],
  };
  const packNotes = {
    track: "pack.track",
    view: "pack.view",
    dining: "pack.dining",
    water: "pack.water",
    lounge: "pack.lounge",
    suite: "pack.suite",
  };

  function packKind(name) {
    const n = name.toLowerCase();
    if (/ramsay|chef|dining/.test(n)) return "dining";
    if (/marine|yacht|marina|riviera|boat/.test(n)) return "water";
    if (/skybox|skysuite|sky suite/.test(n)) return "view";
    if (/paddock|house 44|pitstop|pit stop/.test(n)) return "track";
    if (/lounge|terrace|fan|village|plaza|cosmos|orange|speed|tent|sunset|luna/.test(n)) return "lounge";
    return "suite";
  }

  function packHash(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function packLook(name, raceId, tierId, used) {
    if (/paddock/i.test(name)) {
      return { img: "assets/hosp/entrance.webp?v=spot57", note: t(packNotes.track) };
    }
    const kind = packKind(name);
    const list = /house 44|pitstop|pit stop|pitlane|pit lane/i.test(name)
      ? ["garage", "track", "entrance"]
      : /marine|yacht|marina|riviera|boat/i.test(name)
        ? ["yacht", "marina"]
        : /sunset|luna/i.test(name)
          ? ["beach", "pool", "terrace"]
          : /fan|village|tent/i.test(name)
            ? ["terrace", "beach", "pool"]
            : packsByKind[kind];
    const pinned = /paddock|house 44|pitstop|pit stop|pitlane|pit lane|marine|yacht|marina|riviera|boat|fan|village|tent/i.test(name);
    const start = pinned ? 0 : packHash(`${raceId}:${tierId}`) % list.length;
    for (let step = 0; step < list.length; step++) {
      const id = list[(start + step) % list.length];
      if (!used.has(id)) {
        used.add(id);
        return { img: `assets/hosp/${id}.webp?v=spot57`, note: t(packNotes[kind]) };
      }
    }
    const id = list[start % list.length];
    return { img: `assets/hosp/${id}.webp?v=spot57`, note: t(packNotes[kind]) };
  }

  function openPacks(raceId) {
    const race = races.find((entry) => entry.id === raceId);
    if (!race) return;
    const clubs = (race.tickets || []).filter((ticket) => ticket.kind === "club").slice().sort((a, b) => a.price - b.price);
    const photo = document.querySelector("[data-packs-photo]");
    photo.src = `assets/races/${photos[race.country] || "bahrain.webp"}?v=cards1`;
    photo.alt = `${race.country} Grand Prix`;
    const flag = document.querySelector("[data-packs-flag]");
    flag.src = `assets/flags/${flags[race.country] || "bahrain.svg"}`;
    document.getElementById("packs-title").textContent = race.country;
    document.querySelector("[data-packs-meta]").textContent = `${race.dates} · ${race.name}`;
    const list = document.querySelector("[data-packs-list]");
    const used = new Set();
    list.innerHTML = clubs.length
      ? clubs.map((ticket) => {
          const look = packLook(ticket.name, race.id, ticket.id, used);
          return `
          <article class="pack-card">
            <img src="${look.img}" alt="">
            <div class="pack-card__body">
              <div>
                <strong>${ticket.name}</strong>
                <span>${look.note}</span>
              </div>
              <div class="pack-card__buy">
                <b>${euro(ticket.price)}</b>
                <button class="button" type="button" data-action="hosp-add" data-race="${race.id}" data-tier="${ticket.id}">${t("pack.add")}</button>
              </div>
            </div>
          </article>`;
        }).join("")
      : `<p class="empty">${t("pack.empty")}</p>`;
    openModal("hosp-pack");
  }

  function bindHospCompare() {
    const track = document.querySelector(".hosp-track");
    const dots = document.querySelectorAll(".hosp-dots i");
    if (!track || !dots.length) return;
    const mark = () => {
      const width = track.clientWidth || 1;
      const index = Math.min(dots.length - 1, Math.max(0, Math.round(track.scrollLeft / width)));
      dots.forEach((dot, n) => dot.classList.toggle("is-on", n === index));
    };
    track.addEventListener("scroll", mark, { passive: true });
    mark();
  }

  if ((page === "basket" || page === "booking") && new URLSearchParams(location.search).get("paid") === "1") {
    cart = [];
    localStorage.setItem(CART_KEY, "[]");
    orderPaid = page === "basket";
    placedName = "";
  }
  renderCart();
  renderHero();
  renderCalendar();
  renderTickets();
  renderStandings();
  renderHospitality();
  bindHospCompare();
  document.documentElement.classList.add("i18n-ready");
})();
