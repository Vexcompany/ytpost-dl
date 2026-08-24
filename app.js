const SAMPLE_URL =
  "http://youtube.com/post/Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X?si=dwxpZLHGDPLJ3qw9";

const form = document.querySelector("#extract-form");
const input = document.querySelector("#post-url");
const extractBtn = document.querySelector("#extract-btn");
const pasteBtn = document.querySelector("#paste-btn");
const sampleBtn = document.querySelector("#sample-btn");
const helper = document.querySelector("#helper");
const alertBox = document.querySelector("#alert");
const skeletons = document.querySelector("#skeletons");
const result = document.querySelector("#result");

function showAlert(message) {
  alertBox.hidden = !message;
  alertBox.textContent = message || "";
}

function setLoading(loading) {
  extractBtn.disabled = loading;
  extractBtn.textContent = loading ? "Extracting" : "Extract";
  skeletons.hidden = !loading;
  if (loading) {
    result.hidden = true;
    helper.textContent = "Reading the public post…";
  }
}

async function downloadItem(item) {
  const response = await fetch(`/api/download?token=${encodeURIComponent(item.token)}`);
  if (!response.ok) {
    let message = "Download failed.";
    try {
      const data = await response.json();
      if (data.error) message = data.error;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = item.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function renderResult(data) {
  result.hidden = false;
  const mediaCount = data.media.length;
  helper.textContent =
    mediaCount > 0
      ? `${mediaCount} public ${mediaCount === 1 ? "file" : "files"} ready to save.`
      : "Public posts only. No login, no storage, no video-page ripping.";

  const meta = [data.publishedText, data.likeCount ? `${data.likeCount} likes` : ""]
    .filter(Boolean)
    .join(" · ");

  const authorName = data.authorUrl
    ? `<a href="${data.authorUrl}" target="_blank" rel="noreferrer">${escapeHtml(data.author)}</a>`
    : escapeHtml(data.author);

  const avatar = data.authorAvatar
    ? `<img src="${data.authorAvatar}" alt="" referrerpolicy="no-referrer" />`
    : `<div class="author-fallback"></div>`;

  const saveAll =
    mediaCount > 1
      ? `<button type="button" class="btn secondary" data-all>Save all</button>`
      : "";

  const notices = (data.notices || [])
    .map((notice) => `<p class="notice">${escapeHtml(notice)}</p>`)
    .join("");

  const cards = data.media
    .map((item, index) => {
      const media =
        item.type === "video"
          ? `<video src="${item.previewUrl}" controls preload="metadata"></video>`
          : `<img src="${item.previewUrl}" alt="Post media ${index + 1}" referrerpolicy="no-referrer" />`;
      return `<li class="card">
        <div class="frame">${media}</div>
        <div class="card-bar">
          <p>${item.type === "video" ? "Video" : "Image"} ${index + 1}</p>
          <button type="button" class="btn primary" data-id="${item.id}">Save</button>
        </div>
      </li>`;
    })
    .join("");

  result.innerHTML = `
    <div class="result-head">
      <div class="author">${avatar}<div><p class="name">${authorName}</p><p class="meta">${escapeHtml(meta)}</p></div></div>
      ${saveAll}
    </div>
    ${data.text ? `<p class="post-text">${escapeHtml(data.text)}</p>` : ""}
    ${notices}
    <ul class="media-list">${cards}</ul>
  `;

  result.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = data.media.find((entry) => entry.id === button.getAttribute("data-id"));
      if (!item) return;
      button.disabled = true;
      try {
        await downloadItem(item);
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "Download failed.");
      } finally {
        button.disabled = false;
      }
    });
  });

  const allBtn = result.querySelector("[data-all]");
  if (allBtn) {
    allBtn.addEventListener("click", async () => {
      allBtn.disabled = true;
      try {
        for (const item of data.media) {
          await downloadItem(item);
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      } catch (error) {
        showAlert(
          error instanceof Error
            ? error.message
            : "A browser blocked multiple downloads. Save files one at a time.",
        );
      } finally {
        allBtn.disabled = false;
      }
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """);
}

async function extract(url) {
  const trimmed = (url ?? input.value).trim();
  if (!trimmed) {
    showAlert("Paste a YouTube Community Post URL.");
    return;
  }
  input.value = trimmed;
  showAlert("");
  setLoading(true);
  try {
    const response = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });
    const data = await response.json();
    if (!data.ok) {
      showAlert(data.error || "Could not extract this post.");
      helper.textContent = "Public posts only. No login, no storage, no video-page ripping.";
      return;
    }
    if (data.media.length === 0 && data.notices?.[0]) {
      showAlert(data.notices[0]);
    }
    renderResult(data);
  } catch {
    showAlert("Network error while talking to the extractor.");
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void extract();
});

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) await extract(text);
  } catch {
    showAlert("Clipboard access was blocked. Paste the URL into the field instead.");
  }
});

sampleBtn.addEventListener("click", () => {
  void extract(SAMPLE_URL);
});
