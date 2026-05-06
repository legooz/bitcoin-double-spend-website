import asyncio
import json
import threading
import zmq
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from bitcoinrpc.authproxy import AuthServiceProxy
from contextlib import asynccontextmanager
from transaction_probability import update_probability
from RPC_Params import RPC_USERNAME, RPC_PASSWORD, RPC_IP,ZMQ_IP
from prob_history import build_probability_history
from data_processor import fetch_transaction
from state import CLIENT_LOCK,STORE_LOCK,TRANSACTION_STORE,CLIENT_TRACKER,CLEANUP_TASK
@asynccontextmanager

async def lifespan(app: FastAPI):

    #Start ZMQ listener in new thread
    #Listens for new blocks mined 

    threading.Thread(target=zmq_listener, daemon=True).start()

    yield

def zmq_listener():
    context = zmq.Context()

    socket = context.socket(zmq.SUB)

    socket.setsockopt_string(zmq.SUBSCRIBE, "hashblock")

    socket.connect(ZMQ_IP)

    print("Listening for blocks....")

    while True:

        socket.recv_multipart()               

        print("New block confirmed:")

        with STORE_LOCK:

            if TRANSACTION_STORE:

                for txid in TRANSACTION_STORE:
                
                    TRANSACTION_STORE[txid]["confirmations"] += 1


app = FastAPI(lifespan=lifespan)

@app.websocket("/probability/{txid}/{alpha}")

async def websocket_endpoint(websocket: WebSocket, txid: str, alpha: str):

    alpha = float(alpha)

    await websocket.accept()
    
    
    try:     
        sleep_time = 0.5

        print("Client connected")

        while True:

            tx_data = TRANSACTION_STORE.get(txid)

            if not tx_data:

                await websocket.close()

                return

            if tx_data.get("confirmations", 0) >= 100:

                await websocket.send_text(json.dumps(tx_data, default=float, indent=2))

                await websocket.close()

                return


            if tx_data.get("confirmations", 0) >= 50:

                sleep_time = 10

            else:

                sleep_time = 0.5

            probability = update_probability(tx_data, alpha)

            probability_json = json.dumps(probability, default=float, indent=2)

            await websocket.send_text(probability_json)

            await asyncio.sleep(sleep_time)

    except WebSocketDisconnect:
        with CLIENT_LOCK:

            CLIENT_TRACKER[txid] -= 1  
            
            existing = CLEANUP_TASK.get(txid)  

            if existing and not existing.done():
                print("Cleanup Task cancelled to renew for new task")
                existing.cancel()  
            
            CLEANUP_TASK[txid] = asyncio.create_task(store_cleanup(txid))
            print("CLEANUP TASK CREATED")
            print("Client disconnected")


#HTTP Endpoint that recieves TXID from client and sends a summarized version of the transaction data.
@app.get("/transaction")

async def txid_search(txid, alpha):
   
    with STORE_LOCK:

        if txid in TRANSACTION_STORE:
            print("txid is already in transaction store")
            
            with CLIENT_LOCK:

                CLIENT_TRACKER[txid] += 1

                existing_task = CLEANUP_TASK.pop(txid, None)


            if existing_task and not existing_task.done():

                existing_task.cancel()
                print("Cleanup Task Cancelled")
            return TRANSACTION_STORE[txid]

    await asyncio.to_thread(fetch_transaction, txid, alpha)

    with STORE_LOCK:

        if txid not in TRANSACTION_STORE:

            return None
        
        with CLIENT_LOCK:

            CLIENT_TRACKER[txid] += 1
            existing_task = CLEANUP_TASK.pop(txid, None)


        if existing_task and not existing_task.done():

            existing_task.cancel()
            print("CLEANUP TASK CANCELLED")

        return TRANSACTION_STORE[txid]
        

@app.get("/transaction/probability-history")

def tx_probability_history(

    txid: str,

    alpha: float = 0.2,

    lttb_threshold: int | None = None,
):
    rpc = AuthServiceProxy(f"http://{RPC_USERNAME}:{RPC_PASSWORD}{RPC_IP}")

    return build_probability_history(

        rpc,

        txid=txid,

        alpha=alpha,

        lttb_threshold=lttb_threshold,
    )


async def store_cleanup(txid: str, delay:float = 5.0):
    
    await asyncio.sleep(delay) 

    if CLIENT_TRACKER.get(txid, 0) < 1:

        CLIENT_TRACKER.pop(txid, None)

        with STORE_LOCK:

            TRANSACTION_STORE.pop(txid, None)




if __name__ == "__main__":
    

    uvicorn.run(app, host="0.0.0.0", port=8000)