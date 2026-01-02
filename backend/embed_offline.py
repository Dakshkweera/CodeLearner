import os
import requests
from sentence_transformers import SentenceTransformer
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5002')

print("🚀 CodeLearner Offline Embedding Generator")
print("=" * 60)

# Initialize embedding model
print("\n🔄 Loading embedding model (all-MiniLM-L6-v2)...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Model loaded!")

# Step 1: Process repository via API (LOCAL endpoint)
print("\n" + "=" * 60)
print("STEP 1: Processing repository (LOCAL)...")
print("=" * 60)

repo_data = {
    "owner": "Dakshkweera",
    "name": "Smart-Traffic-Management-System-for-Jharkhand-Gov",
    "folder": None  # None = whole repo
}

print(f"\n📦 Repository: {repo_data['owner']}/{repo_data['name']}")
print(f"📁 Folder: {repo_data['folder']}")

try:
    response = requests.post(
        f"{BACKEND_URL}/api/rag/process-local",
        json=repo_data,
        timeout=300  # 5 minutes timeout
    )

    if response.status_code == 200:
        result = response.json()
        if result.get('cached'):
            print("✅ Repository already cached!")
            repo_id = result['data']['repoId']
        else:
            print("✅ Repository processed successfully (LOCAL)!")
            repo_id = result['data']['repoId']

        print(f"📌 Repository ID: {repo_id}")
        chunks_count = result['data']['chunksCount']
        print(f"📦 Total chunks: {chunks_count}")

    elif response.status_code == 429:
        print("⚠️ API rate limit hit (should not happen on LOCAL endpoint).")
        print("Continuing with embedding generation using existing data...")

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id FROM repositories 
            WHERE owner = %s AND name = %s AND folder IS NOT DISTINCT FROM %s
            ORDER BY created_at DESC LIMIT 1
            """,
            (repo_data['owner'], repo_data['name'], repo_data['folder'])
        )
        result = cur.fetchone()
        cur.close()
        conn.close()

        if result:
            repo_id = result[0]
            print(f"📌 Found Repository ID: {repo_id}")
        else:
            print("❌ Repository not found in database")
            exit(1)
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        exit(1)

except requests.exceptions.Timeout:
    print("⚠️ Request timed out - checking if chunks were saved...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id FROM repositories 
        WHERE owner = %s AND name = %s AND folder IS NOT DISTINCT FROM %s
        ORDER BY created_at DESC LIMIT 1
        """,
        (repo_data['owner'], repo_data['name'], repo_data['folder'])
    )
    result = cur.fetchone()
    cur.close()
    conn.close()

    if result:
        repo_id = result[0]
        print(f"✅ Found Repository ID: {repo_id}")
    else:
        print("❌ Repository not found")
        exit(1)

except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)

# Step 2: Get chunks that need embeddings
print("\n" + "=" * 60)
print("STEP 2: Fetching chunks...")
print("=" * 60)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute(
    """
    SELECT ce.id, ce.file_path, ce.function_name, ce.code_snippet
    FROM code_embeddings ce
    WHERE ce.repo_id = %s AND ce.embedding IS NULL
    """,
    (repo_id,)
)

chunks = cur.fetchall()

if not chunks:
    print("⚠️ No chunks found or all already embedded")
    cur.close()
    conn.close()
    exit(0)

print(f"📝 Found {len(chunks)} chunks to embed")

# Step 3: Generate embeddings
print("\n" + "=" * 60)
print("STEP 3: Generating embeddings...")
print("=" * 60)

texts = []
for chunk in chunks:
    chunk_id, file_path, function_name, code_snippet = chunk
    prefix = (
        f"File: {file_path}\nFunction: {function_name}\n\n"
        if function_name
        else f"File: {file_path}\n\n"
    )
    texts.append(prefix + code_snippet)

print(f"🔄 Generating {len(texts)} embeddings...")
embeddings = model.encode(texts, show_progress_bar=True)
print(f"✅ Generated {len(embeddings)} embeddings")

# Step 4: Save to database
print("\n" + "=" * 60)
print("STEP 4: Saving to database...")
print("=" * 60)

saved_count = 0
for i, chunk in enumerate(chunks):
    chunk_id = chunk[0]
    embedding_list = embeddings[i].tolist()

    try:
        cur.execute(
            """
            UPDATE code_embeddings
            SET embedding = %s::vector
            WHERE id = %s
            """,
            (str(embedding_list), chunk_id)
        )
        saved_count += 1
    except Exception as e:
        print(f"⚠️ Error saving chunk {chunk_id}: {e}")

conn.commit()
cur.close()
conn.close()

print(f"✅ Saved {saved_count}/{len(chunks)} embeddings to database!")

# Summary
print("\n" + "=" * 60)
print("✅ COMPLETE!")
print("=" * 60)
print(f"Repository: {repo_data['owner']}/{repo_data['name']}")
print(f"Folder: {repo_data['folder']}")
print(f"Repository ID: {repo_id}")
print(f"Embeddings generated: {saved_count}")
print("\n🎉 Your demo repository is ready for RAG queries!")
