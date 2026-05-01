if (!window.__tabAmplifierInjected) {
  window.__tabAmplifierInjected = true;

  const enhancerState = {
    enabled: true,
    gain: 1,
    nodes: new WeakMap(),
    observer: null
  };

  function gainToDrive(gain) {
    return Math.min(25, 1 + Math.pow(gain, 0.85));
  }

  function gainToOutput(gain) {
    return Math.max(0.45, 1 / Math.pow(gain, 0.3));
  }

  function buildChainForElement(mediaEl) {
    if (enhancerState.nodes.has(mediaEl)) return enhancerState.nodes.get(mediaEl);

    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(mediaEl);

    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 35;

    const clarity = ctx.createBiquadFilter();
    clarity.type = 'peaking';
    clarity.frequency.value = 2800;
    clarity.gain.value = 1.5;
    clarity.Q.value = 0.8;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 24;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 18;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;

    const driveGain = ctx.createGain();
    const outputGain = ctx.createGain();

    source.connect(lowCut);
    lowCut.connect(clarity);
    clarity.connect(compressor);
    compressor.connect(driveGain);
    driveGain.connect(limiter);
    limiter.connect(outputGain);
    outputGain.connect(ctx.destination);

    const chain = { ctx, driveGain, outputGain };
    enhancerState.nodes.set(mediaEl, chain);
    return chain;
  }

  function applyToAllMedia() {
    document.querySelectorAll('audio, video').forEach((el) => {
      try {
        const chain = buildChainForElement(el);
        const target = enhancerState.enabled ? enhancerState.gain : 1;
        chain.driveGain.gain.value = gainToDrive(target);
        chain.outputGain.gain.value = gainToOutput(target);
        if (chain.ctx.state === 'suspended') chain.ctx.resume().catch(() => {});
      } catch {}
    });
  }

  function installObserver() {
    if (enhancerState.observer) return;
    enhancerState.observer = new MutationObserver(applyToAllMedia);
    enhancerState.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'GET_STATE') {
      applyToAllMedia();
      sendResponse({ enabled: enhancerState.enabled, gain: enhancerState.gain });
      return;
    }
    if (message.type === 'SET_GAIN') {
      enhancerState.gain = Math.max(1, Math.min(60, Number(message.gain) || 1));
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
}
