const versionList = document.getElementById("versionList");
const versionListHint = document.getElementById("versionListHint");
const toast = document.getElementById("toast");
let toastTimer;
let invitations = [];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatDate(value, withTime = true) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(new Date(value));
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function responsesUrl(invitation) {
  return `responses.html?id=${encodeURIComponent(invitation.id)}`;
}

function pluralize(number, forms) {
  const mod100 = number % 100;
  const mod10 = number % 10;
  const form = mod100 >= 11 && mod100 <= 14
    ? forms[2]
    : mod10 === 1
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4
        ? forms[1]
        : forms[2];
  return `${number} ${form}`;
}

function makeButton(label, className, action, invitation) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button button-small ${className}`;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = invitation.id;
  return button;
}

function renderInvitations() {
  versionList.replaceChildren();
  document.getElementById("versionCount").textContent = String(invitations.length);
  document.getElementById("responseCount").textContent = String(invitations.reduce((sum, item) => sum + item.responseCount, 0));
  document.getElementById("lastPublished").textContent = invitations.length ? formatDate(invitations[0].createdAt, false) : "—";
  versionListHint.textContent = invitations.length ? pluralize(invitations.length, ["версия", "версии", "версий"]) : "Пока пусто";

  if (!invitations.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>Опубликованных версий пока нет</strong><span>Откройте конструктор, настройте приглашение и нажмите «Создать версию».</span>";
    versionList.appendChild(empty);
    return;
  }

  invitations.forEach((invitation) => {
    const card = document.createElement("article");
    card.className = "version-card";
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `Открыть ответы: ${invitation.title}`);
    card.dataset.responsesUrl = responsesUrl(invitation);

    const main = document.createElement("div");
    main.className = "version-main";
    const titleRow = document.createElement("div");
    titleRow.className = "version-title-row";
    const title = document.createElement("h3");
    title.textContent = invitation.title;
    const badge = document.createElement("span");
    badge.className = "response-badge";
    badge.textContent = pluralize(invitation.responseCount, ["ответ", "ответа", "ответов"]);
    titleRow.append(title, badge);
    const meta = document.createElement("p");
    meta.className = "version-meta";
    meta.textContent = `Опубликовано ${formatDate(invitation.createdAt)}`;
    const url = document.createElement("p");
    url.className = "version-url";
    url.textContent = invitation.url;
    main.append(titleRow, meta, url);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      makeButton("Ответы", "button-soft", "responses", invitation),
      makeButton("Копировать", "button-ghost", "copy", invitation),
      makeButton("Удалить", "button-danger", "delete", invitation)
    );
    const open = document.createElement("a");
    open.className = "button button-small button-ghost";
    open.href = invitation.url;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Открыть";
    actions.insertBefore(open, actions.children[2]);
    card.append(main, actions);
    versionList.appendChild(card);
  });
}

async function loadInvitations() {
  try {
    const response = await fetch("/api/admin/invitations");
    if (response.status === 401) {
      location.replace(`/login.html?returnTo=${encodeURIComponent("/dashboard.html")}`);
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить версии");
    invitations = result.invitations;
    renderInvitations();
  } catch (error) {
    versionList.innerHTML = `<div class="empty-state"><strong>Не удалось загрузить версии</strong><span>${error.message}</span></div>`;
    versionListHint.textContent = "Ошибка";
  }
}

versionList.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) {
    const card = event.target.closest(".version-card");
    if (card && !event.target.closest("a, button")) location.href = card.dataset.responsesUrl;
    return;
  }

  const invitation = invitations.find((item) => item.id === actionButton.dataset.id);
  if (!invitation) return;
  const action = actionButton.dataset.action;
  if (action === "responses") {
    location.href = responsesUrl(invitation);
    return;
  }
  if (action === "copy") {
    try {
      await copyText(invitation.url);
      showToast("Ссылка скопирована");
    } catch {
      showToast("Не удалось скопировать ссылку");
    }
    return;
  }
  if (action === "delete") {
    if (!confirm(`Удалить версию «${invitation.title}» и все ответы гостей?`)) return;
    actionButton.disabled = true;
    const response = await fetch(`/api/admin/invitations/${invitation.id}`, { method: "DELETE" });
    if (!response.ok) {
      actionButton.disabled = false;
      showToast("Не удалось удалить версию");
      return;
    }
    invitations = invitations.filter((item) => item.id !== invitation.id);
    renderInvitations();
    showToast("Версия и её ответы удалены");
  }
});

versionList.addEventListener("keydown", (event) => {
  const card = event.target.closest(".version-card");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    location.href = card.dataset.responsesUrl;
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  location.replace("/login.html");
});

loadInvitations();
