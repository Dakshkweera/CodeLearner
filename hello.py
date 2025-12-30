import os

# Define the output file name
output_file = "full_project_code.txt"

# Define folders to exclude (Standard junk folders)
exclude_dirs = {'.git', 'node_modules', '.next', 'dist', 'coverage', '_pycache_'}

# Define file extensions to look for. 
# I added .env, .gitignore, and .yml to make it more complete.
extensions = {'.ts', '.js', '.tsx', '.jsx', '.prisma', '.json', '.md', '.css', '.html', '.yml', '.yaml', '.env', '.gitignore'}

def merge_files():
    # 'w' mode overwrites the file if it exists
    with open(output_file, 'w', encoding='utf-8') as outfile:
        # Walk through the current directory
        for root, dirs, files in os.walk("."):
            # Remove excluded directories from the walk
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                # Check extension OR if it's a specific file with no extension (like Dockerfile)
                if any(file.endswith(ext) for ext in extensions) or file == 'Dockerfile':
                    
                    # specific exclusion
                    if file == "package-lock.json" or file == output_file:
                        continue

                    file_path = os.path.join(root, file)
                    
                    try:
                        outfile.write(f"\n{'='*50}\n")
                        outfile.write(f"FILE PATH: {file_path}\n")
                        outfile.write(f"{'='*50}\n\n")
                        
                        # errors='ignore' prevents crashing on weird characters (like emojis or images)
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as infile:
                            outfile.write(infile.read())
                            outfile.write("\n")
                            
                        print(f"Added: {file_path}")
                    except Exception as e:
                        print(f"Skipped {file_path} due to error: {e}")

# Fixed the double underscore syntax here
if __name__ == "__main__":
    merge_files()
    print(f"\nDone! All code is saved in {output_file}")