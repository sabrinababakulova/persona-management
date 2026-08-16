// @ts-nocheck -- Chrome extension APIs are provided by the browser runtime.
chrome.runtime.sendMessage({ type: "PERSONA_OLX_GET_STATUS" }, (response) => {
  const status = document.getElementById("status");
  status.textContent = response?.pending
    ? "Подключение запущено. Завершите вход на открытой вкладке olx.uz."
    : "Готово. Откройте настройки компании в Talanty и нажмите «Подключить olx.uz».";
});
