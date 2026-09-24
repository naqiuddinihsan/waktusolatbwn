"""
Script Name: mora_prayer_times_scraper.py
Version: 1.2.0
Description: Automates extraction of the full year prayer times from the MoRA Brunei portal and outputs both CSV and JSON formats.
"""

import csv
import json
import re
import time
from playwright.sync_api import sync_playwright

def parse_time_to_24h(raw_text):
    text = raw_text.strip()
    match = re.search(r'(\d{1,2})[.:](\d{2})', text)
    if not match:
        return text
    hour = int(match.group(1))
    minute = int(match.group(2))
    upper = text.upper()
    if "PETANG" in upper or "MALAM" in upper:
        if hour < 12:
            hour += 12
    elif "TENGAH HARI" in upper:
        if hour < 11:
            hour += 12
    elif "PAGI" in upper:
        if hour == 12:
            hour = 0
    return f"{hour:02d}:{minute:02d}"

def extract_prayer_times():
    url = "https://www.mora.gov.bn/SitePages/WaktuSembahyang.aspx"
    months = [
        "Januari", "Februari", "Mac", "April", "Mei", "Jun",
        "Julai", "Ogos", "September", "Oktober", "November", "Disember"
    ]
    year = "2026"
    
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
                                "imsak": parse_time_to_24h(col_texts[3]),
                                "subuh": parse_time_to_24h(col_texts[4]),
                                "syuruk": parse_time_to_24h(col_texts[5]),
                                "duha": parse_time_to_24h(col_texts[6]),
                                "zuhur": parse_time_to_24h(col_texts[7]),
                                "asar": parse_time_to_24h(col_texts[8]),
                                "maghrib": parse_time_to_24h(col_texts[9]),
                                "isya": parse_time_to_24h(col_texts[10])
                            }
                    
        browser.close()

    csv_file = "brunei_prayer_times_2026.csv"
    print(f"Saving extracted data to {csv_file}...")
    with open(csv_file, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(all_data)
        
    json_file = "brunei_prayers.json"
    print(f"Saving structured data to {json_file}...")
    with open(json_file, mode="w", encoding="utf-8") as f:
        json.dump(structured_json, f, indent=2, ensure_ascii=False)
        
    print("Extraction complete.")

if __name__ == "__main__":
    extract_prayer_times()
