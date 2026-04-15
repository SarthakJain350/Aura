// SpeechService.js
console.log('[SPEECH] SpeechService.js loading...')

const SR = window.SpeechRecognition || window.webkitSpeechRecognition

if (!SR) {
  console.error('[SPEECH] SpeechRecognition not supported - use Chrome or Edge')
} else {
  console.log('[SPEECH] SpeechRecognition is available')
}

window.SpeechService = {
  recognition: null,
  isListening: false,
  isSpeaking: false,
  manuallyStopped: false,
  _wasNoSpeech: false,
  connectingTimeout: null,
  _lastStartedTime: Date.now(),
  _lastActivityTime: Date.now(),
  _onResult: null,
  _onListenChange: null,
  _onInterim: null,
  lastSpeechEnd: 0,

  // Called ONCE on app boot with callback wiring
  init: function(onResult, onListenChange, onInterim) {
    console.log('[SPEECH] init() called')
    if (!SR) return false

    if (onResult) this._onResult = onResult
    if (onListenChange) this._onListenChange = onListenChange
    if (onInterim) this._onInterim = onInterim

    if (this.recognition) {
      console.log('[SPEECH] Recognition already exists, reusing')
      return true
    }

    this._createRecognition()
    return true
  },

  _createRecognition: function() {
    if (this.recognition) {
      try { this.recognition.abort() } catch(e) {}
    }

    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 3
    r.lang = 'en-US'

    r.onstart = () => {
      clearTimeout(this.connectingTimeout)
      this.isListening = true
      this._lastStartedTime = Date.now()
      window.micStatus = 'listening'
      if (window.setMicActive) window.setMicActive(true)
      if (window.setMicStatus) window.setMicStatus('listening')
      if (this._onListenChange) this._onListenChange(true)
      console.log('[SPEECH] Mic ACTIVE')
    }

    r.onresult = (event) => {
      this._lastActivityTime = Date.now()
      // Discard anything heard while AURA is speaking or shortly after to prevent acoustic feedback echoing
      if (this.isSpeaking || (Date.now() - this.lastSpeechEnd < 700)) return

      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim()
          const confidence = event.results[i][0].confidence
          const minConf = window.isMusicPlaying ? 0.5 : 0.4
          console.log('[SPEECH] Heard:', transcript, '| conf:', confidence.toFixed(2), '| min:', minConf)
          if (confidence >= minConf) {
            if (window.handleSpeechResult) window.handleSpeechResult(transcript, confidence)
            else if (this._onResult) this._onResult(transcript, confidence)
          } else {
            console.warn('[SPEECH] Below confidence threshold - ignored')
          }
        } else {
          interim += event.results[i][0].transcript
        }
      }
      if (interim) {
        this._lastActivityTime = Date.now()
        if (this._onInterim) this._onInterim(interim)
      }
    }

    // Chrome fires onend after every silence period (no-speech) or real stops.
    // Only update UI state when it is a real unexpected end, not a silent timeout.
    r.onend = () => {
      this.isListening = false
      const silentRestart = this._wasNoSpeech
      this._wasNoSpeech = false
      if (!silentRestart && this._onListenChange) this._onListenChange(false)
      if (!this.manuallyStopped) {
        setTimeout(() => this._startRecognition(), 50)
      }
    }

    r.onerror = (e) => {
      clearTimeout(this.connectingTimeout)
      this.isListening = false
      console.error('[SPEECH] Error:', e.error)

      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.manuallyStopped = true
        window.micStatus = 'failed'
        if (window.setMicActive) window.setMicActive(false)
        if (window.setMicStatus) window.setMicStatus('failed')
        if (this._onListenChange) this._onListenChange(false)
        if (window.showMicInstructions) window.showMicInstructions()
        return
      }

      if (e.error === 'aborted') {
        return // Our own abort call - safe to ignore
      }

      if (e.error === 'no-speech') {
        // Chrome silence timeout - DO NOT flip UI to offline. Restart quietly.
        this._wasNoSpeech = true
        return // onend fires next and restarts
      }

      if (e.error === 'network') {
        window.micStatus = 'failed'
        if (window.setMicActive) window.setMicActive(false)
        if (window.setMicStatus) window.setMicStatus('failed')
        if (this._onListenChange) this._onListenChange(false)
        setTimeout(() => this._startRecognition(), 5000)
        return
      }

      // All other hard errors
      window.micStatus = 'failed'
      if (window.setMicActive) window.setMicActive(false)
      if (window.setMicStatus) window.setMicStatus('failed')
      if (this._onListenChange) this._onListenChange(false)
      if (!this.manuallyStopped) {
        setTimeout(() => this._startRecognition(), 1500)
      }
    }

    this.recognition = r
  },

  // Internal start - does NOT recreate the recognition object
  _startRecognition: function() {
    if (this.isListening || this.manuallyStopped) return

    clearTimeout(this.connectingTimeout)
    this.connectingTimeout = setTimeout(() => {
      if (!this.isListening) {
        console.warn('[SPEECH] Stuck connecting - hard resetting')
        this._createRecognition()
        this._startRecognition()
      }
    }, 6000)

    try {
      this.recognition.start()
    } catch(e) {
      if (e.message && e.message.includes('already started')) {
        this.isListening = true
      } else {
        console.error('[SPEECH] start() threw:', e.message)
        setTimeout(() => this._startRecognition(), 1500)
      }
    }
  },

  // Public start - called from App.jsx
  start: function() {
    this.manuallyStopped = false
    if (!this.recognition) this._createRecognition()
    this._startRecognition()
  },

  // Only for deliberate user stop (logout etc)
  stop: function() {
    clearTimeout(this.connectingTimeout)
    this.manuallyStopped = true
    if (this.recognition) {
      try { this.recognition.stop() } catch(e) {}
    }
    this.isListening = false
    window.micStatus = 'failed'
    if (window.setMicActive) window.setMicActive(false)
    if (window.setMicStatus) window.setMicStatus('failed')
  },

  // Toggle self-capture guard when AURA is speaking
  setSpeaking: function(val) {
    this.isSpeaking = val
    if (!val) this.lastSpeechEnd = Date.now()
  },

  speak: function(text, onEnd) {
    window.speechSynthesis.cancel()
    if (this.speakTimeout) clearTimeout(this.speakTimeout);
    this.setSpeaking(true)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.92
    utterance.pitch = 1.15
    utterance.volume = 1.0

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred = [
        'Google UK English Female',
        'Microsoft Zira - English (United States)',
        'Samantha', 'Victoria', 'Karen'
      ]
      for (const name of preferred) {
        const v = voices.find(v => v.name === name)
        if (v) return v
      }
      const female = voices.find(v => v.name.toLowerCase().includes('female') && v.lang.startsWith('en'))
      if (female) return female
      return voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB') || voices[0]
    }

    const maxTime = text.length * 100 + 4000;
    this.speakTimeout = setTimeout(() => {
      if (this.isSpeaking) {
        console.warn('[SPEECH] Fallback: utterance.onend did not fire. Releasing lock.');
        this.setSpeaking(false);
        if (onEnd) onEnd();
      }
    }, maxTime);

    const doSpeak = () => {
      utterance.voice = pickVoice()

      utterance.onend = () => { clearTimeout(this.speakTimeout); this.setSpeaking(false); if (onEnd) onEnd() }
      utterance.onerror = () => { clearTimeout(this.speakTimeout); this.setSpeaking(false); if (onEnd) onEnd() }
      window.speechSynthesis.speak(utterance)
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      doSpeak()
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null
        doSpeak()
      }
    }
  }
}

// Watchdog: restart if mic has been dead or silent for too long
setInterval(() => {
  if (window.SpeechService.manuallyStopped) return

  const now = Date.now()
  const lastStart = now - window.SpeechService._lastStartedTime
  const lastActivity = now - window.SpeechService._lastActivityTime

  if (!window.SpeechService.isListening && !window.SpeechService.isSpeaking) {
    if (lastStart > 10000) {
      console.warn('[SPEECH] Watchdog: mic dead >10s, restarting...')
      window.SpeechService._startRecognition()
    }
  } else if (window.SpeechService.isListening && !window.SpeechService.isSpeaking) {
    if (lastActivity > 30000) {
      console.warn('[SPEECH] Watchdog: mic responsive but silent >30s, cycling...')
      window.SpeechService._createRecognition()
      window.SpeechService._startRecognition()
    }
  }
}, 5000)

window.showMicInstructions = () => {
  console.log('[SPEECH] Mic instructions theoretically shown, but suppressed to avoid pop-ups.')
}

console.log('[SPEECH] SpeechService ready - App.jsx will call init() then start()')
