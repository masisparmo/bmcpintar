
from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000")

    # 1. Verify Title
    expect(page).to_have_title("BMC Pro - Aplikasi Business Model Canvas powered by AI")
    print("Title verified.")

    # 2. Inject dummy history item using a more robust method
    # We rely on the app's db variable if available, or re-open carefully
    page.evaluate("""
        new Promise((resolve, reject) => {
            const req = indexedDB.open("SmartBMC_DB", 2);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction("history", "readwrite");
                const store = tx.objectStore("history");
                store.add({
                    id: 123456789,
                    name: "Test Project",
                    data: { bmcData: {} },
                    date: new Date().toISOString()
                });
                tx.oncomplete = resolve;
                tx.onerror = reject;
            };
            req.onerror = reject;
        })
    """)
    print("Injected dummy data.")

    # 3. Open History Modal
    # The desktop button has title="Riwayat"
    # Mobile button has just icon. Let's aim for the desktop one or just execute JS
    page.evaluate("window.openHistory()")

    # 4. Verify "Hapus Semua" button exists
    delete_all_btn = page.locator("button", has_text="Hapus Semua")
    expect(delete_all_btn).to_be_visible()
    print("Delete All button visible.")

    # 5. Verify History Item exists
    expect(page.locator("text=Test Project")).to_be_visible()
    print("History item visible.")

    # 6. Click Delete All and Handle Confirm
    page.on("dialog", lambda dialog: dialog.accept())
    delete_all_btn.click()

    # 7. Verify History Item is gone
    expect(page.locator("text=Test Project")).not_to_be_visible()
    expect(page.locator("text=Belum ada riwayat tersimpan.")).to_be_visible()
    print("History cleared.")

    # 8. Screenshot
    if not os.path.exists("verification"):
        os.makedirs("verification")
    page.screenshot(path="verification/history_cleared.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
