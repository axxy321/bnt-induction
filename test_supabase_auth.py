import urllib.request
import json
import ssl

url = "https://wbrculvtacfkjzqhhoue.supabase.co/auth/v1/token?grant_type=password"
anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicmN1bHZ0YWNma2p6cWhob3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTA4NDgsImV4cCI6MjEwMDIyNjg0OH0.vxmD4mpvPaG0IhlS7i8FisLXRy6CZdq48ur_4Fr8KN4"

headers = {
    "Content-Type": "application/json",
    "apikey": anon_key,
}

data = json.dumps({
    "email": "admin@bntlogistics.com.au",
    "password": "Param@2001"
}).encode("utf-8")

req = urllib.request.Request(url, data=data, headers=headers, method="POST")
context = ssl._create_unverified_context()

try:
    with urllib.request.urlopen(req, context=context) as response:
        res_body = response.read().decode("utf-8")
        print("SUPABASE AUTH RESPONSE STATUS:", response.status)
        parsed = json.loads(res_body)
        print("ACCESS TOKEN:", parsed.get("access_token")[:30] + "...")
        print("USER ID:", parsed.get("user", {}).get("id"))
        print("USER ROLE METADATA:", parsed.get("user", {}).get("user_metadata"))
except Exception as e:
    print("SUPABASE AUTH ERROR:", e)
    if hasattr(e, "read"):
        print("ERROR DETAILS:", e.read().decode("utf-8"))
