const STORAGE_KEY = "wedding-editor-snapshot-v1";
const DEFAULT_TEMPLATE_URL = "default-template.html?editorPreview=1";
const frame = document.getElementById("previewFrame");
const selectedName = document.getElementById("selectedName");
const saveStatus = document.getElementById("saveStatus");
const toast = document.getElementById("toast");
const versionTitle = document.getElementById("versionTitle");
const publishDialog = document.getElementById("publishDialog");
const publishedUrl = document.getElementById("publishedUrl");
const openPublishedUrl = document.getElementById("openPublishedUrl");
const questionList = document.getElementById("questionList");
const selectionGroups = [...document.querySelectorAll("[data-selection-controls]")];
const brushControlGroup = document.querySelector("[data-brush-controls]");
const brushBlur = document.getElementById("brushBlur");
const brushBlurOutput = document.getElementById("brushBlurOutput");
const replaceVenuePhoto = document.getElementById("replaceVenuePhoto");
const replaceVenuePhotoLabel = document.getElementById("replaceVenuePhotoLabel");
const deleteVenuePhotoButton = document.getElementById("deleteVenuePhoto");
const venuePhotoStatus = document.getElementById("venuePhotoStatus");
const locationUrl = document.getElementById("locationUrl");
const locationButtonText = document.getElementById("locationButtonText");
const locationStatus = document.getElementById("locationStatus");
const deleteLocationButton = document.getElementById("deleteLocation");
const musicStatus = document.getElementById("musicStatus");
const deleteMusicButton = document.getElementById("deleteMusic");
const MUSIC_DB_NAME = "wedding-editor-media";
const MUSIC_DB_STORE = "files";
const MUSIC_STORAGE_KEY = "wedding-music";

const controls = {
  text: document.getElementById("textValue"),
  fontSize: document.getElementById("fontSize"),
  fontSizeOutput: document.getElementById("fontSizeOutput"),
  fontFamily: document.getElementById("fontFamily"),
  color: document.getElementById("textColor"),
  align: document.getElementById("textAlign"),
  width: document.getElementById("elementWidth"),
  widthOutput: document.getElementById("elementWidthOutput"),
  opacity: document.getElementById("elementOpacity"),
  opacityOutput: document.getElementById("elementOpacityOutput"),
  x: document.getElementById("moveX"),
  y: document.getElementById("moveY"),
  rotation: document.getElementById("rotation"),
  zIndex: document.getElementById("zIndex")
};

const FONT_FAMILIES = {
  cormorant: '"Cormorant", Georgia, serif',
  marck: '"Marck Script", cursive',
  adine: '"Adine Kirnberg", "Great Vibes", "Marck Script", cursive',
  "great-vibes": '"Great Vibes", "Marck Script", cursive',
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  arial: 'Arial, Helvetica, sans-serif'
};

const selectableSelector = [
  ".site",
  "section",
  "h1",
  "h2",
  ".hero-date",
  ".music",
  ".scroll-arrow",
  ".greeting p",
  ".program-card",
  ".tl-time",
  ".tl-label",
  ".tl-arrow",
  ".venue p",
  ".photos",
  ".ph",
  ".venue-photo",
  ".map-btn",
  ".couple-note-card",
  ".couple-note p",
  ".field",
  ".field > label:not(.opt)",
  ".field legend",
  ".option-text",
  ".submit",
  "footer",
  ".deco",
  ".hero-brush",
  ".editor-added-text"
].join(",");

const textSelector = [
  "h1",
  "h2",
  ".hero-date",
  ".greeting p",
  ".tl-time",
  ".tl-label",
  ".venue p",
  ".map-btn",
  ".couple-note p",
  ".field > label:not(.opt)",
  ".field legend",
  ".option-text",
  ".submit",
  "footer",
  ".editor-added-text"
].join(",");

let previewDocument = null;
let selectedElement = null;
let nextEditorId = 1;
let toastTimer = null;
let dragState = null;
let musicObjectUrl = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function markDirty() {
  saveStatus.textContent = "Есть несохранённые изменения";
  saveStatus.classList.add("is-dirty");
}

function markSaved() {
  saveStatus.textContent = "Все изменения сохранены";
  saveStatus.classList.remove("is-dirty");
}

function registerElement(element) {
  if (!element.dataset.editorId) {
    element.dataset.editorId = `element-${nextEditorId++}`;
  }
  return element;
}

function registerAllElements() {
  previewDocument.querySelectorAll(selectableSelector).forEach(registerElement);
}

function ensureInvitationStructure(root = previewDocument) {
  const documentRoot = root.ownerDocument || root;
  let changed = false;
  const form = root.querySelector("#guestForm");

  form?.querySelectorAll("fieldset.field").forEach((field) => {
    const legend = field.querySelector("legend")?.textContent?.toLowerCase() || "";
    if (field.querySelector('input[name="drink"]') || legend.includes("алкогол")) {
      field.remove();
      changed = true;
    }
  });

  if (form && !form.querySelector('#companions, input[name="companions"]')) {
    const field = documentRoot.createElement("div");
    field.className = "field reveal in";
    field.dataset.questionKey = "companions";

    const label = documentRoot.createElement("label");
    label.htmlFor = "companions";
    label.textContent = "Гости, которые придут с вами";

    const input = documentRoot.createElement("input");
    input.type = "text";
    input.id = "companions";
    input.name = "companions";
    input.placeholder = "Имена гостей";
    field.append(label, input);

    const attendance = form.querySelector('input[name="attend"]')?.closest("fieldset.field");
    if (attendance) attendance.after(field);
    else form.insertBefore(field, form.querySelector(".submit"));
    changed = true;
  }

  if (!root.querySelector(".couple-note")) {
    const note = documentRoot.createElement("section");
    note.className = "couple-note";
    note.setAttribute("aria-label", "Сообщение от молодожёнов");
    note.innerHTML = `
      <img class="deco couple-note-left in" src="assets/small-leaves.png" alt="">
      <img class="deco couple-note-right in" src="assets/small-flowers.png" alt="">
      <div class="couple-note-card reveal in">
        <p>Если захотите нас порадовать, вместо цветов мы будем очень рады вашему любимому напитку — он займёт почётное место на нашем столе и сделает праздник ещё уютнее.</p>
      </div>
    `;
    root.querySelector("section.form")?.after(note);
    changed = true;
  }

  const programDelays = [".3s", "1.05s", "1.85s", "2.65s", "3.45s", "4.25s"];
  root.querySelectorAll(".program-step").forEach((step, index) => {
    const delay = programDelays[index];
    if (delay && step.style.getPropertyValue("--step-delay") !== delay) {
      step.style.setProperty("--step-delay", delay);
      changed = true;
    }
  });

  return changed;
}

function normalizeAddedVisuals(root = previewDocument) {
  root.querySelectorAll(".editor-added-decor").forEach((element) => {
    const inlineOpacity = element.style.opacity;
    if (inlineOpacity) {
      element.style.setProperty("--deco-opacity", inlineOpacity);
      element.style.removeProperty("opacity");
    }
    if (element.style.transform === "none") element.style.removeProperty("transform");
    element.classList.add("deco");
  });

  root.querySelectorAll(".reveal").forEach((element) => {
    const inlineOpacity = element.style.opacity;
    if (inlineOpacity) {
      element.style.setProperty("--reveal-opacity", inlineOpacity);
      element.style.removeProperty("opacity");
    }
  });

  root.querySelectorAll(".hero-brush").forEach((element) => {
    const inlineOpacity = element.style.opacity;
    if (inlineOpacity) {
      element.style.setProperty("--brush-opacity", inlineOpacity);
      element.style.removeProperty("opacity");
    }
  });

  root.querySelectorAll(".venue-photo").forEach((element) => element.classList.add("reveal"));
}

function ensurePreviewMediaElements() {
  const existingAudio = previewDocument.getElementById("weddingAudio");
  if (existingAudio) {
    existingAudio.controls = true;
    existingAudio.autoplay = true;
    return;
  }
  const musicButton = previewDocument.getElementById("music");
  if (!musicButton) return;
  const audio = previewDocument.createElement("audio");
  audio.id = "weddingAudio";
  audio.preload = "metadata";
  audio.controls = true;
  audio.autoplay = true;
  musicButton.after(audio);
}

function injectEditorRuntime() {
  previewDocument.getElementById("wedding-editor-runtime")?.remove();

  const style = previewDocument.createElement("style");
  style.id = "wedding-editor-runtime";
  style.textContent = `
    body.wedding-editor-active [data-editor-id] {
      cursor: pointer !important;
    }
    body.wedding-editor-active [data-editor-id]:hover {
      outline: 1px dashed rgba(75, 94, 78, .72) !important;
      outline-offset: 3px !important;
    }
    body.wedding-editor-active .editor-selected {
      outline: 2px solid rgba(75, 94, 78, .92) !important;
      outline-offset: 4px !important;
      box-shadow: 0 0 0 6px rgba(247, 245, 238, .48) !important;
    }
    body.wedding-editor-active .deco,
    body.wedding-editor-active .hero-brush {
      pointer-events: auto !important;
    }
    body.wedding-editor-active .editor-added-decor,
    body.wedding-editor-active .venue-photo,
    body.wedding-editor-active .editor-added-text {
      touch-action: none;
    }
  `;
  previewDocument.head.appendChild(style);
  previewDocument.body.classList.add("wedding-editor-active");
}

function isTextElement(element) {
  return Boolean(element?.matches(textSelector));
}

function describeElement(element) {
  if (!element) return "Ничего не выбрано";

  if (element.matches(".hero-brush")) return "Изображение мазка";
  if (element.matches(".venue-photo")) return "Фотография места";

  if (element.matches("img")) {
    const file = element.getAttribute("src")?.split("/").pop() || "изображение";
    return `Изображение · ${file}`;
  }

  if (element.matches("fieldset.field")) return "Вопрос анкеты";
  if (element.matches(".field")) return "Поле анкеты";
  if (element.matches("section")) return `Блок · ${element.className || "секция"}`;
  if (element.matches(".program-card")) return "Карточка программы";
  if (element.matches(".photos")) return "Блок фотографий";
  if (element.matches(".music")) return "Музыкальная кнопка";

  const text = element.innerText?.replace(/\s+/g, " ").trim();
  return text ? `Текст · ${text.slice(0, 48)}` : element.tagName.toLowerCase();
}

function rgbToHex(value, fallback = "#70766d") {
  const match = value?.match(/[\d.]+/g);
  if (!match || match.length < 3) return fallback;
  return `#${match.slice(0, 3).map((part) => Math.round(Number(part)).toString(16).padStart(2, "0")).join("")}`;
}

function fontKeyFromComputed(value) {
  const normalized = value.toLowerCase();
  if (normalized.includes("adine kirnberg")) return "adine";
  if (normalized.includes("great vibes")) return "great-vibes";
  if (normalized.includes("marck script")) return "marck";
  if (normalized.includes("arial") || normalized.includes("helvetica")) return "arial";
  if (normalized.includes("times new roman")) return "times";
  if (normalized.includes("georgia")) return "georgia";
  return "cormorant";
}

function numberFromDataset(element, key, fallback = 0) {
  const value = Number(element?.dataset[key]);
  return Number.isFinite(value) ? value : fallback;
}

function percentWidth(element) {
  const parentWidth = element.parentElement?.getBoundingClientRect().width || 390;
  return Math.max(10, Math.min(150, Math.round((element.getBoundingClientRect().width / parentWidth) * 100)));
}

function blurFromFilter(filter) {
  const match = filter?.match(/blur\(([\d.]+)px\)/);
  return match ? Number(match[1]) : 0;
}

function syncBrushControls(element) {
  const isBrush = Boolean(element?.matches(".hero-brush"));
  brushControlGroup.classList.toggle("is-disabled", !isBrush);
  brushControlGroup.querySelectorAll("input, button").forEach((control) => {
    control.disabled = !isBrush;
  });

  if (!isBrush) {
    brushBlur.value = 3.5;
    brushBlurOutput.value = "—";
    return;
  }

  const filter = previewDocument.defaultView.getComputedStyle(element).filter;
  brushBlur.value = Math.max(0, Math.min(20, blurFromFilter(filter)));
  brushBlurOutput.value = `${brushBlur.value}px`;
}

function syncVenuePhotoControls(element) {
  const isVenuePhoto = Boolean(element?.matches(".venue-photo"));
  replaceVenuePhoto.disabled = !isVenuePhoto;
  deleteVenuePhotoButton.disabled = !isVenuePhoto;
  replaceVenuePhotoLabel.classList.toggle("is-disabled", !isVenuePhoto);
}

function updateVenuePhotoStatus() {
  const count = previewDocument?.querySelectorAll(".venue-photo").length || 0;
  venuePhotoStatus.textContent = count
    ? `Добавлено фотографий: ${count}`
    : "Фотографии пока не добавлены";
}

function currentLocationButton() {
  return previewDocument?.querySelector(".venue .map-btn") || null;
}

function syncLocationFields() {
  const link = currentLocationButton();
  const href = link?.getAttribute("href") || "";
  locationUrl.value = href;
  locationButtonText.value = link?.innerText?.replace(/\s+/g, " ").trim() || "ПОСМОТРЕТЬ НА КАРТЕ";
  locationUrl.removeAttribute("aria-invalid");
  deleteLocationButton.disabled = !link;
  locationStatus.textContent = href
    ? "Ссылка добавлена и будет работать в готовом приглашении"
    : "Кнопка геолокации пока не добавлена";
}

function normalizeLocationUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Вставьте ссылку на геолокацию");
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (!["http:", "https:", "geo:"].includes(parsed.protocol)) {
    throw new Error("Используйте ссылку Google Maps, Яндекс Карт или 2ГИС");
  }
  return parsed.href;
}

function ensureLocationButton() {
  const existing = currentLocationButton();
  if (existing) return { link: existing, created: false };

  const venue = previewDocument.querySelector(".venue");
  if (!venue) return { link: null, created: false };
  const link = previewDocument.createElement("a");
  link.className = "map-btn reveal";
  link.textContent = "ПОСМОТРЕТЬ НА КАРТЕ";
  const photos = venue.querySelector(".photos");
  photos?.after(link);
  if (!link.isConnected) venue.appendChild(link);
  registerElement(link);
  return { link, created: true };
}

function applyLocationLink() {
  let href;
  try {
    href = normalizeLocationUrl(locationUrl.value);
  } catch (error) {
    locationUrl.setAttribute("aria-invalid", "true");
    locationStatus.textContent = error.message;
    locationUrl.focus();
    return;
  }

  const { link, created } = ensureLocationButton();
  if (!link) {
    showToast("Блок места проведения не найден");
    return;
  }

  link.href = href;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = locationButtonText.value.trim() || "ПОСМОТРЕТЬ НА КАРТЕ";
  if (created) revealNewElement(link);
  setSelection(link);
  syncLocationFields();
  markDirty();
  showToast("Ссылка на геолокацию добавлена");
}

function deleteLocationLink() {
  const link = currentLocationButton();
  if (!link) return;
  link.remove();
  setSelection(previewDocument.querySelector(".venue"));
  syncLocationFields();
  markDirty();
  showToast("Кнопка геолокации удалена");
}

function setSelection(element) {
  selectedElement?.classList.remove("editor-selected");
  selectedElement = element || null;
  selectedElement?.classList.add("editor-selected");
  selectedName.textContent = describeElement(selectedElement);
  syncBrushControls(selectedElement);
  syncVenuePhotoControls(selectedElement);

  const disabled = !selectedElement;
  selectionGroups.forEach((group) => group.classList.toggle("is-disabled", disabled));
  selectionGroups.forEach((group) => {
    group.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = disabled;
    });
  });

  if (!selectedElement) {
    controls.text.value = "";
    controls.text.disabled = true;
    return;
  }

  const computed = previewDocument.defaultView.getComputedStyle(selectedElement);
  const canEditText = isTextElement(selectedElement);
  controls.text.disabled = !canEditText;
  controls.fontFamily.disabled = !canEditText;
  controls.text.value = canEditText ? selectedElement.innerText : "";
  controls.fontSize.value = Math.max(10, Math.min(84, Math.round(parseFloat(computed.fontSize) || 16)));
  controls.fontSizeOutput.value = `${controls.fontSize.value}px`;
  controls.fontFamily.value = fontKeyFromComputed(computed.fontFamily);
  controls.color.value = rgbToHex(computed.color);
  controls.align.value = ["left", "center", "right"].includes(computed.textAlign) ? computed.textAlign : "left";
  controls.width.value = percentWidth(selectedElement);
  controls.widthOutput.value = `${controls.width.value}%`;
  controls.opacity.value = Number.parseFloat(computed.opacity) || 1;
  controls.opacityOutput.value = `${Math.round(Number(controls.opacity.value) * 100)}%`;
  controls.x.value = numberFromDataset(selectedElement, "editorX");
  controls.y.value = numberFromDataset(selectedElement, "editorY");
  controls.rotation.value = numberFromDataset(selectedElement, "editorRotation");
  controls.zIndex.value = computed.zIndex === "auto" ? 4 : Number.parseInt(computed.zIndex, 10) || 0;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setElementText(element, value) {
  element.innerHTML = value.split("\n").map(escapeHtml).join("<br>");

  if (element.matches(".option-text")) {
    const input = element.closest(".opt")?.querySelector("input");
    if (input) input.value = value;
  }
}

function applyMovement() {
  if (!selectedElement) return;
  const x = Number(controls.x.value) || 0;
  const y = Number(controls.y.value) || 0;
  selectedElement.dataset.editorX = String(x);
  selectedElement.dataset.editorY = String(y);
  selectedElement.style.translate = `${x}px ${y}px`;
  markDirty();
}

function setupControlEvents() {
  controls.text.addEventListener("input", () => {
    if (!selectedElement || !isTextElement(selectedElement)) return;
    setElementText(selectedElement, controls.text.value);
    markDirty();
    updateQuestionList();
    if (selectedElement.matches(".map-btn")) syncLocationFields();
  });

  controls.fontSize.addEventListener("input", () => {
    if (!selectedElement) return;
    selectedElement.style.fontSize = `${controls.fontSize.value}px`;
    controls.fontSizeOutput.value = `${controls.fontSize.value}px`;
    markDirty();
  });

  controls.fontFamily.addEventListener("change", () => {
    if (!selectedElement || !isTextElement(selectedElement)) return;
    selectedElement.style.fontFamily = FONT_FAMILIES[controls.fontFamily.value] || FONT_FAMILIES.cormorant;
    markDirty();
  });

  controls.color.addEventListener("input", () => {
    if (!selectedElement) return;
    selectedElement.style.color = controls.color.value;
    markDirty();
  });

  controls.align.addEventListener("change", () => {
    if (!selectedElement) return;
    selectedElement.style.textAlign = controls.align.value;
    markDirty();
  });

  controls.width.addEventListener("input", () => {
    if (!selectedElement) return;
    selectedElement.style.width = `${controls.width.value}%`;
    selectedElement.style.maxWidth = "none";
    controls.widthOutput.value = `${controls.width.value}%`;
    markDirty();
  });

  controls.opacity.addEventListener("input", () => {
    if (!selectedElement) return;
    if (selectedElement.matches(".deco")) {
      selectedElement.style.setProperty("--deco-opacity", controls.opacity.value);
      selectedElement.style.removeProperty("opacity");
    } else if (selectedElement.matches(".reveal")) {
      selectedElement.style.setProperty("--reveal-opacity", controls.opacity.value);
      selectedElement.style.removeProperty("opacity");
    } else if (selectedElement.matches(".hero-brush")) {
      selectedElement.style.setProperty("--brush-opacity", controls.opacity.value);
      selectedElement.style.removeProperty("opacity");
    } else {
      selectedElement.style.opacity = controls.opacity.value;
    }
    controls.opacityOutput.value = `${Math.round(Number(controls.opacity.value) * 100)}%`;
    markDirty();
  });

  controls.x.addEventListener("input", applyMovement);
  controls.y.addEventListener("input", applyMovement);

  controls.rotation.addEventListener("input", () => {
    if (!selectedElement) return;
    const value = Number(controls.rotation.value) || 0;
    selectedElement.dataset.editorRotation = String(value);
    selectedElement.style.rotate = `${value}deg`;
    markDirty();
  });

  controls.zIndex.addEventListener("input", () => {
    if (!selectedElement) return;
    if (previewDocument.defaultView.getComputedStyle(selectedElement).position === "static") {
      selectedElement.style.position = "relative";
    }
    selectedElement.style.zIndex = controls.zIndex.value;
    markDirty();
  });
}

function selectionFromEvent(event) {
  const target = event.target.closest?.("[data-editor-id]");
  if (!target || !previewDocument.querySelector(".site")?.contains(target)) return null;
  return target;
}

function setupPreviewEvents() {
  previewDocument.addEventListener("click", (event) => {
    const target = selectionFromEvent(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    setSelection(target);
  }, true);

  previewDocument.addEventListener("pointerdown", (event) => {
    const target = selectionFromEvent(event);
    if (!target) return;

    setSelection(target);
    if (!target.matches(".deco, .hero-brush, .editor-added-text")) return;

    event.preventDefault();
    const parentRect = target.parentElement.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    dragState = {
      element: target,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left - parentRect.left,
      top: rect.top - parentRect.top
    };
  }, true);

  previewDocument.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    event.preventDefault();
    const left = dragState.left + event.clientX - dragState.startX;
    const top = dragState.top + event.clientY - dragState.startY;
    dragState.element.style.left = `${left}px`;
    dragState.element.style.top = `${top}px`;
    dragState.element.style.right = "auto";
    dragState.element.style.bottom = "auto";
  }, true);

  const finishDrag = () => {
    if (!dragState) return;
    markDirty();
    setSelection(dragState.element);
    dragState = null;
  };

  previewDocument.addEventListener("pointerup", finishDrag, true);
  previewDocument.addEventListener("pointercancel", finishDrag, true);
}

function targetSection() {
  const selectedSection = selectedElement?.closest("section");
  if (selectedSection) return selectedSection;
  const className = document.getElementById("targetSection").value;
  return previewDocument.querySelector(`section.${className}`);
}

function revealNewElement(element) {
  element.classList.remove("in");
  previewDocument.defaultView.requestAnimationFrame(() => {
    previewDocument.defaultView.requestAnimationFrame(() => element.classList.add("in"));
  });
}

function addTextElement() {
  const section = targetSection();
  if (!section) return;

  const text = previewDocument.createElement("p");
  text.className = "reveal in editor-added-text";
  text.textContent = "Новый текст";
  text.style.cssText = "position:absolute;left:15%;top:20%;width:70%;z-index:6;color:#70766d;font-size:22px;text-align:center;";
  section.appendChild(text);
  registerElement(text);
  setSelection(text);
  markDirty();
}

function addDecor(src) {
  const section = targetSection();
  if (!section) return;

  const image = previewDocument.createElement("img");
  image.className = "deco editor-added-decor";
  image.src = src;
  image.alt = "";
  image.style.cssText = "position:absolute;left:55%;top:12%;right:auto;bottom:auto;width:42%;max-width:none;--deco-opacity:.78;--move-x:20px;--move-y:18px;z-index:2;";
  section.appendChild(image);
  revealNewElement(image);
  registerElement(image);
  setSelection(image);
  markDirty();
}

function addBrush() {
  const group = previewDocument.querySelector(".hero-title-group");
  if (!group) {
    showToast("Блок с именами не найден");
    return null;
  }

  const image = previewDocument.createElement("img");
  image.className = "hero-brush editor-custom-brush";
  image.src = "assets/brush-stroke.png";
  image.alt = "";
  group.insertBefore(image, group.firstChild);
  registerElement(image);
  setSelection(image);
  markDirty();
  return image;
}

function uploadBrushImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 3 * 1024 * 1024) {
    showToast("Выберите изображение размером до 3 МБ");
    event.target.value = "";
    return;
  }

  const brush = selectedElement?.matches(".hero-brush") ? selectedElement : addBrush();
  if (!brush) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    brush.src = String(reader.result);
    setSelection(brush);
    markDirty();
    showToast("Изображение мазка заменено");
  });
  reader.readAsDataURL(file);
  event.target.value = "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Не удалось прочитать изображение")));
    image.src = dataUrl;
  });
}

async function optimizeVenuePhoto(file) {
  if (!file.type.startsWith("image/")) throw new Error("Выберите файл изображения");
  if (file.size > 15 * 1024 * 1024) throw new Error("Фотография должна быть меньше 15 МБ");

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#f2ead6";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .84);
}

function emptyVenuePhotoCard() {
  return [...previewDocument.querySelectorAll(".photos > .ph")]
    .find((card) => !card.querySelector(".venue-photo"));
}

function createVenuePhoto(dataUrl, fileName) {
  const container = previewDocument.querySelector(".venue .photos");
  if (!container) return null;

  const card = emptyVenuePhotoCard() || previewDocument.createElement("div");
  card.className = "ph venue-photo-card";
  card.replaceChildren();

  const image = previewDocument.createElement("img");
  image.className = "venue-photo reveal";
  image.src = dataUrl;
  image.alt = "Фотография места проведения";
  image.dataset.fileName = fileName;
  card.appendChild(image);

  if (!card.isConnected) container.appendChild(card);
  registerElement(card);
  registerElement(image);
  revealNewElement(image);
  return image;
}

async function addVenuePhotos(event) {
  const files = [...(event.target.files || [])];
  event.target.value = "";
  if (!files.length) return;

  let lastPhoto = null;
  let added = 0;
  for (const file of files) {
    try {
      const dataUrl = await optimizeVenuePhoto(file);
      lastPhoto = createVenuePhoto(dataUrl, file.name);
      if (lastPhoto) added += 1;
    } catch (error) {
      showToast(error.message || "Не удалось добавить фотографию");
    }
  }

  if (!added) return;
  setSelection(lastPhoto);
  updateVenuePhotoStatus();
  markDirty();
  showToast(added === 1 ? "Фотография добавлена" : `Добавлено фотографий: ${added}`);
}

async function replaceSelectedVenuePhoto(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || !selectedElement?.matches(".venue-photo")) return;

  try {
    selectedElement.src = await optimizeVenuePhoto(file);
    selectedElement.dataset.fileName = file.name;
    selectedElement.alt = "Фотография места проведения";
    revealNewElement(selectedElement);
    setSelection(selectedElement);
    markDirty();
    showToast("Фотография заменена");
  } catch (error) {
    showToast(error.message || "Не удалось заменить фотографию");
  }
}

function deleteSelectedVenuePhoto() {
  if (!selectedElement?.matches(".venue-photo")) {
    showToast("Сначала выберите фотографию в макете");
    return;
  }

  const card = selectedElement.closest(".ph");
  card?.remove();
  setSelection(previewDocument.querySelector(".photos"));
  updateVenuePhotoStatus();
  markDirty();
  showToast("Фотография удалена");
}

function openMediaDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Браузер не поддерживает сохранение музыкальных файлов"));
      return;
    }

    const request = indexedDB.open(MUSIC_DB_NAME, 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(MUSIC_DB_STORE)) {
        request.result.createObjectStore(MUSIC_DB_STORE);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function writeStoredMusic(blob) {
  const database = await openMediaDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(MUSIC_DB_STORE, "readwrite");
    transaction.objectStore(MUSIC_DB_STORE).put(blob, MUSIC_STORAGE_KEY);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error));
  });
  database.close();
}

async function readStoredMusic() {
  const database = await openMediaDatabase();
  const blob = await new Promise((resolve, reject) => {
    const transaction = database.transaction(MUSIC_DB_STORE, "readonly");
    const request = transaction.objectStore(MUSIC_DB_STORE).get(MUSIC_STORAGE_KEY);
    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error));
  });
  database.close();
  return blob;
}

async function removeStoredMusic() {
  const database = await openMediaDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(MUSIC_DB_STORE, "readwrite");
    transaction.objectStore(MUSIC_DB_STORE).delete(MUSIC_STORAGE_KEY);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error));
  });
  database.close();
}

function setPreviewMusic(blob, fileName) {
  const audio = previewDocument?.getElementById("weddingAudio");
  if (!audio) return;
  if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
  musicObjectUrl = URL.createObjectURL(blob);
  audio.src = musicObjectUrl;
  audio.autoplay = true;
  audio.dataset.musicStored = "true";
  audio.dataset.musicFileName = fileName;
  audio.load();
  musicStatus.textContent = fileName;
  deleteMusicButton.disabled = false;
}

async function restoreEditorMusic() {
  const audio = previewDocument?.getElementById("weddingAudio");
  if (!audio?.dataset.musicStored) {
    musicStatus.textContent = "Музыка не добавлена";
    deleteMusicButton.disabled = true;
    return;
  }

  musicStatus.textContent = audio.dataset.musicFileName || "Музыка добавлена";
  deleteMusicButton.disabled = false;
  if (audio.getAttribute("src")) return;

  try {
    const blob = await readStoredMusic();
    if (blob) setPreviewMusic(blob, audio.dataset.musicFileName || "Музыка приглашения");
  } catch (error) {
    showToast("Не удалось восстановить музыкальный файл");
  }
}

async function uploadMusic(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    showToast("Выберите музыкальный файл");
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    showToast("Музыкальный файл должен быть меньше 30 МБ");
    return;
  }

  try {
    await writeStoredMusic(file);
    setPreviewMusic(file, file.name);
    markDirty();
    showToast("Музыка добавлена");
  } catch (error) {
    showToast("Не удалось сохранить музыкальный файл");
  }
}

async function deleteMusic() {
  const audio = previewDocument?.getElementById("weddingAudio");
  try {
    await removeStoredMusic();
  } catch (error) {
    console.warn("Не удалось удалить музыкальный файл", error);
  }

  if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
  musicObjectUrl = null;
  audio?.pause();
  audio?.removeAttribute("src");
  if (audio) {
    delete audio.dataset.musicStored;
    delete audio.dataset.musicFileName;
    audio.load();
  }
  musicStatus.textContent = "Музыка не добавлена";
  deleteMusicButton.disabled = true;
  markDirty();
  showToast("Музыка удалена");
}

function createOption(type, name, labelText) {
  const label = previewDocument.createElement("label");
  label.className = type === "radio" ? "opt radio" : "opt";

  const input = previewDocument.createElement("input");
  input.type = type;
  input.name = name;
  input.value = labelText;

  const mark = previewDocument.createElement("span");
  mark.className = "mark";
  mark.setAttribute("aria-hidden", "true");

  const text = previewDocument.createElement("span");
  text.className = "option-text";
  text.textContent = labelText;

  label.append(input, mark, text);
  return label;
}

function addQuestion() {
  const form = previewDocument.getElementById("guestForm");
  if (!form) return;

  const labelText = document.getElementById("questionLabel").value.trim() || "Новый вопрос";
  const type = document.getElementById("questionType").value;
  const unique = Date.now().toString(36);
  let field;

  if (type === "text") {
    field = previewDocument.createElement("div");
    field.className = "field reveal in";
    const label = previewDocument.createElement("label");
    label.htmlFor = `question-${unique}`;
    label.textContent = labelText;
    const input = previewDocument.createElement("input");
    input.type = "text";
    input.id = `question-${unique}`;
    input.name = `question_${unique}`;
    input.placeholder = "Ваш ответ";
    field.append(label, input);
  } else {
    field = previewDocument.createElement("fieldset");
    field.className = "field reveal in";
    const legend = previewDocument.createElement("legend");
    legend.textContent = labelText;
    field.append(legend, createOption(type, `question_${unique}`, "Новый вариант"));
  }

  const submit = form.querySelector(".submit");
  form.insertBefore(field, submit || null);
  registerAllElements();
  setSelection(field);
  document.getElementById("questionLabel").value = "";
  updateQuestionList();
  markDirty();
}

function addOptionToSelectedQuestion() {
  const fieldset = selectedElement?.matches("fieldset.field")
    ? selectedElement
    : selectedElement?.closest("fieldset.field");

  if (!fieldset) {
    showToast("Сначала выберите вопрос с вариантами в макете или списке");
    return;
  }

  const currentInput = fieldset.querySelector("input[type='radio'], input[type='checkbox']");
  if (!currentInput) return;
  const labelText = document.getElementById("optionLabel").value.trim() || "Новый вариант";
  fieldset.appendChild(createOption(currentInput.type, currentInput.name, labelText));
  document.getElementById("optionLabel").value = "";
  registerAllElements();
  updateQuestionList();
  markDirty();
}

function updateQuestionList() {
  if (!previewDocument) return;
  questionList.innerHTML = "";

  previewDocument.querySelectorAll(".form .field").forEach((field, index) => {
    registerElement(field);
    const title = field.querySelector(":scope > legend, :scope > label:not(.opt)")?.textContent?.trim() || `Вопрос ${index + 1}`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${title}`;
    button.addEventListener("click", () => {
      setSelection(field);
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    questionList.appendChild(button);
  });
}

function duplicateSelected() {
  if (!selectedElement || selectedElement.matches(".site")) return;
  const clone = selectedElement.cloneNode(true);
  clone.removeAttribute("data-editor-id");
  clone.classList.remove("editor-selected");
  clone.dataset.editorX = String(numberFromDataset(selectedElement, "editorX") + 12);
  clone.dataset.editorY = String(numberFromDataset(selectedElement, "editorY") + 12);
  clone.style.translate = `${clone.dataset.editorX}px ${clone.dataset.editorY}px`;
  selectedElement.after(clone);
  registerAllElements();
  setSelection(clone);
  updateQuestionList();
  markDirty();
}

function deleteSelected() {
  if (!selectedElement || selectedElement.matches(".site")) return;
  const deletedLocationButton = selectedElement.matches(".map-btn");
  const fallback = selectedElement.parentElement?.closest("[data-editor-id]") || null;
  selectedElement.remove();
  setSelection(fallback);
  updateQuestionList();
  if (deletedLocationButton) syncLocationFields();
  markDirty();
}

function cleanSiteClone() {
  const clone = previewDocument.querySelector(".site").cloneNode(true);
  normalizeAddedVisuals(clone);
  clone.querySelectorAll("[data-editor-id]").forEach((element) => element.removeAttribute("data-editor-id"));
  clone.querySelectorAll(".editor-selected").forEach((element) => element.classList.remove("editor-selected"));
  clone.querySelectorAll(".reveal.in, .deco.in").forEach((element) => element.classList.remove("in"));
  const audio = clone.querySelector("#weddingAudio");
  if (audio?.getAttribute("src")?.startsWith("blob:")) audio.removeAttribute("src");
  return clone;
}

function saveSnapshot({ notify = true } = {}) {
  if (!previewDocument) return null;
  const clone = cleanSiteClone();
  const snapshot = {
    version: 1,
    html: clone.innerHTML,
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    markSaved();
    if (notify) showToast("Изменения сохранены и применены к сайту");
    return snapshot;
  } catch (error) {
    saveStatus.textContent = "Не удалось сохранить — используйте экспорт";
    saveStatus.classList.add("is-dirty");
    showToast("В браузере не хватило места. Скачайте готовый файл для телефона");
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

async function inlineImageAssets(root) {
  const images = [...root.querySelectorAll("img[src]")];
  await Promise.all(images.map(async (image) => {
    const source = image.getAttribute("src");
    if (!source || source.startsWith("data:")) return;
    const response = await fetch(new URL(source, previewDocument.baseURI));
    if (!response.ok) throw new Error(`Не удалось встроить изображение: ${source}`);
    image.src = await blobToDataUrl(await response.blob());
  }));
}

function pointImageAssetsToServer(root) {
  root.querySelectorAll("img[src]").forEach((image) => {
    const source = image.getAttribute("src");
    if (!source || source.startsWith("data:") || source.startsWith("blob:")) return;
    const assetUrl = new URL(source, previewDocument.baseURI);
    image.src = assetUrl.origin === location.origin
      ? `${assetUrl.pathname}${assetUrl.search}`
      : assetUrl.href;
  });
}

function pointMediaSourceToServer(element) {
  const source = element?.getAttribute("src");
  if (!source || source.startsWith("data:") || source.startsWith("blob:")) return;
  const assetUrl = new URL(source, previewDocument.baseURI);
  element.src = assetUrl.origin === location.origin
    ? `${assetUrl.pathname}${assetUrl.search}`
    : assetUrl.href;
}

async function buildStandaloneDocument({ inlineImages = true } = {}) {
  const root = previewDocument.documentElement.cloneNode(true);
  root.classList.remove("motion-ready");
  root.querySelector("#wedding-editor-runtime")?.remove();
  root.querySelector("#wedding-snapshot-loader")?.remove();
  root.querySelector("body")?.classList.remove("wedding-editor-active");
  root.querySelectorAll("[data-editor-id]").forEach((element) => element.removeAttribute("data-editor-id"));
  root.querySelectorAll(".editor-selected").forEach((element) => element.classList.remove("editor-selected"));
  normalizeAddedVisuals(root);
  root.querySelectorAll(".reveal.in, .deco.in").forEach((element) => element.classList.remove("in"));

  if (inlineImages) await inlineImageAssets(root);
  else pointImageAssetsToServer(root);

  const audio = root.querySelector("#weddingAudio");
  if (audio?.dataset.musicStored) {
    const music = await readStoredMusic();
    if (music) {
      audio.src = await blobToDataUrl(music);
    } else if (inlineImages && audio.getAttribute("src") && !audio.getAttribute("src").startsWith("data:")) {
      const response = await fetch(new URL(audio.getAttribute("src"), previewDocument.baseURI));
      if (!response.ok) throw new Error("Не удалось встроить музыку приглашения");
      audio.src = await blobToDataUrl(await response.blob());
    } else if (!inlineImages) {
      pointMediaSourceToServer(audio);
    }
  }

  return `<!DOCTYPE html>\n${root.outerHTML}`;
}

function defaultVersionTitle() {
  const names = previewDocument?.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
  const date = previewDocument?.querySelector(".hero-date")?.textContent?.replace(/\s+/g, " ").trim();
  return [names, date].filter(Boolean).join(" · ") || "Свадебное приглашение";
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

async function readApiResult(response, fallbackMessage) {
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.href = `/login.html?returnTo=${encodeURIComponent("/editor.html")}`;
    throw new Error("Требуется повторный вход");
  }
  if (response.status === 413) {
    throw new Error("Сервер отклонил слишком большую часть файла. Обновите серверную версию проекта");
  }
  if (!response.ok) throw new Error(result.error || fallbackMessage);
  return result;
}

async function uploadInvitationVersion(title, html, onProgress) {
  const chunkSize = 512 * 1024;
  const documentBytes = new TextEncoder().encode(html);
  const totalChunks = Math.ceil(documentBytes.byteLength / chunkSize);
  let uploadId = null;

  try {
    const startResponse = await fetch("/api/admin/invitations/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, totalBytes: documentBytes.byteLength, totalChunks })
    });
    const started = await readApiResult(startResponse, "Не удалось начать загрузку версии");
    uploadId = started.uploadId;

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, documentBytes.byteLength);
      onProgress?.(index + 1, totalChunks);
      const chunkResponse = await fetch(`/api/admin/invitations/uploads/${uploadId}/chunks/${index}`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: documentBytes.slice(start, end)
      });
      await readApiResult(chunkResponse, `Не удалось загрузить часть ${index + 1}`);
    }

    const completeResponse = await fetch(`/api/admin/invitations/uploads/${uploadId}/complete`, {
      method: "POST"
    });
    return await readApiResult(completeResponse, "Не удалось собрать опубликованную версию");
  } catch (error) {
    if (uploadId) {
      fetch(`/api/admin/invitations/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
    }
    throw error;
  }
}

async function publishVersion() {
  if (!previewDocument) return;
  saveSnapshot({ notify: false });

  const publishButton = document.getElementById("saveChanges");
  const originalLabel = publishButton.textContent;
  publishButton.disabled = true;
  publishButton.textContent = "Создаю версию…";
  saveStatus.textContent = "Подготавливаю онлайн-версию";

  try {
    const html = await buildStandaloneDocument({ inlineImages: false });
    const result = await uploadInvitationVersion(
      versionTitle.value.trim() || defaultVersionTitle(),
      html,
      (current, total) => {
        publishButton.textContent = `Загружаю ${current} из ${total}…`;
        saveStatus.textContent = `Загрузка онлайн-версии: ${current} из ${total}`;
      }
    );

    publishedUrl.value = result.invitation.url;
    openPublishedUrl.href = result.invitation.url;
    markSaved();
    saveStatus.textContent = "Версия опубликована";
    publishDialog.showModal();
    showToast("Гостевая ссылка готова");
  } catch (error) {
    console.error(error);
    saveStatus.textContent = "Не удалось опубликовать версию";
    saveStatus.classList.add("is-dirty");
    showToast(error.message || "Не удалось создать онлайн-версию");
  } finally {
    publishButton.disabled = false;
    publishButton.textContent = originalLabel;
  }
}

function downloadHtml(content, fileName) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

async function exportHtml() {
  if (!previewDocument) return;
  saveSnapshot({ notify: false });

  const exportButton = document.getElementById("exportHtml");
  const originalLabel = exportButton.textContent;
  exportButton.disabled = true;
  exportButton.textContent = "Готовлю файл…";

  try {
    downloadHtml(await buildStandaloneDocument({ inlineImages: true }), "wedding-invitation-phone.html");
    showToast("Готовый файл для телефона скачан");
  } catch (error) {
    console.error(error);
    showToast("Не удалось подготовить файл. Проверьте добавленные материалы");
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = originalLabel;
  }
}

function setupPreview() {
  previewDocument = frame.contentDocument;
  if (!previewDocument?.querySelector(".site")) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.version === 1 && saved.html) {
      previewDocument.querySelector(".site").innerHTML = saved.html;
    }
  } catch (error) {
    console.warn("Не удалось восстановить локальный черновик", error);
  }
  nextEditorId = 1;
  selectedElement = null;
  const site = previewDocument.querySelector(".site");
  const loaderMigrated = site.dataset.structureMigrated === "2";
  delete site.dataset.structureMigrated;
  const structureUpdated = ensureInvitationStructure() || loaderMigrated;
  ensurePreviewMediaElements();
  normalizeAddedVisuals();
  injectEditorRuntime();
  registerAllElements();
  setupPreviewEvents();
  updateQuestionList();
  updateVenuePhotoStatus();
  syncLocationFields();
  restoreEditorMusic();
  setSelection(null);
  if (structureUpdated) {
    markDirty();
    showToast("Структура приглашения обновлена — нажмите «Сохранить»");
  } else {
    markSaved();
  }
}

frame.addEventListener("load", setupPreview);

setupControlEvents();
document.getElementById("addText").addEventListener("click", addTextElement);
document.getElementById("addBrush").addEventListener("click", addBrush);
document.getElementById("brushUpload").addEventListener("change", uploadBrushImage);
brushBlur.addEventListener("input", () => {
  if (!selectedElement?.matches(".hero-brush")) return;
  selectedElement.style.filter = `blur(${brushBlur.value}px)`;
  brushBlurOutput.value = `${brushBlur.value}px`;
  markDirty();
});
document.getElementById("deleteBrush").addEventListener("click", () => {
  if (!selectedElement?.matches(".hero-brush")) {
    showToast("Сначала выберите мазок в макете");
    return;
  }
  deleteSelected();
  showToast("Мазок удалён");
});
document.getElementById("decorPalette").addEventListener("click", (event) => {
  const button = event.target.closest("[data-decor-src]");
  if (button) addDecor(button.dataset.decorSrc);
});
document.getElementById("venuePhotoUpload").addEventListener("change", addVenuePhotos);
replaceVenuePhoto.addEventListener("change", replaceSelectedVenuePhoto);
deleteVenuePhotoButton.addEventListener("click", deleteSelectedVenuePhoto);
document.getElementById("applyLocation").addEventListener("click", applyLocationLink);
deleteLocationButton.addEventListener("click", deleteLocationLink);
document.getElementById("musicUpload").addEventListener("change", uploadMusic);
deleteMusicButton.addEventListener("click", deleteMusic);
document.getElementById("addQuestion").addEventListener("click", addQuestion);
document.getElementById("addOption").addEventListener("click", addOptionToSelectedQuestion);
document.getElementById("duplicateElement").addEventListener("click", duplicateSelected);
document.getElementById("deleteElement").addEventListener("click", deleteSelected);
document.getElementById("saveChanges").addEventListener("click", publishVersion);
document.getElementById("exportHtml").addEventListener("click", exportHtml);
document.getElementById("copyPublishedUrl").addEventListener("click", async () => {
  if (!publishedUrl.value) return;
  try {
    await copyText(publishedUrl.value);
    showToast("Ссылка скопирована");
  } catch {
    publishedUrl.select();
    showToast("Выделили ссылку — скопируйте её вручную");
  }
});
document.getElementById("openPreview").addEventListener("click", () => {
  saveSnapshot({ notify: false });
  window.open("index.html", "_blank", "noopener");
});
document.getElementById("resetInvitation").addEventListener("click", async () => {
  if (!window.confirm("Сбросить все изменения и вернуть исходное приглашение?")) return;
  localStorage.removeItem(STORAGE_KEY);
  try {
    await removeStoredMusic();
  } catch (error) {
    console.warn("Не удалось очистить музыкальный файл", error);
  }
  if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
  musicObjectUrl = null;
  frame.src = `${DEFAULT_TEMPLATE_URL}&reset=${Date.now()}`;
  showToast("Исходная версия восстановлена");
});

window.addEventListener("keydown", (event) => {
  const saveShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
  if (saveShortcut) {
    event.preventDefault();
    publishVersion();
  }

  if (event.key === "Delete" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    deleteSelected();
  }
});
