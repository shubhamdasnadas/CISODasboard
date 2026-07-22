"""
IntelligenceX tester.

Docs: https://github.com/IntelligenceX/SDK/blob/master/Intelligence%20X%20API.pdf
Auth: header 'x-key: <your key>'
Get a key -> https://intelx.io/

Submits a search for a sample email/domain and prints matching results.
"""

import time

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_INTELLIGENCEX_API_KEY"
SEARCH_TERM = "example.com"  # sample term to search for
BASE_URL = "https://2.intelx.io"


def main():
    print_header("IntelligenceX", BASE_URL)
    headers = {"x-key": API_KEY, "Content-Type": "application/json"}

    search_payload = {
        "term": SEARCH_TERM,
        "maxresults": 5,
        "media": 0,
        "sort": 4,
    }
    try:
        resp = requests.post(
            f"{BASE_URL}/intelligent/search", json=search_payload, headers=headers, timeout=10
        )
        print("Search submission response:")
        print_result(resp)

        if resp.status_code == 200:
            search_id = resp.json().get("id")
            if search_id:
                time.sleep(2)
                result_resp = requests.get(
                    f"{BASE_URL}/intelligent/search/result",
                    params={"id": search_id},
                    headers=headers,
                    timeout=10,
                )
                print("Search results response:")
                print_result(result_resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
