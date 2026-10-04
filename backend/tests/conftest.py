import pytest

from app.data import load_catalog, load_plans


@pytest.fixture(scope="session")
def plans():
    return load_plans()


@pytest.fixture(scope="session")
def catalog():
    return load_catalog()


@pytest.fixture(scope="session")
def demo(plans):
    return plans["preferred"]


@pytest.fixture(autouse=True)
def _no_rate_limits(monkeypatch):
    """Rate limits are off for the suite (they have their own tests in test_ratelimit.py)."""
    from app import ratelimit
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "0")
    ratelimit.reset_for_tests()
    yield
    ratelimit.reset_for_tests()


# ---------------------------------------------------------------------------------------------
# Automatic markers (story T1). Files get their markers from their names, so a new test file is
# marked without anyone remembering to. Add a pattern here when you add a new kind of file.
# Run a group with `pytest -m unit`, `pytest -m "api and not slow"`, and so on.
# ---------------------------------------------------------------------------------------------
import fnmatch

_FILE_MARKERS: list[tuple[str, tuple[str, ...]]] = [
    ("test_engine*.py", ("unit",)),
    ("test_data.py", ("unit",)),
    ("test_search.py", ("unit",)),
    ("test_questions.py", ("unit",)),
    ("test_tips.py", ("unit",)),
    ("test_simulate.py", ("unit",)),
    ("test_sequencer_urgency.py", ("unit",)),
    ("test_treatment_plan.py", ("api",)),
    ("test_*api*.py", ("api",)),
    ("test_household_api.py", ("api",)),
    ("test_chat.py", ("api",)),
    ("test_saved_*.py", ("api", "db")),
    ("test_contract_*.py", ("contract", "api")),
    ("test_agent_*.py", ("agent",)),
    ("test_db.py", ("db",)),
    ("test_sandboxes.py", ("db", "api")),
    ("test_regressions.py", ("regression",)),
    ("test_cors.py", ("api",)),
    ("test_ratelimit.py", ("api",)),
    ("test_household_plan.py", ("api", "db")),
    ("test_profiles.py", ("api", "db")),
    ("test_notifications.py", ("api", "db")),
    ("test_t25.py", ("api", "db")),
    ("test_demo_accounts_status.py", ("api", "db")),
]

# Tests measured at more than 3 seconds (see tests/README.md). Matched by file::name.
_SLOW = {
    "test_ratelimit.py::test_disabled_flag_and_zero_means_unlimited",
    "test_ratelimit.py::test_daily_chat_limit",
    "test_ratelimit.py::test_chat_429_has_retry_after_and_friendly_body",
    "test_ratelimit.py::test_global_chat_cap_applies_across_households",
    "test_ratelimit.py::test_household_shared_but_other_households_isolated",
    "test_saved_simulations.py::test_cap_of_20",
    "test_contract_api.py::test_every_documented_endpoint_is_in_openapi",
    "test_chat.py::test_sse_over_http_event_order",
    "test_api.py::test_chat_endpoint_streams_sse",
    "test_agent_compare_plans.py::test_overrides_and_known_codes_change_the_result",
    "test_agent_compare_plans.py::test_chat_loop_uses_the_tool_and_falls_back_to_template_on_invented_numbers",
    "test_simulate.py::test_shares_sum_to_100_and_histograms_sum_to_n",
    "test_simulate.py::test_same_seed_identical_and_different_seed_changes_numbers",
}


def pytest_collection_modifyitems(config, items):
    for item in items:
        fname = item.path.name
        for pattern, names in _FILE_MARKERS:
            if fnmatch.fnmatch(fname, pattern):
                for name in names:
                    item.add_marker(getattr(pytest.mark, name))
        if f"{fname}::{item.originalname or item.name}" in _SLOW:
            item.add_marker(pytest.mark.slow)
