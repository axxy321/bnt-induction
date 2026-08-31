import time
from playwright.sync_api import sync_playwright

def main():
    print("Launching Playwright Chromium...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_logs.append(f"[ERROR] {err}"))

        print("Navigating to https://driver-induction-platform.vercel.app ...")
        page.goto("https://driver-induction-platform.vercel.app", wait_until="networkidle")

        print("Clicking Compliance Manager tab...")
        page.click("button:has-text('Compliance Manager')")
        time.sleep(0.5)

        print("Entering credentials...")
        page.fill("input[type='email']", "admin@bntlogistics.com.au")
        page.fill("input[type='password']", "Param@2001")

        print("Submitting login form...")
        page.click("button[type='submit']")

        print("Waiting 5 seconds for navigation/state sync...")
        time.sleep(5)

        print("CONSOLE LOGS:")
        for log in console_logs:
            print("  ", log)

        body_html = page.content()
        print("\nPAGE CONTENT AFTER LOGIN (first 600 chars):")
        print(page.inner_text("body")[:600])

        page.screenshot(path="playwright_login_result.png")
        browser.close()

if __name__ == "__main__":
    main()
