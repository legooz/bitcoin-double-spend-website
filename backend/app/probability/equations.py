"""Double-spend probability math.

This is the analytical core of the project, ported unchanged from the original
capstone. Given how long a transaction has been visible (``t_seconds``), how
many confirmations it has (``n``), and the attacker's assumed share of network
hash power (``alpha``), it returns the probability that an attacker could still
build a longer chain and reverse the transaction.

The computation is done in log-space to stay numerically stable when the
probability becomes astronomically small.
"""
from __future__ import annotations

import math

from scipy.stats import poisson

# Beyond this many confirmations the double-spend probability is negligibly
# small (effectively zero). The computation below is O(n) in confirmations, so
# callers cap the confirmation count at this value before computing — otherwise
# a deeply-confirmed transaction (hundreds of thousands of confirmations) would
# take seconds to evaluate for a result that is zero either way.
NEGLIGIBLE_CONFIRMATION_CAP = 100


def _log_poisson_pmf(k: int, mu: float) -> float:
    if k < 0:
        return float("-inf")
    if mu < 0:
        raise ValueError("mu must be non-negative.")
    if mu == 0:
        return 0.0 if k == 0 else float("-inf")
    return k * math.log(mu) - mu - math.lgamma(k + 1)


def _logsumexp(log_values: list[float]) -> float:
    if not log_values:
        return float("-inf")
    m = max(log_values)
    if m == float("-inf"):
        return float("-inf")
    return m + math.log(sum(math.exp(v - m) for v in log_values))


def p_double_spend_if_accepted_now(
    t_seconds: float,
    n: int,
    alpha: float,
    lam: float = 0.1,
) -> float:
    """Probability a transaction with ``n`` confirmations, seen for ``t_seconds``,
    could still be double-spent by an attacker holding ``alpha`` of the hash power.

    ``lam`` is the honest network block rate (blocks per minute); the default of
    0.1 corresponds to Bitcoin's ~10-minute target.
    """
    if not (0.0 < alpha <= 1.0):
        raise ValueError("alpha (attacker hash-power share) must be in (0, 1].")
    if n < 0 or t_seconds < 0:
        raise ValueError("n and t must be non-negative.")

    # A majority attacker (>= 50% hash power) can always eventually out-mine the
    # honest chain, so the double-spend succeeds with probability 1 — the finite
    # catch-up formula below only applies while the attacker is in the minority.
    if alpha >= 0.5:
        return 1.0

    lam = lam / 60  # convert blocks/minute to blocks/second
    mu = alpha * lam * t_seconds
    log_ratio = math.log(alpha / (1.0 - alpha))

    log_catchups = []
    for i in range(-n, 1):
        k = i + n
        log_p_i = _log_poisson_pmf(k, mu)
        log_catchups.append(log_p_i + (-i + 1) * log_ratio)

    log_sum_catchup = _logsumexp(log_catchups)
    sum_catchup = 0.0 if log_sum_catchup == float("-inf") else math.exp(log_sum_catchup)

    # Stable tail probability: P(K > n), not 1 - P(K <= n).
    tail_prob = poisson.sf(n, mu)

    p_ds = sum_catchup + tail_prob
    return max(0.0, min(1.0, p_ds))


def double_spend_probability(t_seconds: float, n: int, alpha: float) -> float:
    """Double-spend probability, short-circuiting deeply-confirmed transactions.

    For n >= NEGLIGIBLE_CONFIRMATION_CAP the true probability is negligibly
    small, so we return 0.0 without running the O(n) computation — otherwise a
    transaction with hundreds of thousands of confirmations would take seconds
    to evaluate. Below the cap this is identical to
    ``p_double_spend_if_accepted_now``.
    """
    # A majority attacker is certain regardless of how many confirmations there
    # are, so this must be checked before the deeply-confirmed short-circuit.
    if alpha >= 0.5:
        return 1.0
    if n >= NEGLIGIBLE_CONFIRMATION_CAP:
        return 0.0
    return p_double_spend_if_accepted_now(t_seconds, n, alpha)
