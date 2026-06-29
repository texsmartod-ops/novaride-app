const state = {
  authMode: "phone",
  authFlow: "register",
  authStep: "start",
  authDestination: "",
  authSessionToken: "",
  authConfig: {
    googleClientId: "",
    appleClientId: "",
    mapboxToken: "",
  },
  currentUser: null,
  selectedPrice: 150,
  tripDistanceKm: 10,
  currentSection: "ride",
  driverMode: false,
  rideOrders: [],
  driverChatMessages: [],
  driverChatKey: "",
  hiddenDriverOrders: [],
  declinedOffers: {},
  language: "ru",
  distanceUnit: "km",
  savedAddresses: [
    { icon: "home", title: "Дом", address: "Одесса, Дерибасовская 1" },
    { icon: "work", title: "Работа", address: "Одесса, Екатерининская 18" },
    { icon: "gym", title: "Зал", address: "Французский бульвар 22" },
    { icon: "shop", title: "Магазин", address: "Gagarinn Plaza" },
  ],
};

const PENDING_AUTH_KEY = "novaride_pending_auth";
const VERIFIED_AUTH_KEY = "novaride_verified_auth";
const PERSISTENT_AUTH_KEY = "novaride_persistent_auth";
const ACTIVE_ORDER_KEY = "novaride_active_order";
const DRIVER_ACTIVE_ORDER_KEY = "novaride_driver_active_order";
const DRIVER_DETAIL_ORDER_KEY = "novaride_driver_detail_order";
const DRIVER_TAB_KEY = "novaride_driver_tab";
const ORDER_SEARCH_SECONDS = 40;
const MAX_ROUTE_STOPS = 5;
const STOP_POINT_LABELS = ["C", "D", "E", "F", "G"];

let MAPBOX_TOKEN = "";
const ODESSA_CENTER = [30.7233, 46.4825];
const ODESSA_SEARCH_BBOX = [30.25, 46.28, 31.05, 46.72];
const ODESSA_GEOCODE_TYPES = "address,poi,neighborhood,locality,place,district";
let novaMap;
let activeMapPoint = "a";
let pickupMarker;
let destinationMarker;
let stopMarkers = [];
let userLocationMarker;
let mapPoints = {
  a: [30.7326, 46.4858],
  b: [30.7597, 46.4304],
  stops: [],
};
let addressSearchTimer;
let accountCheckTimer;
let driverOrdersTimer;
let activeOrderTimer;
let driverAcceptedTimer;
let driverVerificationTimer;
let driverChatTimer;
let driverCarMarker;
let lastRouteKey = "";
let rideChatActiveUntil = 0;
const sendingRideMessages = new Set();

const ODESSA_PLACES = [
  { name: "Дерибасовская 1", subtitle: "Центр Одессы", aliases: ["дерибасовская"], center: [30.7355, 46.4846] },
  { name: "Аркадия", subtitle: "Гагаринское плато", aliases: ["аркадия"], center: [30.7612, 46.4311] },
  { name: "Парк Шевченко", subtitle: "ул. Маразлиевская / Ланжерон", aliases: ["шевченко", "парк"], center: [30.7559, 46.4751] },
  { name: "ЖД вокзал Одесса", subtitle: "Привокзальная площадь", aliases: ["вокзал", "жд", "залізничний"], center: [30.7408, 46.4667] },
  { name: "Привоз", subtitle: "рынок Привоз", aliases: ["привоз"], center: [30.7342, 46.4689] },
  { name: "Оперный театр", subtitle: "Театральная площадь", aliases: ["опера", "театр"], center: [30.7417, 46.4856] },
  { name: "Морской вокзал", subtitle: "порт Одесса", aliases: ["порт", "морвокзал", "морской"], center: [30.7498, 46.4927] },
  { name: "Таирова", subtitle: "Киевский район", aliases: ["таирова"], center: [30.6719, 46.4119] },
  { name: "Французский бульвар", subtitle: "Приморский район", aliases: ["французский"], center: [30.7623, 46.4534] },
  { name: "Gagarinn Plaza", subtitle: "Аркадия", aliases: ["gagarinn", "гагарин", "плаза"], center: [30.7614, 46.4319] },
  { name: "Сити Центр Таирова", subtitle: "просп. Небесной Сотни", aliases: ["сити центр", "city center", "сити"], center: [30.7131, 46.4096] },
  { name: "Сити Центр Котовский", subtitle: "поселок Котовского", aliases: ["city center котовский", "сити центр котовский"], center: [30.7358, 46.5825] },
  { name: "Яхт-клуб Одесса", subtitle: "побережье / Отрада", aliases: ["яхта", "яхт", "yacht", "яхт клуб"], center: [30.7647, 46.4656] },
  { name: "Черноморского Казачества", subtitle: "Пересыпский район", aliases: ["чорноморського козацтва", "казачества"], center: [30.7227, 46.5032] },
  { name: "Балтиморская 2", subtitle: "Одесса", aliases: ["балтиморская", "балтиморська"], center: [30.7526, 46.4353] },
  { name: "Семена Палия 96/1", subtitle: "Пересыпский район", aliases: ["семена палия", "semena paliia"], center: [30.7652, 46.5811] },
  { name: "Марсельская 8", subtitle: "поселок Котовского", aliases: ["марсельская", "марсельська"], center: [30.7574, 46.5844] },
];

const iconLabels = {
  home: "Дом",
  work: "Работа",
  gym: "Зал",
  shop: "Магазин",
  custom: "Место",
};

const sections = {
  history: {
    title: "История заказов",
    html: `
      <div class="section-hero"><span>Ваши маршруты</span><h2>История заказов</h2><p>Все поездки, водители и контакты в одном спокойном экране.</p></div>
      <div class="feature-grid" id="rideHistoryList">
        <article class="list-card"><strong>Загружаем историю...</strong><span>Здесь появятся завершенные реальные поездки.</span><em>NovaRide</em></article>
      </div>
    `,
  },
  addresses: {
    title: "Мои адреса",
    html: () => `
      <div class="section-hero"><span>Быстрый старт</span><h2>Мои адреса</h2><p>Любимые точки Одессы можно вызвать одним касанием.</p></div>
      <button class="add-address-card" id="addAddressBtn" type="button"><span>+</span><strong>Добавить адрес</strong><em>дом, офис, кафе или свое название</em></button>
      <div class="address-create-form is-hidden" id="addressCreateForm">
        <input id="newAddressName" placeholder="Название: Дом, работа, кафе" autocomplete="off" />
        <div class="address-field saved-address-field">
          <input id="newAddressValue" placeholder="Адрес или место в Одессе" autocomplete="off" />
          <div class="address-suggestions" data-suggestions="saved-address"></div>
        </div>
        <button class="primary-action" id="saveNewAddressBtn" type="button">Сохранить адрес</button>
      </div>
      <div class="address-grid">
        ${state.savedAddresses
          .map(
            (item, index) => `
              <article class="list-card address-card icon-${item.icon}" data-address-index="${index}" data-address="${item.address}">
                ${Array.isArray(item.center) ? `<span class="address-coordinates" data-center="${item.center.join(",")}"></span>` : ""}
                <i class="address-icon"></i>
                <div class="address-copy">
                  <strong>${item.title}</strong>
                  <span>${item.address}</span>
                </div>
                <div class="address-actions">
                  <button class="mini-action use-address" type="button">В поездку</button>
                  <button class="mini-action danger-action delete-address" type="button">Удалить</button>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `,
  },
  notifications: {
    title: "Уведомления",
    html: `
      <div class="section-hero"><span>Центр событий</span><h2>Уведомления</h2><p>Бонусы, поездки, безопасность и важные обновления сервиса.</p></div>
      <article class="list-card accent-card"><strong>Добро пожаловать в NovaRide</strong><span>Спасибо за регистрацию. Первый заказ уже можно оформить.</span><em>Новое</em></article>
      <article class="list-card"><strong>Бонус</strong><span>Сохраняйте любимые адреса и вызывайте авто быстрее.</span><em>-10%</em></article>
    `,
  },
  safety: {
    title: "Безопасность",
    html: `
      <div class="section-hero"><span>Защита поездки</span><h2>Безопасность</h2><p>Экстренная помощь, контроль маршрута и прозрачные правила.</p></div>
      <div class="feature-grid">
        <button class="list-card action-card accent-card" data-action="security"><strong>Служба безопасности</strong><span>Письмо или сообщение администратору</span><em>24/7</em></button>
        <button class="list-card action-card" data-action="emergency"><strong>Экстренный вызов 112</strong><span>Быстрый вызов службы помощи</span><em>SOS</em></button>
        <button class="list-card action-card" data-action="privacy"><strong>Политика конфиденциальности</strong><span>Текст о защите данных NovaRide</span><em>Data</em></button>
      </div>
      <div class="interactive-box" id="sectionActionBox"></div>
    `,
  },
  settings: {
    title: "Настройки",
    html: `
      <div class="section-hero"><span>Персонализация</span><h2>Настройки</h2><p>Тема, язык, документы и управление аккаунтом.</p></div>
      <div class="feature-grid">
        <article class="list-card control-card"><strong>Тема</strong><div class="setting-row"><button data-theme="light">Светлая</button><button data-theme="dark">Темная</button><button data-theme="system">Система</button></div></article>
        <article class="list-card control-card"><strong>Язык</strong><div class="setting-row"><button data-lang="uk">Укр</button><button data-lang="ru">Рус</button><button data-lang="en">Eng</button></div></article>
        <article class="list-card control-card"><strong>Расстояние</strong><div class="setting-row"><button data-unit="km">км</button><button data-unit="mi">mi</button></div></article>
        <button class="list-card action-card" data-action="legal"><strong>Правовые документы</strong><span>Оферта, лицензии, приватность</span><em>Legal</em></button>
        <article class="list-card"><strong>Версия приложения</strong><span>1.1.0</span><em>Nova</em></article>
        <article class="list-card control-card"><strong>Аккаунт</strong><div class="setting-row danger"><button data-account="logout">Выйти</button><button data-account="delete">Удалить</button></div></article>
      </div>
      <div class="interactive-box" id="sectionActionBox"></div>
    `,
  },
  help: {
    title: "Помощь",
    html: `
      <div class="section-hero"><span>Мы рядом</span><h2>Помощь</h2><p>Поддержка клиента и водителя без долгого поиска нужной кнопки.</p></div>
      <button class="list-card action-card accent-card" data-action="support"><strong>Техподдержка</strong><span>Открыть чат с администратором</span><em>online</em></button>
        <button class="list-card action-card" data-action="faq"><strong>Частые вопросы</strong><span>Вопросы и ответы по поездкам</span><em>FAQ</em></button>
      <div class="interactive-box" id="sectionActionBox"></div>
    `,
  },
};

const driverTabs = {
  feed: `
    <div class="section-hero driver-hero compact driver-line-hero"><span>Режим водителя</span><h2>Заказы</h2><em>На линии</em></div>
    <div class="driver-feed" id="driverFeed"><article class="driver-empty-card">Загружаем реальные заказы...</article></div>
    <div class="driver-route-preview" id="driverRoutePreview"></div>
  `,
  stats: `
    <div class="section-hero driver-hero compact"><span>Динамика</span><h2>Статистика</h2></div>
    <div class="feature-grid"><article class="metric-card"><strong>4.86</strong><span>рейтинг</span></article><article class="metric-card"><strong>1 280 грн</strong><span>сегодня</span></article><article class="metric-card"><strong>8 740 грн</strong><span>неделя</span></article><article class="metric-card"><strong>34 600 грн</strong><span>месяц</span></article></div>
  `,
  wallet: `
    <div class="section-hero driver-hero"><span>Баланс</span><h2>Кошелек</h2><p>Комиссия NovaRide списывается только с завершенных заказов.</p></div>
    <article class="wallet-card"><strong>640 грн</strong><span>доступный баланс</span><em>комиссия 10%</em></article>
    <button class="primary-action" type="button">Пополнить баланс</button>
  `,
};

const driverSections = {
  history: {
    title: "История поездок",
    html: `
      <div class="section-hero driver-hero"><span>Мои рейсы</span><h2>История поездок</h2><p>Поездки, которые вы уже выполнили как водитель.</p></div>
      <div class="feature-grid" id="driverHistoryList">
        <article class="list-card"><strong>Загружаем историю...</strong><span>Здесь появятся завершенные реальные поездки.</span><em>NovaRide</em></article>
      </div>
    `,
  },
  driverChat: {
    title: "Чат водителей",
    html: () => renderDriverCommunityChat(),
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function setAuthStep(step) {
  state.authStep = step;
  $$("[data-auth-step]").forEach((panel) => panel.classList.toggle("is-hidden", panel.dataset.authStep !== step));
  $$(".progress-dot").forEach((dot) => dot.classList.toggle("is-active", dot.dataset.stepDot === step));
  $("#authKicker").textContent = state.authFlow === "login" ? "Вход в профиль" : "Создать аккаунт";

  if (step === "start") {
    $("#authTitle").textContent = state.authFlow === "login" ? "Войдите в NovaRide" : "Добро пожаловать в NovaRide";
    $("#authSubtitle").textContent =
      state.authFlow === "login"
        ? "Войдите по телефону или email, чтобы открыть сохраненный профиль."
        : "Выберите телефон или email, подтвердите код и настройте профиль.";
  }

  if (step === "code") {
    $("#authTitle").textContent = "Проверка кода";
    $("#authSubtitle").textContent = "Это отдельный шаг, чтобы не листать форму вниз.";
    $("#codeInput").focus();
  }

  if (step === "profile") {
    $("#authTitle").textContent = "Ваш профиль";
    $("#authSubtitle").textContent = "Заполните обязательные данные. Фото можно добавить сейчас или позже.";
  }
}

function setAuthFlow(flow) {
  state.authFlow = flow;
  $$(".mode-button").forEach((button) => button.classList.toggle("is-active", button.dataset.authFlow === flow));
  hideStartAccountWarning();
  scheduleAccountCheck();
  setAuthStep("start");
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isSocial = mode === "google" || mode === "apple";
  hideStartAccountWarning();
  $$(".auth-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.auth === mode));
  $(".phone-field").classList.toggle("is-hidden", mode !== "phone");
  $(".email-field").classList.toggle("is-hidden", mode !== "email");
  $("#sendCodeBtn").classList.toggle("is-hidden", isSocial);
  $("#socialAuthBox").classList.toggle("is-hidden", !isSocial);
  renderSocialAuth();
  scheduleAccountCheck();
}

function savePendingAuth() {
  if (!state.authSessionToken || !state.authDestination) return;

  const payload = JSON.stringify({
    token: state.authSessionToken,
    destination: state.authDestination,
    mode: state.authMode,
    flow: state.authFlow,
  });

  sessionStorage.setItem(PENDING_AUTH_KEY, payload);
  localStorage.setItem(VERIFIED_AUTH_KEY, payload);
}

function clearPendingAuth() {
  sessionStorage.removeItem(PENDING_AUTH_KEY);
  localStorage.removeItem(VERIFIED_AUTH_KEY);
}

function savePersistentAuth(user = state.currentUser) {
  if (!state.authSessionToken || !user) return;

  localStorage.setItem(
    PERSISTENT_AUTH_KEY,
    JSON.stringify({
      token: state.authSessionToken,
      destination: state.authDestination || user.destination || "",
      mode: user.channel === "email" ? "email" : "phone",
      user,
    }),
  );
}

function clearPersistentAuth() {
  localStorage.removeItem(PERSISTENT_AUTH_KEY);
}

function clearDriverVerificationWatch() {
  clearInterval(driverVerificationTimer);
  driverVerificationTimer = null;
}

function startDriverVerificationWatch() {
  if (driverVerificationTimer) return;

  driverVerificationTimer = window.setInterval(async () => {
    if (!state.currentUser || !state.driverMode) return;

    const wasApproved = isDriverApproved();
    await refreshDriverVerificationStatus();
    const isApprovedNow = isDriverApproved();

    if (wasApproved && !isApprovedNow) {
      localStorage.removeItem(DRIVER_ACTIVE_ORDER_KEY);
      localStorage.removeItem(DRIVER_DETAIL_ORDER_KEY);
      clearInterval(driverOrdersTimer);
      clearInterval(driverAcceptedTimer);
      showDriverVerificationGate();
    } else if (!wasApproved && isApprovedNow) {
      showDriverContent(localStorage.getItem(DRIVER_TAB_KEY) || "feed");
    }
  }, 6000);
}

function restorePersistentAuth() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERSISTENT_AUTH_KEY) || "null");
    if (!saved?.token || !saved?.user) return false;

    state.authSessionToken = saved.token;
    state.authDestination = saved.destination || saved.user.destination || "";
    state.authMode = saved.mode === "email" ? "email" : "phone";
    enterApp(saved.user, { persist: false });
    return true;
  } catch {
    clearPersistentAuth();
    return false;
  }
}

function restorePendingAuthToken() {
  if (state.authSessionToken) return state.authSessionToken;

  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_AUTH_KEY) || localStorage.getItem(VERIFIED_AUTH_KEY) || "null");
    if (!pending?.token || !pending?.destination) return "";

    state.authSessionToken = pending.token;
    state.authDestination = pending.destination;
    state.authMode = pending.mode === "email" ? "email" : "phone";
    state.authFlow = pending.flow === "login" ? "login" : "register";
    return state.authSessionToken;
  } catch {
    clearPendingAuth();
    return "";
  }
}

function restorePendingAuth() {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_AUTH_KEY) || localStorage.getItem(VERIFIED_AUTH_KEY) || "null");
    if (!pending?.token || !pending?.destination) return;

    state.authSessionToken = pending.token;
    state.authDestination = pending.destination;
    state.authMode = pending.mode === "email" ? "email" : "phone";
    state.authFlow = pending.flow === "login" ? "login" : "register";
    setAuthFlow(state.authFlow);
    setAuthMode(state.authMode);
    $("#codeDestination").textContent =
      state.authMode === "phone" ? `Номер ${state.authDestination} уже подтвержден.` : `Email ${state.authDestination} уже подтвержден.`;
    setAuthStep("profile");
  } catch {
    clearPendingAuth();
  }
}

function getAuthDestination() {
  return state.authMode === "phone" ? $("#phoneInput").value.trim() : $("#emailInput").value.trim();
}

function isValidAuthDestination(destination = getAuthDestination()) {
  if (state.authMode === "phone") {
    return /^380\d{9}$/.test(destination.replace(/\D/g, ""));
  }

  if (state.authMode === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination);
  }

  return false;
}

function showStartAccountWarning(message = "Аккаунт уже зарегистрирован. Попробуйте войти в него.") {
  $("#startAccountWarning").textContent = message;
  $("#startAccountWarning").classList.remove("is-hidden");
}

function hideStartAccountWarning() {
  $("#startAccountWarning")?.classList.add("is-hidden");
}

function scheduleAccountCheck() {
  window.clearTimeout(accountCheckTimer);
  hideStartAccountWarning();

  if (state.authFlow !== "register" || !["phone", "email"].includes(state.authMode)) return;

  const destination = getAuthDestination();
  if (!isValidAuthDestination(destination)) return;

  accountCheckTimer = window.setTimeout(() => checkAccountExists(destination), 350);
}

async function checkAccountExists(destination) {
  try {
    const response = await fetch(`/api/auth/check?destination=${encodeURIComponent(destination)}`);
    const data = await response.json();

    if (state.authFlow === "register" && destination === getAuthDestination() && data.exists) {
      showStartAccountWarning();
    }
  } catch {
    // Не мешаем вводу, если проверка временно недоступна.
  }
}

function setButtonLoading(button, isLoading, loadingText) {
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

async function loadAuthConfig() {
  try {
    const response = await fetch("/api/auth/config");
    const data = await response.json();
    if (data.ok) {
      state.authConfig.googleClientId = data.googleClientId || "";
      state.authConfig.appleClientId = data.appleClientId || "";
      state.authConfig.mapboxToken = data.mapboxToken || "";
      MAPBOX_TOKEN = state.authConfig.mapboxToken;
      renderSocialAuth();
      if (!novaMap && !$("#taxiScreen")?.classList.contains("is-hidden")) {
        initMapboxMap();
      }
    }
  } catch {
    // Social login stays in setup mode if config cannot be loaded.
  }
}

function renderSocialAuth() {
  const box = $("#socialAuthBox");
  if (!box || box.classList.contains("is-hidden")) return;

  if (state.authMode === "google") {
    renderGoogleAuth(box);
    return;
  }

  if (state.authMode === "apple") {
    renderAppleAuth(box);
  }
}

function renderGoogleAuth(box) {
  box.innerHTML = `<div id="googleAuthButton" class="oauth-button-slot"></div>`;

  if (!state.authConfig.googleClientId) {
    box.innerHTML = `<div class="oauth-setup"><strong>Google вход почти готов</strong><span>Добавьте GOOGLE_CLIENT_ID в .env, потом перезапустите сервер.</span></div>`;
    return;
  }

  if (!window.google?.accounts?.id) {
    window.setTimeout(() => renderGoogleAuth(box), 500);
    return;
  }

  window.google.accounts.id.initialize({
    client_id: state.authConfig.googleClientId,
    callback: (response) => handleSocialCredential("google", response.credential),
    use_fedcm_for_prompt: true,
  });
  window.google.accounts.id.renderButton($("#googleAuthButton"), {
    theme: "outline",
    size: "large",
    shape: "pill",
    width: 280,
    text: state.authFlow === "login" ? "signin_with" : "signup_with",
  });
}

function renderAppleAuth(box) {
  if (!state.authConfig.appleClientId) {
    box.innerHTML = `<div class="oauth-setup"><strong>Apple вход почти готов</strong><span>Добавьте APPLE_CLIENT_ID в .env и настройте домен в Apple Developer.</span></div>`;
    return;
  }

  box.innerHTML = `<button class="apple-oauth-button" id="appleAuthButton" type="button"><span class="auth-icon apple-icon"></span>Продолжить с Apple</button>`;
  $("#appleAuthButton").addEventListener("click", handleAppleSignIn);
}

async function handleAppleSignIn() {
  if (!window.AppleID?.auth) {
    alert("Apple Sign In ещё загружается. Попробуйте через пару секунд.");
    return;
  }

  try {
    window.AppleID.auth.init({
      clientId: state.authConfig.appleClientId,
      scope: "name email",
      redirectURI: window.location.origin,
      usePopup: true,
    });
    const response = await window.AppleID.auth.signIn();
    const name = response.user?.name ? [response.user.name.firstName, response.user.name.lastName].filter(Boolean).join(" ") : "";
    await handleSocialCredential("apple", response.authorization?.id_token, name);
  } catch (error) {
    if (error?.error !== "popup_closed_by_user") {
      alert("Apple вход не завершён. Проверьте настройки Apple Developer.");
    }
  }
}

async function handleSocialCredential(provider, credential, name = "") {
  if (!credential) {
    alert("Провайдер не вернул токен входа.");
    return;
  }

  try {
    const response = await fetch("/api/auth/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, credential, name }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось войти.");
    }

    state.authSessionToken = data.sessionToken || "";
    savePersistentAuth(data.user);
    enterApp(data.user);
  } catch (error) {
    alert(error.message);
  }
}

async function showVerification() {
  const destination = getAuthDestination();

  if (!destination) {
    alert(state.authMode === "phone" ? "Введите номер телефона." : "Введите email.");
    return;
  }

  if (state.authMode === "phone" && !isValidAuthDestination(destination)) {
    alert("Введите полный номер телефона в формате +380XXXXXXXXX.");
    return;
  }

  if (state.authMode === "email" && !isValidAuthDestination(destination)) {
    alert("Введите корректный email.");
    return;
  }

  setButtonLoading($("#sendCodeBtn"), true, "Отправляем...");
  $("#codeError").classList.add("is-hidden");
  $("#accountExistsWarning").classList.add("is-hidden");
  $("#startAccountWarning").classList.add("is-hidden");
  $("#codeInput").value = "";

  try {
    const response = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: state.authMode === "phone" ? "sms" : "email",
        destination,
        flow: state.authFlow,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      if (data.code === "ACCOUNT_EXISTS") {
        showStartAccountWarning(data.error);
        return;
      }
      throw new Error(data.error || "Не удалось отправить код.");
    }

    state.authDestination = destination;
    $("#codeDestination").textContent =
      state.authMode === "phone" ? `Код отправлен в SMS на ${destination}.` : `Код отправлен на ${destination}.`;
    $("#codeHint").textContent = data.devCode
      ? `Режим разработки: ваш код ${data.devCode}`
      : "Введите код, который пришел в сообщении.";
    setAuthStep("code");
  } catch (error) {
    alert(error.message);
  } finally {
    setButtonLoading($("#sendCodeBtn"), false);
  }
}

async function verifyCode() {
  const code = $("#codeInput").value.trim();

  if (!code) {
    $("#codeError").textContent = "Введите код из сообщения.";
    $("#codeError").classList.remove("is-hidden");
    return;
  }

  setButtonLoading($("#verifyCodeBtn"), true, "Проверяем...");

  try {
    const response = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: state.authDestination,
        code,
        flow: state.authFlow,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      $("#codeError").textContent = data.error || "Код неверный.";
      $("#codeError").classList.remove("is-hidden");
      return;
    }

    $("#codeError").classList.add("is-hidden");
    $("#accountExistsWarning").classList.add("is-hidden");
    state.authSessionToken = data.sessionToken || "";

    if (!state.authSessionToken) {
      $("#codeError").textContent = "Код подтвержден, но сервер не вернул сессию. Обновите страницу и попробуйте еще раз.";
      $("#codeError").classList.remove("is-hidden");
      return;
    }

    if (state.authFlow === "login" && data.user) {
      clearPendingAuth();
      savePersistentAuth(data.user);
      enterApp(data.user);
      return;
    }

    if (state.authFlow === "register" && data.user) {
      $("#accountExistsWarning").classList.remove("is-hidden");
      setButtonLoading($("#verifyCodeBtn"), false);
      return;
    }

    if (state.authFlow === "login") {
      $("#authSubtitle").textContent = "Профиль еще не найден. Заполните данные, и мы создадим аккаунт.";
    }

    savePendingAuth();
    setAuthStep("profile");
  } catch (error) {
    $("#codeError").textContent = error.message;
    $("#codeError").classList.remove("is-hidden");
  } finally {
    setButtonLoading($("#verifyCodeBtn"), false);
  }
}

function fillProfileForm(user) {
  if (user.name) {
    $("#nameInput").value = user.name;
  }

  if (user.birthDate) {
    $("#birthInput").value = user.birthDate;
  }

  if (user.gender) {
    $$(".segment").forEach((segment) => segment.classList.toggle("is-active", segment.dataset.gender === user.gender));
  }
}

function enterApp(userOrName, options = {}) {
  const user = typeof userOrName === "string" ? { name: userOrName, rating: 5 } : userOrName || { name: "Клиент", rating: 5 };
  const name = user.name || "Клиент";
  state.currentUser = user;
  if (user.destination) {
    state.authDestination = user.destination;
  }

  if (Array.isArray(user.savedAddresses) && user.savedAddresses.length) {
    state.savedAddresses = user.savedAddresses;
  }

  $("#profileName").textContent = name;
  $("#profileAvatar").textContent = name.slice(0, 1).toUpperCase();
  $(".profile-card span").textContent = `Рейтинг ${user.rating || 5}`;
  $("#authScreen").classList.add("is-hidden");
  $("#taxiScreen").classList.remove("is-hidden");
  if (options.persist !== false) {
    savePersistentAuth(user);
  }
  updateMenuForRole();
  startDriverVerificationWatch();
  window.setTimeout(() => {
    initMapboxMap();
    novaMap?.resize();
    updateRouteLine();
    restoreDriverView().then((restoredDriver) => {
      if (!restoredDriver) restoreActiveOrder();
    });
  }, 80);
}

async function finishAuth(event) {
  event.preventDefault();
  const name = $("#nameInput").value.trim();
  const birthDate = $("#birthInput").value;
  const gender = $(".segment.is-active")?.dataset.gender || "";

  if (!name) {
    alert("Введите имя.");
    $("#nameInput").focus();
    return;
  }

  if (!birthDate) {
    alert("Выберите дату рождения.");
    $("#birthInput").focus();
    return;
  }

  if (!gender) {
    alert("Выберите пол.");
    return;
  }

  const sessionToken = restorePendingAuthToken();
  $("#profileError")?.classList.add("is-hidden");

  if (!sessionToken && !state.authDestination) {
    $("#profileError").textContent = "Сначала подтвердите телефон или email кодом.";
    $("#profileError").classList.remove("is-hidden");
    setAuthStep("start");
    return;
  }

  setButtonLoading($("#finishAuthBtn"), true, "Сохраняем...");

  try {
    const response = await fetch("/api/auth/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionToken,
        destination: state.authDestination,
        channel: state.authMode === "phone" ? "sms" : "email",
        name,
        birthDate,
        gender,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось сохранить профиль.");
    }

    clearPendingAuth();
    savePersistentAuth(data.user);
    enterApp(data.user);
  } catch (error) {
    $("#profileError").textContent = error.message || "Не удалось сохранить профиль.";
    $("#profileError").classList.remove("is-hidden");
  } finally {
    setButtonLoading($("#finishAuthBtn"), false);
  }
}

function getStopPointLabel(index) {
  return STOP_POINT_LABELS[index] || String(index + 1);
}

function getStopIndex(point) {
  const match = String(point || "").match(/^stop-(\d+)$/);
  return match ? Number(match[1]) : -1;
}

function normalizeRouteStop(stop = {}) {
  const coordinates = stop.coordinates || stop.center || stop.point || null;
  return {
    label: stop.label || stop.address || "",
    coordinates: normalizeRouteCoordinates(coordinates),
  };
}

function getRouteStops() {
  return (mapPoints.stops || []).map(normalizeRouteStop).filter((stop) => Array.isArray(stop.coordinates));
}

function normalizeRouteCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const point = coordinates.map(Number);
  if (point.some(Number.isNaN)) return null;
  const [lng, lat] = point;
  if (lng < 29.9 || lng > 31.2 || lat < 45.9 || lat > 46.9) return null;
  return point;
}

function renderStopsList() {
  const list = $("#stopsList");
  if (!list) return;

  list.innerHTML = (mapPoints.stops || [])
    .map((stop, index) => {
      const normalized = normalizeRouteStop(stop);
      const label = getStopPointLabel(index);
      return `
        <div class="route-point stop-point" data-stop-row="${index}">
          <span>${label}</span>
          <div class="address-field">
            <input
              class="stop-input"
              data-stop-index="${index}"
              value="${escapeHtml(normalized.label)}"
              placeholder="Остановка ${label}"
              aria-label="Остановка ${label}"
              autocomplete="off"
            />
            <div class="address-suggestions" data-suggestions="stop-${index}"></div>
          </div>
          <button class="remove-stop-btn" type="button" data-remove-stop="${index}" aria-label="Удалить остановку ${label}">×</button>
        </div>
      `;
    })
    .join("");
}

function addStop() {
  if ((mapPoints.stops || []).length >= MAX_ROUTE_STOPS) {
    alert("Можно добавить максимум 5 остановок.");
    return;
  }

  mapPoints.stops.push({ label: "", coordinates: null });
  renderStopsList();
  const input = $(`#stopsList [data-stop-index="${mapPoints.stops.length - 1}"]`);
  input?.focus();
}

function removeStop(index) {
  mapPoints.stops.splice(index, 1);
  renderStopsList();
  renderStopMarkers();
  updateRouteLine();
}

function selectClass(card) {
  $$(".class-card").forEach((item) => item.classList.remove("is-selected"));
  card.classList.add("is-selected");
  updateTripPrice(state.tripDistanceKm);
}

function updateTripPrice(distanceKm = state.tripDistanceKm) {
  state.tripDistanceKm = Math.max(1, distanceKm || 1);
  $("#distanceLabel").textContent = `Маршрут: ${state.tripDistanceKm.toFixed(1)} км`;
}

function getClientRidePrice() {
  const input = $("#clientPriceInput");
  const value = Number.parseInt(input?.value || "", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function syncClientRidePrice() {
  const price = getClientRidePrice();
  if (price > 0) {
    state.selectedPrice = price;
  }
}

function setRouteGeoJson(coordinates) {
  if (!novaMap?.getSource("nova-route")) {
    try {
      installRouteLayer();
    } catch {
      return;
    }
  }

  novaMap.getSource("nova-route").setData({
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  });
}

function clearStopMarkers() {
  stopMarkers.forEach((marker) => marker.remove());
  stopMarkers = [];
}

function renderStopMarkers() {
  clearStopMarkers();
  if (!novaMap) return;

  if (!novaMap.getSource("nova-stops")) {
    try {
      installStopLayer();
    } catch {
      return;
    }
  }

  novaMap.getSource("nova-stops").setData({
    type: "FeatureCollection",
    features: getRouteStops().map((stop, index) => ({
      type: "Feature",
      properties: { label: getStopPointLabel(index) },
      geometry: {
        type: "Point",
        coordinates: stop.coordinates,
      },
    })),
  });
}

function getMapLanguage() {
  return state.language === "uk" ? "uk" : "ru";
}

function getGeocodeLanguages() {
  return state.language === "uk" ? "uk,ru,en" : "ru,uk,en";
}

function getOdessaSearchBbox() {
  return ODESSA_SEARCH_BBOX.join(",");
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function formatMapboxPlace(feature) {
  const streetName = feature?.text_ru || feature?.text_uk || feature?.text || "";
  const address = feature?.address && streetName ? `${streetName} ${feature.address}` : "";
  const primary = address || feature?.place_name_ru || feature?.place_name_uk || feature?.place_name || feature?.text_ru || feature?.text_uk || feature?.text || "";
  return primary
    .replace(/, Odesa Oblast/gi, "")
    .replace(/, Odessa Oblast/gi, "")
    .replace(/, Одесская область/gi, "")
    .replace(/, Одеська область/gi, "")
    .replace(/, Ukraine/gi, "")
    .replace(/, Україна/gi, "")
    .replace(/, Украина/gi, "")
    .replace(/, Odesa/gi, "")
    .replace(/, Odessa/gi, "")
    .replace(/, Одеса/gi, "")
    .replace(/, Одесса/gi, "")
    .trim();
}

function formatSuggestionSubtitle(feature) {
  const context = feature?.context || [];
  const pieces = context
    .map((item) => item.text_ru || item.text_uk || item.text)
    .filter(Boolean)
    .filter((item) => !/ukraine|украина|україна/i.test(item))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
  return pieces.slice(0, 3).join(", ");
}

function isUsableMapboxFeature(feature) {
  const center = normalizeRouteCoordinates(feature?.center);
  if (!center || Number(feature.relevance || 1) < 0.32) return false;
  const withinSearchArea =
    center[0] >= ODESSA_SEARCH_BBOX[0] &&
    center[0] <= ODESSA_SEARCH_BBOX[2] &&
    center[1] >= ODESSA_SEARCH_BBOX[1] &&
    center[1] <= ODESSA_SEARCH_BBOX[3];
  const nearOdessa = getDirectDistanceKm(center, ODESSA_CENTER) <= 75;
  return withinSearchArea || nearOdessa;
}

function matchesLocalPlace(place, query) {
  const normalized = query.toLowerCase();
  return [place.name, place.subtitle, ...(place.aliases || [])].filter(Boolean).some((value) => value.toLowerCase().includes(normalized));
}

async function resolveAddressCandidate(query) {
  const cleanQuery = normalizeSearchText(query);
  if (!cleanQuery) return null;

  const knownPlace = ODESSA_PLACES.find((place) => matchesLocalPlace(place, cleanQuery) || cleanQuery.toLowerCase().includes(place.name.toLowerCase()));
  if (knownPlace) {
    return {
      label: knownPlace.name,
      center: knownPlace.center,
      subtitle: knownPlace.subtitle || "Одесса",
    };
  }

  const feature = (await searchMapboxPlaces(cleanQuery, 10))[0];
  if (!feature) return null;

  return {
    label: formatMapboxPlace(feature),
    center: feature.center,
    subtitle: formatSuggestionSubtitle(feature),
  };
}

function getMapboxFeatureScore(feature) {
  const center = normalizeRouteCoordinates(feature?.center);
  const distance = center ? getDirectDistanceKm(center, ODESSA_CENTER) : 1000;
  const relevance = Number(feature?.relevance || 0.5);
  const exactAddressBonus = feature?.place_type?.includes("address") ? 0.35 : 0;
  const poiBonus = feature?.place_type?.includes("poi") ? 0.18 : 0;
  return relevance + exactAddressBonus + poiBonus - distance / 180;
}

function createGeocodeUrl(query, limit = 10) {
  const params = new URLSearchParams({
    limit: String(limit),
    language: getGeocodeLanguages(),
    country: "ua",
    bbox: getOdessaSearchBbox(),
    proximity: ODESSA_CENTER.join(","),
    types: ODESSA_GEOCODE_TYPES,
    autocomplete: "true",
    fuzzyMatch: "true",
    access_token: MAPBOX_TOKEN,
  });
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
}

async function searchMapboxPlaces(query, limit = 10) {
  const cleanQuery = normalizeSearchText(query);
  if (!cleanQuery || !MAPBOX_TOKEN) return [];

  const queryVariants = [
    cleanQuery,
    `${cleanQuery}, Одесса`,
    `${cleanQuery}, Одеса`,
    `${cleanQuery}, Odesa, Ukraine`,
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);

  const responses = await Promise.allSettled(
    queryVariants.map(async (variant) => {
      const response = await fetch(createGeocodeUrl(variant, limit));
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.features) ? data.features : [];
    }),
  );

  return responses
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter(isUsableMapboxFeature)
    .sort((a, b) => getMapboxFeatureScore(b) - getMapboxFeatureScore(a))
    .filter((feature, index, items) => {
      const label = formatMapboxPlace(feature).toLowerCase();
      const center = normalizeRouteCoordinates(feature.center)?.map((value) => value.toFixed(5)).join(",");
      return label && items.findIndex((candidate) => formatMapboxPlace(candidate).toLowerCase() === label || normalizeRouteCoordinates(candidate.center)?.map((value) => value.toFixed(5)).join(",") === center) === index;
    })
    .slice(0, limit);
}

function localizeMapLabels() {
  if (!novaMap?.getStyle()) return;
  const languageKey = state.language === "uk" ? "name_uk" : "name_ru";

  novaMap.getStyle().layers.forEach((layer) => {
    if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      try {
        novaMap.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", languageKey], ["get", "name_ru"], ["get", "name_uk"], ["get", "name"]]);
      } catch {
        // Some Mapbox internal layers do not allow runtime text changes.
      }
    }
  });
}

function installRouteLayer() {
  if (!novaMap || novaMap.getSource("nova-route")) return;

  novaMap.addSource("nova-route", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [mapPoints.a, mapPoints.b],
      },
    },
  });

  novaMap.addLayer({
    id: "nova-route-glow",
    type: "line",
    source: "nova-route",
    paint: {
      "line-color": "#35d4ff",
      "line-width": 9,
      "line-opacity": 0.28,
    },
  });

  novaMap.addLayer({
    id: "nova-route-line",
    type: "line",
    source: "nova-route",
    paint: {
      "line-color": "#1d67ff",
      "line-width": 4,
      "line-opacity": 0.94,
    },
  });
}

function installStopLayer() {
  if (!novaMap || novaMap.getSource("nova-stops")) return;

  novaMap.addSource("nova-stops", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });

  novaMap.addLayer({
    id: "nova-stops-halo",
    type: "circle",
    source: "nova-stops",
    paint: {
      "circle-radius": 19,
      "circle-color": "rgba(0, 184, 148, 0.2)",
      "circle-blur": 0.15,
    },
  });

  novaMap.addLayer({
    id: "nova-stops-dot",
    type: "circle",
    source: "nova-stops",
    paint: {
      "circle-radius": 14,
      "circle-color": "#18c7c7",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });

  novaMap.addLayer({
    id: "nova-stops-label",
    type: "symbol",
    source: "nova-stops",
    layout: {
      "text-field": ["get", "label"],
      "text-size": 15,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#ffffff",
    },
  });
}

async function getRouteSegment(start, finish) {
  const fallback = {
    coordinates: [start, finish],
    distanceKm: getDirectDistanceKm(start, finish),
  };

  try {
    const coordinates = [start, finish].map((point) => point.join(",")).join(";");
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&steps=false&alternatives=false&language=${getMapLanguage()}&access_token=${MAPBOX_TOKEN}`,
    );
    const data = await response.json();
    const route = data.routes?.[0];
    const routeCoordinates = route?.geometry?.coordinates;
    if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) return fallback;

    return {
      coordinates: [start, ...routeCoordinates, finish],
      distanceKm: route.distance ? route.distance / 1000 : fallback.distanceKm,
    };
  } catch {
    return fallback;
  }
}

async function updateRouteLine() {
  if (!novaMap || !mapPoints.a || !mapPoints.b) return;

  const routePoints = [mapPoints.a, ...getRouteStops().map((stop) => stop.coordinates), mapPoints.b]
    .map(normalizeRouteCoordinates)
    .filter(Boolean);
  if (routePoints.length < 2) return;

  const directRoute = routePoints;
  const isCompactMap = window.matchMedia("(max-width: 760px)").matches;
  const detailPadding = $(".workspace")?.classList.contains("driver-order-view")
    ? { top: 76, right: isCompactMap ? 36 : 70, bottom: 86, left: isCompactMap ? 36 : 70 }
    : isCompactMap
      ? { top: 78, right: 36, bottom: 210, left: 36 }
      : { top: 120, right: 460, bottom: 180, left: 80 };

  try {
    const segments = await Promise.all(routePoints.slice(1).map((point, index) => getRouteSegment(routePoints[index], point)));
    const route = segments.reduce((line, segment, index) => {
      const nextCoordinates = index === 0 ? segment.coordinates : segment.coordinates.slice(1);
      return line.concat(nextCoordinates);
    }, []);
    const distanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
    setRouteGeoJson(route);
    updateTripPrice(distanceKm);

    const bounds = route.reduce((box, coord) => box.extend(coord), new mapboxgl.LngLatBounds(route[0], route[0]));
    novaMap.fitBounds(bounds, { padding: detailPadding, maxZoom: 14.5, duration: 700 });
  } catch {
    setRouteGeoJson(directRoute);
    updateTripPrice(routePoints.slice(1).reduce((sum, point, index) => sum + getDirectDistanceKm(routePoints[index], point), 0));

    const bounds = directRoute.reduce((box, coord) => box.extend(coord), new mapboxgl.LngLatBounds(directRoute[0], directRoute[0]));
    novaMap.fitBounds(bounds, { padding: detailPadding, maxZoom: 14.5, duration: 700 });
  }
}

function getDirectDistanceKm(a, b) {
  const earthRadius = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function reverseGeocodePoint(point, coordinates) {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates.join(",")}.json?limit=1&language=${getMapLanguage()}&types=address,poi,place,locality,neighborhood&access_token=${MAPBOX_TOKEN}`,
    );
    const data = await response.json();
    const place = formatMapboxPlace(data.features?.[0]);
    const input = point === "a" ? $("#fromInput") : $("#toInput");
    input.value = place || `Карта: ${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
  } catch {
    const input = point === "a" ? $("#fromInput") : $("#toInput");
    input.value = `Карта: ${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
  }
}

function setAddressPoint(point, coordinates, label) {
  const stopIndex = getStopIndex(point);

  if (stopIndex >= 0) {
    const safeCoordinates = normalizeRouteCoordinates(coordinates);
    if (!safeCoordinates) return;
    mapPoints.stops[stopIndex] = { label, coordinates: safeCoordinates };
    const input = $(`#stopsList [data-stop-index="${stopIndex}"]`);
    if (input) {
      input.value = label;
      input.dataset.selectedLabel = label;
    }
    hideAddressSuggestions(point);
    renderStopMarkers();
    updateRouteLine();
    return;
  }

  const safeCoordinates = normalizeRouteCoordinates(coordinates);
  if (!safeCoordinates) return;
  mapPoints[point] = safeCoordinates;
  const marker = point === "a" ? pickupMarker : destinationMarker;
  const input = point === "a" ? $("#fromInput") : $("#toInput");
  marker?.setLngLat(safeCoordinates);
  input.value = label;
  input.dataset.selectedLabel = label;
  hideAddressSuggestions(point);
  renderStopMarkers();
  updateRouteLine();
}

async function geocodeAddress(point, query) {
  const cleanQuery = normalizeSearchText(query);
  if (!cleanQuery || !window.mapboxgl) return;

  try {
    const result = await resolveAddressCandidate(cleanQuery);
    if (!result) return;
    setAddressPoint(point, result.center, result.label);
  } catch {
    // Keep the typed address if geocoding is temporarily unavailable.
  }
}

async function geocodeStop(input) {
  const cleanQuery = normalizeSearchText(input.value);
  const index = Number(input.dataset.stopIndex || 0);
  if (!cleanQuery || !window.mapboxgl) return;
  const currentStop = normalizeRouteStop(mapPoints.stops[index]);
  if (currentStop.coordinates && input.dataset.selectedLabel === cleanQuery) return;

  try {
    const result = await resolveAddressCandidate(cleanQuery);
    if (!result) return;
    setAddressPoint(`stop-${index}`, result.center, result.label);
  } catch {
    // Keep the typed stop address if geocoding is temporarily unavailable.
  }
}

function hideAddressSuggestions(point) {
  const list = document.querySelector(`[data-suggestions="${point}"]`);
  if (list) {
    list.innerHTML = "";
    list.classList.remove("is-open");
  }
}

function renderAddressSuggestionList(list, suggestions) {
  list.innerHTML = suggestions
    .map(
      (item) => `
        <button type="button" data-center="${item.center.join(",")}" data-label="${item.label}">
          <strong>${item.label}</strong>
          <span>${item.subtitle || "Одесса"}</span>
        </button>
      `,
    )
    .join("");
  list.classList.toggle("is-open", suggestions.length > 0);
}

async function showAddressSuggestions(point, query) {
  const list = document.querySelector(`[data-suggestions="${point}"]`);
  const cleanQuery = normalizeSearchText(query);

  if (!list || cleanQuery.length < 2) {
    hideAddressSuggestions(point);
    return;
  }

  const known = ODESSA_PLACES.filter((place) => matchesLocalPlace(place, cleanQuery)).map((place) => ({
    label: place.name,
    subtitle: place.subtitle || "Одесса",
    center: place.center,
  }));

  renderAddressSuggestionList(list, known.slice(0, 10));

  try {
    const remote = (await searchMapboxPlaces(cleanQuery, 12)).map((feature) => ({
      label: formatMapboxPlace(feature),
      subtitle: formatSuggestionSubtitle(feature),
      center: feature.center,
    }));

    const suggestions = [...known, ...remote]
      .filter((item, index, items) => item.label && items.findIndex((candidate) => candidate.label === item.label) === index)
      .slice(0, 10);

    renderAddressSuggestionList(list, suggestions);
  } catch {
    renderAddressSuggestionList(list, known.slice(0, 10));
  }
}

function bindAddressSearch() {
  [
    { input: $("#fromInput"), point: "a" },
    { input: $("#toInput"), point: "b" },
  ].forEach(({ input, point }) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        geocodeAddress(point, input.value);
      }
    });
    input.addEventListener("input", () => {
      clearTimeout(addressSearchTimer);
      addressSearchTimer = window.setTimeout(() => showAddressSuggestions(point, input.value), 220);
    });
    input.addEventListener("blur", () => geocodeAddress(point, input.value));
  });

  $("#stopsList")?.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-stop-index]");
    if (!input || event.key !== "Enter") return;

    event.preventDefault();
    geocodeStop(input);
  });

  $("#stopsList")?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-stop-index]");
    if (!input) return;

    const index = Number(input.dataset.stopIndex || 0);
    clearTimeout(addressSearchTimer);
    addressSearchTimer = window.setTimeout(() => showAddressSuggestions(`stop-${index}`, input.value), 220);
  });

  $("#stopsList")?.addEventListener("blur", (event) => {
    const input = event.target.closest("[data-stop-index]");
    if (input) geocodeStop(input);
  }, true);

  $("#stopsList")?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-stop]");
    if (!removeButton) return;

    removeStop(Number(removeButton.dataset.removeStop || 0));
  });
}

function playScreenTransition(callback) {
  const transition = $("#screenTransition");
  transition.classList.remove("is-hidden");
  transition.classList.remove("run");
  void transition.offsetWidth;
  transition.classList.add("run");
  window.setTimeout(() => {
    callback();
    transition.classList.add("is-hidden");
  }, 720);
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  if (novaMap) {
    novaMap.setStyle(theme === "dark" ? "mapbox://styles/mapbox/navigation-night-v1" : "mapbox://styles/mapbox/streets-v12");
    novaMap.once("style.load", () => {
      localizeMapLabels();
      installRouteLayer();
      renderStopMarkers();
      updateRouteLine();
    });
  }
  playScreenTransition(() => {
    const box = $("#sectionActionBox");
    if (box) {
      box.innerHTML = `<div class="text-panel"><strong>Тема обновлена</strong><p>Выбрано: ${theme === "dark" ? "Темная" : theme === "light" ? "Светлая" : "Как в системе"}.</p></div>`;
    }
  });
}

function applyLanguage(lang) {
  state.language = lang;
  const labels = {
    ru: { ride: "Поездка", history: "История заказов", addresses: "Мои адреса", settings: "Настройки" },
    uk: { ride: "Поїздка", history: "Історія поїздок", addresses: "Мої адреси", settings: "Налаштування" },
    en: { ride: "Ride", history: "Trip history", addresses: "My addresses", settings: "Settings" },
  }[lang];

  if (!state.driverMode) {
    $('.menu-item[data-section="ride"]').textContent = labels.ride;
    $('.menu-item[data-section="history"]').textContent = labels.history;
    $('.menu-item[data-section="addresses"]').textContent = labels.addresses;
    $('.menu-item[data-section="settings"]').textContent = labels.settings;
    if (state.currentSection === "ride") $("#screenTitle").textContent = labels.ride;
  }

  $("#sectionActionBox").innerHTML = `<div class="text-panel"><strong>Язык обновлен</strong><p>Интерфейс переключен: ${lang.toUpperCase()}.</p></div>`;
  localizeMapLabels();
}

function addAddressFromSection() {
  $("#addressCreateForm")?.classList.toggle("is-hidden");
  bindSavedAddressSearch();
  $("#newAddressName")?.focus();
}

async function saveNewAddressFromForm() {
  const title = $("#newAddressName")?.value.trim();
  const address = $("#newAddressValue")?.value.trim();
  if (!title || !address) return;

  const selectedCenter = $("#newAddressValue")?.dataset.selectedCenter?.split(",").map(Number);
  const resolved = normalizeRouteCoordinates(selectedCenter) ? { label: address, center: selectedCenter } : await resolveAddressCandidate(address);
  if (!resolved?.center) {
    alert("Адрес не найден. Выберите вариант из списка подсказок.");
    $("#newAddressValue")?.focus();
    return;
  }

  state.savedAddresses.push({ icon: "custom", title, address: resolved.label || address, center: resolved.center });
  persistSavedAddresses();
  showSection("addresses");
}

function bindSavedAddressSearch() {
  const input = $("#newAddressValue");
  if (!input || input.dataset.boundSearch) return;
  input.dataset.boundSearch = "true";

  input.addEventListener("input", () => {
    clearTimeout(addressSearchTimer);
    addressSearchTimer = window.setTimeout(() => showAddressSuggestions("saved-address", input.value), 220);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    hideAddressSuggestions("saved-address");
  });
}

async function useSavedAddressForRide(address, center) {
  if (!address) return;
  showSection("ride");
  const input = $("#toInput");
  if (input) input.value = address;

  const safeCenter = normalizeRouteCoordinates(center);
  if (safeCenter) {
    setAddressPoint("b", safeCenter, address);
  } else {
    await geocodeAddress("b", address);
  }

  window.setTimeout(() => {
    initMapboxMap();
    novaMap?.resize();
    updateRouteLine();
  }, 80);
}

function deleteSavedAddress(card) {
  const index = Number(card?.dataset.addressIndex);
  if (!Number.isInteger(index) || index < 0 || index >= state.savedAddresses.length) return;
  state.savedAddresses.splice(index, 1);
  persistSavedAddresses();
  showSection("addresses");
}

async function persistSavedAddresses() {
  if (!state.authSessionToken) return;

  try {
    await fetch("/api/users/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionToken: state.authSessionToken,
        savedAddresses: state.savedAddresses,
      }),
    });
  } catch {
    // Адрес останется на экране, повторное сохранение можно сделать позже.
  }
}

async function leaveAccount(kind) {
  if (kind === "delete") {
    if (!state.authSessionToken) {
      alert("Сессия истекла. Войдите снова, чтобы удалить аккаунт.");
      return;
    }

    try {
      const response = await fetch("/api/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: state.authSessionToken }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось удалить аккаунт.");
      }
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  playScreenTransition(() => {
    clearDriverVerificationWatch();
    clearPendingAuth();
    clearPersistentAuth();
    state.authSessionToken = "";
    state.authDestination = "";
    state.currentUser = null;
    state.driverMode = false;
    $("#taxiScreen").classList.add("is-hidden");
    $("#authScreen").classList.remove("is-hidden");
    setAuthStep("start");
    const box = $("#sectionActionBox");
    if (box) box.innerHTML = "";
    $("#authTitle").textContent = kind === "delete" ? "Аккаунт удален" : "Вы вышли из аккаунта";
    $("#authSubtitle").textContent = kind === "delete" ? "Профиль удален из базы NovaRide." : "Можно войти снова по телефону или email.";
  });
}

function showSection(section) {
  clearInterval(driverOrdersTimer);
  clearInterval(driverChatTimer);
  driverChatTimer = null;
  $(".workspace").classList.remove("driver-order-view");
  $(".workspace").classList.toggle("view-addresses", section === "addresses" && !state.driverMode);
  $("#driverPanel").classList.remove("order-detail-mode");
  state.currentSection = section;
  const isDriverFeed = state.driverMode && section === "ride";
  $(".content-grid").classList.toggle("section-mode", section !== "ride" || isDriverFeed);
  $(".map-panel").classList.toggle("is-hidden", section !== "ride");
  $("#driverPanel").classList.add("is-hidden");
  $("#ridePanel").classList.toggle("is-hidden", section !== "ride");
  $("#ridePanel").classList.toggle("active-panel", section === "ride");
  $("#infoPanel").classList.toggle("active-panel", section !== "ride");
  $("#infoPanel").classList.toggle("is-hidden", section === "ride");
  $$(".menu-item").forEach((item) => item.classList.toggle("is-active", item.dataset.section === section));
  $("#sideMenu").classList.remove("is-open");

  if (isDriverFeed) {
    showDriverContent("feed");
    return;
  }

  if (section === "ride") {
    $("#screenTitle").textContent = "Поездка";
    return;
  }

  const source = state.driverMode && driverSections[section] ? driverSections : sections;
  $("#screenTitle").textContent = source[section].title;
  $("#infoPanel").innerHTML = renderSection(section, source);
  if (section === "history") {
    loadRideHistory(state.driverMode ? "driver" : "passenger");
  }
  if (state.driverMode && section === "driverChat") {
    loadDriverCommunityChat({ startTimer: true });
  }
}

function renderSection(section, source = sections) {
  const content = source[section].html;
  return typeof content === "function" ? content() : content;
}

function getDriverVerification() {
  return state.currentUser?.driverVerification || { status: "none" };
}

function isDriverApproved() {
  return Boolean(state.currentUser?.driverVerified) || getDriverVerification().status === "approved";
}

async function refreshDriverVerificationStatus() {
  const destination = state.currentUser?.destination || state.authDestination;
  if (!destination) return getDriverVerification();

  try {
    const response = await fetch(`/api/driver-verification?destination=${encodeURIComponent(destination)}`);
    const data = await response.json();
    if (response.ok && data.ok && data.user) {
      state.currentUser = data.user;
      savePersistentAuth(data.user);
      updateMenuForRole();
      return data.verification || data.user.driverVerification || { status: "none" };
    }
  } catch {
    // Keep local status if the server is temporarily unavailable.
  }

  return getDriverVerification();
}

function renderDriverVerificationGate(verification = getDriverVerification()) {
  const status = verification.status || "none";
  const isPending = status === "pending";
  const isRejected = status === "rejected";
  const isDismissed = status === "dismissed";
  const vehicle = verification.vehicle || {};

  if (isPending) {
    return `
      <div class="driver-verification-card">
        <div class="verification-badge waiting">На проверке</div>
        <h2>Ждите одобрение администрации</h2>
        <p>Ваш профиль водителя на проверке. После одобрения лента заказов откроется автоматически.</p>
        <div class="verification-summary">
          <span>${escapeHtml(vehicle.transport || "Транспорт")}</span>
          <strong>${escapeHtml(vehicle.plate || "")}</strong>
        </div>
        <button class="primary-action refresh-driver-verification" type="button">Проверить статус</button>
      </div>
    `;
  }

  return `
    <form class="driver-verification-card" id="driverVerificationForm">
      <div class="verification-badge ${isRejected || isDismissed ? "rejected" : ""}">${isDismissed ? "Доступ отключен" : isRejected ? "Отклонено" : "Верификация водителя"}</div>
      <h2>${isDismissed ? "Вы отключены от ленты" : isRejected ? "Документы отклонены" : "Пройдите проверку"}</h2>
      <p>${
        isDismissed || isRejected
          ? escapeHtml(verification.rejectionReason || "Попробуйте пройти верификацию еще раз.")
          : "Заполните 3 пункта, и заявка уйдет администратору на проверку."
      }</p>

      <div class="verification-step is-active" data-verification-step="1">
        <button class="verification-step-header" type="button" data-open-verification-step="1">
          <span class="step-number">1</span>
          <strong>Транспорт</strong>
          <em>Марка, год, цвет, номер</em>
          <span class="step-check"></span>
        </button>
        <div class="verification-step-body">
          <div class="verification-grid">
            <label class="icon-field car-field"><span>АВТО</span><em>Марка и модель</em><input name="transport" placeholder="Например: Toyota Camry" value="${escapeHtml(vehicle.transport || "")}" required /></label>
            <label class="icon-field year-field"><span>ГОД</span><em>Год выпуска</em><input name="year" placeholder="Например: 2020" inputmode="numeric" value="${escapeHtml(vehicle.year || "")}" required /></label>
            <label class="icon-field color-field"><span>ЦВЕТ</span><em>Цвет транспорта</em><input name="color" placeholder="Например: Черный" value="${escapeHtml(vehicle.color || "")}" required /></label>
            <label class="icon-field plate-field"><span>№</span><em>Номер транспорта</em><input name="plate" placeholder="Например: BH1234AA" value="${escapeHtml(vehicle.plate || "")}" required /></label>
          </div>
          <button class="mini-action complete-verification-step" type="button" data-complete-step="1" disabled>Готово</button>
        </div>
      </div>

      <div class="verification-step is-locked" data-verification-step="2">
        <button class="verification-step-header" type="button" data-open-verification-step="2">
          <span class="step-number">2</span>
          <strong>Техпаспорт</strong>
          <em>Две стороны документа</em>
          <span class="step-check"></span>
        </button>
        <div class="verification-step-body">
          <label class="file-pill document-field"><i></i><span>Передняя сторона</span><small data-file-name="techFront">Выбрать фото</small><input name="techFront" type="file" accept="image/*" required /></label>
          <label class="file-pill document-field back"><i></i><span>Обратная сторона</span><small data-file-name="techBack">Выбрать фото</small><input name="techBack" type="file" accept="image/*" required /></label>
          <button class="mini-action complete-verification-step" type="button" data-complete-step="2" disabled>Готово</button>
        </div>
      </div>

      <div class="verification-step is-locked" data-verification-step="3">
        <button class="verification-step-header" type="button" data-open-verification-step="3">
          <span class="step-number">3</span>
          <strong>Верификация лица</strong>
          <em>Фото для проверки</em>
          <span class="step-check"></span>
        </button>
        <div class="verification-step-body">
          <label class="file-pill face-field"><i></i><span>Сделать или выбрать фото</span><small data-file-name="facePhoto">Открыть камеру</small><input name="facePhoto" type="file" accept="image/*" capture="user" required /></label>
          <button class="mini-action complete-verification-step" type="button" data-complete-step="3" disabled>Готово</button>
        </div>
      </div>

      <button class="primary-action verification-submit is-hidden" type="submit">Отправить на проверку</button>
    </form>
  `;
}

function getVerificationStepFields(form, step) {
  const fields = {
    1: ["transport", "year", "color", "plate"],
    2: ["techFront", "techBack"],
    3: ["facePhoto"],
  }[step] || [];
  return fields.map((name) => form.elements[name]).filter(Boolean);
}

function isVerificationStepComplete(form, step) {
  return getVerificationStepFields(form, step).every((field) => {
    if (field.type === "file") return field.files?.length;
    return field.value.trim();
  });
}

function openVerificationStep(form, step) {
  const targetStep = Number(step);
  form.querySelectorAll("[data-verification-step]").forEach((section) => {
    const currentStep = Number(section.dataset.verificationStep);
    const canOpen = currentStep === 1 || isVerificationStepComplete(form, currentStep - 1) || section.classList.contains("is-complete");
    section.classList.toggle("is-active", currentStep === targetStep && canOpen);
    section.classList.toggle("is-locked", !canOpen);
  });
}

function updateVerificationSubmit(form) {
  if (!form) return;
  [1, 2, 3].forEach((step) => {
    const button = form.querySelector(`[data-complete-step="${step}"]`);
    if (button) button.disabled = !isVerificationStepComplete(form, step);
  });
  const allDone = [1, 2, 3].every((step) => isVerificationStepComplete(form, step));
  form.querySelector(".verification-submit")?.classList.toggle("is-hidden", !allDone);
}

function completeDriverVerificationStep(form, step) {
  const section = form.querySelector(`[data-verification-step="${step}"]`);
  if (!isVerificationStepComplete(form, Number(step))) {
    alert("Заполните все поля этого пункта.");
    return;
  }

  section?.classList.add("is-complete");
  section?.classList.remove("is-active");
  if (Number(step) < 3) {
    openVerificationStep(form, Number(step) + 1);
  } else {
    form.querySelectorAll("[data-verification-step]").forEach((item) => item.classList.remove("is-active"));
  }
  updateVerificationSubmit(form);
}

function syncVerificationFileName(input) {
  const form = input.closest("#driverVerificationForm");
  const label = form?.querySelector(`[data-file-name="${CSS.escape(input.name)}"]`);
  if (label) {
    label.textContent = input.files?.[0]?.name || (input.name === "facePhoto" ? "Открыть камеру" : "Выбрать фото");
  }
}

async function showDriverVerificationGate() {
  state.driverMode = true;
  updateMenuForRole();
  clearInterval(driverOrdersTimer);
  clearInterval(driverAcceptedTimer);
  $(".workspace").classList.remove("driver-order-view", "view-addresses");
  $(".content-grid").classList.add("section-mode");
  $(".map-panel").classList.add("is-hidden");
  $("#ridePanel").classList.add("is-hidden");
  $("#infoPanel").classList.add("is-hidden");
  $("#driverPanel").classList.remove("is-hidden");
  $("#driverPanel").classList.remove("order-detail-mode");
  $("#screenTitle").textContent = "Верификация";
  $("#driverContent").innerHTML = renderDriverVerificationGate(await refreshDriverVerificationStatus());
  updateVerificationSubmit($("#driverVerificationForm"));
  $("#sideMenu").classList.remove("is-open");
}

async function showDriverMode() {
  state.driverMode = true;
  updateMenuForRole();
  await refreshDriverVerificationStatus();
  if (!isDriverApproved()) {
    showDriverVerificationGate();
    return;
  }
  showDriverContent("feed");
}

async function submitDriverVerification(form) {
  const button = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const destination = state.currentUser?.destination || state.authDestination;
  if (!destination) {
    alert("Сначала войдите в аккаунт.");
    return;
  }

  const payload = {
    destination,
    vehicle: {
      transport: formData.get("transport"),
      year: formData.get("year"),
      color: formData.get("color"),
      plate: formData.get("plate"),
    },
    documents: {
      techPassportFront: formData.get("techFront")?.name || "",
      techPassportBack: formData.get("techBack")?.name || "",
    },
    face: {
      photo: formData.get("facePhoto")?.name || "",
    },
  };

  setButtonLoading(button, true, "Отправляем...");
  try {
    const response = await fetch("/api/driver-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось отправить заявку.");
    }

    state.currentUser = data.user;
    savePersistentAuth(data.user);
    updateMenuForRole();
    $("#driverContent").innerHTML = renderDriverVerificationGate(data.verification || data.user.driverVerification);
  } catch (error) {
    alert(error.message);
  } finally {
    setButtonLoading(button, false);
  }
}

function showPassengerMode() {
  state.driverMode = false;
  clearInterval(driverChatTimer);
  driverChatTimer = null;
  localStorage.removeItem(DRIVER_ACTIVE_ORDER_KEY);
  localStorage.removeItem(DRIVER_DETAIL_ORDER_KEY);
  localStorage.removeItem(DRIVER_TAB_KEY);
  updateMenuForRole();
  showSection("ride");
}

function renderDriverOrders(orders) {
  const visibleOrders = orders.filter((order) => !state.hiddenDriverOrders.includes(order.id));

  if (!visibleOrders.length) {
    return `<article class="driver-empty-card"><strong>Пока нет заказов</strong><span>Когда пассажир нажмет "Найти водителя", заказ появится здесь онлайн.</span></article>`;
  }

  return visibleOrders
    .map(
      (order) => `
        <article class="driver-order-card" data-order-card="${escapeHtml(order.id)}" data-open-order="${escapeHtml(order.id)}" role="button" tabindex="0">
          <div class="driver-swipe-hint">Скрыть</div>
          <div class="driver-client-side">
            <div class="driver-client-avatar">NR</div>
            <strong>Клиент</strong>
            <span>Скрыто</span>
            <em>${escapeHtml(order.carClass)}</em>
          </div>
          <div class="driver-order-main">
            <div class="driver-order-topline">
              <span>~${Number(order.distanceKm || 0).toFixed(1)} км</span>
              <strong>${escapeHtml(order.price || state.selectedPrice)} грн</strong>
              <button class="order-hide-button" data-order-hide="${escapeHtml(order.id)}" type="button" aria-label="Скрыть заказ">⋮</button>
            </div>
            <h3>${escapeHtml(order.from)}</h3>
            <p>${escapeHtml(order.to)}</p>
            ${renderOrderStops(order)}
            ${order.comment ? `<em>${escapeHtml(order.comment)}</em>` : ""}
          </div>
        </article>
      `,
    )
    .join("");
}

async function loadDriverOrders() {
  const feed = $("#driverFeed");
  if (!feed) return;

  try {
    const response = await fetch("/api/orders");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось загрузить заказы.");
    }

    state.rideOrders = data.orders || [];
    feed.innerHTML = renderDriverOrders(state.rideOrders);
    bindDriverFeedInteractions();
  } catch (error) {
    feed.innerHTML = `<article class="driver-empty-card"><strong>Заказы не загрузились</strong><span>${escapeHtml(error.message)}</span></article>`;
  }
}

function hideDriverOrder(orderId) {
  if (!orderId || state.hiddenDriverOrders.includes(orderId)) return;
  state.hiddenDriverOrders.push(orderId);
  const card = document.querySelector(`[data-order-card="${CSS.escape(orderId)}"]`);
  if (card) {
    card.classList.add("is-dismissing");
    window.setTimeout(() => {
      const feed = $("#driverFeed");
      if (feed) feed.innerHTML = renderDriverOrders(state.rideOrders);
    }, 220);
  }
}

function bindDriverOrderSwipe(card) {
  if (!card || card.dataset.swipeBound) return;
  card.dataset.swipeBound = "true";
  let startX = 0;
  let currentX = 0;
  let swiping = false;

  card.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    startX = event.clientX;
    currentX = 0;
    swiping = true;
    card.setPointerCapture?.(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
    if (!swiping) return;
    currentX = Math.max(0, Math.min(120, event.clientX - startX));
    card.style.transform = `translateX(${currentX}px)`;
    card.classList.toggle("is-swiping", currentX > 18);
  });

  card.addEventListener("pointerup", () => {
    if (!swiping) return;
    swiping = false;
    const orderId = card.dataset.orderCard;
    if (currentX > 8) {
      card.dataset.ignoreClick = "true";
      window.setTimeout(() => {
        delete card.dataset.ignoreClick;
      }, 260);
    }
    card.style.transform = "";
    card.classList.remove("is-swiping");
    if (currentX > 72) {
      hideDriverOrder(orderId);
    }
  });

  card.addEventListener("pointercancel", () => {
    swiping = false;
    card.style.transform = "";
    card.classList.remove("is-swiping");
  });
}

function bindDriverFeedInteractions() {
  $$("#driverFeed [data-order-card]").forEach(bindDriverOrderSwipe);
}

function getDriverProfilePayload() {
  const name = state.currentUser?.name || "Водитель NovaRide";
  const destination = state.currentUser?.destination || "";
  const phone = destination.startsWith("+") ? destination : "+380";

  return {
    destination,
    driverName: name,
    driverPhone: phone,
    driverRating: 4.86,
    driverAvatar: name.slice(0, 1).toUpperCase(),
    driverLocation: mapPoints.a,
  };
}

function renderContactButtons(phone, prefix = "") {
  const safePhone = String(phone || "").replace(/\s+/g, "");
  return `
    <div class="${prefix}contact-actions">
      <a class="round-contact" href="tel:${escapeHtml(safePhone || "+380")}"><span class="phone-mini-icon"></span>Позвонить</a>
      <button class="round-contact open-chat" type="button"><span class="chat-mini-icon"></span>Чат</button>
    </div>
  `;
}

function hasCurrentDriverOffer(order) {
  const phone = getDriverProfilePayload().driverPhone;
  return (order?.offers || []).some((offer) => offer.driver?.phone === phone);
}

function showDriverReturnToFeedNotice({ title, text, className = "" }) {
  clearInterval(driverAcceptedTimer);
  clearInterval(driverOrdersTimer);
  driverAcceptedTimer = null;
  driverOrdersTimer = null;
  localStorage.removeItem(DRIVER_ACTIVE_ORDER_KEY);
  localStorage.removeItem(DRIVER_DETAIL_ORDER_KEY);
  localStorage.setItem(DRIVER_TAB_KEY, "feed");
  $(".workspace").classList.remove("driver-order-view");
  $(".content-grid").classList.add("section-mode");
  $(".map-panel").classList.add("is-hidden");
  $("#ridePanel").classList.add("is-hidden");
  $("#infoPanel").classList.add("is-hidden");
  $("#driverPanel").classList.remove("is-hidden");
  $("#driverPanel").classList.remove("order-detail-mode");
  $("#screenTitle").textContent = "Лента";
  $("#driverContent").innerHTML = `
    ${driverTabs.feed}
    <div class="driver-status-toast ${escapeHtml(className)}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
  $$(".driver-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.driverTab === "feed"));
  loadDriverOrders();
  driverOrdersTimer = window.setInterval(loadDriverOrders, 5000);
  window.setTimeout(() => $(".driver-status-toast")?.remove(), 5200);
}

function showDriverOfferDeclined() {
  showDriverReturnToFeedNotice({
    title: "Ваше предложение отклонено",
    text: "Заказ снова скрыт из ожидания. Можно выбрать другую поездку из ленты.",
    className: "declined-offer-toast",
  });
}

function showDriverOrderCanceled(order) {
  const lastSystemMessage = [...(order?.messages || [])].reverse().find((message) => message.sender === "system")?.text || "";
  const isPassengerCancel = lastSystemMessage.includes("Клиент");

  showDriverReturnToFeedNotice({
    title: isPassengerCancel ? "Клиент отменил заказ" : "Заказ отменен",
    text: isPassengerCancel
      ? "Поездка отменена клиентом. Мы вернули вас в ленту, можно брать следующий заказ."
      : "Заказ больше не активен. Мы вернули вас в ленту заказов.",
    className: "canceled-order-toast",
  });
}

function renderMapButton(order, target = "pickup") {
  const point = target === "destination" ? order?.b : order?.a;
  const fallback = target === "destination" ? order?.to : order?.from;
  const destination = Array.isArray(point) ? `${point[1]},${point[0]}` : encodeURIComponent(fallback || "Одесса");
  const label = target === "destination" ? "Маршрут к точке B" : "Маршрут к клиенту";
  return `<a class="round-contact maps-contact" href="https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving" target="_blank" rel="noopener"><span class="map-mini-icon"></span>${label}</a>`;
}

function getRideStage(order) {
  if (order?.status === "completed") return "completed";
  if (order?.status !== "accepted") return order?.status || "open";
  if (!order.rideStage || order.rideStage === "searching") return "driving_to_pickup";
  return order.rideStage || "driving_to_pickup";
}

function getPassengerStageTitle(order) {
  const stage = getRideStage(order);
  if (stage === "arrived") return "Водитель на месте";
  if (stage === "in_progress") return "Поездка началась";
  return "Водитель едет к вам";
}

function getDriverStageText(order) {
  const stage = getRideStage(order);
  if (stage === "arrived") return "Вы на месте · ожидаем пассажира";
  if (stage === "in_progress") return "Поездка началась · едем к точке B";
  return "Едем к точке A";
}

function renderDriverStageActions(order) {
  const stage = getRideStage(order);
  const orderId = escapeHtml(order.id);

  if (stage === "arrived") {
    return `
      <button class="primary-action update-ride-stage" data-order="${orderId}" data-stage="in_progress" type="button">Начать поездку</button>
      ${renderMapButton(order, "pickup")}
    `;
  }

  if (stage === "in_progress") {
    return `
      ${renderMapButton(order, "destination")}
      <button class="primary-action complete-order" data-order="${orderId}" type="button">Поездка завершена</button>
    `;
  }

  return `
    ${renderMapButton(order, "pickup")}
    <button class="primary-action update-ride-stage" data-order="${orderId}" data-stage="arrived" type="button">На месте</button>
  `;
}

function renderOrderStops(order) {
  const stops = order?.stops || [];
  if (!stops.length) return "";
  return `<div class="order-stops">${stops.map((stop, index) => `<span>${index + 1}. ${escapeHtml(stop.label)}</span>`).join("")}</div>`;
}

function formatRideDate(value) {
  if (!value) return "Дата не указана";
  return new Intl.DateTimeFormat("ru", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderDriverCommunityChat() {
  if (!isDriverApproved()) {
    return `
      <div class="section-hero driver-hero"><span>Доступ закрыт</span><h2>Водительский чат</h2><p>Здесь общаются только подтвержденные водители NovaRide.</p></div>
      <article class="driver-chat-locked">
        <strong>Пройдите верификацию водителя</strong>
        <span>После одобрения документов администрацией откроется общий рабочий чат для водителей.</span>
        <button class="primary-action refresh-driver-verification" type="button">Проверить статус</button>
      </article>
    `;
  }

  const messages = state.driverChatMessages || [];
  return `
    <div class="section-hero driver-hero compact"><span>Рабочая линия</span><h2>Чат водителей</h2><p>Обсуждайте смену, дороги, заказы и рабочие вопросы.</p></div>
    <div class="driver-community-chat">
      <div class="driver-community-log" id="driverCommunityLog">
        ${
          messages.length
            ? messages
                .map(
                  (message) => `
                    <article class="driver-community-message ${message.driverDestination === state.currentUser?.destination ? "own" : ""}">
                      <div class="driver-community-avatar">${escapeHtml((message.driverName || "В").slice(0, 1).toUpperCase())}</div>
                      <div>
                        <strong>${escapeHtml(message.driverName || "Водитель NovaRide")} <span>${formatRideDate(message.createdAt)}</span></strong>
                        <p>${escapeHtml(message.text)}</p>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : `<article class="driver-community-empty">Пока сообщений нет. Напишите первым, как проходит смена.</article>`
        }
      </div>
      <div class="driver-community-compose">
        <input id="driverCommunityInput" placeholder="Напишите сообщение водителям" maxlength="500" />
        <button class="primary-action" id="sendDriverCommunityMessage" type="button">Отправить</button>
      </div>
    </div>
  `;
}

function scrollDriverCommunityChat() {
  window.setTimeout(() => {
    const log = $("#driverCommunityLog");
    if (log) log.scrollTop = log.scrollHeight;
  }, 40);
}

async function loadDriverCommunityChat(options = {}) {
  if (!state.currentUser?.destination) return;

  try {
    const response = await fetch(`/api/driver-chat?destination=${encodeURIComponent(state.currentUser.destination)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Чат водителей недоступен.");
    }

    const messages = data.messages || [];
    const nextKey = messages.map((message) => message.id).join("|");
    const shouldRender = nextKey !== state.driverChatKey || options.force;
    const activeInput = $("#driverCommunityInput");
    const draft = activeInput?.value || "";
    const keepTyping = document.activeElement === activeInput && draft.trim();
    state.driverChatMessages = messages;
    state.driverChatKey = nextKey;
    if (state.driverMode && state.currentSection === "driverChat") {
      if (shouldRender && !keepTyping) {
        $("#infoPanel").innerHTML = renderDriverCommunityChat();
        const input = $("#driverCommunityInput");
        if (input && draft) input.value = draft;
        scrollDriverCommunityChat();
      }
    }
  } catch (error) {
    if (state.driverMode && state.currentSection === "driverChat") {
      $("#infoPanel").innerHTML = `
        <div class="section-hero driver-hero"><span>Чат водителей</span><h2>Нет доступа</h2><p>${escapeHtml(error.message)}</p></div>
        <article class="driver-chat-locked"><strong>Проверьте верификацию</strong><span>Общий чат откроется после подтверждения аккаунта водителя.</span></article>
      `;
    }
  }

  if (options.startTimer && !driverChatTimer) {
    driverChatTimer = window.setInterval(() => loadDriverCommunityChat(), 3500);
  }
}

async function sendDriverCommunityMessage() {
  const input = $("#driverCommunityInput");
  const text = input?.value.trim();
  if (!text) {
    input?.focus();
    return;
  }

  const button = $("#sendDriverCommunityMessage");
  setButtonLoading(button, true, "Отправка...");
  try {
    const response = await fetch("/api/driver-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: state.currentUser?.destination,
        text,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось отправить сообщение.");
    }

    state.driverChatMessages = data.messages || [];
    state.driverChatKey = state.driverChatMessages.map((message) => message.id).join("|");
    input.value = "";
    $("#infoPanel").innerHTML = renderDriverCommunityChat();
    scrollDriverCommunityChat();
    $("#driverCommunityInput")?.focus();
  } catch (error) {
    alert(error.message);
  } finally {
    setButtonLoading(button, false);
  }
}

function renderStaticStars(rating = 5) {
  const value = Math.max(1, Math.min(5, Math.round(Number(rating || 5))));
  return `<span class="static-stars">${"★".repeat(value)}${"☆".repeat(5 - value)}</span>`;
}

function renderRatingBox(order, role) {
  const isDriver = role === "driver";
  const ownRating = isDriver ? order.driverTripRating : order.passengerTripRating;
  const title = isDriver ? "Оцените клиента" : "Оцените водителя";
  const subtitle = isDriver ? "Эта оценка сохранится в истории клиента." : "Эта оценка сохранится в истории водителя.";

  if (ownRating) {
    return `
      <div class="rating-box is-rated">
        <strong>${isDriver ? "Вы оценили клиента" : "Вы оценили водителя"}</strong>
        ${renderStaticStars(ownRating)}
      </div>
    `;
  }

  return `
    <div class="rating-box" data-rating-box="${escapeHtml(order.id)}" data-rating-role="${role}">
      <strong>${title}</strong>
      <span>${subtitle}</span>
      <div class="star-picker" role="radiogroup" aria-label="${title}">
        ${[1, 2, 3, 4, 5]
          .map((value) => `<button type="button" data-rate-order="${escapeHtml(order.id)}" data-rate-role="${role}" data-rate-value="${value}" aria-label="${value} звезд">★</button>`)
          .join("")}
      </div>
    </div>
  `;
}

function renderCompletedOrderPanel(order, role) {
  const isDriver = role === "driver";
  const person = isDriver ? order.passengerName || "Клиент" : order.driver?.name || "Водитель";
  const phone = isDriver ? order.passengerPhone : order.driver?.phone;
  const rating = isDriver ? order.passengerRating || 5 : order.driver?.rating || 4.86;
  const avatar = (isDriver ? person : order.driver?.avatar || person).slice(0, 1).toUpperCase();

  return `
    <div class="${isDriver ? "driver-detail-sheet" : "active-order-panel"} ride-completed">
      <div class="accepted-badge completed">Поездка завершена</div>
      <div class="client-profile-row driver-profile-row">
        <div class="client-avatar">${escapeHtml(avatar)}</div>
        <div>
          <strong>${escapeHtml(person)}</strong>
          <span>Рейтинг ${escapeHtml(rating)}${phone ? ` · ${escapeHtml(phone)}` : ""}</span>
        </div>
      </div>
      <div class="driver-route-preview">
        <strong>${escapeHtml(order.from)} -> ${escapeHtml(order.to)}</strong>
        <span>${Number(order.distanceKm || 0).toFixed(1)} км · ${escapeHtml(order.price)} грн · ${formatRideDate(order.completedAt || order.createdAt)}</span>
        ${renderOrderStops(order)}
        ${order.comment ? `<em>${escapeHtml(order.comment)}</em>` : ""}
      </div>
      ${renderRatingBox(order, role)}
      <button class="primary-action ${isDriver ? "back-to-feed" : "back-to-ride"}" type="button">${isDriver ? "Вернуться в ленту" : "Новая поездка"}</button>
    </div>
  `;
}

function renderHistoryCard(order, role) {
  const isDriver = role === "driver";
  const person = isDriver ? order.passengerName || "Клиент" : order.driver?.name || "Водитель";
  const rating = isDriver ? order.driverTripRating || order.passengerRating || 5 : order.passengerTripRating || order.driver?.rating || 4.86;
  const className = "list-card history-order-card";

  return `
    <article class="${className}" data-history-order="${escapeHtml(order.id)}" data-history-role="${role}" tabindex="0">
      <i></i>
      <strong>${escapeHtml(order.from)} -> ${escapeHtml(order.to)}</strong>
      <span>${formatRideDate(order.completedAt || order.createdAt)} · ${escapeHtml(person)} · ${Number(order.distanceKm || 0).toFixed(1)} км</span>
      <em>${escapeHtml(order.price)} грн · ${renderStaticStars(rating)}</em>
    </article>
  `;
}

async function loadRideHistory(role = state.driverMode ? "driver" : "passenger") {
  const destination = state.currentUser?.destination || state.authDestination;
  const list = role === "driver" ? $("#driverHistoryList") : $("#rideHistoryList");
  if (!list || !destination) return;

  list.innerHTML = role === "driver"
    ? `<article class="list-card"><strong>Загружаем историю...</strong><span>Секунду, ищем завершенные поездки.</span><em>NovaRide</em></article>`
    : `<article class="list-card"><strong>Загружаем историю...</strong><span>Секунду, ищем завершенные поездки.</span><em>NovaRide</em></article>`;

  try {
    const response = await fetch(`/api/orders/history?role=${encodeURIComponent(role)}&destination=${encodeURIComponent(destination)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось загрузить историю.");
    const orders = data.orders || [];
    list.innerHTML = orders.length
      ? orders.map((order) => renderHistoryCard(order, role)).join("")
      : role === "driver"
        ? `<article class="list-card"><strong>История пока пустая</strong><span>После завершения поездки она появится здесь.</span><em>0 поездок</em></article>`
        : `<article class="list-card"><strong>История пока пустая</strong><span>После завершения поездки она появится здесь.</span><em>0 поездок</em></article>`;
  } catch (error) {
    list.innerHTML = role === "driver"
      ? `<article class="list-card"><strong>История недоступна</strong><span>${escapeHtml(error.message)}</span><em>Ошибка</em></article>`
      : `<article class="list-card"><strong>История недоступна</strong><span>${escapeHtml(error.message)}</span><em>Ошибка</em></article>`;
  }
}

async function openHistoryOrder(orderId, role) {
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Поездка не найдена.");
    const order = data.order;
    const isDriver = role === "driver";
    const person = isDriver ? order.passengerName || "Клиент" : order.driver?.name || "Водитель";
    const phone = isDriver ? order.passengerPhone : order.driver?.phone;
    const rating = isDriver ? order.driverTripRating || order.passengerRating || 5 : order.passengerTripRating || order.driver?.rating || 4.86;
    const avatar = (isDriver ? person : order.driver?.avatar || person).slice(0, 1).toUpperCase();

    $(".content-grid").classList.remove("section-mode");
    $(".map-panel").classList.remove("is-hidden");
    $("#ridePanel").classList.add("is-hidden");
    $("#driverPanel").classList.add("is-hidden");
    $("#infoPanel").classList.remove("is-hidden");
    $("#infoPanel").classList.add("active-panel");
    $("#screenTitle").textContent = "История поездки";
    $("#infoPanel").innerHTML = `
      <div class="history-detail-sheet">
        <button class="mini-action back-to-history" data-history-role="${role}" type="button">Назад к истории</button>
        <div class="accepted-badge completed">Завершенная поездка</div>
        <div class="client-profile-row driver-profile-row">
          <div class="client-avatar">${escapeHtml(avatar)}</div>
          <div>
            <strong>${escapeHtml(person)}</strong>
            <span>${renderStaticStars(rating)}${phone ? ` · ${escapeHtml(phone)}` : ""}</span>
          </div>
        </div>
        <div class="driver-route-preview">
          <strong>${escapeHtml(order.from)} -> ${escapeHtml(order.to)}</strong>
          <span>${Number(order.distanceKm || 0).toFixed(1)} км · ${escapeHtml(order.price)} грн · ${formatRideDate(order.completedAt || order.createdAt)}</span>
          ${renderOrderStops(order)}
          ${order.comment ? `<em>${escapeHtml(order.comment)}</em>` : `<em>Без комментария</em>`}
        </div>
        <div class="history-meta-grid">
          <span>Класс: <strong>${escapeHtml(order.carClass)}</strong></span>
          <span>Оценка клиента: <strong>${escapeHtml(order.driverTripRating || order.passengerRating || 5)}</strong></span>
          <span>Оценка водителя: <strong>${escapeHtml(order.passengerTripRating || order.driver?.rating || 4.86)}</strong></span>
        </div>
      </div>
    `;
    applyOrderToMap(order);
  } catch (error) {
    alert(error.message);
  }
}

function renderRideChat(order, sender) {
  const messages = order?.messages || [];
  return `
    <div class="ride-chat" data-chat="${escapeHtml(order.id)}">
      <div class="ride-chat-log">
        ${
          messages.length
            ? messages
                .map(
                  (message) => `
                    <div class="ride-message ${message.sender === sender ? "mine" : ""}">
                      <strong>${escapeHtml(message.name || (message.sender === "driver" ? "Водитель" : "Клиент"))}</strong>
                      <span>${escapeHtml(message.text)}</span>
                    </div>
                  `,
                )
                .join("")
            : `<div class="ride-message system"><span>Чат готов. Напишите первое сообщение.</span></div>`
        }
      </div>
      <div class="ride-chat-compose">
        <input data-chat-input="${escapeHtml(order.id)}" placeholder="Сообщение" />
        <button class="primary-action send-ride-message" data-order="${escapeHtml(order.id)}" data-sender="${sender}" type="button">Отправить</button>
      </div>
    </div>
  `;
}

function focusRideChat(button) {
  markRideChatActive();
  const scope = button.closest(".active-order-panel, .driver-detail-sheet") || document;
  const input = scope.querySelector("[data-chat-input]");
  if (input) {
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => {
      markRideChatActive();
      input.focus({ preventScroll: true });
    }, 80);
  }
}

function isRideChatFocused(orderId) {
  const active = document.activeElement;
  const hasFocusedInput = Boolean(active?.matches?.("[data-chat-input]") && (!orderId || active.dataset.chatInput === orderId));
  return hasFocusedInput || Date.now() < rideChatActiveUntil;
}

function markRideChatActive() {
  rideChatActiveUntil = Date.now() + 8000;
}

function scrollRideChatToBottom(scope = document) {
  window.setTimeout(() => {
    scope.querySelectorAll?.(".ride-chat-log").forEach((log) => {
      log.scrollTop = log.scrollHeight;
    });
  }, 40);
}

function applyOrderToMap(order) {
  if (!order?.a || !order?.b) return;
  const orderStops = (order.stops || []).map(normalizeRouteStop);
  const routeKey = JSON.stringify([order.a, orderStops, order.b]);
  mapPoints.a = order.a;
  mapPoints.b = order.b;
  mapPoints.stops = orderStops;
  $("#fromInput").value = order.from;
  $("#toInput").value = order.to;
  renderStopsList();
  pickupMarker?.setLngLat(order.a);
  destinationMarker?.setLngLat(order.b);
  renderStopMarkers();
  window.setTimeout(() => {
    initMapboxMap();
    novaMap?.resize();
    if (routeKey !== lastRouteKey) {
      lastRouteKey = routeKey;
      updateRouteLine();
    }
  }, 80);
}

function showDriverContent(tabName) {
  if (!isDriverApproved()) {
    showDriverVerificationGate();
    return;
  }

  localStorage.setItem(DRIVER_TAB_KEY, tabName);
  if (tabName === "feed") {
    localStorage.removeItem(DRIVER_ACTIVE_ORDER_KEY);
    localStorage.removeItem(DRIVER_DETAIL_ORDER_KEY);
  }
  clearInterval(driverOrdersTimer);
  clearInterval(driverAcceptedTimer);
  $(".workspace").classList.remove("driver-order-view", "view-addresses");
  $("#driverPanel").classList.remove("order-detail-mode");
  $(".content-grid").classList.add("section-mode");
  $(".map-panel").classList.add("is-hidden");
  $("#ridePanel").classList.add("is-hidden");
  $("#infoPanel").classList.add("is-hidden");
  $("#driverPanel").classList.remove("is-hidden");
  $("#screenTitle").textContent = tabName === "feed" ? "Лента" : tabName === "stats" ? "Статистика" : "Кошелек";
  $("#driverContent").innerHTML = driverTabs[tabName];
  $$(".driver-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.driverTab === tabName));
  $$(".menu-item").forEach((item) => item.classList.toggle("is-active", item.dataset.section === "ride" && tabName === "feed"));
  $("#sideMenu").classList.remove("is-open");
  if (tabName === "feed") {
    loadDriverOrders();
    driverOrdersTimer = window.setInterval(loadDriverOrders, 5000);
  }
}

async function showDriverOrderDetails(orderId) {
  const order = state.rideOrders.find((item) => item.id === orderId);
  if (!order) return;
  localStorage.setItem(DRIVER_DETAIL_ORDER_KEY, orderId);
  localStorage.removeItem(DRIVER_ACTIVE_ORDER_KEY);
  localStorage.setItem(DRIVER_TAB_KEY, "feed");

  $(".content-grid").classList.remove("section-mode");
  $(".workspace").classList.add("driver-order-view");
  $(".map-panel").classList.remove("is-hidden");
  $("#ridePanel").classList.add("is-hidden");
  $("#infoPanel").classList.add("is-hidden");
  $("#driverPanel").classList.remove("is-hidden");
  $("#driverPanel").classList.add("order-detail-mode");
  $("#screenTitle").textContent = "Детали заказа";
  $("#driverContent").innerHTML = `
    <div class="driver-detail-sheet">
      <button class="mini-action back-to-feed" type="button">Назад к ленте</button>
      <div class="driver-private-note">
        <strong>Данные клиента скрыты</strong>
        <span>Имя, телефон, рейтинг и чат откроются после того, как клиент выберет ваше предложение.</span>
      </div>
      <div class="driver-route-preview" id="driverRoutePreview">
        <strong>${escapeHtml(order.from)} -> ${escapeHtml(order.to)}</strong>
        <span>${Number(order.distanceKm || 0).toFixed(1)} км · цена клиента ${escapeHtml(order.price)} грн</span>
        ${renderOrderStops(order)}
        ${order.comment ? `<em>${escapeHtml(order.comment)}</em>` : `<em>Без комментария</em>`}
      </div>
      <label class="bid-offer-field">
        <span>Ваше предложение</span>
        <input type="number" min="1" value="${escapeHtml(order.price || state.selectedPrice)}" data-bid-price="${escapeHtml(order.id)}" inputmode="numeric" />
        <em>Клиент увидит вашу цену и сможет выбрать вас.</em>
      </label>
      <button class="primary-action accept-detail-order" data-order="${escapeHtml(order.id)}" type="button">Отправить предложение</button>
    </div>
  `;
  applyOrderToMap(order);
}

async function acceptRideOrder(orderId) {
  const button = document.querySelector(`[data-order="${CSS.escape(orderId)}"].accept-detail-order`);
  if (button) setButtonLoading(button, true, "Отправляем...");
  const bidInput = document.querySelector(`[data-bid-price="${CSS.escape(orderId)}"]`);
  const bidPrice = Number(bidInput?.value || 0);
  const order = state.rideOrders.find((item) => item.id === orderId);

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...getDriverProfilePayload(),
        price: bidPrice > 0 ? bidPrice : order?.price || state.selectedPrice,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось отправить предложение.");
    }

    showDriverAcceptedOrder(data.order);
  } catch (error) {
    alert(error.message);
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

function showDriverAcceptedOrder(order, options = {}) {
  const shouldPoll = options.poll !== false;
  const shouldSyncMap = options.syncMap !== false;
  if (order?.id) {
    localStorage.setItem(DRIVER_ACTIVE_ORDER_KEY, order.id);
    localStorage.removeItem(DRIVER_DETAIL_ORDER_KEY);
    localStorage.setItem(DRIVER_TAB_KEY, "feed");
  }
  if (shouldPoll && order?.id && ["open", "accepted", "completed"].includes(order.status) && !driverAcceptedTimer) {
    driverAcceptedTimer = window.setInterval(() => pollDriverAcceptedOrder(order.id), 1500);
  }

  $(".workspace").classList.add("driver-order-view");
  $(".content-grid").classList.remove("section-mode");
  $(".map-panel").classList.remove("is-hidden");
  $("#driverPanel").classList.add("order-detail-mode");
  $("#ridePanel").classList.add("is-hidden");
  $("#infoPanel").classList.add("is-hidden");
  $("#driverPanel").classList.remove("is-hidden");
  $("#screenTitle").textContent = order.status === "completed" ? "Поездка завершена" : order.status === "accepted" ? "Заказ подтвержден" : "Предложение отправлено";
  if (order.status === "completed") {
    $("#driverContent").innerHTML = renderCompletedOrderPanel(order, "driver");
    if (shouldSyncMap) applyOrderToMap(order);
    return;
  }

  $("#driverContent").innerHTML = `
    <div class="driver-detail-sheet accepted ${order.status === "accepted" ? "confirmed" : ""}">
      <div class="accepted-badge">${order.status === "accepted" ? "Клиент выбрал вас" : "Предложение у клиента"}</div>
      ${
        order.status === "accepted"
          ? `
            <div class="client-profile-row">
              <div class="client-avatar">${escapeHtml((order.passengerName || "К").slice(0, 1).toUpperCase())}</div>
              <div>
                <strong>${escapeHtml(order.passengerName || "Клиент")}</strong>
                <span>${escapeHtml(getDriverStageText(order))} · рейтинг ${escapeHtml(order.passengerRating || 5)}</span>
              </div>
            </div>
            ${renderContactButtons(order.passengerPhone || "+380", "client-")}
            <div class="driver-stage-actions">${renderDriverStageActions(order)}</div>
          `
          : `
            <div class="driver-private-note">
              <strong>Ждем подтверждение клиента</strong>
              <span>Личные данные, телефон и чат откроются только после выбора вашего предложения.</span>
            </div>
          `
      }
      <div class="driver-route-preview">
        <strong>${escapeHtml(order.from)} -> ${escapeHtml(order.to)}</strong>
        <span>${Number(order.distanceKm || 0).toFixed(1)} км · ${escapeHtml(order.price)} грн</span>
        ${renderOrderStops(order)}
      </div>
      ${order.status === "accepted" ? renderRideChat(order, "driver") : ""}
      <button class="ghost-action cancel-order" data-order="${escapeHtml(order.id)}" data-sender="driver" type="button">Отменить заказ</button>
    </div>
  `;
  if (order.status === "accepted") scrollRideChatToBottom($("#driverContent"));
  if (shouldSyncMap) applyOrderToMap(order);
}

async function pollDriverAcceptedOrder(orderId) {
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Заказ не найден.");
    if (data.order.status === "open" && !hasCurrentDriverOffer(data.order)) {
      showDriverOfferDeclined();
      return;
    }
    if (data.order.status === "canceled") {
      showDriverOrderCanceled(data.order);
      return;
    }
    if (data.order.status === "accepted" && isRideChatFocused(orderId)) {
      return;
    }
    if (data.order.status === "completed") {
      clearInterval(driverAcceptedTimer);
      driverAcceptedTimer = null;
    }
    if (!["open", "accepted", "completed"].includes(data.order.status)) {
      clearInterval(driverAcceptedTimer);
      driverAcceptedTimer = null;
    }
    showDriverAcceptedOrder(data.order, { syncMap: false, poll: true });
  } catch {
    clearInterval(driverAcceptedTimer);
    driverAcceptedTimer = null;
  }
}

function saveActiveOrder(order) {
  if (!order?.id) return;
  localStorage.setItem(ACTIVE_ORDER_KEY, order.id);
}

function clearActiveOrder() {
  localStorage.removeItem(ACTIVE_ORDER_KEY);
  clearInterval(activeOrderTimer);
  $("#offerBackdrop")?.remove();
  document.body.classList.remove("has-offer-overlay");
  $(".workspace")?.classList.remove("passenger-active-ride");
}

function renderPassengerActiveOrder(order) {
  let panel = $("#activeOrderPanel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "activeOrderPanel";
    panel.className = "active-order-panel";
  }
  let backdrop = $("#offerBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "offerBackdrop";
    backdrop.className = "offer-backdrop";
  }
  const progress = Math.max(0, Math.min(100, ((Number(order.secondsLeft || 0) / ORDER_SEARCH_SECONDS) * 100).toFixed(2)));
  panel.style.setProperty("--order-progress", `${progress}%`);
  panel.className = `active-order-panel ${order.status === "completed" ? "ride-completed" : order.status === "accepted" ? "ride-confirmed" : ["expired", "canceled"].includes(order.status) ? "ride-expired" : "offer-toast"}`;
  panel.dataset.rideStage = getRideStage(order);
  $(".workspace")?.classList.toggle("passenger-active-ride", order.status === "accepted");
  const isOfferOverlay = order.status === "open";
  const panelHost = isOfferOverlay ? $("#taxiScreen") : $("#ridePanel");
  if (panel.parentElement !== panelHost) panelHost.append(panel);
  if (isOfferOverlay) {
    if (backdrop.parentElement !== $("#taxiScreen")) $("#taxiScreen").append(backdrop);
    document.body.classList.add("has-offer-overlay");
  } else {
    backdrop.remove();
    document.body.classList.remove("has-offer-overlay");
  }

  if (["expired", "canceled"].includes(order.status)) {
    clearActiveOrder();
    panel.innerHTML = `
      <div class="accepted-badge expired">${order.status === "canceled" ? "Заказ отменен" : "Поиск истек"}</div>
      <strong>${order.status === "canceled" ? "Поездка отменена" : "Заказ отменен автоматически"}</strong>
      <span>${order.status === "canceled" ? "Можно создать новый заказ, когда будете готовы." : "40 секунд прошли. Создайте новый заказ, чтобы снова отправить его водителям."}</span>
    `;
    return;
  }

  if (order.status === "completed") {
    clearInterval(activeOrderTimer);
    activeOrderTimer = null;
    $(".workspace")?.classList.remove("passenger-active-ride");
    panel.innerHTML = renderCompletedOrderPanel(order, "passenger");
    applyOrderToMap(order);
    return;
  }

  if (order.status === "accepted" && order.driver) {
    const driver = order.driver;
    const stage = getRideStage(order);
    const liveText = stage === "arrived"
      ? "Водитель ждет вас у точки посадки"
      : stage === "in_progress"
        ? "Вы в поездке · едем к точке B"
        : "Таксист движется к точке A";
    panel.innerHTML = `
      <div class="accepted-badge">${escapeHtml(getPassengerStageTitle(order))}</div>
      <div class="client-profile-row driver-profile-row">
        <div class="client-avatar">${escapeHtml(driver.avatar || driver.name.slice(0, 1).toUpperCase())}</div>
        <div>
          <strong>${escapeHtml(driver.name)}</strong>
          <span>Рейтинг ${escapeHtml(driver.rating || 4.86)} · NovaRide driver</span>
        </div>
      </div>
      ${renderContactButtons(driver.phone || "+380", "driver-")}
      <div class="driver-live-line"><span></span><strong>${escapeHtml(liveText)}</strong></div>
      ${renderRideChat(order, "passenger")}
      <button class="ghost-action cancel-order" data-order="${escapeHtml(order.id)}" data-sender="passenger" type="button">Отменить заказ</button>
    `;
    scrollRideChatToBottom(panel);
    applyOrderToMap(order);
    showDriverCarOnMap(order);
    return;
  }

  const declined = state.declinedOffers[order.id] || [];
  const offers = (order.offers || []).filter((offer) => !declined.includes(offer.id)).slice(-5);
  panel.innerHTML = `
    <div class="accepted-badge waiting">Поиск водителя · ${escapeHtml(order.secondsLeft || 0)} сек</div>
    <strong>${escapeHtml(order.from)} -> ${escapeHtml(order.to)}</strong>
    <span>${offers.length ? "Выберите подходящее предложение." : "Ждем предложения от водителей."}</span>
    <div class="offer-list">
      ${offers
        .map(
          (offer) => `
            <article class="offer-card">
              <div class="client-profile-row">
                <div class="client-avatar">${escapeHtml(offer.driver.avatar || offer.driver.name.slice(0, 1).toUpperCase())}</div>
                <div>
                  <strong>${escapeHtml(offer.driver.name)}</strong>
                  <span>Рейтинг ${escapeHtml(offer.driver.rating || 4.86)} · ${escapeHtml(offer.etaMinutes)} мин</span>
                </div>
              </div>
              <strong>${escapeHtml(offer.price)} грн</strong>
              <div class="offer-actions">
                <button class="offer-action-button is-secondary decline-offer" data-order="${escapeHtml(order.id)}" data-offer="${escapeHtml(offer.id)}" type="button">Отклонить</button>
                <button class="offer-action-button is-primary choose-offer" data-order="${escapeHtml(order.id)}" data-offer="${escapeHtml(offer.id)}" type="button">Выбрать</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
    <button class="ghost-action cancel-order" data-order="${escapeHtml(order.id)}" data-sender="passenger" type="button">Отменить поиск</button>
  `;
}

async function declinePassengerOffer(orderId, offerId) {
  const panel = $("#activeOrderPanel");
  const currentOrderId = orderId || panel?.querySelector(".choose-offer")?.dataset.order || localStorage.getItem(ACTIVE_ORDER_KEY);
  if (!currentOrderId) return;
  const button = document.querySelector(`.decline-offer[data-offer="${CSS.escape(offerId)}"]`);
  if (button) setButtonLoading(button, true, "...");

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(currentOrderId)}/decline-offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось отклонить предложение.");
  } catch (error) {
    alert(error.message);
    if (button) setButtonLoading(button, false);
    return;
  }

  state.declinedOffers[currentOrderId] = [...(state.declinedOffers[currentOrderId] || []), offerId];
  const card = document.querySelector(`.decline-offer[data-offer="${CSS.escape(offerId)}"]`)?.closest(".offer-card");
  card?.remove();
  if (!document.querySelector(".offer-card")) {
    const list = $(".offer-list");
    if (list) list.innerHTML = `<div class="driver-empty-card"><strong>Предложение отклонено</strong><span>Ждем другие варианты от водителей.</span></div>`;
  }
}

async function acceptPassengerOffer(orderId, offerId) {
  const button = document.querySelector(`[data-offer="${CSS.escape(offerId)}"]`);
  if (button) setButtonLoading(button, true, "Выбираем...");

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/accept-offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось выбрать водителя.");
    renderPassengerActiveOrder(data.order);
  } catch (error) {
    alert(error.message);
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

async function sendRideMessage(orderId, sender) {
  const sendKey = `${orderId}:${sender}`;
  if (sendingRideMessages.has(sendKey)) return;
  const input = document.querySelector(`[data-chat-input="${CSS.escape(orderId)}"]`);
  const text = input?.value.trim();
  if (!text) return;
  markRideChatActive();
  sendingRideMessages.add(sendKey);

  const button = document.querySelector(`.send-ride-message[data-order="${CSS.escape(orderId)}"][data-sender="${CSS.escape(sender)}"]`);
  if (button) setButtonLoading(button, true, "...");

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        name: sender === "driver" ? state.currentUser?.name || "Водитель NovaRide" : state.currentUser?.name || "Клиент",
        text,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось отправить сообщение.");
    input.value = "";
    if (sender === "driver") {
      showDriverAcceptedOrder(data.order, { syncMap: false, poll: true });
    } else {
      renderPassengerActiveOrder(data.order);
    }
  } catch (error) {
    alert(error.message);
  } finally {
    sendingRideMessages.delete(sendKey);
    if (button) setButtonLoading(button, false);
  }
}

async function cancelRideOrder(orderId, sender) {
  const button = document.querySelector(`.cancel-order[data-order="${CSS.escape(orderId)}"]`);
  if (button) setButtonLoading(button, true, "Отменяем...");

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelledBy: sender }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось отменить заказ.");

    if (sender === "driver") {
      clearInterval(driverAcceptedTimer);
      driverAcceptedTimer = null;
      localStorage.removeItem(DRIVER_ACTIVE_ORDER_KEY);
      localStorage.removeItem(DRIVER_DETAIL_ORDER_KEY);
      showDriverContent("feed");
    } else {
      renderPassengerActiveOrder(data.order);
    }
  } catch (error) {
    alert(error.message);
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

async function completeRideOrder(orderId) {
  const button = document.querySelector(`.complete-order[data-order="${CSS.escape(orderId)}"]`);
  if (button) setButtonLoading(button, true, "Завершаем...");

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedBy: "driver" }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось завершить поездку.");
    showDriverAcceptedOrder(data.order, { syncMap: false, poll: true });
  } catch (error) {
    alert(error.message);
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

async function updateRideStage(orderId, stage) {
  const button = document.querySelector(`.update-ride-stage[data-order="${CSS.escape(orderId)}"][data-stage="${CSS.escape(stage)}"]`);
  const loadingText = stage === "arrived" ? "Отмечаем..." : "Начинаем...";
  if (button) setButtonLoading(button, true, loadingText);

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось обновить этап поездки.");

    showDriverAcceptedOrder(data.order, { syncMap: false, poll: true });
  } catch (error) {
    alert(error.message);
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

async function rateRideOrder(orderId, role, rating) {
  const button = document.querySelector(`[data-rate-order="${CSS.escape(orderId)}"][data-rate-role="${CSS.escape(role)}"][data-rate-value="${CSS.escape(String(rating))}"]`);
  if (button) setButtonLoading(button, true, "★");

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, rating }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось сохранить оценку.");

    if (role === "driver") {
      showDriverAcceptedOrder(data.order, { syncMap: false, poll: false });
    } else {
      renderPassengerActiveOrder(data.order);
    }
  } catch (error) {
    alert(error.message);
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

async function pollActiveOrder(orderId) {
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Заказ не найден.");
    const currentStage = $("#activeOrderPanel")?.dataset.rideStage || "";
    if (data.order.status === "accepted" && isRideChatFocused(orderId) && getRideStage(data.order) === currentStage) {
      return;
    }
    renderPassengerActiveOrder(data.order);
  } catch {
    clearActiveOrder();
  }
}

function startActiveOrderPolling(orderId) {
  if (!orderId) return;
  clearInterval(activeOrderTimer);
  pollActiveOrder(orderId);
  activeOrderTimer = window.setInterval(() => pollActiveOrder(orderId), 1000);
}

function restoreActiveOrder() {
  const orderId = localStorage.getItem(ACTIVE_ORDER_KEY);
  if (orderId) startActiveOrderPolling(orderId);
}

async function restoreDriverView() {
  await refreshDriverVerificationStatus();
  const wantsDriverView = Boolean(
    localStorage.getItem(DRIVER_ACTIVE_ORDER_KEY)
      || localStorage.getItem(DRIVER_DETAIL_ORDER_KEY)
      || localStorage.getItem(DRIVER_TAB_KEY),
  );

  if (wantsDriverView && !isDriverApproved()) {
    state.driverMode = true;
    updateMenuForRole();
    localStorage.removeItem(DRIVER_ACTIVE_ORDER_KEY);
    localStorage.removeItem(DRIVER_DETAIL_ORDER_KEY);
    showDriverVerificationGate();
    return true;
  }

  const driverOrderId = localStorage.getItem(DRIVER_ACTIVE_ORDER_KEY);
  if (driverOrderId) {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(driverOrderId)}`);
      const data = await response.json();
      if (response.ok && data.ok && ["open", "accepted", "completed"].includes(data.order.status)) {
        state.driverMode = true;
        updateMenuForRole();
        showDriverAcceptedOrder(data.order);
        return true;
      }
    } catch {
      // If the order can no longer be restored, fall back to the saved driver tab.
    }
    localStorage.removeItem(DRIVER_ACTIVE_ORDER_KEY);
  }

  const driverDetailOrderId = localStorage.getItem(DRIVER_DETAIL_ORDER_KEY);
  if (driverDetailOrderId) {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(driverDetailOrderId)}`);
      const data = await response.json();
      if (response.ok && data.ok && data.order.status === "open") {
        state.driverMode = true;
        state.rideOrders = [data.order, ...state.rideOrders.filter((order) => order.id !== data.order.id)];
        updateMenuForRole();
        showDriverOrderDetails(data.order.id);
        return true;
      }
    } catch {
      // If details cannot be restored, fall back to the saved driver tab.
    }
    localStorage.removeItem(DRIVER_DETAIL_ORDER_KEY);
  }

  const savedTab = localStorage.getItem(DRIVER_TAB_KEY);
  if (savedTab && ["feed", "stats", "wallet"].includes(savedTab)) {
    state.driverMode = true;
    updateMenuForRole();
    showDriverContent(savedTab);
    return true;
  }

  return false;
}

function showDriverCarOnMap() {
  driverCarMarker?.remove();
  driverCarMarker = null;
}

async function createRideOrder() {
  const button = $("#orderBtn");
  const from = $("#fromInput").value.trim();
  const to = $("#toInput").value.trim();
  const selectedClass = $(".class-card.is-selected")?.dataset.className || "Эконом";

  if (!from || !to) {
    alert("Выберите адрес точки A и точки B.");
    return;
  }

  if (!state.authSessionToken && !state.currentUser?.destination && !state.authDestination) {
    alert("Профиль не найден. Откройте приложение заново.");
    return;
  }

  const clientPrice = getClientRidePrice();
  if (!clientPrice) {
    alert("Укажите цену, которую вы готовы предложить водителю.");
    $("#clientPriceInput")?.focus();
    return;
  }
  state.selectedPrice = clientPrice;

  setButtonLoading(button, true, "Создаем заказ...");
  let created = false;

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionToken: state.authSessionToken,
        destination: state.currentUser?.destination || state.authDestination,
        from,
        to,
        a: mapPoints.a,
        b: mapPoints.b,
        stops: getRouteStops(),
        carClass: selectedClass,
        price: clientPrice,
        distanceKm: state.tripDistanceKm,
        comment: $("#rideComment").value.trim(),
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось создать заказ.");
    }

    created = true;
    saveActiveOrder(data.order);
    renderPassengerActiveOrder(data.order);
    startActiveOrderPolling(data.order.id);
  } catch (error) {
    alert(error.message);
  } finally {
    setButtonLoading(button, false);
    if (created) {
      button.textContent = "Заказ в ленте водителей";
      window.setTimeout(() => {
        button.textContent = "Найти водителя";
      }, 2200);
    }
  }
}

function setDriverTab(tabName) {
  showDriverContent(tabName);
}

function updateMenuForRole() {
  const rideItem = $('.menu-item[data-section="ride"]');
  const historyItem = $('.menu-item[data-section="history"]');
  const addressesItem = $('.menu-item[data-section="addresses"]');
  const driverChatItem = $('.menu-item[data-section="driverChat"]');
  const profileCard = $(".profile-card");

  rideItem.textContent = state.driverMode ? "Лента" : "Поездка";
  historyItem.textContent = state.driverMode ? "История поездок" : "История заказов";
  addressesItem.classList.toggle("is-hidden", state.driverMode);
  driverChatItem?.classList.toggle("is-hidden", !state.driverMode);
  $("#driverModeBtn").textContent = state.driverMode ? "Стать пассажиром" : "Стать водителем";
  profileCard.classList.toggle("is-driver-verified", state.driverMode && isDriverApproved());
  $(".profile-card span").textContent = state.driverMode
    ? isDriverApproved()
      ? "Водитель подтвержден · рейтинг 4.86"
      : "Верификация водителя"
    : `Рейтинг ${state.currentUser?.rating || 5}`;
}

function saveAddress(button) {
  const title = iconLabels[button.dataset.icon] || "Место";
  const address = $("#fromInput").value.trim() || "Одесса";
  const customName = button.dataset.icon === "custom" ? prompt("Как назвать адрес?", "Мое место") : title;

  state.savedAddresses = state.savedAddresses.filter((item) => item.title !== (customName || title));
  state.savedAddresses.push({ icon: button.dataset.icon, title: customName || title, address });
  persistSavedAddresses();
  button.innerHTML = `<span class="chip-icon ${button.dataset.icon}-symbol"></span>${customName || title}`;
  button.classList.add("is-active");
}

function showSectionAction(action) {
  const box = $("#sectionActionBox");
  if (!box) return;

  const templates = {
    emergency: `<div class="call-panel"><strong>112</strong><span>Вызов экстренной службы подготовлен</span><a href="tel:112">Позвонить 112</a></div>`,
    security: `<div class="chat-panel"><strong>Служба безопасности</strong><textarea placeholder="Опишите ситуацию администратору"></textarea><button class="primary-action" type="button">Отправить сообщение</button><a href="mailto:safety@novaride.ua">Написать письмо</a></div>`,
    privacy: `<div class="text-panel"><strong>Политика NovaRide</strong><p>Мы храним только данные, нужные для поездки: профиль, маршрут, историю заказов, чат и обращения в поддержку. Данные водителя и клиента используются для безопасности, качества сервиса и связи во время поездки.</p><a href="/privacy.html" target="_blank" rel="noopener">Открыть полную политику</a></div>`,
    legal: `<div class="text-panel"><strong>Правовые документы</strong><p>Публичная оферта, используемые лицензии, правила обработки данных и условия работы водителей NovaRide.</p></div>`,
    support: `<div class="chat-panel"><strong>Чат с администратором</strong><div class="message admin">Здравствуйте, чем помочь?</div><textarea placeholder="Напишите сообщение"></textarea><button class="primary-action" type="button">Отправить</button></div>`,
    faq: `<div class="faq-panel"><details open><summary>Как отменить поездку?</summary><p>Откройте активный заказ и нажмите отмену до прибытия водителя.</p></details><details><summary>Можно ли ехать с животным?</summary><p>Да, напишите это в комментарии водителю.</p></details><details><summary>Как работает торг?</summary><p>Водитель может предложить цену, а клиент принимает подходящий вариант.</p></details><details><summary>Можно ли добавить остановку?</summary><p>Да, нажмите + остановка в карточке маршрута.</p></details><details><summary>Как сохранить адрес?</summary><p>Откройте Мои адреса и нажмите плюс.</p></details><details><summary>Что делать, если водитель не приехал?</summary><p>Откройте Помощь и напишите в чат администратору.</p></details></div>`,
  };

  box.innerHTML = templates[action] || "";
}

function placePoint(point) {
  const input = point === "a" ? $("#fromInput") : $("#toInput");
  input.value = point === "a" ? "Точка на карте, центр Одессы" : "Точка на карте, Аркадия";
  activeMapPoint = point === "a" ? "b" : "a";
}

function createMapMarker(label, className) {
  const marker = document.createElement("div");
  marker.className = `mapbox-marker ${className}`;
  marker.innerHTML = `<span>${label}</span>`;
  marker.setAttribute("aria-label", `Точка ${label}`);
  return marker;
}

function createDriverMarker() {
  const marker = document.createElement("div");
  marker.className = "driver-map-marker";
  marker.style.pointerEvents = "none";
  marker.innerHTML = "<span></span>";
  return marker;
}

function createUserLocationMarker() {
  const marker = document.createElement("div");
  marker.className = "user-location-marker";
  marker.innerHTML = "<span></span>";
  return marker;
}

function setPickupToUserLocation(coordinates) {
  mapPoints.a = coordinates;
  pickupMarker?.setLngLat(coordinates);

  activeMapPoint = "b";
  reverseGeocodePoint("a", coordinates);
  updateRouteLine();
  novaMap?.flyTo({ center: coordinates, zoom: 15, pitch: 42, duration: 900 });
}

function requestUserLocation() {
  if (!navigator.geolocation) {
    alert("Геолокация не поддерживается этим браузером.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => setPickupToUserLocation([position.coords.longitude, position.coords.latitude]),
    () => alert("Разрешите доступ к геолокации, чтобы NovaRide выбрал вашу точку посадки."),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

function initMapboxMap() {
  if (novaMap || !window.mapboxgl || !$("#realMap")) {
    return;
  }

  if (!MAPBOX_TOKEN) {
    return;
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;
  $("#mapCanvas").classList.add("loading-real-map");

  try {
    novaMap = new mapboxgl.Map({
      container: "realMap",
      style: document.body.classList.contains("dark") ? "mapbox://styles/mapbox/navigation-night-v1" : "mapbox://styles/mapbox/streets-v12",
      center: ODESSA_CENTER,
      zoom: 13,
      pitch: 34,
      bearing: -10,
      attributionControl: false,
    });

    novaMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    pickupMarker = new mapboxgl.Marker({ element: createMapMarker("A", "pickup"), draggable: false, anchor: "center" }).setLngLat(mapPoints.a).addTo(novaMap);
    destinationMarker = new mapboxgl.Marker({ element: createMapMarker("B", "destination"), draggable: false, anchor: "center" })
      .setLngLat(mapPoints.b)
      .addTo(novaMap);

    novaMap.on("load", () => {
      $("#mapCanvas").classList.add("has-real-map");
      $("#mapCanvas").classList.remove("loading-real-map");
      localizeMapLabels();
      installRouteLayer();
      installStopLayer();
      renderStopMarkers();

      updateRouteLine();
    });
  } catch (error) {
    $("#mapCanvas").classList.remove("loading-real-map");
  }
}

function bindEvents() {
  $$(".mode-button").forEach((button) => button.addEventListener("click", () => setAuthFlow(button.dataset.authFlow)));
  $$(".auth-tab").forEach((tab) => tab.addEventListener("click", () => setAuthMode(tab.dataset.auth)));
  $$(".segment").forEach((segment) =>
    segment.addEventListener("click", () => {
      $$(".segment").forEach((item) => item.classList.remove("is-active"));
      segment.classList.add("is-active");
    }),
  );
  $("#sendCodeBtn").addEventListener("click", showVerification);
  $("#phoneInput").addEventListener("input", scheduleAccountCheck);
  $("#emailInput").addEventListener("input", scheduleAccountCheck);
  $("#backToStartBtn").addEventListener("click", () => setAuthStep("start"));
  $("#verifyCodeBtn").addEventListener("click", verifyCode);
  $("#codeInput").addEventListener("input", () => {
    $("#codeError").classList.add("is-hidden");
    $("#accountExistsWarning").classList.add("is-hidden");
  });
  $("#authForm").addEventListener("submit", finishAuth);
  $("#clientPriceInput")?.addEventListener("input", syncClientRidePrice);
  bindAddressSearch();
  $("#ridePanel").addEventListener("pointerdown", (event) => {
    const suggestion = event.target.closest(".address-suggestions button");
    if (!suggestion) return;

    event.preventDefault();
    const container = suggestion.closest(".address-suggestions");
    const point = container.dataset.suggestions;
    const center = suggestion.dataset.center.split(",").map(Number);
    setAddressPoint(point, center, suggestion.dataset.label || suggestion.querySelector("strong")?.textContent.trim() || suggestion.textContent.trim());
  });
  $("#taxiScreen").addEventListener("click", (event) => {
    const openChatButton = event.target.closest(".open-chat");
    if (openChatButton) {
      focusRideChat(openChatButton);
      return;
    }

    const offerButton = event.target.closest(".choose-offer");
    if (offerButton) {
      acceptPassengerOffer(offerButton.dataset.order, offerButton.dataset.offer);
      return;
    }

    const declineButton = event.target.closest(".decline-offer");
    if (declineButton) {
      declinePassengerOffer(declineButton.dataset.order, declineButton.dataset.offer);
      return;
    }

    const chatButton = event.target.closest(".send-ride-message");
    if (chatButton) {
      sendRideMessage(chatButton.dataset.order, chatButton.dataset.sender);
      return;
    }

    const cancelButton = event.target.closest(".cancel-order");
    if (cancelButton) {
      cancelRideOrder(cancelButton.dataset.order, cancelButton.dataset.sender);
      return;
    }

    const rateButton = event.target.closest("[data-rate-order]");
    if (rateButton) {
      rateRideOrder(rateButton.dataset.rateOrder, rateButton.dataset.rateRole, rateButton.dataset.rateValue);
      return;
    }

    if (event.target.closest(".back-to-ride")) {
      clearActiveOrder();
      $("#activeOrderPanel")?.remove();
      showSection("ride");
    }
  });
  $("#ridePanel").addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-chat-input]");
    if (input && event.key === "Enter") {
      event.preventDefault();
      sendRideMessage(input.dataset.chatInput, "passenger");
    }
  });
  ["pointerdown", "touchstart", "focusin", "input"].forEach((eventName) => {
    $("#ridePanel").addEventListener(eventName, (event) => {
      if (event.target.closest("[data-chat-input]")) markRideChatActive();
    }, true);
  });
  $("#addStopBtn").addEventListener("click", addStop);
  $$(".class-card").forEach((card) => card.addEventListener("click", () => selectClass(card)));
  bindClassPanelGestures();
  $$(".time-chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      $$(".time-chip").forEach((item) => item.classList.remove("is-active"));
      chip.classList.add("is-active");
    }),
  );
  $$(".map-pin").forEach((pin) => pin.addEventListener("click", () => placePoint(pin.dataset.point)));
  $("#locateMeBtn")?.addEventListener("click", requestUserLocation);
  $$(".menu-item").forEach((item) => item.addEventListener("click", () => showSection(item.dataset.section)));
  $("#menuToggle").addEventListener("click", (event) => {
    event.stopPropagation();
    $("#sideMenu").classList.toggle("is-open");
  });
  $(".workspace").addEventListener("click", () => $("#sideMenu").classList.remove("is-open"));
  $("#sideMenu").addEventListener("click", (event) => event.stopPropagation());
  $("#driverModeBtn").addEventListener("click", () => (state.driverMode ? showPassengerMode() : showDriverMode()));
  $$(".driver-tab").forEach((tab) => tab.addEventListener("click", () => setDriverTab(tab.dataset.driverTab)));
  $("#driverPanel").addEventListener("click", (event) => {
    const refreshVerificationButton = event.target.closest(".refresh-driver-verification");
    if (refreshVerificationButton) {
      showDriverMode();
      return;
    }

    const openVerificationButton = event.target.closest("[data-open-verification-step]");
    if (openVerificationButton) {
      const form = openVerificationButton.closest("#driverVerificationForm");
      if (form) openVerificationStep(form, openVerificationButton.dataset.openVerificationStep);
      return;
    }

    const completeStepButton = event.target.closest(".complete-verification-step");
    if (completeStepButton) {
      const form = completeStepButton.closest("#driverVerificationForm");
      if (form) completeDriverVerificationStep(form, completeStepButton.dataset.completeStep);
      return;
    }

    const openChatButton = event.target.closest(".open-chat");
    if (openChatButton) {
      focusRideChat(openChatButton);
      return;
    }

    const hideButton = event.target.closest(".order-hide-button");
    if (hideButton) {
      hideDriverOrder(hideButton.dataset.orderHide);
      return;
    }

    const openOrder = event.target.closest("[data-open-order]");
    if (openOrder) {
      if (openOrder.dataset.ignoreClick) return;
      showDriverOrderDetails(openOrder.dataset.openOrder);
      return;
    }

    const detailButton = event.target.closest(".order-detail");
    if (detailButton) {
      showDriverOrderDetails(detailButton.dataset.order);
      return;
    }

    const acceptButton = event.target.closest(".order-accept, .accept-detail-order");
    if (acceptButton) {
      acceptRideOrder(acceptButton.dataset.order);
      return;
    }

    const chatButton = event.target.closest(".send-ride-message");
    if (chatButton) {
      sendRideMessage(chatButton.dataset.order, chatButton.dataset.sender);
      return;
    }

    const cancelButton = event.target.closest(".cancel-order");
    if (cancelButton) {
      cancelRideOrder(cancelButton.dataset.order, cancelButton.dataset.sender);
      return;
    }

    const completeButton = event.target.closest(".complete-order");
    if (completeButton) {
      completeRideOrder(completeButton.dataset.order);
      return;
    }

    const stageButton = event.target.closest(".update-ride-stage");
    if (stageButton) {
      updateRideStage(stageButton.dataset.order, stageButton.dataset.stage);
      return;
    }

    const rateButton = event.target.closest("[data-rate-order]");
    if (rateButton) {
      rateRideOrder(rateButton.dataset.rateOrder, rateButton.dataset.rateRole, rateButton.dataset.rateValue);
      return;
    }

    if (event.target.closest(".back-to-feed")) {
      showDriverContent("feed");
    }
  });
  $("#driverPanel").addEventListener("keydown", (event) => {
    const openOrder = event.target.closest("[data-open-order]");
    if (openOrder && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      showDriverOrderDetails(openOrder.dataset.openOrder);
      return;
    }

    const input = event.target.closest("[data-chat-input]");
    if (input && event.key === "Enter") {
      event.preventDefault();
      sendRideMessage(input.dataset.chatInput, "driver");
    }
  });
  $("#driverPanel").addEventListener("submit", (event) => {
    const form = event.target.closest("#driverVerificationForm");
    if (!form) return;
    event.preventDefault();
    submitDriverVerification(form);
  });
  $("#driverPanel").addEventListener("change", (event) => {
    const fileInput = event.target.closest("#driverVerificationForm input[type='file']");
    if (fileInput) {
      syncVerificationFileName(fileInput);
      updateVerificationSubmit(fileInput.closest("#driverVerificationForm"));
    }
  });
  $("#driverPanel").addEventListener("input", (event) => {
    const form = event.target.closest("#driverVerificationForm");
    if (form) updateVerificationSubmit(form);
  });
  ["pointerdown", "touchstart", "focusin", "input"].forEach((eventName) => {
    $("#driverPanel").addEventListener(eventName, (event) => {
      if (event.target.closest("[data-chat-input]")) markRideChatActive();
    }, true);
  });
  $("#infoPanel").addEventListener("click", (event) => {
    const historyOrder = event.target.closest("[data-history-order]");
    if (historyOrder) {
      openHistoryOrder(historyOrder.dataset.historyOrder, historyOrder.dataset.historyRole);
      return;
    }

    const backToHistory = event.target.closest(".back-to-history");
    if (backToHistory) {
      showSection("history");
      return;
    }

    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) {
      showSectionAction(actionTarget.dataset.action);
    }

    const themeTarget = event.target.closest("[data-theme]");
    if (themeTarget) {
      applyTheme(themeTarget.dataset.theme);
    }

    const langTarget = event.target.closest("[data-lang]");
    if (langTarget) {
      applyLanguage(langTarget.dataset.lang);
    }

    const unitTarget = event.target.closest("[data-unit]");
    if (unitTarget) {
      state.distanceUnit = unitTarget.dataset.unit;
      $("#sectionActionBox").innerHTML = `<div class="text-panel"><strong>Единицы расстояния</strong><p>Выбрано: ${unitTarget.textContent}.</p></div>`;
    }

    const accountTarget = event.target.closest("[data-account]");
    if (accountTarget) {
      leaveAccount(accountTarget.dataset.account);
    }

    if (event.target.closest("#sendDriverCommunityMessage")) {
      sendDriverCommunityMessage();
      return;
    }

    if (event.target.closest("#addAddressBtn")) {
      addAddressFromSection();
      return;
    }

    if (event.target.closest("#saveNewAddressBtn")) {
      saveNewAddressFromForm();
      return;
    }

    const savedSuggestion = event.target.closest('[data-suggestions="saved-address"] button');
    if (savedSuggestion) {
      event.preventDefault();
      const input = $("#newAddressValue");
      if (input) {
        input.value = savedSuggestion.dataset.label || savedSuggestion.querySelector("strong")?.textContent.trim() || savedSuggestion.textContent.trim();
        input.dataset.selectedCenter = savedSuggestion.dataset.center || "";
      }
      hideAddressSuggestions("saved-address");
      return;
    }

    const addressTarget = event.target.closest(".use-address");
    if (addressTarget) {
      const card = addressTarget.closest("[data-address]");
      const center = card.querySelector(".address-coordinates")?.dataset.center?.split(",").map(Number);
      useSavedAddressForRide(card.dataset.address, center);
      return;
    }

    const deleteAddressButton = event.target.closest(".delete-address");
    if (deleteAddressButton) {
      deleteSavedAddress(deleteAddressButton.closest("[data-address]"));
      return;
    }
  });
  $("#infoPanel").addEventListener("keydown", (event) => {
    if (event.target.closest("#driverCommunityInput") && event.key === "Enter") {
      event.preventDefault();
      sendDriverCommunityMessage();
      return;
    }

    const historyOrder = event.target.closest("[data-history-order]");
    if (historyOrder && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openHistoryOrder(historyOrder.dataset.historyOrder, historyOrder.dataset.historyRole);
    }
  });
  $("#themeQuickBtn").addEventListener("click", () => applyTheme(document.body.classList.contains("dark") ? "light" : "dark"));
  $("#orderBtn").addEventListener("click", createRideOrder);
}

bindEvents();
setAuthStep("start");
loadAuthConfig();
if (!restorePersistentAuth()) {
  restorePendingAuth();
}

function bindClassPanelGestures() {
  const panel = $("#classGrid");
  if (!panel) return;

  let startY = 0;

  panel.addEventListener("click", (event) => {
    if (event.target === panel || event.target.closest("#classPanelHandle")) {
      panel.classList.toggle("is-collapsed");
    }
  });

  panel.addEventListener("pointerdown", (event) => {
    startY = event.clientY;
  });

  panel.addEventListener("pointerup", (event) => {
    const delta = event.clientY - startY;
    if (delta > 28) {
      panel.classList.add("is-collapsed");
    }
    if (delta < -28) {
      panel.classList.remove("is-collapsed");
    }
  });
}
