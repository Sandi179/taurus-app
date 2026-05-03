import requests
# login first
res = requests.post('http://localhost:8000/api/auth/login/', json={"username": "admin", "password": "admin123"}).json()
if "access" not in res:
    res = requests.post('http://localhost:8000/api/auth/login/', json={"username": "admin", "password": "admin"}).json()
token = res['access']

print("Token:", token[:20], "...")

# test export excel
headers = {"Authorization": f"Bearer {token}"}
r = requests.get('http://localhost:8000/api/reports/stock/?format=excel', headers=headers)
print("Stock Excel Status:", r.status_code)
if r.status_code != 200:
    print(r.text)

# test delete
r = requests.delete('http://localhost:8000/api/inventory/items/9999/', headers=headers)
print("Item 9999 Delete Status:", r.status_code)
if r.status_code != 204 and r.status_code != 404:
    print(r.text)
