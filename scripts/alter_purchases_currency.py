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

# Paso 1: Agregar la columna
query1 = "ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency VARCHAR(10);"
res1 = execute_query(query1)
print(f"Add Column: {res1}")

# Paso 2: Backfill basado en la moneda de los videos. Asumimos 'MXN' si no hay coincidencia
query2 = '''
UPDATE purchases p
SET currency = COALESCE(v.currency, 'MXN')
FROM videos v
WHERE p.video_id::text = v.id::text OR p.video_id::text = v.secure_slug::text;
'''
res2 = execute_query(query2)
print(f"Backfill 1: {res2}")

# Paso 3: A los que aún estén nulos, ponerles MXN por defecto
query3 = "UPDATE purchases SET currency = 'MXN' WHERE currency IS NULL;"
res3 = execute_query(query3)
print(f"Backfill 2: {res3}")

print("Proceso de base de datos finalizado con éxito.")
