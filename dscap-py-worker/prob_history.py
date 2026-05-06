import math
import requests
from requests.auth import HTTPBasicAuth
from equations import p_double_spend_if_accepted_now
from LTTB import downsample_lttb, choose_lod_threshold
from RPC_Params import RPC_USERNAME, RPC_PASSWORD, RPC_IP, ZMQ_IP, RPC_URL

FIVE_HOURS_SECONDS = 5 * 60 * 60
ZERO_PROB_THRESHOLD = math.exp(-300)
ZERO_STREAK_REQUIRED = 500


def _table(columns, rows):
    return {
        "columns": columns,
        "rows": rows,
    }


def rpc_batch(payloads):
    response = requests.post(
        RPC_URL,
        auth=HTTPBasicAuth(RPC_USERNAME, RPC_PASSWORD),
        json=payloads,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()

    if not isinstance(data, list):
        raise ValueError(f"Expected batch response list, got: {data}")

    data.sort(key=lambda x: x["id"])

    for item in data:
        if item.get("error") is not None:
            raise ValueError(item["error"])

    return [item["result"] for item in data]


def _apply_lttb(rows: list[list[float]], requested_threshold: int | None = None) -> list[list[float]]:
    if not rows:
        return []

    lttb_input = [{"x": row[0], "y": row[1]} for row in rows]
    threshold = choose_lod_threshold(len(lttb_input), requested_threshold)
    sampled = downsample_lttb(lttb_input, threshold)
    return [[point["x"], point["y"]] for point in sampled]


def _build_first_5h_rows_per_second(confirmation_rows: list[list[float]], alpha: float) -> list[list[float]]:
    if not confirmation_rows:
        return []

    first_5h_limit = min(FIVE_HOURS_SECONDS, int(confirmation_rows[-1][0]))
    rows = []
    point_index = 0

    for elapsed_seconds in range(first_5h_limit + 1):
        while (
            point_index + 1 < len(confirmation_rows)
            and confirmation_rows[point_index + 1][0] <= elapsed_seconds
        ):
            point_index += 1

        confirmations = int(confirmation_rows[point_index][1])

        probability = float(
            p_double_spend_if_accepted_now(
                elapsed_seconds,
                confirmations,
                alpha,
            )
        )
        rows.append([float(elapsed_seconds), probability])

    return rows


def build_probability_history(rpc, txid: str, alpha: float = 0.2, lttb_threshold: int | None = None, batch_size: int = 500) -> dict:
    tx = rpc.getrawtransaction(txid, True)
    blockhash = tx.get("blockhash")
    if not blockhash:
        raise ValueError("Transaction is not confirmed yet.")

    inclusion_block = rpc.getblockheader(blockhash)
    start_height = inclusion_block["height"]
    start_time = inclusion_block["time"]
    tip_height = rpc.getblockcount()

    confirmation_rows = []
    full_graph_rows = []

    zero_streak = 0
    stopped_early = False

    for chunk_start in range(start_height, tip_height + 1, batch_size):
        chunk_end = min(chunk_start + batch_size - 1, tip_height)
        heights = list(range(chunk_start, chunk_end + 1))

        hash_payloads = [
            {
                "jsonrpc": "1.0",
                "id": i,
                "method": "getblockhash",
                "params": [height],
            }
            for i, height in enumerate(heights)
        ]
        blockhashes = rpc_batch(hash_payloads)

        header_payloads = [
            {
                "jsonrpc": "1.0",
                "id": i,
                "method": "getblockheader",
                "params": [blockhash],
            }
            for i, blockhash in enumerate(blockhashes)
        ]
        headers = rpc_batch(header_payloads)

        for header in headers:
            height = header["height"]
            block_time = header["time"]
            elapsed_seconds = block_time - start_time
            confirmations = height - start_height + 1

            probability = float(
                p_double_spend_if_accepted_now(
                    elapsed_seconds,
                    confirmations,
                    alpha,
                )
            )

            confirmation_rows.append([
                elapsed_seconds,
                confirmations,
                height,
                block_time,
                probability,
            ])

            full_graph_rows.append([elapsed_seconds, probability])

            if probability <= ZERO_PROB_THRESHOLD:
                zero_streak += 1
            else:
                zero_streak = 0

            # early stopping only matters for full history,
            # and must not happen before we cover the first 5 hours
            if elapsed_seconds >= FIVE_HOURS_SECONDS and zero_streak >= ZERO_STREAK_REQUIRED:
                stopped_early = True
                break

        if stopped_early:
            break

    if stopped_early:
        tip_blockhash = rpc.getblockhash(tip_height)
        tip_header = rpc.getblockheader(tip_blockhash)
        tip_elapsed_seconds = tip_header["time"] - start_time

        if not full_graph_rows or full_graph_rows[-1][0] != tip_elapsed_seconds:
            full_graph_rows.append([tip_elapsed_seconds, 0.0])

    else:
        if confirmation_rows:
            tip_elapsed_seconds = confirmation_rows[-1][0]
            tip_probability = confirmation_rows[-1][4]
            if not full_graph_rows or full_graph_rows[-1] != [tip_elapsed_seconds, tip_probability]:
                full_graph_rows.append([tip_elapsed_seconds, tip_probability])

    full_graph_rows = _apply_lttb(full_graph_rows, lttb_threshold)

    first_5h_rows = _build_first_5h_rows_per_second(confirmation_rows, alpha)
    first_5h_rows = _apply_lttb(first_5h_rows, lttb_threshold)

    return {
        "txid": txid,
        "included_block_height": start_height,
        "included_block_time": start_time,
        "alpha": alpha,
        "views": {
            "full_graph": _table(
                ["elapsed_seconds", "probability"],
                full_graph_rows,
            ),
            "first_5h": _table(
                ["elapsed_seconds", "probability"],
                first_5h_rows,
            ),
        },
    }