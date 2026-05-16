import boto3

client = boto3.client(
    service_name="bedrock-runtime",
    region_name="us-east-1"
)

response = client.converse(
    modelId="us.anthropic.claude-sonnet-4-20250514-v1:0",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "text": "hello"
                }
            ]
        }
    ]
)

print(response["output"]["message"]["content"][0]["text"])