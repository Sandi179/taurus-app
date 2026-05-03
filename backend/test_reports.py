import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.reports.views import build_excel, build_pdf

headers = ["Test"]
rows = [["Row 1"]]

try:
    build_excel("Test", headers, rows)
    print("EXCEL OK")
except Exception as e:
    print("EXCEL ERROR:", type(e), e)

try:
    build_pdf("Test", headers, rows)
    print("PDF OK")
except Exception as e:
    print("PDF ERROR:", type(e), e)
