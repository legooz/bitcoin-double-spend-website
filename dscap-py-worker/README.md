# Python service
The python service is responsible for fetching transaction data from Bitcoin Core and processing the data to be sent to the front end.

## Main Features
- Fetch tx data via RPC to Bitcoin core
- Filter the data
- Send tx info to front end via http
- Calculate the probability of double spend and generate graphical data points
- send live probabilities to the front end 2x a second

# Libraries
- Uvicorn
- FastAPI
- BitcoinRPC
- ZMQ
- Math

## Important Files

- 'Routes.py' contains all the API endpoints used to communicate with the front end
- 'data_processor.py' filters the data and builds a JSON of the transaction information that will both be sent to the front end via http and used to calculate the double spend.
- 'equations.py' calculates the probability of a double spend
- 'transaction_probability.py' builds JSON of required live stream data such as probability, confirmation and time.
- 'prob_hisotry'.py generates data points for the front end graphs
- 'LTTB.py' is a helper for the graph data point generation