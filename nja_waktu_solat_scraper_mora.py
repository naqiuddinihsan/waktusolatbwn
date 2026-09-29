"""
Script Name: nja_waktu_solat_scraper_mora.py
Version: 1.12.0
Description: Bulletproof ASP.NET AJAX extraction. Uses hard timeouts instead of navigation locks to prevent timeouts, and utilizes strict index-based column mapping to absolutely prevent data drifting.
"""

import json
import re
import sys
import os
from datetime import datetime, timezone, timedelta
from playwright.sync_api import sync_playwright

def parse_time_to_24h(raw_text, prayer_name):
    text = raw_text.strip()
    match = re.search(r'(\d{1,2})[.:](\d{2})', text)
    if not match: return text
    
    hour = int(match.group(1))
    minute = int(match.group(2))
    
    pm_prayers = ["zuhur", "asar", "maghrib", "isya"]
    if prayer_name.lower() in pm_prayers:
        if hour < 12: hour += 12
    else:
        if hour == 12: hour = 0
        
    return f"{hour:02d}:{minute:02d}"

def extract_prayer_times():
    url = "https://www.mora.gov.bn/SitePages/WaktuSembahyang.aspx"
    months = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"]
    
    year = sys.argv[1] if len(sys.argv) > 1 else str(datetime.now().year)
    print(f"Targeting year: {year}")
    
    structured_json = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        for month in months:
            print(f"Fetching data for {month} {year}...")
            
            # Hard reload to reset ASP.NET state for every month
            page.goto(url, wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(3000)
            
            # 1. Select Zone
            try:
                for sel in page.locator("select").all():
                    opts = sel.inner_text()
                    if "Tutong" in opts:
                        for label in ["Brunei dan Muara", "Brunei-Muara", "Brunei & Muara"]:
                            if label in opts:
                                sel.select_option(label=label)
                                page.wait_for_timeout(2000)
                                break
                        break
            except Exception as e:
                print(f"Zone set error: {e}")

            # 2. Select Year
            try:
                for sel in page.locator("select").all():
                    if year in sel.inner_text() and str(int(year)-1) in sel.inner_text():
                        sel.select_option(label=year)
                        page.wait_for_timeout(2000)
                        break
            except Exception as e:
                print(f"Year set error: {e}")

            # 3. Select Month
            try:
                for sel in page.locator("select").all():
                    if "Januari" in sel.inner_text() and "Disember" in sel.inner_text():
                        sel.select_option(label=month)
                        page.wait_for_timeout(2000)
                        break
            except Exception as e:
                print(f"Month set error: {e}")

            # 4. Trigger Submission (No expect_navigation to prevent timeout crash)
            try:
                btn = page.locator("input[value='Paparkan'], button:has-text('Paparkan'), input[type='submit']").first
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(6000) # Hard wait for AJAX table render
            except Exception as e:
                print(f"Button click error: {e}")

            # 5. Extract and STRICTLY Validate
            rows = page.locator("table tr").all()
            for row in rows:
                cols = row.locator("td, th").all()
                col_texts = [col.inner_text().strip() for col in cols]
                
                # Strict Index Locating: Find exactly where the date is, ignore all offset guessing
                date_index = -1
                for i, text in enumerate(col_texts):
                    if re.match(r'^\d{2}-\d{2}-\d{4}$', text):
                        date_index = i
                        break
                        
                if date_index != -1 and len(col_texts) >= date_index + 10:
                    formatted_date = col_texts[date_index]
                    row_month = int(formatted_date.split("-")[1])
                    expected_month_num = months.index(month) + 1
                    
                    # Ensure we are saving data for the correct month and haven't captured ghost rows
                    if row_month == expected_month_num:
                        structured_json[formatted_date] = {
                            "date_gregorian": formatted_date,
                            "date_hijrah": col_texts[date_index + 1],
                            "imsak": parse_time_to_24h(col_texts[date_index + 2], "imsak"),
                            "subuh": parse_time_to_24h(col_texts[date_index + 3], "subuh"),
                            "syuruk": parse_time_to_24h(col_texts[date_index + 4], "syuruk"),
                            "duha": parse_time_to_24h(col_texts[date_index + 5], "duha"),
                            "zuhur": parse_time_to_24h(col_texts[date_index + 6], "zuhur"),
                            "asar": parse_time_to_24h(col_texts[date_index + 7], "asar"),
                            "maghrib": parse_time_to_24h(col_texts[date_index + 8], "maghrib"),
                            "isya": parse_time_to_24h(col_texts[date_index + 9], "isya")
                        }
        
        browser.close()

    brunei_tz = timezone(timedelta(hours=8))
    structured_json["metadata"] = {
        "last_updated": datetime.now(brunei_tz).isoformat()
    }

    os.makedirs("data", exist_ok=True)
    json_file = "data/brunei_prayers.json"
    print(f"Saving bulletproof structured data to {json_file}...")
    with open(json_file, mode="w", encoding="utf-8") as f:
        json.dump(structured_json, f, indent=2, ensure_ascii=False)
        
    print("Extraction complete.")

if __name__ == "__main__":
    extract_prayer_times()
