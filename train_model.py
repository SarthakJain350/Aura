import os
import sys
import json
import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import Sequential
# Bidirectional LSTM - explain why bidirectional captures both past and future context in a sentence
# Bidirectional processing evaluates sequences forwards and backwards simultaneously, dramatically improving context abstraction of natural languages.
from tensorflow.keras.layers import Embedding, Bidirectional, LSTM, Dense, Dropout, GlobalMaxPooling1D
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import tensorflowjs as tfjs

emotion_to_mood = {
    # Happy/Positive
    'joy': 'happy',
    'happiness': 'happy',
    'happy': 'happy',
    'fun': 'happy',
    'enthusiasm': 'energetic',
    'love': 'calm',
    'relief': 'calm',
    
    # Sad
    'sadness': 'sad',
    'sad': 'sad',
    'empty': 'sad',
    
    # Angry
    'anger': 'angry',
    'angry': 'angry',
    'hate': 'angry',
    'disgust': 'angry',
    'disgusted': 'angry',
    
    # Stressed/Fearful
    'fear': 'stressed',
    'fearful': 'stressed',
    'worry': 'stressed',
    
    # Energetic
    'surprise': 'energetic',
    'surprised': 'energetic',
    
    # Calm/Neutral
    'neutral': 'calm',
    'calm': 'calm',

    # --- NEW MAPPINGS for expanded dataset coverage ---
    'excited': 'energetic',
    'excitement': 'energetic',
    'positive': 'happy',
    'negative': 'sad',
    'grief': 'sad',
    'contempt': 'angry',
    'bored': 'tired',
    'exhausted': 'tired',
    'love': 'romantic',
    'romantic': 'romantic',
    'melancholy': 'melancholic',
    'nostalgic': 'melancholic',
    'longing': 'melancholic',
    'admiration': 'happy',
    'amusement': 'happy',
    'approval': 'happy',
    'caring': 'romantic',
    'curiosity': 'focused',
    'desire': 'romantic',
    'disappointment': 'sad',
    'disapproval': 'angry',
    'embarrassment': 'stressed',
    'gratitude': 'happy',
    'nervousness': 'stressed',
    'optimism': 'happy',
    'pride': 'happy',
    'realization': 'focused',
    'remorse': 'sad',
    'confusion': 'stressed',
}

REQUIRED_FILES = {
    'data/emotions_nlp.csv': 'https://www.kaggle.com/datasets/praveengovi/emotions-dataset-for-nlp',
    'data/emotion_detection.csv': 'https://www.kaggle.com/datasets/pashupatigupta/emotion-detection-from-text',
    'data/emotions_in_text.csv': 'https://www.kaggle.com/datasets/ishantjuyal/emotions-in-text',
    'data/emotion_dataset.csv': 'https://www.kaggle.com/datasets/abdallahwagih/emotion-dataset',
    'data/emotion_stimulus.csv': 'https://www.kaggle.com/datasets/anjaneyatripathi/emotion-stimulus'
}

# New optional datasets — script will skip gracefully if not present
OPTIONAL_FILES = {
    'data/song_lyrics_emotion.csv': 'https://www.kaggle.com/datasets/elvis23/song-lyrics-emotion-dataset',
    'data/twitter_sentiment.csv': 'https://www.kaggle.com/datasets/saurabhshahane/twitter-sentiment-dataset',
    'data/reddit_sentiment.csv': 'https://www.kaggle.com/datasets/cosmos98/twitter-and-reddit-sentimental-analysis-dataset',
    'data/emotion_stimulus2.csv': 'https://www.kaggle.com/datasets/parulpandey/emotion-dataset',
    'data/go_emotions.csv': 'https://www.kaggle.com/datasets/shivamb/go-emotions-google-dataset',
}

def pre_flight_checks():
    missing = False
    if not os.path.exists('data'):
        os.makedirs('data')
        
    for filepath, url in REQUIRED_FILES.items():
        if not os.path.exists(filepath):
            print(f"[ERROR] Missing required dataset: {filepath}")
            print(f"        Please download it from: {url}")
            missing = True
    
    if missing:
        print("\n[ABORT] Please download all datasets listed above and rename them correctly into the data/ folder before running training.")
        sys.exit(1)

pre_flight_checks()

def load_dataset(filepath, text_col, label_col):
    try:
        df = pd.read_csv(filepath)
        df = df[[text_col, label_col]].copy()
        df.columns = ['text', 'emotion']
        df = df.dropna()
        print(f'Loaded {len(df)} rows from {filepath}')
        return df
    except Exception as e:
        print(f'Could not load {filepath}: {e}')
        return None

# Load all datasets — existing 5 (required)
datasets = []

d1 = load_dataset('data/emotions_nlp.csv', 'text', 'label')
if d1 is not None: datasets.append(d1)

d2 = load_dataset('data/emotion_detection.csv', 'content', 'sentiment')
if d2 is not None: datasets.append(d2)

d3 = load_dataset('data/emotions_in_text.csv', 'text', 'label')
if d3 is not None: datasets.append(d3)

d4 = load_dataset('data/emotion_dataset.csv', 'text', 'label')
if d4 is not None: datasets.append(d4)

d5 = load_dataset('data/emotion_stimulus.csv', 'text', 'label')
if d5 is not None: datasets.append(d5)

# New optional datasets (6-10) — skip silently if not downloaded yet
d6 = load_dataset('data/song_lyrics_emotion.csv', 'lyrics', 'emotion')
if d6 is not None: datasets.append(d6)

d7 = load_dataset('data/twitter_sentiment.csv', 'text', 'sentiment')
if d7 is not None: datasets.append(d7)

d8 = load_dataset('data/reddit_sentiment.csv', 'clean_text', 'category')
if d8 is not None: datasets.append(d8)

d9 = load_dataset('data/emotion_stimulus2.csv', 'text', 'label')
if d9 is not None: datasets.append(d9)

d10 = load_dataset('data/go_emotions.csv', 'text', 'labels')
if d10 is not None: datasets.append(d10)

# Combine all datasets. Why multiple datasets improve model generalization:
# Feeding the model contrasting lexical structures from varying sources prevents it from memorizing structural quirks specific to one single corpus.
combined = pd.concat(datasets, ignore_index=True)
print(f'Total combined rows: {len(combined)}')

combined = combined.drop_duplicates(subset='text')
combined['mood'] = combined['emotion'].str.lower().map(emotion_to_mood)
combined = combined.dropna(subset=['mood'])

print('Mood distribution before synthetic injection:')
print(combined['mood'].value_counts())

# --- SYNTHETIC DATA for underrepresented moods ---
# Why: real datasets rarely contain explicit energetic, tired, romantic, melancholic language.
# Adding hand-crafted sentences with 5x weight forces the model to learn these boundaries properly.
SYNTHETIC_DATA = {
    'energetic': [
        'I am so pumped up right now',
        'Lets go I am full of energy',
        'I feel like I can conquer the world',
        'I am buzzing with energy today',
        'Time to hit the gym I am fired up',
        'I am amped up and ready to go',
        'Feeling unstoppable today',
        'I have so much energy right now',
        'Beast mode activated',
        'I am on fire today',
        'High energy vibes only',
        'I am wired and ready',
        'Full power mode engaged',
        'I could run a marathon right now',
        'Crushing it today feeling amazing energy',
        'Pumped and ready to destroy this workout',
        'Electric energy flowing through me',
        'I am absolutely fired up today',
        'Maximum energy mode on',
        'Nothing can stop me today'
    ],
    'tired': [
        'I am so exhausted right now',
        'I can barely keep my eyes open',
        'I need to sleep so badly',
        'Running on empty today',
        'I am completely drained',
        'So tired cannot function',
        'Need a nap desperately',
        'Dead tired after today',
        'My energy is at zero',
        'I feel like a zombie today',
        'Cannot stop yawning today',
        'Absolutely worn out',
        'I have no energy left',
        'Barely awake right now',
        'Need rest so badly',
        'Heavy eyelids cannot stay awake',
        'Body is shutting down need sleep',
        'Dragging myself through the day',
        'Completely burnt out and exhausted',
        'Could fall asleep anywhere right now'
    ],
    'romantic': [
        'I am thinking about someone special',
        'Feeling so in love right now',
        'I miss my partner so much',
        'Romantic mood tonight',
        'Feeling lovey dovey today',
        'I want to listen to love songs',
        'Missing someone I care about deeply',
        'In the mood for romance',
        'Thinking about our first date',
        'Love is in the air tonight',
        'I have butterflies in my stomach',
        'My heart is full of love',
        'Feeling warm and romantic',
        'Want something soft and romantic',
        'Lost in thoughts about someone',
        'Deeply in love and feeling it',
        'My heart races when I think of them',
        'Longing for someone special tonight',
        'Love songs feel perfect right now',
        'Everything reminds me of someone I love'
    ],
    'melancholic': [
        'I miss how things used to be',
        'Feeling nostalgic about old memories',
        'Those were the good old days',
        'I keep thinking about the past',
        'Life felt simpler back then',
        'Missing people from my past',
        'Feeling bittersweet today',
        'Looking at old photos feeling nostalgic',
        'Remember when everything was easier',
        'I long for the old days',
        'Throwback feelings hitting hard',
        'Wistful about what used to be',
        'Old memories keep coming back',
        'Feeling that sweet sadness',
        'The past feels so distant now',
        'Reminiscing about better times',
        'A wave of nostalgia just hit me',
        'Sentimental and missing old friends',
        'Everything feels bittersweet tonight',
        'Lost in memories of a simpler time'
    ]
}

synthetic_rows = []
for mood_label, sentences in SYNTHETIC_DATA.items():
    for sentence in sentences:
        synthetic_rows.append({'text': sentence, 'mood': mood_label})

synthetic_df = pd.DataFrame(synthetic_rows)
# 5x weight for underrepresented moods ensures they get enough training coverage
synthetic_df = pd.concat([synthetic_df] * 5, ignore_index=True)
print(f'Added {len(synthetic_rows) * 5} weighted synthetic sentences for energetic/tired/romantic/melancholic')
combined = pd.concat([combined, synthetic_df], ignore_index=True)

print('\nFinal mood distribution (all moods must have >= 1000 samples):')
distrib = combined['mood'].value_counts()
print(distrib)
for mood_label, count in distrib.items():
    if count < 1000:
        print(f'[WARNING] Mood "{mood_label}" has only {count} samples — below 1000 threshold!')
    else:
        print(f'[OK] {mood_label}: {count} samples')

# Dataset Balancing - explain why equal class distribution prevents model bias:
# By capping each emotion to exactly the same maximum ceiling, the neural network cannot optimize its loss function by merely predicting the most common class.
balanced = combined.groupby('mood').apply(
    lambda x: x.sample(min(len(x), 5000), random_state=42)
).reset_index(drop=True)

print(f'Balanced dataset size: {len(balanced)}')

X = balanced['text'].astype(str).values
y = balanced['mood'].values

label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)
mood_labels = label_encoder.classes_.tolist()

vocab_size = 10000
max_length = 100

tokenizer = Tokenizer(num_words=vocab_size, oov_token="<OOV>")
tokenizer.fit_on_texts(X)

X_seq = tokenizer.texts_to_sequences(X)
X_pad = pad_sequences(X_seq, maxlen=max_length, padding='post')

X_train, X_test, y_train, y_test = train_test_split(X_pad, y_encoded, test_size=0.2, random_state=42)
num_moods = len(mood_labels)

# Build the Neural Network
# Embedding Layer - explain how words are mapped to dense vectors in continuous space:
# Instead of one-hot sparse mapping, embedding layers position tokens as coordinate vectors in a continuous space, placing semantically similar words geometrically closer together.
model = Sequential([
    Embedding(input_dim=vocab_size, output_dim=128, input_length=max_length),
    Bidirectional(LSTM(64, return_sequences=True)), # Reduced units to 64 to keep export size tiny (< 5MB)
    GlobalMaxPooling1D(),
    Dense(64, activation='relu'),
    Dropout(0.3),
    Dense(32, activation='relu'),
    Dropout(0.2),
    # Softmax Activation - explain why softmax is used for multi-class classification:
    # Softmax normalizes independent output layer logits into a joint probability distribution summing to 1.0, cleanly assigning exactly one peak categorical classification.
    Dense(num_moods, activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

# Early Stopping - explain how it prevents overfitting by monitoring validation loss:
# The algorithm strictly monitors cross-validation evaluations; if it observes the model memorizing the training data (overfitting) while loss degrades on the validation fold, it immediately aborts memory-wasteful epochs.
callbacks = [
    EarlyStopping(patience=3, restore_best_weights=True),
    ModelCheckpoint('model/model.h5', save_best_only=True)
]

if not os.path.exists('model'): os.makedirs('model')

print("\nStarting Training...")
history = model.fit(
    X_train, y_train,
    epochs=20,
    batch_size=64,
    validation_split=0.2,
    callbacks=callbacks
)

# Print final accuracy
final_val_acc = max(history.history["val_accuracy"])
print(f'\nTraining accuracy: {max(history.history["accuracy"]):.2%}')
print(f'Validation accuracy: {final_val_acc:.2%}')

if final_val_acc < 0.80:
    print("[WARNING] Validation accuracy is below 80%. Consider downloading more datasets to cover edge cases.")
else:
    print("[SUCCESS] Model accuracy is excellent.")

# Export for TensorFlow.js
tfjs.converters.save_keras_model(model, 'model/tfjs_model')

# Save tokenizer
tokenizer_json = {
    'word_index': tokenizer.word_index,
    'max_length': max_length,
    'mood_labels': mood_labels
}
with open('model/tokenizer.json', 'w') as f:
    json.dump(tokenizer_json, f)

# Save mood labels separately
with open('model/mood_labels.json', 'w') as f:
    json.dump(mood_labels, f)

def get_folder_size(folder):
    total = 0
    for dirpath, dirnames, filenames in os.walk(folder):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total += os.path.getsize(fp)
    return total

tfjs_size = get_folder_size('model/tfjs_model') / (1024 * 1024)
print(f'Exported TFJS Model Size: {tfjs_size:.2f} MB')

if tfjs_size > 10.0:
    print("[WARNING] Model size exceeds 10MB! It may load slowly in the browser. Consider reducing LSTM parameters.")

print('\nModel exported successfully')
print(f'Mood labels: {mood_labels}')
print('Place the model/ folder in your Aura/ directory if it is not already.')
print('Run python server.py to launch AURA with the new model')
