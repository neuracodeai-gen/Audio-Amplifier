const enhancerState = {
  enabled: true,
  gain: 1,
  nodes: new WeakMap(),
  observer: null
};

function buildChainForElement(mediaEl) {
  if (enhancerState.nodes.has(mediaEl)) {
    return enhancerState.nodes.get(mediaEl);
  }

  const ctx = new AudioContext();
  const source = ctx.createMediaElementSource(mediaEl);

  const highPass = ctx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 40;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3200;
  presence.gain.value = 2;
  presence.Q.value = 1;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 16;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.2;

  const gainNode = ctx.createGain();
  gainNode.gain.value = enhancerState.gain;

  source.connect(highPass);
  highPass.connect(presence);
  presence.connect(compressor);
  compressor.connect(gainNode);
  gainNode.connect(ctx.destination);

  const chain = { ctx, source, highPass, presence, compressor, gainNode };
  enhancerState.nodes.set(mediaEl, chain);
  return chain;
}

function applyToAllMedia() {
  const media = document.querySelectorAll('audio, video');
  media.forEach((el) => {
    try {
      const chain = buildChainForElement(el);
      chain.gainNode.gain.value = enhancerState.enabled ? enhancerState.gain : 1;
      if (chain.ctx.state === 'suspended') {
        chain.ctx.resume().catch(() => {});
      }
    } catch {
      // Some media elements can block connection in certain contexts.
    }
  });
}

function installObserver() {
  if (enhancerState.observer) {
    return;
  }
  enhancerState.observer = new MutationObserver(() => applyToAllMedia());
  enhancerState.observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    applyToAllMedia();
    sendResponse({ enabled: enhancerState.enabled, gain: enhancerState.gain });
    return;
  }

  if (message.type === 'SET_GAIN') {
    enhancerState.gain = Math.max(1, Math.min(20, Number(message.gain) || 1));
    applyToAllMedia();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'TOGGLE_ENABLED') {
    enhancerState.enabled = !enhancerState.enabled;
    applyToAllMedia();
    sendResponse({ enabled: enhancerState.enabled });
  }
});

installObserver();
applyToAllMedia();
