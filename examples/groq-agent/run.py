"""A real agent call through 0xNexigent; it never calls upstream directly."""
import os
import sys
from openai import OpenAI
from openai import APIStatusError

gateway_url = "https://api.openai.com/v1"
agent_key = "sk-dummy-key-replace-me"


# 1. Initialize the OFFICIAL OpenAI SDK
# MAGIC MOMENT: The developer just changes `base_url` to 0xNexigent!
client = OpenAI(
    api_key=agent_key, 
    base_url=gateway_url
)

print(f"🚀 Initializing interactive chat through 0xNexigent Gateway ({gateway_url})...")
print("Type 'exit' to quit.\n")

session_id = "live-pitch-session-1"

while True:
    try:
        user_input = input("You: ")
        if user_input.strip().lower() == 'exit':
            break
            
        # 2. Call chat completions normally but grab the raw HTTP response to see Nexigent's custom headers
        raw_response = client.chat.completions.with_raw_response.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": user_input}],
            max_tokens=200,
            extra_body={"session_id": session_id}
        )
        
        # Parse the JSON response
        completion = raw_response.parse()
        
        # Read the transparent routing headers injected by 0xNexigent!
        decision = raw_response.headers.get('x-nexigent-decision', 'UNKNOWN')
        actual_model = raw_response.headers.get('x-nexigent-selected-model', 'UNKNOWN')
        
        if decision == "REROUTE":
            print(f"\n⚠️ [0xNexigent]: Budget constraint detected! Seamlessly rerouted to cheaper model: {actual_model}")
        else:
            print(f"\n✅ [0xNexigent]: Request ALLOWED. Executed on {actual_model}")
            
        print(f"Agent: {completion.choices[0].message.content}\n")
        
    except APIStatusError as e:
        print(f"\n❌ [0xNexigent BLOCK]: Request failed with status code {e.status_code}")
        print(f"Message: {e.response.json().get('error', {}).get('message', str(e))}\n")
        break
    except Exception as e:
        print(f"\n⚠️ Error: {str(e)}\n")
        break
