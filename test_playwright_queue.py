import time
from playwright.sync_api import sync_playwright

def main():
    print("Testing Document Verification Queue tab on live site...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto("https://driver-induction-platform.vercel.app", wait_until="networkidle")
        page.click("button:has-text('Compliance Manager')")
        page.fill("input[type='email']", "admin@bntlogistics.com.au")
        page.fill("input[type='password']", "Param@2001")
        page.click("button[type='submit']")

        time.sleep(4)

        print("Clicking Document Verification Queue tab...")
        page.click("button:has-text('Document Verification Queue')")
        time.sleep(3)

        body_text = page.inner_text("body")
        print("\nVERIFICATION QUEUE PAGE CONTENT:")
        print(body_text[:700])

        assert "Failed to load verification queue" not in body_text, "Red error banner is still present!"
        print("\n✅ TEST PASSED! Verification Queue loaded without red error banner!")

        page.screenshot(path="verification_queue_result.png")
        browser.close()

if __name__ == "__main__":
    main()
