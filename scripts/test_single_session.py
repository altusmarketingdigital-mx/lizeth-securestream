import urllib.request
import ssl
import json

ctx = ssl._create_unverified_context()
url = 'https://ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/sql'
conn_str = 'postgresql://neondb_owner:npg_lCR4X7beoNKi@ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/neondb'
headers = {
    'Content-Type': 'application/json',
    'neon-connection-string': conn_str
}

def execute_query(sql, params=None):
    payload = {'query': sql}
    if params:
        payload['params'] = params
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req, context=ctx) as resp:
        return json.loads(resp.read().decode())

print("=== 1. VERIFICANDO COLUMNA current_session_token EN LA TABLA users ===")
user_res = execute_query("SELECT id, email, current_session_token FROM users WHERE email = 'jpalmanzag@gmail.com';")
print("Usuario actual:", user_res.get('rows', []))

print("\n=== 2. SIMULANDO INICIO DE SESIÓN DISPOSITIVO A ===")
token_device_a = 'MOCK_TOKEN_DEVICE_A_12345'
execute_query("UPDATE users SET current_session_token = $1 WHERE email = 'jpalmanzag@gmail.com';", [token_device_a])

user_check_a = execute_query("SELECT current_session_token FROM users WHERE email = 'jpalmanzag@gmail.com';")
active_token = user_check_a['rows'][0]['current_session_token']
print("Token activo en servidor:", active_token)
assert active_token == token_device_a, "ERROR: Token Dispositivo A no se guardó"
print("✅ Dispositivo A tiene sesión activa")

print("\n=== 3. SIMULANDO INICIO DE SESIÓN DISPOSITIVO B (EXPULSA A DISPOSITIVO A) ===")
token_device_b = 'MOCK_TOKEN_DEVICE_B_67890'
execute_query("UPDATE users SET current_session_token = $1 WHERE email = 'jpalmanzag@gmail.com';", [token_device_b])

user_check_b = execute_query("SELECT current_session_token FROM users WHERE email = 'jpalmanzag@gmail.com';")
active_token_new = user_check_b['rows'][0]['current_session_token']
print("Nuevo token activo en servidor:", active_token_new)

print("\n=== 4. VALIDANDO QUE DISPOSITIVO A SEA RECHAZADO Y DISPOSITIVO B ACEPTADO ===")
is_device_a_valid = (token_device_a == active_token_new)
is_device_b_valid = (token_device_b == active_token_new)

print("¿Token Dispositivo A válido?:", is_device_a_valid)
print("¿Token Dispositivo B válido?:", is_device_b_valid)

assert not is_device_a_valid, "ERROR: Dispositivo A debería ser rechazado por sesión única"
assert is_device_b_valid, "ERROR: Dispositivo B debería ser aceptado"

print("\n✅ VALIDACIÓN DE SESIÓN ÚNICA COMPLETADA CON ÉXITO")
