// @ts-nocheck -- Chrome extension APIs are provided by the browser runtime.
const host = document.createElement("div");
host.id = "talanty-olx-connector";
const shadow = host.attachShadow({ mode: "closed" });

const style = document.createElement("style");
style.textContent = `
  :host { all: initial; }
  .panel {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    width: min(360px, calc(100vw - 40px));
    box-sizing: border-box;
    border: 1px solid #d8d8d8;
    border-radius: 12px;
    background: #ffffff;
    color: #1f2d2d;
    padding: 16px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
    font: 14px/1.45 Arial, sans-serif;
  }
  h2 { margin: 0 0 8px; font-size: 17px; line-height: 1.3; }
  p { margin: 0 0 12px; color: #52605f; }
  button {
    width: 100%;
    min-height: 42px;
    border: 0;
    border-radius: 8px;
    background: #002f34;
    color: #ffffff;
    padding: 10px 14px;
    cursor: pointer;
    font: 700 14px/1.2 Arial, sans-serif;
  }
  button:disabled { cursor: wait; opacity: 0.65; }
  .status { margin-top: 10px; margin-bottom: 0; font-size: 13px; }
  .error { color: #b42318; }
  .success { color: #087443; }
`;

const panel = document.createElement("section");
panel.className = "panel";
panel.setAttribute("aria-label", "Подключение olx.uz к Talanty");
panel.innerHTML = `
  <h2>Подключение к Talanty</h2>
  <p>Войдите в olx.uz и завершите CAPTCHA или SMS-проверку, если она появится. Затем нажмите кнопку один раз.</p>
  <button type="button">Я вошёл — подключить аккаунт</button>
  <p class="status" aria-live="polite"></p>
`;
shadow.append(style, panel);

const button = panel.querySelector("button");
const status = panel.querySelector(".status");

button.addEventListener("click", () => {
  button.disabled = true;
  status.className = "status";
  status.textContent = "Проверяем вход и безопасно подключаем аккаунт…";
  chrome.runtime.sendMessage(
    { type: "PERSONA_OLX_COMPLETE_CONNECTION" },
    (response) => {
      if (response?.ok) {
        status.className = "status success";
        status.textContent = "Аккаунт подключён. Можно вернуться в Talanty.";
        button.textContent = "Аккаунт подключён";
        return;
      }
      status.className = "status error";
      status.textContent =
        response?.error || "Не удалось подключить аккаунт. Попробуйте позже.";
      button.disabled = false;
    },
  );
});

chrome.runtime.sendMessage({ type: "PERSONA_OLX_GET_STATUS" }, (response) => {
  if (response?.pending) document.documentElement.append(host);
});
