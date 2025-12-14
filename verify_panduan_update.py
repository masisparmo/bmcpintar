
from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000/panduan.html")

    # 1. Verify Title
    expect(page).to_have_title("Panduan Penggunaan - BMC Pro")
    print("Title verified.")

    # 2. Verify New Section "Alur Singkat" exists
    expect(page.get_by_role("heading", name="Alur Singkat Penggunaan")).to_be_visible()
    print("New section verified.")

    # 3. Verify Images exist (placeholders)
    # Check if we have at least 5 images
    count = page.locator("img.screenshot").count()
    if count >= 5:
        print(f"Verified {count} placeholder screenshots present.")
    else:
        print(f"Warning: Only found {count} screenshots.")

    # 4. Screenshot
    if not os.path.exists("verification"):
        os.makedirs("verification")
    page.screenshot(path="verification/panduan_updated.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
