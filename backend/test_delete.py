import requests

# Login
res = requests.post('http://localhost:8000/api/auth/login/', json={"username": "admin", "password": "admin"}).json()
if "access" not in res:
    res = requests.post('http://localhost:8000/api/auth/login/', json={"username": "admin", "password": "admin123"}).json()
if "access" not in res:
    res = requests.post('http://localhost:8000/api/auth/login/', json={"username": "sandilya179", "password": "password"}).json()

if "access" not in res:
    print("Could not login. Res:", res)
    exit(1)

token = res['access']
headers = {"Authorization": f"Bearer {token}"}

# Get items
items = requests.get('http://localhost:8000/api/inventory/items/', headers=headers).json()
if isinstance(items, dict) and 'results' in items:
    items = items['results']

print(f"Found {len(items)} items")

if len(items) > 0:
    item_id = items[0]['id']
    # Try deleting it
    r = requests.delete(f'http://localhost:8000/api/inventory/items/{item_id}/', headers=headers)
    print(f"Delete item {item_id} status: {r.status_code}")
    if r.status_code != 204:
        print(r.text)
else:
    print("No items to delete")
