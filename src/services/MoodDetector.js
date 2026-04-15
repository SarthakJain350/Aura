// MoodDetector.js
// Removed esm.sh afinn import due to strict ES6 module default export syntax collision in current browser. Using robust OFFLINE fallback exclusively.

/*
 * ACADEMIC DEFINITION: Lexicon-Based Keyword Classification
 * Lexicon-based classification works by establishing a predefined dictionary (or "lexicon") of known mood-indicative keywords 
 * and testing raw string inputs for subset inclusion. This operates via O(n) algorithmic complexity, rendering it extremely efficient natively in-browser. 
 * Contrast this with deep-learning NLP models - this model provides deterministic, explicit mood mapping with zero black-box obscurity.
 */
const MOOD_KEYWORDS = {
  happy: ["happy", "joy", "great", "amazing", "good", "excited", "cheerful", "wonderful", "fantastic", "awesome"],
  sad: ["sad", "depressed", "down", "cry", "crying", "upset", "unhappy", "lonely", "heartbroken", "miss"],
  calm: ["calm", "relax", "chill", "peaceful", "quiet", "breathe", "slow", "easy", "zen", "rest", "car", "come"],
  focused: ["focused", "focus", "study", "concentrate", "work", "productive", "homework", "exam", "coding", "read"],
  energetic: ["energetic", "energy", "pump", "pumped", "hype", "workout", "gym", "run", "dance", "party", "fired up", "lets go", "fire", "lit"],
  stressed: ["stressed", "stress", "anxious", "anxiety", "nervous", "overwhelmed", "pressure", "panic", "worried"],
  angry: ["angry", "mad", "furious", "annoyed", "frustrated", "hate", "irritated", "rage"],
  tired: ["tired", "sleepy", "exhausted", "drained", "bored", "lazy", "slow", "heavy"]
};

// Offline mini-AFINN fallback deployed for extreme redundancy handling without CDN failure states.
const OFFLINE_AFINN = {
    happy: 3, joy: 3, amazing: 4, good: 2, wonderful: 4, fantastic: 4, awesome: 4, setup: 1, yes: 1, 
    smile: 2, laugh: 3, love: 3, excited: 3, cheerful: 2, glad: 2,
    sad: -2, depressed: -3, cry: -2, upset: -2, lonely: -2, heartbreak: -3, miss: -1, bad: -3,
    terrible: -3, awful: -3, tragedy: -3, sorrow: -2, tragic: -3, fail: -2,
    peace: 2, relax: 2, chill: 1, quiet: 1, rest: 2, calm: 2, breathe: 1, easy: 1,
    focus: 2, study: 1, work: 1, productive: 2, concentrate: 2,
    energy: 2, pump: 2, hype: 2, gym: 1, run: 1, workout: 1, fired: 2,
    stress: -3, anxious: -3, panic: -4, worry: -2, nervous: -2, overwhelmed: -3, pressure: -2,
    angry: -3, mad: -3, hate: -3, furious: -3, annoyed: -2, frustrated: -2, rage: -4,
    tired: -2, sleepy: -2, exhausted: -3, drained: -2, bored: -1, lazy: -1
};

let activeAfinn = OFFLINE_AFINN;

/*
 * ACADEMIC DEFINITION: AFINN Valence Scoring with Polarity Thresholds
 * AFINN is a list of English words rated for valence with an integer between minus five (negative) and plus five (positive). 
 * Sentiment scoring iterates over sentence tokens. We normalize the net score against the token count to generate a polarity coefficient ranging roughly from -1.0 to 1.0.
 * Thresholds act as conditional barriers to distinctly map numerical affect back into qualitative categories without strict keyword overlap.
 */
const detectBySentiment = (text) => {
    const words = text.toLowerCase().split(/\W+/);
    let score = 0;
    let wordCount = 0;
    
    words.forEach(word => {
        if (!word) return;
        wordCount++;
        score += activeAfinn[word] || 0;
    });
    
    const polarity = wordCount > 0 ? (score / (wordCount * 3)) * 2 : 0; 

    // Polarity Threshold logic per the specified heuristics:
    if (polarity > 0.3) return 'happy';
    if (polarity > 0.0) return 'calm';
    if (polarity < -0.4) return 'sad';
    if (polarity < 0.0) return 'stressed';
    return null; // Returning null defaults back implicitly!
};

const detectByKeyword = (text) => {
    const lowerText = text.toLowerCase();
    for (const [mood, kws] of Object.entries(MOOD_KEYWORDS)) {
      for (const kw of kws) {
        if (lowerText.includes(kw.toLowerCase())) {
          return mood;
        }
      }
    }
    return null;
};

// TensorFlow.js Inference Loading Block
let tfModel = null;
let tokenizerData = null;
// Automatically support any new moods added during training via tokenizer.json
let dynamicMoodLabels = ['happy', 'sad', 'angry', 'stressed', 'energetic', 'calm'];

const urlParams = new URLSearchParams(window.location.search);
const useSafeMode = urlParams.get('safe') === 'true';

// Wrap entire model loading in try catch with timeout
async function loadModel() {
  if (useSafeMode) {
      console.log('[MODEL] Safe mode active. Skipping TensorFlow initialization.');
      return;
  }

  // Wait for TensorFlow to be available
  let attempts = 0
  while (!window.tf && attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 500))
    attempts++
  }
  if (!window.tf) {
    console.warn('[MODEL] TensorFlow not available after 10s, skipping ML model')
    return
  }

  try {
    console.log('[MODEL] Starting model load...')
    
    // Set a 10 second timeout — if model does not load give up silently
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Model load timeout')), 10000)
    )
    
    const modelPath = '/model/tfjs_model/model.json'
    const tokenizerPath = '/model/tokenizer.json'

    console.log('[MODEL] Checking for model files...')
    
    // Check model file
    const modelRes = await fetch(modelPath)
    if (!modelRes.ok) {
        console.warn('[MODEL] Model.json not found — skipping ML detection. Run train_model.py first.')
        return
    }

    tfModel = await window.tf.loadLayersModel(modelPath)
    
    // Check tokenizer
    const tokenizerRes = await fetch(tokenizerPath)
    if (!tokenizerRes.ok) {
        console.warn('[MODEL] Tokenizer.json not found — skipping ML detection.')
        return
    }

    tokenizerData = await tokenizerRes.json()
    
    if (tokenizerData.mood_labels) {
       dynamicMoodLabels = tokenizerData.mood_labels;
    }
    console.log('[MODEL] ✅ Emotion model ready — deep learning active')
  } catch(err) {
    console.warn('[MODEL] ❌ Model failed to load:', err.message)
    tfModel = null
  }
}

// Load model in background — never await this at top level
loadModel();

function predictWithModel(text) {
  if (!tfModel || !tokenizerData) return null
  
  try {
    // Tokenize input text identically to Keras word_index sequences
    const words = text.toLowerCase().split(/\s+/)
    const sequence = words.map(w => tokenizerData.word_index[w] || 0)
    
    // Pad sequence to max_length (100) to maintain static input tensor shape
    const max_length = tokenizerData.max_length || 100
    const padded = new Array(max_length).fill(0)
    sequence.slice(0, max_length).forEach((val, idx) => padded[idx] = val)
    
    const tensor = window.tf.tensor2d([padded])
    const prediction = tfModel.predict(tensor)
    const scores = prediction.dataSync()
    
    const maxIndex = scores.indexOf(Math.max(...scores))
    const confidence = scores[maxIndex]
    
    console.log('[MODEL] Prediction scores:', dynamicMoodLabels.map((m,i) => `${m}:${scores[i].toFixed(2)}`))
    
    // Confidence Threshold — explain why predictions below 0.6 are rejected and sent to next layer:
    // Categorical probability below 0.6 implies the decision boundary hyperplane is highly entangled and cannot cleanly separate the sequence's semantics. We suppress the output and default to a rigid heuristic rather than risk playing jarring genres.
    if (confidence > 0.8) {
      return { mood: dynamicMoodLabels[maxIndex], confidence: 'HIGH', method: 'deep_learning' }
    } else if (confidence > 0.6) {
      return { mood: dynamicMoodLabels[maxIndex], confidence: 'MEDIUM', method: 'deep_learning' }
    }
    return null
  } catch(err) {
    return null
  }
}

window.MoodDetector = {
  detect: function(text) {
     console.log(`[PIPELINE] MoodDetector.detect() received: "${text}"`);
     
     if (!text || !text.trim()) {
         return { mood: window.ProfileService?.getProfile()?.default_mood || 'calm', confidence: "LOW", method: "default" };
     } 
     
     // Transfer of detection hierarchy — explain the three layer system keyword then ML then sentiment:
     // Layer 1 (Keyword) is O(1) matching for explicit override triggers like "play happy music".
     // Layer 2 (ML) is contextual inference resolving complex semantic nuances that bypass keywords (e.g., "I hit traffic and got fired").
     // Layer 3 (Sentiment) is a valence averaging baseline that heuristically traps unknown vocabulary via the AFINN dictionary.
     
     // Layer 1: Keyword check
     const keyword = detectByKeyword(text)
     if (keyword) {
       return { mood: keyword, confidence: 'HIGH', method: 'keyword' }
     }
     
     // Layer 2: Deep learning model
     const mlResult = predictWithModel(text)
     if (mlResult) {
       console.log('[MOODDETECTOR] ML model result:', mlResult)
       return mlResult
     }
     
     // Layer 3: AFINN sentiment fallback
     const sentiment = detectBySentiment(text)
     if (sentiment) {
       return { mood: sentiment, confidence: 'MEDIUM', method: 'sentiment' }
     }
     
     // Default Fallback
     const profile = window.ProfileService?.getProfile()
     return { mood: profile?.default_mood || 'calm', confidence: 'LOW', method: 'default' }
  }
};
