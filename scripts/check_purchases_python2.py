import urllib.request
import urllib.error
import ssl
import json
import sys

ctx = ssl._create_unverified_context()
url = 'https://ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/sql'
conn_str = 'postgresql://neondb_owner:npg_lCR4X7beoNKi@ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'

def execute_query(query, params=None):
    payload = {
        "query": query,
        "connectionString": conn_str
    }
    if params:
        payload["params"] = params
        
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                 headers={'Content-Type': 'application/json'},
                                 method='POST')
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            res = json.loads(response.read().decode('utf-8'))
            return res.get('rows', [])
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"HTTP Error {e.code}: {e.reason}\\nResponse Body: {body}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

email = 'jahargreaves@lineone.net'
users = execute_query(f"SELECT id, name, email FROM users WHERE email = '{email}'")

if not users:
    print(f"Usuario {email} no encontrado.")
    sys.exit(0)

user_id = users[0]['id']
print(f"Usuario Encontrado: {users[0]}")

print("\\n--- COMPRAS DEL USUARIO (CON JOIN A VIDEOS ACTIVOS) ---")
purchases = execute_query(f'''
    SELECT p.id, p.created_at, v.title, v.id as video_id
    FROM purchases p
    JOIN videos v ON p.video_id = v.id
    WHERE p.user_id = '{user_id}'
''')
for p in purchases:
    print(p)

print("\\n--- TODAS LAS COMPRAS CRUDAS EN BD ---")
all_purchases = execute_query(f"SELECT * FROM purchases WHERE user_id = '{user_id}'")
for p in all_purchases:
    print(p)
