from playwright.sync_api import sync_playwright

def verify_chat_rendering():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the page
        page.goto('http://localhost:8080/index.html')

        # Reveal the analysis section
        page.evaluate("document.getElementById('analysisSection').classList.remove('hidden')")

        # Inject state with a long prompt to test wrapping
        long_prompt = """
Tentu, ini adalah prompt detail:

```markdown
**Prompt untuk Desain Packaging Peyek Jarak Jauh yang Aman dan Efektif**

Anda adalah seorang ahli desain kemasan yang fokus pada produk makanan rapuh.

**Konteks Bisnis Bu Sri:**
*   **Produk:** Peyek kacang renyah, gurih, lezat, dibuat dengan resep turun temurun.
*   **Tantangan Utama:** Peyek sangat mudah pecah/hancur dalam pengiriman.
*   **Sumber Daya:** Modal awal terbatas, produksi di rumah, peralatan sederhana.
*   **Target Pasar:** Pecinta camilan tradisional, individu/keluarga yang rindu kampung halaman.

**Tugas Anda:**
Berikan rekomendasi desain kemasan yang:
1.  Melindungi peyek dari benturan.
2.  Menjaga kerenyahan.
3.  Hemat biaya namun terlihat premium.
```
"""
        # We need to inject this into appState and re-render
        script = f"""
        appState.chatHistory.push({{role: 'user', content: 'Buatkan prompt packaging'}});
        appState.chatHistory.push({{role: 'ai', content: {repr(long_prompt)}}});
        renderChat();
        """
        page.evaluate(script)

        # Wait for rendering
        page.wait_for_timeout(1000)

        # Take screenshot of the chat area
        # We target the specific message bubble or the whole history container
        chat_history = page.locator('#chatHistory')
        chat_history.screenshot(path='verification/chat_fix.png')

        browser.close()

if __name__ == "__main__":
    verify_chat_rendering()
