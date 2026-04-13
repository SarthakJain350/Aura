# AURA Deep Learning Mood Detection Setup

This guide will walk you through exactly how to download the required datasets, train the deep learning model, and deploy it to AURA. **You do NOT need any machine learning experience to follow this.**

## Step 1: Install Requirements
1. Open your terminal in the Aura directory.
2. Run the following command to install all machine learning dependencies:
   ```bash
   pip install tensorflow tensorflowjs pandas numpy scikit-learn
   ```

## Step 2: Download the Datasets

### Required Datasets (5)
To train a highly intelligent model, we combine 5 different emotion datasets from Kaggle. Kaggle requires a free account to download datasets.

**Instructions for every dataset:**
1. Go to kaggle.com and create a free account if you do not have one.
2. Go to the dataset URL listed below.
3. Click the **Download** button (usually top right).
4. Extract the zip file you downloaded.
5. Create a folder named `data/` inside your main `Aura/` directory if it does not exist.
6. Rename the extracted CSV file exactly as specified below and place it in the `Aura/data/` folder.

| # | Dataset Link | Save As |
|---|--------------|---------|
| 1 | [NLP Emotions Dataset](https://www.kaggle.com/datasets/praveengovi/emotions-dataset-for-nlp) | `data/emotions_nlp.csv` |
| 2 | [Emotion Detection from Text](https://www.kaggle.com/datasets/pashupatigupta/emotion-detection-from-text) | `data/emotion_detection.csv` |
| 3 | [Emotions in Text](https://www.kaggle.com/datasets/ishantjuyal/emotions-in-text) | `data/emotions_in_text.csv` |
| 4 | [Emotion Dataset](https://www.kaggle.com/datasets/abdallahwagih/emotion-dataset) | `data/emotion_dataset.csv` |
| 5 | [Emotion Stimulus](https://www.kaggle.com/datasets/anjaneyatripathi/emotion-stimulus) | `data/emotion_stimulus.csv` |

*Verify*: Inside `Aura/data/`, you should have these 5 CSV files before training.

### Optional Datasets (6–10) — Improves Accuracy
These datasets are optional but significantly improve detection of complex moods (romantic, melancholic, energetic, tired). The training script will skip them gracefully if they are not present.

| # | Dataset Link | Save As | Expected Columns |
|---|--------------|---------|-----------------|
| 6 | [Song Lyrics Emotion Dataset](https://www.kaggle.com/datasets/elvis23/song-lyrics-emotion-dataset) | `data/song_lyrics_emotion.csv` | `lyrics`, `emotion` |
| 7 | [Twitter Sentiment Dataset](https://www.kaggle.com/datasets/saurabhshahane/twitter-sentiment-dataset) | `data/twitter_sentiment.csv` | `text`, `sentiment` |
| 8 | [Reddit Sentiment Dataset](https://www.kaggle.com/datasets/cosmos98/twitter-and-reddit-sentimental-analysis-dataset) | `data/reddit_sentiment.csv` | `clean_text`, `category` |
| 9 | [Parulpandey Emotion Dataset](https://www.kaggle.com/datasets/parulpandey/emotion-dataset) | `data/emotion_stimulus2.csv` | `text`, `label` |
| 10 | [GoEmotions Google Dataset](https://www.kaggle.com/datasets/shivamb/go-emotions-google-dataset) | `data/go_emotions.csv` | `text`, `labels` |

*Note: Even without the optional datasets, AURA uses 80 weighted synthetic sentences (5x amplified to 400 rows) to ensure the 4 new moods (energetic, tired, romantic, melancholic) always have sufficient training coverage.*

## Step 3: Run the Training Script
Once all 5 datasets are placed inside `Aura/data/`, execute the training script:
```bash
python train_model.py
```
* **Pre-check**: The script will verify all files exist before it begins. If a file is missing, it will tell you exactly which one.
* **Progress**: It will train for up to 20 Epochs, printing accuracy after each one.
* **Completion**: It will export the model to `Aura/model/tfjs_model/`.

*Note: Make sure your final Validation Accuracy is printed above 80%. If it is not, download more NLP datasets to supplement the training corpus.*

## Step 4: Test the Model Locally
Before testing the website interface, make sure the model works by running:
```bash
python test_model.py
```
This will print predicted labels for 10+ varied sentences.

## Step 5: Launch AURA
Once the `model/` folder is generated:
```bash
python server.py
```
Open `http://localhost:8888`. 
Press F12 to open the console and you will see `[MODEL] Loading trained emotion model...` followed by `Emotion model ready — deep learning active`.
