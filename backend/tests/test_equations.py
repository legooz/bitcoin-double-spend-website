"""Tests for the double-spend probability math.

These pin down the properties a reviewer would expect: valid range, monotonic
decay with time and confirmations, and rejection of out-of-domain inputs.
"""
import math

import pytest

from app.probability.equations import p_double_spend_if_accepted_now


def test_probability_is_a_valid_probability():
    p = p_double_spend_if_accepted_now(600, 1, 0.2)
    assert 0.0 <= p <= 1.0


def test_probability_decreases_with_more_confirmations():
    high = p_double_spend_if_accepted_now(3600, 1, 0.3)
    low = p_double_spend_if_accepted_now(3600, 6, 0.3)
    assert low < high


def test_risk_grows_with_time_at_fixed_confirmations():
    # With confirmations held fixed, more elapsed time gives the attacker more
    # room to catch up, so the double-spend probability increases. (In practice
    # confirmations accumulate faster than this, which is why the live curve
    # trends downward.)
    early = p_double_spend_if_accepted_now(600, 2, 0.25)
    later = p_double_spend_if_accepted_now(7200, 2, 0.25)
    assert later > early


def test_risk_falls_as_confirmations_outpace_time():
    # One block (~600s) later with one more confirmation: net risk should drop.
    two_conf = p_double_spend_if_accepted_now(600, 2, 0.25)
    three_conf = p_double_spend_if_accepted_now(1200, 3, 0.25)
    assert three_conf < two_conf


def test_higher_attacker_power_means_higher_risk():
    weak = p_double_spend_if_accepted_now(1800, 3, 0.1)
    strong = p_double_spend_if_accepted_now(1800, 3, 0.4)
    assert strong > weak


def test_deep_confirmations_short_circuit_to_zero():
    # A deeply-confirmed transaction is ~0 risk; the wrapper returns 0 directly
    # instead of running the O(n) computation over ~900k confirmations.
    from app.probability.equations import double_spend_probability

    assert double_spend_probability(5e8, 900_000, 0.3) == 0.0


def test_wrapper_matches_formula_below_cap():
    from app.probability.equations import double_spend_probability

    assert double_spend_probability(600, 3, 0.3) == p_double_spend_if_accepted_now(600, 3, 0.3)


def test_majority_alpha_is_certain():
    from app.probability.equations import double_spend_probability

    # >= 50% hash power: double-spend succeeds with probability 1...
    assert p_double_spend_if_accepted_now(600, 5, 0.6) == 1.0
    assert p_double_spend_if_accepted_now(600, 1, 1.0) == 1.0
    # ...even for a deeply-confirmed transaction (past the negligible cap).
    assert double_spend_probability(600, 500, 0.51) == 1.0


def test_rejects_alpha_out_of_domain():
    with pytest.raises(ValueError):
        p_double_spend_if_accepted_now(600, 1, 0.0)
    with pytest.raises(ValueError):
        p_double_spend_if_accepted_now(600, 1, 1.5)


def test_rejects_negative_inputs():
    with pytest.raises(ValueError):
        p_double_spend_if_accepted_now(-1, 1, 0.2)
