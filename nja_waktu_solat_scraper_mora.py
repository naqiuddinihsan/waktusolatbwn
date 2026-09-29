"""
Script Name: nja_waktu_solat_scraper_mora.py
Version: 1.11.0
Description: Flawless ASP.NET extraction. Uses expect_navigation() to wait for KHEU server postbacks, entirely eliminating the "September only" ghost data bug.
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
    
    if prayer_name.lower() in ["zuhur", "asar", "maghrib", "isya"]:
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
        page = browser.new_page()
        page.goto(url, wait_until="networkidle", timeout=90000)
        
        for month in months:
            print(f"Fetching {month} {year}...")
            try:
                # Select Year
                for sel in page.locator("select").all():
                    if year in sel.inner_text() or str(int(year)-1) in sel.inner_text():
                        sel.select_option(label=year)
                        break
                page.wait_for_timeout(1000)
                
                # Select Month
                for sel in page.locator("select").all():
                    if "Januari" in sel.inner_text() and "Disember" in sel.inner_text():
                        sel.select_option(label=month)
                        break
                page.wait_for_timeout(1000)
                
                # Click Paparkan and strictly wait for ASP.NET Postback Navigation
                btn = page.locator("input[value='Paparkan'], button:has-text('Paparkan')").first
                with page.expect_navigation(timeout=30000):
                    btn.click()
                    
                # Buffer to let the DOM completely re-render the table
                page.wait_for_timeout(2000)
                
            except Exception as e:
                print(f"Failed to navigate {month}: {e}")
                continue
                
            rows = page.locator("table tr").all()
            for row in rows:
                cols = row.locator("td, th").all()
                col_texts = [col.inner_text().strip() for col in cols]
                
                if len(col_texts) > 7 and col_texts[0] != "Title" and "-" in col_texts[1]:
                    idx_offset = -1 if re.match(r'\d{2}-\d{2}-\d{4}', col_texts[0]) else 0 if re.match(r'\d{2}-\d{2}-\d{4}', col_texts[1]) else None
                    if idx_offset is not None:
                        formatted_date = col_texts[0] if idx_offset == -1 else col_texts[1]
                        hijrah = col_texts[1].strip() if idx_offset == -1 else col_texts[2].strip()
                        
                        # Safety: ensure we are looking at the exact month we requested to avoid any residual KHEU ghost rows
                        expected_month_num = months.index(month) + 1
                        try:
                            row_month = int(formatted_date.split("-")[1])
                            if row_month == expected_month_num:
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
                        except:
                            continue
                            
        browser.close()

    brunei_tz = timezone(timedelta(hours=8))
    structured_json["metadata"] = {"last_updated": datetime.now(brunei_tz).isoformat()}

    os.makedirs("data", exist_ok=True)
    with open("data/brunei_prayers.json", mode="w", encoding="utf-8") as f:
        json.dump(structured_json, f, indent=2, ensure_ascii=False)
        
    print("Extraction complete.")

if __name__ == "__main__":
    extract_prayer_times()
