"""
Script Name: nja_waktu_solat_scraper_mora.py
Version: 1.10.0
Description: Ultimate ASP.NET Postback resilient extraction. Re-queries DOM locators dynamically after every dropdown change and mathematically validates scraped dates against the target month to entirely prevent ghost data.
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
    
    if not match:
        return text
        
    hour = int(match.group(1))
    minute = int(match.group(2))
    
    pm_prayers = ["zuhur", "asar", "maghrib", "isya"]
    
    if prayer_name.lower() in pm_prayers:
        if hour < 12:
            hour += 12
    else:
        if hour == 12:
            hour = 0

    return f"{hour:02d}:{minute:02d}"

def extract_prayer_times():
    url = "https://www.mora.gov.bn/SitePages/WaktuSembahyang.aspx"
    months = [
        "Januari", "Februari", "Mac", "April", "Mei", "Jun",
        "Julai", "Ogos", "September", "Oktober", "November", "Disember"
    ]
    
    year = sys.argv[1] if len(sys.argv) > 1 else str(datetime.now().year)
    print(f"Targeting year for extraction: {year}")
    
    structured_json = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        for month in months:
            print(f"Fetching data for {month} {year}...")
            
            page.goto(url, wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(3000)
            
            # 1. Select Zone
            try:
                for sel in page.locator("select").all():
                    if "Tutong" in sel.inner_text() and "Belait" in sel.inner_text():
                        for opt in sel.locator("option").all():
                            if "Brunei" in opt.inner_text():
                                sel.select_option(value=opt.get_attribute("value"))
                                page.wait_for_timeout(3000)
                                break
                        break
            except Exception as e:
                print(f"Zone selection error: {e}")

            # 2. Select Year (DOM must be requeried due to ASP.NET Postback)
            try:
                for sel in page.locator("select").all():
                    if year in sel.inner_text() and str(int(year)-1) in sel.inner_text():
                        for opt in sel.locator("option").all():
                            if year in opt.inner_text():
                                sel.select_option(value=opt.get_attribute("value"))
                                page.wait_for_timeout(3000)
                                break
                        break
            except Exception as e:
                print(f"Year selection error: {e}")

            # 3. Select Month
            try:
                for sel in page.locator("select").all():
                    if "Januari" in sel.inner_text() and "Disember" in sel.inner_text():
                        for opt in sel.locator("option").all():
                            if month.lower() == opt.inner_text().lower().strip():
                                sel.select_option(value=opt.get_attribute("value"))
                                page.wait_for_timeout(3000)
                                break
                        break
            except Exception as e:
                print(f"Month selection error: {e}")

            # 4. Trigger Submission
            try:
                btn = page.locator("input[value='Paparkan'], button:has-text('Paparkan'), input[type='submit']").first
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(6000) 
            except Exception as e:
                print(f"Button click error: {e}")

            # 5. Extract and Validate
            rows = page.locator("table tr").all()
            for row in rows:
                cols = row.locator("td, th").all()
                col_texts = [col.inner_text().strip() for col in cols]
                
                if len(col_texts) > 7 and col_texts[0] != "Title" and "-" in col_texts[1]:
                    idx_offset = None
                    
                    if re.match(r'\d{2}-\d{2}-\d{4}', col_texts[0]):
                        idx_offset = -1
                    elif re.match(r'\d{2}-\d{2}-\d{4}', col_texts[1]):
                        idx_offset = 0
                        
                    if idx_offset is not None:
                        formatted_date = col_texts[0] if idx_offset == -1 else col_texts[1]
                        hijrah = col_texts[1].strip() if idx_offset == -1 else col_texts[2].strip()
                        
                        date_parts = formatted_date.split("-")
                        if len(date_parts) == 3:
                            row_month = int(date_parts[1])
                            expected_month = months.index(month) + 1
                            
                            # Mathematical strict validation to entirely block ghost data
                            if row_month == expected_month and "Tarikh" not in formatted_date:
                                structured_json[formatted_date] = {
                                    "date_gregorian": formatted_date,
                                    "date_hijrah": hijrah,
                                    "imsak": parse_time_to_24h(col_texts[3 + idx_offset], "imsak"),
                                    "subuh": parse_time_to_24h(col_texts[4 + idx_offset], "subuh"),
                                    "syuruk": parse_time_to_24h(col_texts[5 + idx_offset], "syuruk"),
                                    "duha": parse_time_to_24h(col_texts[6 + idx_offset], "duha"),
                                    "zuhur": parse_time_to_24h(col_texts[7 + idx_offset], "zuhur"),
                                    "asar": parse_time_to_24h(col_texts[8 + idx_offset], "asar"),
                                    "maghrib": parse_time_to_24h(col_texts[9 + idx_offset], "maghrib"),
                                    "isya": parse_time_to_24h(col_texts[10 + idx_offset], "isya")
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
