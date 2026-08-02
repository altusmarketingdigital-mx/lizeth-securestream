import urllib.request
import ssl
import json
import sys

ctx = ssl._create_unverified_context()
url = 'https://ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/sql'
conn_str = 'postgresql://neondb_owner:npg_lCR4X7beoNKi@ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'

def execute_query(query):
    payload = {"query": query}
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                 headers={'Content-Type': 'application/json', 'Neon-Connection-String': conn_str},
                                 method='POST')
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()}

# Query to get the columns of the purchases table
query = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchases';"
res = execute_query(query)
if 'error' in res:
    print(f"API Error: {res}")
else:
    for row in res.get('rows', []):
        print(f"{row['column_name']} - {row['data_type']}")
