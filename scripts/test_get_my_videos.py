import urllib.request
import ssl
import json
import sys

ctx = ssl._create_unverified_context()
url = 'https://ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/sql'
conn_str = 'postgresql://neondb_owner:npg_lCR4X7beoNKi@ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'

def execute_query(query, params=None):
    payload = {"query": query}
    if params:
        payload["params"] = params
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                 headers={'Content-Type': 'application/json', 'Neon-Connection-String': conn_str},
                                 method='POST')
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.read().decode()}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

email = 'jahargreaves@lineone.net'
user_id = '86a0c202-ee26-4ba3-8eef-70379da81a01'

query = f'''
    SELECT DISTINCT ON (p.id) 
           COALESCE(v.id::text, p.video_id) as id
    FROM purchases p
    LEFT JOIN videos v ON (p.video_id::text = v.id::text OR p.video_id::text = v.secure_slug::text)
    WHERE (
        p.user_id::text = '{user_id}' 
        OR LOWER(p.user_id) = LOWER((SELECT email FROM users WHERE id::text = '{user_id}' LIMIT 1))
    )
    AND (v.is_deleted IS NULL OR v.is_deleted = false)
    ORDER BY p.id, p.purchase_date DESC
'''
res = execute_query(query)
if 'message' in res and 'error' in res['message'].lower():
    print(f"API Error: {res}")
else:
    print(res.get('rows'))
