"""
Script Name: nja_waktu_solat_scraper_mora.py
Version: 1.7.0
Description: Ultra-resilient KHEU extraction. Forces Zone, Year, and Month individually inside the iteration loop to defeat ASP.NET AJAX resets that cause ghost zone drifting (e.g. Tutong defaults).
"""

import csv
import json
import re
import sys
import time
import os
from datetime import datetime
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
    
    all_data = []
    structured_json = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        print(f"Navigating to {url}")
        page.goto(url, timeout=90000)
        page.wait_for_timeout(5000)
        
        for month in months:
            print(f"Configuring portal for {month} {year} (Enforcing Brunei-Muara)...")
            
            # 1. Force District EVERY loop to prevent AJAX resets
            try:
                for sel in page.locator("select").all():
                    opts = sel.inner_text()
                    if "Tutong" in opts and "Belait" in opts:
                        for d in ["Brunei dan Muara", "Brunei-Muara", "Brunei & Muara"]:
                            if d in opts:
                                sel.select_option(label=d)
                                page.wait_for_timeout(2000)
                                break
            except Exception:
                pass
                
            # 2. Force Year EVERY loop
            try:
                for sel in page.locator("select").all():
                    if year in sel.inner_text() and str(int(year)-1) in sel.inner_text():
                        sel.select_option(label=year)
                        page.wait_for_timeout(2000)
            except Exception:
                pass
                
            # 3. Force Month
            try:
                for sel in page.locator("select").all():
                    opts = sel.inner_text()
                    if "Januari" in opts and "Disember" in opts:
                        sel.select_option(label=month)
                        page.wait_for_timeout(2000)
            except Exception:
                pass
                
            # Trigger table generation
            try:
                page.locator("input[value='Paparkan'], button:has-text('Paparkan'), input[type='submit']").first.click(force=True)
            except Exception:
                pass
                
            # Massive wait to let the POSTBACK table finish injecting
            page.wait_for_timeout(8000)
            
            rows = page.locator("table tr").all()
            for row in rows:
                cols = row.locator("td, th").all()
                col_texts = [col.inner_text().strip() for col in cols]
                if col_texts and col_texts not in all_data:
                    all_data.append(col_texts)
                    
                    if len(col_texts) > 7 and col_texts[0] != "Title" and "-" in col_texts[1]:
                        idx_offset = 0
                        formatted_date = ""
                        hijrah = ""
                        
                        if re.match(r'\d{2}-\d{2}-\d{4}', col_texts[0]):
                            idx_offset = -1
                            formatted_date = col_texts[0]
                            hijrah = col_texts[1].strip()
                        elif re.match(r'\d{2}-\d{2}-\d{4}', col_texts[1]):
                            idx_offset = 0
                            formatted_date = col_texts[1]
                            hijrah = col_texts[2].strip()
                            
                        if formatted_date:
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

    os.makedirs("data", exist_ok=True)
    json_file = "data/brunei_prayers.json"
    print(f"Saving bulletproof structured data to {json_file}...")
    with open(json_file, mode="w", encoding="utf-8") as f:
        json.dump(structured_json, f, indent=2, ensure_ascii=False)
        
    print("Extraction complete.")

if __name__ == "__main__":
    extract_prayer_times()
