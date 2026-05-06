from RPC_Params import RPC_IP, RPC_PASSWORD, RPC_USERNAME
from bitcoinrpc.authproxy import AuthServiceProxy
from state import TRANSACTION_STORE, CLIENT_TRACKER, CLIENT_LOCK,STORE_LOCK


#Does an RPC to bitcoin node to recieve transaction data
def fetch_transaction(txid, alpha):
    
    rpc = AuthServiceProxy(f"http://{RPC_USERNAME}:{RPC_PASSWORD}{RPC_IP}")
    
    try:
        tx_data = rpc.getrawtransaction(txid,True) 
        
        #Sends to function that will summarize the data
        summarized_json = summarize_transaction(tx_data,rpc, alpha)

        with STORE_LOCK:

            TRANSACTION_STORE[txid] = summarized_json

        with CLIENT_LOCK:

            CLIENT_TRACKER[txid] = 1
        
    except Exception as e:

        print(f"RPC error fetching Transaction {txid}: {e}")

def summarize_transaction(transaction_json,rpc, alpha):

    input_addresses = fetch_vin_addresses(transaction_json, rpc)

    #dict of required data to send to the front end
    is_coinbase = False

    if "coinbase" in transaction_json["vin"][0]:

        is_coinbase = True

    if is_coinbase:

        input_addresses =     [{

      "address": "COINBASE",

      "value": None
        }]
    else:

        input_addresses = fetch_vin_addresses(transaction_json, rpc)



    transaction_summary = {

        "txid": transaction_json["txid"],

        "confirmations": transaction_json.get("confirmations", -1),

        "inputs": input_addresses, 

        "outputs": [
            {
                "value": transaction_data.get("value", 0),

                "addresses": transaction_data["scriptPubKey"].get("addresses", [])

                or [transaction_data["scriptPubKey"].get("address")]  
            }
            for transaction_data in transaction_json.get("vout", [])
        ],
        "blockhash" : transaction_json.get("blockhash", "-1"),
        
        "time" : transaction_json.get("time", -1),

        "blocktime" : transaction_json.get("blocktime", -1),

        "alpha" : float(alpha),

        "probability" : float(-1)
    }
    if transaction_json.get("blocktime") == -1 and transaction_json.get("confirmations") == -1:

        transaction_summary["confirmations"] = 0

        try:

            mempool = rpc.getrawmempool(True)

        except Exception as e:

            print(f"Failed to fetch mempool: {e}")

        if transaction_json["txid"] in mempool:

            transaction_summary["time"] = mempool[transaction_json["txid"]]["time"]

            transaction_summary["blocktime"] = mempool[transaction_json["txid"]]["time"]
            
    return transaction_summary
    
    
#builds a store of wallets and bitcoin amounts associated with a Vin value
def fetch_vin_addresses(transaction_json, rpc):

    vin_wallet_data_store = []  

    #Fetch all the Vins for a given transaction
 
    
       
  
    for transaction in transaction_json.get("vin", []):
        try:

            if "txid" not in transaction:
                continue
            
            vout = transaction["vout"]
            vin_transaction = rpc.getrawtransaction(transaction["txid"],True)
            wallet_data = vout_data(vin_transaction, vout)
            
            if wallet_data:

                vin_wallet_data_store.extend(wallet_data)
    
        except Exception as e:
                
            print(f"Failed to fetch vin {transaction['txid']}: {e}")

    return vin_wallet_data_store               


    


#Grab Vout data from transaction for a given vin
def vout_data(vin_transaction, vout):
    
    for output in vin_transaction.get("vout", []):

        if output["n"] == vout:

            scriptPubKey = output.get("scriptPubKey", {})

            value = output.get("value")

            address = scriptPubKey.get("address") or (scriptPubKey.get("addresses") or [None])[0]

            if address:

                return [{"address": address, "value": float(value)}]
            
    return None









        


