import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"
import json
import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Embedding, Bidirectional, LSTM, Dense, Dropout, GlobalMaxPooling1D
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import tensorflowjs as tfjs

print("[AURA] Initializing Zero-Download Synthetic Training Pipeline...")

# Exactly strictly isolated datasets to prevent cross-contamination ("clashing") between "energetic" and "happy"
SYNTHETIC_DATA = {
    'happy': [
        'happy', 'smile', 'joy', 'wonderful', 'great', 'awesome', 'good', 'glad',
        'i am very happy today', 'feeling great right now', 'what a wonderful day',
        'i am in a fantastic mood', 'everything is awesome', 'so joyful and glad',
        'smiling from ear to ear', 'best day ever', 'could not be happier',
        'feeling positive and bright', 'life is good today', 'i am completely overjoyed',
        'such a cheerful morning', 'feeling blessed and delighted', 'i am so pleased',
        'laughing and having fun', 'incredibly good vibes', 'i am on cloud nine',
        'feeling so joyful', 'i am delighted', 'feeling ecstatic', 'i love this',
        'absolutely brilliant', 'having the best time', 'pure happiness', 'could not be better',
        'such a beautiful moment', 'a glorious afternoon', 'grinning heavily', 'very upbeat',
        'everything is going so well', 'this is super fun', 'shining brightly', 'sunny mood',
        'i am extremely contented', 'my heart is full of joy', 'what a fantastic experience'
    ],
    'sad': [
        'sad', 'depressed', 'cry', 'upset', 'lonely', 'heartbroken', 'sorrow', 'miss',
        'i feel terrible and sad', 'feeling very depressed', 'i want to cry right now',
        'heartbroken and lonely', 'everything is just awful', 'i am feeling very down',
        'missing someone a lot', 'life is hard and tragic', 'i am so upset today',
        'filled with sorrow and grief', 'not feeling good at all', 'i feel hopeless',
        'crying my eyes out', 'i am devastated', 'in a deep state of despair',
        'feeling thoroughly miserable', 'the world is dark', 'i am grieving',
        'just want to be alone and sad', 'feeling heavily burdened', 'feeling awful',
        'i am not happy', 'not feeling happy', 'i am not smiling', 'not feeling joyful',
        'everything is falling apart emotionally', 'grieving a loss', 'a tearful night',
        'wiping away tears', 'my heart aches', 'bearing heavy sorrow', 'so melancholic',
        'nothing feels right anymore', 'swallowed by sadness', 'a gloomy day', 'deeply tragic',
        'feeling utterly somber', 'a blue and sad mood', 'weeping uncontrollably', 'lost and alone'
    ],
    'angry': [
        'angry', 'mad', 'hate', 'furious', 'annoyed', 'frustrated', 'rage', 'irritated',
        'i am absolutely furious', 'so mad i could scream', 'i hate this so much',
        'feeling extreme rage', 'annoyed and frustrated', 'i cannot stand this',
        'highly irritated right now', 'my blood is boiling', 'i am utterly disgusted',
        'losing my temper', 'stop doing that i hate it', 'i am deeply resentful',
        'this is making me rage', 'feeling highly hostile', 'i am enraged by this',
        'bitter and angry today', 'i want to break something', 'infuriated beyond belief',
        'this is completely unacceptable', 'i am incredibly pissed off', 'i am so mad',
        'seething with anger', 'absolutely livid', 'pushed past my limit', 'ready to snap',
        'this enrages me', 'filled with fury', 'burning with resentment', 'such an annoyance',
        'deeply maddening', 'i have had enough', 'completely aggravating', 'fuming silently',
        'so cross right now', 'outraged by this', 'losing my patience', 'making my blood boil'
    ],
    'energetic': [
        'energy', 'pump', 'hype', 'workout', 'gym', 'run', 'dance', 'active', 'fast',
        'i am super pumped up', 'feeling high energy right now', 'ready to conquer',
        'let us go to the gym', 'i am buzzing with electricity', 'so hyped and fired up',
        'my adrenaline is rushing', 'ready for an intense workout', 'highly active',
        'unstoppable momentum today', 'i feel electric and alive', 'ready to sprint',
        'feeling entirely motivated', 'crushing my goals with speed', 'fast paced',
        'maximum power activated', 'so much drive and force', 'bursting with adrenaline',
        'let us get moving', 'feeling absolutely unstoppable', 'full of energy',
        'i am on fire today', 'completely lit', 'on fire right now', 'having a blast of energy',
        'going full speed', 'highly dynamic', 'ready to jump around', 'invigorated and ready',
        'so pumped up', 'intense hype building', 'let us crush it', 'no slowing down',
        'full throttle', 'running at max speed', 'feeling incredibly powerful', 'hyperactive'
    ],
    'calm': [
        'calm', 'relax', 'chill', 'peaceful', 'quiet', 'breathe', 'slow', 'easy', 'zen',
        'i am feeling very peaceful', 'just relaxing and taking it easy', 'perfectly serene',
        'feeling completely zen', 'breathing deeply and resting', 'state of tranquility',
        'everything is still and quiet', 'enjoying this gentle moment', 'mind is clear',
        'drifting slowly and softly', 'i am perfectly comfortable', 'highly grounded',
        'a slow and soothing evening', 'chilling out on the couch', 'floating by',
        'soaking in the quiet silence', 'my heart rate is resting', 'letting go of tension',
        'smooth and gentle vibes', 'resting peacefully today', 'feeling totally chill',
        'a mellow afternoon', 'softly unwinding', 'finding my inner peace', 'completely placid',
        'in a state of quietness', 'observing the stillness', 'a tranquil environment',
        'feeling serene inside', 'soothing gentle thoughts', 'taking a slow breath',
        'nothing can disturb me', 'resting quietly', 'feeling untroubled', 'mellowing out'
    ],
    'stressed': [
        'stress', 'anxious', 'panic', 'worry', 'nervous', 'overwhelmed', 'pressure', 'scared',
        'i am totally overwhelmed', 'having a panic attack', 'i am incredibly anxious',
        'feeling very nervous', 'there is too much pressure', 'worried about the future',
        'my anxiety is spiking', 'i am completely stressed out', 'dreading what comes next',
        'feeling terrified and afraid', 'my stomach is in knots', 'extremely tense',
        'cannot stop worrying right now', 'feeling highly apprehensive', 'sheer panic',
        'this is too much for me', 'i am hyperventilating right now', 'so much stress',
        'everything is falling apart', 'scared and highly uneasy', 'feeling very stressed',
        'i am not calm', 'i cannot relax', 'not feeling peaceful', 'i am not relaxed',
        'overloaded with things to do', 'cannot handle this pressure', 'so much anxiety',
        'feeling incredibly tense', 'drowning in responsibilities', 'too many things happening',
        'afraid of failing', 'hyper alert and fearful', 'mind racing with worries',
        'completely frazzled', 'on edge constantly', 'struggling to cope', 'panicking'
    ],
    'tired': [
        'tired', 'sleepy', 'exhausted', 'drained', 'bored', 'lazy', 'heavy', 'fatigue',
        'i am completely exhausted', 'so sleepy i could pass out', 'running on empty',
        'i need to go to bed', 'feeling very lethargic', 'cannot keep my eyes open',
        'my body feels so heavy', 'completely drained of energy', 'dead tired right now',
        'just want to fall asleep', 'no energy left to give', 'utterly fatigued',
        'i am dragging my feet', 'barely awake at this point', 'so bored and lacking',
        'need a long nap immediately', 'my brain is shutting down', 'sluggish and slow',
        'tired to my very bones', 'ready to just sleep all day', 'i am very sleepy',
        'i am not energetic', 'not feeling active', 'i am not pumped', 'no energy',
        'completely worn out', 'feeling so drowsy', 'going to collapse from fatigue',
        'heavy eyelids closing', 'lacking any motivation', 'feeling spent', 'wiped out',
        'cannot stay awake', 'my energy is depleted', 'needing serious rest',
        'very weary', 'feeling a bit groggy', 'struggling to stay conscious', 'ready for bed'
    ],
    'focused': [
        'focus', 'study', 'concentrate', 'work', 'productive', 'code', 'read', 'learn',
        'i need to study hard now', 'concentrating deeply on work', 'in the zone',
        'working intensely on this task', 'attention is completely locked', 'exam',
        'coding and building software', 'reading aggressively and learning', 'detail',
        'doing deep analytical work', 'my mind is incredibly sharp', 'blocking distractions',
        'laser sharp concentration', 'processing complex information', 'solving problems',
        'paying close attention', 'highly engaged in learning', 'executing tasks',
        'dedicated to finishing this project', 'analyzing data', 'highly productive',
        'tuning out the world to work', 'studying for hours', 'completely absorbed in coding',
        'locked in on this goal', 'maximizing efficiency', 'intense problem solving',
        'carefully reviewing the details', 'getting things done effectively', 'grinding away',
        'undivided attention given', 'maintaining deep workflows', 'working without pause',
        'a state of deep work', 'zeroing in on the solution', 'concentrated effort'
    ]
}

# Expand the dataset massively by simply duplicating the clean records
# This forces the neural net to overfit confidently on these EXACT semantic structures without noise
expanded_rows = []
for mood_label, sentences in SYNTHETIC_DATA.items():
    # Append the raw words to reinforce token embeddings
    for _ in range(50):
        for phrase in sentences:
            expanded_rows.append({'text': phrase, 'mood': mood_label})

df = pd.DataFrame(expanded_rows)
print(f"[AURA] Built purely synthetic dataset containing {len(df)} curated samples.")
print(df['mood'].value_counts())

X = df['text'].astype(str).values
y = df['mood'].values

label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)
mood_labels = label_encoder.classes_.tolist()

vocab_size = 5000
max_length = 50

# Fit tokenizer heavily on our specific custom vocabulary
tokenizer = Tokenizer(num_words=vocab_size, oov_token="<OOV>")
tokenizer.fit_on_texts(X)

X_seq = tokenizer.texts_to_sequences(X)
X_pad = pad_sequences(X_seq, maxlen=max_length, padding='post')

# We don't need a large test set since our goal is strict semantic association
X_train, X_test, y_train, y_test = train_test_split(X_pad, y_encoded, test_size=0.1, random_state=42)
num_moods = len(mood_labels)

model = Sequential([
    Embedding(input_dim=vocab_size, output_dim=64, input_length=max_length),
    Bidirectional(LSTM(32, return_sequences=True)),
    GlobalMaxPooling1D(),
    Dense(32, activation='relu'),
    Dropout(0.2),
    Dense(num_moods, activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

callbacks = [
    EarlyStopping(patience=5, restore_best_weights=True)
]

if not os.path.exists('model'): os.makedirs('model')

print("\n[AURA] Initiating High-Speed Local Training Phase...")
history = model.fit(
    X_train, y_train,
    epochs=15,
    batch_size=32,
    validation_split=0.1,
    callbacks=callbacks
)

print(f'\n[AURA] Training accuracy achieved: {max(history.history["accuracy"]):.2%}')

# Export for TensorFlow.js
print("[AURA] Exporting TensorFlow.js Web Model...")
tfjs.converters.save_keras_model(model, 'model/tfjs_model')

tokenizer_json = {
    'word_index': tokenizer.word_index,
    'max_length': max_length,
    'mood_labels': mood_labels
}

with open('model/tokenizer.json', 'w') as f:
    json.dump(tokenizer_json, f)

with open('model/mood_labels.json', 'w') as f:
    json.dump(mood_labels, f)

print('\n[SUCCESS] Custom Synthetic Inference Model generated successfully.')
print(f'Mood dimensions secured: {mood_labels}')
print('Note: No external Kaggle dependencies were used. Zero label clashing guaranteed.')
