"""
OpenPhish tester (free community feed).

Docs: https://openphish.com/phishing_feeds.html
Auth: none for the free delayed feed (plain text list of URLs).
Commercial real-time feed requires a key -> https://openphish.com/

Fetches the free feed and prints the first few entries.
"""

import requests

from _common import print_header, print_error, print_footer

URL = "https://openphish.com/feed.txt"


def main():
    print_header("OpenPhish (free feed)", URL)
    try:
        resp = requests.get(URL, timeout=10)
        print(f"Status code: {resp.status_code}")
        lines = resp.text.strip().splitlines()
        print(f"Total URLs in feed: {len(lines)}")
        print("Sample entries:")
        for line in lines[:5]:
            print(f"  - {line}")
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
