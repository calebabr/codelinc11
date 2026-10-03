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
