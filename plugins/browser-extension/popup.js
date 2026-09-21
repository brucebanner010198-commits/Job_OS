document.addEventListener("DOMContentLoaded", async () => {
  const statusText = document.getElementById("status-text");
  const dot = document.getElementById("dot");
  const btn = document.getElementById("autofill-btn");

  let profileData = null;

  try {
    const res = await fetch("http://localhost:3000/api/extension");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    profileData = data.profile;

    statusText.textContent = `Connected (${data.profile.name || "Profile"})`;
    dot.style.background = "#10b981";
    btn.disabled = false;
  } catch {
    statusText.textContent = "Job OS offline (start dev server)";
    dot.style.background = "#ef4444";
  }

  btn.addEventListener("click", async () => {
    if (!profileData) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (profile) => {
        window.postMessage({ type: "JOB_OS_AUTOFILL", profile }, "*");
      },
      args: [profileData],
    });

    btn.textContent = "Fields Populated!";
    setTimeout(() => {
      btn.textContent = "Autofill Application";
    }, 2000);
  });
});
