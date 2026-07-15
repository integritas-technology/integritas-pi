const views = {
  loading: document.getElementById("view-loading"),
  upToDate: document.getElementById("view-up-to-date"),
  available: document.getElementById("view-available"),
  updating: document.getElementById("view-updating"),
  success: document.getElementById("view-success"),
  failure: document.getElementById("view-failure"),
  error: document.getElementById("view-error")
};

function showView(name) {
  for (const key of Object.keys(views)) {
    views[key].classList.toggle("hidden", key !== name);
  }
}

function renderServiceList(listEl, services) {
  listEl.innerHTML = "";
  for (const service of services) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${service.service}</span><span>${service.upToDate ? "current" : "update available"}</span>`;
    listEl.appendChild(item);
  }
}

async function loadStatus() {
  showView("loading");
  try {
    const response = await fetch("/update/status", { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Status check failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    const outOfDate = data.services.filter((service) => !service.upToDate);
    const availableVersion = data.manifest.version;

    if (outOfDate.length === 0) {
      document.getElementById("up-to-date-version").textContent = data.currentVersion ?? availableVersion;
      renderServiceList(document.getElementById("up-to-date-list"), data.services);
      showView("upToDate");
    } else {
      document.getElementById("available-version").textContent = data.currentVersion
        ? `${data.currentVersion} → ${availableVersion}`
        : availableVersion;
      renderServiceList(document.getElementById("available-list"), data.services);
      showView("available");
    }
  } catch (error) {
    document.getElementById("error-message").textContent = error.message;
    showView("error");
  }
}

const POLL_INTERVAL_MS = 3000;
// A successful frontend update restarts the very container proxying this
// page, so polls during that window fail even though the update is fine.
// Only give up after this many *consecutive* poll failures.
const MAX_CONSECUTIVE_POLL_FAILURES = 10;

function finishWithFailure(message) {
  document.getElementById("failure-message").textContent = message;
  showView("failure");
  setTimeout(() => window.location.reload(), 4000);
}

function finishWithSuccess() {
  showView("success");
  setTimeout(() => window.location.assign("/"), 4000);
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function renderPullProgress(progress) {
  const bar = document.getElementById("pull-progress-bar");
  const label = document.getElementById("pull-progress-label");
  const spinner = document.getElementById("updating-spinner");

  if (!progress || !progress.bytesTotal) {
    bar.classList.add("hidden");
    label.classList.add("hidden");
    spinner.classList.remove("hidden");
    return;
  }

  spinner.classList.add("hidden");
  bar.classList.remove("hidden");
  label.classList.remove("hidden");

  const percent = Math.min(100, Math.round((progress.bytesDownloaded / progress.bytesTotal) * 100));
  bar.value = percent;
  label.textContent = `${progress.service}: ${formatBytes(progress.bytesDownloaded)} / ${formatBytes(progress.bytesTotal)} (${percent}%)`;
}

async function pollApplyStatus(consecutiveFailures = 0) {
  let data;
  try {
    const response = await fetch("/update/apply", { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Status check failed (HTTP ${response.status})`);
    }
    data = await response.json();
  } catch {
    if (consecutiveFailures + 1 >= MAX_CONSECUTIVE_POLL_FAILURES) {
      finishWithFailure("Lost contact with the update agent. If the frontend was updated, reload to check its status.");
      return;
    }
    setTimeout(() => pollApplyStatus(consecutiveFailures + 1), POLL_INTERVAL_MS);
    return;
  }

  if (data.state === "running") {
    renderPullProgress(data.progress);
    setTimeout(() => pollApplyStatus(0), POLL_INTERVAL_MS);
    return;
  }

  if (data.state === "failed") {
    finishWithFailure(data.error || "Update failed");
    return;
  }

  if (data.state !== "succeeded") {
    finishWithFailure(`Unexpected update status: ${data.state}`);
    return;
  }

  const failed = data.results.filter((result) => !result.updated && result.reason !== "already up to date");
  if (failed.length > 0) {
    finishWithFailure(failed.map((result) => `${result.service}: ${result.reason}`).join(" "));
  } else {
    finishWithSuccess();
  }
}

async function applyUpdate() {
  showView("updating");
  renderPullProgress(null);
  try {
    const response = await fetch("/update/apply", { method: "POST", credentials: "include" });
    if (response.status !== 202 && response.status !== 409) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Failed to start update (HTTP ${response.status})`);
    }
  } catch (error) {
    finishWithFailure(error.message);
    return;
  }

  pollApplyStatus();
}

document.getElementById("update-now-button").addEventListener("click", applyUpdate);
document.getElementById("retry-button").addEventListener("click", loadStatus);

loadStatus();
