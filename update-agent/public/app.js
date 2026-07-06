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
    const response = await fetch("/status", { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Status check failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    const outOfDate = data.services.filter((service) => !service.upToDate);

    if (outOfDate.length === 0) {
      renderServiceList(document.getElementById("up-to-date-list"), data.services);
      showView("upToDate");
    } else {
      renderServiceList(document.getElementById("available-list"), data.services);
      showView("available");
    }
  } catch (error) {
    document.getElementById("error-message").textContent = error.message;
    showView("error");
  }
}

async function applyUpdate() {
  showView("updating");
  try {
    const response = await fetch("/apply", { method: "POST", credentials: "include" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Update failed (HTTP ${response.status})`);
    }

    const failed = data.results.filter((result) => !result.updated && result.reason !== "already up to date");
    if (failed.length > 0) {
      document.getElementById("failure-message").textContent = failed
        .map((result) => `${result.service}: ${result.reason}`)
        .join(" ");
      showView("failure");
    } else {
      showView("success");
    }
  } catch (error) {
    document.getElementById("failure-message").textContent = error.message;
    showView("failure");
  } finally {
    setTimeout(() => window.location.reload(), 4000);
  }
}

document.getElementById("update-now-button").addEventListener("click", applyUpdate);
document.getElementById("retry-button").addEventListener("click", loadStatus);

loadStatus();
