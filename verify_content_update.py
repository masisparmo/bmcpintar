
from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # 1. Verify index.html (Info Modal)
    print("Verifying index.html...")
    page.goto("http://localhost:8000/index.html")
    # Open Info Modal
    page.evaluate("window.openInfo()")
    page.wait_for_selector("#infoModal")

    # Check for text
    expect(page.locator("#infoModal")).to_contain_text("Alat ini dikembangkan oleh Alexander Osterwalder")
    expect(page.locator("#infoModal")).to_contain_text("Tujuan Business Model Canvas")
    print("index.html content verified.")

    # 2. Verify panduan.html
    print("Verifying panduan.html...")
    page.goto("http://localhost:8000/panduan.html")

    # Check for text
    expect(page.locator("body")).to_contain_text("Alat ini dikembangkan oleh Alexander Osterwalder")
    expect(page.locator("body")).to_contain_text("Tujuan Business Model Canvas")
    print("panduan.html content verified.")

    # 3. Screenshot
    if not os.path.exists("verification"):
        os.makedirs("verification")
    page.goto("http://localhost:8000/panduan.html")
    page.screenshot(path="verification/panduan_content.png")

    page.goto("http://localhost:8000/index.html")
    page.evaluate("window.openInfo()")
    page.wait_for_timeout(500)
    page.screenshot(path="verification/index_modal_content.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
