"""
Script Name: nja_waktu_solat_scraper_mora.py
Version: 1.5.0
Description: Automates extraction of the full year prayer times from the MoRA Brunei portal. Smartly converts 12h times lacking AM/PM context into strict 24h format based on prayer identity.
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
    
    # Define which prayers happen in the afternoon/evening (PM)
    pm_prayers = ["zuhur", "asar", "maghrib", "isya"]
    
    if prayer_name.lower() in pm_prayers:
        # If it's a PM prayer, any hour less than 12 needs 12 added to it.
        # (e.g., 03:48 Asar -> 15:48. 12:27 Zuhur -> remains 12:27)
        if hour < 12:
            hour += 12
    else:
        # For AM prayers (Imsak, Subuh, Syuruk, Duha)
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
        page.goto(url, timeout=60000)
        
        try:
            page.select_option("select", label=year)
        except Exception:
            selects = page.locator("select").all()
            for sel in selects:
                options = sel.inner_text()
                if year in options:
                    sel.select_option(label=year)
                    break

        for month in months:
            print(f"Extracting prayer times for {month} {year}...")
            
            selects = page.locator("select").all()
            month_selected = False
            for sel in selects:
                options = sel.inner_text()
                if month in options:
                    sel.select_option(label=month)
                    month_selected = True
                    break
            
            if not month_selected:
                print(f"Could not find select dropdown for month: {month}")
                continue
                
            try:
                page.get_by_role("button", name="Paparkan").click()
            except Exception:
                page.locator("input[value='Paparkan'], button:has-text('Paparkan')").click()
                
            time.sleep(3)
            
            rows = page.locator("table tr").all()
            for row in rows:
                cols = row.locator("td, th").all()
                col_texts = [col.inner_text().strip() for col in cols]
                if col_texts and col_texts not in all_data:
                    all_data.append(col_texts)
                    
                    if len(col_texts) >= 11 and col_texts[0] != "Title":
                        raw_date = col_texts[1]
                        date_match = re.search(r'(\d{2}-\d{2}-\d{4})', raw_date)
                        if date_match:
                            formatted_date = date_match.group(1)
                            structured_json[formatted_date] = {
                                "date_gregorian": formatted_date,
                                "date_hijrah": col_texts[2].strip(),
                                # Pass the exact prayer name for smart 24h logic
                                "imsak": parse_time_to_24h(col_texts[3], "imsak"),
                                "subuh": parse_time_to_24h(col_texts[4], "subuh"),
                                "syuruk": parse_time_to_24h(col_texts[5], "syuruk"),
                                "duha": parse_time_to_24h(col_texts[6], "duha"),
                                "zuhur": parse_time_to_24h(col_texts[7], "zuhur"),
                                "asar": parse_time_to_24h(col_texts[8], "asar"),
                                "maghrib": parse_time_to_24h(col_texts[9], "maghrib"),
                                "isya": parse_time_to_24h(col_texts[10], "isya")
                            }
        
        browser.close()

    os.makedirs("data", exist_ok=True)

    json_file = "data/brunei_prayers.json"
    print(f"Saving structured data to {json_file}...")
    with open(json_file, mode="w", encoding="utf-8") as f:
        json.dump(structured_json, f, indent=2, ensure_ascii=False)
        
    print("Extraction complete.")

if __name__ == "__main__":
    extract_prayer_times()
