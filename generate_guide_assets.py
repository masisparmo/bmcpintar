
from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    page.goto("http://localhost:8000/index.html")

    # Helper to wait for animations
    def wait_ui():
        page.wait_for_timeout(500)

    print("Generating Shot 1: Overview...")
    wait_ui()
    page.screenshot(path="assets/guide/guide_step_1_overview.png")

    print("Generating Shot 2: API Key Settings...")
    page.evaluate("window.openSettings()")
    wait_ui()
    # Fill dummy key for visual
    page.fill("#apiKeyInput", "AIzaSyDummyKeyForScreenshotOnly")
    page.screenshot(path="assets/guide/guide_step_2_apikey.png")
    page.evaluate("window.closeModals()")
    wait_ui()

    print("Generating Shot 3: BMC Input...")
    # Click Customer Segments (cs)
    page.click(".area-cs")
    wait_ui()
    page.fill("#modalInput", "Mahasiswa\nPekerja WFH\nPecinta Kopi")
    page.screenshot(path="assets/guide/guide_step_3_bmc_modal.png")
    page.evaluate("window.closeModals()")
    wait_ui()

    print("Generating Shot 4: AI/Action Plan...")
    # Inject some state to make it look populated
    page.evaluate("""
        appState.actionPlan = `
### Minggu 1: Fondasi
- [ ] Riset Pasar
- [ ] Cari Supplier
### Minggu 2: Eksekusi
- [ ] Setup Toko
        `;
        appState.analysisHTML = "<p>Analisa bisnis menunjukkan potensi pasar yang kuat...</p>";
        window.saveState();
    """)
    page.evaluate("window.openActionPlan()")
    wait_ui()
    page.screenshot(path="assets/guide/guide_step_4_action_plan.png")
    page.evaluate("window.closeModals()")
    wait_ui()

    print("Generating Shot 5: History...")
    # Inject dummy history using Promise wrapper for safety
    page.evaluate("""
        new Promise((resolve, reject) => {
            const req = indexedDB.open("SmartBMC_DB", 2);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction("history", "readwrite");
                const store = tx.objectStore("history");
                store.put({
                    id: 1,
                    name: "Kopi Senja (Draft 1)",
                    date: new Date().toISOString(),
                    data: {}
                });
                store.put({
                    id: 2,
                    name: "Toko Hijab - Scaleup",
                    date: new Date(Date.now() - 86400000).toISOString(),
                    data: {}
                });
                tx.oncomplete = resolve;
                tx.onerror = reject;
            };
            req.onerror = reject;
        })
    """)
    page.wait_for_timeout(1000) # Wait for DB
    page.evaluate("window.openHistory()")
    wait_ui()
    # Wait for table to populate
    page.wait_for_selector("text=Kopi Senja (Draft 1)")
    page.screenshot(path="assets/guide/guide_step_5_history.png")

    browser.close()
    print("All screenshots generated.")

with sync_playwright() as playwright:
    run(playwright)
