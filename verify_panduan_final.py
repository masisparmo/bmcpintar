
from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000/panduan.html")

    # 1. Verify Title
    expect(page).to_have_title("Panduan Penggunaan - BMC Pro")
    print("Title verified.")

    # 2. Verify Images are NOT placehold.co
    images = page.locator("img.screenshot")
    count = images.count()
    print(f"Found {count} screenshots.")

    for i in range(count):
        src = images.nth(i).get_attribute("src")
        print(f"Image {i+1} src: {src}")
        if "placehold.co" in src:
            raise Exception(f"Image {i+1} is still a placeholder!")
        if "assets/guide" not in src:
             print(f"Warning: Image {i+1} might not be from guide assets: {src}")

    # 3. Screenshot
    if not os.path.exists("verification"):
        os.makedirs("verification")
    page.screenshot(path="verification/panduan_final.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
