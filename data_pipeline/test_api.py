import asyncio
import aiohttp
import sys

async def test():
    async with aiohttp.ClientSession() as s:
        # Use contentId from the database. 11042533 is one of them from task-270 logs
        params = {
            'serviceKey': 'cc6abe5eff682d69f4534b0806ee7167aebd5bb578c85095a006fb69513f2dee',
            'MobileOS': 'ETC',
            'MobileApp': 'App',
            '_type': 'json',
            'contentId': '27445179',
            'contentTypeId': '39'
        }
        async with s.get('https://apis.data.go.kr/B551011/KorService1/detailIntro1', params=params) as r:
            print(await r.text())

if __name__ == '__main__':
    asyncio.run(test())
