import json

with open("/Users/timtoole/.gemini/antigravity/brain/8cbee403-b081-408f-9913-f6604ac52203/.system_generated/logs/transcript.jsonl", "r") as f:
    for line in f:
        data = json.loads(line)
        content = data.get("content", "")
        if "Cameleer Production App Rebuild Mandate" in content:
            with open("mandate.txt", "w") as out:
                out.write(content)
            print("Wrote mandate to mandate.txt")
            break
