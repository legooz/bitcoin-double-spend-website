import asyncio
import websockets
import uuid
import json
import requests
async def test(txid,alpha):
    url = f"http://127.0.0.1:8000/transaction?txid={txid}&alpha={alpha}"
    response = requests.get(url)  

    print(response.status_code)
    print(response.json())

    async with websockets.connect(f"ws://127.0.0.1:8000/probability/{txid}/{alpha}") as ws:

        
        y = 0
        
        
        while True:
           y += 1
        
           x = await ws.recv()
          
           
           tx_dict = json.loads(x)

           print(tx_dict.get("probability"))

           print(tx_dict.get("confirmations"))

           print("\n")

           if y == 10:
               break
           

   
 

                


async def main(txid):

    await test(txid,alpha=0.2)
    await test(txid, alpha = 0.4)
    await test(txid, alpha = 0.4)


txid = input("TXID: ")
asyncio.run(main(txid))