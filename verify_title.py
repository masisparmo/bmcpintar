
from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000/index.html")

    # 1. Verify Title
    title = page.title()
    print(f"Page Title: '{title}'")

    expected_title = "BMC Pro - Aplikasi Business Model Canvas powered by AI"
    if title != expected_title:
        raise Exception(f"Title mismatch! Expected: '{expected_title}', Got: '{title}'")

    print("Title verified.")

    # 2. Screenshot
    if not os.path.exists("verification"):
        os.makedirs("verification")
    page.screenshot(path="verification/index_title.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
