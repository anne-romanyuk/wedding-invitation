const invitationId = new URLSearchParams(location.search).get("id");
const responseList = document.getElementById("responseList");
const toast = document.getElementById("toast");
let invitation = null;
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function answerText(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => {
    if (item === "yes") return "Да, с удовольствием!";
    if (item === "no") return "К сожалению, не сможет";
    return String(item || "—");
  }).join(", ");
}

function guestName(response, index) {
  return String(response.answers.fio || response.answers.name || `Гость ${index + 1}`);
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

function renderResponses(responses) {
  responseList.replaceChildren();
  const accepted = responses.filter((item) => item.answers.attend === "yes").length;
  const declined = responses.filter((item) => item.answers.attend === "no").length;
  document.getElementById("totalResponses").textContent = String(responses.length);
  document.getElementById("yesResponses").textContent = String(accepted);
  document.getElementById("noResponses").textContent = String(declined);
  document.getElementById("responseListHint").textContent = responses.length ? pluralize(responses.length, ["ответ", "ответа", "ответов"]) : "Пока пусто";

  if (!responses.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>Ответов пока нет</strong><span>Когда гости заполнят анкету по этой ссылке, ответы появятся здесь.</span>";
    responseList.appendChild(empty);
    return;
  }

  responses.forEach((response, index) => {
    const card = document.createElement("article");
    card.className = "response-card";
    const header = document.createElement("div");
    header.className = "response-card-header";
    const name = document.createElement("h3");
    name.textContent = guestName(response, index);
    const time = document.createElement("time");
    time.dateTime = response.createdAt;
    time.textContent = formatDate(response.createdAt);
    header.append(name, time);

    const answers = document.createElement("dl");
    answers.className = "answer-grid";
    Object.entries(response.answers).forEach(([key, value]) => {
      const item = document.createElement("div");
      item.className = "answer-item";
      const label = document.createElement("dt");
      label.textContent = response.labels?.[key] || key;
      const answer = document.createElement("dd");
      answer.textContent = answerText(value);
      item.append(label, answer);
      answers.appendChild(item);
    });
    card.append(header, answers);
    responseList.appendChild(card);
  });
}

async function loadResponses() {
  if (!invitationId) {
    responseList.innerHTML = "<div class=\"empty-state\"><strong>Версия не выбрана</strong><span>Вернитесь в личный кабинет и откройте нужное приглашение.</span></div>";
    return;
  }
  try {
    const response = await fetch(`/api/admin/invitations/${encodeURIComponent(invitationId)}/responses`);
    if (response.status === 401) {
      location.replace(`/login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить ответы");
    invitation = result.invitation;
    document.title = `Ответы — ${invitation.title}`;
    document.getElementById("invitationTitle").textContent = invitation.title;
    document.getElementById("invitationMeta").textContent = `Опубликовано ${formatDate(invitation.createdAt)} · ${invitation.url}`;
    document.getElementById("openInvitation").href = invitation.url;
    document.getElementById("invitationActions").hidden = false;
    renderResponses(result.responses);
  } catch (error) {
    document.getElementById("invitationTitle").textContent = "Не удалось открыть версию";
    document.getElementById("invitationMeta").textContent = error.message;
    responseList.innerHTML = "<div class=\"empty-state\"><strong>Данные недоступны</strong><span>Попробуйте вернуться в личный кабинет и открыть версию ещё раз.</span></div>";
  }
}

document.getElementById("copyLink").addEventListener("click", async () => {
  if (!invitation) return;
  try {
    await navigator.clipboard.writeText(invitation.url);
    showToast("Ссылка скопирована");
  } catch {
    showToast("Не удалось скопировать ссылку");
  }
});

loadResponses();
