// SpeechService.js — Clean rebuild
console.log('[SPEECH] SpeechService.js loading...')

const SR = window.SpeechRecognition || window.webkitSpeechRecognition

if (!SR) {
  console.error('[SPEECH] ❌ SpeechRecognition not supported — use Chrome or Edge')
} else {
  console.log('[SPEECH] ✅ SpeechRecognition is available')
}

window.SpeechService = {
  recognition: null,
  manuallyStopped: false,
  isListening: false,
  connectingTimeout: null,
  
  // Stability Trackers
  _restartCount: 0,
  _lastRestartTime: 0,
  _lastStartedTime: Date.now(),
  
  hardwareReset: function() {
    console.log('[SPEECH] 🔄 Performing HARDWARE RESET on Web Speech API...')
    if (this.recognition) {
        try { this.recognition.abort(); } catch(e) {}
        this.recognition = null;
    }
    this.isListening = false;
    window.micStatus = 'failed';
    if (window.setMicStatus) window.setMicStatus('failed');
    if (!this.manuallyStopped) {
        setTimeout(() => this.start(), 1000);
    }
  },

  init: function() {
    console.log('[SPEECH] init() called')
    if (!SR) return false
    
    // Always create a fresh recognition object
    if (this.recognition) {
        try { this.recognition.abort(); } catch(e) {}
        this.recognition = null;
    }

    this.recognition = new SR()
    this.recognition.continuous = true
    this.recognition.interimResults = false
    this.recognition.maxAlternatives = 3
    this.recognition.lang = 'en-US'

    this.recognition.onstart = () => {
      clearTimeout(this.connectingTimeout);
      console.log('[SPEECH] ✅ MICROPHONE IS NOW ACTIVE')
      this.isListening = true
      this._lastStartedTime = Date.now()
      window.micStatus = 'listening'
      if (window.setMicActive) window.setMicActive(true)
      if (window.setMicStatus) window.setMicStatus('listening')
      this._restartCount = 0 // Reset on successful start
    }

    this.recognition.onresult = (event) => {
      const last = event.results.length - 1
      const transcript = event.results[last][0].transcript.trim()
      const confidence = event.results[last][0].confidence
      
      // Filter by confidence, especially when music is playing
      const minConfidence = window.isMusicPlaying ? 0.7 : 0.5
      console.log('[SPEECH] ✅ Heard:', transcript, '| Confidence:', confidence, '| Threshold:', minConfidence)
      
      if (confidence >= minConfidence) {
          console.log('[SPEECH→APP] Sending to handleSpeechResult:', transcript)
          if (window.handleSpeechResult) {
              window.handleSpeechResult(transcript, confidence)
          }
      } else {
          console.warn('[SPEECH] ⚠️ Low confidence result ignored (Music Playing:', !!window.isMusicPlaying, ')')
      }
    }

    this.recognition.onend = () => {
      this.isListening = false
      if (!this.manuallyStopped) {
        console.log('[SPEECH] Recognition ended unexpectedly, restarting...')
        setTimeout(() => {
          this.start()
        }, 300)
      }
    }

    this.recognition.onerror = (e) => {
      clearTimeout(this.connectingTimeout);
      console.error('[SPEECH] ❌ Error:', e.error)
      this.isListening = false
      window.micStatus = 'failed'
      if (window.setMicActive) window.setMicActive(false)
      if (window.setMicStatus) window.setMicStatus('failed')

      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        console.error('[SPEECH] ❌ Permission or Service denied — cannot restart automatically')
        if (window.showMicInstructions) window.showMicInstructions()
        this.manuallyStopped = true // Stop attempts to restart
        return
      }

      if (e.error === 'network') {
        console.warn('[SPEECH] ⚠️ Network error — retrying in 5s')
        setTimeout(() => this.start(), 5000)
        return
      }
      
      if (!this.manuallyStopped) {
        setTimeout(() => this.start(), 2000)
      }
    }

    return true
  },

  start: function() {
    console.log('[SPEECH] start() called, isListening:', this.isListening)
    
    if (this.isListening) {
      console.log('[SPEECH] Already listening, skipping start')
      return
    }

    // Always re-init for clean slate on start
    const ok = this.init()
    if (!ok) return

    this.manuallyStopped = false
    
    // Fix 2: Stuck Connecting Timeout
    clearTimeout(this.connectingTimeout);
    this.connectingTimeout = setTimeout(() => {
        if (!this.isListening) {
            console.warn('[SPEECH] ⚠️ Connecting timeout — recognition never fired onstart')
            this.hardwareReset()
        }
    }, 5000)

    try {
      this.recognition.start()
      console.log('[SPEECH] recognition.start() called')
    } catch(e) {
      console.error('[SPEECH] ❌ start() failed:', e.message)
      setTimeout(() => this.start(), 2000)
    }
  },
  
  stop: function() {
      clearTimeout(this.connectingTimeout);
      this.manuallyStopped = true;
      if (this.recognition) {
          try { this.recognition.stop(); } catch(e) {}
      }
      this.isListening = false
      window.micStatus = 'failed'
      if (window.setMicActive) window.setMicActive(false)
      if (window.setMicStatus) window.setMicStatus('failed')
  },
  
  speak: function(text, onEnd) {
      if (onEnd) onEnd();
  }
}

// Health check watchdog check every 15s to be less aggressive than the start() loop
setInterval(() => {
    if (!window.SpeechService.isListening && !window.SpeechService.manuallyStopped && window.micStatus !== 'reconnecting') {
        console.warn('[SPEECH] ⚠️ Health check: Inactive. Restarting...')
        window.SpeechService.start()
    }
    
    // Hard reset every 15 minutes to prevent Chrome Web Speech API stalling
    if (window.SpeechService.isListening && (Date.now() - window.SpeechService._lastStartedTime > 900000)) {
        console.log('[SPEECH] ⏱️ 15-minute stability reset triggered.')
        window.SpeechService.hardwareReset()
    }
}, 15000)

window.showMicInstructions = () => {
  document.body.insertAdjacentHTML('beforeend', `
    <div style="
      position:fixed; top:0; left:0; right:0; 
      background:rgba(30, 58, 95, 0.95); color:white; 
      padding:20px; text-align:center; 
      font-family:monospace; z-index:9999;
      font-size:13px; line-height:2;
      backdrop-filter: blur(10px);
    ">
      <strong style="color:#22d3ee; font-size:16px">
        ⚠ One-time Chrome setup required for voice
      </strong><br/>
      1. Open a new tab and go to: 
      <code style="background:#0f172a; padding:4px 8px; border-radius:4px">
        chrome://flags/#unsafely-treat-insecure-origin-as-secure
      </code><br/>
      2. Add <code style="background:#0f172a; padding:4px 8px; border-radius:4px">
        http://127.0.0.1:8888
      </code> to the text box and set to <strong>Enabled</strong><br/>
      3. Click <strong>Relaunch Chrome</strong><br/>
      4. Come back to AURA — voice will work permanently after this<br/>
      <button onclick="window.open('chrome://flags/#unsafely-treat-insecure-origin-as-secure')" 
        style="margin-top:8px; background:#0e7490; color:white; border:none; 
        padding:10px 20px; border-radius:6px; cursor:pointer; font-size:14px">
        Open Chrome Flags
      </button>
      <button onclick="this.parentElement.remove()" 
        style="margin-top:8px; margin-left:8px; background:#374151; color:white; 
        border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-size:14px">
        Dismiss
      </button>
    </div>
  `)
}

// Auto start immediately
console.log('[SPEECH] Auto starting SpeechService...')
window.SpeechService.start()
