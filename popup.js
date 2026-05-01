async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setToggleUI(enabled) {
  const btn = document.getElementById('toggleBtn');
  btn.textContent = enabled ? 'Turn Off' : 'Turn On';
  btn.classList.toggle('on', enabled);
  btn.classList.toggle('off', !enabled);
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }
}

async function sendToTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab found');
  await ensureContentScript(tab.id);
  return chrome.tabs.sendMessage(tab.id, message);
}

async function init() {
  const ampRange = document.getElementById('ampRange');
  const ampLabel = document.getElementById('ampLabel');
  const toggleBtn = document.getElementById('toggleBtn');
  const reopenBtn = document.getElementById('reopenBtn');
  const status = document.getElementById('status');

  try {
    const state = await sendToTab({ type: 'GET_STATE' });
    ampRange.value = String(state.gain || 1);
    ampLabel.textContent = `${Number(ampRange.value).toFixed(1)}x`;
    setToggleUI(Boolean(state.enabled));
  } catch {
    status.textContent = 'This page blocks scripting. Try opening it in a new tab.';
  }

  ampRange.addEventListener('input', async () => {
    const gain = Number(ampRange.value);
    ampLabel.textContent = `${gain.toFixed(1)}x`;
    try {
      await sendToTab({ type: 'SET_GAIN', gain });
      status.textContent = `Amplification set to ${gain.toFixed(1)}x`;
    } catch {
      status.textContent = 'Could not apply gain on this tab.';
    }
  });

  toggleBtn.addEventListener('click', async () => {
    try {
      const next = await sendToTab({ type: 'TOGGLE_ENABLED' });
      setToggleUI(Boolean(next.enabled));
      status.textContent = next.enabled ? 'Enhancer is on.' : 'Enhancer is off.';
    } catch {
      status.textContent = 'Could not toggle on this tab.';
    }
  });

  reopenBtn.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.url) return;
    await chrome.tabs.create({ url: tab.url });
    status.textContent = 'Opened current page in a new tab.';
  });
}

init();
