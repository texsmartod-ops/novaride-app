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
  language: "ru",
  distanceUnit: "km",
  savedAddresses: [
    { icon: "home", title: "Дом", address: "Одесса, Дерибасовская 1" },
    { icon: "work", title: "Работа", address: "Одесса, Екатерининская 18" },
    { icon: "gym", title: "Зал", address: "Французский бульвар 22" },
    { icon: "shop", title: "Магазин", address: "Gagarinn Plaza" },
  ],
};

const PRICE_PER_KM = 15;
const PENDING_AUTH_KEY = "novaride_pending_auth";

let MAPBOX_TOKEN = "";
const ODESSA_CENTER = [30.7233, 46.4825];
let novaMap;
let activeMapPoint = "a";
let pickupMarker;
let destinationMarker;
let mapPoints = {
  a: [30.7326, 46.4858],
  b: [30.7597, 46.4304],
};
let addressSearchTimer;
let accountCheckTimer;

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
];

const DRIVER_ORDERS = {
  arcadia: {
    title: "Дерибасовская 1 -> Аркадия",
    from: "Дерибасовская 1",
    to: "Аркадия",
    a: [30.7355, 46.4846],
    b: [30.7612, 46.4311],
    details: "1 пассажир · без детей · без животных",
  },
  tairova: {
    title: "Вокзал -> Таирова",
    from: "ЖД вокзал Одесса",
    to: "Таирова",
    a: [30.7408, 46.4667],
    b: [30.6719, 46.4119],
    details: "2 пассажира · багаж · комфорт",
  },
};

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
      <div class="feature-grid">
        <article class="list-card accent-card"><strong>Дерибасовская 1 -> Аркадия</strong><span>24 июня, 09:40 | Андрей | +380 67 442 11 09</span><em>Оценка 5.0</em></article>
        <article class="list-card"><strong>Вокзал -> Французский бульвар</strong><span>21 июня, 18:15 | Марина | +380 93 120 44 80</span><em>Комфорт</em></article>
      </div>
    `,
  },
  addresses: {
    title: "Мои адреса",
    html: () => `
      <div class="section-hero"><span>Быстрый старт</span><h2>Мои адреса</h2><p>Любимые точки Одессы можно вызвать одним касанием.</p></div>
      <button class="add-address-card" id="addAddressBtn" type="button"><span>+</span><strong>Добавить адрес</strong><em>дом, офис, кафе или свое название</em></button>
      <div class="address-create-form is-hidden" id="addressCreateForm">
        <input id="newAddressName" placeholder="Название: Дом, работа, кафе" />
        <input id="newAddressValue" placeholder="Адрес или место в Одессе" />
        <button class="primary-action" id="saveNewAddressBtn" type="button">Сохранить адрес</button>
      </div>
      <div class="address-grid">
        ${state.savedAddresses
          .map(
            (item) => `
              <article class="list-card address-card icon-${item.icon}" data-address="${item.address}">
                <i class="address-icon"></i>
                <strong>${item.title}</strong>
                <span>${item.address}</span>
                <button class="mini-action use-address" type="button">выбрать</button>
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
    <div class="section-hero driver-hero"><span>Режим водителя</span><h2>Лента заказов</h2><p>Выбирайте подходящие поездки и предлагайте свою цену.</p></div>
    <div class="driver-feed">
      <article class="driver-order-card"><i></i><strong>Дерибасовская 1 -> Аркадия</strong><span>1 пассажир · без детей · без животных</span><div class="bid-row"><input value="250" aria-label="Ваша цена" /><button class="mini-action order-detail" data-order="arcadia" type="button">Подробнее</button><button class="primary-action" type="button">Предложить</button></div></article>
      <article class="driver-order-card"><i></i><strong>Вокзал -> Таирова</strong><span>2 пассажира · багаж · комфорт</span><div class="bid-row"><input value="260" aria-label="Ваша цена" /><button class="mini-action order-detail" data-order="tairova" type="button">Подробнее</button><button class="primary-action" type="button">Предложить</button></div></article>
    </div>
    <div class="driver-route-preview" id="driverRoutePreview"></div>
  `,
  stats: `
    <div class="section-hero driver-hero"><span>Динамика</span><h2>Статистика</h2><p>Ваш рейтинг и заработок в реальном времени.</p></div>
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
    title: "Заказы",
    html: `
      <div class="section-hero driver-hero"><span>Мои рейсы</span><h2>Заказы</h2><p>Поездки, которые вы уже выполнили как водитель.</p></div>
      <div class="driver-feed">
        <article class="driver-order-card"><i></i><strong>Аркадия -> Центр</strong><span>24 июня · 250 грн · клиент 4.9</span><em>завершен</em></article>
        <article class="driver-order-card"><i></i><strong>Вокзал -> Таирова</strong><span>23 июня · 310 грн · клиент 5.0</span><em>завершен</em></article>
      </div>
    `,
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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

  sessionStorage.setItem(
    PENDING_AUTH_KEY,
    JSON.stringify({
      token: state.authSessionToken,
      destination: state.authDestination,
      mode: state.authMode,
      flow: state.authFlow,
    }),
  );
}

function clearPendingAuth() {
  sessionStorage.removeItem(PENDING_AUTH_KEY);
}

function restorePendingAuthToken() {
  if (state.authSessionToken) return state.authSessionToken;

  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_AUTH_KEY) || "null");
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
    const pending = JSON.parse(sessionStorage.getItem(PENDING_AUTH_KEY) || "null");
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

    if (state.authFlow === "login" && data.user) {
      clearPendingAuth();
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

function enterApp(userOrName) {
  const user = typeof userOrName === "string" ? { name: userOrName, rating: 4.92 } : userOrName || { name: "Клиент", rating: 4.92 };
  const name = user.name || "Клиент";
  state.currentUser = user;

  if (Array.isArray(user.savedAddresses) && user.savedAddresses.length) {
    state.savedAddresses = user.savedAddresses;
  }

  $("#profileName").textContent = name;
  $("#profileAvatar").textContent = name.slice(0, 1).toUpperCase();
  $(".profile-card span").textContent = `Рейтинг ${user.rating || 4.92}`;
  $("#authScreen").classList.add("is-hidden");
  $("#taxiScreen").classList.remove("is-hidden");
  updateMenuForRole();
  window.setTimeout(() => {
    initMapboxMap();
    novaMap?.resize();
    updateRouteLine();
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

  if (!sessionToken) {
    alert("Сначала подтвердите телефон или email кодом.");
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
    enterApp(data.user);
  } catch (error) {
    alert(error.message);
  } finally {
    setButtonLoading($("#finishAuthBtn"), false);
  }
}

function addStop() {
  const count = $$("#stopsList .field").length + 1;
  const label = document.createElement("label");
  label.className = "field";
  label.innerHTML = `<span>Остановка ${count}</span><input value="Одесса, остановка по пути" />`;
  $("#stopsList").append(label);
}

function selectClass(card) {
  $$(".class-card").forEach((item) => item.classList.remove("is-selected"));
  card.classList.add("is-selected");
  updateTripPrice(state.tripDistanceKm);
}

function updateTripPrice(distanceKm = state.tripDistanceKm) {
  state.tripDistanceKm = Math.max(1, distanceKm || 1);
  state.selectedPrice = Math.round(state.tripDistanceKm * PRICE_PER_KM);
  $("#priceLabel").textContent = `${state.selectedPrice} грн`;
  $("#distanceLabel").textContent = `${state.tripDistanceKm.toFixed(1)} км · 15 грн/км`;
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

function getMapLanguage() {
  return state.language === "uk" ? "uk" : "ru";
}

function formatMapboxPlace(feature) {
  return (feature?.place_name_ru || feature?.place_name_uk || feature?.place_name || "")
    .replace(/, Odesa Oblast/gi, "")
    .replace(/, Odessa Oblast/gi, "")
    .replace(/, Одесская область/gi, "")
    .replace(/, Одеська область/gi, "")
    .replace(/, Ukraine/gi, "")
    .replace(/, Україна/gi, "")
    .replace(/, Украина/gi, "")
    .trim();
}

function formatSuggestionSubtitle(feature) {
  const context = feature?.context || [];
  const pieces = context
    .map((item) => item.text_ru || item.text_uk || item.text)
    .filter(Boolean)
    .filter((item) => !/ukraine|украина|україна/i.test(item));
  return pieces.slice(0, 2).join(", ");
}

function matchesLocalPlace(place, query) {
  const normalized = query.toLowerCase();
  return [place.name, place.subtitle, ...(place.aliases || [])].filter(Boolean).some((value) => value.toLowerCase().includes(normalized));
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

async function updateRouteLine() {
  if (!novaMap || !mapPoints.a || !mapPoints.b) return;

  const directRoute = [mapPoints.a, mapPoints.b];

  try {
    const coordinates = `${mapPoints.a.join(",")};${mapPoints.b.join(",")}`;
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`,
    );
    const data = await response.json();
    const route = data.routes?.[0]?.geometry?.coordinates || directRoute;
    const distanceKm = data.routes?.[0]?.distance ? data.routes[0].distance / 1000 : getDirectDistanceKm(mapPoints.a, mapPoints.b);
    setRouteGeoJson(route);
    updateTripPrice(distanceKm);

    const bounds = route.reduce((box, coord) => box.extend(coord), new mapboxgl.LngLatBounds(route[0], route[0]));
    novaMap.fitBounds(bounds, { padding: { top: 120, right: 460, bottom: 180, left: 80 }, maxZoom: 14.5, duration: 700 });
  } catch {
    setRouteGeoJson(directRoute);
    updateTripPrice(getDirectDistanceKm(mapPoints.a, mapPoints.b));

    const bounds = directRoute.reduce((box, coord) => box.extend(coord), new mapboxgl.LngLatBounds(directRoute[0], directRoute[0]));
    novaMap.fitBounds(bounds, { padding: { top: 120, right: 460, bottom: 180, left: 80 }, maxZoom: 14.5, duration: 700 });
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
  mapPoints[point] = coordinates;
  const marker = point === "a" ? pickupMarker : destinationMarker;
  const input = point === "a" ? $("#fromInput") : $("#toInput");
  marker?.setLngLat(coordinates);
  input.value = label;
  hideAddressSuggestions(point);
  updateRouteLine();
}

async function geocodeAddress(point, query) {
  const cleanQuery = query.trim();
  if (!cleanQuery || !window.mapboxgl) return;

  try {
    const knownPlace = ODESSA_PLACES.find((place) => matchesLocalPlace(place, cleanQuery) || cleanQuery.toLowerCase().includes(place.name.toLowerCase()));
    if (knownPlace) {
      setAddressPoint(point, knownPlace.center, knownPlace.name);
      return;
    }

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${cleanQuery}, Одесса`)}.json?limit=1&language=${getMapLanguage()}&country=ua&bbox=30.55,46.32,30.85,46.58&proximity=${ODESSA_CENTER.join(",")}&access_token=${MAPBOX_TOKEN}`,
    );
    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature) return;

    setAddressPoint(point, feature.center, formatMapboxPlace(feature));
  } catch {
    // Keep the typed address if geocoding is temporarily unavailable.
  }
}

function hideAddressSuggestions(point) {
  const list = document.querySelector(`[data-suggestions="${point}"]`);
  if (list) {
    list.innerHTML = "";
    list.classList.remove("is-open");
  }
}

async function showAddressSuggestions(point, query) {
  const list = document.querySelector(`[data-suggestions="${point}"]`);
  const cleanQuery = query.trim();

  if (!list || cleanQuery.length < 2) {
    hideAddressSuggestions(point);
    return;
  }

  const known = ODESSA_PLACES.filter((place) => matchesLocalPlace(place, cleanQuery)).map((place) => ({
    label: place.name,
    subtitle: place.subtitle || "Одесса",
    center: place.center,
  }));

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${cleanQuery}, Одесса`)}.json?limit=5&language=${getMapLanguage()}&country=ua&bbox=30.55,46.32,30.85,46.58&proximity=${ODESSA_CENTER.join(",")}&access_token=${MAPBOX_TOKEN}`,
    );
    const data = await response.json();
    const remote = (data.features || []).map((feature) => ({
      label: formatMapboxPlace(feature),
      subtitle: formatSuggestionSubtitle(feature),
      center: feature.center,
    }));

    const suggestions = [...known, ...remote]
      .filter((item, index, items) => item.label && items.findIndex((candidate) => candidate.label === item.label) === index)
      .slice(0, 6);

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
  } catch {
    list.innerHTML = known
      .map(
        (item) => `
          <button type="button" data-center="${item.center.join(",")}" data-label="${item.label}">
            <strong>${item.label}</strong>
            <span>${item.subtitle || "Одесса"}</span>
          </button>
        `,
      )
      .join("");
    list.classList.toggle("is-open", known.length > 0);
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
  $("#newAddressName")?.focus();
}

function saveNewAddressFromForm() {
  const title = $("#newAddressName")?.value.trim();
  const address = $("#newAddressValue")?.value.trim();
  if (!title || !address) return;
  state.savedAddresses.push({ icon: "custom", title, address });
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

function leaveAccount(kind) {
  playScreenTransition(() => {
    clearPendingAuth();
    state.driverMode = false;
    $("#taxiScreen").classList.add("is-hidden");
    $("#authScreen").classList.remove("is-hidden");
    setAuthStep("start");
    const box = $("#sectionActionBox");
    if (box) box.innerHTML = "";
    $("#authTitle").textContent = kind === "delete" ? "Аккаунт удален" : "Вы вышли из аккаунта";
    $("#authSubtitle").textContent = "Можно войти снова по телефону, email, Google или Apple.";
  });
}

function showSection(section) {
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
}

function renderSection(section, source = sections) {
  const content = source[section].html;
  return typeof content === "function" ? content() : content;
}

function showDriverMode() {
  state.driverMode = true;
  updateMenuForRole();
  showDriverContent("feed");
}

function showPassengerMode() {
  state.driverMode = false;
  updateMenuForRole();
  showSection("ride");
}

function showDriverContent(tabName) {
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
}

async function showDriverOrderDetails(orderId) {
  const order = DRIVER_ORDERS[orderId];
  if (!order) return;

  mapPoints.a = order.a;
  mapPoints.b = order.b;
  $("#fromInput").value = order.from;
  $("#toInput").value = order.to;
  pickupMarker?.setLngLat(order.a);
  destinationMarker?.setLngLat(order.b);

  $(".content-grid").classList.remove("section-mode");
  $(".map-panel").classList.remove("is-hidden");
  $("#ridePanel").classList.add("is-hidden");
  $("#infoPanel").classList.add("is-hidden");
  $("#driverPanel").classList.remove("is-hidden");
  window.setTimeout(() => {
    initMapboxMap();
    novaMap?.resize();
    updateRouteLine();
  }, 80);

  const preview = $("#driverRoutePreview");
  if (preview) {
    preview.innerHTML = `
      <strong>${order.title}</strong>
      <span>${order.details}</span>
      <em id="driverDistanceLabel">Маршрут строится...</em>
    `;
  }

  window.setTimeout(() => {
    const label = $("#driverDistanceLabel");
    if (label) {
      label.textContent = `${state.tripDistanceKm.toFixed(1)} км · ориентир ${state.selectedPrice} грн`;
    }
  }, 1200);
}

function setDriverTab(tabName) {
  showDriverContent(tabName);
}

function updateMenuForRole() {
  const rideItem = $('.menu-item[data-section="ride"]');
  const historyItem = $('.menu-item[data-section="history"]');
  const addressesItem = $('.menu-item[data-section="addresses"]');

  rideItem.textContent = state.driverMode ? "Лента" : "Поездка";
  historyItem.textContent = state.driverMode ? "Заказы" : "История заказов";
  addressesItem.classList.toggle("is-hidden", state.driverMode);
  $("#driverModeBtn").textContent = state.driverMode ? "Стать пассажиром" : "Стать водителем";
  $(".profile-card span").textContent = state.driverMode ? "Рейтинг водителя 4.86" : `Рейтинг ${state.currentUser?.rating || 4.92}`;
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
    privacy: `<div class="text-panel"><strong>Политика NovaRide</strong><p>Мы храним только данные, нужные для поездки: профиль, маршрут, историю заказов и обращения в поддержку. Данные водителя и клиента используются для безопасности, качества сервиса и связи во время поездки.</p></div>`,
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
  marker.innerHTML = "<span></span>";
  return marker;
}

function createDriverMarker() {
  const marker = document.createElement("div");
  marker.className = "driver-map-marker";
  marker.style.pointerEvents = "none";
  marker.innerHTML = "<span></span>";
  return marker;
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

    const route = [mapPoints.a, [30.7413, 46.4738], [30.7516, 46.4544], mapPoints.b];

    pickupMarker = new mapboxgl.Marker({ element: createMapMarker("A", "pickup"), draggable: true }).setLngLat(mapPoints.a).addTo(novaMap);
    destinationMarker = new mapboxgl.Marker({ element: createMapMarker("B", "destination"), draggable: true })
      .setLngLat(mapPoints.b)
      .addTo(novaMap);

    pickupMarker.on("dragend", () => {
      mapPoints.a = pickupMarker.getLngLat().toArray();
      reverseGeocodePoint("a", mapPoints.a);
      updateRouteLine();
    });

    destinationMarker.on("dragend", () => {
      mapPoints.b = destinationMarker.getLngLat().toArray();
      reverseGeocodePoint("b", mapPoints.b);
      updateRouteLine();
    });

    [
      [30.7206, 46.492],
      [30.739, 46.477],
      [30.755, 46.463],
      [30.711, 46.469],
    ].forEach((point) => {
      new mapboxgl.Marker({ element: createDriverMarker() }).setLngLat(point).addTo(novaMap);
    });

    novaMap.on("load", () => {
      $("#mapCanvas").classList.add("has-real-map");
      $("#mapCanvas").classList.remove("loading-real-map");
      localizeMapLabels();
      installRouteLayer();

      updateRouteLine();
    });

    novaMap.on("click", (event) => {
      const coords = event.lngLat;
      if (activeMapPoint === "a") {
        mapPoints.a = coords.toArray();
        pickupMarker?.setLngLat(mapPoints.a);
        reverseGeocodePoint("a", mapPoints.a);
        activeMapPoint = "b";
      } else {
        mapPoints.b = coords.toArray();
        destinationMarker?.setLngLat(mapPoints.b);
        reverseGeocodePoint("b", mapPoints.b);
        activeMapPoint = "a";
      }
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
    const detailButton = event.target.closest(".order-detail");
    if (detailButton) {
      showDriverOrderDetails(detailButton.dataset.order);
    }
  });
  $("#infoPanel").addEventListener("click", (event) => {
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

    if (event.target.closest("#addAddressBtn")) {
      addAddressFromSection();
    }

    if (event.target.closest("#saveNewAddressBtn")) {
      saveNewAddressFromForm();
    }

    const addressTarget = event.target.closest(".use-address");
    if (addressTarget) {
      const card = addressTarget.closest("[data-address]");
      $("#toInput").value = card.dataset.address;
      showSection("ride");
    }
  });
  $("#themeQuickBtn").addEventListener("click", () => applyTheme(document.body.classList.contains("dark") ? "light" : "dark"));
  $("#orderBtn").addEventListener("click", () => {
    $("#orderBtn").textContent = "Ищем водителя...";
    setTimeout(() => {
      $("#orderBtn").textContent = "Водитель найден: 4 мин";
    }, 800);
  });
}

bindEvents();
setAuthStep("start");
loadAuthConfig();
restorePendingAuth();

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
