from equations import p_double_spend_if_accepted_now
import time
def update_probability(transaction_json, alpha):

    calculated_probability = float(-1)
    is_coinbase = any(i.get("address") == "COINBASE" for i in transaction_json.get("inputs", []))
    if not is_coinbase:
    
        if transaction_json.get("blockhash") == -1 and transaction_json.get("confirmations") == -1:
            
            transaction_json["confirmations"] = 0

        blocktime = int(transaction_json["blocktime"])

        elapsed_time = max(0, time.time() - blocktime)
      
        calculated_probability = p_double_spend_if_accepted_now(elapsed_time,transaction_json["confirmations"], alpha)

    else:

        blocktime = int(transaction_json["blocktime"])

        elapsed_time = time.time() - blocktime

       
  
        
    
    
    probability_json = {

        "confirmations" : transaction_json.get("confirmations"),

        "probability" : calculated_probability,

        "Time" : elapsed_time
    }
     
    return probability_json