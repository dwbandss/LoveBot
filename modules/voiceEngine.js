/**
 * modules/voiceEngine.js
 * Web Speech API wrapper for TTS delivery.
 *
 * Public API
 *   VoiceEngine.speak(text)
 *   VoiceEngine.stop()
 *   VoiceEngine.isSpeaking()  → bool
 *   VoiceEngine.setEnabled(bool)
 *   VoiceEngine.isSupported() → bool
 *   VoiceEngine.randomTTS()   → string
 */
const VoiceEngine = (() => {
  const synth = window.speechSynthesis || null;
  let _enabled = true;
  let _speaking = false;
  let _voice = null;

  function _loadVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    const pref   = ['samantha','karen','moira','victoria','fiona'];
    for (const p of pref) {
      const v = voices.find(v => v.name.toLowerCase().includes(p));
      if (v) { _voice = v; return; }
    }
    _voice = voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
  }

  if (synth) {
    synth.onvoiceschanged = _loadVoice;
    _loadVoice();
  }

  function isSupported() { return Boolean(synth); }
  function isSpeaking()  { return _speaking; }
  function setEnabled(v) { _enabled = Boolean(v); if (!v) stop(); }

  function speak(text) {
    if (!synth || !_enabled || !text) return;
    stop();
    const utt    = new SpeechSynthesisUtterance(text);
    utt.voice    = _voice;
    utt.rate     = 0.88;
    utt.pitch    = 1.05;
    utt.volume   = 1;
    utt.onstart  = () => { _speaking = true;  window.dispatchEvent(new Event('lb:voice-start')); };
    utt.onend    = () => { _speaking = false; window.dispatchEvent(new Event('lb:voice-end'));   };
    utt.onerror  = () => { _speaking = false; window.dispatchEvent(new Event('lb:voice-end'));   };
    synth.speak(utt);
  }

  function stop() {
    if (synth) { synth.cancel(); }
    _speaking = false;
    window.dispatchEvent(new Event('lb:voice-end'));
  }

  function randomTTS() {
    const lines = (window.LB.messages || {}).tts || [];
    if (!lines.length) return null;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  return { speak, stop, isSpeaking, setEnabled, isSupported, randomTTS };
})();
