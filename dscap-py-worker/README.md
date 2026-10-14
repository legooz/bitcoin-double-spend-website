# Python service
The python service is responsible for fetching transaction data from Bitcoin Core and processing the data to be sent to the front end.

## Credentials and startup

This worker is retained for reference; the active application is in `backend/`
and `frontend/`. To run this legacy worker, supply both variables in its process
environment before starting `routes.py`:

| Variable | Required value |
| --- | --- |
| `DSCAP_RPC_USER` | Your Bitcoin Core RPC username |
| `DSCAP_RPC_PASSWORD` | Your Bitcoin Core RPC password |

There are no default credentials. Missing or blank values stop startup with the
missing variable's name; credential values are never included in that error.
The worker does not automatically load `backend/.env` or another `.env` file.
Keep credentials in your local environment or secret manager, never in tracked
source files. Use fresh, randomly generated URL-safe credentials for this legacy
client, which interpolates them into an RPC URL, and configure matching values
on your node. RPC and ZMQ endpoints still point to the loopback
addresses `127.0.0.1:8332` and `127.0.0.1:28332`.

Run the configuration tests without a node or worker runtime dependencies:

```sh
python -m unittest discover -s dscap-py-worker/tests -v
```

Run that command from the repository root.

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