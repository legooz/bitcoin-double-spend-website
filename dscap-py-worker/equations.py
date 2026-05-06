
import math
from scipy.stats import poisson
import time

def _log_poisson_pmf(k: int, mu: float) -> float:
    if k < 0:
        return float('-inf')
    if mu < 0:
        raise ValueError('mu must be non-negative.')
    if mu == 0:
        return 0.0 if k == 0 else float('-inf')
    return k * math.log(mu) - mu - math.lgamma(k + 1)


def _logsumexp(log_values):
    if not log_values:
        return float('-inf')
    m = max(log_values)
    if m == float('-inf'):
        return float('-inf')
    return m + math.log(sum(math.exp(v - m) for v in log_values))


def p_double_spend_if_accepted_now(T_seconds: float, N: int, alpha: float, lam: float = 0.1) -> float:
    if not (0.0 < alpha < 0.5):
        raise ValueError('This formula assumes attacker has < 50% hashpower (0 < alpha < 0.5).')
    if N < 0 or T_seconds < 0:
        raise ValueError('N and T must be non-negative.')

    lam = lam / 60
    mu = alpha * lam * T_seconds
    log_ratio = math.log(alpha / (1.0 - alpha))

    log_catchups = []
    for i in range(-N, 1):
        k = i + N
        log_p_i = _log_poisson_pmf(k, mu)
        log_catchups.append(log_p_i + (-i + 1) * log_ratio)

    log_sum_catchup = _logsumexp(log_catchups)
    sum_catchup = 0.0 if log_sum_catchup == float('-inf') else math.exp(log_sum_catchup)

    # Stable tail probability: P(K > N), not 1 - P(K <= N)
    tail_prob = poisson.sf(N, mu)

    p_ds = sum_catchup + tail_prob
  
    return max(0.0, min(1.0, p_ds))



if __name__ == '__main__':
    timee = 1776456660
    elapsetime = time.time() - timee
    while True:
       print(p_double_spend_if_accepted_now(elapsetime, N=0,alpha=0.2))
       elapsetime += 1
       time.sleep(1)

        
        