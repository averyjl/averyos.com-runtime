import os
import subprocess
import hashlib

# ⛓️⚓⛓️ AveryOS Local Bridge
REPO_PATH = os.getcwd()
SALT_PATH = "D:\\.averyos-anchor-salt.aossalt"

def verify_physical_anchor():
    if not os.path.exists(SALT_PATH):
        print("❌ CRITICAL: Physical Anchor Missing. Bridge Terminated.")
        return False
    return True

def get_latest_git_log():
    log = subprocess.check_output(['git', 'log', '-1', '--pretty=format:%H']).decode()
    return log

def main():
    print("⛓️⚓⛓️ AveryOS Local Bridge Active...")
    if verify_physical_anchor():
        anchor_sha = get_latest_git_log()
        print(f"✅ Local Notarization Successful. Current Anchor: {anchor_sha}")
        # Logic to feed this anchor into Gemini/Ollama context

if __name__ == "__main__":
    main()
