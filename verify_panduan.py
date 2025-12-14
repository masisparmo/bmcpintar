
from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000/panduan.html")

    # 1. Verify Title
    expect(page).to_have_title("Panduan Penggunaan - BMC Pro")
    print("Title verified.")

    # 2. Verify Sections exist (Using Heading to be specific)
    expect(page.get_by_role("heading", name="Cara Mendapatkan API Key Gratis")).to_be_visible()
    expect(page.get_by_role("heading", name="Mengisi Business Model Canvas")).to_be_visible()
    expect(page.get_by_role("heading", name="Fitur Canggih AI")).to_be_visible()
    print("Sections verified.")

    # 3. Test Dark Mode
    # Initial: Light mode
    page.screenshot(path="verification/panduan_light.png")

    # Toggle
    page.click("#themeIcon")
    page.wait_for_timeout(500) # Wait for transition

    # Screenshot Dark Mode
    page.screenshot(path="verification/panduan_dark.png")
    print("Screenshots taken.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
