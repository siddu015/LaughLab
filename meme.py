import os
import pandas as pd
import numpy as np
from transformers import BertTokenizer, BertModel, pipeline
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from torchvision import models, transforms
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk.tokenize import word_tokenize
from nltk import pos_tag
import nltk
from PIL import Image
import torch
import matplotlib.pyplot as plt

# Download required NLTK resources


# Device setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Initialize sentiment analyzer
vader = SentimentIntensityAnalyzer()


class MemeRecommender:
    def __init__(self, dataset_path, image_dir):
        self.dataset_path = dataset_path
        self.image_dir = image_dir

        # Load models
        self.tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
        self.bert_model = BertModel.from_pretrained("bert-base-uncased").eval().to(device)
        self.distilbert_sentiment = pipeline("sentiment-analysis", model="distilbert-base-uncased", tokenizer="distilbert-base-uncased")
        self.resnet_model = models.resnet50(weights="IMAGENET1K_V1").eval().to(device)

        # Image preprocessing
        self.image_preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        # Load dataset
        self.df = self.load_dataset()

        # Scaling and PCA for feature dimensionality reduction
        self.text_scaler = StandardScaler()
        self.image_scaler = StandardScaler()
        self.pca = PCA(n_components=50)

        # Weight factors for feature combination
        self.alpha = 0.4  # Text feature weight
        self.beta = 0.4   # Image feature weight
        self.gamma = 0.2  # Sentiment weight

        # Preprocess features
        self.preprocess_features()

    def load_dataset(self):
        df = pd.read_csv(self.dataset_path)
        print("Dataset Loaded:")
        print(df.info())
        return df

    def preprocess_text(self, text):
        if pd.isnull(text):
            return ""
        return text.lower()

    def extract_text_features(self, text):
        text = self.preprocess_text(text)
        if not text:
            return np.zeros((1, 768))
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=128)
        inputs = {key: val.to(device) for key, val in inputs.items()}
        with torch.no_grad():
            outputs = self.bert_model(**inputs)
        return outputs.last_hidden_state[:, 0, :].cpu().numpy()

    def extract_text_sentiment(self, text):
        text = self.preprocess_text(text)
        if not text:
            return 0.0
        sentiment = self.distilbert_sentiment(text)[0]
        return sentiment['score'] if sentiment['label'] == 'POSITIVE' else -sentiment['score']

    def extract_image_features(self, image_filename):
        try:
            image_path = os.path.join(self.image_dir, image_filename.strip())
            if not os.path.exists(image_path):
                print(f"Image file not found: {image_path}")
                return np.zeros((1, 1000))

            image = Image.open(image_path).convert("RGB")
            input_tensor = self.image_preprocess(image).unsqueeze(0).to(device)
            with torch.no_grad():
                features = self.resnet_model(input_tensor)
            return features.cpu().numpy()
        except Exception as e:
            print(f"Error processing image: {image_filename}, Error: {e}")
            return np.zeros((1, 1000))

    def extract_image_sentiment(self, image_filename):
        description = self.df[self.df['image'] == image_filename]['text']
        if not description.empty:
            return self.extract_text_sentiment(description.iloc[0])
        return 0.0

    def preprocess_features(self):
        self.df["text"] = self.df["text"].apply(self.preprocess_text)
        self.df["text_features"] = self.df["text"].apply(self.extract_text_features)
        self.df["image_features"] = self.df["image"].apply(self.extract_image_features)
        self.df["text_sentiment"] = self.df["text"].apply(self.extract_text_sentiment)
        self.df["image_sentiment"] = self.df["image"].apply(self.extract_image_sentiment)

        # Normalize and combine features
        text_features = np.vstack(self.df["text_features"])
        image_features = np.vstack(self.df["image_features"])

        text_features_scaled = self.text_scaler.fit_transform(text_features)
        image_features_scaled = self.image_scaler.fit_transform(image_features)

        combined_features = np.hstack((
            text_features_scaled * self.alpha,
            image_features_scaled * self.beta
        ))

        # PCA reduction
        reduced_features = self.pca.fit_transform(combined_features)
        self.df["reduced_features"] = list(reduced_features)

    def recommend_memes(self, user_query, top_k=5, lambda_param=0.5):
        user_query = self.preprocess_text(user_query)
        query_features = self.extract_text_features(user_query)
        query_sentiment = self.extract_text_sentiment(user_query)
        query_features_scaled = self.text_scaler.transform(query_features)

        mean_image_features = np.mean(np.vstack(self.df["image_features"]), axis=0).reshape(1, -1)
        mean_image_features_scaled = self.image_scaler.transform(mean_image_features)

        query_combined_features = np.hstack((
            query_features_scaled * self.alpha,
            mean_image_features_scaled * self.beta
        ))
        query_reduced = self.pca.transform(query_combined_features)

        similarities = cosine_similarity(query_reduced, np.vstack(self.df["reduced_features"]))[0]
        sentiment_scores = np.abs(
            0.7 * self.df["text_sentiment"] + 0.3 * self.df["image_sentiment"] - query_sentiment
        )
        overall_scores = similarities - self.gamma * sentiment_scores

        # Apply Maximum Marginal Relevance (MMR) for diversity
        def mmr(documents, scores, lambda_param=0.5):
            selected = []
            while len(selected) < top_k:
                remaining = [i for i in range(len(documents)) if i not in selected]
                scores_with_diversity = [
                    lambda_param * scores[i]
                    - (1 - lambda_param) * max([scores[j] for j in selected] or [0])
                    for i in remaining
                ]
                selected.append(remaining[np.argmax(scores_with_diversity)])
            return selected

        selected_indices = mmr(self.df, overall_scores, lambda_param)
        return self.df.iloc[selected_indices]

    def visualize_recommendations(self, recommendations):
        print("Recommended Memes:")
        for idx, meme in recommendations.iterrows():
            print("Text:", meme["text"])
            print("Text Sentiment:", meme["text_sentiment"])
            print("Image Sentiment:", meme["image_sentiment"])
            try:
                image_path = os.path.join(self.image_dir, meme["image"])
                image = Image.open(image_path)
                plt.imshow(image)
                plt.title(meme["text"])
                plt.axis("off")
                plt.show()
            except Exception as e:
                print(f"Error displaying meme: {e}")

    def analyze_text_comparisons(self, user_query, top_k=5):
        # Tokenize and POS tag comparison
        user_tokens = word_tokenize(user_query)
        user_pos_tags = pos_tag(user_tokens)

        comparison_results = []
        for _, meme in self.df.iterrows():
            meme_text = meme["text"]
            meme_tokens = word_tokenize(meme_text)
            meme_pos_tags = pos_tag(meme_tokens)

            # Compare POS tags (grammar)
            pos_similarity = self.compare_pos_tags(user_pos_tags, meme_pos_tags)
            # Compare vocabulary (using common words)
            vocab_similarity = self.compare_vocabulary(user_tokens, meme_tokens)
            # Combine comparison results
            comparison_results.append({
                "meme_id": meme["id"],
                "text": meme["text"],
                "pos_similarity": pos_similarity,
                "vocab_similarity": vocab_similarity
            })

        comparison_results_sorted = sorted(comparison_results, key=lambda x: (x["pos_similarity"], x["vocab_similarity"]), reverse=True)
        return comparison_results_sorted[:top_k]

    def compare_pos_tags(self, user_pos_tags, meme_pos_tags):
        # Simple POS tag overlap
        user_pos_set = set(tag for _, tag in user_pos_tags)
        meme_pos_set = set(tag for _, tag in meme_pos_tags)
        return len(user_pos_set.intersection(meme_pos_set)) / len(user_pos_set.union(meme_pos_set))

    def compare_vocabulary(self, user_tokens, meme_tokens):
        # Compare vocabulary overlap
        user_vocab_set = set(user_tokens)
        meme_vocab_set = set(meme_tokens)
        return len(user_vocab_set.intersection(meme_vocab_set)) / len(user_vocab_set.union(meme_vocab_set))


# Example Usage:
dataset_path = "full_memes_dataset/label2.csv"
image_dir = "images/images"
recommender = MemeRecommender(dataset_path, image_dir)

user_query = "ironman"
recommendations = recommender.recommend_memes(user_query, top_k=5)

recommender.visualize_recommendations(recommendations)

