async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setToggleUI(enabled) {
  const btn = document.getElementById('toggleBtn');
  if (enabled) {
    btn.textContent = 'Turn Off';
    btn.classList.add('on');
    btn.classList.remove('off');
  } else {
    btn.textContent = 'Turn On';
    btn.classList.remove('on');
    btn.classList.add('off');
  }
}

async function sendToTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error('No active tab found');
  }
  return chrome.tabs.sendMessage(tab.id, message);
}

async function init() {
  const ampRange = document.getElementById('ampRange');
  const ampLabel = document.getElementById('ampLabel');
  const toggleBtn = document.getElementById('toggleBtn');
  const status = document.getElementById('status');

  try {
    const state = await sendToTab({ type: 'GET_STATE' });
    ampRange.value = String(state.gain || 1);
    ampLabel.textContent = `${Number(ampRange.value).toFixed(1)}x`;
    setToggleUI(Boolean(state.enabled));
  } catch {
    status.textContent = 'Open a page with media and try again.';
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
}

init();
