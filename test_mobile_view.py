import time
from playwright.sync_api import sync_playwright

def main():
    print("Testing mobile viewport aspect ratios (393x852 iPhone 14 Pro)...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 393, "height": 852},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15"
        )
        page = context.new_page()

        page.goto("https://driver-induction-platform.vercel.app", wait_until="networkidle")
        time.sleep(2)

        page.screenshot(path="mobile_login_view.png")
        print("Captured mobile_login_view.png successfully.")

        page.click("button:has-text('Compliance Manager')")
        page.fill("input[type='email']", "admin@bntlogistics.com.au")
        page.fill("input[type='password']", "Param@2001")
        page.click("button[type='submit']")

        time.sleep(4)
        page.screenshot(path="mobile_dashboard_view.png")
        print("Captured mobile_dashboard_view.png successfully.")

        browser.close()

if __name__ == "__main__":
    main()
